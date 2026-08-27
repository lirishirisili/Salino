import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import he from './locales/he.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import ru from './locales/ru.json';
import am from './locales/am.json';

const LANGUAGE_KEY = '@app_language';

export const RTL_LANGUAGES = ['he', 'ar'];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'he', label: 'עברית' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
  { code: 'am', label: 'አማርኛ' },
];

const resources = {
  en: { translation: en },
  he: { translation: he },
  ar: { translation: ar },
  fr: { translation: fr },
  es: { translation: es },
  ru: { translation: ru },
  am: { translation: am },
};

const getDeviceLanguage = (): string => {
  try {
    const locale = Localization.getLocales()[0]?.languageCode ?? 'en';
    // Map 'iw' to 'he' for Hebrew
    if (locale === 'iw') return 'he';
    return SUPPORTED_LANGUAGES.find((l) => l.code === locale) ? locale : 'en';
  } catch {
    return 'en';
  }
};

/** Returns the language we will use at boot, without touching i18next. */
export const resolveBootLanguage = async (): Promise<string> => {
  const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
  return savedLang || getDeviceLanguage();
};

const i18nInitOptions = {
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
} as const;

/**
 * Init at module load so useTranslation() never suspends on the first paint.
 * Saved language from AsyncStorage is applied in initI18n().
 */
const i18nInitPromise = i18n.use(initReactI18next).init(i18nInitOptions);

export const initI18n = async () => {
  try {
    await i18nInitPromise;
  } catch (e) {
    console.error('i18n module init error:', e);
  }

  const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
  const language = savedLang || getDeviceLanguage();

  if (!i18n.isInitialized) {
    await i18n.init({ ...i18nInitOptions, lng: language });
    return language;
  }

  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  return language;
};

export const changeLanguage = async (langCode: string) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, langCode);
  await i18n.changeLanguage(langCode);
};

export const isRTL = (lang?: string): boolean => {
  const current = lang || i18n.language;
  return RTL_LANGUAGES.includes(current);
};

export default i18n;
