export type RuntimeTarget = 'web' | 'android-emulator' | 'android-device' | 'cloud';

export type RuntimeConfiguration = {
  target: RuntimeTarget;
  convexUrl: string;
  clerkPublishableKey: string;
};

export type RuntimeConfigurationResult =
  | { ready: true; configuration: RuntimeConfiguration }
  | { ready: false; issues: string[] };

type PublicRuntimeEnvironment = {
  EXPO_PUBLIC_RUNTIME_TARGET?: string;
  EXPO_PUBLIC_CONVEX_URL?: string;
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
};

const runtimeTargets: RuntimeTarget[] = ['web', 'android-emulator', 'android-device', 'cloud'];

export function parseRuntimeConfiguration(environment: PublicRuntimeEnvironment): RuntimeConfigurationResult {
  const target = environment.EXPO_PUBLIC_RUNTIME_TARGET?.trim();
  const convexUrl = environment.EXPO_PUBLIC_CONVEX_URL?.trim();
  const clerkPublishableKey = environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const issues: string[] = [];

  if (!isRuntimeTarget(target)) issues.push('Set EXPO_PUBLIC_RUNTIME_TARGET to web, android-emulator, android-device, or cloud.');
  if (!convexUrl) issues.push('Set EXPO_PUBLIC_CONVEX_URL to the Convex client URL for this target.');
  if (!clerkPublishableKey) issues.push('Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to the Clerk publishable key supplied by the project administrator.');

  if (isRuntimeTarget(target) && convexUrl) {
    const urlIssue = validateConvexUrl(target, convexUrl);
    if (urlIssue) issues.push(urlIssue);
  }

  if (clerkPublishableKey && !/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(clerkPublishableKey)) {
    issues.push('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk pk_test_ or pk_live_ publishable key.');
  }

  if (issues.length || !isRuntimeTarget(target) || !convexUrl || !clerkPublishableKey) return { ready: false, issues };
  return { ready: true, configuration: { target, convexUrl, clerkPublishableKey } };
}

export function readRuntimeConfiguration(): RuntimeConfigurationResult {
  return parseRuntimeConfiguration({
    EXPO_PUBLIC_RUNTIME_TARGET: process.env.EXPO_PUBLIC_RUNTIME_TARGET,
    EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
}

function isRuntimeTarget(value: string | undefined): value is RuntimeTarget {
  return runtimeTargets.some((target) => target === value);
}

function validateConvexUrl(target: RuntimeTarget, value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'EXPO_PUBLIC_CONVEX_URL must be a complete http:// or https:// URL.';
  }

  if (!['http:', 'https:'].includes(url.protocol)) return 'EXPO_PUBLIC_CONVEX_URL must use http:// or https://.';

  if (target === 'cloud') {
    return url.protocol === 'https:' && url.hostname.endsWith('.convex.cloud')
      ? undefined
      : 'Cloud configuration requires an https://*.convex.cloud client URL.';
  }

  if (target === 'web' && !isLoopback(url.hostname)) return 'Web local development requires a localhost or loopback Convex URL.';
  if (target === 'android-emulator' && url.hostname !== '10.0.2.2') return 'Android emulator development requires the Convex host 10.0.2.2.';
  if (target === 'android-device' && (isLoopback(url.hostname) || url.hostname === '10.0.2.2')) {
    return 'A physical Android device requires a LAN-reachable Convex hostname, not localhost or 10.0.2.2.';
  }

  return undefined;
}

function isLoopback(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
