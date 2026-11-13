import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useShoppingStore } from '../../src/hooks';
import {
  SalinoGradientBackground,
  SalinoPrimaryButton,
  SalinoSectionTitle,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
  getCategoryColor,
} from '../../src/components';
import { MrecAd } from '../../src/components/ads';
import { LEVELPLAY_PLACEMENTS } from '../../src/config/levelPlay';
import { dayKey, requestFeatureUse } from '../../src/services/featureUnlock';
import { computeInsights } from '../../src/utils/shoppingInsights';
import { Layout, Typography, useThemeColors } from '../../src/theme';

/** The full breakdown stays open for the rest of the day once unlocked. */
let unlockedDay: string | null = null;

/** "My basket": this month's shopping at a glance; the full breakdown is a rewarded unlock. */
export default function InsightsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const boughtItems = useShoppingStore((s) => s.boughtItems);
  const summary = useMemo(() => computeInsights(boughtItems), [boughtItems]);
  const [unlocked, setUnlocked] = useState(unlockedDay === dayKey());
  const [busy, setBusy] = useState(false);

  const monthName = new Date().toLocaleDateString(i18n.language, { month: 'long' });
  const trend = summary.itemsBought - summary.prevItemsBought;

  const unlock = async () => {
    setBusy(true);
    try {
      if (await requestFeatureUse('insights')) {
        unlockedDay = dayKey();
        setUnlocked(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const textMuted = { color: colors.onSurfaceVariant } as any;

  return (
    <SalinoGradientBackground plain>
      <SalinoWebInnerTopBar title={t('insights_title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.inner}>
          <SalinoSectionTitle text={t('insights_month', { month: monthName })} />
          <View style={styles.statsRow}>
            <SalinoSurfaceCard style={styles.stat}>
              <Text style={[Typography.headlineMedium, { color: colors.primary } as any]}>{summary.itemsBought}</Text>
              <Text style={[Typography.bodySmall, textMuted]}>{t('insights_items_bought')}</Text>
            </SalinoSurfaceCard>
            <SalinoSurfaceCard style={styles.stat}>
              <Text style={[Typography.headlineMedium, { color: colors.primary } as any]}>{summary.shoppingDays}</Text>
              <Text style={[Typography.bodySmall, textMuted]}>{t('insights_shopping_days')}</Text>
            </SalinoSurfaceCard>
          </View>
          {summary.prevItemsBought > 0 && (
            <Text style={[Typography.bodyMedium, textMuted, { textAlign: 'center' } as any]}>
              {trend === 0
                ? t('insights_trend_same')
                : t(trend > 0 ? 'insights_trend_more' : 'insights_trend_less', { count: Math.abs(trend) })}
            </Text>
          )}

          <MrecAd placement={LEVELPLAY_PLACEMENTS.insightsMrec} />

          {summary.itemsBought === 0 ? (
            <SalinoSurfaceCard>
              <Text style={[Typography.bodyMedium, textMuted]}>{t('insights_empty')}</Text>
            </SalinoSurfaceCard>
          ) : !unlocked ? (
            <SalinoSurfaceCard>
              <View style={styles.lockRow}>
                <MaterialCommunityIcons name="chart-donut" size={28} color={colors.primary} />
                <Text style={[Typography.bodyMedium, { color: colors.onSurface, flex: 1 } as any]}>
                  {t('insights_unlock_body')}
                </Text>
              </View>
              <View style={{ marginTop: 12 }}>
                <SalinoPrimaryButton
                  text={t('insights_unlock')}
                  onPress={() => void unlock()}
                  enabled={!busy}
                  loading={busy}
                />
              </View>
            </SalinoSurfaceCard>
          ) : (
            <>
              <SalinoSectionTitle text={t('insights_top_items')} />
              <SalinoSurfaceCard>
                {summary.topItems.map((item, i) => (
                  <View key={item.name} style={styles.listRow}>
                    <Text style={[Typography.titleSmall, { color: colors.primary, width: 24 } as any]}>{i + 1}</Text>
                    <Text style={[Typography.bodyLarge, { color: colors.onSurface, flex: 1 } as any]}>{item.name}</Text>
                    <Text style={[Typography.bodyMedium, textMuted]}>×{item.count}</Text>
                  </View>
                ))}
              </SalinoSurfaceCard>

              <SalinoSectionTitle text={t('insights_categories')} />
              <SalinoSurfaceCard>
                {summary.categories.map((c) => (
                  <View key={c.category} style={styles.catRow}>
                    <Text style={[Typography.bodyMedium, { color: colors.onSurface, width: 110 } as any]}>
                      {t(`category_${c.category.toLowerCase()}`)}
                    </Text>
                    <View style={[styles.barTrack, { backgroundColor: colors.outlineVariant + '55' }]}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${Math.max(4, Math.round(c.share * 100))}%`, backgroundColor: getCategoryColor(c.category) },
                        ]}
                      />
                    </View>
                    <Text style={[Typography.bodySmall, textMuted, { width: 40, textAlign: 'right' } as any]}>
                      {Math.round(c.share * 100)}%
                    </Text>
                  </View>
                ))}
              </SalinoSurfaceCard>

              {summary.buyers.length > 0 && (
                <>
                  <SalinoSectionTitle text={t('insights_buyers')} />
                  <SalinoSurfaceCard>
                    {summary.buyers.map((b) => (
                      <View key={b.name} style={styles.listRow}>
                        <MaterialCommunityIcons name="account-circle-outline" size={20} color={colors.primary} />
                        <Text style={[Typography.bodyLarge, { color: colors.onSurface, flex: 1 } as any]}>{b.name}</Text>
                        <Text style={[Typography.bodyMedium, textMuted]}>{t('insights_buyer_count', { count: b.count })}</Text>
                      </View>
                    ))}
                  </SalinoSurfaceCard>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SalinoGradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Layout.horizontalPadding, paddingTop: 8, alignItems: 'center' },
  inner: { width: '100%', maxWidth: Layout.maxContentWidth, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, alignItems: 'center' },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
});
