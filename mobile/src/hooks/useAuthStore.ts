import { create } from 'zustand';
import { User } from 'firebase/auth';
import { authRepository } from '../repositories';
import { UserProfile } from '../models';
import { resetSessionState } from '../session/resetSession';
import { useHouseholdStore } from './useHouseholdStore';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  isSignedIn: boolean;

  initialize: () => () => void;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: (
    identityToken: string,
    rawNonce: string,
    fullName?: { givenName?: string | null; familyName?: string | null } | null
  ) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

let previousAuthUid: string | null = null;

function applyProfileToHouseholdStore(profile: UserProfile | null): void {
  if (profile?.activeHouseholdId) {
    useHouseholdStore.getState().setActiveHouseholdFromProfile(profile.activeHouseholdId);
  } else {
    useHouseholdStore.getState().reset();
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  error: null,
  isSignedIn: false,

  initialize: () => {
    const unsubscribe = authRepository.observeAuthState(async (user) => {
      if (!user) {
        previousAuthUid = null;
        await resetSessionState();
        set({ user: null, profile: null, isSignedIn: false, isLoading: false });
        return;
      }

      if (previousAuthUid !== user.uid) {
        await resetSessionState();
      }
      previousAuthUid = user.uid;

      set({ isLoading: true, isSignedIn: true, user });

      let profile: UserProfile | null = null;
      try {
        profile = await Promise.race<UserProfile | null>([
          authRepository.getOrCreateUserProfile(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
      } catch {
        profile = null;
      }

      applyProfileToHouseholdStore(profile);
      set({ user, profile, isSignedIn: true, isLoading: false });
    });
    return unsubscribe;
  },

  signInWithGoogle: async (idToken: string) => {
    set({ isLoading: true, error: null });
    try {
      await authRepository.signInWithGoogle(idToken);
    } catch (e: any) {
      set({ error: mapAuthError(e.code), isLoading: false });
    }
  },

  signInWithApple: async (identityToken, rawNonce, fullName) => {
    set({ isLoading: true, error: null });
    try {
      await authRepository.signInWithApple(identityToken, rawNonce, fullName);
    } catch (e: any) {
      set({ error: mapAuthError(e.code), isLoading: false });
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await authRepository.signInWithEmail(email, password);
    } catch (e: any) {
      set({ error: mapAuthError(e.code), isLoading: false });
    }
  },

  registerWithEmail: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await authRepository.registerWithEmail(email, password);
    } catch (e: any) {
      set({ error: mapAuthError(e.code), isLoading: false });
    }
  },

  signOut: async () => {
    await authRepository.signOut();
    previousAuthUid = null;
    set({ user: null, profile: null, isSignedIn: false });
  },

  deleteAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      await authRepository.deleteAccount();
      previousAuthUid = null;
      set({ user: null, profile: null, isSignedIn: false, isLoading: false });
    } catch (e: any) {
      const code = e?.code as string | undefined;
      const errorKey =
        code === 'auth/requires-recent-login'
          ? 'settings_delete_account_requires_recent_login'
          : 'settings_delete_account_error';
      set({ error: errorKey, isLoading: false });
      throw e;
    }
  },

  clearError: () => set({ error: null }),
}));

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'auth_error_invalid_credentials';
    case 'auth/user-not-found':
      return 'auth_error_user_not_found';
    case 'auth/invalid-email':
      return 'auth_error_invalid_email';
    case 'auth/email-already-in-use':
      return 'auth_error_email_in_use';
    case 'auth/weak-password':
      return 'auth_error_weak_password';
    case 'auth/too-many-requests':
      return 'auth_error_too_many_requests';
    default:
      return 'auth_error_generic';
  }
}
