import { create } from 'zustand';
import { Household, HouseholdMember } from '../models';
import { householdRepository } from '../repositories';
import { localGetActiveHouseholdId } from '../local/storage';
import { Unsubscribe } from 'firebase/firestore';

interface HouseholdState {
  household: Household | null;
  members: HouseholdMember[];
  activeHouseholdId: string | null;
  isLoading: boolean;
  error: string | null;

  loadActiveHousehold: () => Promise<void>;
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

  loadActiveHousehold: async () => {
    const id = await localGetActiveHouseholdId();
    if (id) {
      set({ activeHouseholdId: id });
    }
  },

  createHousehold: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const household = await householdRepository.createHousehold(name);
      set({ household, activeHouseholdId: household.id, isLoading: false });
    } catch (e: any) {
      set({ error: 'household_error_generic', isLoading: false });
    }
  },

  joinHousehold: async (inviteCode: string) => {
    set({ isLoading: true, error: null });
    try {
      const household = await householdRepository.joinHousehold(inviteCode);
      set({ household, activeHouseholdId: household.id, isLoading: false });
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
