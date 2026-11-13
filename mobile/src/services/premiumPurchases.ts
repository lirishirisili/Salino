import { Platform } from 'react-native';
import type { Purchase, PurchaseError } from 'react-native-iap';
import { REMOVE_ADS_SKU } from '../config/premium';
import { logAdEvent } from './initMobileAnalytics';
import { usePremiumStore } from './premium';

/**
 * "Haserli without ads" — one non-consumable product on both stores, bought with
 * react-native-iap (same pattern as Tohav's src/ads/removeAds.ts). No server:
 * the stores hold the purchase, "Restore purchases" reads it back.
 */

const LOG = '[IAP]';

type IapPackage = typeof import('react-native-iap');

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'error' | 'unavailable';

let iapPackage: IapPackage | null | undefined;
let connection: Promise<boolean> | null = null;
let subscriptions: { remove: () => void }[] = [];
let pendingPurchase: ((outcome: PurchaseOutcome) => void) | null = null;
let syncPromise: Promise<void> | null = null;
let lastPrice: string | null = null;

/** Price from the last successful store query (offer UI shows only when the product exists). */
export function getCachedNoAdsPrice(): string | null {
  return lastPrice;
}

/** Lazy: the Nitro module throws at import time in Jest / binaries without it. */
function iap(): IapPackage | null {
  if (iapPackage !== undefined) return iapPackage;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require('react-native-iap') as IapPackage;
    iapPackage = loaded.isNitroReady() ? loaded : null;
  } catch {
    iapPackage = null;
  }
  return iapPackage;
}

export function arePurchasesAvailable(): boolean {
  return Platform.OS !== 'web' && iap() !== null;
}

/** Only ever grants: an empty / failed store query must not bring ads back for a payer. */
function grant(): void {
  usePremiumStore.getState().setPremium(true);
}

function settlePending(outcome: PurchaseOutcome): void {
  const resolve = pendingPurchase;
  pendingPurchase = null;
  resolve?.(outcome);
}

async function handlePurchase(purchase: Purchase): Promise<void> {
  const store = iap();
  if (!store || purchase.productId !== REMOVE_ADS_SKU) return;
  // Android "pending" (e.g. cash payment) grants nothing until it completes.
  if (purchase.purchaseState !== 'purchased') return;
  try {
    // Non-consumable: finishing acknowledges it (Play refunds unacknowledged
    // purchases after three days) without consuming it.
    await store.finishTransaction({ purchase, isConsumable: false });
  } catch (error: unknown) {
    console.warn(`${LOG} finishTransaction failed error=${String(error)}`);
  }
  grant();
  settlePending('purchased');
}

function connect(): Promise<boolean> {
  const store = iap();
  if (!store) return Promise.resolve(false);
  if (connection) return connection;
  connection = (async () => {
    const connected = await store.initConnection();
    if (!connected) return false;
    subscriptions = [
      store.purchaseUpdatedListener((purchase) => void handlePurchase(purchase)),
      store.purchaseErrorListener((error: PurchaseError) => {
        console.warn(`${LOG} purchase error code=${error.code} message=${error.message}`);
        settlePending(error.code === 'user-cancelled' ? 'cancelled' : 'error');
      }),
    ];
    return true;
  })().catch((error: unknown) => {
    console.warn(`${LOG} initConnection failed error=${String(error)}`);
    connection = null;
    return false;
  });
  return connection;
}

/**
 * Opens the store connection and grants "no ads" when the account already owns
 * it (new device, reinstall). Also finishes a purchase interrupted before
 * acknowledgement. Never throws.
 */
export function initPremiumPurchases(): Promise<void> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const store = iap();
    if (!store || !(await connect())) return;
    try {
      const purchases = await store.getAvailablePurchases();
      for (const purchase of purchases) {
        if (purchase.productId === REMOVE_ADS_SKU) await handlePurchase(purchase);
      }
      if (!usePremiumStore.getState().isPremium) void getNoAdsPrice();
    } catch (error: unknown) {
      console.warn(`${LOG} getAvailablePurchases failed error=${String(error)}`);
    }
  })();
  return syncPromise;
}

/** Localized store price, e.g. "₪16.90" — null when the store or product is unavailable. */
export async function getNoAdsPrice(): Promise<string | null> {
  const store = iap();
  if (!store || !(await connect())) return null;
  try {
    const products = await store.fetchProducts({ skus: [REMOVE_ADS_SKU], type: 'in-app' });
    lastPrice = products?.find((p) => p.id === REMOVE_ADS_SKU)?.displayPrice ?? null;
    return lastPrice;
  } catch (error: unknown) {
    console.warn(`${LOG} fetchProducts failed error=${String(error)}`);
    return null;
  }
}

export async function purchaseNoAds(source: string): Promise<PurchaseOutcome> {
  const store = iap();
  if (!store || !(await connect())) return 'unavailable';
  settlePending('cancelled');
  const outcome = new Promise<PurchaseOutcome>((resolve) => {
    pendingPurchase = resolve;
  });
  try {
    await store.requestPurchase({
      request: { apple: { sku: REMOVE_ADS_SKU }, google: { skus: [REMOVE_ADS_SKU] } },
      type: 'in-app',
    });
  } catch (error: unknown) {
    console.warn(`${LOG} requestPurchase failed error=${String(error)}`);
    settlePending('error');
  }
  const result = await outcome;
  if (result === 'purchased') logAdEvent('premium_purchase', { source });
  return result;
}

/** "Restore purchases": true when the account owns "no ads". */
export async function restoreNoAds(): Promise<boolean> {
  const store = iap();
  if (!store || !(await connect())) return false;
  try {
    await store.restorePurchases();
    const purchases = await store.getAvailablePurchases();
    const owned = purchases.some((p) => p.productId === REMOVE_ADS_SKU && p.purchaseState === 'purchased');
    if (owned) grant();
    logAdEvent('premium_restore', { active: owned });
    return owned;
  } catch (error: unknown) {
    console.warn(`${LOG} restore failed error=${String(error)}`);
    return false;
  }
}
