import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ForgotPasswordScreen from '@/app/forgot-password';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() } }));

describe('simulated password recovery', () => {
  it('validates the email before showing confirmation', () => {
    const screen = render(<SafeAreaProvider><ForgotPasswordScreen /></SafeAreaProvider>);
    fireEvent.press(screen.getByText('Send Recovery Instructions'));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('Email Address'), 'alex@skillflow.demo');
    fireEvent.press(screen.getByText('Send Recovery Instructions'));
    expect(screen.getByText('Recovery simulated')).toBeTruthy();
    expect(screen.getByText(/No email was sent/)).toBeTruthy();
  });
});
