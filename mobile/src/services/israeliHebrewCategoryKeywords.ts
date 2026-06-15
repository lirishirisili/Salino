import { ItemCategory } from '../models';
import { ISRAELI_HEBREW_KEYWORDS } from './israeliHebrewKeywordsData';

/** Keep in sync via `node scripts/gen-hebrew-keywords-ts.mjs` from Android source. */
export function mergeIsraeliHebrewKeywords(category: ItemCategory, base: string[]): string[] {
  const extra = ISRAELI_HEBREW_KEYWORDS[category];
  if (!extra?.length) return base;
  return [...new Set([...base, ...extra])];
}
