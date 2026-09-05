jest.mock('firebase/firestore', () => ({
  Timestamp: { fromMillis: jest.fn(), now: jest.fn() },
}));

const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { mockStore.delete(key); }),
  },
}));

import { categoryClassificationCache } from '../categoryClassificationCache';
import { ItemCategory } from '../../models';

describe('categoryClassificationCache', () => {
  it('returns null for missing key', async () => {
    expect(await categoryClassificationCache.get('nonexistent')).toBeNull();
  });

  it('roundtrips put then get', async () => {
    await categoryClassificationCache.put('חלב', ItemCategory.DAIRY);
    expect(await categoryClassificationCache.get('חלב')).toBe(ItemCategory.DAIRY);
  });

  it('returns null for expired entry', async () => {
    const expiredMs = Date.now() - 91 * 24 * 60 * 60 * 1000;
    mockStore.set(
      'category_classification_cache_entries',
      `old_item|DAIRY|${expiredMs}`,
    );

    await categoryClassificationCache.put('fresh_item', ItemCategory.BAKERY);
    expect(await categoryClassificationCache.get('fresh_item')).toBe(ItemCategory.BAKERY);
  });

  it('evicts oldest when over 200 entries', async () => {
    for (let i = 0; i < 200; i++) {
      await categoryClassificationCache.put(`item_${i}`, ItemCategory.DAIRY);
    }
    await categoryClassificationCache.put('item_overflow', ItemCategory.BAKERY);
    expect(await categoryClassificationCache.get('item_overflow')).toBe(ItemCategory.BAKERY);
  });
});
