import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { ShoppingItem } from '../models';
import { currentPosition, locationPermission, type PositionResult } from '../services/prices/location';
import { cityCentre, pickNearbyStores, storesInCity } from '../services/prices/nearbyStores';
import {
  compareBasket,
  fetchStoresIndex,
  pricesErrorKind,
  warmPrices,
  type PricesErrorKind,
} from '../services/prices/pricesApi';
import type { CompareItemInput, CompareResult, GeoPoint, NearbyStore, StoresIndex } from '../services/prices/types';
import { logAppEvent } from '../services/initMobileAnalytics';

const PREFS_KEY = '@price_prefs_v1';
const SUMMARY_KEY = '@price_summary_v1';

export const RADIUS_OPTIONS_KM = [2, 5, 10, 20] as const;
const DEFAULT_RADIUS_KM = 5;
/** Prices refresh twice a day; promotions can end within the hour. */
const RESULT_TTL_MS = 30 * 60 * 1000;

export interface PricePrefs {
  /** Chains whose club card the shopper has (club-only promotions count for them). */
  clubs: string[];
  radiusKm: number;
  /** A city chosen instead of sharing location. */
  city: string | null;
}

/** Last result in one line, for the card on the shopping list. */
export interface PriceSummary {
  itemsKey: string;
  chainName: string;
  storeName: string;
  total: number;
  /** False when some items were priced from other stores' median. */
  complete: boolean;
  saving: number;
  at: number;
}

/**
 * Cheapest vs. the priciest store with comparable coverage — a store missing half the
 * basket would make the saving look bigger than it is.
 */
export function basketSaving(result: CompareResult): number {
  const best = result.stores[0];
  if (!best) return 0;
  const comparable = result.stores.filter((s) => s.found >= best.found - 1);
  const worst = Math.max(...comparable.map((s) => s.estimated));
  return Math.max(0, worst - best.estimated);
}

export type PriceStatus =
  | 'idle'
  | 'needs_location'
  | 'locating'
  | 'no_stores'
  | 'loading'
  | 'ready'
  | 'error';

interface PriceCompareState {
  prefs: PricePrefs;
  prefsLoaded: boolean;
  index: StoresIndex | null;
  origin: GeoPoint | null;
  originSource: 'gps' | 'city' | null;
  stores: NearbyStore[];
  status: PriceStatus;
  error: PricesErrorKind | null;
  result: CompareResult | null;
  resultKey: string | null;
  resultAt: number;
  summary: PriceSummary | null;
  loadPrefs: () => Promise<void>;
  /** Picks the origin (saved city, or location if already allowed) and the nearby stores. */
  prepare: () => Promise<void>;
  locate: () => Promise<PositionResult['kind']>;
  chooseCity: (city: string | null) => Promise<void>;
  setRadius: (km: number) => Promise<void>;
  toggleClub: (chain: string) => Promise<void>;
  run: (items: ShoppingItem[], force?: boolean) => Promise<void>;
}

export function compareInputs(items: ShoppingItem[]): CompareItemInput[] {
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit ?? null,
    code: i.priceCode && i.priceCodeFor === i.normalizedName ? i.priceCode : null,
  }));
}

/** Stable key of what was compared, so an unchanged list reuses the last result. */
export function basketKey(items: CompareItemInput[]): string {
  return items
    .map((i) => `${i.name.trim()}|${i.quantity}|${i.unit ?? ''}|${i.code ?? ''}`)
    .sort()
    .join('\n');
}

function persist(key: string, value: unknown): void {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => undefined);
}

export const usePriceCompareStore = create<PriceCompareState>((set, get) => {
  const selectStores = (index: StoresIndex, origin: GeoPoint | null, city: string | null): NearbyStore[] => {
    if (origin) return pickNearbyStores(index, origin, get().prefs.radiusKm);
    return city ? storesInCity(index, city) : [];
  };

  /** `idle` hands over to the screen, which runs the comparison for the picked stores. */
  const applyOrigin = (origin: GeoPoint | null, source: 'gps' | 'city' | null) => {
    const { index, prefs } = get();
    if (!index) return;
    const stores = selectStores(index, origin, source === 'city' ? prefs.city : null);
    set({ origin, originSource: source, stores, status: stores.length ? 'idle' : 'no_stores' });
  };

  return {
    prefs: { clubs: [], radiusKm: DEFAULT_RADIUS_KM, city: null },
    prefsLoaded: false,
    index: null,
    origin: null,
    originSource: null,
    stores: [],
    status: 'idle',
    error: null,
    result: null,
    resultKey: null,
    resultAt: 0,
    summary: null,

    loadPrefs: async () => {
      if (get().prefsLoaded) return;
      try {
        const [rawPrefs, rawSummary] = await Promise.all([
          AsyncStorage.getItem(PREFS_KEY),
          AsyncStorage.getItem(SUMMARY_KEY),
        ]);
        const p = rawPrefs ? (JSON.parse(rawPrefs) as Partial<PricePrefs>) : {};
        set({
          prefs: {
            clubs: Array.isArray(p.clubs) ? p.clubs.filter((c) => typeof c === 'string') : [],
            radiusKm: RADIUS_OPTIONS_KM.includes(p.radiusKm as never) ? (p.radiusKm as number) : DEFAULT_RADIUS_KM,
            city: typeof p.city === 'string' ? p.city : null,
          },
          summary: rawSummary ? (JSON.parse(rawSummary) as PriceSummary) : null,
        });
      } catch {
        // Defaults.
      }
      set({ prefsLoaded: true });
    },

    prepare: async () => {
      warmPrices();
      await get().loadPrefs();
      set({ status: 'locating', error: null });
      let index: StoresIndex;
      try {
        index = await fetchStoresIndex();
      } catch (e) {
        set({ status: 'error', error: pricesErrorKind(e) });
        return;
      }
      set({ index });
      const { city } = get().prefs;
      if (city) {
        applyOrigin(cityCentre(index, city), 'city');
        return;
      }
      if ((await locationPermission()) !== 'granted') {
        set({ status: 'needs_location' });
        return;
      }
      const pos = await currentPosition(false);
      if (pos.kind === 'ok') applyOrigin(pos.point, 'gps');
      else set({ status: 'needs_location' });
    },

    locate: async () => {
      set({ status: 'locating', error: null });
      const pos = await currentPosition(true);
      logAppEvent('price_location', { result: pos.kind });
      if (pos.kind !== 'ok') {
        set({ status: 'needs_location' });
        return pos.kind;
      }
      const prefs = { ...get().prefs, city: null };
      set({ prefs });
      persist(PREFS_KEY, prefs);
      applyOrigin(pos.point, 'gps');
      return 'ok';
    },

    chooseCity: async (city) => {
      const prefs = { ...get().prefs, city };
      set({ prefs });
      persist(PREFS_KEY, prefs);
      const { index } = get();
      if (!index) return;
      if (city) applyOrigin(cityCentre(index, city), 'city');
      else set({ status: 'needs_location', stores: [], origin: null, originSource: null });
    },

    setRadius: async (km) => {
      const prefs = { ...get().prefs, radiusKm: km };
      set({ prefs });
      persist(PREFS_KEY, prefs);
      const { origin, originSource } = get();
      if (origin) applyOrigin(origin, originSource);
    },

    toggleClub: async (chain) => {
      const { clubs } = get().prefs;
      const prefs = { ...get().prefs, clubs: clubs.includes(chain) ? clubs.filter((c) => c !== chain) : [...clubs, chain] };
      set({ prefs });
      persist(PREFS_KEY, prefs);
    },

    run: async (items, force = false) => {
      const { stores, prefs, status } = get();
      if (stores.length === 0 || items.length === 0 || status === 'loading') return;
      const inputs = compareInputs(items);
      const key = `${basketKey(inputs)}\n#${stores.map((s) => s.ref).join(',')}\n#${prefs.clubs.join(',')}`;
      const fresh = Date.now() - get().resultAt < RESULT_TTL_MS;
      if (!force && fresh && key === get().resultKey && get().result) {
        if (status !== 'ready') set({ status: 'ready' });
        return;
      }
      set({ status: 'loading', error: null });
      const started = Date.now();
      try {
        const result = await compareBasket(
          inputs,
          stores.map((s) => s.ref),
          prefs.clubs,
        );
        set({ result, resultKey: key, resultAt: Date.now(), status: 'ready' });
        const best = result.stores[0];
        logAppEvent('price_compare', {
          items: inputs.length,
          stores: stores.length,
          matched: result.matchedItems,
          ms: Date.now() - started,
        });
        if (best) {
          const summary: PriceSummary = {
            itemsKey: basketKey(inputs),
            chainName: best.chainName,
            storeName: best.name,
            total: best.estimated,
            complete: best.found >= result.matchedItems,
            saving: basketSaving(result),
            at: Date.now(),
          };
          set({ summary });
          persist(SUMMARY_KEY, summary);
        }
      } catch (e) {
        const kind = pricesErrorKind(e);
        set({ status: 'error', error: kind });
        logAppEvent('price_compare_error', { kind });
      }
    },
  };
});
