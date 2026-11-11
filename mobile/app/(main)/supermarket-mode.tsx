import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, ProgressBar, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useShoppingStore, useHouseholdStore } from '../../src/hooks';
import { useLeaveIfReadOnly } from '../../src/hooks/useHouseholdExpiry';
import { ShoppingItem, ItemCategory } from '../../src/models';
import { BackArrowIcon, EmptyState, SalinoGradientBackground } from '../../src/components';
import { Typography, useThemeColors } from '../../src/theme';
import { auth } from '../../src/remote/firebase';
import { MrecAd } from '../../src/components/ads';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { LEVELPLAY_PLACEMENTS } from '../../src/config/levelPlay';
import { subscribeLevelPlayReady } from '../../src/services/initLevelPlay';
import {
  maybeShowTripEndInterstitial,
  preloadTripEndInterstitial,
} from '../../src/services/interstitialAd';

type Filter = 'ALL' | 'URGENT' | 'MINE' | 'PHARMACY' | 'NOT_FOUND';

// Mirrors Android SupermarketModeViewModel: session-only bought items tracking.
export default function SupermarketModeScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  useLeaveIfReadOnly();
  // The phone is in a hand or a cart while shopping: never let the screen sleep.
  useKeepAwake();
  const { activeItems, markAsBought, markAsActive, isLoading } = useShoppingStore();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [notFoundIds, setNotFoundIds] = useState<Record<string, true>>({});
  const [snackMsg, setSnackMsg] = useState('');
  // Undo for the latest check-off / "not found" shown in the snackbar.
  const [snackUndo, setSnackUndo] = useState<(() => void) | null>(null);
  const [boughtExpanded, setBoughtExpanded] = useState(true);

  // Session state — matches Android SupermarketModeViewModel.sessionBoughtItems.
  // Items the user explicitly marked bought DURING this supermarket session.
  const [sessionBought, setSessionBought] = useState<ShoppingItem[]>([]);
  const sessionStartCountRef = useRef<number | null>(null);
  const sessionStartedRef = useRef(false);
  const tripStartedAtRef = useRef(Date.now());
  const tripEndingRef = useRef(false);

  // Preload the trip-end interstitial while the user shops (no-op when capped).
  useEffect(
    () =>
      subscribeLevelPlayReady((ready) => {
        if (ready) void preloadTripEndInterstitial();
      }),
    [],
  );

  // Initialise sessionStartItemCount on the FIRST emission of active items —
  // mirrors Android `if (!sessionStarted) { sessionStartItemCount = items.size }`.
  // Wait until the store finishes its initial load to avoid capturing 0.
  useEffect(() => {
    if (!sessionStartedRef.current && !isLoading) {
      sessionStartCountRef.current = activeItems.length;
      sessionStartedRef.current = true;
    }
  }, [activeItems.length, isLoading]);

  const currentUserId = auth.currentUser?.uid;
  const sessionStartCount = sessionStartCountRef.current ?? activeItems.length;

  const sessionBoughtIds = useMemo(
    () => new Set(sessionBought.map((b) => b.id)),
    [sessionBought]
  );

  // Progress counts what *I* checked off on this trip against what is left.
  // (The old "start count − active count" moved whenever a partner added or
  // bought something at home.)
  const boughtInSession = sessionBought.length;
  const stillActive = activeItems.filter((i) => !sessionBoughtIds.has(i.id)).length;
  const total = boughtInSession + stillActive;
  const progress = total > 0 ? boughtInSession / total : 0;
  const notFoundCount = Object.keys(notFoundIds).length;

  // Hide items already moved to session-bought to avoid the brief window where
  // Firestore propagation lags behind our optimistic local update.
  const filteredActive = useMemo(() => {
    const visible = activeItems.filter(
      (i) => !sessionBoughtIds.has(i.id)
    );
    switch (filter) {
      case 'URGENT':
        return visible.filter((i) => i.isUrgent && !notFoundIds[i.id]);
      case 'MINE':
        return visible.filter((i) => i.addedBy === currentUserId && !notFoundIds[i.id]);
      case 'PHARMACY':
        return visible.filter(
          (i) => i.category === ItemCategory.PHARMACY && !notFoundIds[i.id]
        );
      case 'NOT_FOUND':
        return visible.filter((i) => notFoundIds[i.id]);
      default:
        return visible.filter((i) => !notFoundIds[i.id]);
    }
  }, [activeItems, filter, currentUserId, notFoundIds, sessionBoughtIds]);

  // group by category — matches Android groupBy + sortedByDescending(isUrgent)
  const grouped = useMemo(() => {
    const sorted = [...filteredActive].sort(
      (a, b) => Number(b.isUrgent) - Number(a.isUrgent)
    );
    const map = new Map<ItemCategory, ShoppingItem[]>();
    sorted.forEach((it) => {
      const cat = it.category as ItemCategory;
      const arr = map.get(cat) ?? [];
      arr.push(it);
      map.set(cat, arr);
    });
    return Array.from(map.entries());
  }, [filteredActive]);

  const showSnack = (message: string, undo: (() => void) | null) => {
    setSnackMsg(message);
    // Function state must be wrapped, or React would call it as an updater.
    setSnackUndo(() => undo);
  };

  const handleBought = async (item: ShoppingItem) => {
    if (!activeHouseholdId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    // Track locally first so UI doesn't depend on Firestore round-trip.
    setSessionBought((prev) =>
      prev.some((x) => x.id === item.id) ? prev : [...prev, item]
    );
    try {
      await markAsBought(activeHouseholdId, item.id);
      showSnack(`${item.name} ${t('supermarket_mode_item_bought')}`, () => {
        void handleUndoBought(item);
      });
    } catch {
      setSessionBought((prev) => prev.filter((x) => x.id !== item.id));
      Alert.alert('', t('error_generic'));
    }
  };

  const handleUndoBought = async (item: ShoppingItem) => {
    if (!activeHouseholdId) return;
    setSessionBought((prev) => prev.filter((x) => x.id !== item.id));
    try {
      await markAsActive(activeHouseholdId, item.id);
    } catch {
      setSessionBought((prev) =>
        prev.some((x) => x.id === item.id) ? prev : [...prev, item]
      );
      Alert.alert('', t('error_generic'));
    }
  };

  const handleNotFound = (item: ShoppingItem) => {
    setNotFoundIds((prev) => ({ ...prev, [item.id]: true }));
    showSnack(`${item.name} ${t('supermarket_mode_item_not_found')}`, () =>
      handleUndoNotFound(item)
    );
  };

  const handleUndoNotFound = (item: ShoppingItem) => {
    setNotFoundIds((prev) => {
      const cp = { ...prev };
      delete cp[item.id];
      return cp;
    });
  };

  const remainingCount = filteredActive.length;

  // Trip end is the one natural break for a full-screen ad (capped in interstitialAd.ts).
  const endTrip = () => {
    if (tripEndingRef.current) return;
    tripEndingRef.current = true;
    void maybeShowTripEndInterstitial(
      { boughtCount: boughtInSession, tripStartedAt: tripStartedAtRef.current },
      () => router.back(),
    );
  };

  const handleFinish = () => {
    const remaining = activeItems.filter((i) => !notFoundIds[i.id]).length;
    if (remaining === 0) {
      endTrip();
      return;
    }
    Alert.alert(
      t('supermarket_mode_finish_title'),
      t('supermarket_mode_finish_message', { count: remaining }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('supermarket_mode_finish_confirm'),
          onPress: endTrip,
        },
      ]
    );
  };

  const activeNonNotFound = activeItems.filter((i) => !notFoundIds[i.id]);
  const allDone =
    sessionStartedRef.current && activeNonNotFound.length === 0 && sessionStartCount > 0;

  useEffect(() => {
    if (allDone) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
    }
  }, [allDone]);

  return (
    <SalinoGradientBackground plain style={styles.container}>
      <Header
        progress={progress}
        bought={boughtInSession}
        total={total}
        onBack={() => router.back()}
      />

      <View style={{ paddingHorizontal: 12 }}>
        <OfflineBanner />
      </View>

      <FilterRow filter={filter} onFilter={setFilter} notFoundCount={notFoundCount} />

      {allDone ? (
        <AllDoneBanner />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingBottom: insets.bottom + 96,
          }}
        >
          {grouped.length === 0 && sessionBought.length === 0 ? (
            <EmptyState
              icon="storefront-outline"
              title={t('supermarket_mode_empty_title')}
              subtitle={t('supermarket_mode_empty_subtitle')}
            />
          ) : (
            grouped.map(([cat, items]) => {
              const isCollapsed = !!collapsed[cat];
              return (
                <View key={cat}>
                  <CategoryHeader
                    category={cat}
                    count={items.length}
                    collapsed={isCollapsed}
                    onToggle={() =>
                      setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))
                    }
                  />
                  {!isCollapsed &&
                    items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        isNotFound={!!notFoundIds[item.id]}
                        onBought={() => handleBought(item)}
                        onNotFound={() => handleNotFound(item)}
                        onUndoNotFound={() => handleUndoNotFound(item)}
                      />
                    ))}
                </View>
              );
            })
          )}

          {sessionBought.length > 0 && (
            <>
              <View style={{ height: 10 }} />
              <Pressable
                onPress={() => setBoughtExpanded((v) => !v)}
                style={styles.boughtToggleRow}
              >
                <MaterialCommunityIcons
                  name={boughtExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.onSurfaceVariant}
                />
                <View style={{ width: 8 }} />
                <Text
                  style={[
                    Typography.labelLarge,
                    { color: colors.onSurfaceVariant } as any,
                  ]}
                >
                  {t('shopping_list_bought_section')}
                </Text>
              </Pressable>
              {boughtExpanded &&
                sessionBought.map((item) => (
                  <BoughtRow
                    key={`bought_${item.id}`}
                    item={item}
                    onRestore={() => handleUndoBought(item)}
                  />
                ))}
            </>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>
      )}

      <BottomBar onAddItem={() => router.push('/(main)/add-item')} onFinish={handleFinish} />

      <Snackbar
        visible={!!snackMsg}
        onDismiss={() => {
          setSnackMsg('');
          setSnackUndo(null);
        }}
        duration={4000}
        style={{ marginBottom: insets.bottom + 80 }}
        action={
          snackUndo
            ? {
                label: t('supermarket_mode_undo'),
                onPress: () => {
                  const undo = snackUndo;
                  setSnackMsg('');
                  setSnackUndo(null);
                  undo();
                },
              }
            : undefined
        }
      >
        {snackMsg}
      </Snackbar>
    </SalinoGradientBackground>
  );
}

function Header({
  progress,
  bought,
  total,
  onBack,
}: {
  progress: number;
  bought: number;
  total: number;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.headerSurface,
        {
          paddingTop: insets.top,
          backgroundColor: colors.primaryContainer + '4D',
        },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 4,
          paddingRight: 16,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={6}
          style={{ padding: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
        >
          <BackArrowIcon color={colors.onSurface} />
        </Pressable>
        <MaterialCommunityIcons name="storefront" size={22} color={colors.primary} />
        <View style={{ width: 6 }} />
        <Text
          style={[
            Typography.titleMedium,
            { color: colors.onSurface, fontWeight: '700' } as any,
          ]}
          numberOfLines={1}
        >
          {t('supermarket_mode_title')}
        </Text>
        <View style={{ flex: 1, minWidth: 6 }} />
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 16,
            backgroundColor: colors.primary + '1f',
          }}
        >
          <Text
            style={[
              Typography.labelMedium,
              { color: colors.primary, fontWeight: '700' } as any,
            ]}
            numberOfLines={1}
          >
            {t('supermarket_mode_progress', { done: bought, total })}
          </Text>
        </View>
      </View>
      {total > 0 && (
        <ProgressBar
          progress={progress}
          color={colors.primary}
          style={{ height: 4, backgroundColor: colors.surfaceVariant }}
        />
      )}
    </View>
  );
}

function FilterRow({
  filter,
  onFilter,
  notFoundCount,
}: {
  filter: Filter;
  onFilter: (f: Filter) => void;
  notFoundCount: number;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const defs: { id: Filter; label: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap; badge?: string }[] = [
    { id: 'ALL', label: t('supermarket_mode_filter_all_label') },
    { id: 'URGENT', label: t('supermarket_mode_filter_urgent'), icon: 'priority-high' },
    { id: 'MINE', label: t('supermarket_mode_filter_mine') },
    { id: 'PHARMACY', label: t('supermarket_mode_filter_pharmacy_label') },
    {
      id: 'NOT_FOUND',
      label: t('supermarket_mode_filter_not_found'),
      icon: 'magnify-close',
      badge: notFoundCount > 0 ? String(notFoundCount) : undefined,
    },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterContent}
    >
      {defs.map((d) => {
        const selected = filter === d.id;
        return (
          <Pressable
            key={d.id}
            onPress={() => onFilter(d.id)}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 50,
                borderWidth: 1,
                backgroundColor: selected ? colors.primaryContainer : colors.surface,
                borderColor: colors.outlineVariant,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {d.icon && (
              <MaterialCommunityIcons
                name={d.icon}
                size={16}
                color={selected ? colors.onPrimaryContainer : colors.onSurfaceVariant}
              />
            )}
            <Text
              style={[
                Typography.labelMedium,
                {
                  color: selected ? colors.onPrimaryContainer : colors.onSurface,
                  fontWeight: '600',
                } as any,
              ]}
              numberOfLines={1}
            >
              {d.label}
              {d.badge ? ` (${d.badge})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function CategoryHeader({
  category,
  count,
  collapsed,
  onToggle,
}: {
  category: ItemCategory;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.catHeader,
        { backgroundColor: colors.surfaceVariant + '80' },
      ]}
    >
      <MaterialCommunityIcons
        name={collapsed ? 'chevron-down' : 'chevron-up'}
        size={18}
        color={colors.onSurfaceVariant}
      />
      <View style={{ width: 6 }} />
      <Text
        style={[
          Typography.labelLarge,
          { color: colors.onSurfaceVariant, fontWeight: '700' } as any,
        ]}
        numberOfLines={1}
      >
        {t(`category_${category.toLowerCase()}`)}
      </Text>
      <View style={{ width: 6 }} />
      <View
        style={{
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 9999,
          backgroundColor: colors.primary + '1f',
        }}
      >
        <Text
          style={[
            Typography.labelSmall,
            { color: colors.primary, fontWeight: '700' } as any,
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function ItemRow({
  item,
  isNotFound,
  onBought,
  onNotFound,
  onUndoNotFound,
}: {
  item: ShoppingItem;
  isNotFound: boolean;
  onBought: () => void;
  onNotFound: () => void;
  onUndoNotFound: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  if (isNotFound) {
    return (
      <View
        style={[
          styles.itemRow,
          {
            backgroundColor: colors.errorContainer + '4D',
            borderRadius: 12,
            marginVertical: 2,
          },
        ]}
      >
        <MaterialCommunityIcons name="magnify-close" size={20} color={colors.error} />
        <Text
          style={[
            Typography.bodyMedium,
            {
              flex: 1,
              color: colors.onSurface + '80',
              textDecorationLine: 'line-through',
              marginLeft: 10,
            } as any,
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Pressable
          onPress={onUndoNotFound}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${t('supermarket_mode_undo')}: ${item.name}`}
        >
          <Text
            style={[
              Typography.labelSmall,
              { color: colors.primary, fontWeight: '700' } as any,
            ]}
          >
            {t('supermarket_mode_undo')}
          </Text>
        </Pressable>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onBought}
      accessibilityRole="button"
      accessibilityLabel={[
        `${t('shopping_list_mark_bought')}: ${item.name}`,
        item.isUrgent ? t('urgent_toggle_title') : null,
        item.quantity !== 1 || item.unit
          ? `${item.quantity}${item.unit ? ` ${t(`unit_${item.unit.toLowerCase()}`)}` : ''}`
          : null,
        item.note || null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [
        styles.itemRow,
        {
          backgroundColor: colors.surface,
          borderRadius: 12,
          marginVertical: 2,
          // Compose tonalElevation 1.dp + shadowElevation 0.5.dp on ActiveItemRow
          boxShadow: '0px 1px 2px rgba(0,0,0,0.06)',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Pressable
        onPress={onBought}
        hitSlop={6}
        // The whole row is already the "bought" button for screen readers.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.circleCheck,
          { backgroundColor: colors.primaryContainer + '80' },
        ]}
      >
        <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
      </Pressable>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text
          style={[
            Typography.bodyLarge,
            { color: colors.onSurface } as any,
          ]}
          numberOfLines={1}
        >
          {item.isUrgent ? `${item.name} ❗` : item.name}
        </Text>
        {(item.quantity !== 1 || item.unit || item.note) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            {(item.quantity !== 1 || item.unit) && (
              <Text
                style={[
                  Typography.bodySmall,
                  { color: colors.onSurfaceVariant } as any,
                ]}
              >
                {item.quantity}
                {item.unit ? ` ${t(`unit_${item.unit.toLowerCase()}`)}` : ''}
              </Text>
            )}
            {item.note ? (
              <>
                {(item.quantity !== 1 || item.unit) && (
                  <Text style={{ color: colors.outline }}> · </Text>
                )}
                <Text
                  style={[
                    Typography.bodySmall,
                    { color: colors.onSurfaceVariant + 'b3' } as any,
                  ]}
                  numberOfLines={1}
                >
                  {item.note}
                </Text>
              </>
            ) : null}
          </View>
        )}
      </View>
      <Pressable
        onPress={onNotFound}
        hitSlop={6}
        style={{ padding: 6 }}
        accessibilityRole="button"
        accessibilityLabel={`${t('supermarket_mode_filter_not_found')}: ${item.name}`}
      >
        <MaterialCommunityIcons name="magnify-close" size={20} color={colors.outline} />
      </Pressable>
    </Pressable>
  );
}

function BoughtRow({ item, onRestore }: { item: ShoppingItem; onRestore: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <View style={[styles.itemRow, { paddingHorizontal: 10, paddingVertical: 8 }]}>
      <MaterialCommunityIcons name="check-circle" size={22} color={colors.primary + '66'} />
      <Text
        style={[
          Typography.bodyLarge,
          {
            flex: 1,
            color: colors.onSurface + '61',
            textDecorationLine: 'line-through',
            marginLeft: 10,
          } as any,
        ]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
      <Pressable
        onPress={onRestore}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${t('shopping_list_undo_bought')}: ${item.name}`}
      >
        <Text style={[Typography.labelMedium, { color: colors.primary } as any]}>
          {t('shopping_list_undo_bought')}
        </Text>
      </Pressable>
    </View>
  );
}

function AllDoneBanner() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.primaryContainer,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons name="party-popper" size={40} color={colors.primary} />
      </View>
      <View style={{ height: 20 }} />
      <Text
        style={[
          Typography.headlineSmall,
          { color: colors.primary, fontWeight: '700' } as any,
        ]}
      >
        {t('supermarket_mode_all_done')}
      </Text>
      <View style={{ height: 8 }} />
      <Text
        style={[
          Typography.bodyMedium,
          { color: colors.onSurfaceVariant, textAlign: 'center' } as any,
        ]}
      >
        {t('supermarket_mode_all_done_subtitle')}
      </Text>
      <MrecAd placement={LEVELPLAY_PLACEMENTS.allDoneMrec} />
    </View>
  );
}

function BottomBar({
  onAddItem,
  onFinish,
}: {
  onAddItem: () => void;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bottomBar,
        {
          backgroundColor: colors.surface,
          paddingBottom: insets.bottom + 10,
          // Soft upward shadow — matches Android SupermarketBottomBar Surface
          // (shadowElevation = 12dp with default Material ambient/spot).
          boxShadow: '0px -2px 8px rgba(0,0,0,0.08)',
        },
      ]}
    >
      <Pressable
        onPress={onAddItem}
        style={({ pressed }) => [
          styles.bottomBtn,
          {
            backgroundColor: colors.secondaryContainer,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <MaterialCommunityIcons name="plus" size={20} color={colors.onSecondaryContainer} />
        <Text
          style={[
            Typography.labelLarge,
            { color: colors.onSecondaryContainer, marginLeft: 6 } as any,
          ]}
          numberOfLines={1}
        >
          {t('supermarket_mode_add_item')}
        </Text>
      </Pressable>
      <Pressable
        onPress={onFinish}
        style={({ pressed }) => [
          styles.bottomBtn,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <MaterialCommunityIcons name="cart-check" size={20} color={colors.onPrimary} />
        <Text
          style={[
            Typography.labelLarge,
            { color: colors.onPrimary, marginLeft: 6 } as any,
          ]}
          numberOfLines={1}
        >
          {t('supermarket_mode_finish')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSurface: { width: '100%' },
  // flexGrow:0 + alignItems:'center' on contentContainer keeps the horizontal
  // filter strip from expanding vertically and stretching chips into tall pills.
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterContent: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  boughtToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  circleCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  bottomBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
