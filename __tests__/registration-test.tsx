import { fireEvent, render } from '@testing-library/react-native';
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
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret1');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'secret1');
    fireEvent.press(screen.getByText('Sign Up'));
    expect(screen.getByText('Accept the Terms and Privacy Policy to continue.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('creates a valid local student account', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><RegisterScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.changeText(screen.getByPlaceholderText('Full Name'), 'Demo Student');
    fireEvent.changeText(screen.getByPlaceholderText('Email Address'), 'student@example.test');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'secret1');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'secret1');
    fireEvent.press(screen.getByLabelText('Accept Terms and Privacy Policy'));
    fireEvent.press(screen.getByText('Sign Up'));
    expect(mockReplace).toHaveBeenCalledWith('/student-home');
  });

  it('opens the legal documents without toggling submission', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><RegisterScreen /></SessionProvider></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Terms & Conditions'));
    expect(mockPush).toHaveBeenCalledWith('/terms');
    fireEvent.press(screen.getByText('Privacy Policy'));
    expect(mockPush).toHaveBeenCalledWith('/privacy-policy');
  });
});
