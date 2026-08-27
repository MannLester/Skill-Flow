import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Modal } from 'react-native';

import StudentHomeScreen from '@/app/student-home';
import { NavigationDrawer, navigationDrawerItems } from '@/components/navigation-drawer';
import { SessionProvider } from '@/context/session';
import { primaryNavActiveForPath, primaryTabDirection, primaryTabOrder, primaryTabRoute, replacePrimaryTab } from '@/navigation/primary-navigation';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: jest.fn(),
  },
}));

describe('primary navigation shell', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defines role-correct primary order and canonical routes', () => {
    expect(primaryTabOrder('student')).toEqual(['home', 'projects', 'portfolio', 'messages', 'profile']);
    expect(primaryTabOrder('client')).toEqual(['home', 'projects', 'messages', 'saved', 'profile']);
    expect(primaryTabRoute('student', 'home')).toBe('/student-home');
    expect(primaryTabRoute('client', 'home')).toBe('/client-home');
    expect(primaryTabRoute('client', 'saved')).toEqual({ pathname: '/marketplace', params: { saved: 'true' } });
    expect(primaryNavActiveForPath('/student-home', 'student')).toBe('home');
    expect(primaryNavActiveForPath('/projects', 'client')).toBe('projects');
    expect(primaryNavActiveForPath('/marketplace', 'client', 'true')).toBe('saved');
    expect(primaryNavActiveForPath('/settings', 'student')).toBeNull();
  });

  it('chooses direction by visual tab order and replaces without repeating the active tab', () => {
    expect(primaryTabDirection('student', 'home', 'messages')).toBe(1);
    expect(primaryTabDirection('student', 'profile', 'projects')).toBe(-1);
    expect(primaryTabDirection('client', 'saved', 'saved')).toBe(0);
    const replace = jest.fn();
    expect(replacePrimaryTab('student', 'home', 'projects', replace)).toBe(true);
    expect(replace).toHaveBeenCalledWith('/projects');
    expect(replacePrimaryTab('student', 'home', 'home', replace)).toBe(false);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('provides role-specific drawer items with settings last', () => {
    expect(navigationDrawerItems('student').map((item) => item.key)).toEqual(['home', 'projects', 'portfolio', 'messages', 'profile', 'settings']);
    expect(navigationDrawerItems('client').map((item) => item.key)).toEqual(['home', 'projects', 'messages', 'saved', 'profile', 'settings']);
  });

  it('preserves the redesigned Student Home header controls', () => {
    const screen = render(<SessionProvider><StudentHomeScreen /></SessionProvider>);
    expect(screen.getByLabelText('Open notifications')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });

  it('routes Settings from the standalone navigation drawer', () => {
    const onClose = jest.fn();
    const screen = render(<NavigationDrawer visible role="student" onClose={onClose} />);

    fireEvent.press(screen.getByRole('menuitem', { name: 'Settings' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('dismisses the standalone navigation drawer from its scrim', () => {
    const onClose = jest.fn();
    const screen = render(<NavigationDrawer visible role="student" onClose={onClose} />);

    fireEvent.press(screen.getAllByRole('button', { name: 'Close navigation menu' })[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('handles Android Back and can reopen with the selected state intact', async () => {
    const onClose = jest.fn();
    const screen = render(<NavigationDrawer visible role="student" onClose={onClose} />);
    expect(screen.getByRole('menuitem', { name: 'Home' }).props.accessibilityState).toMatchObject({ selected: true, disabled: true });

    act(() => screen.UNSAFE_getByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(1);

    screen.rerender(<NavigationDrawer visible={false} role="student" onClose={onClose} />);
    await waitFor(() => expect(screen.queryByText('Student Designer workspace')).toBeNull());
    screen.rerender(<NavigationDrawer visible role="student" onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Student Designer workspace')).toBeTruthy());
    expect(screen.getByRole('menuitem', { name: 'Home' }).props.accessibilityState).toMatchObject({ selected: true, disabled: true });
  });
});
