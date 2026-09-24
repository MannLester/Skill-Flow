import { colorSchemeForRoute } from '@/constants/appearance';

describe('route appearance', () => {
  it.each(['/', '/register', '/forgot-password', '/oauth-native-callback', '/change-password'])(
    'keeps %s light even with dark mode enabled',
    (pathname) => expect(colorSchemeForRoute(pathname, true, true)).toBe('light'),
  );

  it('restores dark mode when leaving an account access screen', () => {
    expect(colorSchemeForRoute('/change-password', true, true)).toBe('light');
    expect(colorSchemeForRoute('/settings', true, true)).toBe('dark');
  });

  it('keeps signed-out screens light', () => {
    expect(colorSchemeForRoute('/', false, true)).toBe('light');
  });
});
