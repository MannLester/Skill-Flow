import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from '@/app/index';
import { SessionProvider } from '@/context/session';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));

describe('login navigation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submits credentials to Clerk and lets the auth gate choose the role route', async () => {
    const screen = render(<SafeAreaProvider><SessionProvider><LoginScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'client@example.test');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.press(screen.getByRole('button', { name: 'Log In' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('rejects missing credentials', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><LoginScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Log In'));
    expect(screen.getByText('Enter your email and password.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not expose demo-account shortcuts or a login role switcher', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><LoginScreen /></SessionProvider></SafeAreaProvider>);
    expect(screen.queryByText('Continue as Mark')).toBeNull();
    expect(screen.queryByText('Client')).toBeNull();
  });

  it('opens registration from the sign-up link', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><LoginScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Sign Up'));
    expect(mockPush).toHaveBeenCalledWith('/register');
  });

  it('opens password recovery', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><LoginScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Forgot Password?'));
    expect(mockPush).toHaveBeenCalledWith('/forgot-password');
  });

  it('starts Google OAuth sign-in and lets the auth gate choose the route', async () => {
    const screen = render(<SafeAreaProvider><SessionProvider><LoginScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});
