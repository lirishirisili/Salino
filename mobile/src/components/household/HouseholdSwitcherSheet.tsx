import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Household } from '../../models';
import { useHouseholdStore } from '../../hooks/useHouseholdStore';
import { Typography, useIsDark, useThemeColors } from '../../theme';
import { daysLeft, isExpired, isTemporary } from '../../utils/householdExpiry';

interface HouseholdSwitcherSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onCreateTemporary: () => void;
  onJoin: () => void;
}

/** Bottom sheet listing the user's homes, plus "new trip home" and "join with a code". */
export function HouseholdSwitcherSheet({ visible, onDismiss, onCreateTemporary, onJoin }: HouseholdSwitcherSheetProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const myHouseholds = useHouseholdStore((s) => s.myHouseholds);
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const activeHousehold = useHouseholdStore((s) => s.household);
  const loadMyHouseholds = useHouseholdStore((s) => s.loadMyHouseholds);
  const switchHousehold = useHouseholdStore((s) => s.switchHousehold);

  useEffect(() => {
    if (visible) void loadMyHouseholds();
  }, [visible, loadMyHouseholds]);

  // The active home is always listed, even before the list has loaded.
  const homes =
    activeHousehold && !myHouseholds.some((h) => h.id === activeHousehold.id)
      ? [activeHousehold, ...myHouseholds]
      : myHouseholds;

  const statusLabel = (h: Household): string | null => {
    if (!isTemporary(h)) return null;
    if (isExpired(h)) return t('household_temp_status_ended');
    const left = daysLeft(h) ?? 0;
    return left <= 1 ? t('household_temp_status_last_day') : t('household_temp_status_days_left', { count: left });
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.sheet,
          {
            backgroundColor: isDark ? colors.surfaceBright : colors.surface,
            paddingBottom: insets.bottom + 16,
          },
        ]}
        style={styles.modal}
      >
        <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
        <Text style={[Typography.titleLarge, { color: colors.onSurface, marginBottom: 8 } as any]}>
          {t('household_switcher_title')}
        </Text>
        <ScrollView style={{ maxHeight: 360 }}>
          {homes.map((h) => {
            const active = h.id === activeHouseholdId;
            const status = statusLabel(h);
            const ended = isExpired(h);
            return (
              <Pressable
                key={h.id}
                onPress={async () => {
                  onDismiss();
                  await switchHousehold(h.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: active ? colors.primaryContainer : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={isTemporary(h) ? 'bag-suitcase' : 'home'}
                  size={24}
                  color={active ? colors.onPrimaryContainer : colors.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      Typography.titleMedium,
                      { color: active ? colors.onPrimaryContainer : colors.onSurface } as any,
                    ]}
                  >
                    {h.name}
                  </Text>
                  {status && (
                    <Text
                      style={[
                        Typography.bodySmall,
                        { color: ended ? colors.error : colors.onSurfaceVariant } as any,
                      ]}
                    >
                      {status}
                    </Text>
                  )}
                </View>
                {active && <MaterialCommunityIcons name="check" size={22} color={colors.onPrimaryContainer} />}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

        <SheetAction
          icon="bag-suitcase-outline"
          label={t('household_switcher_new_temp')}
          onPress={() => {
            onDismiss();
            onCreateTemporary();
          }}
        />
        <SheetAction
          icon="account-plus-outline"
          label={t('household_switcher_join')}
          onPress={() => {
            onDismiss();
            onJoin();
          }}
        />
      </Modal>
    </Portal>
  );
}

function SheetAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <MaterialCommunityIcons name={icon} size={24} color={colors.primary} />
      <Text style={[Typography.titleMedium, { color: colors.primary, flex: 1 } as any]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
});
