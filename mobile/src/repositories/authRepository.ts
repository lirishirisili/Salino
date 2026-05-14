import {
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  OAuthProvider,
  User,
} from 'firebase/auth';
import { auth } from '../remote/firebase';
import { firestoreGetUser, firestoreSetUser } from '../remote/firestoreService';
import { localClearAll, localSetActiveHouseholdId } from '../local/storage';
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
      if (existing.activeHouseholdId) {
        await localSetActiveHouseholdId(existing.activeHouseholdId as string);
      }
      return existing as unknown as UserProfile;
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
    await localSetActiveHouseholdId(householdId);
  },

  signOut: async (): Promise<void> => {
    await localClearAll();
    await firebaseSignOut(auth);
  },

  getDisplayName: (): string => {
    return auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'User';
  },
};
