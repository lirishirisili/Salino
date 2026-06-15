import { ItemCategory } from '../models';
import { normalizeItemName } from '../utils/textUtils';
import { matchesPrefix, prefixMatchScore } from './itemNameAutocompleteMatcher';
import { mergeIsraeliHebrewKeywords } from './israeliHebrewCategoryKeywords';
import { KEYWORD_MAP } from './categoryDetector';

interface CatalogEntry {
  displayName: string;
  category: ItemCategory;
}

const MIN_CATALOG_TERM_LENGTH = 2;

let entries: CatalogEntry[] | null = null;
let byFirstChar: Map<string, CatalogEntry[]> | null = null;

function ensureLoaded(): void {
  if (entries) return;

  const allEntries: CatalogEntry[] = [];
  const seen = new Set<string>();
  for (const entry of KEYWORD_MAP) {
    const merged = mergeIsraeliHebrewKeywords(entry.category, entry.keywords);
    for (const keyword of merged) {
      const name = keyword.trim();
      if (name.length < MIN_CATALOG_TERM_LENGTH) continue;
      const normalized = normalizeItemName(name);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      allEntries.push({ displayName: name, category: entry.category });
    }
  }

  entries = allEntries.sort((a, b) =>
    normalizeItemName(a.displayName).localeCompare(normalizeItemName(b.displayName)),
  );

  byFirstChar = new Map<string, CatalogEntry[]>();
  for (const entry of entries) {
    const normalized = normalizeItemName(entry.displayName);
    const ch = normalized?.[0] ?? '';
    if (!ch) continue;
    const list = byFirstChar.get(ch) || [];
    list.push(entry);
    byFirstChar.set(ch, list);
  }
}

export function searchCatalog(
  query: string,
  excludeNormalized: Set<string>,
  limit: number,
): Array<{ displayName: string; category: ItemCategory }> {
  if (limit <= 0) return [];
  ensureLoaded();

  const normalizedQuery = normalizeItemName(query);
  if (!normalizedQuery) return [];

  const candidates = byFirstChar!.get(normalizedQuery[0]);
  if (!candidates) return [];

  return candidates
    .filter((entry) => {
      const normalized = normalizeItemName(entry.displayName);
      return !excludeNormalized.has(normalized) && matchesPrefix(entry.displayName, query);
    })
    .sort((a, b) => prefixMatchScore(b.displayName, query) - prefixMatchScore(a.displayName, query))
    .slice(0, limit);
}

export function warmUpCatalog(): void {
  ensureLoaded();
}
