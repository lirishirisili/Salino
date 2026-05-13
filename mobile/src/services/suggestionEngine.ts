import { ShoppingItem, RecurringItem, SuggestionItem, SuggestionSource, ItemStatus } from '../models';

const MAX_SUGGESTIONS = 6;

/**
 * Builds smart suggestions from recurring, frequent, and recent items.
 * Mirrors Android's RuleBasedSuggestionEngine.
 */
export function buildSuggestions(
  activeItems: ShoppingItem[],
  boughtItems: ShoppingItem[],
  recurringItems: RecurringItem[],
  nowMillis: number = Date.now()
): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];
  const activeNames = new Set(activeItems.map((i) => i.normalizedName));

  // 1. Recurring due items (highest priority)
  const dueRecurring = recurringItems.filter(
    (r) => r.enabled && r.nextDueAt && r.nextDueAt.toMillis() <= nowMillis
  );

  for (const r of dueRecurring) {
    if (activeNames.has(r.normalizedName)) continue;
    if (suggestions.length >= MAX_SUGGESTIONS) break;

    suggestions.push({
      id: `rec_${r.id}`,
      name: r.name,
      normalizedName: r.normalizedName,
      quantity: r.quantity,
      unit: r.unit,
      category: r.category,
      note: r.note,
      reason: 'recurring',
      source: SuggestionSource.RECURRING,
      recurringItemId: r.id,
    });
  }

  // 2. Frequent items (grouped by normalizedName, top 4)
  if (suggestions.length < MAX_SUGGESTIONS) {
    const frequencyMap = new Map<string, { count: number; item: ShoppingItem }>();
    for (const item of boughtItems) {
      const existing = frequencyMap.get(item.normalizedName);
      if (existing) {
        existing.count++;
      } else {
        frequencyMap.set(item.normalizedName, { count: 1, item });
      }
    }

    const frequent = Array.from(frequencyMap.values())
      .sort((a, b) => b.count - a.count)
      .filter(({ item }) => !activeNames.has(item.normalizedName))
      .filter(({ item }) => !suggestions.some((s) => s.normalizedName === item.normalizedName))
      .slice(0, 4);

    for (const { item } of frequent) {
      if (suggestions.length >= MAX_SUGGESTIONS) break;
      suggestions.push({
        id: `freq_${item.id}`,
        name: item.name,
        normalizedName: item.normalizedName,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category as SuggestionItem['category'],
        note: item.note,
        reason: 'frequent',
        source: SuggestionSource.FREQUENT,
        recurringItemId: null,
      });
    }
  }

  // 3. Recent items (top 4 by updatedAt)
  if (suggestions.length < MAX_SUGGESTIONS) {
    const recent = [...boughtItems]
      .filter((i) => i.updatedAt)
      .sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0))
      .filter((item) => !activeNames.has(item.normalizedName))
      .filter((item) => !suggestions.some((s) => s.normalizedName === item.normalizedName))
      .slice(0, 4);

    for (const item of recent) {
      if (suggestions.length >= MAX_SUGGESTIONS) break;
      suggestions.push({
        id: `recent_${item.id}`,
        name: item.name,
        normalizedName: item.normalizedName,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category as SuggestionItem['category'],
        note: item.note,
        reason: 'recent',
        source: SuggestionSource.RECENT,
        recurringItemId: null,
      });
    }
  }

  return suggestions;
}
