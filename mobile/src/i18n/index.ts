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
  const locale = Localization.getLocales()[0]?.languageCode ?? 'en';
  // Map 'iw' to 'he' for Hebrew
  if (locale === 'iw') return 'he';
  return SUPPORTED_LANGUAGES.find((l) => l.code === locale) ? locale : 'en';
};

/** Returns the language we will use at boot, without touching i18next. */
export const resolveBootLanguage = async (): Promise<string> => {
  const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
  return savedLang || getDeviceLanguage();
};

export const initI18n = async () => {
  const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
  const language = savedLang || getDeviceLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

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
