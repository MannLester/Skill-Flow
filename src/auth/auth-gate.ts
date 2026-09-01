export type AuthGateState = 'loading' | 'signed-out' | 'backend-recovery' | 'profile-onboarding' | 'authenticated';

export function resolveAuthGateState({
  isClerkLoaded,
  isSignedIn,
  isConvexLoading,
  isAuthenticated,
  profile,
}: {
  isClerkLoaded: boolean;
  isSignedIn: boolean | undefined;
  isConvexLoading: boolean;
  isAuthenticated: boolean;
  profile: unknown | null | undefined;
}): AuthGateState {
  if (!isClerkLoaded || (isSignedIn && isConvexLoading)) return 'loading';
  if (!isSignedIn) return 'signed-out';
  if (!isAuthenticated) return 'backend-recovery';
  if (profile === undefined) return 'loading';
  if (profile === null) return 'profile-onboarding';
  return 'authenticated';
}
