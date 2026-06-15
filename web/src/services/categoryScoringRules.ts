import type { ItemCategory } from '../types';

const HIGH_CONFIDENCE_THRESHOLD = 70;
const TOKEN_ONLY_THRESHOLD = 26;

export function phraseBoundaryScore(normalized: string, normalizedKeyword: string): number {
  if (normalized === normalizedKeyword) return 120;
  if (normalized.startsWith(normalizedKeyword + ' ') || normalized.endsWith(' ' + normalizedKeyword)) {
    return 70;
  }
  if (normalizedKeyword.includes(' ') && normalized.includes(normalizedKeyword)) {
    return 65;
  }
  return 0;
}

export function exactTokenScore(tokens: string[], normalizedKeyword: string): number {
  if (normalizedKeyword.includes(' ')) return 0;
  const keywordToken = normalizedKeyword.trim();
  if (!keywordToken) return 0;
  return tokens.some((t) => t === keywordToken) ? 26 : 0;
}

export function pickConfidentCategory(scores: Record<string, number>): ItemCategory | null {
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const best = ranked[0];
  if (!best) return null;
  const secondScore = ranked[1]?.[1] ?? 0;

  if (best[1] >= HIGH_CONFIDENCE_THRESHOLD) return best[0] as ItemCategory;
  if (best[1] >= TOKEN_ONLY_THRESHOLD && secondScore === 0) return best[0] as ItemCategory;
  return null;
}
