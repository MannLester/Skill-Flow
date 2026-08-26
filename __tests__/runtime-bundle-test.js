const { scanBundleText } = require('../scripts/check-runtime-bundle.cjs');
const { describe, expect, it } = require('@jest/globals');

describe('runtime bundle boundary', () => {
  it('allows only the documented public runtime names', () => {
    expect(scanBundleText('EXPO_PUBLIC_RUNTIME_TARGET EXPO_PUBLIC_CONVEX_URL EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY')).toEqual({
      unknownPublicKeys: [],
      containsForbiddenSentinel: false,
    });
  });

  it('rejects unknown public names and synthetic secrets', () => {
    expect(scanBundleText('EXPO_PUBLIC_UNDOCUMENTED_VALUE SkillFlowVerifierSecretSentinel')).toEqual({
      unknownPublicKeys: ['EXPO_PUBLIC_UNDOCUMENTED_VALUE'],
      containsForbiddenSentinel: true,
    });
  });
});
