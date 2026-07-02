import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useShoppingStore, useHouseholdStore } from '../../src/hooks';
import { useTourAnchor } from '../../src/features/tour';
import {
  CategoryChip,
  EmptyState,
  SalinoGradientBackground,
  SalinoSectionTitle,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
} from '../../src/components';
import { ItemCategory } from '../../src/models';
import { Layout, Typography, useThemeColors } from '../../src/theme';
import { formatRelativeTime } from '../../src/utils';

export default function HistoryScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { boughtItems, markAsActive } = useShoppingStore();
  const historyTitleAnchor = useTourAnchor('history.title');

  const days = useMemo(() => {
    // Group by date label (matches Android dayGroups)
    const groups = new Map<string, typeof boughtItems>();
    for (const item of boughtItems) {
      const date = item.updatedAt?.toDate?.() ?? null;
      const label = date
        ? date.toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : '—';
      const list = groups.get(label) ?? [];
      list.push(item);
      groups.set(label, list);
    }
    return Array.from(groups.entries());
  }, [boughtItems]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    days.length > 0 ? { [days[0][0]]: true } : {}
  );

  return (
    <SalinoGradientBackground>
      <View ref={historyTitleAnchor.ref} style={historyTitleAnchor.highlightStyle} collapsable={false}>
        <SalinoWebInnerTopBar title={t('history_title')} onBack={() => router.back()} />
      </View>
      {boughtItems.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignSelf: 'center',
            width: '100%',
            maxWidth: Layout.maxContentWidth,
            paddingHorizontal: Layout.horizontalPadding,
          }}
        >
          <EmptyState
            icon="receipt"
            title={t('history_empty_title')}
            subtitle={t('history_empty_subtitle')}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 24 },
          ]}
        >
          <View style={styles.inner}>
            {days.map(([dateLabel, items]) => {
              const isExpanded = !!expanded[dateLabel];
              return (
                <View key={dateLabel}>
                  <Pressable
                    onPress={() => setExpanded((p) => ({ ...p, [dateLabel]: !p[dateLabel] }))}
                    style={styles.dayHeader}
                  >
                    <SalinoSectionTitle text={dateLabel} />
                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color={colors.onSurfaceVariant}
                    />
                  </Pressable>
                  {isExpanded &&
                    items.map((it) => (
                      <SalinoSurfaceCard key={it.id} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[Typography.titleMedium, { color: colors.onSurface } as any]}>
                              {it.name}
                            </Text>
                            {it.quantity > 0 && (
                              <Text
                                style={[
                                  Typography.bodySmall,
                                  { color: colors.onSurfaceVariant, marginTop: 2 } as any,
                                ]}
                              >
                                {it.quantity}
                                {it.unit ? ` ${t(`unit_${it.unit.toLowerCase()}`)}` : ''}
                              </Text>
                            )}
                            {it.boughtByName ? (
                              <Text
                                style={[
                                  Typography.labelSmall,
                                  { color: colors.onSurfaceVariant + 'b3', marginTop: 4 } as any,
                                ]}
                              >
                                {t('shopping_list_bought_by', { name: it.boughtByName })}
                              </Text>
                            ) : null}
                            {it.updatedAt && (
                              <Text
                                style={[
                                  Typography.labelSmall,
                                  { color: colors.onSurfaceVariant + '80', marginTop: 2 } as any,
                                ]}
                              >
                                {formatRelativeTime(it.updatedAt.toMillis())}
                              </Text>
                            )}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            {(it.category as ItemCategory) !== ItemCategory.OTHER && (
                              <CategoryChip category={it.category as ItemCategory} />
                            )}
                            <View style={{ height: 8 }} />
                            <Pressable
                              onPress={() => activeHouseholdId && markAsActive(activeHouseholdId, it.id)}
                              hitSlop={6}
                            >
                              <Text
                                style={[
                                  Typography.labelSmall,
                                  { color: colors.primary, fontWeight: '700' } as any,
                                ]}
                              >
                                {t('shopping_list_undo_bought')}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </SalinoSurfaceCard>
                    ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SalinoGradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  inner: {
    width: '100%',
    maxWidth: Layout.maxContentWidth,
    paddingHorizontal: Layout.horizontalPadding,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
