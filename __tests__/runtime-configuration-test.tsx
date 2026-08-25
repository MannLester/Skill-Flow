import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { RuntimeConfigurationState } from '@/components/runtime-configuration-state';
import { parseRuntimeConfiguration } from '@/config/runtime';

const clerkKey = 'pk_test_c2tpbGxmbG93';

describe('runtime configuration', () => {
  test.each([
    ['web', 'http://127.0.0.1:3210'],
    ['android-emulator', 'http://10.0.2.2:3210'],
    ['android-device', 'http://192.168.1.25:3210'],
    ['cloud', 'https://example.convex.cloud'],
  ])('accepts the %s target', (target, convexUrl) => {
    expect(parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: target,
      EXPO_PUBLIC_CONVEX_URL: convexUrl,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey,
    })).toEqual({ ready: true, configuration: { target, convexUrl, clerkPublishableKey: clerkKey } });
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

  it('rejects secret-looking values in the Clerk public-key slot', () => {
    const result = parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: 'web',
      EXPO_PUBLIC_CONVEX_URL: 'http://localhost:3210',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'sk_test_do-not-bundle-this',
    });
    expect(result.ready).toBe(false);
  });

  it('renders actionable setup guidance without rendering connected children', () => {
    const screen = render(<RuntimeConfigurationState result={parseRuntimeConfiguration({})}><Text>Connected app</Text></RuntimeConfigurationState>);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('App setup required')).toBeTruthy();
    expect(screen.queryByText('Connected app')).toBeNull();
  });
});
