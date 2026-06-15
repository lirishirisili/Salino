import { normalizeItemName } from '../utils/textUtils';
import { HouseholdHistoryIndex, AutocompleteSuggestion } from './householdHistoryIndex';
import { searchCatalog } from './categoryKeywordCatalog';

export function suggestAutocomplete(
  query: string,
  historyIndex: HouseholdHistoryIndex,
  maxHistory = 8,
  maxCatalog = 8,
): AutocompleteSuggestion[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const history = historyIndex.search(trimmed, maxHistory);
  const historyNormalized = new Set(
    history.map((s) => normalizeItemName(s.displayName)),
  );

  const catalogResults = searchCatalog(trimmed, historyNormalized, maxCatalog);
  const catalogSuggestions: AutocompleteSuggestion[] = catalogResults.map(
    (entry) => ({
      displayName: entry.displayName,
      source: 'CATEGORY_CATALOG',
    }),
  );

  return [...history, ...catalogSuggestions];
}
