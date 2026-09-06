import { useAuthStore } from './useAuthStore';
import { useHouseholdStore } from './useHouseholdStore';
import { resolveSessionRoute, type SessionRoute } from '../session/sessionRouting';

export function useSessionRoute(): SessionRoute {
  const hasBootstrapped = useAuthStore((s) => s.hasBootstrapped);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isRestoringSession = useAuthStore((s) => s.isRestoringSession);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const householdResolution = useAuthStore((s) => s.householdResolution);
  const lastHouseholdId = useAuthStore((s) => s.lastHouseholdId);
  const profileHouseholdId = useAuthStore((s) => s.profile?.activeHouseholdId ?? null);
  const user = useAuthStore((s) => s.user);
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);

  const needsEmailVerification =
    !!user &&
    !user.emailVerified &&
    user.providerData?.[0]?.providerId === 'password';

  return resolveSessionRoute({
    hasBootstrapped,
    isLoading,
    isRestoringSession,
    isSubmitting,
    isSignedIn,
    householdResolution,
    activeHouseholdId,
    profileHouseholdId,
    lastHouseholdId,
    needsEmailVerification,
  });
}
