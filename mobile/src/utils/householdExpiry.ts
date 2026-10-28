import { Timestamp } from 'firebase/firestore';
import type { Household } from '../models';
import { toMillisSafe } from '../local/timestampCodec';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Longest a temporary home can run from "now" (creation or extension). */
export const MAX_TEMP_DAYS = 60;
/** How long an ended temporary home stays readable before the server deletes it. */
export const GRACE_DAYS = 30;

export const TEMP_DURATION_PRESETS = [
  { days: 3, labelKey: 'household_temp_preset_3d' },
  { days: 7, labelKey: 'household_temp_preset_week' },
  { days: 14, labelKey: 'household_temp_preset_2weeks' },
  { days: 30, labelKey: 'household_temp_preset_month' },
] as const;

export function expiresAtMillis(h: Pick<Household, 'expiresAt'> | null | undefined): number | null {
  return toMillisSafe(h?.expiresAt);
}

export function isTemporary(h: Pick<Household, 'expiresAt'> | null | undefined): boolean {
  return expiresAtMillis(h) != null;
}

export function isExpired(h: Pick<Household, 'expiresAt'> | null | undefined, now = Date.now()): boolean {
  const ms = expiresAtMillis(h);
  return ms != null && ms <= now;
}

/** Whole days left (rounded up), 0 once ended; null for a regular home. */
export function daysLeft(h: Pick<Household, 'expiresAt'> | null | undefined, now = Date.now()): number | null {
  const ms = expiresAtMillis(h);
  if (ms == null) return null;
  return Math.max(0, Math.ceil((ms - now) / DAY_MS));
}

/** When the server will permanently delete an ended temporary home. */
export function deletionDate(h: Pick<Household, 'expiresAt'> | null | undefined): Date | null {
  const ms = expiresAtMillis(h);
  return ms == null ? null : new Date(ms + GRACE_DAYS * DAY_MS);
}

/** Past the grace window: the home is (or is about to be) deleted, so it can't be joined. */
export function isPastGrace(h: Pick<Household, 'expiresAt'> | null | undefined, now = Date.now()): boolean {
  const ms = expiresAtMillis(h);
  return ms != null && ms + GRACE_DAYS * DAY_MS <= now;
}

/** End of the local day `days` from today (23:59), so "3 days" covers the whole last day. */
export function endOfDayInDays(days: number, now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 0, 0);
  return d;
}

/** Latest allowed end date for a temporary home created or extended now. */
export function maxTempEndDate(now = new Date()): Date {
  return endOfDayInDays(MAX_TEMP_DAYS, now);
}

export function clampTempEndDate(date: Date, now = new Date()): Date {
  const min = endOfDayInDays(0, now);
  const max = maxTempEndDate(now);
  const ms = Math.min(Math.max(date.getTime(), min.getTime()), max.getTime());
  return new Date(ms);
}

export function toExpiresAt(date: Date): Timestamp {
  return Timestamp.fromDate(clampTempEndDate(date));
}

/** Short localized date, e.g. "Thu, 6 Nov". */
export function formatEndDate(date: Date, language: string): string {
  try {
    return date.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return date.toDateString();
  }
}
