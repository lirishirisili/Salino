import { create } from 'zustand';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../models/types';
import { auth } from '../remote/firebase';
import {
  firestoreGetUser,
  firestoreSetHouseholdMuted,
  firestoreUpdateNotificationPrefs,
} from '../remote/firestoreService';

interface NotificationState {
  preferences: NotificationPreferences;
  /** Homes whose pushes are muted (server skips them, except trip-home notices). */
  mutedHouseholdIds: string[];
  permissionGranted: boolean;
  isLoaded: boolean;

  loadPreferences: () => Promise<void>;
  setPreference: (
    key: keyof NotificationPreferences,
    value: boolean
  ) => Promise<void>;
  setHouseholdMuted: (householdId: string, muted: boolean) => Promise<void>;
  setPermissionGranted: (granted: boolean) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  mutedHouseholdIds: [],
  permissionGranted: false,
  isLoaded: false,

  loadPreferences: async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const user = (await firestoreGetUser(uid)) as
        | {
            notificationPreferences?: Partial<NotificationPreferences>;
            mutedHouseholdIds?: unknown;
          }
        | null;
      const preferences: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(user?.notificationPreferences ?? {}),
      };
      const muted = Array.isArray(user?.mutedHouseholdIds)
        ? (user!.mutedHouseholdIds as unknown[]).filter((id): id is string => typeof id === 'string')
        : [];
      set({ preferences, mutedHouseholdIds: muted, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  setPreference: async (key, value) => {
    const previous = get().preferences;
    const next = { ...previous, [key]: value };
    set({ preferences: next });

    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await firestoreUpdateNotificationPrefs(uid, { [key]: value });
    } catch {
      // Revert optimistic update on failure.
      set({ preferences: previous });
    }
  },

  setHouseholdMuted: async (householdId, muted) => {
    const previous = get().mutedHouseholdIds;
    set({
      mutedHouseholdIds: muted
        ? [...previous.filter((id) => id !== householdId), householdId]
        : previous.filter((id) => id !== householdId),
    });
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await firestoreSetHouseholdMuted(uid, householdId, muted);
    } catch {
      set({ mutedHouseholdIds: previous });
    }
  },

  setPermissionGranted: (granted) => set({ permissionGranted: granted }),

  reset: () =>
    set({
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      mutedHouseholdIds: [],
      permissionGranted: false,
      isLoaded: false,
    }),
}));
