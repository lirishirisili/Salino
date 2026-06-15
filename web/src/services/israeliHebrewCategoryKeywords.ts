import type { ItemCategory } from '../types';

/**
 * Hebrew grocery lexicon for Israeli supermarkets.
 * Keep in sync with app/.../IsraeliHebrewCategoryKeywords.kt (Android is source of truth).
 */
import { ISRAELI_HEBREW_KEYWORDS } from './israeliHebrewKeywordsData';

export function mergeIsraeliHebrewKeywords(category: ItemCategory, base: string[]): string[] {
  const extra = ISRAELI_HEBREW_KEYWORDS[category];
  if (!extra?.length) return base;
  return [...new Set([...base, ...extra])];
}
