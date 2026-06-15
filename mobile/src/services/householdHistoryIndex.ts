import { ItemCategory, ItemUnit, ShoppingItem, RecurringItem } from '../models';
import { normalizeItemName } from '../utils/textUtils';
import { prefixMatchScore } from './itemNameAutocompleteMatcher';

export type AutocompleteSource = 'HOUSEHOLD_HISTORY' | 'CATEGORY_CATALOG';

export interface AutocompleteSuggestion {
  displayName: string;
  source: AutocompleteSource;
  category?: ItemCategory;
  unit?: ItemUnit | null;
  quantity?: number;
  purchaseCount?: number;
  lastUsedAtMillis?: number;
}

interface HistoryRecord {
  normalizedName: string;
  displayName: string;
  category?: ItemCategory;
  unit?: ItemUnit | null;
  quantity: number;
  purchaseCount: number;
  activeBoost: number;
  recurringBoost: number;
  lastUsedAtMillis: number;
}

export class HouseholdHistoryIndex {
  private records: Map<string, HistoryRecord>;
  private byFirstChar: Map<string, HistoryRecord[]>;

  private constructor(
    records: Map<string, HistoryRecord>,
    byFirstChar: Map<string, HistoryRecord[]>,
  ) {
    this.records = records;
    this.byFirstChar = byFirstChar;
  }

  static readonly EMPTY = new HouseholdHistoryIndex(new Map(), new Map());

  static from(
    activeItems: ShoppingItem[],
    boughtItems: ShoppingItem[],
    recurringItems: RecurringItem[],
  ): HouseholdHistoryIndex {
    const map = new Map<string, HistoryRecord>();

    const keyFor = (name: string, normalizedName?: string) =>
      (normalizedName || normalizeItemName(name)) || '';

    const getEpoch = (item: ShoppingItem): number =>
      item.updatedAt?.toMillis() ?? item.createdAt?.toMillis() ?? 0;

    for (const item of boughtItems) {
      const key = keyFor(item.name, item.normalizedName);
      if (!key || !item.name.trim()) continue;
      let record = map.get(key);
      if (!record) {
        record = {
          normalizedName: key,
          displayName: item.name.trim(),
          quantity: item.quantity,
          purchaseCount: 0,
          activeBoost: 0,
          recurringBoost: 0,
          lastUsedAtMillis: 0,
        };
        map.set(key, record);
      }
      record.purchaseCount++;
      record.displayName = item.name.trim();
      record.category = item.category as ItemCategory;
      record.unit = item.unit;
      record.quantity = item.quantity;
      const millis = getEpoch(item);
      if (millis >= record.lastUsedAtMillis) record.lastUsedAtMillis = millis;
    }

    for (const item of activeItems) {
      const key = keyFor(item.name, item.normalizedName);
      if (!key || !item.name.trim()) continue;
      let record = map.get(key);
      if (!record) {
        record = {
          normalizedName: key,
          displayName: item.name.trim(),
          quantity: item.quantity,
          purchaseCount: 0,
          activeBoost: 0,
          recurringBoost: 0,
          lastUsedAtMillis: 0,
        };
        map.set(key, record);
      }
      record.activeBoost = 1;
      record.displayName = item.name.trim();
      record.category = item.category as ItemCategory;
      record.unit = item.unit;
      record.quantity = item.quantity;
      const millis = getEpoch(item);
      if (millis >= record.lastUsedAtMillis) record.lastUsedAtMillis = millis;
    }

    for (const item of recurringItems) {
      const key = keyFor(item.name, item.normalizedName);
      if (!key || !item.name.trim()) continue;
      let record = map.get(key);
      if (!record) {
        record = {
          normalizedName: key,
          displayName: item.name.trim(),
          quantity: item.quantity,
          purchaseCount: 0,
          activeBoost: 0,
          recurringBoost: 0,
          lastUsedAtMillis: 0,
        };
        map.set(key, record);
      }
      record.recurringBoost = 1;
      if (!record.displayName) record.displayName = item.name.trim();
      if (!record.category) record.category = item.category as ItemCategory;
      if (record.unit === undefined) record.unit = item.unit;
      record.quantity = item.quantity;
      const millis = item.updatedAt?.toMillis() ?? item.lastCompletedAt?.toMillis() ?? item.createdAt?.toMillis() ?? 0;
      if (millis >= record.lastUsedAtMillis) record.lastUsedAtMillis = millis;
    }

    const byFirstChar = new Map<string, HistoryRecord[]>();
    for (const record of map.values()) {
      const normalized = normalizeItemName(record.displayName);
      const ch = normalized?.[0] ?? '';
      if (!ch) continue;
      const list = byFirstChar.get(ch) || [];
      list.push(record);
      byFirstChar.set(ch, list);
    }

    return new HouseholdHistoryIndex(map, byFirstChar);
  }

  search(query: string, limit: number): AutocompleteSuggestion[] {
    if (limit <= 0) return [];

    const normalizedQuery = normalizeItemName(query);
    if (!normalizedQuery) return [];

    const candidates = this.byFirstChar.get(normalizedQuery[0]);
    if (!candidates) return [];

    return candidates
      .map((record) => {
        const score = prefixMatchScore(record.displayName, query);
        if (score <= 0) return null;
        const rankScore =
          score +
          record.purchaseCount * 10 +
          record.activeBoost * 50 +
          record.recurringBoost * 30 +
          Math.floor(record.lastUsedAtMillis / 1_000_000_000);
        return { record, rankScore };
      })
      .filter(Boolean)
      .sort((a, b) => b!.rankScore - a!.rankScore)
      .slice(0, limit)
      .map(
        (entry): AutocompleteSuggestion => ({
          displayName: entry!.record.displayName,
          source: 'HOUSEHOLD_HISTORY',
          category: entry!.record.category,
          unit: entry!.record.unit,
          quantity: entry!.record.quantity,
          purchaseCount: entry!.record.purchaseCount,
          lastUsedAtMillis: entry!.record.lastUsedAtMillis,
        }),
      );
  }

  normalizedNames(): Set<string> {
    return new Set(this.records.keys());
  }
}
