import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpsCallable } from 'firebase/functions';
import { pricesFunctions } from '../../remote/firebase';
import type { CompareItemInput, CompareResult, ProductHit, StoresIndex } from './types';

const STORES_CACHE_KEY = '@prices_stores_v1';
const STORES_TTL_MS = 12 * 60 * 60 * 1000;

// A cold instance loads every chain's prices before answering.
const callPrices = httpsCallable(pricesFunctions, 'prices', { timeout: 45_000 });

export type PricesErrorKind = 'not_ready' | 'busy' | 'offline' | 'generic';

export function pricesErrorKind(e: unknown): PricesErrorKind {
  const code = String((e as { code?: string })?.code ?? '');
  if (code.endsWith('unavailable')) return 'not_ready';
  if (code.endsWith('resource-exhausted')) return 'busy';
  if (code.endsWith('deadline-exceeded') || (code.endsWith('internal') && /network/i.test(String(e)))) return 'offline';
  return 'generic';
}

const WARM_EVERY_MS = 10 * 60 * 1000;
let lastWarmAt = 0;

/** Fire-and-forget: loads the price data on the server before the shopper opens the comparison. */
export function warmPrices(): void {
  if (Date.now() - lastWarmAt < WARM_EVERY_MS) return;
  lastWarmAt = Date.now();
  callPrices({ action: 'warm' }).catch(() => undefined);
}

let memoryIndex: { at: number; index: StoresIndex } | null = null;

/** Store list with coordinates; cached on the device so picking nearby stores is instant. */
export async function fetchStoresIndex(): Promise<StoresIndex> {
  if (!memoryIndex) {
    try {
      const raw = await AsyncStorage.getItem(STORES_CACHE_KEY);
      if (raw) memoryIndex = JSON.parse(raw);
    } catch {
      // Ignore a corrupt cache.
    }
  }
  if (memoryIndex && Date.now() - memoryIndex.at < STORES_TTL_MS) return memoryIndex.index;
  try {
    const res = await callPrices({ action: 'stores' });
    const index = res.data as StoresIndex;
    memoryIndex = { at: Date.now(), index };
    AsyncStorage.setItem(STORES_CACHE_KEY, JSON.stringify(memoryIndex)).catch(() => undefined);
    return index;
  } catch (e) {
    if (memoryIndex) return memoryIndex.index;
    throw e;
  }
}

export async function compareBasket(
  items: CompareItemInput[],
  stores: string[],
  clubs: string[],
): Promise<CompareResult> {
  const res = await callPrices({ action: 'compare', items, stores, clubs });
  return res.data as CompareResult;
}

export async function searchProducts(query: string, stores: string[]): Promise<ProductHit[]> {
  const res = await callPrices({ action: 'search', query, stores });
  return ((res.data as { results?: ProductHit[] })?.results ?? []) as ProductHit[];
}
