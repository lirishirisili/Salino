import type { ShoppingItem, RecurringItem, SuggestionItem } from '../types';
import { normalizeItemName } from '../utils';

export function buildSuggestions(
  activeItems: ShoppingItem[],
  boughtItems: ShoppingItem[],
  recurringItems: RecurringItem[],
  nowMillis: number
): SuggestionItem[] {
  const activeNames = new Set(
    activeItems.map((i) => i.normalizedName || normalizeItemName(i.name))
  );
  const suggestions = new Map<string, SuggestionItem>();

  // Priority 1: Recurring due
  for (const recurring of recurringItems) {
    if (!recurring.enabled) continue;
    if (recurring.nextDueAt && new Date(recurring.nextDueAt).getTime() > nowMillis) continue;
    const normalizedName = recurring.normalizedName || normalizeItemName(recurring.name);
    if (activeNames.has(normalizedName)) continue;
    if (!suggestions.has(normalizedName)) {
      suggestions.set(normalizedName, {
        id: `recurring_${recurring.id}`,
        name: recurring.name,
        normalizedName,
        quantity: recurring.quantity,
        unit: recurring.unit,
        category: recurring.category,
        note: recurring.note,
        reason: 'due',
        source: 'RECURRING',
        recurringItemId: recurring.id,
      });
    }
  }

  // Priority 2: Frequent items
  const freqMap = new Map<string, { items: ShoppingItem[]; count: number }>();
  for (const item of boughtItems) {
    const key = item.normalizedName || normalizeItemName(item.name);
    const entry = freqMap.get(key) || { items: [], count: 0 };
    entry.items.push(item);
    entry.count++;
    freqMap.set(key, entry);
  }
  const sorted = [...freqMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 4);
  for (const [key, { items }] of sorted) {
    if (activeNames.has(key)) continue;
    if (!suggestions.has(key)) {
      const first = items[0];
      suggestions.set(key, {
        id: `frequent_${key}`,
        name: first.name,
        normalizedName: key,
        quantity: 1,
        unit: first.unit,
        category: first.category || 'OTHER',
        note: first.note,
        reason: 'frequent',
        source: 'FREQUENT',
      });
    }
  }

  // Priority 3: Recent items
  const recentItems = [...boughtItems]
    .sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 4);
  for (const item of recentItems) {
    const normalizedName = item.normalizedName || normalizeItemName(item.name);
    if (activeNames.has(normalizedName)) continue;
    if (!suggestions.has(normalizedName)) {
      suggestions.set(normalizedName, {
        id: `recent_${item.id}`,
        name: item.name,
        normalizedName,
        quantity: 1,
        unit: item.unit,
        category: item.category,
        note: item.note,
        reason: 'recent',
        source: 'RECENT',
      });
    }
  }

  return [...suggestions.values()].slice(0, 6);
}
