import {
  localGetPendingOps,
  localAddPendingOp,
  localRemovePendingOp,
  localGetItems,
  localGetActivity,
  localGetRecurring,
  localUpsertItemAndEnqueue,
  type PendingSyncOperation,
} from '../local/storage';
import type { ShoppingItem } from '../models';
import {
  firestoreAddItem,
  firestoreUpdateItem,
  firestoreDeleteItem,
  firestoreLogActivity,
  firestoreUpsertRecurring,
  firestoreDeleteRecurring,
} from '../remote/firestoreService';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Offline-first sync queue — mirrors native `SyncQueueProcessor.kt`.
 *
 * Depends only on storage + firestoreService to avoid circular imports
 * with repositories.
 */

export async function enqueueUpsert(
  householdId: string,
  targetType: PendingSyncOperation['targetType'],
  targetId: string,
): Promise<void> {
  await localAddPendingOp({
    id: generateId(),
    householdId,
    targetType,
    operationType: 'UPSERT',
    targetId,
    createdAtMillis: Date.now(),
  });
}

/**
 * Saves an item locally and queues its upload as one atomic step (see
 * `localUpsertItemAndEnqueue`). Use this instead of localUpsertItem + enqueueUpsert.
 */
export async function upsertItemAndEnqueue(householdId: string, item: ShoppingItem): Promise<void> {
  await localUpsertItemAndEnqueue(householdId, item, {
    id: generateId(),
    householdId,
    targetType: 'ITEM',
    operationType: 'UPSERT',
    targetId: item.id,
    createdAtMillis: Date.now(),
  });
}

export async function enqueueDelete(
  householdId: string,
  targetType: PendingSyncOperation['targetType'],
  targetId: string,
): Promise<void> {
  await localAddPendingOp({
    id: generateId(),
    householdId,
    targetType,
    operationType: 'DELETE',
    targetId,
    createdAtMillis: Date.now(),
  });
}

/**
 * Flush pending ops FIFO. On first failure, stop — remaining ops stay queued
 * for the next flush (foreground return, next mutation, or next snapshot).
 */
export async function flush(householdId: string): Promise<void> {
  const ops = await localGetPendingOps(householdId);
  for (const op of ops) {
    try {
      switch (op.targetType) {
        case 'ITEM':
          await syncItem(op);
          break;
        case 'ACTIVITY':
          await syncActivity(op);
          break;
        case 'RECURRING':
          await syncRecurring(op);
          break;
      }
      await localRemovePendingOp(householdId, op.id);
    } catch {
      break;
    }
  }
}

async function syncItem(op: PendingSyncOperation): Promise<void> {
  if (op.operationType === 'DELETE') {
    await firestoreDeleteItem(op.householdId, op.targetId);
    return;
  }
  const items = await localGetItems(op.householdId);
  const item = items.find((i) => i.id === op.targetId);
  if (!item) return; // Local item gone — no-op (matches native)
  await firestoreAddItem(op.householdId, item);
}

async function syncActivity(op: PendingSyncOperation): Promise<void> {
  const logs = await localGetActivity(op.householdId);
  const log = logs.find((l) => l.id === op.targetId);
  if (!log) return;
  await firestoreLogActivity(op.householdId, log);
}

async function syncRecurring(op: PendingSyncOperation): Promise<void> {
  if (op.operationType === 'DELETE') {
    await firestoreDeleteRecurring(op.householdId, op.targetId);
    return;
  }
  const items = await localGetRecurring(op.householdId);
  const item = items.find((i) => i.id === op.targetId);
  if (!item) return;
  await firestoreUpsertRecurring(op.householdId, item);
}
