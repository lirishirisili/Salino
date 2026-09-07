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
  }
  return { Timestamp };
});

jest.mock('../../services/suggestionEngine', () => ({
  buildSuggestions: () => [],
}));

import { Timestamp } from 'firebase/firestore';
import { ItemCategory, ItemStatus, ItemUnit } from '../../models';
import type { ShoppingItem } from '../../models';
import { buildShoppingListState, sortShoppingItems } from '../shoppingListState';

function makeItem(id: string, createdAtMs: number, status = ItemStatus.ACTIVE): ShoppingItem {
  const ts = Timestamp.fromMillis(createdAtMs);
  return {
    id,
    name: id,
    normalizedName: id,
    quantity: 1,
    unit: ItemUnit.PIECES,
    category: ItemCategory.OTHER,
    note: '',
    status,
    addedBy: 'u1',
    addedByName: 'User',
    boughtBy: null,
    boughtByName: null,
    isFavorite: false,
    isUrgent: false,
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('sortShoppingItems', () => {
  it('puts newest items first even when the cache is oldest-first', () => {
    const oldest = makeItem('pancake', 1_700_000_000_000);
    const mid = makeItem('avocado', 1_700_000_100_000);
    const newest = makeItem('milka', 1_700_000_200_000);

    const sorted = sortShoppingItems([oldest, mid, newest]);
    expect(sorted.map((i) => i.id)).toEqual(['milka', 'avocado', 'pancake']);
  });
});

describe('buildShoppingListState', () => {
  it('does not flash a reversed active list from a reversed cache payload', () => {
    const oldest = makeItem('pancake', 1_700_000_000_000);
    const newest = makeItem('milka', 1_700_000_200_000);
    const bought = makeItem('old-bought', 1_600_000_000_000, ItemStatus.BOUGHT);

    const state = buildShoppingListState([oldest, bought, newest], []);
    expect(state.activeItems.map((i) => i.id)).toEqual(['milka', 'pancake']);
    expect(state.items[0].id).toBe('milka');
  });
});
