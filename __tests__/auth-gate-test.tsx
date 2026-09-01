import { fireEvent, render, waitFor } from '@testing-library/react-native';

import OAuthNativeCallbackScreen from '@/app/oauth-native-callback';
import { resolveAuthGateState } from '@/auth/auth-gate';
import { AuthRecoveryState } from '@/providers/app-providers';

describe('authentication gate', () => {
  it.each([
    ['loading', { isClerkLoaded: false, isSignedIn: undefined, isConvexLoading: false, isAuthenticated: false, profile: undefined }],
    ['signed-out', { isClerkLoaded: true, isSignedIn: false, isConvexLoading: false, isAuthenticated: false, profile: undefined }],
    ['loading', { isClerkLoaded: true, isSignedIn: true, isConvexLoading: true, isAuthenticated: false, profile: undefined }],
    ['backend-recovery', { isClerkLoaded: true, isSignedIn: true, isConvexLoading: false, isAuthenticated: false, profile: undefined }],
    ['loading', { isClerkLoaded: true, isSignedIn: true, isConvexLoading: false, isAuthenticated: true, profile: undefined }],
    ['profile-onboarding', { isClerkLoaded: true, isSignedIn: true, isConvexLoading: false, isAuthenticated: true, profile: null }],
    ['authenticated', { isClerkLoaded: true, isSignedIn: true, isConvexLoading: false, isAuthenticated: true, profile: { role: 'student' } }],
  ] as const)('resolves %s without confusing Clerk and Convex state', (expected, input) => {
    expect(resolveAuthGateState(input)).toBe(expected);
  });

  it('offers retry and explicit sign-out when backend authentication fails', async () => {
    const retry = jest.fn();
    const signOut = jest.fn(async () => undefined);
    const screen = render(<AuthRecoveryState onRetry={retry} onSignOut={signOut} />);

    expect(screen.queryByText('Welcome back!')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Retry connection' }));
    expect(retry).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: 'Sign Out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it('renders a valid callback screen instead of an unmatched route', () => {
    const screen = render(<OAuthNativeCallbackScreen />);
    expect(screen.getByText('Completing sign-in')).toBeTruthy();
    expect(screen.getByText('Securely returning you to SkillFlow…')).toBeTruthy();
  });
});
