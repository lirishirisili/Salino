import React, { useEffect, useState } from 'react';
import { create } from 'zustand';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useHouseholdStore } from '../../hooks/useHouseholdStore';
import { useHouseholdExpiry } from '../../hooks/useHouseholdExpiry';
import { useInviteDeepLinkStore } from '../../hooks/useInviteDeepLinkStore';
import { Typography, useThemeColors } from '../../theme';
import { formatEndDate } from '../../utils/householdExpiry';
import { HouseholdSwitcherSheet } from './HouseholdSwitcherSheet';
import { JoinHouseholdDialog } from './JoinHouseholdDialog';
import { ExtendHouseholdDialog } from './ExtendHouseholdDialog';

/** Lets the top-bar homes button open the switcher sheet hosted by HouseholdHeader. */
export const useHouseholdSwitcherUi = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/**
 * Top of the shopping list: for a trip home, a banner with its name, end date /
 * ended state and the extend or leave action. Hosts the home switcher sheet (opened
 * from the top bar) and picks up invite links opened while already in a home.
 */
export function HouseholdHeader() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const leaveHousehold = useHouseholdStore((s) => s.leaveHousehold);
  const loadMyHouseholds = useHouseholdStore((s) => s.loadMyHouseholds);
  const expiry = useHouseholdExpiry();

  const switcherOpen = useHouseholdSwitcherUi((s) => s.open);
  const setSwitcherOpen = useHouseholdSwitcherUi((s) => s.setOpen);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);

  const pendingInviteCode = useInviteDeepLinkStore((s) => s.pendingInviteCode);
  const consumePendingInviteCode = useInviteDeepLinkStore((s) => s.consumePendingInviteCode);

  useEffect(() => {
    void loadMyHouseholds();
  }, [loadMyHouseholds]);

  useEffect(() => {
    if (!pendingInviteCode) return;
    const code = consumePendingInviteCode();
    if (!code) return;
    setJoinCode(code);
    setJoinOpen(true);
  }, [pendingInviteCode, consumePendingInviteCode]);

  const confirmLeave = () => {
    Alert.alert(t('settings_leave_household'), t('settings_leave_household_confirm'), [
      { text: t('no'), style: 'cancel' },
      {
        text: t('yes'),
        style: 'destructive',
        onPress: async () => {
          const nextId = await leaveHousehold();
          if (!nextId) router.replace('/household-setup');
        },
      },
    ]);
  };

  // Only an ended trip gets a banner (explains why the list is locked). While it runs,
  // the end date lives in the homes sheet and settings to keep the list compact.
  return (
    <View style={expiry.isExpired ? styles.wrap : undefined}>
      {expiry.isExpired && (
        <View style={[styles.banner, { backgroundColor: colors.errorContainer }]}>
          <MaterialCommunityIcons name="lock-clock" size={20} color={colors.onErrorContainer} />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                Typography.bodyMedium,
                { color: colors.onErrorContainer, fontWeight: '600' } as any,
              ]}
            >
              {t('household_temp_banner_ended')}
            </Text>
            {expiry.deleteDate && (
              <Text style={[Typography.bodySmall, { color: colors.onErrorContainer } as any]}>
                {t('household_temp_banner_deleted_on', { date: formatEndDate(expiry.deleteDate, i18n.language) })}
              </Text>
            )}
          </View>
          {expiry.isOwner ? (
            <BannerAction label={t('household_extend_action')} onPress={() => setExtendOpen(true)} />
          ) : (
            <BannerAction label={t('household_temp_leave')} onPress={confirmLeave} />
          )}
        </View>
      )}

      <HouseholdSwitcherSheet
        visible={switcherOpen}
        onDismiss={() => setSwitcherOpen(false)}
        onCreateTemporary={() => router.push('/(main)/create-temporary-home')}
        onJoin={() => {
          setJoinCode(null);
          setJoinOpen(true);
        }}
      />
      <JoinHouseholdDialog visible={joinOpen} initialCode={joinCode} onDismiss={() => setJoinOpen(false)} />
      <ExtendHouseholdDialog visible={extendOpen} onDismiss={() => setExtendOpen(false)} />
    </View>
  );
}

function BannerAction({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [styles.bannerAction, { backgroundColor: colors.surface, opacity: pressed ? 0.75 : 1 }]}
    >
      <Text style={[Typography.labelLarge, { color: colors.primary, fontWeight: '700' } as any]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    gap: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bannerAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
  },
});
