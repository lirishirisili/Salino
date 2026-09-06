import { create } from 'zustand';
import { Household, HouseholdMember } from '../models';
import { householdRepository } from '../repositories';
import { useShoppingStore } from './useShoppingStore';
import { rememberSessionHousehold } from '../session/sessionRestore';
import { Unsubscribe } from 'firebase/firestore';

function syncHouseholdSession(householdId: string | null): void {
  void rememberSessionHousehold(householdId);
  try {
    // Lazy import avoids a cycle with useAuthStore → useHouseholdStore.
    const { useAuthStore } = require('./useAuthStore') as typeof import('./useAuthStore');
    useAuthStore.getState().markHouseholdResolution(
      householdId ? 'has_household' : 'no_household'
    );
    useAuthStore.setState({ lastHouseholdId: householdId });
  } catch {
    // Auth store may not be initialized yet during first import.
  }
}

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
    syncHouseholdSession(householdId);
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
      syncHouseholdSession(household.id);
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
      syncHouseholdSession(household.id);
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
    syncHouseholdSession(null);
  },

  clearError: () => set({ error: null }),
}));
