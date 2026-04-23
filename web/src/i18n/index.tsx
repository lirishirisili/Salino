import { createContext, useContext, useMemo } from 'react';
import en from './en';
import he from './he';
import ar from './ar';
import fr from './fr';
import es from './es';
import ru from './ru';
import am from './am';
import type { ItemCategory, ItemUnit } from '../types';

export type Strings = typeof en;
export type StringKey = keyof Strings;

const translations: Record<string, Strings> = { en, he, ar, fr, es, ru, am };

const RTL_LANGUAGES = new Set(['he', 'ar']);

function detectLanguage(): string {
  const browserLangs = navigator.languages ?? [navigator.language];
  for (const lang of browserLangs) {
    const code = lang.split('-')[0].toLowerCase();
    // Android uses 'iw' for Hebrew
    const normalized = code === 'iw' ? 'he' : code === 'in' ? 'id' : code === 'ji' ? 'yi' : code;
    if (translations[normalized]) return normalized;
  }
  return 'en';
}

let currentLang = detectLanguage();

export function getCurrentLanguage(): string {
  return currentLang;
}

export function isRTL(): boolean {
  return RTL_LANGUAGES.has(currentLang);
}

export function getDirection(): 'rtl' | 'ltr' {
  return isRTL() ? 'rtl' : 'ltr';
}

function getStrings(): Strings {
  return translations[currentLang] ?? en;
}

export function t(key: StringKey, ...args: (string | number)[]): string {
  const strings = getStrings();
  let text = strings[key] ?? en[key] ?? key;
  // Replace {0}, {1}, etc. with args
  for (let i = 0; i < args.length; i++) {
    text = text.replace(`{${i}}`, String(args[i]));
  }
  return text;
}

// Category and unit labels through i18n
const CATEGORY_KEY_MAP: Record<ItemCategory, StringKey> = {
  DAIRY: 'category_dairy',
  VEGETABLES: 'category_vegetables',
  FRUITS: 'category_fruits',
  MEAT_FISH: 'category_meat_fish',
  BAKERY: 'category_bakery',
  CLEANING: 'category_cleaning',
  PANTRY: 'category_pantry',
  SNACKS: 'category_snacks',
  BEVERAGES: 'category_beverages',
  PHARMACY: 'category_pharmacy',
  OTHER: 'category_other',
};

const UNIT_KEY_MAP: Record<ItemUnit, StringKey> = {
  PIECES: 'unit_pieces',
  KG: 'unit_kg',
  GRAMS: 'unit_grams',
  LITERS: 'unit_liters',
  PACKS: 'unit_packs',
  BOTTLES: 'unit_bottles',
  BAGS: 'unit_bags',
};

export function tCategory(cat: ItemCategory): string {
  return t(CATEGORY_KEY_MAP[cat] ?? 'category_other');
}

export function tUnit(unit: ItemUnit): string {
  return t(UNIT_KEY_MAP[unit] ?? 'unit_pieces');
}

// React context for reactivity (optional, lang is static per page load)
const I18nContext = createContext(currentLang);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const dir = useMemo(() => getDirection(), []);

  // Apply direction to html element
  useMemo(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = currentLang;
  }, [dir]);

  return (
    <I18nContext.Provider value={currentLang}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  useContext(I18nContext);
  return { t, tCategory, tUnit, isRTL: isRTL(), dir: getDirection(), lang: currentLang };
}
