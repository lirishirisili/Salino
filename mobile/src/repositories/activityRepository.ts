import { ActivityLog } from '../models';
import { subscribeToActivity } from '../remote/firestoreService';
import { mergeRemoteActivity } from '../local/storage';
import { flush } from '../services/syncQueueProcessor';

function runBackground(work: Promise<unknown>): void {
  work.catch(() => {});
}

export const activityRepository = {
  subscribeToActivity: (
    householdId: string,
    onData: (logs: ActivityLog[]) => void,
    onError?: (e: Error) => void
  ) => {
    return subscribeToActivity(
      householdId,
      (remoteLogs) => {
        // Protected merge — keep pending local activity writes intact.
        runBackground(mergeRemoteActivity(householdId, remoteLogs));
        runBackground(flush(householdId));
        onData(remoteLogs);
      },
      onError
    );
  },
};
