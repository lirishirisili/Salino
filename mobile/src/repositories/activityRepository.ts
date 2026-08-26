import { ActivityLog } from '../models';
import { subscribeToActivity } from '../remote/firestoreService';
import { localSetActivity } from '../local/storage';

function activitySignature(logs: ActivityLog[]): string {
  const firstId = logs.length > 0 ? logs[0].id : '';
  const lastId = logs.length > 0 ? logs[logs.length - 1].id : '';
  return `${logs.length}:${firstId}:${lastId}`;
}

const lastPersistedSignature = new Map<string, string>();

export const activityRepository = {
  subscribeToActivity: (
    householdId: string,
    onData: (logs: ActivityLog[]) => void,
    onError?: (e: Error) => void
  ) => {
    return subscribeToActivity(
      householdId,
      (logs) => {
        const signature = activitySignature(logs);
        if (lastPersistedSignature.get(householdId) !== signature) {
          lastPersistedSignature.set(householdId, signature);
          localSetActivity(householdId, logs).catch(() => {});
        }
        onData(logs);
      },
      onError
    );
  },
};
