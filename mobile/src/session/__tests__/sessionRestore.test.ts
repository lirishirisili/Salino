jest.mock('../../remote/firebase', () => ({
  auth: { currentUser: { uid: 'u1' } },
}));

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
  },
}));

import {
  __resetSessionRestoreForTests,
  beginExplicitSignOut,
  clearSessionSnapshot,
  endExplicitSignOut,
  getSessionSnapshotSync,
  isExplicitSignOut,
  loadSessionSnapshot,
  persistSessionSnapshot,
  recoverSnapshotFromHouseholdCache,
  rememberSessionHousehold,
  rememberSessionUser,
  SESSION_RESTORE_KEY,
} from '../sessionRestore';

describe('sessionRestore', () => {
  beforeEach(() => {
    store.clear();
    __resetSessionRestoreForTests();
  });

  it('round-trips a snapshot through AsyncStorage', async () => {
    await persistSessionSnapshot({ uid: 'u1', householdId: 'h1', updatedAt: 1 });
    __resetSessionRestoreForTests();
    const loaded = await loadSessionSnapshot();
    expect(loaded).toEqual({ uid: 'u1', householdId: 'h1', updatedAt: 1 });
    expect(store.get(SESSION_RESTORE_KEY)).toContain('h1');
  });

  it('keeps the household when remembering the same uid', async () => {
    await persistSessionSnapshot({ uid: 'u1', householdId: 'h1', updatedAt: 1 });
    await rememberSessionUser('u1');
    expect(getSessionSnapshotSync()?.householdId).toBe('h1');
  });

  it('clears the household when the uid changes', async () => {
    await persistSessionSnapshot({ uid: 'u1', householdId: 'h1', updatedAt: 1 });
    await rememberSessionUser('u2');
    expect(getSessionSnapshotSync()).toMatchObject({ uid: 'u2', householdId: null });
  });

  it('updates household on the current snapshot', async () => {
    await rememberSessionUser('u1');
    await rememberSessionHousehold('house-9');
    expect(getSessionSnapshotSync()?.householdId).toBe('house-9');
  });

  it('rebuilds a snapshot from the per-user household cache', async () => {
    store.set('@active_household_user-42', 'house-42');
    const recovered = await recoverSnapshotFromHouseholdCache();
    expect(recovered).toMatchObject({ uid: 'user-42', householdId: 'house-42' });
  });

  it('loadSessionSnapshot recovers from household cache when restore key is missing', async () => {
    store.set('@active_household_user-7', 'house-7');
    const loaded = await loadSessionSnapshot();
    expect(loaded).toMatchObject({ uid: 'user-7', householdId: 'house-7' });
    expect(store.get(SESSION_RESTORE_KEY)).toContain('house-7');
  });

  it('tracks explicit sign-out separately from persistence', async () => {
    expect(isExplicitSignOut()).toBe(false);
    beginExplicitSignOut();
    expect(isExplicitSignOut()).toBe(true);
    await clearSessionSnapshot();
    expect(getSessionSnapshotSync()).toBeNull();
    endExplicitSignOut();
    expect(isExplicitSignOut()).toBe(false);
  });
});
