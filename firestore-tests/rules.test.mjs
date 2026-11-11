// Phase 2 (STRICT) rules: ../firestore.rules.strict. Each case mirrors a real call in the RN client
// (mobile/src/remote/firestoreService.ts). Run with `npm test` (starts the emulator).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';

const HID = 'home1';
const CODE = 'ABC234';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-salino-rules',
    firestore: { rules: readFileSync(new URL('../firestore.rules.strict', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const db = (uid) => env.authenticatedContext(uid).firestore();

/** Same batch as firestoreCreateHousehold. */
async function createHome(uid, hid = HID, code = CODE) {
  const f = db(uid);
  const batch = writeBatch(f);
  batch.set(doc(f, 'households', hid), {
    id: hid,
    name: 'Home',
    createdBy: uid,
    createdAt: Timestamp.now(),
    inviteCode: code,
  });
  batch.set(doc(f, 'households', hid, 'members', uid), {
    userId: uid,
    displayName: uid,
    role: 'OWNER',
    joinedAt: Timestamp.now(),
  });
  batch.set(doc(f, 'inviteCodes', code), { householdId: hid });
  await batch.commit();
}

function memberDoc(uid, role, joinCode) {
  return {
    userId: uid,
    displayName: uid,
    role,
    joinedAt: Timestamp.now(),
    ...(joinCode ? { joinCode } : {}),
  };
}

async function join(uid, code = CODE, hid = HID) {
  await setDoc(doc(db(uid), 'households', hid, 'members', uid), memberDoc(uid, 'MEMBER', code));
}

describe('creating a home', () => {
  it('owner creates home + owner member + invite index in one batch', async () => {
    await assertSucceeds(createHome('alice'));
  });

  it('cannot create a home on behalf of someone else', async () => {
    const f = db('mallory');
    const batch = writeBatch(f);
    batch.set(doc(f, 'households', HID), { createdBy: 'alice', inviteCode: CODE, name: 'x' });
    batch.set(doc(f, 'households', HID, 'members', 'mallory'), memberDoc('mallory', 'OWNER'));
    await assertFails(batch.commit());
  });

  it('cannot add an OWNER member doc to an existing home', async () => {
    await createHome('alice');
    await assertFails(
      setDoc(doc(db('mallory'), 'households', HID, 'members', 'mallory'), memberDoc('mallory', 'OWNER'))
    );
  });
});

describe('outsiders', () => {
  beforeEach(async () => {
    await createHome('alice');
    await setDoc(doc(db('alice'), 'households', HID, 'items', 'i1'), { name: 'milk' });
  });

  it('cannot list or query homes (no invite-code enumeration)', async () => {
    const f = db('mallory');
    await assertFails(getDocs(query(collection(f, 'households'), where('inviteCode', '==', CODE), limit(1))));
    await assertFails(getDocs(collection(f, 'households')));
  });

  it('cannot list the invite index', async () => {
    await assertFails(getDocs(collection(db('mallory'), 'inviteCodes')));
  });

  it('cannot read or write items, activity, recurring or members', async () => {
    const f = db('mallory');
    await assertFails(getDocs(collection(f, 'households', HID, 'items')));
    await assertFails(getDoc(doc(f, 'households', HID, 'items', 'i1')));
    await assertFails(setDoc(doc(f, 'households', HID, 'items', 'i2'), { name: 'x' }));
    await assertFails(deleteDoc(doc(f, 'households', HID, 'items', 'i1')));
    await assertFails(getDocs(collection(f, 'households', HID, 'activity')));
    await assertFails(getDocs(collection(f, 'households', HID, 'recurringItems')));
    await assertFails(getDocs(collection(f, 'households', HID, 'members')));
  });

  it('cannot rename or delete the home', async () => {
    const f = db('mallory');
    await assertFails(updateDoc(doc(f, 'households', HID), { name: 'pwned' }));
    await assertFails(deleteDoc(doc(f, 'households', HID)));
  });

  it('cannot join with a wrong code or without a code', async () => {
    await assertFails(join('mallory', 'ZZZ999'));
    await assertFails(
      setDoc(doc(db('mallory'), 'households', HID, 'members', 'mallory'), memberDoc('mallory', 'MEMBER'))
    );
  });

  it('cannot add someone else as a member', async () => {
    await assertFails(
      setDoc(doc(db('mallory'), 'households', HID, 'members', 'bob'), memberDoc('bob', 'MEMBER', CODE))
    );
  });

  it('cannot hijack an invite code that another home uses', async () => {
    // Creating a home whose batch re-points an existing code is rejected outright…
    await assertFails(createHome('mallory', 'evil', CODE));
    // …and so is re-pointing it afterwards from a home created without the index.
    const f = db('mallory');
    const batch = writeBatch(f);
    batch.set(doc(f, 'households', 'evil'), { createdBy: 'mallory', inviteCode: CODE, name: 'x' });
    batch.set(doc(f, 'households', 'evil', 'members', 'mallory'), memberDoc('mallory', 'OWNER'));
    await assertSucceeds(batch.commit());
    await assertFails(setDoc(doc(f, 'inviteCodes', CODE), { householdId: 'evil' }));
  });

  it('cannot read another user profile', async () => {
    await setDoc(doc(db('alice'), 'users', 'alice'), { activeHouseholdId: HID });
    await assertFails(getDoc(doc(db('mallory'), 'users', 'alice')));
    await assertFails(setDoc(doc(db('mallory'), 'users', 'alice'), { x: 1 }));
  });

  it('cannot touch server-only collections', async () => {
    await assertFails(getDoc(doc(db('mallory'), 'categoryAiCache', 'milk')));
    await assertFails(setDoc(doc(db('mallory'), 'aiCategoryRateLimit', 'mallory'), { n: 0 }));
  });

  it('unauthenticated users get nothing', async () => {
    const f = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(f, 'households', HID)));
    await assertFails(getDoc(doc(f, 'inviteCodes', CODE)));
  });
});

describe('joining with an invite code (firestoreFindByInviteCode + joinHousehold)', () => {
  beforeEach(async () => {
    await createHome('alice');
  });

  it('looks the code up, reads the home, checks own membership, joins', async () => {
    const f = db('bob');
    const idx = await assertSucceeds(getDoc(doc(f, 'inviteCodes', CODE)));
    const hid = idx.data().householdId;
    const home = await assertSucceeds(getDoc(doc(f, 'households', hid)));
    if (home.data().name !== 'Home') throw new Error('wrong home');
    await assertSucceeds(getDoc(doc(f, 'households', hid, 'members', 'bob')));
    await assertSucceeds(join('bob'));
  });

  it('a nonexistent home reads as missing, not denied', async () => {
    const snap = await assertSucceeds(getDoc(doc(db('bob'), 'households', 'gone')));
    if (snap.exists()) throw new Error('should not exist');
  });
});

describe('members', () => {
  beforeEach(async () => {
    await createHome('alice');
    await join('bob');
  });

  it('read and write items, activity and recurring', async () => {
    const f = db('bob');
    await assertSucceeds(setDoc(doc(f, 'households', HID, 'items', 'i1'), { name: 'bread' }));
    await assertSucceeds(updateDoc(doc(f, 'households', HID, 'items', 'i1'), { status: 'BOUGHT' }));
    await assertSucceeds(getDocs(collection(f, 'households', HID, 'items')));
    await assertSucceeds(deleteDoc(doc(f, 'households', HID, 'items', 'i1')));
    await assertSucceeds(setDoc(doc(f, 'households', HID, 'activity', 'a1'), { type: 'ITEM_ADDED' }));
    await assertSucceeds(getDocs(collection(f, 'households', HID, 'activity')));
    await assertSucceeds(setDoc(doc(f, 'households', HID, 'recurringItems', 'r1'), { enabled: true }));
    await assertSucceeds(
      getDocs(query(collection(f, 'households', HID, 'recurringItems'), where('enabled', '==', true)))
    );
    await assertSucceeds(getDocs(collection(f, 'households', HID, 'members')));
  });

  it('rename and extend the home, but not change its code or owner', async () => {
    const f = db('bob');
    await assertSucceeds(updateDoc(doc(f, 'households', HID), { name: 'New name' }));
    await assertSucceeds(
      updateDoc(doc(f, 'households', HID), {
        expiresAt: Timestamp.now(),
        reminderSentAt: null,
        expiredNotifiedAt: null,
      })
    );
    await assertFails(updateDoc(doc(f, 'households', HID), { inviteCode: 'NEW123' }));
    await assertFails(updateDoc(doc(f, 'households', HID), { createdBy: 'bob' }));
  });

  it('can backfill the invite index for their home (publishInviteCodeOnce)', async () => {
    await assertSucceeds(setDoc(doc(db('bob'), 'inviteCodes', CODE), { householdId: HID }));
    await assertFails(setDoc(doc(db('bob'), 'inviteCodes', 'OTHER1'), { householdId: HID }));
  });

  it('cannot promote themselves to OWNER', async () => {
    await assertFails(
      updateDoc(doc(db('bob'), 'households', HID, 'members', 'bob'), { role: 'OWNER' })
    );
  });

  it('cannot delete a home whose creator is still a member', async () => {
    await assertFails(deleteDoc(doc(db('bob'), 'households', HID)));
  });

  it('can leave (delete own member doc), then loses access', async () => {
    const f = db('bob');
    await assertSucceeds(deleteDoc(doc(f, 'households', HID, 'members', 'bob')));
    await assertFails(getDocs(collection(f, 'households', HID, 'items')));
  });

  it('cannot remove another member, but the creator can', async () => {
    await join('carol');
    await assertFails(deleteDoc(doc(db('bob'), 'households', HID, 'members', 'carol')));
    await assertSucceeds(deleteDoc(doc(db('alice'), 'households', HID, 'members', 'carol')));
  });

  it('own profile: read and write', async () => {
    const f = db('bob');
    await assertSucceeds(setDoc(doc(f, 'users', 'bob'), { householdIds: [HID] }, { merge: true }));
    await assertSucceeds(getDoc(doc(f, 'users', 'bob')));
    await assertSucceeds(deleteDoc(doc(f, 'users', 'bob')));
  });
});

describe('deleting a solo home (firestoreDeleteHousehold order)', () => {
  it('items, activity, recurring, home, invite index, then members', async () => {
    await createHome('alice');
    const f = db('alice');
    await setDoc(doc(f, 'households', HID, 'items', 'i1'), { name: 'milk' });
    await setDoc(doc(f, 'households', HID, 'activity', 'a1'), { type: 'x' });
    await setDoc(doc(f, 'households', HID, 'recurringItems', 'r1'), { enabled: true });

    await assertSucceeds(deleteDoc(doc(f, 'households', HID, 'items', 'i1')));
    await assertSucceeds(deleteDoc(doc(f, 'households', HID, 'activity', 'a1')));
    await assertSucceeds(deleteDoc(doc(f, 'households', HID, 'recurringItems', 'r1')));
    await assertSucceeds(deleteDoc(doc(f, 'households', HID)));
    await assertSucceeds(deleteDoc(doc(f, 'inviteCodes', CODE)));
    await assertSucceeds(deleteDoc(doc(f, 'households', HID, 'members', 'alice')));
  });

  it('a remaining member can delete the home after the creator left', async () => {
    await createHome('alice');
    await join('bob');
    await deleteDoc(doc(db('alice'), 'households', HID, 'members', 'alice'));
    await assertSucceeds(deleteDoc(doc(db('bob'), 'households', HID)));
  });
});
