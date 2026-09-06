import {
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  deleteUser,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  OAuthProvider,
  User,
} from 'firebase/auth';
import { auth } from '../remote/firebase';
import i18n from 'i18next';
import {
  firestoreGetUser,
  firestoreGetUserFromServer,
  firestoreSetUser,
  firestoreDeleteUser,
  firestoreGetMemberCount,
  firestoreDeleteHousehold,
  firestoreLeaveHousehold,
  firestoreIsHouseholdMemberFromServer,
} from '../remote/firestoreService';
import {
  localSetActiveHouseholdId,
  localClearHouseholdData,
  localClearActiveHousehold,
} from '../local/storage';
import { resetSessionState } from '../session/resetSession';
import { UserProfile } from '../models';
import type { ProfileLoadResult } from '../session/sessionRouting';

/** Sync Firebase Auth language with the app's current i18n language. */
function syncAuthLanguage(): void {
  auth.languageCode = i18n.language || 'en';
}

export const authRepository = {
  getCurrentUserId: (): string | null => auth.currentUser?.uid ?? null,

  isSignedIn: (): boolean => !!auth.currentUser,

  observeAuthState: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },

  signInWithGoogle: async (idToken: string): Promise<void> => {
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
    // Profile creation is handled exactly once by the auth state observer in
    // useAuthStore.initialize. Doing it again here would duplicate the
    // Firestore round-trip on the critical sign-in path.
  },

  signInWithApple: async (
    identityToken: string,
    rawNonce: string,
    fullName?: { givenName?: string | null; familyName?: string | null } | null
  ): Promise<void> => {
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: identityToken,
      rawNonce,
    });
    await signInWithCredential(auth, credential);
    const user = auth.currentUser;
    if (user && !user.displayName && fullName) {
      const combined = [fullName.givenName, fullName.familyName]
        .filter((p) => !!p && (p as string).trim().length > 0)
        .join(' ')
        .trim();
      if (combined) {
        try {
          await updateProfile(user, { displayName: combined });
        } catch {
          // Non-fatal: profile name is best-effort on first Apple sign-in.
        }
      }
    }
    // Profile creation handled by the auth state observer; see signInWithGoogle.
  },

  signInWithEmail: async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
    // Profile creation handled by the auth state observer; see signInWithGoogle.
  },

  registerWithEmail: async (email: string, password: string): Promise<void> => {
    syncAuthLanguage();
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(user);
    // Profile creation handled by the auth state observer; see signInWithGoogle.
  },

  sendVerificationEmail: async (): Promise<void> => {
    syncAuthLanguage();
    const user = auth.currentUser;
    if (user && !user.emailVerified) {
      await sendEmailVerification(user);
    }
  },

  reloadUser: async (): Promise<void> => {
    await auth.currentUser?.reload();
  },

  isEmailVerified: (): boolean => {
    return auth.currentUser?.emailVerified ?? false;
  },

  sendPasswordReset: async (email: string): Promise<void> => {
    syncAuthLanguage();
    await sendPasswordResetEmail(auth, email);
  },

  getOrCreateUserProfile: async (): Promise<ProfileLoadResult> => {
    const user = auth.currentUser;
    if (!user) {
      return { status: 'incomplete', profile: null, reason: 'no_auth' };
    }

    // Always read from the server (with retries) — mirrors native
    // `fetchUserSnapshotFromServer`. Never trust cache-first reads for
    // routing decisions (partial pending writes can lack activeHouseholdId).
    let serverDoc: Record<string, unknown> | null | undefined;
    let serverFailed = false;
    try {
      serverDoc = await firestoreGetUserFromServer(user.uid);
    } catch {
      serverFailed = true;
      serverDoc = undefined;
    }

    if (!serverFailed && serverDoc) {
      const profile = await resolveAuthoritativeProfile(user.uid, serverDoc);
      return { status: 'ready', source: 'server', profile };
    }

    if (!serverFailed && serverDoc === null) {
      // Server confirmed the document does not exist — new account.
      // Do NOT write activeHouseholdId: null; a merge of that field would
      // clobber a household if this read was wrong. Re-read after create.
      await firestoreSetUser(user.uid, {
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
      });
      try {
        const confirmed = await firestoreGetUserFromServer(user.uid);
        if (confirmed) {
          const profile = await resolveAuthoritativeProfile(user.uid, confirmed);
          return { status: 'created', profile };
        }
      } catch {
        // Created locally; household still unknown — caller must not route
        // to join-house from this incomplete confirmation.
      }
      return {
        status: 'incomplete',
        profile: {
          id: user.uid,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          activeHouseholdId: null,
        },
        reason: 'created_unconfirmed',
      };
    }

    // Server read failed. Cache is only usable when it already has a household.
    // A partial FCM merge doc without activeHouseholdId is NOT "no household".
    const cached = await firestoreGetUser(user.uid);
    const cachedHouseholdId =
      typeof cached?.activeHouseholdId === 'string' && cached.activeHouseholdId.length > 0
        ? cached.activeHouseholdId
        : null;
    if (cached && cachedHouseholdId) {
      await localSetActiveHouseholdId(user.uid, cachedHouseholdId).catch(() => undefined);
      return {
        status: 'ready',
        source: 'cache',
        profile: {
          ...(cached as unknown as UserProfile),
          activeHouseholdId: cachedHouseholdId,
        },
      };
    }
    return {
      status: 'incomplete',
      profile: cached ? (cached as unknown as UserProfile) : null,
      reason: 'server_failed',
    };
  },

  updateActiveHousehold: async (householdId: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await firestoreSetUser(uid, { activeHouseholdId: householdId });
    await localSetActiveHouseholdId(uid, householdId);
    const { rememberSessionHousehold } = await import('../session/sessionRestore');
    await rememberSessionHousehold(householdId);
  },

  signOut: async (): Promise<void> => {
    await resetSessionState();
    await firebaseSignOut(auth);
  },

  deleteAccount: async (): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
      throw Object.assign(new Error('Not signed in'), { code: 'auth/not-signed-in' });
    }

    const profile = await firestoreGetUser(user.uid);
    const householdId =
      (profile?.activeHouseholdId as string | null | undefined) ?? null;

    if (householdId) {
      const memberCount = await firestoreGetMemberCount(householdId);
      if (memberCount <= 1) {
        await firestoreDeleteHousehold(householdId);
      } else {
        await firestoreLeaveHousehold(householdId, user.uid);
      }
      await localClearHouseholdData(householdId);
      await localClearActiveHousehold(user.uid);
    }

    await firestoreDeleteUser(user.uid);
    await resetSessionState();
    await deleteUser(user);
  },

  getDisplayName: (): string => {
    return auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'User';
  },
};

async function resolveAuthoritativeProfile(
  uid: string,
  existing: Record<string, unknown>
): Promise<UserProfile> {
  let activeHouseholdId =
    typeof existing.activeHouseholdId === 'string' && existing.activeHouseholdId.length > 0
      ? existing.activeHouseholdId
      : null;

  if (activeHouseholdId) {
    try {
      const isMember = await firestoreIsHouseholdMemberFromServer(activeHouseholdId, uid);
      if (!isMember) {
        activeHouseholdId = null;
        await firestoreSetUser(uid, { activeHouseholdId: null });
      } else {
        await localSetActiveHouseholdId(uid, activeHouseholdId);
      }
    } catch {
      // Network error during membership check — keep the server household id.
      await localSetActiveHouseholdId(uid, activeHouseholdId).catch(() => undefined);
    }
  }

  return {
    ...(existing as unknown as UserProfile),
    id: uid,
    activeHouseholdId,
  };
}
