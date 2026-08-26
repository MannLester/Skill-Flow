import { render } from '@testing-library/react-native';
import Constants from 'expo-constants';
import { Text } from 'react-native';

import { RuntimeConfigurationState } from '@/components/runtime-configuration-state';
import { parseRuntimeConfiguration, readRuntimeConfiguration } from '@/config/runtime';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { runtimeConfigurationHasUnknownPublicValues: false },
    },
  },
}));

const clerkKey = 'pk_test_c2tpbGxmbG93';
const liveClerkKey = 'pk_live_c2tpbGxmbG93';
const runtimeExtra = Constants.expoConfig?.extra as { runtimeConfigurationHasUnknownPublicValues?: boolean };

function withRuntimeEnvironment(values: Record<string, string>, hasUnknownPublicValues: boolean, assertion: () => void) {
  const previousValues = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const previousSignal = runtimeExtra.runtimeConfigurationHasUnknownPublicValues;
  Object.assign(process.env, values);
  runtimeExtra.runtimeConfigurationHasUnknownPublicValues = hasUnknownPublicValues;
  try {
    assertion();
  } finally {
    for (const [key, value] of Object.entries(previousValues)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    runtimeExtra.runtimeConfigurationHasUnknownPublicValues = previousSignal;
  }
}

describe('runtime configuration', () => {
  test.each([
    ['web', 'http://127.0.0.1:3210', clerkKey],
    ['android-emulator', 'http://10.0.2.2:3210', clerkKey],
    ['android-device', 'http://192.168.1.25:3210', clerkKey],
    ['cloud-development', 'https://development.convex.cloud', clerkKey],
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

  it('trims accepted values before returning the typed configuration', () => {
    expect(parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: ' cloud ',
      EXPO_PUBLIC_CONVEX_URL: ' https://example.convex.cloud ',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: ` ${liveClerkKey} `,
    })).toEqual({
      ready: true,
      configuration: {
        target: 'cloud',
        convexUrl: 'https://example.convex.cloud',
        clerkPublishableKey: liveClerkKey,
      },
    });
  });

  test.each([
    ['not-a-url', 'complete http:// or https:// URL'],
    ['ftp://127.0.0.1:3210', 'use http:// or https://'],
  ])('reports malformed or unsupported Convex URL %s', (convexUrl, guidance) => {
    const result = parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: 'web',
      EXPO_PUBLIC_CONVEX_URL: convexUrl,
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey,
    });
    expect(result.ready).toBe(false);
    if (!result.ready) expect(result.issues.join(' ')).toContain(guidance);
  });

  it('keeps independent configuration issues ordered and visible', () => {
    const result = parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: 'web',
      EXPO_PUBLIC_CONVEX_URL: 'not-a-url',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'sk_test_do-not-bundle-this',
      EXPO_PUBLIC_API_KEY: 'privileged-value',
    });
    expect(result).toEqual({
      ready: false,
      issues: [
        'Remove unknown EXPO_PUBLIC_* variables; only the documented public runtime values are supported.',
        'EXPO_PUBLIC_CONVEX_URL must be a complete http:// or https:// URL.',
        'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk pk_test_ or pk_live_ publishable key.',
        'web development requires a test Clerk pk_test_ publishable key.',
      ],
    });
  });

  it('keeps the real reader ready with Expo Router framework metadata', () => {
    withRuntimeEnvironment({
      EXPO_PUBLIC_RUNTIME_TARGET: 'web',
      EXPO_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3210',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey,
      EXPO_PUBLIC_PROJECT_ROOT: '/framework-owned/expo-router',
    }, false, () => {
      expect(readRuntimeConfiguration()).toEqual({
        ready: true,
        configuration: {
          target: 'web',
          convexUrl: 'http://127.0.0.1:3210',
          clerkPublishableKey: clerkKey,
        },
      });
    });
  });

  it('fails closed when Expo reports an undocumented public variable', () => {
    withRuntimeEnvironment({
      EXPO_PUBLIC_RUNTIME_TARGET: 'web',
      EXPO_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3210',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey,
      EXPO_PUBLIC_PROJECT_ROOT: '/framework-owned/expo-router',
      EXPO_PUBLIC_API_KEY: 'SkillFlowVerifierSecretSentinel',
    }, true, () => {
      expect(readRuntimeConfiguration()).toEqual({
        ready: false,
        issues: ['Remove unknown EXPO_PUBLIC_* variables; only the documented public runtime values are supported.'],
      });
    });
  });

  test.each([
    ['web', 'http://10.0.2.2:3210', 'loopback'],
    ['android-emulator', 'http://127.0.0.1:3210', '10.0.2.2'],
    ['android-device', 'http://localhost:3210', 'LAN-reachable'],
    ['android-device', 'https://example.convex.cloud', 'cloud deployment'],
    ['cloud-development', 'http://127.0.0.1:3210', 'https://*.convex.cloud'],
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
    ['cloud-development', 'pk_live_c2tpbGxmbG93', 'test'],
    ['web', 'pk_live_c2tpbGxmbG93', 'test'],
    ['android-emulator', 'pk_live_c2tpbGxmbG93', 'test'],
    ['android-device', 'pk_live_c2tpbGxmbG93', 'test'],
  ])('rejects a Clerk key from the wrong environment for %s', (target, wrongKey, expectedEnvironment) => {
    const result = parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: target,
      EXPO_PUBLIC_CONVEX_URL: target === 'cloud' || target === 'cloud-development'
        ? 'https://example.convex.cloud'
        : 'http://127.0.0.1:3210',
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

  test.each(['EXPO_PUBLIC_CONVEX_ADMIN_KEY', 'EXPO_PUBLIC_CONVEX_DEPLOY_KEY', 'EXPO_PUBLIC_CLERK_SECRET_KEY', 'EXPO_PUBLIC_API_KEY'])('rejects undocumented public variable %s', (key) => {
    const result = parseRuntimeConfiguration({
      EXPO_PUBLIC_RUNTIME_TARGET: 'web',
      EXPO_PUBLIC_CONVEX_URL: 'http://localhost:3210',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkKey,
      [key]: 'privileged-value',
    });
    expect(result.ready).toBe(false);
    if (!result.ready) expect(result.issues.join(' ')).toContain('only the documented public runtime values');
  });

  it('renders actionable setup guidance without rendering connected children', () => {
    const screen = render(<RuntimeConfigurationState result={parseRuntimeConfiguration({})}><Text>Connected app</Text></RuntimeConfigurationState>);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('App setup required')).toBeTruthy();
    expect(screen.queryByText('Connected app')).toBeNull();
  });
});
