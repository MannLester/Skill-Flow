export type RuntimeTarget = 'web' | 'android-emulator' | 'android-device' | 'cloud';

export type RuntimeConfiguration = {
  target: RuntimeTarget;
  convexUrl: string;
  clerkPublishableKey: string;
};

export type RuntimeConfigurationResult =
  | { ready: true; configuration: RuntimeConfiguration }
  | { ready: false; issues: string[] };

type PublicRuntimeEnvironment = Record<string, string | undefined> & {
  EXPO_PUBLIC_RUNTIME_TARGET?: string;
  EXPO_PUBLIC_CONVEX_URL?: string;
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  EXPO_PUBLIC_CONVEX_ADMIN_KEY?: string;
  EXPO_PUBLIC_CONVEX_DEPLOY_KEY?: string;
  EXPO_PUBLIC_CLERK_SECRET_KEY?: string;
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

  if (isRuntimeTarget(target) && clerkPublishableKey) {
    const clerkIssue = validateClerkKey(target, clerkPublishableKey);
    if (clerkIssue) issues.push(clerkIssue);
  }

  const privilegedIssue = findPrivilegedPublicValue(environment);
  if (privilegedIssue) issues.push(privilegedIssue);

  if (issues.length || !isRuntimeTarget(target) || !convexUrl || !clerkPublishableKey) return { ready: false, issues };
  return { ready: true, configuration: { target, convexUrl, clerkPublishableKey } };
}

export function readRuntimeConfiguration(): RuntimeConfigurationResult {
  return parseRuntimeConfiguration({
    EXPO_PUBLIC_RUNTIME_TARGET: process.env.EXPO_PUBLIC_RUNTIME_TARGET,
    EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    EXPO_PUBLIC_CONVEX_ADMIN_KEY: process.env.EXPO_PUBLIC_CONVEX_ADMIN_KEY,
    EXPO_PUBLIC_CONVEX_DEPLOY_KEY: process.env.EXPO_PUBLIC_CONVEX_DEPLOY_KEY,
    EXPO_PUBLIC_CLERK_SECRET_KEY: process.env.EXPO_PUBLIC_CLERK_SECRET_KEY,
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
  if (url.username || url.password || url.search || url.hash) return 'EXPO_PUBLIC_CONVEX_URL must not include credentials, query parameters, or fragments.';

  if (target !== 'cloud' && isConvexCloudHostname(url.hostname)) {
    return target === 'android-device'
      ? 'A physical Android device must use a LAN-reachable self-hosted Convex URL, not a cloud deployment.'
      : `${target} development must use a local self-hosted Convex URL, not a cloud deployment.`;
  }

  if (target === 'cloud') {
    return url.protocol === 'https:' && isConvexCloudHostname(url.hostname)
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

function validateClerkKey(target: RuntimeTarget, value: string): string | undefined {
  const requiredPrefix = target === 'cloud' ? 'pk_live_' : 'pk_test_';
  return value.startsWith(requiredPrefix)
    ? undefined
    : target === 'cloud'
      ? 'Cloud configuration requires a live Clerk pk_live_ publishable key.'
      : `${target} development requires a test Clerk pk_test_ publishable key.`;
}

function findPrivilegedPublicValue(environment: PublicRuntimeEnvironment): string | undefined {
  const privilegedKey = Object.entries(environment).find(([key, value]) => (
    key.startsWith('EXPO_PUBLIC_') && /ADMIN|SECRET|DEPLOY|PRIVATE|TOKEN|PASSWORD|CREDENTIAL|API_KEY/i.test(key) && Boolean(value?.trim())
  ))?.[0];
  return privilegedKey ? `Remove ${privilegedKey}; privileged credentials must never use an EXPO_PUBLIC_* variable.` : undefined;
}

function isConvexCloudHostname(hostname: string): boolean {
  return hostname.endsWith('.convex.cloud');
}

function isLoopback(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
