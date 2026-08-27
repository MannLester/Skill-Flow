import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RegisterScreen from '@/app/register';
import { SessionProvider } from '@/context/session';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));

describe('registration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires all fields and accepted terms', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><RegisterScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Sign Up'));
    expect(screen.getByText('Complete all account fields.')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('Full Name'), 'Demo Student');
    fireEvent.changeText(screen.getByPlaceholderText('Email Address'), 'student@example.test');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret123');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'secret123');
    fireEvent.press(screen.getByText('Sign Up'));
    expect(screen.getByText('Accept the Terms and Privacy Policy to continue.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('creates a Clerk account and verifies its email', async () => {
    const screen = render(<SafeAreaProvider><SessionProvider><RegisterScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.changeText(screen.getByPlaceholderText('Full Name'), 'Demo Student');
    fireEvent.changeText(screen.getByPlaceholderText('Email Address'), 'student@example.test');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret123');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'secret123');
    fireEvent.press(screen.getByLabelText('Accept Terms and Privacy Policy'));
    fireEvent.press(screen.getByText('Sign Up'));
    await waitFor(() => expect(screen.getByPlaceholderText('Verification Code')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Verification Code'), '123456');
    fireEvent.press(screen.getByText('Verify and Continue'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('opens the legal documents without toggling submission', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><RegisterScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Terms & Conditions'));
    expect(mockPush).toHaveBeenCalledWith('/terms');
    fireEvent.press(screen.getByText('Privacy Policy'));
    expect(mockPush).toHaveBeenCalledWith('/privacy-policy');
  });

  it('requires accepted terms before OAuth registration', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><RegisterScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByRole('button', { name: 'Continue with Facebook' }));
    expect(screen.getByText('Accept the Terms and Privacy Policy to continue.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('starts Facebook OAuth registration after terms are accepted', async () => {
    const screen = render(<SafeAreaProvider><SessionProvider><RegisterScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByLabelText('Accept Terms and Privacy Policy'));
    fireEvent.press(screen.getByRole('button', { name: 'Continue with Facebook' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});
