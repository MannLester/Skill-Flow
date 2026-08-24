import { fireEvent, render } from '@testing-library/react-native';
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

  it('routes a selected client to the client dashboard', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><LoginScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Client'));
    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'mark@skillflow.demo');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'demo123');
    fireEvent.press(screen.getByText('Log In'));
    expect(mockReplace).toHaveBeenCalledWith('/client-home');
  });

  it('rejects missing credentials', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><LoginScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Log In'));
    expect(screen.getByText('Enter your email and password.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('provides one-tap access to the Mark demo account', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><LoginScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Continue as Mark'));
    expect(mockReplace).toHaveBeenCalledWith('/client-home');
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
});
