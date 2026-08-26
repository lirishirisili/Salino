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
import { ItemCategory, ItemStatus, ItemUnit } from '../../models';
import type { ShoppingItem } from '../../models';

// In-memory AsyncStorage mock that introduces a small async delay on every
// get/set so that unsynchronized read-modify-write sequences would interleave
// and lose data if the storage layer were not serializing writes per key.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  const tick = () => new Promise((r) => setTimeout(r, 1));
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => {
        await tick();
        return store.has(key) ? store.get(key)! : null;
      }),
      setItem: jest.fn(async (key: string, value: string) => {
        await tick();
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        await tick();
        store.delete(key);
      }),
    },
  };
});

import { localGetItems, localUpsertItem } from '../storage';

function makeItem(id: string): ShoppingItem {
  return {
    id,
    name: id,
    normalizedName: id,
    quantity: 1,
    unit: ItemUnit.PIECES,
    category: ItemCategory.OTHER,
    note: '',
    status: ItemStatus.ACTIVE,
    addedBy: 'u1',
    addedByName: 'User',
    boughtBy: null,
    boughtByName: null,
    isFavorite: false,
    isUrgent: false,
    createdAt: Timestamp.fromMillis(1_700_000_000_000),
    updatedAt: Timestamp.fromMillis(1_700_000_000_000),
  };
}

describe('storage write serialization', () => {
  it('does not lose concurrent upserts to the same household', async () => {
    const householdId = 'h-concurrent';
    const ids = Array.from({ length: 20 }, (_, i) => `item-${i}`);

    // Fire all upserts concurrently — each does a read-modify-write.
    await Promise.all(ids.map((id) => localUpsertItem(householdId, makeItem(id))));

    const stored = await localGetItems(householdId);
    const storedIds = stored.map((i) => i.id).sort();
    expect(storedIds).toEqual([...ids].sort());
  });
});
