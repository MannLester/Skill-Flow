import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import OAuthNativeCallbackScreen from '@/app/oauth-native-callback';
import { authColors } from '@/constants/theme';

const mockReplace = jest.fn();
const mockParams: { rotating_token_nonce?: string } = {};
let mockRawUrl: string | null = null;
const mockSetActive = jest.fn(async () => undefined);
const mockReload = jest.fn(async () => { mockSignIn.createdSessionId = 'sess_google'; });
const mockSignIn = {
  createdSessionId: null as string | null,
  firstFactorVerification: { status: 'verified' },
  reload: mockReload,
};
const mockSignUp = { createdSessionId: null, create: jest.fn() };

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-linking', () => ({ useLinkingURL: () => mockRawUrl }));
jest.mock('@clerk/expo/legacy', () => ({
  useSignIn: () => ({ isLoaded: true, signIn: mockSignIn, setActive: mockSetActive }),
  useSignUp: () => ({ isLoaded: true, signUp: mockSignUp }),
}));

describe('native Google callback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSignIn.createdSessionId = null;
    delete mockParams.rotating_token_nonce;
    mockRawUrl = null;
  });

  it('recovers the token from the native return link when Router omits its query parameter', async () => {
    mockRawUrl = 'skillflow://oauth-native-callback?rotating_token_nonce=raw_nonce';
    render(<OAuthNativeCallbackScreen />);
    await act(async () => { jest.advanceTimersByTime(8000); await Promise.resolve(); });
    expect(mockReload).toHaveBeenCalledWith({ rotatingTokenNonce: 'raw_nonce' });
    expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_google' });
  });
  afterEach(() => jest.useRealTimers());

  it('finishes a returned Clerk session when the original login screen was unmounted', async () => {
    mockParams.rotating_token_nonce = 'returned_nonce';
    render(<OAuthNativeCallbackScreen />);
    await act(async () => { jest.advanceTimersByTime(8000); await Promise.resolve(); });
    expect(mockReload).toHaveBeenCalledWith({ rotatingTokenNonce: 'returned_nonce' });
    expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_google' });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('shows a way back when Google returns without a usable token', async () => {
    const screen = render(<OAuthNativeCallbackScreen />);
    await act(async () => { jest.advanceTimersByTime(8000); });
    const message = screen.getByText('Clerk returned without a sign-in token. Check the mobile redirect URL in your development Clerk instance.');
    expect(StyleSheet.flatten(message.props.style).color).toBe(authColors.accent);
    fireEvent.press(screen.getByRole('button', { name: 'Back to sign-in' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
