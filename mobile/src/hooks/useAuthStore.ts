import { create } from 'zustand';
import { User } from 'firebase/auth';
import { authRepository } from '../repositories';
import { UserProfile } from '../models';
import { resetSessionState } from '../session/resetSession';
import { useHouseholdStore } from './useHouseholdStore';
import { useNotificationStore } from './useNotificationStore';
import { localGetActiveHouseholdId } from '../local/storage';
import { unregisterNotifications } from '../services/notificationService';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  /**
   * True after the first auth callback finishes. Keeps the root navigator mounted
   * across later auth refreshes so the back stack is not remounted/duplicated.
   */
  hasBootstrapped: boolean;
  /** True while a sign-in/register action is in flight (not app bootstrap). */
  isSubmitting: boolean;
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
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  checkEmailVerified: () => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

let previousAuthUid: string | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  hasBootstrapped: false,
  isSubmitting: false,
  error: null,
  isSignedIn: false,

  initialize: () => {
    const unsubscribe = authRepository.observeAuthState(async (user) => {
      if (!user) {
        previousAuthUid = null;
        await resetSessionState();
        set({
          user: null,
          profile: null,
          isSignedIn: false,
          isLoading: false,
          isSubmitting: false,
          hasBootstrapped: true,
        });
        return;
      }

      if (previousAuthUid !== null && previousAuthUid !== user.uid) {
        await resetSessionState();
      }
      previousAuthUid = user.uid;

      const alreadyBootstrapped = get().hasBootstrapped;
      set({ isSignedIn: true, user });

      // FAST PATH: read cached householdId from local storage and preload items
      // before waiting for network. This makes cold start near-instant.
      let fastPathDone = false;
      try {
        const cachedHouseholdId = await localGetActiveHouseholdId(user.uid);
        if (cachedHouseholdId) {
          await useHouseholdStore.getState().setActiveHouseholdFromProfile(cachedHouseholdId);
          fastPathDone = true;
          // Do not clear isSubmitting here — a sign-in action may still be in
          // flight and /auth waits for the final set() below before navigating.
          set({ isLoading: false });
        }
      } catch {
        // Fast path failed — fall through to network path.
      }

      // After the first boot, never flip isLoading back to true — that unmounts
      // the root navigator and duplicates screens on the back stack.
      if (!fastPathDone) {
        if (alreadyBootstrapped) {
          set({ isSubmitting: true });
        } else {
          set({ isLoading: true, isSubmitting: true });
        }
      }

      // BACKGROUND: verify profile from Firestore (creates if needed)
      let profile: UserProfile | null = null;
      try {
        profile = await Promise.race<UserProfile | null>([
          authRepository.getOrCreateUserProfile(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
      } catch {
        profile = null;
      }

      // If household changed on the server, update
      if (profile?.activeHouseholdId) {
        const currentHouseholdId = useHouseholdStore.getState().activeHouseholdId;
        if (currentHouseholdId !== profile.activeHouseholdId) {
          await useHouseholdStore.getState().setActiveHouseholdFromProfile(profile.activeHouseholdId);
        }
      } else if (!profile?.activeHouseholdId && fastPathDone) {
        // Server says no household but we loaded one from cache — reset
        useHouseholdStore.getState().reset();
      }

      set({
        user,
        profile,
        isSignedIn: true,
        isLoading: false,
        isSubmitting: false,
        hasBootstrapped: true,
      });
    });
    return unsubscribe;
  },

  signInWithGoogle: async (idToken: string) => {
    set({ isSubmitting: true, error: null });
    try {
      await authRepository.signInWithGoogle(idToken);
    } catch (e: any) {
      set({ error: mapAuthError(e), isSubmitting: false });
    }
  },

  signInWithApple: async (identityToken, rawNonce, fullName) => {
    set({ isSubmitting: true, error: null });
    try {
      await authRepository.signInWithApple(identityToken, rawNonce, fullName);
    } catch (e: unknown) {
      set({ error: mapAppleAuthError(e), isSubmitting: false });
      throw e;
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    set({ isSubmitting: true, error: null });
    try {
      await authRepository.signInWithEmail(email, password);
    } catch (e: any) {
      set({ error: mapAuthError(e), isSubmitting: false });
    }
  },

  registerWithEmail: async (email: string, password: string) => {
    set({ isSubmitting: true, error: null });
    try {
      await authRepository.registerWithEmail(email, password);
    } catch (e: any) {
      set({ error: mapAuthError(e), isSubmitting: false });
    }
  },

  sendPasswordReset: async (email: string) => {
    set({ isSubmitting: true, error: null });
    try {
      await authRepository.sendPasswordReset(email);
    } catch (e: any) {
      set({ error: mapAuthError(e), isSubmitting: false });
    }
    set({ isSubmitting: false });
  },

  resendVerificationEmail: async () => {
    try {
      await authRepository.sendVerificationEmail();
    } catch {
      // Silently ignore — Firebase rate-limits this anyway.
    }
  },

  checkEmailVerified: async (): Promise<boolean> => {
    await authRepository.reloadUser();
    return authRepository.isEmailVerified();
  },

  signOut: async () => {
    // Remove this device's push token before the session is torn down.
    await unregisterNotifications().catch(() => undefined);
    useNotificationStore.getState().reset();
    await authRepository.signOut();
    previousAuthUid = null;
    set({ user: null, profile: null, isSignedIn: false });
  },

  deleteAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      await unregisterNotifications().catch(() => undefined);
      useNotificationStore.getState().reset();
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

function mapAppleAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (__DEV__) {
    console.warn('[auth][apple]', code, error);
  }
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-oauth-provider-token':
      return 'auth_error_apple_firebase';
    case 'auth/network-request-failed':
      return 'auth_error_network';
    case 'auth/operation-not-allowed':
      return 'auth_error_operation_not_allowed';
    default:
      return 'auth_error_apple_failed';
  }
}

function mapAuthError(error: unknown): string {
  const code =
    (error as { code?: string })?.code ??
    (typeof error === 'string' ? error : undefined);
  if (__DEV__ && code) {
    console.warn('[auth]', code, error);
  }
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/invalid-login-credentials':
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
    case 'auth/network-request-failed':
      return 'auth_error_network';
    case 'auth/operation-not-allowed':
      return 'auth_error_operation_not_allowed';
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
      return 'auth_error_config';
    default:
      return 'auth_error_generic';
  }
}
