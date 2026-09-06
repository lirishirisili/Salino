export type HouseholdResolution = 'pending' | 'has_household' | 'no_household';

export type SessionRoute =
  | 'loading'
  | 'auth'
  | 'verify-email'
  | 'main'
  | 'household-setup';

export type NullAuthDecision = 'sign_out' | 'keep_session' | 'await_hydration';

export type ProfileLoadStatus = 'ready' | 'created' | 'incomplete';
export type ProfileLoadSource = 'server' | 'cache';

export type ProfileLoadResult =
  | { status: 'ready'; profile: { activeHouseholdId: string | null }; source: ProfileLoadSource }
  | { status: 'created'; profile: { activeHouseholdId: string | null } }
  | { status: 'incomplete'; profile: { activeHouseholdId: string | null } | null; reason: string };

export function decideNullAuthAction(input: {
  explicitSignOut: boolean;
  hasPersistedSession: boolean;
  isSignedIn: boolean;
  hasBootstrapped: boolean;
}): NullAuthDecision {
  if (input.explicitSignOut) return 'sign_out';
  // A live session or a disk snapshot means this null is almost certainly a
  // Firebase hydration / token-refresh blip — never treat it as logout.
  if (input.hasPersistedSession || input.isSignedIn) return 'keep_session';
  if (!input.hasBootstrapped) return 'await_hydration';
  return 'sign_out';
}

/**
 * Only a confirmed server "this user has no household" (or a newly created
 * profile) may route to household-setup. Cache misses, timeouts, and partial
 * FCM docs must not.
 */
export function shouldResetHouseholdFromProfile(result: ProfileLoadResult): boolean {
  if (result.status === 'incomplete') return false;
  if (result.status === 'created') return !result.profile.activeHouseholdId;
  return result.source === 'server' && !result.profile.activeHouseholdId;
}

export function householdIdFromProfileResult(result: ProfileLoadResult): string | null {
  return result.profile?.activeHouseholdId ?? null;
}

export function resolveSessionRoute(input: {
  hasBootstrapped: boolean;
  isLoading: boolean;
  isRestoringSession: boolean;
  isSubmitting: boolean;
  isSignedIn: boolean;
  householdResolution: HouseholdResolution;
  activeHouseholdId: string | null;
  profileHouseholdId: string | null;
  lastHouseholdId: string | null;
  needsEmailVerification: boolean;
}): SessionRoute {
  if (
    !input.hasBootstrapped ||
    input.isLoading ||
    input.isRestoringSession ||
    input.isSubmitting
  ) {
    return 'loading';
  }

  if (!input.isSignedIn) return 'auth';

  if (input.needsEmailVerification) return 'verify-email';

  const hasHousehold =
    !!input.activeHouseholdId ||
    !!input.profileHouseholdId ||
    !!input.lastHouseholdId ||
    input.householdResolution === 'has_household';

  if (hasHousehold) return 'main';

  if (input.householdResolution === 'pending') return 'loading';
  if (input.householdResolution === 'no_household') return 'household-setup';

  return 'loading';
}

export function isRecoverableAuthPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/auth' ||
    pathname === '/household-setup' ||
    pathname === '/index'
  );
}
