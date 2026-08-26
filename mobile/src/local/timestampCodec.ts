import { Timestamp } from 'firebase/firestore';
import { ShoppingItem, RecurringItem, ActivityLog, Household, HouseholdMember } from '../models';

/**
 * Firestore `Timestamp` objects do NOT survive a JSON.stringify → JSON.parse
 * round-trip: parsing yields a plain object without `.toMillis()` / `.toDate()`.
 * Any downstream code that calls those methods on cached data throws, which
 * previously caused the whole cache read to be discarded and forced the cold
 * start to wait for the first remote Firestore snapshot.
 *
 * These codecs store timestamps as plain epoch-millis numbers on disk and
 * reconstruct real `Timestamp` instances on read, so the rest of the app can
 * treat cached and remote data identically.
 */

/** Best-effort conversion of any timestamp-shaped value to epoch millis. */
export function toMillisSafe(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object') {
    const obj = value as {
      toMillis?: () => number;
      seconds?: number;
      nanoseconds?: number;
      _seconds?: number;
      _nanoseconds?: number;
    };
    if (typeof obj.toMillis === 'function') {
      const ms = obj.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof obj.seconds === 'number') {
      return obj.seconds * 1000 + Math.floor((obj.nanoseconds ?? 0) / 1e6);
    }
    if (typeof obj._seconds === 'number') {
      return obj._seconds * 1000 + Math.floor((obj._nanoseconds ?? 0) / 1e6);
    }
  }
  return null;
}

function toTimestampSafe(value: unknown): Timestamp | null {
  const ms = toMillisSafe(value);
  return ms == null ? null : Timestamp.fromMillis(ms);
}

// ── Shopping items ──
export function encodeItem(item: ShoppingItem): Record<string, unknown> {
  return {
    ...item,
    createdAt: toMillisSafe(item.createdAt),
    updatedAt: toMillisSafe(item.updatedAt),
  };
}

export function decodeItem(raw: Record<string, unknown>): ShoppingItem {
  return {
    ...(raw as unknown as ShoppingItem),
    createdAt: toTimestampSafe(raw.createdAt),
    updatedAt: toTimestampSafe(raw.updatedAt),
  };
}

// ── Recurring items ──
export function encodeRecurring(item: RecurringItem): Record<string, unknown> {
  return {
    ...item,
    nextDueAt: toMillisSafe(item.nextDueAt),
    lastCompletedAt: toMillisSafe(item.lastCompletedAt),
    createdAt: toMillisSafe(item.createdAt),
    updatedAt: toMillisSafe(item.updatedAt),
  };
}

export function decodeRecurring(raw: Record<string, unknown>): RecurringItem {
  return {
    ...(raw as unknown as RecurringItem),
    nextDueAt: toTimestampSafe(raw.nextDueAt),
    lastCompletedAt: toTimestampSafe(raw.lastCompletedAt),
    createdAt: toTimestampSafe(raw.createdAt),
    updatedAt: toTimestampSafe(raw.updatedAt),
  };
}

// ── Activity logs ──
export function encodeActivity(log: ActivityLog): Record<string, unknown> {
  return {
    ...log,
    createdAt: toMillisSafe(log.createdAt),
  };
}

export function decodeActivity(raw: Record<string, unknown>): ActivityLog {
  return {
    ...(raw as unknown as ActivityLog),
    createdAt: toTimestampSafe(raw.createdAt),
  };
}

// ── Household ──
export function encodeHousehold(household: Household): Record<string, unknown> {
  return {
    ...household,
    createdAt: toMillisSafe(household.createdAt),
  };
}

export function decodeHousehold(raw: Record<string, unknown>): Household {
  return {
    ...(raw as unknown as Household),
    createdAt: toTimestampSafe(raw.createdAt),
  };
}

// ── Household members ──
export function encodeMember(member: HouseholdMember): Record<string, unknown> {
  return {
    ...member,
    joinedAt: toMillisSafe(member.joinedAt),
  };
}

export function decodeMember(raw: Record<string, unknown>): HouseholdMember {
  return {
    ...(raw as unknown as HouseholdMember),
    joinedAt: toTimestampSafe(raw.joinedAt),
  };
}
