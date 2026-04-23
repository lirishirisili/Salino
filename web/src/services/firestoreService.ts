import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  ShoppingItem,
  ActivityLog,
  ActivityType,
  Household,
  HouseholdMember,
  RecurringItem,
} from '../types';
import { normalizeItemName, generateId, generateInviteCode } from '../utils';

// ─── Timestamp Helpers ───

function toDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  return null;
}

function mapItem(id: string, data: Record<string, unknown>): ShoppingItem {
  return {
    id,
    name: (data.name as string) || '',
    normalizedName: (data.normalizedName as string) || '',
    quantity: (data.quantity as number) || 1,
    unit: (data.unit as ShoppingItem['unit']) || null,
    category: (data.category as string) || 'OTHER',
    note: (data.note as string) || '',
    status: (data.status as ShoppingItem['status']) || 'ACTIVE',
    addedBy: (data.addedBy as string) || '',
    addedByName: (data.addedByName as string) || '',
    boughtBy: (data.boughtBy as string) || null,
    boughtByName: (data.boughtByName as string) || null,
    isFavorite: (data.isFavorite as boolean) || false,
    isUrgent: (data.isUrgent as boolean) || false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function mapActivity(id: string, data: Record<string, unknown>): ActivityLog {
  return {
    id,
    householdId: (data.householdId as string) || '',
    type: (data.type as ActivityType) || 'ITEM_ADDED',
    itemId: (data.itemId as string) || null,
    itemName: (data.itemName as string) || '',
    actorUserId: (data.actorUserId as string) || '',
    actorDisplayName: (data.actorDisplayName as string) || '',
    message: (data.message as string) || '',
    createdAt: toDate(data.createdAt),
  };
}

function mapRecurring(id: string, data: Record<string, unknown>): RecurringItem {
  return {
    id,
    householdId: (data.householdId as string) || '',
    name: (data.name as string) || '',
    normalizedName: (data.normalizedName as string) || '',
    quantity: (data.quantity as number) || 1,
    unit: (data.unit as RecurringItem['unit']) || null,
    category: (data.category as string) || 'OTHER',
    note: (data.note as string) || '',
    intervalDays: (data.intervalDays as number) || 7,
    enabled: data.enabled !== false,
    nextDueAt: toDate(data.nextDueAt),
    lastCompletedAt: toDate(data.lastCompletedAt),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

// ─── Household ───

export async function createHousehold(name: string, userId: string, displayName: string): Promise<Household> {
  const id = generateId();
  const inviteCode = generateInviteCode();
  const household: Record<string, unknown> = {
    id,
    name,
    createdBy: userId,
    createdAt: serverTimestamp(),
    inviteCode,
  };
  await setDoc(doc(db, 'households', id), household);

  const member: Record<string, unknown> = {
    userId,
    displayName,
    role: 'OWNER',
    joinedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'households', id, 'members', userId), member);

  return { id, name, createdBy: userId, createdAt: new Date(), inviteCode };
}

export async function joinHousehold(inviteCode: string, userId: string, displayName: string): Promise<Household | null> {
  const q = query(collection(db, 'households'), where('inviteCode', '==', inviteCode.toUpperCase()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const householdDoc = snapshot.docs[0];
  const data = householdDoc.data();

  const member: Record<string, unknown> = {
    userId,
    displayName,
    role: 'MEMBER',
    joinedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'households', householdDoc.id, 'members', userId), member);

  return {
    id: householdDoc.id,
    name: (data.name as string) || '',
    createdBy: (data.createdBy as string) || '',
    createdAt: toDate(data.createdAt),
    inviteCode: (data.inviteCode as string) || '',
  };
}

export async function getHousehold(householdId: string): Promise<Household | null> {
  const snap = await getDoc(doc(db, 'households', householdId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: (data.name as string) || '',
    createdBy: (data.createdBy as string) || '',
    createdAt: toDate(data.createdAt),
    inviteCode: (data.inviteCode as string) || '',
  };
}

export function subscribeToMembers(
  householdId: string,
  callback: (members: HouseholdMember[]) => void
): () => void {
  const q = collection(db, 'households', householdId, 'members');
  return onSnapshot(q, (snapshot) => {
    const members: HouseholdMember[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        userId: (data.userId as string) || d.id,
        displayName: (data.displayName as string) || '',
        role: (data.role as HouseholdMember['role']) || 'MEMBER',
        joinedAt: toDate(data.joinedAt),
      };
    });
    callback(members);
  });
}

export async function leaveHousehold(householdId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db, 'households', householdId, 'members', userId));
}

// ─── Shopping Items ───

export function subscribeToItems(
  householdId: string,
  callback: (items: ShoppingItem[]) => void
): () => void {
  const q = collection(db, 'households', householdId, 'items');
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => mapItem(d.id, d.data() as Record<string, unknown>));
    callback(items);
  });
}

export async function addItem(
  householdId: string,
  item: Omit<ShoppingItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateId();
  const data: Record<string, unknown> = {
    ...item,
    id,
    normalizedName: normalizeItemName(item.name),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'households', householdId, 'items', id), data);
  return id;
}

export async function updateItem(
  householdId: string,
  itemId: string,
  updates: Partial<ShoppingItem>
): Promise<void> {
  const data: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
  if (updates.name) {
    data.normalizedName = normalizeItemName(updates.name);
  }
  await updateDoc(doc(db, 'households', householdId, 'items', itemId), data);
}

export async function deleteItem(householdId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'households', householdId, 'items', itemId));
}

export async function markAsBought(
  householdId: string,
  itemId: string,
  userId: string,
  userName: string
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'items', itemId), {
    status: 'BOUGHT',
    boughtBy: userId,
    boughtByName: userName,
    updatedAt: serverTimestamp(),
  });
}

export async function markAsActive(householdId: string, itemId: string): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'items', itemId), {
    status: 'ACTIVE',
    boughtBy: null,
    boughtByName: null,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleFavorite(
  householdId: string,
  itemId: string,
  isFavorite: boolean
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'items', itemId), {
    isFavorite,
    updatedAt: serverTimestamp(),
  });
}

// ─── Activity ───

export async function logActivity(
  householdId: string,
  activityType: ActivityType,
  itemName: string,
  actorUserId: string,
  actorDisplayName: string,
  itemId?: string
): Promise<void> {
  const messages: Record<ActivityType, string> = {
    ITEM_ADDED: `${actorDisplayName} added ${itemName}`,
    ITEM_UPDATED: `${actorDisplayName} updated ${itemName}`,
    ITEM_BOUGHT: `${actorDisplayName} bought ${itemName}`,
    ITEM_RESTORED: `${actorDisplayName} restored ${itemName}`,
    ITEM_DELETED: `${actorDisplayName} deleted ${itemName}`,
    RECURRING_CREATED: `${actorDisplayName} set ${itemName} as recurring`,
    RECURRING_UPDATED: `${actorDisplayName} updated recurring ${itemName}`,
    RECURRING_SUGGESTION_SURFACED: `Suggestion: ${itemName} is due`,
    SUGGESTION_ACCEPTED: `${actorDisplayName} accepted suggestion ${itemName}`,
  };

  await addDoc(collection(db, 'households', householdId, 'activity'), {
    id: generateId(),
    householdId,
    type: activityType,
    itemId: itemId || null,
    itemName,
    actorUserId,
    actorDisplayName,
    message: messages[activityType],
    createdAt: serverTimestamp(),
  });
}

export function subscribeToActivity(
  householdId: string,
  callback: (logs: ActivityLog[]) => void,
  maxItems = 50
): () => void {
  const q = query(
    collection(db, 'households', householdId, 'activity'),
    orderBy('createdAt', 'desc'),
    limit(maxItems)
  );
  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map((d) => mapActivity(d.id, d.data() as Record<string, unknown>));
    callback(logs);
  });
}

// ─── Recurring Items ───

export function subscribeToRecurringItems(
  householdId: string,
  callback: (items: RecurringItem[]) => void
): () => void {
  const q = collection(db, 'households', householdId, 'recurring');
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => mapRecurring(d.id, d.data() as Record<string, unknown>));
    callback(items);
  });
}

export async function addRecurringItem(
  householdId: string,
  item: Omit<RecurringItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = generateId();
  const data: Record<string, unknown> = {
    ...item,
    id,
    normalizedName: normalizeItemName(item.name),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'households', householdId, 'recurring', id), data);
  return id;
}
