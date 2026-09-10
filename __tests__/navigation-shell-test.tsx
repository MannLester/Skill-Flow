import { fireEvent, render } from '@testing-library/react-native';

import ClientHomeScreen from '@/app/client-home';
import { primaryNavActiveForPath, primaryTabDirection, primaryTabOrder, primaryTabRoute, replacePrimaryTab } from '@/navigation/primary-navigation';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock('@/context/session.remote', () => ({
  useSession: () => ({
    bookings: [],
    currentAccount: { id: 'client-mark', role: 'client', name: 'Mark Client' },
    projectPosts: [],
    unreadCount: 0,
  }),
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

  it('keeps a direct Saved entry on the client home', () => {
    const screen = render(<ClientHomeScreen />);
    fireEvent.press(screen.getByText('Saved'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/marketplace', params: { saved: 'true' } });
  });
});
