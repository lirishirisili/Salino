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
    static now() {
      return Timestamp.fromMillis(Date.now());
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

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));

const mockFirestoreUpdateItem = jest.fn<Promise<void>, [string, string, Record<string, unknown>]>().mockResolvedValue();
const mockFirestoreLogActivity = jest.fn<Promise<void>, [string, Record<string, unknown>]>().mockResolvedValue();
jest.mock('../../remote/firestoreService', () => ({
  __esModule: true,
  subscribeToItems: jest.fn(),
  firestoreAddItem: jest.fn(async () => {}),
  firestoreUpdateItem: (...args: [string, string, Record<string, unknown>]) => mockFirestoreUpdateItem(...args),
  firestoreDeleteItem: jest.fn(async () => {}),
  firestoreLogActivity: (...args: [string, Record<string, unknown>]) => mockFirestoreLogActivity(...args),
}));

jest.mock('../../remote/firebase', () => ({
  auth: {
    currentUser: { uid: 'user1', displayName: 'Test', email: 'test@test.com' },
  },
}));

const mockUpdateNextDueDate = jest.fn<Promise<void>, [string, Record<string, unknown>, number]>().mockResolvedValue();
jest.mock('../recurringRepository', () => ({
  __esModule: true,
  recurringRepository: {
    updateNextDueDate: (...args: [string, Record<string, unknown>, number]) => mockUpdateNextDueDate(...args),
  },
}));

jest.mock('../../local/storage', () => ({
  __esModule: true,
  localGetItems: jest.fn(async () => []),
  localSetItems: jest.fn(async () => {}),
  localUpsertItem: jest.fn(async () => {}),
  localDeleteItem: jest.fn(async () => {}),
}));

import { Timestamp } from 'firebase/firestore';
import { ItemCategory, ItemStatus, ItemUnit } from '../../models';
import type { ShoppingItem, RecurringItem } from '../../models';
import { shoppingRepository } from '../shoppingRepository';

function makeItem(id: string, name: string): ShoppingItem {
  return {
    id,
    name,
    normalizedName: name.toLowerCase(),
    quantity: 1,
    unit: ItemUnit.PIECES,
    category: ItemCategory.OTHER,
    note: '',
    status: ItemStatus.ACTIVE,
    addedBy: 'user1',
    addedByName: 'Test',
    boughtBy: null,
    boughtByName: null,
    isFavorite: false,
    isUrgent: false,
    createdAt: Timestamp.fromMillis(Date.now()),
    updatedAt: Timestamp.fromMillis(Date.now()),
  };
}

function makeRecurring(id: string, name: string): RecurringItem {
  return {
    id,
    householdId: 'h1',
    name,
    normalizedName: name.toLowerCase(),
    quantity: 1,
    unit: ItemUnit.PIECES,
    category: ItemCategory.OTHER,
    note: '',
    intervalDays: 7,
    enabled: true,
    nextDueAt: Timestamp.fromMillis(Date.now()),
    lastCompletedAt: null,
    createdAt: Timestamp.fromMillis(Date.now()),
    updatedAt: Timestamp.fromMillis(Date.now()),
  };
}

beforeEach(() => {
  mockFirestoreUpdateItem.mockClear();
  mockFirestoreLogActivity.mockClear();
  mockUpdateNextDueDate.mockClear();
});

describe('shoppingRepository.markAsBought', () => {
  it('advances recurring schedule for a matching item', async () => {
    const item = makeItem('item1', 'חלב');
    const recurring = makeRecurring('rec1', 'חלב');

    await shoppingRepository.markAsBought('h1', 'item1', [item], [recurring]);

    expect(mockUpdateNextDueDate).toHaveBeenCalledTimes(1);
    expect(mockUpdateNextDueDate).toHaveBeenCalledWith(
      'h1',
      recurring,
      expect.any(Number),
    );
  });

  it('does not update recurring for non-matching item', async () => {
    const item = makeItem('item1', 'חלב');
    const recurring = makeRecurring('rec1', 'לחם');

    await shoppingRepository.markAsBought('h1', 'item1', [item], [recurring]);

    expect(mockUpdateNextDueDate).not.toHaveBeenCalled();
  });

  it('works without recurring items', async () => {
    const item = makeItem('item1', 'חלב');

    await shoppingRepository.markAsBought('h1', 'item1', [item]);

    expect(mockUpdateNextDueDate).not.toHaveBeenCalled();
    expect(mockFirestoreUpdateItem).toHaveBeenCalled();
  });
});
