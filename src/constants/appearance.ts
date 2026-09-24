const alwaysLightPaths = new Set([
  '/',
  '/register',
  '/forgot-password',
  '/oauth-native-callback',
  '/change-password',
]);

export function colorSchemeForRoute(pathname: string, signedIn: boolean, darkMode: boolean): 'light' | 'dark' {
  return signedIn && darkMode && !alwaysLightPaths.has(pathname) ? 'dark' : 'light';
}
