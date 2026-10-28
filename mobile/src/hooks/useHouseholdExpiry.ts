import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { MemberRole } from '../models';
import { auth } from '../remote/firebase';
import { useHouseholdStore } from './useHouseholdStore';
import {
  daysLeft,
  deletionDate,
  expiresAtMillis,
  isExpired,
} from '../utils/householdExpiry';

/** setTimeout overflows past ~24.8 days, so long waits re-check hourly instead. */
const MAX_TIMER_MS = 60 * 60 * 1000;

/**
 * Expiry state of the active home, re-evaluated when the end moment passes so an
 * open list flips to read-only without a restart.
 */
export function useHouseholdExpiry() {
  const household = useHouseholdStore((s) => s.household);
  const members = useHouseholdStore((s) => s.members);
  const [now, setNow] = useState(() => Date.now());
  const endMs = expiresAtMillis(household);

  useEffect(() => {
    if (endMs == null) return;
    setNow(Date.now());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      const remaining = endMs - Date.now();
      if (remaining <= 0) return;
      timer = setTimeout(() => {
        setNow(Date.now());
        arm();
      }, Math.min(remaining + 500, MAX_TIMER_MS));
    };
    arm();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [endMs]);

  const uid = auth.currentUser?.uid;
  const isOwner =
    !!uid &&
    (household?.createdBy === uid ||
      members.some((m) => m.userId === uid && m.role === MemberRole.OWNER));

  return {
    isTemporary: endMs != null,
    isExpired: isExpired(household, now),
    daysLeft: daysLeft(household, now),
    endDate: endMs == null ? null : new Date(endMs),
    deleteDate: deletionDate(household),
    isOwner,
  };
}

/** True while the active home is an ended trip: the list is view-only. */
export function useIsHouseholdReadOnly(): boolean {
  return useHouseholdExpiry().isExpired;
}

/** Write-only screens (add / edit / supermarket mode) close themselves when the trip home ends. */
export function useLeaveIfReadOnly(): void {
  const readOnly = useIsHouseholdReadOnly();
  useEffect(() => {
    if (!readOnly) return;
    if (router.canGoBack()) router.back();
    else router.replace('/(main)/shopping-list');
  }, [readOnly]);
}
