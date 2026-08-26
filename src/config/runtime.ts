import Constants from 'expo-constants';

export type RuntimeTarget = 'web' | 'android-emulator' | 'android-device' | 'cloud-development' | 'cloud';

export type RuntimeConfiguration = {
  target: RuntimeTarget;
  convexUrl: string;
  clerkPublishableKey: string;
};

export type RuntimeConfigurationResult =
  | { ready: true; configuration: RuntimeConfiguration }
  | { ready: false; issues: string[] };

type PublicRuntimeEnvironment = Record<string, string | undefined>;

type RuntimeValues = {
  target: string | undefined;
  convexUrl: string | undefined;
  clerkPublishableKey: string | undefined;
};

type CompleteRuntimeValues = {
  target: RuntimeTarget;
  convexUrl: string;
  clerkPublishableKey: string;
};

type RuntimeConfigurationContext = {
  hasUnknownPublicValues?: boolean;
};

const runtimeTargets: RuntimeTarget[] = ['web', 'android-emulator', 'android-device', 'cloud-development', 'cloud'];
const documentedPublicRuntimeKeys = new Set([
  'EXPO_PUBLIC_RUNTIME_TARGET',
  'EXPO_PUBLIC_CONVEX_URL',
  'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
]);

export function parseRuntimeConfiguration(environment: PublicRuntimeEnvironment, context: RuntimeConfigurationContext = {}): RuntimeConfigurationResult {
  const values = readRuntimeValues(environment);
  const issues = collectRuntimeIssues(environment, values, context);
  if (!isCompleteRuntimeValues(values, issues)) return { ready: false, issues };
  return { ready: true, configuration: values };
}

export function readRuntimeConfiguration(): RuntimeConfigurationResult {
  return parseRuntimeConfiguration({
    EXPO_PUBLIC_RUNTIME_TARGET: process.env.EXPO_PUBLIC_RUNTIME_TARGET,
    EXPO_PUBLIC_CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL,
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  }, { hasUnknownPublicValues: readUnknownPublicValueSignal() });
}

function readUnknownPublicValueSignal(): boolean {
  return Constants.expoConfig?.extra?.runtimeConfigurationHasUnknownPublicValues !== false;
}

function isRuntimeTarget(value: string | undefined): value is RuntimeTarget {
  return runtimeTargets.some((target) => target === value);
}

function readRuntimeValues(environment: PublicRuntimeEnvironment): RuntimeValues {
  return {
    target: environment.EXPO_PUBLIC_RUNTIME_TARGET?.trim(),
    convexUrl: environment.EXPO_PUBLIC_CONVEX_URL?.trim(),
    clerkPublishableKey: environment.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
  };
}

function collectRuntimeIssues(environment: PublicRuntimeEnvironment, values: RuntimeValues, context: RuntimeConfigurationContext): string[] {
  return [
    findUnknownPublicValue(environment, context),
    ...missingRuntimeIssues(values),
    ...convexRuntimeIssues(values.target, values.convexUrl),
    ...clerkRuntimeIssues(values.target, values.clerkPublishableKey),
  ].filter((issue): issue is string => Boolean(issue));
}

function findUnknownPublicValue(environment: PublicRuntimeEnvironment, context: RuntimeConfigurationContext): string | undefined {
  const hasUnknownPublicValue = context.hasUnknownPublicValues === true || Object.keys(environment).some((key) => (
    key.startsWith('EXPO_PUBLIC_') && !documentedPublicRuntimeKeys.has(key)
  ));
  return hasUnknownPublicValue
    ? 'Remove unknown EXPO_PUBLIC_* variables; only the documented public runtime values are supported.'
    : undefined;
}

function missingRuntimeIssues(values: RuntimeValues): string[] {
  const issues: string[] = [];
  if (!isRuntimeTarget(values.target)) issues.push('Set EXPO_PUBLIC_RUNTIME_TARGET to web, android-emulator, android-device, cloud-development, or cloud.');
  if (!values.convexUrl) issues.push('Set EXPO_PUBLIC_CONVEX_URL to the Convex client URL for this target.');
  if (!values.clerkPublishableKey) issues.push('Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to the Clerk publishable key supplied by the project administrator.');
  return issues;
}

function convexRuntimeIssues(target: string | undefined, value: string | undefined): string[] {
  if (!isRuntimeTarget(target) || !value) return [];
  const issue = validateConvexUrl(target, value);
  return issue ? [issue] : [];
}

function clerkRuntimeIssues(target: string | undefined, value: string | undefined): string[] {
  if (!value) return [];
  const issues: string[] = [];
  if (!/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(value)) {
    issues.push('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must be a Clerk pk_test_ or pk_live_ publishable key.');
  }
  if (isRuntimeTarget(target)) {
    const issue = validateClerkKey(target, value);
    if (issue) issues.push(issue);
  }
  return issues;
}

function isCompleteRuntimeValues(values: RuntimeValues, issues: string[]): values is CompleteRuntimeValues {
  return issues.length === 0
    && isRuntimeTarget(values.target)
    && Boolean(values.convexUrl)
    && Boolean(values.clerkPublishableKey);
}

function validateConvexUrl(target: RuntimeTarget, value: string): string | undefined {
  const url = parseConvexUrl(value);
  if (!url) return 'EXPO_PUBLIC_CONVEX_URL must be a complete http:// or https:// URL.';
  const formatIssue = validateConvexUrlFormat(url);
  return formatIssue ?? validateConvexTarget(target, url);
}

function parseConvexUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function validateConvexUrlFormat(url: URL): string | undefined {
  if (!['http:', 'https:'].includes(url.protocol)) return 'EXPO_PUBLIC_CONVEX_URL must use http:// or https://.';
  if (url.username || url.password || url.search || url.hash) return 'EXPO_PUBLIC_CONVEX_URL must not include credentials, query parameters, or fragments.';
  return undefined;
}

function validateConvexTarget(target: RuntimeTarget, url: URL): string | undefined {
  return isCloudTarget(target) ? validateCloudConvexUrl(url) : validateLocalConvexUrl(target, url);
}

function validateCloudConvexUrl(url: URL): string | undefined {
  return url.protocol === 'https:' && isConvexCloudHostname(url.hostname)
    ? undefined
    : 'Cloud configuration requires an https://*.convex.cloud client URL.';
}

function validateLocalConvexUrl(target: Exclude<RuntimeTarget, 'cloud-development' | 'cloud'>, url: URL): string | undefined {
  const cloudIssue = validateLocalCloudBoundary(target, url);
  return cloudIssue ?? validateLocalHostBoundary(target, url);
}

function validateLocalCloudBoundary(target: Exclude<RuntimeTarget, 'cloud-development' | 'cloud'>, url: URL): string | undefined {
  if (!isConvexCloudHostname(url.hostname)) return undefined;
  return target === 'android-device'
    ? 'A physical Android device must use a LAN-reachable self-hosted Convex URL, not a cloud deployment.'
    : `${target} development must use a local self-hosted Convex URL, not a cloud deployment.`;
}

function validateLocalHostBoundary(target: Exclude<RuntimeTarget, 'cloud-development' | 'cloud'>, url: URL): string | undefined {
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

function isCloudTarget(target: RuntimeTarget): target is 'cloud-development' | 'cloud' {
  return target === 'cloud-development' || target === 'cloud';
}

function isConvexCloudHostname(hostname: string): boolean {
  return hostname.endsWith('.convex.cloud');
}

function isLoopback(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
