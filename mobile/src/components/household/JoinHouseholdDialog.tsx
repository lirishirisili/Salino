import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { Household } from '../../models';
import { householdRepository } from '../../repositories';
import { useHouseholdStore } from '../../hooks/useHouseholdStore';
import { Typography, useThemeColors } from '../../theme';
import { formatEndDate, isTemporary } from '../../utils/householdExpiry';
import { toMillisSafe } from '../../local/timestampCodec';

interface JoinHouseholdDialogProps {
  visible: boolean;
  /** Code from an invite link; when set the dialog skips straight to the confirmation. */
  initialCode?: string | null;
  onDismiss: () => void;
  onJoined?: () => void;
}

/**
 * Join another home while already in one: enter (or receive) a code, see which
 * home it is, confirm. The joined home becomes the active one.
 */
export function JoinHouseholdDialog({ visible, initialCode, onDismiss, onJoined }: JoinHouseholdDialogProps) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const myHouseholds = useHouseholdStore((s) => s.myHouseholds);
  const switchHousehold = useHouseholdStore((s) => s.switchHousehold);
  const joinHousehold = useHouseholdStore((s) => s.joinHousehold);

  const [code, setCode] = useState('');
  const [found, setFound] = useState<Household | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (value: string) => {
    const trimmed = value.trim().toUpperCase();
    if (trimmed.length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const h = await householdRepository.findByInviteCode(trimmed);
      if (!h) setError('household_error_invalid_code');
      setFound(h);
    } catch {
      setError('household_error_generic');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setFound(null);
    setError(null);
    setCode(initialCode ?? '');
    if (initialCode) void lookup(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialCode]);

  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const alreadyMember =
    !!found && (found.id === activeHouseholdId || myHouseholds.some((h) => h.id === found.id));

  const confirm = async () => {
    if (!found) return;
    setBusy(true);
    try {
      if (alreadyMember) {
        await switchHousehold(found.id);
      } else {
        await joinHousehold(found.inviteCode);
        const storeError = useHouseholdStore.getState().error;
        if (storeError) {
          setError(storeError);
          useHouseholdStore.getState().clearError();
          return;
        }
      }
      onJoined?.();
      onDismiss();
    } finally {
      setBusy(false);
    }
  };

  const endMs = toMillisSafe(found?.expiresAt);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{found ? t('household_join_confirm_title', { name: found.name }) : t('household_switcher_join')}</Dialog.Title>
        <Dialog.Content>
          {found ? (
            <View style={{ gap: 6 }}>
              <Text style={[Typography.bodyMedium, { color: colors.onSurfaceVariant } as any]}>
                {alreadyMember
                  ? t('household_join_already_member')
                  : isTemporary(found) && endMs != null
                    ? t('household_join_confirm_temp', { date: formatEndDate(new Date(endMs), i18n.language) })
                    : t('household_join_confirm_body')}
              </Text>
            </View>
          ) : (
            <TextInput
              mode="outlined"
              value={code}
              onChangeText={(v) => {
                setCode(v.toUpperCase());
                setError(null);
              }}
              placeholder={t('household_invite_code_hint')}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              onSubmitEditing={() => void lookup(code)}
            />
          )}
          {error && (
            <Text style={[Typography.bodySmall, { color: colors.error, marginTop: 8 } as any]}>{t(error)}</Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('cancel')}</Button>
          {found ? (
            <Button onPress={() => void confirm()} loading={busy} disabled={busy}>
              {alreadyMember ? t('household_switcher_open') : t('household_join')}
            </Button>
          ) : (
            <Button onPress={() => void lookup(code)} loading={busy} disabled={busy || code.trim().length < 6}>
              {t('household_join_continue')}
            </Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
