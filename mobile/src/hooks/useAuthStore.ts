import { create } from 'zustand';
import { AppState } from 'react-native';
import { User } from 'firebase/auth';
import { authRepository } from '../repositories';
import { UserProfile } from '../models';
import { resetSessionState } from '../session/resetSession';
import {
  beginExplicitSignOut,
  clearSessionSnapshot,
  endExplicitSignOut,
  getSessionSnapshotSync,
  isExplicitSignOut,
  loadSessionSnapshot,
  persistSessionSnapshot,
  recoverSnapshotFromHouseholdCache,
  rememberSessionHousehold,
  rememberSessionUser,
} from '../session/sessionRestore';
import {
  decideNullAuthAction,
  householdIdFromProfileResult,
  shouldResetHouseholdFromProfile,
  type HouseholdResolution,
} from '../session/sessionRouting';
import { useHouseholdStore } from './useHouseholdStore';
import { useNotificationStore } from './useNotificationStore';
import { localGetActiveHouseholdId } from '../local/storage';
import { unregisterNotifications } from '../services/notificationService';
import { perfMark } from '../utils/perf';
import { auth } from '../remote/firebase';

const HYDRATION_WAIT_MS = 2000;

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  /**
   * True after the first auth callback finishes. Keeps the root navigator mounted
   * across later auth refreshes so the back stack is not remounted/duplicated.
   */
  hasBootstrapped: boolean;
  /** True while Firebase persistence / token refresh is being reconciled. */
  isRestoringSession: boolean;
  /** True while a sign-in/register action is in flight (not app bootstrap). */
  isSubmitting: boolean;
  error: string | null;
  isSignedIn: boolean;
  householdResolution: HouseholdResolution;
  lastHouseholdId: string | null;

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
  markHouseholdResolution: (resolution: HouseholdResolution) => void;
  clearError: () => void;
}

let previousAuthUid: string | null = null;
let authEventSeq = 0;
let authObserverStarted = false;

function invalidateAuthEvents(): void {
  authEventSeq += 1;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  hasBootstrapped: false,
  isRestoringSession: false,
  isSubmitting: false,
  error: null,
  isSignedIn: false,
  householdResolution: 'pending',
  lastHouseholdId: null,

  initialize: () => {
    if (!authObserverStarted) {
      authObserverStarted = true;
      void startAuthObserver(set, get);
    }
    // Process-lifetime observer — RootLayout remounts must not unsubscribe,
    // or Firebase can emit a transient null on resubscribe.
    return () => {};
  },

  signInWithGoogle: async (idToken: string) => {
    set({ isSubmitting: true, error: null, householdResolution: 'pending' });
    try {
      await authRepository.signInWithGoogle(idToken);
    } catch (e: any) {
      set({ error: mapAuthError(e), isSubmitting: false });
    }
  },

  signInWithApple: async (identityToken, rawNonce, fullName) => {
    set({ isSubmitting: true, error: null, householdResolution: 'pending' });
    try {
      await authRepository.signInWithApple(identityToken, rawNonce, fullName);
    } catch (e: unknown) {
      set({ error: mapAppleAuthError(e), isSubmitting: false });
      throw e;
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    set({ isSubmitting: true, error: null, householdResolution: 'pending' });
    try {
      await authRepository.signInWithEmail(email, password);
    } catch (e: any) {
      set({ error: mapAuthError(e), isSubmitting: false });
    }
  },

  registerWithEmail: async (email: string, password: string) => {
    set({ isSubmitting: true, error: null, householdResolution: 'pending' });
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
    beginExplicitSignOut();
    invalidateAuthEvents();
    await clearSessionSnapshot();
    await unregisterNotifications().catch(() => undefined);
    useNotificationStore.getState().reset();
    await authRepository.signOut();
    previousAuthUid = null;
    set({
      user: null,
      profile: null,
      isSignedIn: false,
      lastHouseholdId: null,
      householdResolution: 'pending',
      isRestoringSession: false,
    });
    endExplicitSignOut();
  },

  deleteAccount: async () => {
    set({ isLoading: true, error: null });
    beginExplicitSignOut();
    invalidateAuthEvents();
    try {
      await unregisterNotifications().catch(() => undefined);
      useNotificationStore.getState().reset();
      await clearSessionSnapshot();
      await authRepository.deleteAccount();
      previousAuthUid = null;
      set({
        user: null,
        profile: null,
        isSignedIn: false,
        isLoading: false,
        lastHouseholdId: null,
        householdResolution: 'pending',
        isRestoringSession: false,
      });
    } catch (e: any) {
      const code = e?.code as string | undefined;
      const errorKey =
        code === 'auth/requires-recent-login'
          ? 'settings_delete_account_requires_recent_login'
          : 'settings_delete_account_error';
      set({ error: errorKey, isLoading: false });
      throw e;
    } finally {
      endExplicitSignOut();
    }
  },

  markHouseholdResolution: (resolution) => {
    set({
      householdResolution: resolution,
      lastHouseholdId:
        resolution === 'no_household' ? null : get().lastHouseholdId,
    });
  },

  clearError: () => set({ error: null }),
}));

type AuthSet = typeof useAuthStore.setState;
type AuthGet = typeof useAuthStore.getState;

async function startAuthObserver(set: AuthSet, get: AuthGet): Promise<void> {
  await eagerRestoreFromDisk(set);
  authRepository.observeAuthState((user) => {
    const seq = ++authEventSeq;
    const explicitAtEvent = isExplicitSignOut();
    const snapshotAtEvent = getSessionSnapshotSync();
    const signedInAtEvent = get().isSignedIn;

    void (async () => {
      try {
        if (!user) {
          await handleNullUser({
            seq,
            set,
            get,
            explicitAtEvent,
            snapshotAtEvent,
            signedInAtEvent,
          });
          return;
        }
        await handleSignedInUser({ seq, set, get, user });
      } catch (e) {
        console.error('Auth bootstrap error:', e);
      } finally {
        if (seq !== authEventSeq) return;
        if (!user) {
          const decision = decideNullAuthAction({
            explicitSignOut: explicitAtEvent,
            hasPersistedSession: !!snapshotAtEvent?.uid,
            isSignedIn: signedInAtEvent,
            hasBootstrapped: get().hasBootstrapped,
          });
          if (decision === 'keep_session') return;
          // Hydration wait found a user — the signed-in event will finish boot.
          if (decision === 'await_hydration' && (auth.currentUser || getSessionSnapshotSync()?.uid)) {
            return;
          }
        }
        set({
          isLoading: false,
          isSubmitting: false,
          hasBootstrapped: true,
          isRestoringSession: false,
        });
      }
    })();
  });

  AppState.addEventListener('change', (next) => {
    if (next !== 'active') return;
    const state = get();
    if (!state.isSignedIn || !state.user) return;
    if (state.householdResolution !== 'pending') return;
    void refreshProfileSafely(state.user, authEventSeq, set, get);
  });
}

async function eagerRestoreFromDisk(set: AuthSet): Promise<void> {
  const snap = await loadSessionSnapshot();
  if (!snap?.uid) return;
  previousAuthUid = previousAuthUid ?? snap.uid;
  set({
    isRestoringSession: true,
    lastHouseholdId: snap.householdId,
    householdResolution: snap.householdId ? 'has_household' : 'pending',
  });
  if (snap.householdId) {
    try {
      await useHouseholdStore.getState().setActiveHouseholdFromProfile(snap.householdId);
    } catch {
      // Cache preload failed — household id is still enough to stay off join-house.
    }
  }
}

async function handleNullUser(args: {
  seq: number;
  set: AuthSet;
  get: AuthGet;
  explicitAtEvent: boolean;
  snapshotAtEvent: ReturnType<typeof getSessionSnapshotSync>;
  signedInAtEvent: boolean;
}): Promise<void> {
  const { seq, set, get, explicitAtEvent, snapshotAtEvent, signedInAtEvent } = args;
  const decision = decideNullAuthAction({
    explicitSignOut: explicitAtEvent,
    hasPersistedSession: !!snapshotAtEvent?.uid,
    isSignedIn: signedInAtEvent,
    hasBootstrapped: get().hasBootstrapped,
  });

  if (decision === 'keep_session') {
    console.warn('[session] ignored transient auth null');
    return;
  }

  if (decision === 'await_hydration') {
    await delay(HYDRATION_WAIT_MS);
    if (seq !== authEventSeq) return;
    if (auth.currentUser) return;
    if (getSessionSnapshotSync()?.uid) return;
    const recovered = await recoverSnapshotFromHouseholdCache();
    if (recovered) {
      await persistSessionSnapshot(recovered);
      set({
        isRestoringSession: true,
        lastHouseholdId: recovered.householdId,
        householdResolution: recovered.householdId ? 'has_household' : 'pending',
      });
      if (recovered.householdId) {
        await useHouseholdStore.getState().setActiveHouseholdFromProfile(recovered.householdId).catch(
          () => undefined
        );
      }
      console.warn('[session] ignored auth null; recovered household cache');
      return;
    }
  }

  if (seq !== authEventSeq) return;
  previousAuthUid = null;
  await resetSessionState();
  set({
    user: null,
    profile: null,
    isSignedIn: false,
    lastHouseholdId: null,
    householdResolution: 'pending',
    isRestoringSession: false,
  });
}

async function handleSignedInUser(args: {
  seq: number;
  set: AuthSet;
  get: AuthGet;
  user: User;
}): Promise<void> {
  const { seq, set, get, user } = args;
  const uidChanged = previousAuthUid !== null && previousAuthUid !== user.uid;

  if (uidChanged) {
    await resetSessionState();
  }
  previousAuthUid = user.uid;
  await rememberSessionUser(user.uid);

  if (seq !== authEventSeq) return;

  perfMark('auth_restored');
  set({
    isSignedIn: true,
    user,
    isRestoringSession: false,
    lastHouseholdId: get().lastHouseholdId ?? getSessionSnapshotSync()?.householdId ?? null,
  });

  // Same account re-fired (token refresh / remount). Never re-run a profile
  // path that can clear the household — just refresh the user object.
  if (get().hasBootstrapped && !uidChanged) {
    void refreshProfileSafely(user, seq, set, get);
    return;
  }

  if (uidChanged) {
    set({ householdResolution: 'pending', lastHouseholdId: null });
  }

  let fastPathDone = false;
  try {
    const snap = getSessionSnapshotSync();
    const cachedHouseholdId =
      (await localGetActiveHouseholdId(user.uid)) ??
      (snap?.uid === user.uid ? snap.householdId : null);
    if (cachedHouseholdId) {
      await useHouseholdStore.getState().setActiveHouseholdFromProfile(cachedHouseholdId);
      await rememberSessionHousehold(cachedHouseholdId);
      fastPathDone = true;
      if (seq !== authEventSeq) return;
      set({
        isLoading: false,
        hasBootstrapped: true,
        householdResolution: 'has_household',
        lastHouseholdId: cachedHouseholdId,
      });
    }
  } catch {
    // Fast path failed — fall through to network path.
  }

  if (!fastPathDone && !get().hasBootstrapped) {
    set({ isSubmitting: true });
  }

  let profileTimedOut = false;
  let profileResult = null as Awaited<ReturnType<typeof authRepository.getOrCreateUserProfile>> | null;
  try {
    profileResult = await Promise.race([
      authRepository.getOrCreateUserProfile(),
      new Promise<null>((resolve) => {
        setTimeout(() => {
          profileTimedOut = true;
          resolve(null);
        }, 8000);
      }),
    ]);
  } catch {
    profileResult = null;
  }

  if (seq !== authEventSeq) return;

  if (!profileResult || profileTimedOut) {
    if (fastPathDone) {
      set({ isSignedIn: true, user });
      return;
    }
    const fallbackHouse =
      get().lastHouseholdId ??
      useHouseholdStore.getState().activeHouseholdId ??
      getSessionSnapshotSync()?.householdId ??
      null;
    set({
      user,
      profile: null,
      isSignedIn: true,
      householdResolution: fallbackHouse ? 'has_household' : 'pending',
      lastHouseholdId: fallbackHouse,
    });
    return;
  }

  const serverHouseholdId = householdIdFromProfileResult(profileResult);
  if (serverHouseholdId) {
    const currentHouseholdId = useHouseholdStore.getState().activeHouseholdId;
    if (currentHouseholdId !== serverHouseholdId) {
      await Promise.race([
        useHouseholdStore.getState().setActiveHouseholdFromProfile(serverHouseholdId),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);
    }
    await rememberSessionHousehold(serverHouseholdId);
    if (seq !== authEventSeq) return;
    set({
      user,
      profile: (profileResult.profile as UserProfile | null) ?? get().profile,
      isSignedIn: true,
      householdResolution: 'has_household',
      lastHouseholdId: serverHouseholdId,
    });
    return;
  }

  if (shouldResetHouseholdFromProfile(profileResult) && !profileTimedOut) {
    useHouseholdStore.getState().reset();
    await rememberSessionHousehold(null);
    if (seq !== authEventSeq) return;
    set({
      user,
      profile: (profileResult.profile as UserProfile | null) ?? get().profile,
      isSignedIn: true,
      householdResolution: 'no_household',
      lastHouseholdId: null,
    });
    return;
  }

  // Incomplete / cache-without-house: keep whatever house we already have.
  const keptHouse =
    useHouseholdStore.getState().activeHouseholdId ??
    get().lastHouseholdId ??
    getSessionSnapshotSync()?.householdId ??
    null;
  set({
    user,
    profile: (profileResult.profile as UserProfile | null) ?? get().profile,
    isSignedIn: true,
    householdResolution: keptHouse ? 'has_household' : get().householdResolution,
    lastHouseholdId: keptHouse,
  });
}

async function refreshProfileSafely(
  user: User,
  seq: number,
  set: AuthSet,
  get: AuthGet
): Promise<void> {
  try {
    const result = await authRepository.getOrCreateUserProfile();
    if (seq !== authEventSeq) return;
    const householdId = householdIdFromProfileResult(result);
    if (householdId) {
      const current = useHouseholdStore.getState().activeHouseholdId;
      if (current !== householdId) {
        await useHouseholdStore.getState().setActiveHouseholdFromProfile(householdId);
      }
      await rememberSessionHousehold(householdId);
      if (seq !== authEventSeq) return;
      set({
        user,
        profile: (result.profile as UserProfile | null) ?? get().profile,
        householdResolution: 'has_household',
        lastHouseholdId: householdId,
      });
      return;
    }
    if (result.profile) {
      set({ user, profile: result.profile });
    }
  } catch {
    // Background refresh must never sign the user out or clear the house.
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
