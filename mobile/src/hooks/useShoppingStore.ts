import { create } from 'zustand';
import { ShoppingItem, RecurringItem, SuggestionItem } from '../models';
import { shoppingRepository, recurringRepository } from '../repositories';
import { localGetRecurring } from '../local/storage';
import { buildShoppingListState } from './shoppingListState';
import { perfMark } from '../utils/perf';
import { Unsubscribe } from 'firebase/firestore';

/**
 * Tracks which household's cache has already been hydrated into the store so a
 * boot-time `preloadFromCache` and the follow-up `subscribe` do not both hit
 * AsyncStorage for the same household.
 */
let cacheHydratedHouseholdId: string | null = null;

interface ShoppingListState {
  items: ShoppingItem[];
  activeItems: ShoppingItem[];
  boughtItems: ShoppingItem[];
  suggestions: SuggestionItem[];
  recurringItems: RecurringItem[];
  searchQuery: string;
  selectedCategory: string | null;
  /** True until first Firestore snapshot (or error) for the current household. */
  hasReceivedRemoteSnapshot: boolean;
  isLoading: boolean;
  subscribedHouseholdId: string | null;

  preloadFromCache: (householdId: string) => Promise<void>;
  subscribe: (householdId: string) => () => void;
  addItem: (householdId: string, item: Parameters<typeof shoppingRepository.addItem>[1]) => Promise<ShoppingItem>;
  updateItem: (householdId: string, item: ShoppingItem) => Promise<void>;
  markAsBought: (householdId: string, itemId: string) => Promise<void>;
  markAsActive: (householdId: string, itemId: string) => Promise<void>;
  deleteItem: (householdId: string, itemId: string, itemName: string) => Promise<void>;
  toggleFavorite: (householdId: string, item: ShoppingItem) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  reset: () => void;
}

async function readCachedList(householdId: string) {
  perfMark('cache_read_start');
  const [items, recurringItems] = await Promise.all([
    shoppingRepository.getLocalItems(householdId),
    localGetRecurring(householdId),
  ]);
  perfMark('cache_read_done', { overwrite: true });
  return { items, recurringItems };
}

export const useShoppingStore = create<ShoppingListState>((set, get) => ({
  items: [],
  activeItems: [],
  boughtItems: [],
  suggestions: [],
  recurringItems: [],
  searchQuery: '',
  selectedCategory: null,
  hasReceivedRemoteSnapshot: false,
  isLoading: true,
  subscribedHouseholdId: null,

  preloadFromCache: async (householdId: string) => {
    try {
      const { items, recurringItems } = await readCachedList(householdId);
      // Mark this household's cache as hydrated so subscribe() won't re-read it.
      cacheHydratedHouseholdId = householdId;
      if (items.length === 0) {
        // Mark household so subscribe() won't treat it as a switch
        set({ subscribedHouseholdId: householdId, isLoading: false });
        return;
      }
      set({
        subscribedHouseholdId: householdId,
        ...buildShoppingListState(items, recurringItems),
        isLoading: false,
      });
      perfMark('cache_committed');
    } catch {
      // Still mark household even on error
      set({ subscribedHouseholdId: householdId, isLoading: false });
    }
  },

  subscribe: (householdId: string) => {
    const switchingHousehold = get().subscribedHouseholdId !== householdId;

    if (switchingHousehold) {
      // A genuine household switch invalidates any previously hydrated cache.
      cacheHydratedHouseholdId = null;
      set({
        subscribedHouseholdId: householdId,
        hasReceivedRemoteSnapshot: false,
        isLoading: true,
        items: [],
        activeItems: [],
        boughtItems: [],
        suggestions: [],
        recurringItems: [],
        searchQuery: get().searchQuery,
        selectedCategory: get().selectedCategory,
      });
    } else {
      // Same household — keep existing items visible, don't show spinner
      set({
        subscribedHouseholdId: householdId,
        hasReceivedRemoteSnapshot: false,
        isLoading: false,
      });
    }

    let cancelled = false;

    const applyRemote = (items: ShoppingItem[]) => {
      if (cancelled || get().subscribedHouseholdId !== householdId) return;
      perfMark('first_remote_snapshot');
      const recurringItems = get().recurringItems;
      set({
        ...buildShoppingListState(items, recurringItems),
        isLoading: false,
        hasReceivedRemoteSnapshot: true,
      });
      perfMark('reconcile_done', { overwrite: true });
    };

    // Only read cache if we don't already have items for this household and the
    // boot-time preload didn't already hydrate it (avoids a duplicate read).
    const needsCacheRead =
      cacheHydratedHouseholdId !== householdId &&
      (switchingHousehold || get().items.length === 0);
    if (needsCacheRead) {
      void (async () => {
        try {
          const { items, recurringItems } = await readCachedList(householdId);
          cacheHydratedHouseholdId = householdId;
          if (cancelled || get().subscribedHouseholdId !== householdId) return;
          if (items.length > 0) {
            set({
              ...buildShoppingListState(items, recurringItems),
              isLoading: false,
            });
            perfMark('cache_committed');
          }
        } catch {
          // Firestore will follow.
        }
      })();
    }

    const unsubs: Unsubscribe[] = [];

    unsubs.push(
      shoppingRepository.subscribeToItems(
        householdId,
        applyRemote,
        () => {
          if (cancelled || get().subscribedHouseholdId !== householdId) return;
          set({ isLoading: false, hasReceivedRemoteSnapshot: true });
        }
      )
    );

    unsubs.push(
      recurringRepository.subscribeToRecurringItems(householdId, (recurringItems) => {
        if (cancelled || get().subscribedHouseholdId !== householdId) return;
        const { items } = get();
        set({
          recurringItems,
          ...buildShoppingListState(items, recurringItems),
        });
      })
    );

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  },

  addItem: async (householdId, item) => {
    const newItem = await shoppingRepository.addItem(householdId, item);
    // Optimistic: add to Zustand immediately so the UI reflects before snapshot.
    const { items, recurringItems } = get();
    set(buildShoppingListState([newItem, ...items], recurringItems));
    return newItem;
  },

  updateItem: async (householdId, item) => {
    await shoppingRepository.updateItem(householdId, item);
    // Optimistic: replace the item in the store.
    const { items, recurringItems } = get();
    const updated = items.map((i) => (i.id === item.id ? item : i));
    set(buildShoppingListState(updated, recurringItems));
  },

  markAsBought: async (householdId, itemId) => {
    const { items, recurringItems } = get();
    await shoppingRepository.markAsBought(householdId, itemId, items, recurringItems);
    // Optimistic: move item to bought in the store.
    const updated = items.map((i) =>
      i.id === itemId ? { ...i, status: 'BOUGHT' as ShoppingItem['status'] } : i,
    );
    set(buildShoppingListState(updated, recurringItems));
  },

  markAsActive: async (householdId, itemId) => {
    const { items, recurringItems } = get();
    await shoppingRepository.markAsActive(householdId, itemId, items);
    // Optimistic: move item back to active.
    const updated = items.map((i) =>
      i.id === itemId ? { ...i, status: 'ACTIVE' as ShoppingItem['status'], boughtBy: null, boughtByName: null } : i,
    );
    set(buildShoppingListState(updated, recurringItems));
  },

  deleteItem: async (householdId, itemId, itemName) => {
    await shoppingRepository.deleteItem(householdId, itemId, itemName);
    // Optimistic: remove from store.
    const { items, recurringItems } = get();
    set(buildShoppingListState(items.filter((i) => i.id !== itemId), recurringItems));
  },

  toggleFavorite: async (householdId, item) => {
    await shoppingRepository.toggleFavorite(householdId, item);
    // Optimistic: toggle favorite.
    const { items, recurringItems } = get();
    const updated = items.map((i) =>
      i.id === item.id ? { ...i, isFavorite: !i.isFavorite } : i,
    );
    set(buildShoppingListState(updated, recurringItems));
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),

  reset: () => {
    cacheHydratedHouseholdId = null;
    set({
      items: [],
      activeItems: [],
      boughtItems: [],
      suggestions: [],
      recurringItems: [],
      searchQuery: '',
      selectedCategory: null,
      hasReceivedRemoteSnapshot: false,
      isLoading: true,
      subscribedHouseholdId: null,
    });
  },
}));
