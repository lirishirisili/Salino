import { create } from 'zustand';
import { ShoppingItem, RecurringItem, SuggestionItem } from '../models';
import { shoppingRepository, recurringRepository } from '../repositories';
import { localGetRecurring } from '../local/storage';
import { buildShoppingListState } from './shoppingListState';
import { Unsubscribe } from 'firebase/firestore';

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
  const [items, recurringItems] = await Promise.all([
    shoppingRepository.getLocalItems(householdId),
    localGetRecurring(householdId),
  ]);
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
    } catch {
      // Still mark household even on error
      set({ subscribedHouseholdId: householdId, isLoading: false });
    }
  },

  subscribe: (householdId: string) => {
    const switchingHousehold = get().subscribedHouseholdId !== householdId;

    if (switchingHousehold) {
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
      const recurringItems = get().recurringItems;
      set({
        ...buildShoppingListState(items, recurringItems),
        isLoading: false,
        hasReceivedRemoteSnapshot: true,
      });
    };

    // Only read cache if we don't already have items for this household
    if (switchingHousehold || get().items.length === 0) {
      void (async () => {
        try {
          const { items, recurringItems } = await readCachedList(householdId);
          if (cancelled || get().subscribedHouseholdId !== householdId) return;
          if (items.length > 0) {
            set({
              ...buildShoppingListState(items, recurringItems),
              isLoading: false,
            });
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
    return shoppingRepository.addItem(householdId, item);
  },

  updateItem: async (householdId, item) => {
    await shoppingRepository.updateItem(householdId, item);
  },

  markAsBought: async (householdId, itemId) => {
    const { items } = get();
    await shoppingRepository.markAsBought(householdId, itemId, items);
  },

  markAsActive: async (householdId, itemId) => {
    const { items } = get();
    await shoppingRepository.markAsActive(householdId, itemId, items);
  },

  deleteItem: async (householdId, itemId, itemName) => {
    await shoppingRepository.deleteItem(householdId, itemId, itemName);
  },

  toggleFavorite: async (householdId, item) => {
    await shoppingRepository.toggleFavorite(householdId, item);
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),

  reset: () =>
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
    }),
}));
