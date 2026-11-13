import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * "Haserli without ads" entitlement. The purchase itself lives in
 * premiumPurchases.ts (RevenueCat); this store is the single source the ad
 * components read, cached so a cold start offline still hides ads.
 */

const CACHE_KEY = '@premium_v1';

interface PremiumState {
  isPremium: boolean;
  /** True once the cached value was read (ads wait for it to avoid a flash). */
  hydrated: boolean;
  setPremium: (value: boolean) => void;
}

export const usePremiumStore = create<PremiumState>((set) => ({
  isPremium: false,
  hydrated: false,
  setPremium: (value) => {
    set({ isPremium: value, hydrated: true });
    AsyncStorage.setItem(CACHE_KEY, value ? '1' : '0').catch(() => undefined);
  },
}));

let hydratePromise: Promise<boolean> | null = null;

/** Reads the cached entitlement once. */
export function hydratePremium(): Promise<boolean> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = AsyncStorage.getItem(CACHE_KEY)
    .then((v) => v === '1')
    .catch(() => false)
    .then((cached) => {
      const s = usePremiumStore.getState();
      // A live answer from the store may already have arrived — don't override it.
      if (!s.hydrated) usePremiumStore.setState({ isPremium: cached, hydrated: true });
      return usePremiumStore.getState().isPremium;
    });
  return hydratePromise;
}

export const isPremiumNow = (): boolean => usePremiumStore.getState().isPremium;

export function useIsPremium(): boolean {
  return usePremiumStore((s) => s.isPremium);
}
