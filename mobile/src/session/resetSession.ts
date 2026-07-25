import { localClearAll } from '../local/storage';
import { useHouseholdStore } from '../hooks/useHouseholdStore';
import { useShoppingStore } from '../hooks/useShoppingStore';
import { useActivityStore } from '../hooks/useActivityStore';
import { useNotificationStore } from '../hooks/useNotificationStore';
import { useTourStore } from '../features/tour';

/** Wipes in-memory stores and all @-prefixed AsyncStorage (per-user household cache). */
export async function resetSessionState(): Promise<void> {
  useHouseholdStore.getState().reset();
  useShoppingStore.getState().reset();
  useActivityStore.getState().reset();
  useNotificationStore.getState().reset();
  // Clear tour UI + re-open the post-login bootstrap gate for the next session.
  useTourStore.setState({
    active: false,
    stepIndex: 0,
    replayRequested: false,
    activeAnchorId: null,
    overlay: null,
    bootstrapStatus: 'pending',
  });
  await localClearAll();
}
