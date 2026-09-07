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

import { Timestamp } from 'firebase/firestore';
import { ItemCategory, ItemStatus, ItemUnit } from '../../models';
import type { ShoppingItem } from '../../models';
import { sortShoppingItems } from '../itemOrder';

function makeItem(id: string, createdAtMs: number): ShoppingItem {
  const ts = Timestamp.fromMillis(createdAtMs);
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
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('itemOrder', () => {
  it('sorts a reversed cache to newest-first', () => {
    const sorted = sortShoppingItems([
      makeItem('pancake', 1_700_000_000_000),
      makeItem('avocado', 1_700_000_100_000),
      makeItem('milka', 1_700_000_200_000),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['milka', 'avocado', 'pancake']);
  });
});
