import { ActivityLog } from '../models';
import { subscribeToActivity } from '../remote/firestoreService';
import { localSetActivity } from '../local/storage';

export const activityRepository = {
  subscribeToActivity: (
    householdId: string,
    onData: (logs: ActivityLog[]) => void,
    onError?: (e: Error) => void
  ) => {
    return subscribeToActivity(
      householdId,
      (logs) => {
        localSetActivity(householdId, logs);
        onData(logs);
      },
      onError
    );
  },
};
