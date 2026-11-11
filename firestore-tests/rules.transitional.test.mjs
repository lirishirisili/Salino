// Phase 1 (transitional) rules — the deployed ../firestore.rules.
// Proves three things:
//   1. Every flow of the app builds ALREADY IN THE STORES still works
//      (legacy invite query, join without joinCode, old account-deletion order).
//   2. Every flow of the NEW build works (invite index, joinCode, new delete order).
//   3. What the old catch-all allowed and is now closed: reading / writing a
//      home's data without membership, other users' profiles, server collections.
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
    projectId: 'demo-salino-rules-transitional',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const db = (uid) => env.authenticatedContext(uid).firestore();

function homeDoc(uid, code = CODE) {
  return { name: 'Home', createdBy: uid, createdAt: Timestamp.now(), inviteCode: code };
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

/** Released build: home + owner member, no invite index. */
async function createHomeOld(uid, hid = HID, code = CODE) {
  const f = db(uid);
  const batch = writeBatch(f);
  batch.set(doc(f, 'households', hid), { id: hid, ...homeDoc(uid, code) });
  batch.set(doc(f, 'households', hid, 'members', uid), memberDoc(uid, 'OWNER'));
  await batch.commit();
}

/** New build: same batch plus the invite index entry. */
async function createHomeNew(uid, hid = HID, code = CODE) {
  const f = db(uid);
  const batch = writeBatch(f);
  batch.set(doc(f, 'households', hid), { id: hid, ...homeDoc(uid, code) });
  batch.set(doc(f, 'households', hid, 'members', uid), memberDoc(uid, 'OWNER'));
  batch.set(doc(f, 'inviteCodes', code), { householdId: hid });
  await batch.commit();
}

/** Old builds' deleteCollection: list, then batch-delete everything listed. */
async function deleteCollectionOld(f, ...path) {
  const snap = await getDocs(collection(f, ...path));
  if (snap.empty) return;
  const batch = writeBatch(f);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

describe('released app builds (backward compatibility)', () => {
  it('create a home without the invite index', async () => {
    await assertSucceeds(createHomeOld('alice'));
  });

  it('find a home with the legacy inviteCode query and join WITHOUT joinCode', async () => {
    await createHomeOld('alice');
    const f = db('bob');
    const snap = await assertSucceeds(
      getDocs(query(collection(f, 'households'), where('inviteCode', '==', CODE)))
    );
    const hid = snap.docs[0].id;
    await assertSucceeds(getDoc(doc(f, 'households', hid, 'members', 'bob')));
    await assertSucceeds(
      setDoc(doc(f, 'households', hid, 'members', 'bob'), memberDoc('bob', 'MEMBER'))
    );
    // …and then works as a normal member.
    await assertSucceeds(setDoc(doc(f, 'households', hid, 'items', 'i1'), { name: 'milk' }));
  });

  it('account deletion of a solo home in the OLD order (members before activity)', async () => {
    await createHomeOld('alice');
    const f = db('alice');
    await setDoc(doc(f, 'households', HID, 'items', 'i1'), { name: 'milk' });
    await setDoc(doc(f, 'households', HID, 'activity', 'a1'), { type: 'x' });
    await setDoc(doc(f, 'households', HID, 'recurringItems', 'r1'), { enabled: true });

    // firestoreDeleteHousehold as shipped: items, members, activity, recurring, home.
    await assertSucceeds(deleteCollectionOld(f, 'households', HID, 'items'));
    await assertSucceeds(deleteCollectionOld(f, 'households', HID, 'members'));
    await assertSucceeds(deleteCollectionOld(f, 'households', HID, 'activity'));
    await assertSucceeds(deleteCollectionOld(f, 'households', HID, 'recurringItems'));
    await assertSucceeds(deleteDoc(doc(f, 'households', HID)));
    await assertSucceeds(deleteDoc(doc(f, 'users', 'alice')));
  });

  it('leave a shared home', async () => {
    await createHomeOld('alice');
    await setDoc(doc(db('bob'), 'households', HID, 'members', 'bob'), memberDoc('bob', 'MEMBER'));
    await assertSucceeds(deleteDoc(doc(db('bob'), 'households', HID, 'members', 'bob')));
  });
});

describe('retired clients (web, native Android) — not supported', () => {
  it('a home without its owner member in the same batch is rejected', async () => {
    const f = db('alice');
    await assertFails(setDoc(doc(f, 'households', HID), { id: HID, ...homeDoc('alice') }));
  });

  it('nobody can add an OWNER doc to an existing home', async () => {
    await createHomeOld('alice');
    await assertFails(
      setDoc(doc(db('mallory'), 'households', HID, 'members', 'mallory'), memberDoc('mallory', 'OWNER'))
    );
  });

  it("the web-only 'recurring' subcollection is closed", async () => {
    await createHomeOld('alice');
    await assertFails(setDoc(doc(db('alice'), 'households', HID, 'recurring', 'r1'), { name: 'x' }));
  });
});

describe('new app build', () => {
  it('creates home + invite index, joins through the index with joinCode', async () => {
    await assertSucceeds(createHomeNew('alice'));
    const f = db('bob');
    const idx = await assertSucceeds(getDoc(doc(f, 'inviteCodes', CODE)));
    const hid = idx.data().householdId;
    await assertSucceeds(getDoc(doc(f, 'households', hid)));
    await assertSucceeds(
      setDoc(doc(f, 'households', hid, 'members', 'bob'), memberDoc('bob', 'MEMBER', CODE))
    );
  });

  it('a member backfills the index for an old home', async () => {
    await createHomeOld('alice');
    await assertSucceeds(setDoc(doc(db('alice'), 'inviteCodes', CODE), { householdId: HID }));
  });

  it('deletes a solo home in the NEW order', async () => {
    await createHomeNew('alice');
    const f = db('alice');
    await setDoc(doc(f, 'households', HID, 'items', 'i1'), { name: 'milk' });
    await assertSucceeds(deleteCollectionOld(f, 'households', HID, 'items'));
    await assertSucceeds(deleteCollectionOld(f, 'households', HID, 'activity'));
    await assertSucceeds(deleteCollectionOld(f, 'households', HID, 'recurringItems'));
    await assertSucceeds(deleteDoc(doc(f, 'households', HID)));
    await assertSucceeds(deleteDoc(doc(f, 'inviteCodes', CODE)));
    await assertSucceeds(deleteCollectionOld(f, 'households', HID, 'members'));
  });

  it('a wrong joinCode is rejected', async () => {
    await createHomeNew('alice');
    await assertFails(
      setDoc(doc(db('bob'), 'households', HID, 'members', 'bob'), memberDoc('bob', 'MEMBER', 'ZZZ999'))
    );
  });
});

describe('closed now (was open under the old catch-all)', () => {
  beforeEach(async () => {
    await createHomeNew('alice');
    await setDoc(doc(db('alice'), 'households', HID, 'items', 'i1'), { name: 'milk' });
    await setDoc(doc(db('alice'), 'households', HID, 'activity', 'a1'), { type: 'x' });
    await setDoc(doc(db('alice'), 'users', 'alice'), { activeHouseholdId: HID });
  });

  it('a non-member cannot read the list, activity, recurring or members', async () => {
    const f = db('mallory');
    await assertFails(getDocs(collection(f, 'households', HID, 'items')));
    await assertFails(getDoc(doc(f, 'households', HID, 'items', 'i1')));
    await assertFails(getDocs(collection(f, 'households', HID, 'activity')));
    await assertFails(getDocs(collection(f, 'households', HID, 'recurringItems')));
    await assertFails(getDocs(collection(f, 'households', HID, 'members')));
  });

  it('a non-member cannot add, change or delete items', async () => {
    const f = db('mallory');
    await assertFails(setDoc(doc(f, 'households', HID, 'items', 'i2'), { name: 'x' }));
    await assertFails(updateDoc(doc(f, 'households', HID, 'items', 'i1'), { name: 'x' }));
    await assertFails(deleteDoc(doc(f, 'households', HID, 'items', 'i1')));
    await assertFails(deleteDoc(doc(f, 'households', HID, 'activity', 'a1')));
  });

  it('a non-member cannot rename or delete the home', async () => {
    const f = db('mallory');
    await assertFails(updateDoc(doc(f, 'households', HID), { name: 'pwned' }));
    await assertFails(deleteDoc(doc(f, 'households', HID)));
  });

  it("nobody reads or writes another user's profile", async () => {
    await assertFails(getDoc(doc(db('mallory'), 'users', 'alice')));
    await assertFails(setDoc(doc(db('mallory'), 'users', 'alice'), { x: 1 }));
  });

  it('cannot join as OWNER or on behalf of someone else', async () => {
    await assertFails(
      setDoc(doc(db('mallory'), 'households', HID, 'members', 'mallory'), memberDoc('mallory', 'OWNER'))
    );
    await assertFails(
      setDoc(doc(db('mallory'), 'households', HID, 'members', 'bob'), memberDoc('bob', 'MEMBER'))
    );
  });

  it('a member cannot promote themselves or remove others', async () => {
    await setDoc(doc(db('bob'), 'households', HID, 'members', 'bob'), memberDoc('bob', 'MEMBER', CODE));
    await setDoc(doc(db('carol'), 'households', HID, 'members', 'carol'), memberDoc('carol', 'MEMBER', CODE));
    await assertFails(updateDoc(doc(db('bob'), 'households', HID, 'members', 'bob'), { role: 'OWNER' }));
    await assertFails(deleteDoc(doc(db('bob'), 'households', HID, 'members', 'carol')));
    await assertFails(updateDoc(doc(db('bob'), 'households', HID), { inviteCode: 'NEW123' }));
  });

  it('cannot hijack an invite code of another home', async () => {
    const f = db('mallory');
    const batch = writeBatch(f);
    batch.set(doc(f, 'households', 'evil'), homeDoc('mallory', CODE));
    batch.set(doc(f, 'households', 'evil', 'members', 'mallory'), memberDoc('mallory', 'OWNER'));
    await assertSucceeds(batch.commit());
    await assertFails(setDoc(doc(f, 'inviteCodes', CODE), { householdId: 'evil' }));
    await assertFails(getDocs(collection(f, 'inviteCodes')));
  });

  it('a creator who LEFT cannot read or write the list any more', async () => {
    await setDoc(doc(db('bob'), 'households', HID, 'members', 'bob'), memberDoc('bob', 'MEMBER', CODE));
    await deleteDoc(doc(db('alice'), 'households', HID, 'members', 'alice'));
    const f = db('alice');
    await assertFails(getDocs(collection(f, 'households', HID, 'items')));
    await assertFails(setDoc(doc(f, 'households', HID, 'items', 'i9'), { name: 'x' }));
    await assertFails(getDoc(doc(f, 'households', HID, 'activity', 'a1')));
    await assertFails(setDoc(doc(f, 'households', HID, 'activity', 'a9'), { type: 'x' }));
  });

  it('server-only collections and unauthenticated access are denied', async () => {
    await assertFails(getDoc(doc(db('mallory'), 'categoryAiCache', 'milk')));
    await assertFails(setDoc(doc(db('mallory'), 'pushBatches', 'x'), { items: [] }));
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'households', HID)));
    await assertFails(getDocs(query(collection(anon, 'households'), where('inviteCode', '==', CODE))));
  });
});

describe('known transitional gaps (closed in phase 2)', () => {
  it('a signed-in stranger can still list homes (legacy invite query)', async () => {
    await createHomeNew('alice');
    await assertSucceeds(getDocs(query(collection(db('mallory'), 'households'), limit(10))));
  });
});
