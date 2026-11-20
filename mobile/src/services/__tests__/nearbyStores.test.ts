import { cityCentre, distanceKm, listCities, pickNearbyStores, storesInCity } from '../prices/nearbyStores';
import type { StoreRow, StoresIndex } from '../prices/types';

const TLV = { lat: 32.0853, lng: 34.7818 };

function row(chain: string, id: string, city: string, lat: number | null, lng: number | null, type = 1): StoreRow {
  return [chain, id, `${chain} ${id}`, 'addr', city, lat, lng, type, 'a'];
}

function index(rows: StoreRow[]): StoresIndex {
  return { v: 1, generatedAt: 0, chains: [], stores: rows };
}

describe('nearbyStores', () => {
  it('measures distance', () => {
    // Tel Aviv – Jerusalem is about 54 km in a straight line.
    expect(distanceKm(TLV, { lat: 31.7683, lng: 35.2137 })).toBeGreaterThan(50);
    expect(distanceKm(TLV, { lat: 31.7683, lng: 35.2137 })).toBeLessThan(58);
  });

  it('keeps every chain in reach before adding second branches', () => {
    const rows: StoreRow[] = [];
    for (let i = 0; i < 10; i++) rows.push(row('dense', String(i), 'תל אביב', TLV.lat + i * 0.001, TLV.lng));
    rows.push(row('far', '1', 'תל אביב', TLV.lat + 0.03, TLV.lng));
    const picked = pickNearbyStores(index(rows), TLV, 5);
    expect(picked.map((p) => p.chain).filter((c) => c === 'dense')).toHaveLength(3);
    expect(picked.some((p) => p.chain === 'far')).toBe(true);
    expect(picked[0].ref).toBe('dense:0');
  });

  it('skips online stores, stores without coordinates and stores out of range', () => {
    const picked = pickNearbyStores(
      index([
        row('a', '1', 'תל אביב', TLV.lat, TLV.lng, 2),
        row('b', '1', 'תל אביב', null, null),
        row('c', '1', 'ירושלים', 31.7683, 35.2137),
        row('d', '1', 'תל אביב', TLV.lat, TLV.lng),
      ]),
      TLV,
      10,
    );
    expect(picked.map((p) => p.ref)).toEqual(['d:1']);
  });

  it('caps the comparison at 15 stores', () => {
    const rows: StoreRow[] = [];
    for (let c = 0; c < 20; c++) rows.push(row(`chain${c}`, '1', 'תל אביב', TLV.lat + c * 0.0005, TLV.lng));
    expect(pickNearbyStores(index(rows), TLV, 5)).toHaveLength(15);
  });

  it('city helpers', () => {
    const idx = index([
      row('a', '1', 'חיפה', 32.8, 35.0),
      row('b', '1', 'חיפה', 32.82, 35.02),
      row('c', '1', 'חיפה', null, null),
      row('d', '1', 'אילת', 29.55, 34.95),
      row('e', '1', 'עכו', null, null, 2),
    ]);
    expect(listCities(idx)).toEqual(['אילת', 'חיפה']);
    const centre = cityCentre(idx, 'חיפה')!;
    expect(centre.lat).toBeCloseTo(32.81);
    expect(storesInCity(idx, 'חיפה').map((s) => s.ref)).toEqual(['a:1', 'b:1', 'c:1']);
    expect(cityCentre(idx, 'עכו')).toBeNull();
  });
});
