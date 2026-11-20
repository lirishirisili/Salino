import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useHouseholdStore, useShoppingStore } from '../../src/hooks';
import { useIsHouseholdReadOnly } from '../../src/hooks/useHouseholdExpiry';
import {
  basketSaving,
  compareInputs,
  basketKey,
  usePriceCompareStore,
} from '../../src/hooks/usePriceCompareStore';
import {
  SalinoGradientBackground,
  SalinoPrimaryButton,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
  SalinoWebSegmentedTabs,
} from '../../src/components';
import { MrecAd } from '../../src/components/ads';
import { PriceLocationDialog } from '../../src/components/prices/PriceLocationDialog';
import { PriceProductPicker } from '../../src/components/prices/PriceProductPicker';
import {
  formatAmount,
  formatDistance,
  formatShekel,
  formatStamp,
  storeTitle,
} from '../../src/components/prices/format';
import { LEVELPLAY_PLACEMENTS } from '../../src/config/levelPlay';
import { dayKey, requestFeatureUse } from '../../src/services/featureUnlock';
import { logAppEvent } from '../../src/services/initMobileAnalytics';
import { listCities } from '../../src/services/prices/nearbyStores';
import type { NearbyStore, ProductHit, StoreLine, StoreResult } from '../../src/services/prices/types';
import type { ShoppingItem } from '../../src/models';
import { Layout, Typography, useThemeColors } from '../../src/theme';

/** The two-store split stays open for the rest of the day once unlocked. */
let splitUnlockedDay: string | null = null;

function openNavigation(store: NearbyStore): void {
  if (store.lat == null || store.lng == null) return;
  const label = encodeURIComponent(store.name);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${store.lat},${store.lng}&q=${label}`
      : `geo:${store.lat},${store.lng}?q=${store.lat},${store.lng}(${label})`;
  logAppEvent('price_navigate', { chain: store.chain });
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`).catch(() => undefined),
  );
}

export default function PriceCompareScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const activeItems = useShoppingStore((s) => s.activeItems);
  const updateItem = useShoppingStore((s) => s.updateItem);
  const readOnly = useIsHouseholdReadOnly();

  const prefs = usePriceCompareStore((s) => s.prefs);
  const index = usePriceCompareStore((s) => s.index);
  const stores = usePriceCompareStore((s) => s.stores);
  const originSource = usePriceCompareStore((s) => s.originSource);
  const status = usePriceCompareStore((s) => s.status);
  const error = usePriceCompareStore((s) => s.error);
  const result = usePriceCompareStore((s) => s.result);
  const prepare = usePriceCompareStore((s) => s.prepare);
  const locate = usePriceCompareStore((s) => s.locate);
  const chooseCity = usePriceCompareStore((s) => s.chooseCity);
  const setRadius = usePriceCompareStore((s) => s.setRadius);
  const toggleClub = usePriceCompareStore((s) => s.toggleClub);
  const run = usePriceCompareStore((s) => s.run);

  const [tab, setTab] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [whereOpen, setWhereOpen] = useState(false);
  const [pickerItem, setPickerItem] = useState<ShoppingItem | null>(null);
  const [splitUnlocked, setSplitUnlocked] = useState(splitUnlockedDay === dayKey());
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    void prepare();
  }, [prepare]);

  const itemsKey = useMemo(() => basketKey(compareInputs(activeItems)), [activeItems]);
  const storesKey = stores.map((s) => s.ref).join(',');
  const clubsKey = prefs.clubs.join(',');
  // `idle` = stores were just picked. run() itself skips a request identical to the last result.
  const canRun = status === 'idle' || status === 'ready';
  useEffect(() => {
    if (canRun && stores.length > 0 && activeItems.length > 0) void run(activeItems);
  }, [itemsKey, storesKey, clubsKey, canRun]);

  const requestMyLocation = async () => {
    if ((await locate()) !== 'blocked') return;
    Alert.alert(t('prices_location_title'), t('prices_location_blocked'), [
      { text: t('prices_choose_city'), onPress: () => setWhereOpen(true) },
      { text: t('prices_open_settings'), onPress: () => void Linking.openSettings() },
    ]);
  };

  const storeRefs = useMemo(() => stores.map((s) => s.ref), [stores]);
  const nearbyByRef = useMemo(() => new Map(stores.map((s) => [s.ref, s])), [stores]);
  const itemById = useMemo(() => new Map(activeItems.map((i) => [i.id, i])), [activeItems]);
  const cities = useMemo(() => (index ? listCities(index) : []), [index]);
  const resultByKey = useMemo(() => new Map((result?.stores ?? []).map((s) => [s.key, s])), [result]);
  const chainsInResult = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of result?.stores ?? []) if (!seen.has(s.chain)) seen.set(s.chain, s.chainName);
    return [...seen.entries()];
  }, [result]);

  const units = { km: t('prices_unit_km'), m: t('prices_unit_m') };
  const kg = t('prices_unit_kg');
  const muted = { color: colors.onSurfaceVariant } as any;

  const whereLabel =
    originSource === 'city' && prefs.city
      ? t('prices_where_city', { city: prefs.city, count: stores.length })
      : originSource === 'gps'
        ? t('prices_where_near', { km: prefs.radiusKm, count: stores.length })
        : t('prices_where_unset');

  const unlockSplit = async () => {
    setUnlocking(true);
    try {
      if (await requestFeatureUse('price_split')) {
        splitUnlockedDay = dayKey();
        setSplitUnlocked(true);
        logAppEvent('price_split_view', { saving: result?.split?.saving ?? 0 });
      }
    } finally {
      setUnlocking(false);
    }
  };

  const lockProduct = async (item: ShoppingItem, hit: ProductHit) => {
    setPickerItem(null);
    if (!activeHouseholdId) return;
    await updateItem(activeHouseholdId, {
      ...item,
      priceCode: hit.code,
      priceCodeFor: item.normalizedName,
      priceLabel: hit.name,
    }).catch(() => undefined);
    logAppEvent('price_product_locked', { chains: hit.chains });
  };

  const unlockProduct = async (item: ShoppingItem) => {
    setPickerItem(null);
    if (!activeHouseholdId) return;
    await updateItem(activeHouseholdId, { ...item, priceCode: null, priceCodeFor: null, priceLabel: null }).catch(
      () => undefined,
    );
  };

  const renderLine = (line: StoreLine) => {
    const item = itemById.get(line.id);
    return (
      <View key={line.id} style={styles.line}>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.bodyMedium, { color: colors.onSurface } as any]} numberOfLines={2}>
            {line.n}
          </Text>
          <Text style={[Typography.bodySmall, muted]} numberOfLines={1}>
            {[item?.name, line.size, formatAmount(line.amount, line.weighted, kg)].filter(Boolean).join(' · ')}
          </Text>
          {line.promo && (
            <Text style={[Typography.bodySmall, { color: colors.success } as any]} numberOfLines={2}>
              {line.promo.club ? `${t('prices_club_promo')}: ` : `${t('prices_promo')}: `}
              {line.promo.d}
            </Text>
          )}
          {line.hint && (
            <Text style={[Typography.bodySmall, { color: colors.tertiary } as any]} numberOfLines={2}>
              {t('prices_hint', { min: line.hint.min, price: formatShekel(line.hint.b) })}
            </Text>
          )}
          {line.approx && line.packCost != null && (
            <Text style={[Typography.bodySmall, { color: colors.warning } as any]} numberOfLines={2}>
              {t('prices_approx', { price: formatShekel(line.packCost) })}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[Typography.labelLarge, { color: colors.onSurface } as any]}>{formatShekel(line.cost)}</Text>
          {line.regular > line.cost && (
            <Text style={[Typography.bodySmall, muted, { textDecorationLine: 'line-through' } as any]}>
              {formatShekel(line.regular)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderMissing = (store: StoreResult) =>
    store.missing.length > 0 ? (
      <Text style={[Typography.bodySmall, muted, { marginTop: 6 } as any]}>
        {t('prices_missing_list', {
          items: store.missing.map((id) => itemById.get(id)?.name ?? '').filter(Boolean).join(', '),
        })}
      </Text>
    ) : null;

  const renderStore = (store: StoreResult, rank: number) => {
    const nearby = nearbyByRef.get(store.key);
    const distance = formatDistance(nearby?.distanceKm ?? null, units);
    const open = expanded === store.key;
    const partial = result != null && store.found < result.matchedItems;
    return (
      <SalinoSurfaceCard key={store.key} padding={14}>
        <Pressable onPress={() => setExpanded(open ? null : store.key)} style={styles.storeHead}>
          <View style={[styles.rank, { backgroundColor: rank === 1 ? colors.primary : `${colors.primary}22` }]}>
            <Text style={[Typography.labelLarge, { color: rank === 1 ? colors.onPrimary : colors.primary } as any]}>
              {rank}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.titleSmall, { color: colors.onSurface } as any]} numberOfLines={1}>
              {storeTitle(store.chainName, store.name)}
            </Text>
            <Text style={[Typography.bodySmall, muted]} numberOfLines={1}>
              {[distance, t('prices_found', { found: store.found, total: result?.matchedItems ?? 0 })]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[Typography.titleMedium, { color: colors.onSurface } as any]}>
              {partial ? '~' : ''}
              {formatShekel(store.estimated)}
            </Text>
            {store.promoSavings > 0 && (
              <Text style={[Typography.bodySmall, { color: colors.success } as any]}>
                {t('prices_promo_saving', { price: formatShekel(store.promoSavings) })}
              </Text>
            )}
          </View>
          <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.onSurfaceVariant} />
        </Pressable>
        {open && (
          <View style={{ marginTop: 8 }}>
            {store.lines.map(renderLine)}
            {renderMissing(store)}
            {partial && (
              <Text style={[Typography.bodySmall, muted, { marginTop: 6 } as any]}>{t('prices_estimate_note')}</Text>
            )}
            <View style={styles.storeActions}>
              {nearby?.lat != null && (
                <Button icon="navigation-variant" compact onPress={() => openNavigation(nearby)}>
                  {t('prices_navigate')}
                </Button>
              )}
              <Text style={[Typography.bodySmall, muted]}>
                {t('prices_updated', { time: formatStamp(store.updatedAt) })}
              </Text>
            </View>
          </View>
        )}
      </SalinoSurfaceCard>
    );
  };

  const renderWinner = (best: StoreResult) => {
    const nearby = nearbyByRef.get(best.key);
    const distance = formatDistance(nearby?.distanceKm ?? null, units);
    const saving = result ? basketSaving(result) : 0;
    const partial = result != null && best.found < result.matchedItems;
    return (
      <SalinoSurfaceCard style={{ borderWidth: 2, borderColor: colors.primary }}>
        <View style={styles.winnerBadgeRow}>
          <MaterialCommunityIcons name="trophy-outline" size={18} color={colors.primary} />
          <Text style={[Typography.labelLarge, { color: colors.primary } as any]}>{t('prices_winner')}</Text>
        </View>
        <View style={styles.winnerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.titleLarge, { color: colors.onSurface } as any]} numberOfLines={2}>
              {storeTitle(best.chainName, best.name)}
            </Text>
            <Text style={[Typography.bodySmall, muted]} numberOfLines={1}>
              {[best.address, distance].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Text style={[Typography.headlineSmall, { color: colors.primary, fontWeight: '800' } as any]}>
            {partial ? '~' : ''}
            {formatShekel(best.estimated)}
          </Text>
        </View>
        <Text style={[Typography.bodyMedium, { color: colors.onSurface, marginTop: 6 } as any]}>
          {t('prices_found', { found: best.found, total: result?.matchedItems ?? 0 })}
          {saving >= 100 ? ` · ${t('prices_saving', { price: formatShekel(saving) })}` : ''}
        </Text>
        <View style={styles.winnerActions}>
          {nearby?.lat != null && (
            <Button mode="contained" icon="navigation-variant" onPress={() => openNavigation(nearby)}>
              {t('prices_navigate')}
            </Button>
          )}
          <Button
            mode="outlined"
            onPress={() => {
              setTab(0);
              setExpanded(best.key);
            }}
          >
            {t('prices_details')}
          </Button>
        </View>
      </SalinoSurfaceCard>
    );
  };

  const renderSplit = () => {
    if (!result) return null;
    if (!splitUnlocked) {
      return (
        <SalinoSurfaceCard>
          <View style={styles.lockRow}>
            <MaterialCommunityIcons name="call-split" size={28} color={colors.primary} />
            <Text style={[Typography.bodyMedium, { color: colors.onSurface, flex: 1 } as any]}>
              {t('prices_split_unlock_body')}
            </Text>
          </View>
          <View style={{ marginTop: 12 }}>
            <SalinoPrimaryButton
              text={t('prices_split_unlock')}
              onPress={() => void unlockSplit()}
              enabled={!unlocking}
              loading={unlocking}
            />
          </View>
        </SalinoSurfaceCard>
      );
    }
    const split = result.split;
    if (!split) {
      return (
        <SalinoSurfaceCard>
          <Text style={[Typography.bodyMedium, { color: colors.onSurface } as any]}>
            {t('prices_split_none', { store: result.stores[0] ? storeTitle(result.stores[0].chainName, result.stores[0].name) : '' })}
          </Text>
        </SalinoSurfaceCard>
      );
    }
    return (
      <>
        <SalinoSurfaceCard style={{ borderWidth: 2, borderColor: colors.primary }}>
          <Text style={[Typography.titleMedium, { color: colors.onSurface } as any]}>
            {t('prices_split_title', { price: formatShekel(split.saving) })}
          </Text>
          <Text style={[Typography.bodyMedium, muted]}>{t('prices_split_total', { price: formatShekel(split.total) })}</Text>
        </SalinoSurfaceCard>
        {split.stores.map((ref) => {
          const store = resultByKey.get(ref);
          if (!store) return null;
          const lines = store.lines.filter((l) => split.assign[l.id] === ref);
          const subtotal = lines.reduce((sum, l) => sum + l.cost, 0);
          const nearby = nearbyByRef.get(ref);
          return (
            <SalinoSurfaceCard key={ref} padding={14}>
              <View style={styles.storeHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.titleSmall, { color: colors.onSurface } as any]} numberOfLines={1}>
                    {storeTitle(store.chainName, store.name)}
                  </Text>
                  <Text style={[Typography.bodySmall, muted]}>
                    {[formatDistance(nearby?.distanceKm ?? null, units), t('prices_split_items', { count: lines.length })]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Text style={[Typography.titleMedium, { color: colors.onSurface } as any]}>{formatShekel(subtotal)}</Text>
              </View>
              <View style={{ marginTop: 8 }}>{lines.map(renderLine)}</View>
              {nearby?.lat != null && (
                <Button icon="navigation-variant" compact style={{ alignSelf: 'flex-start' }} onPress={() => openNavigation(nearby)}>
                  {t('prices_navigate')}
                </Button>
              )}
            </SalinoSurfaceCard>
          );
        })}
      </>
    );
  };

  const renderItems = () => {
    if (!result) return null;
    return (
      <SalinoSurfaceCard padding={14}>
        {result.items.map((r) => {
          const item = itemById.get(r.id);
          if (!item) return null;
          const cheapestStore = r.cheapest ? resultByKey.get(r.cheapest.store) : null;
          const locked = r.mode === 'exact';
          return (
            <View key={r.id} style={[styles.itemRow, { borderBottomColor: `${colors.outlineVariant}88` }]}>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.bodyLarge, { color: colors.onSurface } as any]} numberOfLines={1}>
                  {item.name}
                  {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                </Text>
                <Text style={[Typography.bodySmall, muted]} numberOfLines={2}>
                  {r.product ? [r.product.name, r.product.size].filter(Boolean).join(' · ') : t('prices_item_not_found')}
                </Text>
                {cheapestStore && r.cheapest && (
                  <Text style={[Typography.bodySmall, { color: colors.primary } as any]} numberOfLines={1}>
                    {t('prices_item_cheapest', {
                      price: formatShekel(r.cheapest.cost),
                      store: storeTitle(cheapestStore.chainName, cheapestStore.name),
                    })}
                  </Text>
                )}
              </View>
              {!readOnly && (
                <Pressable
                  onPress={() => setPickerItem(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('prices_pick_title')}
                  style={({ pressed }) => [styles.lockBtn, { backgroundColor: `${colors.primary}14` }, pressed && { opacity: 0.6 }]}
                >
                  <MaterialCommunityIcons name={locked ? 'lock' : 'swap-horizontal'} size={18} color={colors.primary} />
                  <Text style={[Typography.labelSmall, { color: colors.primary } as any]}>
                    {locked ? t('prices_locked') : t('prices_change')}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </SalinoSurfaceCard>
    );
  };

  const renderBody = () => {
    if (activeItems.length === 0) {
      return (
        <SalinoSurfaceCard>
          <Text style={[Typography.bodyMedium, { color: colors.onSurface } as any]}>{t('prices_empty_list')}</Text>
        </SalinoSurfaceCard>
      );
    }
    if (status === 'needs_location') {
      return (
        <SalinoSurfaceCard>
          <View style={styles.lockRow}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={32} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[Typography.titleMedium, { color: colors.onSurface } as any]}>{t('prices_location_title')}</Text>
              <Text style={[Typography.bodyMedium, muted]}>{t('prices_location_body')}</Text>
            </View>
          </View>
          <View style={{ marginTop: 14, gap: 8 }}>
            <SalinoPrimaryButton text={t('prices_use_location')} onPress={() => void requestMyLocation()} />
            <Button mode="outlined" onPress={() => setWhereOpen(true)}>
              {t('prices_choose_city')}
            </Button>
          </View>
        </SalinoSurfaceCard>
      );
    }
    if (status === 'no_stores') {
      return (
        <SalinoSurfaceCard>
          <Text style={[Typography.bodyMedium, { color: colors.onSurface } as any]}>
            {originSource === 'gps' ? t('prices_no_stores_radius', { km: prefs.radiusKm }) : t('prices_no_stores')}
          </Text>
          <Button mode="outlined" style={{ marginTop: 12 }} onPress={() => setWhereOpen(true)}>
            {t('prices_change_where')}
          </Button>
        </SalinoSurfaceCard>
      );
    }
    if (status === 'error') {
      return (
        <SalinoSurfaceCard>
          <Text style={[Typography.bodyMedium, { color: colors.onSurface } as any]}>
            {t(error === 'not_ready' ? 'prices_error_not_ready' : error === 'busy' ? 'prices_error_busy' : error === 'offline' ? 'prices_error_offline' : 'prices_error_generic')}
          </Text>
          <Button
            mode="outlined"
            style={{ marginTop: 12 }}
            onPress={() => (stores.length ? void run(activeItems, true) : void prepare())}
          >
            {t('retry')}
          </Button>
        </SalinoSurfaceCard>
      );
    }
    const busy = status === 'locating' || status === 'loading' || status === 'idle';
    const busyRow = (
      <SalinoSurfaceCard padding={result ? 12 : 18}>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} size={result ? 'small' : 'large'} />
          <Text style={[Typography.bodyMedium, { color: colors.onSurface, flex: 1 } as any]}>
            {status === 'locating' ? t('prices_locating') : t('prices_loading', { count: stores.length })}
          </Text>
        </View>
      </SalinoSurfaceCard>
    );
    // A refresh keeps the previous result on screen under a small progress row.
    if (!result) return busy ? busyRow : null;
    if (result.matchedItems === 0 || result.stores.length === 0) {
      return (
        <>
          {busy && busyRow}
          <SalinoSurfaceCard>
            <Text style={[Typography.bodyMedium, { color: colors.onSurface } as any]}>{t('prices_nothing_matched')}</Text>
          </SalinoSurfaceCard>
        </>
      );
    }
    const best = result.stores[0];
    return (
      <>
        {busy && busyRow}
        {renderWinner(best)}
        <MrecAd placement={LEVELPLAY_PLACEMENTS.priceCompareMrec} />
        {chainsInResult.length > 0 && (
          <View>
            <Text style={[Typography.labelMedium, muted, { marginBottom: 6 } as any]}>{t('prices_clubs_title')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {chainsInResult.map(([key, name]) => (
                <Chip
                  key={key}
                  compact
                  selected={prefs.clubs.includes(key)}
                  icon={prefs.clubs.includes(key) ? 'card-account-details-star' : 'card-account-details-outline'}
                  onPress={() => void toggleClub(key)}
                >
                  {name}
                </Chip>
              ))}
            </ScrollView>
          </View>
        )}
        <SalinoWebSegmentedTabs
          labels={[t('prices_tab_stores'), t('prices_tab_split'), t('prices_tab_items')]}
          selectedIndex={tab}
          onSelect={setTab}
        />
        {tab === 0 && result.stores.map((s, i) => renderStore(s, i + 1))}
        {tab === 1 && renderSplit()}
        {tab === 2 && renderItems()}
        <Text style={[Typography.bodySmall, muted, { textAlign: 'center', marginTop: 4 } as any]}>
          {t('prices_disclaimer')}
        </Text>
      </>
    );
  };

  return (
    <SalinoGradientBackground plain>
      <SalinoWebInnerTopBar title={t('prices_title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.inner}>
          <Pressable
            onPress={() => setWhereOpen(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.whereBar, { borderColor: `${colors.outline}66` }, pressed && { opacity: 0.6 }]}
          >
            <MaterialCommunityIcons
              name={originSource === 'gps' ? 'crosshairs-gps' : 'map-marker-outline'}
              size={18}
              color={colors.primary}
            />
            <Text style={[Typography.bodyMedium, { color: colors.onSurface, flex: 1 } as any]} numberOfLines={1}>
              {whereLabel}
            </Text>
            <Text style={[Typography.labelLarge, { color: colors.primary } as any]}>{t('prices_change_where')}</Text>
          </Pressable>
          {renderBody()}
        </View>
      </ScrollView>

      <PriceLocationDialog
        visible={whereOpen}
        cities={cities}
        city={prefs.city}
        radiusKm={prefs.radiusKm}
        usingLocation={originSource === 'gps'}
        onUseLocation={() => {
          setWhereOpen(false);
          void requestMyLocation();
        }}
        onChooseCity={(city) => {
          setWhereOpen(false);
          void chooseCity(city);
        }}
        onRadius={(km) => void setRadius(km)}
        onDismiss={() => setWhereOpen(false)}
      />

      <PriceProductPicker
        visible={pickerItem != null}
        initialQuery={pickerItem?.name ?? ''}
        storeRefs={storeRefs}
        locked={!!pickerItem?.priceCode && pickerItem.priceCodeFor === pickerItem.normalizedName}
        onPick={(hit) => pickerItem && void lockProduct(pickerItem, hit)}
        onUnlock={() => pickerItem && void unlockProduct(pickerItem)}
        onDismiss={() => setPickerItem(null)}
      />
    </SalinoGradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Layout.horizontalPadding, paddingTop: 8, alignItems: 'center' },
  inner: { width: '100%', maxWidth: Layout.maxContentWidth, gap: 12 },
  whereBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1,
  },
  winnerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  winnerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  winnerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  storeHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  storeActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', gap: 10, paddingVertical: 7 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lockBtn: { alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, minWidth: 56 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { gap: 8, paddingVertical: 2 },
});
