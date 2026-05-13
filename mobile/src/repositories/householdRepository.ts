import { Timestamp } from 'firebase/firestore';
import { Household, HouseholdMember, MemberRole } from '../models';
import {
  firestoreCreateHousehold,
  firestoreGetHousehold,
  firestoreJoinHousehold,
  firestoreLeaveHousehold,
  firestoreUpdateHouseholdName,
  firestoreFindByInviteCode,
  subscribeToHousehold,
  subscribeToMembers,
} from '../remote/firestoreService';
import { firestoreSetUser } from '../remote/firestoreService';
import {
  localSetHousehold,
  localSetMembers,
  localSetActiveHouseholdId,
  localClearHouseholdData,
  localClearActiveHousehold,
} from '../local/storage';
import { auth } from '../remote/firebase';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const householdRepository = {
  createHousehold: async (name: string): Promise<Household> => {
    const uid = auth.currentUser!.uid;
    const displayName = auth.currentUser!.displayName || auth.currentUser!.email?.split('@')[0] || 'User';

    const household: Household = {
      id: generateId(),
      name,
      createdBy: uid,
      createdAt: Timestamp.now(),
      inviteCode: generateInviteCode(),
    };

    const member: HouseholdMember = {
      userId: uid,
      displayName,
      role: MemberRole.OWNER,
      joinedAt: Timestamp.now(),
    };

    await firestoreCreateHousehold(household, member);
    await localSetHousehold(household);
    await localSetMembers(household.id, [member]);
    await localSetActiveHouseholdId(household.id);
    await firestoreSetUser(uid, { activeHouseholdId: household.id });

    return household;
  },

  joinHousehold: async (inviteCode: string): Promise<Household> => {
    const found = await firestoreFindByInviteCode(inviteCode.trim().toUpperCase());
    if (!found) {
      throw new Error('INVALID_CODE');
    }

    const uid = auth.currentUser!.uid;
    const displayName = auth.currentUser!.displayName || auth.currentUser!.email?.split('@')[0] || 'User';

    const member: HouseholdMember = {
      userId: uid,
      displayName,
      role: MemberRole.MEMBER,
      joinedAt: Timestamp.now(),
    };

    await firestoreJoinHousehold(found.id, member);
    await localSetHousehold(found);
    await localSetActiveHouseholdId(found.id);
    await firestoreSetUser(uid, { activeHouseholdId: found.id });

    return found;
  },

  getHousehold: async (householdId: string): Promise<Household | null> => {
    return firestoreGetHousehold(householdId);
  },

  subscribeToHousehold: (
    householdId: string,
    onData: (h: Household) => void,
    onError?: (e: Error) => void
  ) => {
    return subscribeToHousehold(householdId, (h) => {
      localSetHousehold(h);
      onData(h);
    }, onError);
  },

  subscribeToMembers: (
    householdId: string,
    onData: (m: HouseholdMember[]) => void,
    onError?: (e: Error) => void
  ) => {
    return subscribeToMembers(householdId, (members) => {
      localSetMembers(householdId, members);
      onData(members);
    }, onError);
  },

  updateHouseholdName: async (householdId: string, name: string): Promise<void> => {
    await firestoreUpdateHouseholdName(householdId, name);
  },

  leaveHousehold: async (householdId: string): Promise<void> => {
    const uid = auth.currentUser!.uid;
    await firestoreLeaveHousehold(householdId, uid);
    await localClearHouseholdData(householdId);
    await localClearActiveHousehold();
    await firestoreSetUser(uid, { activeHouseholdId: null });
  },

  getInviteCode: async (householdId: string): Promise<string> => {
    const h = await firestoreGetHousehold(householdId);
    return h?.inviteCode ?? '';
  },
};
