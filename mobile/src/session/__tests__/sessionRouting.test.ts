import {
  decideNullAuthAction,
  householdIdFromProfileResult,
  isRecoverableAuthPath,
  resolveSessionRoute,
  shouldResetHouseholdFromProfile,
  type ProfileLoadResult,
} from '../sessionRouting';

const baseRoute = {
  hasBootstrapped: true,
  isLoading: false,
  isRestoringSession: false,
  isSubmitting: false,
  isSignedIn: true,
  householdResolution: 'pending' as const,
  activeHouseholdId: null as string | null,
  profileHouseholdId: null as string | null,
  lastHouseholdId: null as string | null,
  needsEmailVerification: false,
};

describe('decideNullAuthAction', () => {
  it('signs out only on an explicit local sign-out', () => {
    expect(
      decideNullAuthAction({
        explicitSignOut: true,
        hasPersistedSession: true,
        isSignedIn: true,
        hasBootstrapped: true,
      })
    ).toBe('sign_out');
  });

  it('keeps the session when a disk snapshot exists', () => {
    expect(
      decideNullAuthAction({
        explicitSignOut: false,
        hasPersistedSession: true,
        isSignedIn: false,
        hasBootstrapped: true,
      })
    ).toBe('keep_session');
  });

  it('keeps the session when the user is already signed in', () => {
    expect(
      decideNullAuthAction({
        explicitSignOut: false,
        hasPersistedSession: false,
        isSignedIn: true,
        hasBootstrapped: true,
      })
    ).toBe('keep_session');
  });

  it('waits for Firebase hydration on a cold start with no snapshot', () => {
    expect(
      decideNullAuthAction({
        explicitSignOut: false,
        hasPersistedSession: false,
        isSignedIn: false,
        hasBootstrapped: false,
      })
    ).toBe('await_hydration');
  });

  it('signs out after bootstrap when there was never a session', () => {
    expect(
      decideNullAuthAction({
        explicitSignOut: false,
        hasPersistedSession: false,
        isSignedIn: false,
        hasBootstrapped: true,
      })
    ).toBe('sign_out');
  });
});

describe('shouldResetHouseholdFromProfile', () => {
  const noHouse = { activeHouseholdId: null };

  it('resets only on an authoritative server empty profile', () => {
    expect(
      shouldResetHouseholdFromProfile({ status: 'ready', source: 'server', profile: noHouse })
    ).toBe(true);
  });

  it('never resets from a cache profile missing a household', () => {
    expect(
      shouldResetHouseholdFromProfile({ status: 'ready', source: 'cache', profile: noHouse })
    ).toBe(false);
  });

  it('never resets from an incomplete/timeout result', () => {
    expect(
      shouldResetHouseholdFromProfile({
        status: 'incomplete',
        profile: noHouse,
        reason: 'server_failed',
      })
    ).toBe(false);
  });

  it('treats a newly created profile without a household as empty', () => {
    expect(
      shouldResetHouseholdFromProfile({ status: 'created', profile: noHouse })
    ).toBe(true);
  });

  it('does not reset when any source has a household id', () => {
    const withHouse = { activeHouseholdId: 'h1' };
    expect(
      shouldResetHouseholdFromProfile({ status: 'ready', source: 'server', profile: withHouse })
    ).toBe(false);
    expect(
      shouldResetHouseholdFromProfile({ status: 'ready', source: 'cache', profile: withHouse })
    ).toBe(false);
    expect(
      shouldResetHouseholdFromProfile({ status: 'created', profile: withHouse })
    ).toBe(false);
  });
});

describe('householdIdFromProfileResult', () => {
  it('reads the id from ready/created/incomplete profiles', () => {
    expect(
      householdIdFromProfileResult({
        status: 'ready',
        source: 'server',
        profile: { activeHouseholdId: 'h1' },
      })
    ).toBe('h1');
    expect(
      householdIdFromProfileResult({
        status: 'incomplete',
        profile: null,
        reason: 'no_auth',
      } as ProfileLoadResult)
    ).toBeNull();
  });
});

describe('resolveSessionRoute', () => {
  it('stays on loading until bootstrap finishes', () => {
    expect(resolveSessionRoute({ ...baseRoute, hasBootstrapped: false })).toBe('loading');
    expect(resolveSessionRoute({ ...baseRoute, isLoading: true })).toBe('loading');
    expect(resolveSessionRoute({ ...baseRoute, isRestoringSession: true })).toBe('loading');
    expect(resolveSessionRoute({ ...baseRoute, isSubmitting: true })).toBe('loading');
  });

  it('sends signed-out users to auth only after restore is done', () => {
    expect(resolveSessionRoute({ ...baseRoute, isSignedIn: false })).toBe('auth');
  });

  it('does not flash auth while a background restore is still running', () => {
    expect(
      resolveSessionRoute({
        ...baseRoute,
        isSignedIn: false,
        isRestoringSession: true,
      })
    ).toBe('loading');
  });

  it('requires email verification for password users', () => {
    expect(
      resolveSessionRoute({
        ...baseRoute,
        needsEmailVerification: true,
        activeHouseholdId: 'h1',
      })
    ).toBe('verify-email');
  });

  it('opens the house from any household signal, including last-known disk id', () => {
    expect(resolveSessionRoute({ ...baseRoute, activeHouseholdId: 'h1' })).toBe('main');
    expect(resolveSessionRoute({ ...baseRoute, profileHouseholdId: 'h1' })).toBe('main');
    expect(resolveSessionRoute({ ...baseRoute, lastHouseholdId: 'h1' })).toBe('main');
    expect(
      resolveSessionRoute({ ...baseRoute, householdResolution: 'has_household' })
    ).toBe('main');
  });

  it('never opens join-house while household status is still pending', () => {
    expect(
      resolveSessionRoute({ ...baseRoute, householdResolution: 'pending' })
    ).toBe('loading');
  });

  it('opens join-house only after a confirmed empty household', () => {
    expect(
      resolveSessionRoute({ ...baseRoute, householdResolution: 'no_household' })
    ).toBe('household-setup');
  });

  it('prefers the last-known house over a confirmed-empty flag', () => {
    expect(
      resolveSessionRoute({
        ...baseRoute,
        householdResolution: 'no_household',
        lastHouseholdId: 'h1',
      })
    ).toBe('main');
  });

  it('defaults to loading instead of join-house', () => {
    expect(
      resolveSessionRoute({
        ...baseRoute,
        householdResolution: 'pending',
      })
    ).toBe('loading');
  });
});

describe('isRecoverableAuthPath', () => {
  it('only bounces from the login/join/index gates', () => {
    expect(isRecoverableAuthPath('/auth')).toBe(true);
    expect(isRecoverableAuthPath('/household-setup')).toBe(true);
    expect(isRecoverableAuthPath('/')).toBe(true);
    expect(isRecoverableAuthPath('/(main)/shopping-list')).toBe(false);
    expect(isRecoverableAuthPath('/join/ABC123')).toBe(false);
  });
});
