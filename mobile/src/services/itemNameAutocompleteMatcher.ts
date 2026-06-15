import { normalizeItemName } from '../utils/textUtils';

export function prefixMatchScore(displayName: string, query: string): number {
  const normalizedQuery = normalizeItemName(query);
  if (!normalizedQuery) return 0;

  const normalizedDisplay = normalizeItemName(displayName);
  if (!normalizedDisplay) return 0;

  if (normalizedDisplay.startsWith(normalizedQuery)) {
    return normalizedDisplay === normalizedQuery ? 120 : 100;
  }

  const firstToken = normalizedDisplay.split(' ')[0] ?? '';
  return firstToken.startsWith(normalizedQuery) ? 80 : 0;
}

export function matchesPrefix(displayName: string, query: string): boolean {
  return prefixMatchScore(displayName, query) > 0;
}
