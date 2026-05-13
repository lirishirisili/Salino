import { create } from 'zustand';
import { User } from 'firebase/auth';
import { authRepository } from '../repositories';
import { UserProfile } from '../models';

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
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  error: null,
  isSignedIn: false,

  initialize: () => {
    const unsubscribe = authRepository.observeAuthState(async (user) => {
      if (user) {
        const profile = await authRepository.getOrCreateUserProfile();
        set({ user, profile, isSignedIn: true, isLoading: false });
      } else {
        set({ user: null, profile: null, isSignedIn: false, isLoading: false });
      }
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
    set({ user: null, profile: null, isSignedIn: false });
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
