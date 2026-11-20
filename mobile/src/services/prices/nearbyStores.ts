import type { GeoPoint, NearbyStore, StoreRow, StoresIndex } from './types';

/** The callable accepts at most 15 stores per comparison. */
export const MAX_COMPARE_STORES = 15;
const PER_CHAIN = 3;

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toNearby(row: StoreRow, distance: number | null): NearbyStore {
  return {
    ref: `${row[0]}:${row[1]}`,
    chain: row[0],
    name: row[2],
    address: row[3],
    city: row[4],
    lat: row[5],
    lng: row[6],
    distanceKm: distance,
  };
}

/**
 * Physical stores within the radius. Picked in rounds — every chain's nearest branch first,
 * then second-nearest — so one chain's dense branches don't crowd out the others.
 */
export function pickNearbyStores(index: StoresIndex, origin: GeoPoint, radiusKm: number): NearbyStore[] {
  const byChain = new Map<string, { row: StoreRow; d: number }[]>();
  for (const row of index.stores) {
    if (row[7] === 2 || row[5] == null || row[6] == null) continue;
    const d = distanceKm(origin, { lat: row[5], lng: row[6] });
    if (d > radiusKm) continue;
    const list = byChain.get(row[0]) ?? [];
    list.push({ row, d });
    byChain.set(row[0], list);
  }
  for (const list of byChain.values()) list.sort((a, b) => a.d - b.d);
  const out: NearbyStore[] = [];
  for (let round = 0; round < PER_CHAIN && out.length < MAX_COMPARE_STORES; round++) {
    const layer = [...byChain.values()]
      .map((list) => list[round])
      .filter((x): x is { row: StoreRow; d: number } => !!x)
      .sort((a, b) => a.d - b.d);
    for (const { row, d } of layer) {
      if (out.length >= MAX_COMPARE_STORES) break;
      out.push(toNearby(row, d));
    }
  }
  return out.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

/** Cities that have at least one physical store, alphabetically. */
export function listCities(index: StoresIndex): string[] {
  const set = new Set<string>();
  for (const row of index.stores) if (row[7] !== 2 && row[4]) set.add(row[4]);
  return [...set].sort((a, b) => a.localeCompare(b, 'he'));
}

/** Centre of a city's geocoded stores, used when the shopper picks a city instead of sharing location. */
export function cityCentre(index: StoresIndex, city: string): GeoPoint | null {
  let lat = 0;
  let lng = 0;
  let n = 0;
  for (const row of index.stores) {
    if (row[4] !== city || row[5] == null || row[6] == null || row[7] === 2) continue;
    lat += row[5];
    lng += row[6];
    n++;
  }
  return n ? { lat: lat / n, lng: lng / n } : null;
}

/** Stores of a city without coordinates, so a city pick still works before geocoding finishes. */
export function storesInCity(index: StoresIndex, city: string): NearbyStore[] {
  const perChain = new Map<string, number>();
  const out: NearbyStore[] = [];
  for (const row of index.stores) {
    if (row[4] !== city || row[7] === 2) continue;
    const n = perChain.get(row[0]) ?? 0;
    if (n >= PER_CHAIN) continue;
    perChain.set(row[0], n + 1);
    out.push(toNearby(row, null));
    if (out.length >= MAX_COMPARE_STORES) break;
  }
  return out;
}
