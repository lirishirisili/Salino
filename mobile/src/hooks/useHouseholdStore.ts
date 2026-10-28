import { create } from 'zustand';
import { Timestamp } from 'firebase/firestore';
import { Household, HouseholdMember } from '../models';
import { householdRepository } from '../repositories';
import { useShoppingStore } from './useShoppingStore';
import { rememberSessionHousehold } from '../session/sessionRestore';
import { isExpired } from '../utils/householdExpiry';
import { Unsubscribe } from 'firebase/firestore';
import { router } from 'expo-router';

function syncHouseholdSession(householdId: string | null): void {
  void rememberSessionHousehold(householdId);
  try {
    // Lazy import avoids a cycle with useAuthStore → useHouseholdStore.
    const { useAuthStore } = require('./useAuthStore') as typeof import('./useAuthStore');
    useAuthStore.getState().markHouseholdResolution(
      householdId ? 'has_household' : 'no_household'
    );
    // Keep the cached profile in step too: routing reads its activeHouseholdId.
    useAuthStore.setState((s) => ({
      lastHouseholdId: householdId,
      profile: s.profile ? { ...s.profile, activeHouseholdId: householdId } : s.profile,
    }));
  } catch {
    // Auth store may not be initialized yet during first import.
  }
}

function upsertHousehold(list: Household[], h: Household): Household[] {
  const idx = list.findIndex((x) => x.id === h.id);
  if (idx < 0) return [...list, h];
  const next = [...list];
  next[idx] = h;
  return next;
}

interface HouseholdState {
  household: Household | null;
  members: HouseholdMember[];
  activeHouseholdId: string | null;
  /** Every home the user belongs to (home switcher). */
  myHouseholds: Household[];
  isLoading: boolean;
  error: string | null;

  /** Authoritative household id from Firestore profile — never trust stale memory. */
  setActiveHouseholdFromProfile: (householdId: string) => Promise<void>;
  reset: () => void;
  createHousehold: (name: string, expiresAt?: Timestamp) => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  subscribe: (householdId: string) => () => void;
  updateHouseholdName: (name: string) => Promise<void>;
  /** Moves the active temporary home's end date (owner only, checked by the UI). */
  extendHousehold: (expiresAt: Timestamp) => Promise<void>;
  /** Leaves the active home; resolves to the home now active, or null (→ household setup). */
  leaveHousehold: () => Promise<string | null>;
  loadMyHouseholds: () => Promise<void>;
  switchHousehold: (householdId: string) => Promise<void>;
  clearError: () => void;
}

export const useHouseholdStore = create<HouseholdState>((set, get) => {
  const activate = (householdId: string, household: Household | null) => {
    set({ household, members: [], activeHouseholdId: householdId });
    syncHouseholdSession(householdId);
    void useShoppingStore.getState().preloadFromCache(householdId);
  };

  /** The active home was deleted on the server (ended trip past its grace window). */
  const handleActiveHouseholdMissing = async (householdId: string) => {
    if (get().activeHouseholdId !== householdId) return;
    const others = get().myHouseholds.filter((h) => h.id !== householdId);
    const next = others.find((h) => !isExpired(h)) ?? others[0] ?? null;
    await householdRepository.forgetHousehold(householdId, next?.id ?? null).catch(() => undefined);
    set({ myHouseholds: others });
    if (next) {
      activate(next.id, next);
    } else {
      // No home left: same as leaving the last home. The route guard never pulls
      // users off main screens, so navigate explicitly.
      set({ household: null, members: [], activeHouseholdId: null });
      syncHouseholdSession(null);
      try {
        router.replace('/household-setup');
      } catch {
        // Navigation not ready; the next launch routes to setup.
      }
    }
  };

  return {
    household: null,
    members: [],
    activeHouseholdId: null,
    myHouseholds: [],
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
        myHouseholds: [],
        isLoading: false,
        error: null,
      });
    },

    createHousehold: async (name: string, expiresAt?: Timestamp) => {
      set({ isLoading: true, error: null });
      try {
        const household = await householdRepository.createHousehold(name, { expiresAt });
        set({
          household,
          members: [],
          activeHouseholdId: household.id,
          myHouseholds: upsertHousehold(get().myHouseholds, household),
          isLoading: false,
        });
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
        set({
          household,
          members: [],
          activeHouseholdId: household.id,
          myHouseholds: upsertHousehold(get().myHouseholds, household),
          isLoading: false,
        });
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
        householdRepository.subscribeToHousehold(
          householdId,
          (h) => {
            if (get().activeHouseholdId !== householdId) return;
            set({ household: h, myHouseholds: upsertHousehold(get().myHouseholds, h) });
          },
          undefined,
          () => {
            void handleActiveHouseholdMissing(householdId);
          }
        )
      );

      unsubs.push(
        householdRepository.subscribeToMembers(householdId, (m) => {
          if (get().activeHouseholdId !== householdId) return;
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

    extendHousehold: async (expiresAt: Timestamp) => {
      const { activeHouseholdId, household } = get();
      if (!activeHouseholdId) return;
      await householdRepository.extendHousehold(activeHouseholdId, expiresAt);
      // Optimistic: unlock the list right away; the snapshot listener confirms it.
      if (household?.id === activeHouseholdId) {
        const updated = { ...household, expiresAt, reminderSentAt: null, expiredNotifiedAt: null };
        set({ household: updated, myHouseholds: upsertHousehold(get().myHouseholds, updated) });
      }
    },

    leaveHousehold: async () => {
      const { activeHouseholdId, myHouseholds } = get();
      if (!activeHouseholdId) return null;
      const nextId = await householdRepository.leaveHousehold(activeHouseholdId, myHouseholds);
      const others = myHouseholds.filter((h) => h.id !== activeHouseholdId);
      set({ myHouseholds: others });
      if (nextId) {
        activate(nextId, others.find((h) => h.id === nextId) ?? null);
      } else {
        set({ household: null, members: [], activeHouseholdId: null });
        syncHouseholdSession(null);
      }
      return nextId;
    },

    loadMyHouseholds: async () => {
      if (get().myHouseholds.length === 0) {
        const cached = await householdRepository.getCachedMyHouseholds().catch(() => []);
        if (cached.length > 0 && get().myHouseholds.length === 0) set({ myHouseholds: cached });
      }
      try {
        const list = await householdRepository.listMyHouseholds();
        set({ myHouseholds: list });
      } catch {
        // Offline: keep the cached list.
      }
    },

    switchHousehold: async (householdId: string) => {
      if (get().activeHouseholdId === householdId) return;
      const target = get().myHouseholds.find((h) => h.id === householdId) ?? null;
      await householdRepository.switchHousehold(householdId);
      activate(householdId, target);
    },

    clearError: () => set({ error: null }),
  };
});
