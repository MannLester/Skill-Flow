import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { RuntimeConfigurationState } from '@/components/runtime-configuration-state';
import { parseRuntimeConfiguration } from '@/config/runtime';

const clerkKey = 'pk_test_c2tpbGxmbG93';
const liveClerkKey = 'pk_live_c2tpbGxmbG93';

describe('runtime configuration', () => {
  test.each([
    ['web', 'http://127.0.0.1:3210', clerkKey],
    ['android-emulator', 'http://10.0.2.2:3210', clerkKey],
    ['android-device', 'http://192.168.1.25:3210', clerkKey],
    ['cloud', 'https://example.convex.cloud', liveClerkKey],
  ])('accepts the %s target', (target, convexUrl, targetClerkKey) => {
    expect(parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: target,
      EXPO_PUBLIC_CONVEX_URL: convexUrl,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: targetClerkKey,
    })).toEqual({ ready: true, configuration: { target, convexUrl, clerkPublishableKey: targetClerkKey } });
  });

  it('reports every missing public value', () => {
    const result = parseRuntimeConfiguration({});
    expect(result.ready).toBe(false);
    if (!result.ready) expect(result.issues).toHaveLength(3);
  });

  test.each([
    ['web', 'http://10.0.2.2:3210', 'loopback'],
    ['android-emulator', 'http://127.0.0.1:3210', '10.0.2.2'],
    ['android-device', 'http://localhost:3210', 'LAN-reachable'],
    ['android-device', 'https://example.convex.cloud', 'cloud deployment'],
    ['cloud', 'http://example.convex.cloud', 'https://*.convex.cloud'],
  ])('rejects a Convex URL mismatched with %s', (target, convexUrl, guidance) => {
    const result = parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: target,
      EXPO_PUBLIC_CONVEX_URL: convexUrl,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey,
    });
    expect(result.ready).toBe(false);
    if (!result.ready) expect(result.issues.join(' ')).toContain(guidance);
  });

  test.each([
    ['cloud', 'pk_test_c2tpbGxmbG93', 'live'],
    ['web', 'pk_live_c2tpbGxmbG93', 'test'],
    ['android-emulator', 'pk_live_c2tpbGxmbG93', 'test'],
    ['android-device', 'pk_live_c2tpbGxmbG93', 'test'],
  ])('rejects a Clerk key from the wrong environment for %s', (target, wrongKey, expectedEnvironment) => {
    const result = parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: target,
      EXPO_PUBLIC_CONVEX_URL: target === 'cloud' ? 'https://example.convex.cloud' : 'http://127.0.0.1:3210',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: wrongKey,
    });
    expect(result.ready).toBe(false);
    if (!result.ready) expect(result.issues.join(' ')).toContain(expectedEnvironment);
  });

  test.each([
    'http://demo:password@127.0.0.1:3210',
    'http://127.0.0.1:3210?admin_key=secret',
    'http://127.0.0.1:3210#deploy-key',
  ])('rejects credentials or privileged URL values in %s', (convexUrl) => {
    const result = parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: 'web',
      EXPO_PUBLIC_CONVEX_URL: convexUrl,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey,
    });
    expect(result.ready).toBe(false);
    if (!result.ready) expect(result.issues.join(' ')).toContain('credentials');
  });

  it('rejects secret-looking values in the Clerk public-key slot', () => {
    const result = parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: 'web',
      EXPO_PUBLIC_CONVEX_URL: 'http://localhost:3210',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'sk_test_do-not-bundle-this',
    });
    expect(result.ready).toBe(false);
  });

  test.each(['EXPO_PUBLIC_CONVEX_ADMIN_KEY', 'EXPO_PUBLIC_CONVEX_DEPLOY_KEY', 'EXPO_PUBLIC_CLERK_SECRET_KEY', 'EXPO_PUBLIC_API_KEY'])('rejects %s', (key) => {
    const result = parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: 'web',
      EXPO_PUBLIC_CONVEX_URL: 'http://localhost:3210',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey,
      [key]: 'privileged-value',
    });
    expect(result.ready).toBe(false);
    if (!result.ready) expect(result.issues.join(' ')).toContain('privileged credentials');
  });

  it('renders actionable setup guidance without rendering connected children', () => {
    const screen = render(<RuntimeConfigurationState result={parseRuntimeConfiguration({})}><Text>Connected app</Text></RuntimeConfigurationState>);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('App setup required')).toBeTruthy();
    expect(screen.queryByText('Connected app')).toBeNull();
  });
});
