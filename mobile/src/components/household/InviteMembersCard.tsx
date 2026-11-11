import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHouseholdStore } from '../../hooks/useHouseholdStore';
import { Typography, useThemeColors } from '../../theme';
import { SalinoSurfaceCard } from '../brand/SurfaceCard';
import { shareHouseholdInvite } from './householdInvite';

const dismissKey = (householdId: string) => `invite_card_dismissed_${householdId}`;

/**
 * "Invite your household" card for a home with a single member. A shared list
 * is the whole point of the app, yet inviting used to be buried in Settings.
 * Hidden once someone joins, or after "Not now" (remembered per home).
 */
export function InviteMembersCard() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const household = useHouseholdStore((s) => s.household);
  const memberCount = useHouseholdStore((s) => s.members.length);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const householdId = household?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setDismissed(null);
    if (!householdId) return;
    AsyncStorage.getItem(dismissKey(householdId))
      .then((v) => {
        if (!cancelled) setDismissed(v === '1');
      })
      .catch(() => {
        if (!cancelled) setDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [householdId]);

  // `memberCount === 1`: members load async; an empty list must not flash the card.
  if (!household || !household.inviteCode || memberCount !== 1 || dismissed !== false) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    void AsyncStorage.setItem(dismissKey(household.id), '1').catch(() => undefined);
  };

  return (
    <View style={{ paddingVertical: 6 }}>
      <SalinoSurfaceCard padding={16}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="account-multiple-plus" size={28} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[Typography.titleMedium, { color: colors.onSurface } as any]}>
              {t('invite_card_title')}
            </Text>
            <Text
              style={[Typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: 4 } as any]}
            >
              {t('invite_card_body')}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            hitSlop={6}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.6 }]}
          >
            <Text style={[Typography.labelLarge, { color: colors.onSurfaceVariant } as any]}>
              {t('invite_card_not_now')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void shareHouseholdInvite(household, t, i18n.language).catch(() => undefined)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.85 },
            ]}
          >
            <MaterialCommunityIcons name="share-variant" size={18} color={colors.onPrimary} />
            <Text style={[Typography.labelLarge, { color: colors.onPrimary } as any]}>
              {t('invite_card_share')}
            </Text>
          </Pressable>
        </View>
      </SalinoSurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  secondary: { paddingVertical: 8, paddingHorizontal: 8 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
});
