/**
 * Pure notification helpers (no Firebase imports) so they can be unit-tested
 * with `node --test` after `tsc` (see notificationLogic.test.ts).
 */

export type PreferenceKey =
  | "itemAdded"
  | "urgentItem"
  | "shoppingComplete"
  | "memberJoined"
  | "recurringDue";

/**
 * Types that are on unless the user switched them off. Empty: every
 * notification is opt-in (off until enabled in Settings) — product decision.
 * Mirrors DEFAULT_NOTIFICATION_PREFERENCES in mobile/src/models/types.ts.
 */
export const DEFAULT_ON: ReadonlySet<PreferenceKey> = new Set<PreferenceKey>([]);

/** An explicit boolean wins; an unset key falls back to the default. */
export function isPreferenceEnabled(prefs: unknown, key: PreferenceKey): boolean {
  const value =
    prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>)[key] : undefined;
  if (typeof value === "boolean") return value;
  return DEFAULT_ON.has(key);
}

export function isHouseholdMuted(mutedHouseholdIds: unknown, householdId: string): boolean {
  return Array.isArray(mutedHouseholdIds) && mutedHouseholdIds.includes(householdId);
}

/** How long item-added pushes from one person to one home are collected into one. */
export const ITEM_ADDED_BATCH_WINDOW_MS = 60_000;

/** Max item names spelled out in a batched push before "+N". */
const MAX_NAMED_ITEMS = 4;

const MORE_SUFFIX: Record<string, string> = {
  en: "+{{n}} more",
  he: "ועוד {{n}}",
  ar: "و{{n}} أخرى",
  fr: "+{{n}} autres",
  es: "+{{n}} más",
  ru: "и ещё {{n}}",
  am: "+{{n}} ተጨማሪ",
};

/** "milk, bread, eggs" or "milk, bread, eggs, oil +3 more" (deduplicated, in order). */
export function joinItemNames(names: string[], lang: string): string {
  const unique: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (name && !unique.includes(name)) unique.push(name);
  }
  if (unique.length <= MAX_NAMED_ITEMS) return unique.join(", ");
  const rest = unique.length - MAX_NAMED_ITEMS;
  const suffix = (MORE_SUFFIX[lang] ?? MORE_SUFFIX.en).replace("{{n}}", String(rest));
  return `${unique.slice(0, MAX_NAMED_ITEMS).join(", ")} ${suffix}`;
}

/** Due recurring items whose name is not already on the active list. */
export function recurringItemsToRemind(
  due: { name: string; normalizedName?: string }[],
  activeNames: string[]
): string[] {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const onList = new Set(activeNames.map(norm));
  const out: string[] = [];
  for (const item of due) {
    const key = norm(item.normalizedName || item.name);
    if (!key || onList.has(key) || onList.has(norm(item.name))) continue;
    if (!out.includes(item.name)) out.push(item.name);
  }
  return out;
}
