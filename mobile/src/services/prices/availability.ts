import * as Localization from 'expo-localization';

/** Price data covers Israeli chains only: offer the feature to shoppers in Israel. */
export function isPriceCompareAvailable(language: string): boolean {
  if (language === 'he') return true;
  try {
    return Localization.getLocales().some((l) => l.regionCode === 'IL');
  } catch {
    return false;
  }
}
