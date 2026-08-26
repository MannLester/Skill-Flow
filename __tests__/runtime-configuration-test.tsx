import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { RuntimeConfigurationState } from '@/components/runtime-configuration-state';
import { parseRuntimeConfiguration, readRuntimeConfiguration } from '@/config/runtime';

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

  it('fails closed when the real reader sees an undocumented public variable', () => {
    const previousValues = {
      target: process.env.EXPO_PUBLIC_RUNTIME_TARGET,
      convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL,
      clerkKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      undocumented: process.env.EXPO_PUBLIC_UNDOCUMENTED_VALUE,
    };
    process.env.EXPO_PUBLIC_RUNTIME_TARGET = 'web';
    process.env.EXPO_PUBLIC_CONVEX_URL = 'http://127.0.0.1:3210';
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = clerkKey;
    process.env.EXPO_PUBLIC_UNDOCUMENTED_VALUE = 'SkillFlowVerifierSecretSentinel';

    try {
      expect(readRuntimeConfiguration()).toEqual({
        ready: false,
        issues: ['Remove unknown EXPO_PUBLIC_* variables; only the documented public runtime values are supported.'],
      });
    } finally {
      if (previousValues.target === undefined) delete process.env.EXPO_PUBLIC_RUNTIME_TARGET;
      else process.env.EXPO_PUBLIC_RUNTIME_TARGET = previousValues.target;
      if (previousValues.convexUrl === undefined) delete process.env.EXPO_PUBLIC_CONVEX_URL;
      else process.env.EXPO_PUBLIC_CONVEX_URL = previousValues.convexUrl;
      if (previousValues.clerkKey === undefined) delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
      else process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = previousValues.clerkKey;
      if (previousValues.undocumented === undefined) delete process.env.EXPO_PUBLIC_UNDOCUMENTED_VALUE;
      else process.env.EXPO_PUBLIC_UNDOCUMENTED_VALUE = previousValues.undocumented;
    }
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
