jest.mock('firebase/firestore', () => {
  class Timestamp {
    mockMs: number;
    constructor(mockMs: number) {
      this.mockMs = mockMs;
    }
    static fromMillis(mockMs: number) {
      return new Timestamp(mockMs);
    }
    toMillis() {
      return this.mockMs;
    }
  }
  return { Timestamp };
});

import { Timestamp } from 'firebase/firestore';
import { ItemCategory, ItemStatus } from '../../models';
import type { ShoppingItem } from '../../models';
import { findForgottenItems } from '../forgottenItems';
import { computeInsights } from '../shoppingInsights';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 20, 12).getTime();
let seq = 0;

function item(name: string, daysAgo: number, extra: Partial<ShoppingItem> = {}): ShoppingItem {
  const ts = Timestamp.fromMillis(NOW - daysAgo * DAY);
  return {
    id: `i${++seq}`,
    name,
    normalizedName: name,
    quantity: 1,
    unit: null,
    category: ItemCategory.DAIRY,
    note: '',
    status: ItemStatus.BOUGHT,
    addedBy: 'u',
    addedByName: 'U',
    boughtBy: 'u',
    boughtByName: 'Dana',
    isFavorite: false,
    isUrgent: false,
    createdAt: ts,
    updatedAt: ts,
    ...extra,
  };
}

describe('findForgottenItems', () => {
  it('suggests a weekly item that is due and not on the list', () => {
    const bought = [item('חלב', 7), item('חלב', 14), item('חלב', 21), item('חלב', 28)];
    const [milk] = findForgottenItems(bought, [], NOW);
    expect(milk).toMatchObject({ name: 'חלב', purchases: 4, usualEveryDays: 7, daysSinceLast: 7 });
  });

  it('skips items already on the list, not yet due, too rare, or abandoned', () => {
    const bought = [
      ...[2, 9, 16].map((d) => item('לחם', d)), // bought 2 days ago, weekly → not due
      ...[7, 14].map((d) => item('גבינה', d)), // only 2 purchases
      ...[100, 107, 114].map((d) => item('יוגורט', d)), // stopped long ago
      ...[7, 14, 21].map((d) => item('ביצים', d)), // due, but on the list
    ];
    const active = [item('ביצים', 0, { status: ItemStatus.ACTIVE })];
    expect(findForgottenItems(bought, active, NOW)).toEqual([]);
  });

  it('counts several docs on the same day as one purchase', () => {
    const bought = [item('מים', 10), item('מים', 10), item('מים', 10.1), item('מים', 20)];
    expect(findForgottenItems(bought, [], NOW)).toEqual([]);
  });
});

describe('computeInsights', () => {
  it('summarizes this month and compares with last month', () => {
    const now = new Date(NOW);
    const thisMonthDays = [1, 1, 2, 5]; // Nov 19, 19, 18, 15
    const bought = [
      ...thisMonthDays.map((d) => item('חלב', d)),
      item('עגבניות', 3, { category: ItemCategory.VEGETABLES, boughtByName: 'Avi' }),
      item('חלב', 30), // October
    ];
    const s = computeInsights(bought, now);
    expect(s.itemsBought).toBe(5);
    expect(s.shoppingDays).toBe(4);
    expect(s.prevItemsBought).toBe(1);
    expect(s.topItems[0]).toEqual({ name: 'חלב', count: 4 });
    expect(s.categories[0]).toMatchObject({ category: ItemCategory.DAIRY, count: 4 });
    expect(s.buyers.map((b) => b.name)).toEqual(['Dana', 'Avi']);
  });
});
