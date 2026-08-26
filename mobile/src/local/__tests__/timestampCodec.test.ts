// Faithful minimal Timestamp so tests don't load the real Firebase ESM bundle.
jest.mock('firebase/firestore', () => {
  class Timestamp {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    static fromMillis(ms: number) {
      return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
    }
    toMillis() {
      return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
    }
    toDate() {
      return new Date(this.toMillis());
    }
  }
  return { Timestamp };
});

import { Timestamp } from 'firebase/firestore';
import { ItemCategory, ItemStatus, ItemUnit, ActivityType } from '../../models';
import type { ShoppingItem, ActivityLog } from '../../models';
import {
  encodeItem,
  decodeItem,
  encodeActivity,
  decodeActivity,
  toMillisSafe,
} from '../timestampCodec';

function makeItem(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: 'item-1',
    name: 'Milk',
    normalizedName: 'milk',
    quantity: 1,
    unit: ItemUnit.LITERS,
    category: ItemCategory.DAIRY,
    note: '',
    status: ItemStatus.ACTIVE,
    addedBy: 'u1',
    addedByName: 'User One',
    boughtBy: null,
    boughtByName: null,
    isFavorite: false,
    isUrgent: false,
    createdAt: Timestamp.fromMillis(1_700_000_000_000),
    updatedAt: Timestamp.fromMillis(1_700_000_500_000),
    ...overrides,
  };
}

describe('timestampCodec', () => {
  describe('toMillisSafe', () => {
    it('returns null for null/undefined', () => {
      expect(toMillisSafe(null)).toBeNull();
      expect(toMillisSafe(undefined)).toBeNull();
    });

    it('passes through finite numbers', () => {
      expect(toMillisSafe(1234)).toBe(1234);
    });

    it('reads a real Timestamp', () => {
      expect(toMillisSafe(Timestamp.fromMillis(5000))).toBe(5000);
    });

    it('reconstructs from a JSON-parsed {seconds,nanoseconds} shape', () => {
      // This is exactly what a Timestamp becomes after JSON.stringify/parse.
      const plain = JSON.parse(JSON.stringify(Timestamp.fromMillis(8000)));
      expect(toMillisSafe(plain)).toBe(8000);
    });
  });

  it('item survives an encode → JSON round-trip → decode with working toMillis()', () => {
    const item = makeItem();

    // Simulate exactly what storage does: encode, persist as JSON, read back.
    const persisted = JSON.stringify(encodeItem(item));
    const raw = JSON.parse(persisted);
    const decoded = decodeItem(raw);

    // The regression this guards: decoded timestamps must be real Timestamps
    // whose toMillis() does not throw.
    expect(decoded.createdAt).toBeInstanceOf(Timestamp);
    expect(decoded.updatedAt).toBeInstanceOf(Timestamp);
    expect(decoded.createdAt!.toMillis()).toBe(1_700_000_000_000);
    expect(decoded.updatedAt!.toMillis()).toBe(1_700_000_500_000);

    // Non-timestamp fields are preserved unchanged.
    expect(decoded.id).toBe('item-1');
    expect(decoded.name).toBe('Milk');
    expect(decoded.status).toBe(ItemStatus.ACTIVE);
  });

  it('handles null timestamps without throwing', () => {
    const item = makeItem({ createdAt: null, updatedAt: null });
    const decoded = decodeItem(JSON.parse(JSON.stringify(encodeItem(item))));
    expect(decoded.createdAt).toBeNull();
    expect(decoded.updatedAt).toBeNull();
  });

  it('activity log round-trips with a working createdAt.toMillis()', () => {
    const log: ActivityLog = {
      id: 'a1',
      householdId: 'h1',
      type: ActivityType.ITEM_ADDED,
      itemId: 'item-1',
      itemName: 'Milk',
      actorUserId: 'u1',
      actorDisplayName: 'User One',
      message: 'added',
      createdAt: Timestamp.fromMillis(1_700_001_000_000),
    };
    const decoded = decodeActivity(JSON.parse(JSON.stringify(encodeActivity(log))));
    expect(decoded.createdAt).toBeInstanceOf(Timestamp);
    expect(decoded.createdAt!.toMillis()).toBe(1_700_001_000_000);
  });
});
