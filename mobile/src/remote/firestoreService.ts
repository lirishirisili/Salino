import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  arrayUnion,
  arrayRemove,
  Timestamp,
  Unsubscribe,
  writeBatch,
  type CollectionReference,
} from 'firebase/firestore';
import { db } from './firebase';
import { ShoppingItem, Household, HouseholdMember, ActivityLog, RecurringItem } from '../models';
import type { NotificationPreferences } from '../models/types';

// Collection references
export const usersCol = () => collection(db, 'users');
export const householdsCol = () => collection(db, 'households');
export const itemsCol = (householdId: string) =>
  collection(db, 'households', householdId, 'items');
export const membersCol = (householdId: string) =>
  collection(db, 'households', householdId, 'members');
export const activityCol = (householdId: string) =>
  collection(db, 'households', householdId, 'activity');
export const recurringCol = (householdId: string) =>
  collection(db, 'households', householdId, 'recurringItems');

// Shopping items listener
export const subscribeToItems = (
  householdId: string,
  onData: (items: ShoppingItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = query(itemsCol(householdId), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ShoppingItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ShoppingItem[];
      onData(items);
    },
    onError
  );
};

// Household listener
export const subscribeToHousehold = (
  householdId: string,
  onData: (household: Household) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const ref = doc(db, 'households', householdId);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.exists()) {
        onData({ id: snapshot.id, ...snapshot.data() } as Household);
      }
    },
    onError
  );
};

// Members listener
export const subscribeToMembers = (
  householdId: string,
  onData: (members: HouseholdMember[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = query(membersCol(householdId));
  return onSnapshot(
    q,
    (snapshot) => {
      const members: HouseholdMember[] = snapshot.docs.map((d) => ({
        userId: d.id,
        ...d.data(),
      })) as HouseholdMember[];
      onData(members);
    },
    onError
  );
};

// Activity feed listener
export const subscribeToActivity = (
  householdId: string,
  onData: (logs: ActivityLog[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = query(activityCol(householdId), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs: ActivityLog[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ActivityLog[];
      onData(logs);
    },
    onError
  );
};

// Recurring items listener
export const subscribeToRecurringItems = (
  householdId: string,
  onData: (items: RecurringItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = query(recurringCol(householdId), where('enabled', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: RecurringItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as RecurringItem[];
      onData(items);
    },
    onError
  );
};

// CRUD operations
export const firestoreAddItem = async (householdId: string, item: Omit<ShoppingItem, 'id'> & { id: string }) => {
  const ref = doc(db, 'households', householdId, 'items', item.id);
  await setDoc(ref, item);
};

export const firestoreUpdateItem = async (
  householdId: string,
  itemId: string,
  data: Partial<ShoppingItem>
) => {
  const ref = doc(db, 'households', householdId, 'items', itemId);
  await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
};

export const firestoreDeleteItem = async (householdId: string, itemId: string) => {
  const ref = doc(db, 'households', householdId, 'items', itemId);
  await deleteDoc(ref);
};

export const firestoreLogActivity = async (householdId: string, log: Omit<ActivityLog, 'id'> & { id: string }) => {
  const ref = doc(db, 'households', householdId, 'activity', log.id);
  await setDoc(ref, log);
};

export const firestoreUpsertRecurring = async (
  householdId: string,
  item: RecurringItem
) => {
  const ref = doc(db, 'households', householdId, 'recurringItems', item.id);
  await setDoc(ref, item, { merge: true });
};

export const firestoreDeleteRecurring = async (householdId: string, itemId: string) => {
  const ref = doc(db, 'households', householdId, 'recurringItems', itemId);
  await deleteDoc(ref);
};

// Household operations
export const firestoreCreateHousehold = async (household: Household, member: HouseholdMember) => {
  const batch = writeBatch(db);
  const hRef = doc(db, 'households', household.id);
  batch.set(hRef, household);
  const mRef = doc(db, 'households', household.id, 'members', member.userId);
  batch.set(mRef, member);
  await batch.commit();
};

export const firestoreGetHousehold = async (householdId: string): Promise<Household | null> => {
  const ref = doc(db, 'households', householdId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Household;
};

export const firestoreJoinHousehold = async (householdId: string, member: HouseholdMember) => {
  const ref = doc(db, 'households', householdId, 'members', member.userId);
  await setDoc(ref, member);
};

export const firestoreLeaveHousehold = async (householdId: string, userId: string) => {
  const ref = doc(db, 'households', householdId, 'members', userId);
  await deleteDoc(ref);
};

export const firestoreIsHouseholdMember = async (
  householdId: string,
  userId: string
): Promise<boolean> => {
  const ref = doc(db, 'households', householdId, 'members', userId);
  const snap = await getDoc(ref);
  return snap.exists();
};

export const firestoreUpdateHouseholdName = async (householdId: string, name: string) => {
  const ref = doc(db, 'households', householdId);
  await updateDoc(ref, { name });
};

// User profile
export const firestoreGetUser = async (userId: string) => {
  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const firestoreSetUser = async (userId: string, data: Record<string, unknown>) => {
  const ref = doc(db, 'users', userId);
  await setDoc(ref, data, { merge: true });
};

export const firestoreDeleteUser = async (userId: string) => {
  await deleteDoc(doc(db, 'users', userId));
};

// Push notification token + preferences
export const firestoreAddFcmToken = async (userId: string, token: string) => {
  const ref = doc(db, 'users', userId);
  await setDoc(ref, { fcmTokens: arrayUnion(token) }, { merge: true });
};

export const firestoreRemoveFcmToken = async (userId: string, token: string) => {
  const ref = doc(db, 'users', userId);
  await updateDoc(ref, { fcmTokens: arrayRemove(token) });
};

export const firestoreUpdateNotificationPrefs = async (
  userId: string,
  prefs: Partial<NotificationPreferences>
) => {
  const ref = doc(db, 'users', userId);
  const payload: Record<string, unknown> = {};
  (Object.keys(prefs) as (keyof NotificationPreferences)[]).forEach((key) => {
    payload[`notificationPreferences.${key}`] = prefs[key];
  });
  await setDoc(
    ref,
    { notificationPreferences: prefs },
    { merge: true }
  ).catch(async () => {
    await updateDoc(ref, payload);
  });
};

export const firestoreSetUserLanguage = async (userId: string, language: string) => {
  const ref = doc(db, 'users', userId);
  await setDoc(ref, { language }, { merge: true });
};

export const firestoreGetMemberCount = async (householdId: string): Promise<number> => {
  const snap = await getDocs(membersCol(householdId));
  return snap.size;
};

async function deleteCollection(ref: CollectionReference): Promise<void> {
  const snap = await getDocs(ref);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  if (snap.size >= 500) {
    await deleteCollection(ref);
  }
}

/** Removes household document and all subcollections (items, members, activity, recurring). */
export const firestoreDeleteHousehold = async (householdId: string): Promise<void> => {
  await deleteCollection(itemsCol(householdId));
  await deleteCollection(membersCol(householdId));
  await deleteCollection(activityCol(householdId));
  await deleteCollection(recurringCol(householdId));
  await deleteDoc(doc(db, 'households', householdId));
};

// Find household by invite code
export const firestoreFindByInviteCode = async (inviteCode: string): Promise<Household | null> => {
  const { getDocs } = await import('firebase/firestore');
  const q = query(householdsCol(), where('inviteCode', '==', inviteCode));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Household;
};
