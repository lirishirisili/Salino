import React, { useEffect, useMemo, useState } from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import type { ShoppingItem } from '../../models';
import { basketKey, compareInputs, usePriceCompareStore } from '../../hooks/usePriceCompareStore';
import { requestFeatureUse } from '../../services/featureUnlock';
import { warmPrices } from '../../services/prices/pricesApi';
import { Typography, useThemeColors } from '../../theme';
import { formatShekel, storeTitle } from './format';

/** Shopping list entry point: the last result for this exact list, or an invitation to compare. */
export function PriceCompareEntryCard({ items }: { items: ShoppingItem[] }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const summary = usePriceCompareStore((s) => s.summary);
  const loadPrefs = usePriceCompareStore((s) => s.loadPrefs);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    void loadPrefs();
    warmPrices();
  }, [loadPrefs]);

  const key = useMemo(() => basketKey(compareInputs(items)), [items]);
  const current = summary && summary.itemsKey === key ? summary : null;

  const openCompare = async () => {
    if (opening) return;
    setOpening(true);
    try {
      if (!(await requestFeatureUse('price_compare'))) return;
      router.push('/(main)/price-compare');
    } finally {
      setOpening(false);
    }
  };

  return (
    <Pressable
      onPress={() => void openCompare()}
      disabled={opening}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}40` },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.primary }]}>
        <MaterialCommunityIcons name="tag-multiple-outline" size={20} color={colors.onPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[Typography.titleSmall, { color: colors.onSurface } as any]} numberOfLines={1}>
          {current
            ? t('prices_card_result', {
                store: storeTitle(current.chainName, current.storeName),
                price: `${current.complete ? '' : '~'}${formatShekel(current.total)}`,
              })
            : t('prices_card_title')}
        </Text>
        <Text style={[Typography.bodySmall, { color: colors.onSurfaceVariant } as any]} numberOfLines={1}>
          {current && current.saving >= 100
            ? t('prices_saving', { price: formatShekel(current.saving) })
            : t('prices_card_subtitle')}
        </Text>
      </View>
      <MaterialCommunityIcons
        name={I18nManager.isRTL ? 'chevron-left' : 'chevron-right'}
        size={22}
        color={colors.primary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    marginVertical: 6,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
