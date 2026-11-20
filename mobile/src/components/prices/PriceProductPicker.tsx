import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, I18nManager, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { searchProducts } from '../../services/prices/pricesApi';
import type { ProductHit } from '../../services/prices/types';
import { Typography, useThemeColors } from '../../theme';
import { formatShekel } from './format';

/** Lets the shopper pin the exact product (barcode) an item should be compared by. */
export function PriceProductPicker({
  visible,
  initialQuery,
  storeRefs,
  locked,
  onPick,
  onUnlock,
  onDismiss,
}: {
  visible: boolean;
  initialQuery: string;
  storeRefs: string[];
  locked: boolean;
  onPick: (hit: ProductHit) => void;
  onUnlock: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (visible) setQuery(initialQuery);
  }, [visible, initialQuery]);

  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const id = ++seq.current;
    const timer = setTimeout(() => {
      setLoading(true);
      setFailed(false);
      searchProducts(q, storeRefs)
        .then((r) => {
          if (id === seq.current) setResults(r);
        })
        .catch(() => {
          if (id === seq.current) setFailed(true);
        })
        .finally(() => {
          if (id === seq.current) setLoading(false);
        });
    }, 350);
    return () => clearTimeout(timer);
    // storeRefs is compared by content: a new array with the same stores must not re-search.
  }, [query, visible, storeRefs.join(',')]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: height * 0.82 }}>
        <Dialog.Title style={Typography.titleMedium}>{t('prices_pick_title')}</Dialog.Title>
        <Dialog.Content style={{ paddingBottom: 0 }}>
          <TextInput
            mode="outlined"
            value={query}
            onChangeText={setQuery}
            placeholder={t('prices_pick_placeholder')}
            autoFocus
            right={loading ? <TextInput.Icon icon={() => <ActivityIndicator size="small" />} /> : undefined}
          />
          <Text style={[Typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: 6 } as any]}>
            {t('prices_pick_hint')}
          </Text>
        </Dialog.Content>
        <Dialog.ScrollArea style={{ maxHeight: height * 0.45, paddingHorizontal: 0 }}>
          <FlatList
            data={results}
            keyExtractor={(h) => h.code}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              query.trim().length >= 2 && !loading ? (
                <Text style={[Typography.bodyMedium, styles.empty, { color: colors.onSurfaceVariant } as any]}>
                  {failed ? t('prices_error_generic') : t('prices_pick_empty')}
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item)}
                style={({ pressed }) => [styles.row, { borderBottomColor: `${colors.outlineVariant}88` }, pressed && { opacity: 0.6 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.bodyLarge, { color: colors.onSurface } as any]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.onSurfaceVariant } as any]} numberOfLines={1}>
                    {[item.size, item.maker].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {item.minPrice != null && (
                  <Text style={[Typography.labelLarge, { color: colors.primary } as any]}>
                    {item.maxPrice != null && item.maxPrice !== item.minPrice
                      ? `${formatShekel(item.minPrice)}–${formatShekel(item.maxPrice)}`
                      : formatShekel(item.minPrice)}
                  </Text>
                )}
                <MaterialCommunityIcons
                  name={I18nManager.isRTL ? 'chevron-left' : 'chevron-right'}
                  size={20}
                  color={colors.onSurfaceVariant}
                />
              </Pressable>
            )}
          />
        </Dialog.ScrollArea>
        <Dialog.Actions>
          {locked && <Button onPress={onUnlock}>{t('prices_pick_unlock')}</Button>}
          <Button onPress={onDismiss}>{t('cancel')}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: { textAlign: 'center', paddingVertical: 24, paddingHorizontal: 24 },
});
