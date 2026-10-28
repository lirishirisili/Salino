import { Share } from 'react-native';
import type { TFunction } from 'i18next';
import type { Household } from '../../models';
import { buildInviteUrl } from '../../constants/urls';
import { formatEndDate, isTemporary } from '../../utils/householdExpiry';
import { toMillisSafe } from '../../local/timestampCodec';

/** Opens the OS share sheet with the home's invite link (trip homes mention their end date). */
export async function shareHouseholdInvite(household: Household, t: TFunction, language: string): Promise<void> {
  if (!household.inviteCode) return;
  const url = buildInviteUrl(household.inviteCode);
  const endMs = toMillisSafe(household.expiresAt);
  const message =
    isTemporary(household) && endMs != null
      ? t('household_temp_share_message', {
          name: household.name,
          date: formatEndDate(new Date(endMs), language),
          code: household.inviteCode,
          url,
        })
      : t('settings_share_invite_message', { code: household.inviteCode, url });
  await Share.share({ message, url });
}
