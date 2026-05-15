import {
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  deleteUser,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  OAuthProvider,
  User,
} from 'firebase/auth';
import { auth } from '../remote/firebase';
import {
  firestoreGetUser,
  firestoreSetUser,
  firestoreDeleteUser,
  firestoreGetMemberCount,
  firestoreDeleteHousehold,
  firestoreLeaveHousehold,
  firestoreIsHouseholdMember,
} from '../remote/firestoreService';
import {
  localSetActiveHouseholdId,
  localClearHouseholdData,
  localClearActiveHousehold,
} from '../local/storage';
import { resetSessionState } from '../session/resetSession';
import { UserProfile } from '../models';

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
    await createUserWithEmailAndPassword(auth, email, password);
    // Profile creation handled by the auth state observer; see signInWithGoogle.
  },

  getOrCreateUserProfile: async (): Promise<UserProfile | null> => {
    const user = auth.currentUser;
    if (!user) return null;

    const existing = await firestoreGetUser(user.uid);
    if (existing) {
      let activeHouseholdId = (existing.activeHouseholdId as string | null) ?? null;
      if (activeHouseholdId) {
        const isMember = await firestoreIsHouseholdMember(activeHouseholdId, user.uid);
        if (!isMember) {
          activeHouseholdId = null;
          await firestoreSetUser(user.uid, { activeHouseholdId: null });
        } else {
          await localSetActiveHouseholdId(user.uid, activeHouseholdId);
        }
      }
      return {
        ...(existing as unknown as UserProfile),
        activeHouseholdId,
      };
    }

    const profile: UserProfile = {
      id: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      email: user.email || '',
      activeHouseholdId: null,
    };
    await firestoreSetUser(user.uid, profile as unknown as Record<string, unknown>);
    return profile;
  },

  updateActiveHousehold: async (householdId: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await firestoreSetUser(uid, { activeHouseholdId: householdId });
    await localSetActiveHouseholdId(uid, householdId);
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
