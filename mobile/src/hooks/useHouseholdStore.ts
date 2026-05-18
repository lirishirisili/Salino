import { create } from 'zustand';
import { Household, HouseholdMember } from '../models';
import { householdRepository } from '../repositories';
import { useShoppingStore } from './useShoppingStore';
import { Unsubscribe } from 'firebase/firestore';

interface HouseholdState {
  household: Household | null;
  members: HouseholdMember[];
  activeHouseholdId: string | null;
  isLoading: boolean;
  error: string | null;

  /** Authoritative household id from Firestore profile — never trust stale memory. */
  setActiveHouseholdFromProfile: (householdId: string) => Promise<void>;
  reset: () => void;
  createHousehold: (name: string) => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  subscribe: (householdId: string) => () => void;
  updateHouseholdName: (name: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  clearError: () => void;
}

export const useHouseholdStore = create<HouseholdState>((set, get) => ({
  household: null,
  members: [],
  activeHouseholdId: null,
  isLoading: false,
  error: null,

  setActiveHouseholdFromProfile: async (householdId: string) => {
    set({ activeHouseholdId: householdId, household: null, members: [] });
    await useShoppingStore.getState().preloadFromCache(householdId);
  },

  reset: () => {
    set({
      household: null,
      members: [],
      activeHouseholdId: null,
      isLoading: false,
      error: null,
    });
  },

  createHousehold: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const household = await householdRepository.createHousehold(name);
      set({ household, activeHouseholdId: household.id, isLoading: false });
      void useShoppingStore.getState().preloadFromCache(household.id);
    } catch (e: any) {
      set({ error: 'household_error_generic', isLoading: false });
    }
  },

  joinHousehold: async (inviteCode: string) => {
    set({ isLoading: true, error: null });
    try {
      const household = await householdRepository.joinHousehold(inviteCode);
      set({ household, activeHouseholdId: household.id, isLoading: false });
      void useShoppingStore.getState().preloadFromCache(household.id);
    } catch (e: any) {
      const errorKey = e.message === 'INVALID_CODE' ? 'household_error_invalid_code' : 'household_error_generic';
      set({ error: errorKey, isLoading: false });
    }
  },

  subscribe: (householdId: string) => {
    const unsubs: Unsubscribe[] = [];

    unsubs.push(
      householdRepository.subscribeToHousehold(householdId, (h) => {
        set({ household: h });
      })
    );

    unsubs.push(
      householdRepository.subscribeToMembers(householdId, (m) => {
        set({ members: m });
      })
    );

    return () => unsubs.forEach((u) => u());
  },

  updateHouseholdName: async (name: string) => {
    const { activeHouseholdId } = get();
    if (!activeHouseholdId) return;
    await householdRepository.updateHouseholdName(activeHouseholdId, name);
  },

  leaveHousehold: async () => {
    const { activeHouseholdId } = get();
    if (!activeHouseholdId) return;
    await householdRepository.leaveHousehold(activeHouseholdId);
    set({ household: null, members: [], activeHouseholdId: null });
  },

  clearError: () => set({ error: null }),
}));
