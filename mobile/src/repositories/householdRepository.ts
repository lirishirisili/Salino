import { Timestamp } from 'firebase/firestore';
import { Household, HouseholdMember, MemberRole } from '../models';
import {
  firestoreAddUserHousehold,
  firestoreCreateHousehold,
  firestoreExtendHousehold,
  firestoreGetHousehold,
  firestoreGetUser,
  firestoreIsHouseholdMember,
  firestoreJoinHousehold,
  firestoreLeaveHousehold,
  firestoreRemoveUserHousehold,
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
  localGetMyHouseholds,
  localSetMyHouseholds,
} from '../local/storage';
import { auth } from '../remote/firebase';
import { isPastGrace, isTemporary } from '../utils/householdExpiry';

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

function readHouseholdIds(profile: Record<string, unknown> | null): string[] {
  const ids = new Set<string>();
  const list = profile?.householdIds;
  if (Array.isArray(list)) {
    list.forEach((id) => typeof id === 'string' && id && ids.add(id));
  }
  const active = profile?.activeHouseholdId;
  if (typeof active === 'string' && active) ids.add(active);
  return [...ids];
}

/** Regular homes first, then trips; newest first within each group. */
function sortHouseholds(list: Household[]): Household[] {
  return [...list].sort((a, b) => {
    const ta = isTemporary(a) ? 1 : 0;
    const tb = isTemporary(b) ? 1 : 0;
    if (ta !== tb) return ta - tb;
    return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
  });
}

async function dropFromCachedList(uid: string, householdId: string): Promise<void> {
  const cached = await localGetMyHouseholds(uid).catch(() => [] as Household[]);
  if (cached.some((h) => h.id === householdId)) {
    await localSetMyHouseholds(uid, cached.filter((h) => h.id !== householdId)).catch(() => undefined);
  }
}

export const householdRepository = {
  createHousehold: async (name: string, opts?: { expiresAt?: Timestamp }): Promise<Household> => {
    const uid = auth.currentUser!.uid;
    const displayName = auth.currentUser!.displayName || auth.currentUser!.email?.split('@')[0] || 'User';

    const household: Household = {
      id: generateId(),
      name,
      createdBy: uid,
      createdAt: Timestamp.now(),
      inviteCode: generateInviteCode(),
      // Firestore rejects `undefined` fields, so only temporary homes carry the key.
      ...(opts?.expiresAt ? { expiresAt: opts.expiresAt } : {}),
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
    await localSetActiveHouseholdId(uid, household.id);
    await firestoreSetUser(uid, { activeHouseholdId: household.id });
    await firestoreAddUserHousehold(uid, household.id);

    return household;
  },

  /** Looks up an invite code without joining (used for the "Join «name»?" confirmation). */
  findByInviteCode: async (inviteCode: string): Promise<Household | null> => {
    const found = await firestoreFindByInviteCode(inviteCode.trim().toUpperCase());
    if (!found || isPastGrace(found)) return null;
    return found;
  },

  joinHousehold: async (inviteCode: string): Promise<Household> => {
    const found = await firestoreFindByInviteCode(inviteCode.trim().toUpperCase());
    if (!found || isPastGrace(found)) {
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

    // Re-joining (e.g. an invite link to your own home) must not demote an OWNER doc.
    const alreadyMember = await firestoreIsHouseholdMember(found.id, uid).catch(() => false);
    if (!alreadyMember) {
      await firestoreJoinHousehold(found.id, member);
    }
    await localSetHousehold(found);
    await localSetActiveHouseholdId(uid, found.id);
    await firestoreSetUser(uid, { activeHouseholdId: found.id });
    await firestoreAddUserHousehold(uid, found.id);

    return found;
  },

  /** Makes another home (the user is already a member of) the active one. */
  switchHousehold: async (householdId: string): Promise<void> => {
    const uid = auth.currentUser!.uid;
    await localSetActiveHouseholdId(uid, householdId);
    // Offline a setDoc only resolves on server ack — never block the switch on it.
    void firestoreSetUser(uid, { activeHouseholdId: householdId }).catch(() => undefined);
  },

  /** Cached list of the user's homes, for an instant switcher before the network answers. */
  getCachedMyHouseholds: async (): Promise<Household[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    return localGetMyHouseholds(uid);
  },

  /** All homes the user belongs to. Ids whose home no longer exists are pruned from the profile. */
  listMyHouseholds: async (): Promise<Household[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const profile = await firestoreGetUser(uid);
    const ids = readHouseholdIds(profile);
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          return { id, household: await firestoreGetHousehold(id) };
        } catch {
          return { id, household: undefined };
        }
      })
    );
    const households: Household[] = [];
    for (const { id, household } of results) {
      if (household) {
        households.push(household);
      } else if (household === null) {
        void firestoreRemoveUserHousehold(uid, id).catch(() => undefined);
      }
    }
    const sorted = sortHouseholds(households);
    await localSetMyHouseholds(uid, sorted);
    return sorted;
  },

  getHousehold: async (householdId: string): Promise<Household | null> => {
    return firestoreGetHousehold(householdId);
  },

  subscribeToHousehold: (
    householdId: string,
    onData: (h: Household) => void,
    onError?: (e: Error) => void,
    onMissing?: () => void
  ) => {
    return subscribeToHousehold(householdId, (h) => {
      localSetHousehold(h);
      onData(h);
    }, onError, onMissing);
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

  extendHousehold: async (householdId: string, expiresAt: Timestamp): Promise<void> => {
    await firestoreExtendHousehold(householdId, expiresAt);
  },

  /**
   * Leaves a home and returns the home to continue in (a regular one first), or null
   * when the user has no other home and must go through household setup.
   */
  leaveHousehold: async (householdId: string, otherHouseholds: Household[] = []): Promise<string | null> => {
    const uid = auth.currentUser!.uid;
    await firestoreLeaveHousehold(householdId, uid);
    await firestoreRemoveUserHousehold(uid, householdId).catch(() => undefined);
    await localClearHouseholdData(householdId);
    await dropFromCachedList(uid, householdId);

    let others = otherHouseholds.filter((h) => h.id !== householdId);
    if (others.length === 0) {
      // The in-memory list may not be loaded yet: ask the profile before giving up.
      others = (await householdRepository.listMyHouseholds().catch(() => [])).filter(
        (h) => h.id !== householdId
      );
    }
    const next = sortHouseholds(others)[0] ?? null;
    if (next) {
      await localSetActiveHouseholdId(uid, next.id);
      await firestoreSetUser(uid, { activeHouseholdId: next.id });
      return next.id;
    }
    await localClearActiveHousehold(uid);
    await firestoreSetUser(uid, { activeHouseholdId: null });
    return null;
  },

  /** Local cleanup after the server deleted a home the user was in. */
  forgetHousehold: async (householdId: string, nextHouseholdId: string | null): Promise<void> => {
    const uid = auth.currentUser?.uid;
    await localClearHouseholdData(householdId);
    if (!uid) return;
    await dropFromCachedList(uid, householdId);
    if (nextHouseholdId) {
      await householdRepository.switchHousehold(nextHouseholdId);
    } else {
      // Otherwise the next cold start would route straight back into the deleted home.
      await localClearActiveHousehold(uid);
      void firestoreSetUser(uid, { activeHouseholdId: null }).catch(() => undefined);
    }
    void firestoreRemoveUserHousehold(uid, householdId).catch(() => undefined);
  },

  getInviteCode: async (householdId: string): Promise<string> => {
    const h = await firestoreGetHousehold(householdId);
    return h?.inviteCode ?? '';
  },
};
