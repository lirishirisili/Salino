jest.mock('firebase/firestore', () => {
  class Timestamp {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    static fromMillis(ms: number) {
      return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
    }
    static fromDate(d: Date) {
      return Timestamp.fromMillis(d.getTime());
    }
    toMillis() {
      return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
    }
  }
  return { Timestamp };
});

import { Timestamp } from 'firebase/firestore';
import {
  GRACE_DAYS,
  MAX_TEMP_DAYS,
  clampTempEndDate,
  daysLeft,
  deletionDate,
  endOfDayInDays,
  isExpired,
  isPastGrace,
  isTemporary,
} from '../householdExpiry';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 28, 12, 0).getTime();

const home = (endMs?: number | null) => ({
  expiresAt: endMs == null ? endMs : Timestamp.fromMillis(endMs),
});

describe('householdExpiry', () => {
  it('treats homes without expiresAt as regular homes', () => {
    expect(isTemporary(home(undefined))).toBe(false);
    expect(isTemporary(home(null))).toBe(false);
    expect(isExpired(home(undefined), NOW)).toBe(false);
    expect(daysLeft(home(undefined), NOW)).toBeNull();
    expect(deletionDate(home(undefined))).toBeNull();
  });

  it('counts days left rounding up and flips to expired at the end moment', () => {
    expect(daysLeft(home(NOW + 2.5 * DAY), NOW)).toBe(3);
    expect(isExpired(home(NOW + 1), NOW)).toBe(false);
    expect(isExpired(home(NOW), NOW)).toBe(true);
    expect(daysLeft(home(NOW - DAY), NOW)).toBe(0);
  });

  it('accepts timestamps that went through the JSON cache (plain seconds object)', () => {
    const cached = { expiresAt: { seconds: (NOW - DAY) / 1000, nanoseconds: 0 } as unknown as Timestamp };
    expect(isExpired(cached, NOW)).toBe(true);
  });

  it('keeps an ended home joinable only during the grace window', () => {
    const endMs = NOW - (GRACE_DAYS - 1) * DAY;
    expect(isPastGrace(home(endMs), NOW)).toBe(false);
    expect(isPastGrace(home(NOW - GRACE_DAYS * DAY), NOW)).toBe(true);
    expect(deletionDate(home(endMs))?.getTime()).toBe(endMs + GRACE_DAYS * DAY);
  });

  it('ends presets at the end of the local day', () => {
    const end = endOfDayInDays(3, new Date(NOW));
    expect(end.getDate()).toBe(31);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it('clamps custom end dates to today … MAX_TEMP_DAYS ahead', () => {
    const now = new Date(NOW);
    expect(clampTempEndDate(new Date(NOW - 5 * DAY), now).getTime()).toBe(endOfDayInDays(0, now).getTime());
    expect(clampTempEndDate(new Date(NOW + 365 * DAY), now).getTime()).toBe(
      endOfDayInDays(MAX_TEMP_DAYS, now).getTime()
    );
  });
});
