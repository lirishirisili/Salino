import { create } from 'zustand';
import { ActivityLog } from '../models';
import { activityRepository } from '../repositories';
import { localGetActivity } from '../local/storage';
import { Unsubscribe } from 'firebase/firestore';

interface ActivityState {
  logs: ActivityLog[];
  isLoading: boolean;

  subscribe: (householdId: string) => () => void;
  reset: () => void;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  logs: [],
  isLoading: true,

  subscribe: (householdId: string) => {
    let cancelled = false;

    // Show cached activity immediately; the remote listener reconciles after.
    if (get().logs.length === 0) {
      void localGetActivity(householdId)
        .then((cached) => {
          if (cancelled || cached.length === 0) return;
          if (get().logs.length === 0) {
            set({ logs: cached, isLoading: false });
          }
        })
        .catch(() => {});
    }

    const unsub: Unsubscribe = activityRepository.subscribeToActivity(
      householdId,
      (logs) => {
        if (cancelled) return;
        set({ logs, isLoading: false });
      }
    );
    return () => {
      cancelled = true;
      unsub();
    };
  },

  reset: () => set({ logs: [], isLoading: true }),
}));
