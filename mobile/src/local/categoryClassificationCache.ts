import AsyncStorage from '@react-native-async-storage/async-storage';
import { ItemCategory } from '../models';

const STORAGE_KEY = 'category_classification_cache_entries';
const MAX_ENTRIES = 200;
const ENTRY_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

interface CacheEntry {
  category: ItemCategory;
  cachedAtMillis: number;
}

/**
 * In-memory + AsyncStorage cache for AI category classifications.
 * Mirrors Android `CategoryClassificationCache` — max 200 entries, 90-day TTL,
 * evict oldest on overflow.
 *
 * Format in AsyncStorage: newline-separated lines of
 *   `normalizedName|CATEGORY_ENUM|cachedAtMillis`
 */

let entries: Map<string, CacheEntry> | null = null;
let loadPromise: Promise<void> | null = null;

function serialize(map: Map<string, CacheEntry>): string {
  const lines: string[] = [];
  for (const [name, entry] of map) {
    lines.push(`${name}|${entry.category}|${entry.cachedAtMillis}`);
  }
  return lines.join('\n');
}

function deserialize(raw: string): Map<string, CacheEntry> {
  const map = new Map<string, CacheEntry>();
  if (!raw) return map;
  const validCategories = new Set(Object.values(ItemCategory) as string[]);
  const now = Date.now();
  for (const line of raw.split('\n')) {
    const parts = line.split('|');
    if (parts.length !== 3) continue;
    const [name, cat, ms] = parts;
    const cachedAtMillis = parseInt(ms, 10);
    if (isNaN(cachedAtMillis)) continue;
    if (now - cachedAtMillis > ENTRY_TTL_MS) continue;
    if (!validCategories.has(cat)) continue;
    map.set(name, { category: cat as ItemCategory, cachedAtMillis });
  }
  return map;
}

async function ensureLoaded(): Promise<Map<string, CacheEntry>> {
  if (entries) return entries;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        entries = raw ? deserialize(raw) : new Map();
      } catch {
        entries = new Map();
      }
    })();
  }
  await loadPromise;
  return entries!;
}

function persist(map: Map<string, CacheEntry>): void {
  AsyncStorage.setItem(STORAGE_KEY, serialize(map)).catch(() => {});
}

export const categoryClassificationCache = {
  async get(normalizedName: string): Promise<ItemCategory | null> {
    const map = await ensureLoaded();
    const entry = map.get(normalizedName);
    if (!entry) return null;
    if (Date.now() - entry.cachedAtMillis > ENTRY_TTL_MS) {
      map.delete(normalizedName);
      persist(map);
      return null;
    }
    return entry.category;
  },

  async put(normalizedName: string, category: ItemCategory): Promise<void> {
    const map = await ensureLoaded();
    map.set(normalizedName, { category, cachedAtMillis: Date.now() });
    while (map.size > MAX_ENTRIES) {
      let oldestKey: string | null = null;
      let oldestMs = Infinity;
      for (const [key, entry] of map) {
        if (entry.cachedAtMillis < oldestMs) {
          oldestMs = entry.cachedAtMillis;
          oldestKey = key;
        }
      }
      if (oldestKey) map.delete(oldestKey);
      else break;
    }
    persist(map);
  },
};
