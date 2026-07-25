import { create } from 'zustand';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../models/types';
import { auth } from '../remote/firebase';
import {
  firestoreGetUser,
  firestoreUpdateNotificationPrefs,
} from '../remote/firestoreService';

interface NotificationState {
  preferences: NotificationPreferences;
  permissionGranted: boolean;
  isLoaded: boolean;

  loadPreferences: () => Promise<void>;
  setPreference: (
    key: keyof NotificationPreferences,
    value: boolean
  ) => Promise<void>;
  setPermissionGranted: (granted: boolean) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  permissionGranted: false,
  isLoaded: false,

  loadPreferences: async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const user = (await firestoreGetUser(uid)) as
        | { notificationPreferences?: Partial<NotificationPreferences> }
        | null;
      const preferences: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(user?.notificationPreferences ?? {}),
      };
      set({ preferences, isLoaded: true });
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

  setPermissionGranted: (granted) => set({ permissionGranted: granted }),

  reset: () =>
    set({
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      permissionGranted: false,
      isLoaded: false,
    }),
}));
