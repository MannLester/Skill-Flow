import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ForgotPasswordScreen from '@/app/forgot-password';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() } }));

describe('Clerk password recovery', () => {
  it('validates the email before requesting a Clerk recovery code', async () => {
    const screen = render(<SafeAreaProvider><ForgotPasswordScreen /></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Send Recovery Code'));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('Email Address'), 'student@example.test');
    fireEvent.press(screen.getByText('Send Recovery Code'));
    await waitFor(() => expect(screen.getByPlaceholderText('Recovery Code')).toBeTruthy());
  });
});
