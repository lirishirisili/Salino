const store = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
    multiRemove: jest.fn(async (keys: string[]) => {
      keys.forEach((key) => store.delete(key));
    }),
  },
}));

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

import { localClearAll } from '../storage';
import { SESSION_RESTORE_KEY } from '../../session/sessionRestore';

describe('localClearAll session preserve', () => {
  beforeEach(() => {
    store.clear();
  });

  it('keeps @session_restore so a mistaken wipe can recover the house', async () => {
    store.set(SESSION_RESTORE_KEY, JSON.stringify({ uid: 'u1', householdId: 'h1' }));
    store.set('@items_h1', '[]');
    store.set('@active_household_u1', 'h1');
    await localClearAll();
    expect(store.has(SESSION_RESTORE_KEY)).toBe(true);
    expect(store.has('@items_h1')).toBe(false);
    expect(store.has('@active_household_u1')).toBe(false);
  });
});
