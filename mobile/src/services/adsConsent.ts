import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { Alert } from 'react-native';
import { LevelPlay } from 'unity-levelplay-mediation';
import i18n from '../i18n';

/**
 * GDPR consent for ads without a third-party CMP (no AdMob / Google UMP).
 * Users whose device region is in the EEA / UK / Switzerland get a one-time
 * choice; the answer is passed to LevelPlay, which shares it with every
 * mediated network (ironSource, Unity Ads, Meta). Everyone else sees nothing.
 * Declining still serves ads — just non-personalized ones.
 */

const LOG = '[ADS_CONSENT]';
const STORAGE_KEY = '@ads_gdpr_consent_v1';

type ConsentChoice = 'granted' | 'denied';

// EEA (EU + IS, LI, NO) + UK + CH.
const GDPR_REGIONS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH',
]);

/** Device region (Settings → Region), the best signal available without a CMP. */
export function isGdprRegion(): boolean {
  try {
    const region = Localization.getLocales()[0]?.regionCode?.toUpperCase();
    return !!region && GDPR_REGIONS.has(region);
  } catch {
    return false;
  }
}

async function readChoice(): Promise<ConsentChoice | null> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

async function applyChoice(choice: ConsentChoice): Promise<void> {
  try {
    // Global flag: LevelPlay forwards it to all mediated networks that support
    // consent APIs. (setGDPRConsents needs per-network keys; one answer covers all.)
    await LevelPlay.setConsent(choice === 'granted');
    console.warn(`${LOG} setConsent(${choice === 'granted'})`);
  } catch (err) {
    console.warn(`${LOG} setConsent failed:`, err);
  }
}

/** Accept / decline with equal weight, as GDPR requires. Not dismissable. */
function askChoice(): Promise<ConsentChoice> {
  return new Promise((resolve) => {
    Alert.alert(
      i18n.t('ads_consent_title'),
      i18n.t('ads_consent_message'),
      [
        { text: i18n.t('ads_consent_decline'), onPress: () => resolve('denied') },
        { text: i18n.t('ads_consent_accept'), onPress: () => resolve('granted') },
      ],
      { cancelable: false, onDismiss: () => resolve('denied') },
    );
  });
}

async function saveAndApply(choice: ConsentChoice): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Asked again next launch at worst.
  }
  await applyChoice(choice);
}

/**
 * Must run before LevelPlay.init. Outside GDPR regions it does nothing; inside,
 * it re-applies the saved answer or asks once.
 */
export async function ensureGdprConsent(): Promise<void> {
  if (!isGdprRegion()) return;
  const saved = await readChoice();
  await saveAndApply(saved ?? (await askChoice()));
}

/** Settings → "Ad privacy settings": lets GDPR users change their answer. */
export async function changeGdprConsent(): Promise<void> {
  await saveAndApply(await askChoice());
}
