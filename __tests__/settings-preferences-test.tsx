import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SettingsScreen from '@/app/settings';
import { AppText, LocalizedTextInput } from '@/components/ui';
import { LocalizationProvider } from '@/localization';

const mockUpdatePreferences = jest.fn();

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/context/session.remote', () => ({
  useSession: () => ({
    logout: jest.fn(),
    preferences: { darkMode: false, language: 'English', notificationsEnabled: true },
    updatePreferences: mockUpdatePreferences,
  }),
}));

describe('functional settings preferences', () => {
  beforeEach(() => { mockUpdatePreferences.mockClear(); jest.spyOn(Alert, 'alert').mockClear(); });

  it('persists the app-wide dark-mode choice', () => {
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByRole('switch', { name: 'Dark Mode' }));
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ darkMode: true });
  });

  it('offers English and Filipino and persists Filipino', () => {
    const alert = jest.spyOn(Alert, 'alert');
    const screen = render(<SettingsScreen />);
    fireEvent.press(screen.getByRole('button', { name: /Language/ }));
    const buttons = alert.mock.calls[0][2];
    buttons?.find((button) => button.text === 'Filipino')?.onPress?.();
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ language: 'Filipino' });
  });

  it('translates shared interface text in Filipino', () => {
    const screen = render(<LocalizationProvider language="Filipino"><AppText>Settings</AppText><AppText>Projects</AppText><AppText>Submit Delivery</AppText><LocalizedTextInput placeholder="Write a message…" /></LocalizationProvider>);
    expect(screen.getByText('Mga Setting')).toBeTruthy();
    expect(screen.getByText('Mga Proyekto')).toBeTruthy();
    expect(screen.getByText('Isumite ang Delivery')).toBeTruthy();
    expect(screen.getByPlaceholderText('Sumulat ng mensahe…')).toBeTruthy();
  });
});
