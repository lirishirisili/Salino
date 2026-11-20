import i18n from '../i18n';

const PRIVACY_POLICY_URL_EN = 'https://hsr.lirshir.com/privacy/';
const PRIVACY_POLICY_URL_HE = 'https://hsr.lirshir.com/he/privacy/';

/** Privacy policy in the app's current language (Hebrew page for he, English otherwise). */
export function privacyPolicyUrl(): string {
  return i18n.language?.startsWith('he') ? PRIVACY_POLICY_URL_HE : PRIVACY_POLICY_URL_EN;
}
