import { create } from 'zustand';
import { ShoppingItem, ItemStatus, SuggestionItem, RecurringItem } from '../models';
import { shoppingRepository, recurringRepository } from '../repositories';
import { buildSuggestions } from '../services/suggestionEngine';
import { Unsubscribe } from 'firebase/firestore';

interface ShoppingListState {
  items: ShoppingItem[];
  activeItems: ShoppingItem[];
  boughtItems: ShoppingItem[];
  suggestions: SuggestionItem[];
  recurringItems: RecurringItem[];
  searchQuery: string;
  selectedCategory: string | null;
  isLoading: boolean;

  subscribe: (householdId: string) => () => void;
  addItem: (householdId: string, item: Parameters<typeof shoppingRepository.addItem>[1]) => Promise<ShoppingItem>;
  updateItem: (householdId: string, item: ShoppingItem) => Promise<void>;
  markAsBought: (householdId: string, itemId: string) => Promise<void>;
  markAsActive: (householdId: string, itemId: string) => Promise<void>;
  deleteItem: (householdId: string, itemId: string, itemName: string) => Promise<void>;
  toggleFavorite: (householdId: string, item: ShoppingItem) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
}

export const useShoppingStore = create<ShoppingListState>((set, get) => ({
  items: [],
  activeItems: [],
  boughtItems: [],
  suggestions: [],
  recurringItems: [],
  searchQuery: '',
  selectedCategory: null,
  isLoading: true,

  subscribe: (householdId: string) => {
    const unsubs: Unsubscribe[] = [];

    unsubs.push(
      shoppingRepository.subscribeToItems(householdId, (items) => {
        const activeItems = items.filter((i) => i.status === ItemStatus.ACTIVE);
        const boughtItems = items.filter((i) => i.status === ItemStatus.BOUGHT);
        const { recurringItems } = get();
        const suggestions = buildSuggestions(activeItems, boughtItems, recurringItems);
        set({ items, activeItems, boughtItems, suggestions, isLoading: false });
      })
    );

    unsubs.push(
      recurringRepository.subscribeToRecurringItems(householdId, (recurringItems) => {
        const { activeItems, boughtItems } = get();
        const suggestions = buildSuggestions(activeItems, boughtItems, recurringItems);
        set({ recurringItems, suggestions });
      })
    );

    return () => unsubs.forEach((u) => u());
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
}));
