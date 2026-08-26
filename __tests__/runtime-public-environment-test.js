const { describe, expect, it } = require('@jest/globals');
const {
  frameworkPublicRuntimeKeys,
  runtimeConfigurationExtra,
  unknownPublicRuntimeKeys,
} = require('../scripts/runtime-public-environment.cjs');

describe('Expo public environment boundary', () => {
  it('allows only the explicit framework-owned key', () => {
    expect(frameworkPublicRuntimeKeys).toEqual(['EXPO_PUBLIC_PROJECT_ROOT']);
    expect(unknownPublicRuntimeKeys({
      EXPO_PUBLIC_RUNTIME_TARGET: 'web',
      EXPO_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3210',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_c2tpbGxmbG93',
      EXPO_PUBLIC_PROJECT_ROOT: '/framework-owned/expo-router',
    })).toEqual([]);
  });

  it('signals arbitrary application-like public names without exposing their values', () => {
    const environment = {
      EXPO_PUBLIC_PROJECT_ROOT: '/framework-owned/expo-router',
      EXPO_PUBLIC_API_KEY: 'SkillFlowVerifierSecretSentinel',
      EXPO_PUBLIC_CONVEX_ADMIN_KEY: 'SkillFlowVerifierSecretSentinel',
    };

    expect(unknownPublicRuntimeKeys(environment)).toEqual([
      'EXPO_PUBLIC_API_KEY',
      'EXPO_PUBLIC_CONVEX_ADMIN_KEY',
    ]);
    expect(runtimeConfigurationExtra(environment)).toEqual({
      runtimeConfigurationHasUnknownPublicValues: true,
    });
    expect(JSON.stringify(runtimeConfigurationExtra(environment))).not.toContain('SkillFlowVerifierSecretSentinel');
  });
});
