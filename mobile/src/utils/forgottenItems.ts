import type { ItemCategory, ItemUnit, ShoppingItem } from '../models';
import { normalizeItemName } from './textUtils';

/**
 * "What did I forget?": items this home buys regularly that are due again but
 * aren't on the list. Every add creates a new item doc, so the bought docs of
 * one product name are its purchase history (updatedAt = when it was bought).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Fewer purchases than this is not a habit. */
const MIN_PURCHASES = 3;
/** Due once this share of the usual gap has passed. */
const DUE_RATIO = 0.8;
/** Gaps longer than this many usual gaps mean the habit stopped. */
const STALE_RATIO = 4;
const MIN_INTERVAL_MS = DAY_MS;
const MAX_SUGGESTIONS = 12;

export interface ForgottenItem {
  name: string;
  category: ItemCategory;
  unit: ItemUnit | null;
  quantity: number;
  purchases: number;
  daysSinceLast: number;
  usualEveryDays: number;
}

const millis = (item: ShoppingItem): number =>
  item.updatedAt?.toMillis?.() ?? item.createdAt?.toMillis?.() ?? 0;

export function findForgottenItems(
  boughtItems: ShoppingItem[],
  activeItems: ShoppingItem[],
  now: number = Date.now(),
): ForgottenItem[] {
  const onList = new Set(activeItems.map((i) => i.normalizedName || normalizeItemName(i.name)));
  const byName = new Map<string, ShoppingItem[]>();
  for (const item of boughtItems) {
    const key = item.normalizedName || normalizeItemName(item.name);
    if (!key || onList.has(key) || millis(item) <= 0) continue;
    const list = byName.get(key) ?? [];
    list.push(item);
    byName.set(key, list);
  }

  const out: (ForgottenItem & { score: number })[] = [];
  for (const items of byName.values()) {
    if (items.length < MIN_PURCHASES) continue;
    // Several docs bought within the same day are one shopping event.
    const days = [...new Set(items.map((i) => Math.floor(millis(i) / DAY_MS)))].sort((a, b) => a - b);
    if (days.length < MIN_PURCHASES) continue;
    const first = days[0] * DAY_MS;
    const lastDay = days[days.length - 1];
    const last = Math.max(...items.filter((i) => Math.floor(millis(i) / DAY_MS) === lastDay).map(millis));
    const interval = Math.max(MIN_INTERVAL_MS, (lastDay * DAY_MS - first) / (days.length - 1));
    const since = now - last;
    if (since < DUE_RATIO * interval || since > STALE_RATIO * interval) continue;
    const latest = items.reduce((a, b) => (millis(b) > millis(a) ? b : a));
    out.push({
      name: latest.name.trim(),
      category: latest.category,
      unit: latest.unit,
      quantity: latest.quantity,
      purchases: days.length,
      daysSinceLast: Math.floor(since / DAY_MS),
      usualEveryDays: Math.max(1, Math.round(interval / DAY_MS)),
      score: (since / interval) * Math.log2(1 + days.length),
    });
  }
  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ score: _score, ...item }) => item);
}
