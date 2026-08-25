import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import * as runner from '../scripts/verify-android-device.mjs';

const sha = 'a'.repeat(40);

test('validates full SHA, safe serial, port, and a strict child environment', () => {
  const parsed = runner.parseInputs({
    SKILLFLOW_ANDROID_SERIAL: 'device-1234',
    SKILLFLOW_ANDROID_EXPECTED_SHA: sha.toUpperCase(),
    SKILLFLOW_ANDROID_METRO_PORT: '8099',
  });
  assert.deepEqual(parsed, { serial: 'device-1234', expectedSha: sha, port: 8099 });
  for (const serial of ['', '-device', 'device name', 'device\nname']) {
    assert.throws(() => runner.parseInputs({
      SKILLFLOW_ANDROID_SERIAL: serial,
      SKILLFLOW_ANDROID_EXPECTED_SHA: sha,
      SKILLFLOW_ANDROID_METRO_PORT: '8099',
    }), /SERIAL/);
  }
  assert.throws(() => runner.parseInputs({
    SKILLFLOW_ANDROID_SERIAL: 'device',
    SKILLFLOW_ANDROID_EXPECTED_SHA: 'abc123',
    SKILLFLOW_ANDROID_METRO_PORT: '8099',
  }), /40-character/);
  assert.throws(() => runner.parseInputs({
    SKILLFLOW_ANDROID_SERIAL: 'device',
    SKILLFLOW_ANDROID_EXPECTED_SHA: sha,
    SKILLFLOW_ANDROID_METRO_PORT: '80',
  }), /1024/);
  const childEnv = runner.sanitizedEnvironment({
    PATH: '/safe/bin',
    HOME: '/safe/home',
    JAVA_HOME: '/validated/jdk17',
    ANDROID_SERIAL: 'wrong',
    EXPO_TOKEN: 'fake-account-token',
    CLERK_SECRET_KEY: 'fake-clerk-secret',
    EXPO_PUBLIC_CONVEX_URL: 'https://prod.example.test',
    SAFE: 'not-allowlisted',
  }, { NODE_BINARY: '/safe/node', CLERK_SECRET_KEY: 'injected-secret' });
  assert.deepEqual(childEnv, {
    HOME: '/safe/home',
    JAVA_HOME: '/validated/jdk17',
    PATH: '/safe/bin',
    NODE_BINARY: '/safe/node',
    CI: '1',
    NODE_ENV: 'development',
    EXPO_NO_DOTENV: '1',
    EXPO_NO_CLIENT_ENV_VARS: '1',
  });
  assert.equal(runner.sanitizedEnvironment({ Path: 'C:\\safe' }).Path, 'C:\\safe');
});

test('selects one exact serial even when models match and prefixes every device command', () => {
  const rows = [
    'List of devices attached',
    'serial-a device product:x model:CPH2343 transport_id:1',
    'serial-b device product:x model:CPH2343 transport_id:2',
    '',
  ].join('\n');
  assert.equal(runner.parseAdbDevices(rows, 'serial-b').serial, 'serial-b');
  assert.throws(
    () => runner.parseAdbDevices(rows.replace('serial-b device', 'serial-b unauthorized'), 'serial-b'),
    /unauthorized/,
  );
  assert.throws(() => runner.parseAdbDevices(rows + 'serial-b device model:CPH2343\n', 'serial-b'), /exactly one/);
  assert.deepEqual(
    runner.deviceArguments('serial-b', ['shell', 'pidof', runner.APP_ID]),
    ['-s', 'serial-b', 'shell', 'pidof', runner.APP_ID],
  );
});

test('pins toolchain versions and SHA-qualified evidence names', () => {
  assert.doesNotThrow(() => runner.assertRuntimeVersions('22.14.0', 'openjdk version "17.0.12"'));
  assert.throws(() => runner.assertRuntimeVersions('20.19.4', 'openjdk version "17.0.12"'), /Node 22/);
  assert.throws(() => runner.assertRuntimeVersions('22.14.0', 'openjdk version "21.0.7"'), /JDK 17/);
  assert.equal(runner.evidencePrefix(sha), 'skillflow-android-aaaaaaaaaaaa-');
  const candidates = runner.sdkToolCandidates('/sdk');
  assert.equal(candidates.adb, path.join('/sdk', 'platform-tools', 'adb'));
  assert.equal(candidates.apkanalyzer.length, 2);
  assert.doesNotThrow(() => runner.assertAndroidAbsent('/repo', { exists: () => false }));
  assert.throws(() => runner.assertAndroidAbsent('/repo', { exists: () => true }), /must be absent/);
});

test('requires the exact clean repository HEAD', () => {
  const responses = new Map([
    ['rev-parse --show-toplevel', '/repo\n'],
    ['rev-parse HEAD', sha + '\n'],
    ['status --porcelain --untracked-files=all', ''],
  ]);
  const adapter = fakeGitAdapter(responses);
  assert.doesNotThrow(() => runner.assertGitState({ expectedSha: sha }, '/repo', adapter));
  responses.set('rev-parse HEAD', 'b'.repeat(40) + '\n');
  assert.throws(() => runner.assertGitState({ expectedSha: sha }, '/repo', adapter), /does not equal/);
  responses.set('rev-parse HEAD', sha + '\n');
  responses.set('status --porcelain --untracked-files=all', '?? scratch\n');
  assert.throws(() => runner.assertGitState({ expectedSha: sha }, '/repo', adapter), /clean/);
});

test('rejects occupied ports/reverses and mutates exactly one version anchor', async () => {
  assert.throws(() => runner.assertNoReverseMapping('serial tcp:8099 tcp:8099\n', 8099), /already exists/);
  assert.doesNotThrow(() => runner.assertNoReverseMapping('serial tcp:8098 tcp:8098\n', 8099));
  const occupiedServer = fakeServer((handlers) => handlers.error(new Error('EADDRINUSE')));
  await assert.rejects(runner.checkPortAvailability(8099, () => occupiedServer), /EADDRINUSE/);
  const availableServer = fakeServer((_handlers, onListen) => onListen());
  await assert.doesNotReject(runner.checkPortAvailability(8099, () => availableServer));
  const source = 'android {\n  versionName "1.0.0"\n}\n';
  const changed = runner.mutateVersionName(source, '1.0.0', sha);
  assert.equal(changed.marker, '1.0.0-qa.' + sha);
  assert.match(changed.source, /versionName "1\.0\.0-qa\.a{40}"/);
  assert.throws(() => runner.mutateVersionName(source + source, '1.0.0', sha), /found 2/);
  assert.throws(() => runner.mutateVersionName('versionName "2.0.0"\n', '1.0.0', sha), /does not match/);
});

test('claims a reverse with an immediate no-rebind check and verifies exact ownership', () => {
  const calls = [];
  const responses = ['', '', 'authorized tcp:8099 tcp:8099\n'];
  const cleanup = { reverseCreated: false };
  runner.createOwnedReverse({
    adapter: { run: (_command, args) => { calls.push(args); return { stdout: responses.shift() }; } },
    adb: '/sdk/adb',
    serial: 'authorized',
    port: 8099,
    cleanup,
  });
  assert.equal(cleanup.reverseCreated, true);
  assert.deepEqual(calls, [
    ['-s', 'authorized', 'reverse', '--list'],
    ['-s', 'authorized', 'reverse', '--no-rebind', 'tcp:8099', 'tcp:8099'],
    ['-s', 'authorized', 'reverse', '--list'],
  ]);
  const conflictCalls = [];
  assert.throws(() => runner.createOwnedReverse({
    adapter: {
      run: (_command, args) => {
        conflictCalls.push(args);
        return { stdout: 'authorized tcp:8099 tcp:8099\n' };
      },
    },
    adb: '/sdk/adb',
    serial: 'authorized',
    port: 8099,
    cleanup: { reverseCreated: false },
  }), /owner is unknown/);
  assert.equal(conflictCalls.length, 1);
});

test('resolves only one contained regular APK', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'skillflow-apk-test-'));
  try {
    const outputRoot = path.join(fixture, 'debug');
    fs.mkdirSync(outputRoot);
    const metadata = path.join(outputRoot, 'output-metadata.json');
    const apk = path.join(outputRoot, 'app-debug.apk');
    fs.writeFileSync(apk, 'apk');
    const single = JSON.stringify({ elements: [{ outputFile: 'app-debug.apk' }] });
    assert.equal(runner.resolveApkFromMetadata(single, metadata), fs.realpathSync(apk));
    assert.throws(() => runner.resolveApkFromMetadata('{"elements":[]}', metadata), /exactly one/);
    const escape = JSON.stringify({ elements: [{ outputFile: '../escape.apk' }] });
    assert.throws(() => runner.resolveApkFromMetadata(escape, metadata), /owned root|child/);
    const many = JSON.stringify({ elements: [{ outputFile: 'a.apk' }, { outputFile: 'b.apk' }] });
    assert.throws(() => runner.resolveApkFromMetadata(many, metadata), /exactly one/);
    const link = path.join(outputRoot, 'link.apk');
    fs.symlinkSync(apk, link);
    const linked = JSON.stringify({ elements: [{ outputFile: 'link.apk' }] });
    assert.throws(() => runner.resolveApkFromMetadata(linked, metadata), /non-symlink/);
  } finally {
    fs.rmSync(fixture, { recursive: true });
  }
});

test('requires analyzed and post-install exact identity', () => {
  const marker = '1.0.0-qa.' + sha;
  const summary = runner.parseApkSummary(runner.APP_ID + ' 1 ' + marker, runner.APP_ID, marker);
  assert.equal(summary.versionName, marker);
  assert.throws(() => runner.parseApkSummary('other.app 1 ' + marker, runner.APP_ID, marker), /does not match/);
  const readback = [
    'Package [' + runner.APP_ID + ']',
    '  versionName=' + marker,
    '  lastUpdateTime=2026-08-26 10:00:01',
  ].join('\n');
  assert.equal(
    runner.parsePackageReadback(readback, runner.APP_ID, marker, '2026-08-26 10:00:00').versionName,
    marker,
  );
  assert.throws(
    () => runner.parsePackageReadback(readback.replace(marker, '1.0.0'), runner.APP_ID, marker, '2026-08-26 10:00:00'),
    /does not match/,
  );
  assert.throws(
    () => runner.parsePackageReadback(readback, runner.APP_ID, marker, '2026-08-26 10:00:02'),
    /predates/,
  );
  assert.doesNotThrow(() => runner.assertInstallSuccess('Performing Streamed Install\nSuccess\n'));
  assert.throws(() => runner.assertInstallSuccess('Failure [INSTALL_FAILED]'), /Success marker/);
  assert.doesNotThrow(() => runner.assertLaunchSuccess('Status: ok\nActivity: app/.MainActivity'));
  assert.throws(() => runner.assertLaunchSuccess('Status: timeout'), /successful bounded start/);
  const resumed = 'mResumedActivity: ActivityRecord{abc ' + runner.APP_ID + '/.MainActivity}';
  assert.doesNotThrow(() => runner.assertForegroundActivity(resumed));
  assert.throws(() => runner.assertForegroundActivity('mResumedActivity other.app/.Main'), /foreground/);
  assert.equal(runner.parseSinglePid('1234\n'), '1234');
  assert.throws(() => runner.parseSinglePid('1234 5678'), /one live/);
});

test('redacts evidence and rejects stale PNG/runtime failure evidence', () => {
  const redacted = runner.redactSerial('authorized-1234');
  assert.equal(redacted.lastFour, '1234');
  assert.match(redacted.hash, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(redacted), /authorized-1234/);
  assert.equal(runner.isValidPng(Buffer.concat([runner.PNG_SIGNATURE, Buffer.alloc(17)])), true);
  assert.equal(runner.isValidPng(Buffer.from('old screenshot')), false);
  assert.equal(runner.relevantRuntimeFailures('ReactNativeJS: uncaught Error: boom').length, 1);
  assert.equal(runner.relevantRuntimeFailures('Metro: Bundling failed').length, 1);
  assert.deepEqual(runner.relevantRuntimeFailures('ReactNativeJS: normal startup'), []);
});

test('redacts secrets, credentials, tokens, and URLs throughout serialized evidence', () => {
  const secret = 'fake-adversarial-secret-value';
  const manifest = runner.serializeEvidenceManifest({
    gitSha: sha,
    errors: [
      'CLERK_SECRET_KEY=' + secret,
      'request failed at https://prod.example.test/deploy?token=query-value',
      'Authorization: Bearer fake.header.payload',
      'password: "visible-password"',
      'publishable_key=pk_test_fake_public_value',
      'provider token github_pat_FAKE123456789',
    ],
    nested: { diagnostic: 'device authorized-1234 used ' + secret },
  }, ['authorized-1234', secret]);
  assert.equal(manifest.includes(secret), false);
  assert.equal(manifest.includes('authorized-1234'), false);
  assert.equal(manifest.includes('prod.example.test'), false);
  assert.equal(manifest.includes('query-value'), false);
  assert.equal(manifest.includes('fake.header.payload'), false);
  assert.equal(manifest.includes('visible-password'), false);
  assert.equal(manifest.includes('pk_test_fake_public_value'), false);
  assert.equal(manifest.includes('github_pat_FAKE123456789'), false);
  assert.equal(manifest.includes(sha), true);
  assert.match(manifest, /redacted/);
});

test('bounds and redacts retained Metro logs after adversarial truncation', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'skillflow-metro-log-test-'));
  try {
    const logPath = path.join(fixture, 'metro.log');
    const secret = 'fake-metro-secret-value';
    const capture = runner.createBoundedLogCapture({
      logPath,
      maxBytes: 256,
      fsAdapter: { write: (target, value) => fs.writeFileSync(target, value) },
      redact: (value) => runner.redactText(value, [secret]),
    });
    capture.append('discarded-prefix\n' + 'x'.repeat(400));
    const result = capture.append('\nCLERK_SECRET_KEY=' + secret + '\nhttps://prod.example.test/private\nTAIL\n');
    const persisted = fs.readFileSync(logPath);
    assert.equal(result.truncated, true);
    assert.equal(result.totalBytes > result.maxBytes, true);
    assert.equal(result.bufferedBytes <= result.maxBytes, true);
    assert.equal(result.retainedBytes <= result.maxBytes, true);
    assert.equal(persisted.length <= 256, true);
    assert.match(persisted.toString(), /Metro log truncated/);
    assert.match(persisted.toString(), /TAIL/);
    assert.equal(persisted.includes(secret), false);
    assert.equal(persisted.includes('prod.example.test'), false);
  } finally {
    fs.rmSync(fixture, { recursive: true });
  }
});

test('requires both an owned Metro announcement and the Metro status protocol', async () => {
  assert.equal(runner.metroAnnouncedReady('Metro waiting on http://localhost:8099', 8099), true);
  assert.equal(runner.metroAnnouncedReady('Metro waiting on http://localhost:80990', 8099), false);
  assert.equal(
    runner.metroAnnouncedReady(
      'Metro waiting on exp+skillflow://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8099',
      8099,
    ),
    true,
  );
  assert.equal(
    runner.metroAnnouncedReady(
      'Metro waiting on exp+skillflow://expo-development-client/?url=http%3A%2F%2Flocalhost%3A80990',
      8099,
    ),
    false,
  );
  assert.equal(
    runner.metroAnnouncedReady(
      'Metro waiting on exp+skillflow://expo-development-client:8099/?url=http%3A%2F%2Flocalhost%3A80990',
      8099,
    ),
    false,
  );
  assert.equal(
    runner.metroAnnouncedReady(
      'Metro waiting on exp+skillflow://expo-development-client:8098/?url=http%3A%2F%2Flocalhost%3A8099',
      8099,
    ),
    true,
  );
  assert.equal(
    runner.metroAnnouncedReady(
      'Metro waiting on exp+skillflow://expo-development-client:80990/?url=http%3A%2F%2Flocalhost%3A8099',
      8099,
    ),
    false,
  );
  assert.equal(
    runner.metroAnnouncedReady(
      'Metro waiting on exp+skillflow://expo-development-client:8099/?url=http://localhost:80990',
      8099,
    ),
    false,
  );
  assert.equal(
    runner.metroAnnouncedReady(
      'Metro waiting on exp+skillflow://expo-development-client:8099/?url=http%253A%252F%252Flocalhost%253A8099',
      8099,
    ),
    false,
  );
  assert.equal(
    runner.metroAnnouncedReady(
      'Metro waiting on exp+skillflow://expo-development-client:8099/?url=%25',
      8099,
    ),
    false,
  );
  assert.equal(
    runner.metroAnnouncedReady(
      'Metro waiting on exp+skillflow://expo-development-client:8099/?url=http%3A%2F%2Flocalhost%3A8099&url=http%3A%2F%2Flocalhost%3A8099',
      8099,
    ),
    false,
  );
  assert.equal(
    runner.metroAnnouncedReady(
      'Metro waiting on exp+skillflow://expo-development-client:8099/?url=http%3A%2F%2Flocalhost%3A8099&URL=http%3A%2F%2Flocalhost%3A80990',
      8099,
    ),
    false,
  );
  assert.equal(runner.metroAnnouncedReady('unrelated listener on :8099', 8099), false);
  assert.equal(runner.isMetroProtocolResponse(200, 'packager-status:running\n', '/repo', '/repo'), true);
  assert.equal(runner.isMetroProtocolResponse(200, 'generic ok', '/repo', '/repo'), false);
  assert.equal(runner.isMetroProtocolResponse(200, 'packager-status:running', '/other', '/repo'), false);
  assert.throws(() => runner.assertOwnedMetroChild({ exitCode: null }), /process identity/);
  let protocolRequests = 0;
  const adapter = {
    ...runner.createDefaultAdapter(),
    requestMetro: async () => { protocolRequests += 1; return true; },
    sleep: async () => undefined,
  };
  await assert.rejects(
    adapter.waitForMetro(8099, { pid: 123, exitCode: null, metroCapture: { hasReadiness: () => false } }, 2, '/repo'),
    /Owned Metro did not become ready/,
  );
  assert.equal(protocolRequests, 0);
  await assert.doesNotReject(
    adapter.waitForMetro(8099, { pid: 123, exitCode: null, metroCapture: { hasReadiness: () => true } }, 1_000, '/repo'),
  );
  assert.equal(protocolRequests, 1);
});

test('redacts emergency exception and rejection summaries before stderr persistence', () => {
  const secret = 'fake-emergency-secret';
  const summary = runner.formatEmergencySummary(
    'unhandledRejection: serial-1234 ' + secret + ' https://prod.example.test',
    'FAIL',
    ['serial-1234', secret],
  );
  assert.equal(summary.includes('serial-1234'), false);
  assert.equal(summary.includes(secret), false);
  assert.equal(summary.includes('prod.example.test'), false);
  assert.match(summary, /^unhandledRejection:/);
  assert.match(summary, /: FAIL\. SIGKILL/);
});

test('cleanup targets only resources proven owned and is idempotent', async () => {
  const calls = [];
  let alive = true;
  const cleanup = createCleanup({
    calls,
    isAlive: () => alive,
    killOwned: (_child, signal) => { calls.push(['kill', signal]); alive = false; },
  });
  cleanup.metro = { pid: 321 };
  cleanup.reverseCreated = true;
  cleanup.androidCreated = true;
  await cleanup.run();
  await cleanup.run();
  assert.deepEqual(calls, [
    ['kill', 'SIGINT'],
    ['run', ['-s', 'authorized', 'reverse', '--remove', 'tcp:8099']],
    ['rm', path.join('/repo', 'android')],
  ]);
});

test('cleanup is single-flight under concurrent normal and signal callers', async () => {
  const calls = [];
  let alive = true;
  let releaseStop;
  const stopGate = new Promise((resolve) => { releaseStop = resolve; });
  const cleanup = createCleanup({
    calls,
    isAlive: () => alive,
    killOwned: (_child, signal) => { calls.push(['kill', signal]); alive = false; },
    sleep: () => stopGate,
  });
  cleanup.metro = { pid: 321 };
  cleanup.reverseCreated = true;
  cleanup.androidCreated = true;
  const normal = cleanup.run();
  const signal = cleanup.run();
  assert.equal(normal, signal);
  releaseStop();
  await Promise.all([normal, signal, cleanup.run()]);
  assert.deepEqual(calls, [
    ['kill', 'SIGINT'],
    ['run', ['-s', 'authorized', 'reverse', '--remove', 'tcp:8099']],
    ['rm', path.join('/repo', 'android')],
  ]);
});

test('cleanup escalation is bounded and signals fail closed before complete evidence', async () => {
  const calls = [];
  const cleanup = createCleanup({
    calls,
    isAlive: () => true,
    killOwned: (_child, signal) => calls.push(['kill', signal]),
  });
  cleanup.metro = { pid: 321 };
  cleanup.reverseCreated = true;
  cleanup.androidCreated = true;
  await assert.rejects(cleanup.run(), /remained alive/);
  assert.deepEqual(calls.slice(0, 3), [
    ['kill', 'SIGINT'],
    ['kill', 'SIGTERM'],
    ['kill', 'SIGKILL'],
  ]);
  assert.ok(calls.some((entry) => entry[0] === 'run'));
  assert.ok(calls.some((entry) => entry[0] === 'rm'));
  assert.equal(runner.decideSignalOutcome(false, true), 'FAIL');
  assert.equal(runner.decideSignalOutcome(true, false), 'FAIL');
  assert.equal(runner.decideSignalOutcome(true, true), 'PASS');
  await assert.rejects(
    runner.createDefaultAdapter().waitForMetro(
      65534,
      { pid: 123, exitCode: 1, metroCapture: { hasReadiness: () => false } },
      10,
      '/repo',
    ),
    /exited before readiness/,
  );
});

function createCleanup({ calls, isAlive, killOwned, sleep = async () => undefined }) {
  return new runner.OwnedCleanup({
    adb: '/sdk/adb',
    serial: 'authorized',
    port: 8099,
    repoRoot: '/repo',
    adapter: {
      run: (_command, args) => { calls.push(['run', args]); return { stdout: '' }; },
      isAlive,
      killOwned,
      sleep,
      fs: { rm: (target) => calls.push(['rm', target]) },
    },
  });
}

function fakeGitAdapter(responses) {
  return {
    run: (_command, args) => ({ stdout: responses.get(args.join(' ')) ?? '' }),
    fs: { realpath: (target) => target },
  };
}

function fakeServer(onStart) {
  const handlers = {};
  return {
    unref: () => undefined,
    once: (event, handler) => { handlers[event] = handler; },
    listen: (_options, onListen) => onStart(handlers, onListen),
    close: (callback) => callback(),
  };
}
