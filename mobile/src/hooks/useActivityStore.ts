import { create } from 'zustand';
import { ActivityLog } from '../models';
import { activityRepository } from '../repositories';
import { Unsubscribe } from 'firebase/firestore';

interface ActivityState {
  logs: ActivityLog[];
  isLoading: boolean;

  subscribe: (householdId: string) => () => void;
  reset: () => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  logs: [],
  isLoading: true,

  subscribe: (householdId: string) => {
    const unsub: Unsubscribe = activityRepository.subscribeToActivity(
      householdId,
      (logs) => {
        set({ logs, isLoading: false });
      }
    );
    return () => unsub();
  },

  reset: () => set({ logs: [], isLoading: true }),
}));
