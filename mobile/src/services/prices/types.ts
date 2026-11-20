/**
 * Mirrors the `prices` callable (functions/src/prices). Money is in agorot.
 */

/** [chainKey, storeId, name, address, city, lat, lng, type (2 = online), geo precision] */
export type StoreRow = [string, string, string, string, string, number | null, number | null, number, string];

export interface StoresIndex {
  v: number;
  generatedAt: number;
  chains: { key: string; name: string; updatedAt: number; stores: number }[];
  stores: StoreRow[];
}

export interface CompareItemInput {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  code?: string | null;
}

export interface ItemResult {
  id: string;
  matched: boolean;
  /** exact = the locked barcode; similar = matched by name. */
  mode: 'exact' | 'similar' | 'none';
  product: { name: string; code: string | null; size: string; weighted: boolean } | null;
  cheapest: { store: string; cost: number } | null;
}

export interface StoreLine {
  id: string;
  n: string;
  c: string | null;
  size: string;
  cost: number;
  regular: number;
  amount: number;
  weighted: boolean;
  promo: { d: string; club: boolean } | null;
  hint: { d: string; min: number; b: number } | null;
  approx: boolean;
  packCost: number | null;
}

export interface StoreResult {
  key: string;
  chain: string;
  chainName: string;
  name: string;
  address: string;
  cityCode: number | null;
  city: string;
  online: boolean;
  total: number;
  estimated: number;
  promoSavings: number;
  found: number;
  missing: string[];
  updatedAt: string;
  lines: StoreLine[];
}

export interface CompareResult {
  generatedAt: number;
  matchedItems: number;
  items: ItemResult[];
  stores: StoreResult[];
  split: { stores: [string, string]; total: number; saving: number; assign: Record<string, string> } | null;
}

export interface ProductHit {
  code: string;
  name: string;
  maker: string;
  size: string;
  weighted: boolean;
  chains: number;
  minPrice: number | null;
  maxPrice: number | null;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** A store picked for comparison, with its distance from the shopper. */
export interface NearbyStore {
  ref: string;
  chain: string;
  name: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
}
