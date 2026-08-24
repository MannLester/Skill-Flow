import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import PublicProfileScreen from '@/app/profiles/[userId]';
import { SessionProvider } from '@/context/session';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({ userId: 'student-alex' }) }));

describe('public student profile privacy', () => {
  it('shows verification and portfolio evidence without exposing the masked student number', () => {
    const screen = render(<SafeAreaProvider><SessionProvider><PublicProfileScreen /></SessionProvider></SafeAreaProvider>);
    expect(screen.getByText('Verified Student')).toBeTruthy();
    expect(screen.getByText('Batangas State University TNEU')).toBeTruthy();
    expect(screen.getByText('Coffee Shop Brand Study')).toBeTruthy();
    expect(screen.queryByText('2026-****-DEMO')).toBeNull();
  });
});
