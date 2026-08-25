const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { describe, expect, it } = require('@jest/globals');

describe('exact-SHA Android verification runner', () => {
  it('passes its dependency-free adapter and safety self-tests', () => {
    const testFile = path.resolve('__tests__/verify-android-device-cases.mjs');
    const result = spawnSync(process.execPath, ['--test', testFile], {
      encoding: 'utf8',
      shell: false,
      timeout: 30_000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('pass 16');
    expect(result.stderr).toBe('');
  });
});
