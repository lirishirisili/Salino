import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useHouseholdStore, useShoppingStore } from '../../src/hooks';
import { useIsHouseholdReadOnly } from '../../src/hooks/useHouseholdExpiry';
import { recurringRepository } from '../../src/repositories';
import type { RecurringItem } from '../../src/models';
import {
  EmptyState,
  SalinoGradientBackground,
  SalinoSurfaceCard,
  SalinoWebInnerTopBar,
} from '../../src/components';
import { Layout, Typography, useThemeColors } from '../../src/theme';
import { toMillisSafe } from '../../src/local/timestampCodec';

const INTERVAL_PRESETS = [3, 7, 14, 30];

/**
 * Lists the home's recurring items ("every N days") so they can be changed or
 * removed. Before this screen a recurring item could be created but never
 * edited or deleted.
 */
export default function RecurringItemsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const recurringItems = useShoppingStore((s) => s.recurringItems);
  const readOnly = useIsHouseholdReadOnly();
  // Hide deleted rows at once; the listener confirms a moment later.
  const [removedIds, setRemovedIds] = useState<Record<string, true>>({});

  const items = useMemo(
    () =>
      recurringItems
        .filter((r) => r.enabled && !removedIds[r.id])
        .sort((a, b) => (toMillisSafe(a.nextDueAt) ?? 0) - (toMillisSafe(b.nextDueAt) ?? 0)),
    [recurringItems, removedIds]
  );

  const formatDue = (item: RecurringItem): string => {
    const ms = toMillisSafe(item.nextDueAt);
    if (ms == null) return '';
    if (ms <= Date.now()) return t('recurring_due_now');
    return t('recurring_next_due', {
      date: new Date(ms).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
    });
  };

  const changeInterval = (item: RecurringItem) => {
    if (!householdId) return;
    Alert.alert(
      item.name,
      t('recurring_change_interval'),
      [
        ...INTERVAL_PRESETS.map((days) => ({
          text: t('recurring_every_n_days', { count: days }),
          onPress: () => {
            recurringRepository
              .upsertRecurringItem(householdId, {
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                category: item.category,
                note: item.note,
                intervalDays: days,
              })
              .catch(() => Alert.alert('', t('error_generic')));
          },
        })),
        { text: t('cancel'), style: 'cancel' as const },
      ]
    );
  };

  const remove = (item: RecurringItem) => {
    if (!householdId) return;
    Alert.alert(t('recurring_delete_title'), t('recurring_delete_message', { name: item.name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('shopping_list_delete'),
        style: 'destructive',
        onPress: () => {
          setRemovedIds((prev) => ({ ...prev, [item.id]: true }));
          recurringRepository.deleteRecurringItem(householdId, item.id).catch(() => {
            setRemovedIds((prev) => {
              const next = { ...prev };
              delete next[item.id];
              return next;
            });
            Alert.alert('', t('error_generic'));
          });
        },
      },
    ]);
  };

  return (
    <SalinoGradientBackground plain>
      <SalinoWebInnerTopBar title={t('recurring_manage_title')} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.inner}>
          {items.length === 0 ? (
            <EmptyState
              icon="calendar-refresh-outline"
              title={t('recurring_empty_title')}
              subtitle={t('recurring_empty_subtitle')}
            />
          ) : (
            <SalinoSurfaceCard padding={8}>
              {items.map((item, index) => (
                <View key={item.id}>
                  {index > 0 && (
                    <View style={[styles.divider, { backgroundColor: colors.outlineVariant + '80' }]} />
                  )}
                  <View style={styles.row}>
                    <MaterialCommunityIcons
                      name="calendar-refresh-outline"
                      size={22}
                      color={colors.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[Typography.titleSmall, { color: colors.onSurface } as any]}>
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          Typography.bodySmall,
                          { color: colors.onSurfaceVariant, marginTop: 2 } as any,
                        ]}
                      >
                        {t('recurring_every_n_days', { count: item.intervalDays })} · {formatDue(item)}
                      </Text>
                    </View>
                    {!readOnly && (
                      <>
                        <Pressable
                          onPress={() => changeInterval(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('recurring_change_interval')}: ${item.name}`}
                          hitSlop={6}
                          style={styles.iconButton}
                        >
                          <MaterialCommunityIcons
                            name="timer-cog-outline"
                            size={22}
                            color={colors.onSurfaceVariant}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => remove(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('shopping_list_delete')}: ${item.name}`}
                          hitSlop={6}
                          style={styles.iconButton}
                        >
                          <MaterialCommunityIcons
                            name="delete-outline"
                            size={22}
                            color={colors.error}
                          />
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              ))}
            </SalinoSurfaceCard>
          )}
        </View>
      </ScrollView>
    </SalinoGradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Layout.horizontalPadding,
    paddingTop: 12,
    alignItems: 'center',
  },
  inner: { width: '100%', maxWidth: Layout.maxContentWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8 },
  iconButton: { padding: 8 },
  divider: { height: 1, marginHorizontal: 8 },
});
