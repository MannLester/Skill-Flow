const applicationPublicRuntimeKeys = Object.freeze([
  'EXPO_PUBLIC_RUNTIME_TARGET',
  'EXPO_PUBLIC_CONVEX_URL',
  'EXPO_PUBLIC_CONVEX_SITE_URL',
  'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
]);

// Expo Router injects this exact key into web development bundles.
// Keep framework exceptions explicit: never permit a broader prefix.
const frameworkPublicRuntimeKeys = Object.freeze([
  'EXPO_PUBLIC_PROJECT_ROOT',
]);

const allowedPublicRuntimeKeys = new Set([
  ...applicationPublicRuntimeKeys,
  ...frameworkPublicRuntimeKeys,
]);

function unknownPublicRuntimeKeys(environment) {
  return Object.keys(environment)
    .filter((key) => key.startsWith('EXPO_PUBLIC_') && !allowedPublicRuntimeKeys.has(key))
    .sort();
}

function runtimeConfigurationExtra(environment) {
  return {
    runtimeConfigurationHasUnknownPublicValues: unknownPublicRuntimeKeys(environment).length > 0,
  };
}

module.exports = {
  applicationPublicRuntimeKeys,
  frameworkPublicRuntimeKeys,
  runtimeConfigurationExtra,
  unknownPublicRuntimeKeys,
};
