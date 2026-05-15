import { localClearAll } from '../local/storage';
import { useHouseholdStore } from '../hooks/useHouseholdStore';
import { useShoppingStore } from '../hooks/useShoppingStore';
import { useActivityStore } from '../hooks/useActivityStore';

/** Wipes in-memory stores and all @-prefixed AsyncStorage (per-user household cache). */
export async function resetSessionState(): Promise<void> {
  useHouseholdStore.getState().reset();
  useShoppingStore.getState().reset();
  useActivityStore.getState().reset();
  await localClearAll();
}
