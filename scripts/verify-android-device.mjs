#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import {
  accessSync,
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

export const APP_ID = 'com.skillflow.prototype';
export const SHA_PATTERN = /^[0-9a-f]{40}$/i;
export const SERIAL_PATTERN = /^[A-Za-z0-9._:-]+$/;
export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const READY_TIMEOUT_MS = 60_000;
const COMMAND_TIMEOUT_MS = 10 * 60_000;
const VERSION_ANCHOR = /^([ \t]*versionName[ \t]+["'])([^"']+)(["'][ \t]*)$/gm;
const scriptPath = fileURLToPath(import.meta.url);

export function parseInputs(env) {
  const serial = env.SKILLFLOW_ANDROID_SERIAL ?? '';
  const expectedSha = env.SKILLFLOW_ANDROID_EXPECTED_SHA ?? '';
  const portText = env.SKILLFLOW_ANDROID_METRO_PORT ?? '';
  validateSerial(serial);
  validateExpectedSha(expectedSha);
  const port = parsePort(portText);
  return { serial, expectedSha: expectedSha.toLowerCase(), port };
}

function validateSerial(serial) {
  if (!serial || serial.startsWith('-') || !SERIAL_PATTERN.test(serial)) {
    throw new Error('SKILLFLOW_ANDROID_SERIAL must be one exact adb serial without whitespace, controls, or a leading dash.');
  }
}

function validateExpectedSha(expectedSha) {
  if (!SHA_PATTERN.test(expectedSha)) {
    throw new Error('SKILLFLOW_ANDROID_EXPECTED_SHA must be one full 40-character hexadecimal SHA.');
  }
}

function parsePort(portText) {
  if (!/^\d+$/.test(portText)) {
    throw new Error('SKILLFLOW_ANDROID_METRO_PORT must be an integer from 1024 through 65535.');
  }
  const port = Number(portText);
  if (port < 1024 || port > 65535) {
    throw new Error('SKILLFLOW_ANDROID_METRO_PORT must be an integer from 1024 through 65535.');
  }
  return port;
}

export function sanitizedEnvironment(env, additions = {}) {
  const clean = { ...env, ...additions };
  delete clean.ANDROID_SERIAL;
  return clean;
}

export function parseAdbDevices(output, serial) {
  const rows = String(output).split(/\r?\n/).slice(1).filter((line) => line.trim()).map((line) => {
    const [deviceSerial, state, ...details] = line.trim().split(/\s+/);
    return { serial: deviceSerial, state, details: details.join(' ') };
  });
  const matches = rows.filter((row) => row.serial === serial);
  if (matches.length !== 1) {
    throw new Error('Expected exactly one adb row for the authorized serial; found ' + matches.length + '.');
  }
  if (matches[0].state !== 'device') {
    throw new Error('Authorized adb serial is ' + (matches[0].state ?? 'missing') + ', not device.');
  }
  return matches[0];
}

export function assertNoReverseMapping(output, port) {
  const target = 'tcp:' + port;
  const conflict = String(output).split(/\r?\n/).some((line) => {
    const columns = line.trim().split(/\s+/);
    return columns.length >= 2 && columns[columns.length - 2] === target;
  });
  if (conflict) throw new Error('Device reverse mapping ' + target + ' already exists and its owner is unknown.');
}

export function mutateVersionName(source, baseVersion, expectedSha) {
  const matches = [...source.matchAll(VERSION_ANCHOR)];
  if (matches.length !== 1) {
    throw new Error('Expected exactly one generated versionName anchor for ' + baseVersion + '; found ' + matches.length + '.');
  }
  if (matches[0][2] !== baseVersion) {
    throw new Error('Generated versionName does not match Expo base version ' + baseVersion + '.');
  }
  const marker = baseVersion + '-qa.' + expectedSha.toLowerCase();
  const updated = source.replace(VERSION_ANCHOR, (_line, prefix, _value, suffix) => {
    return prefix + marker + suffix;
  });
  return { marker, source: updated };
}

export function resolveApkFromMetadata(metadataText, metadataPath, fsAdapter = defaultFs) {
  let metadata;
  try {
    metadata = JSON.parse(metadataText);
  } catch {
    throw new Error('Android output metadata is malformed JSON.');
  }
  const outputs = Array.isArray(metadata.elements)
    ? metadata.elements.map((entry) => entry?.outputFile).filter(Boolean)
    : [];
  if (outputs.length !== 1 || typeof outputs[0] !== 'string') {
    throw new Error('Expected exactly one debug APK in output metadata; found ' + outputs.length + '.');
  }
  if (path.isAbsolute(outputs[0])) throw new Error('APK output metadata must use a contained relative path.');
  const outputRoot = path.dirname(metadataPath);
  const candidate = path.resolve(outputRoot, outputs[0]);
  assertContained(outputRoot, candidate, 'APK output');
  const stat = fsAdapter.lstat(candidate);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error('APK output must be a regular non-symlink file.');
  }
  const realCandidate = fsAdapter.realpath(candidate);
  assertContained(fsAdapter.realpath(outputRoot), realCandidate, 'APK output');
  return realCandidate;
}

export function parseApkSummary(output, expectedId, expectedMarker) {
  const fields = String(output).trim().split(/\s+/);
  if (fields.length < 3 || fields[0] !== expectedId || fields.at(-1) !== expectedMarker) {
    throw new Error('Built APK application ID or exact-SHA version marker does not match.');
  }
  return { applicationId: fields[0], versionCode: fields[1], versionName: fields.at(-1) };
}

export function parsePackageReadback(output, expectedId, expectedMarker, deviceStartText) {
  const text = String(output);
  const version = text.match(/^\s*versionName=(.+)$/m)?.[1]?.trim();
  const updated = text.match(/^\s*lastUpdateTime=(.+)$/m)?.[1]?.trim();
  if (!text.includes('Package [' + expectedId + ']') || version !== expectedMarker) {
    throw new Error('Installed package ID or full-SHA version marker does not match the built APK.');
  }
  if (!updated || updated < deviceStartText) {
    throw new Error('Installed package lastUpdateTime predates this verification run.');
  }
  return { versionName: version, lastUpdateTime: updated };
}

export function isValidPng(bytes) {
  return Buffer.isBuffer(bytes)
    && bytes.length > 24
    && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

export function redactSerial(serial) {
  return {
    hash: createHash('sha256').update(serial).digest('hex'),
    lastFour: serial.slice(-4),
  };
}

export function relevantRuntimeFailures(logText) {
  const pattern = /FATAL EXCEPTION|AndroidRuntime.*FATAL|Unable to load script|Unable to resolve module|Bundling failed|Could not connect to (?:development|dev) server|ReactNativeJS.*(?:uncaught|unhandled|error)|Metro.*(?:error|bundle|load).*fail/i;
  return String(logText).split(/\r?\n/).filter((line) => pattern.test(line));
}

export function decideSignalOutcome(evidenceComplete, cleanupSucceeded) {
  return evidenceComplete && cleanupSucceeded ? 'PASS' : 'FAIL';
}

export function deviceArguments(serial, args) {
  return ['-s', serial, ...args];
}

export function evidencePrefix(expectedSha) {
  return 'skillflow-android-' + expectedSha.slice(0, 12) + '-';
}

export function assertAndroidAbsent(repoRoot, fsAdapter) {
  if (fsAdapter.exists(path.join(repoRoot, 'android'))) {
    throw new Error('Generated android/ must be absent before verification; refusing to delete or layer onto it.');
  }
}

export function assertInstallSuccess(output) {
  if (!/(?:^|\n)Success\s*$/m.test(String(output))) {
    throw new Error('adb install did not return the required Success marker.');
  }
}

export function assertLaunchSuccess(output) {
  if (!/Status:\s*ok/i.test(String(output))) {
    throw new Error('Android activity did not report a successful bounded start.');
  }
}

export function assertForegroundActivity(output, appId = APP_ID) {
  const foreground = new RegExp('mResumedActivity[^\\n]*' + escapeRegex(appId) + '/');
  if (!foreground.test(String(output))) throw new Error('SkillFlow is not the resumed foreground activity.');
}

export function sdkToolCandidates(sdkRoot) {
  return {
    adb: path.join(sdkRoot, 'platform-tools', executableName('adb')),
    apkanalyzer: [
      path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin', executableName('apkanalyzer')),
      path.join(sdkRoot, 'tools', 'bin', executableName('apkanalyzer')),
    ],
  };
}

export function checkPortAvailability(port, createServer = () => net.createServer()) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });
}

export class OwnedCleanup {
  constructor({ adb, serial, port, repoRoot, adapter = defaultAdapter }) {
    this.adb = adb;
    this.serial = serial;
    this.port = port;
    this.repoRoot = repoRoot;
    this.adapter = adapter;
    this.metro = null;
    this.reverseCreated = false;
    this.androidCreated = false;
    this.completed = false;
  }

  async run() {
    if (this.completed) return;
    const failures = [];
    await this.stopMetro(failures);
    this.removeReverse(failures);
    this.removeAndroid(failures);
    this.completed = true;
    if (failures.length) throw new Error('Cleanup failed: ' + failures.join('; '));
  }

  async stopMetro(failures) {
    if (!this.metro?.pid) return;
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGKILL']) {
      if (!this.adapter.isAlive(this.metro)) return;
      try {
        this.adapter.killOwned(this.metro, signal);
      } catch (error) {
        failures.push('Metro ' + signal + ': ' + error.message);
        return;
      }
      await this.adapter.sleep(1_000);
    }
    if (this.adapter.isAlive(this.metro)) failures.push('owned Metro process group remained alive');
  }

  removeReverse(failures) {
    if (!this.reverseCreated) return;
    try {
      this.adapter.run(
        this.adb,
        ['-s', this.serial, 'reverse', '--remove', 'tcp:' + this.port],
        { timeout: 10_000 },
      );
    } catch (error) {
      failures.push('reverse removal: ' + error.message);
    }
  }

  removeAndroid(failures) {
    if (!this.androidCreated) return;
    const androidPath = path.join(this.repoRoot, 'android');
    try {
      assertContained(this.repoRoot, androidPath, 'generated Android tree');
      this.adapter.fs.rm(androidPath);
    } catch (error) {
      failures.push('generated Android removal: ' + error.message);
    }
  }
}

export function createDefaultAdapter() {
  return defaultAdapter;
}

export async function runVerification({
  env = process.env,
  cwd = process.cwd(),
  adapter = defaultAdapter,
  onState,
} = {}) {
  const inputs = parseInputs(env);
  const repoRoot = adapter.fs.realpath(cwd);
  const prefix = path.join(os.tmpdir(), evidencePrefix(inputs.expectedSha));
  const evidenceDir = adapter.fs.mkdtemp(prefix);
  const state = createState(inputs, repoRoot, evidenceDir);
  onState?.(state);
  let cleanup;
  try {
    const tools = await preflight({ inputs, env, repoRoot, adapter, state });
    cleanup = createCleanup(inputs, repoRoot, adapter, tools.adb);
    state.cleanup = cleanup;
    onState?.(state);
    return await executeVerification({ inputs, env, repoRoot, adapter, tools, cleanup, state });
  } catch (error) {
    return failVerification({ error, inputs, adapter, cleanup, state });
  }
}

function createCleanup(inputs, repoRoot, adapter, adb) {
  return new OwnedCleanup({ adb, serial: inputs.serial, port: inputs.port, repoRoot, adapter });
}

async function executeVerification(context) {
  const { inputs, env, repoRoot, adapter, tools, cleanup, state } = context;
  const artifact = buildArtifact({ inputs, env, repoRoot, adapter, tools, cleanup, state });
  installArtifact({ inputs, adapter, tools, artifact, state });
  await startAndCapture({ inputs, env, repoRoot, adapter, tools, cleanup, state });
  state.evidenceComplete = true;
  await cleanup.run();
  recordPhase(state, 'cleanup');
  finishState(state, 'PASS');
  writeManifest(adapter.fs, state);
  return state;
}

async function failVerification({ error, inputs, adapter, cleanup, state }) {
  state.errors.push(redactText(error instanceof Error ? error.message : String(error), inputs.serial));
  await captureFailureLogs({ inputs, adapter, cleanup, state });
  try {
    await cleanup?.run();
    if (cleanup) recordPhase(state, 'cleanup');
  } catch (cleanupError) {
    state.errors.push(redactText(cleanupError.message, inputs.serial));
  }
  finishState(state, 'FAIL');
  writeManifest(adapter.fs, state);
  const manifest = path.join(state.paths.evidenceDirectory, 'manifest.json');
  const failure = new Error(state.errors.join('; ') + ' Evidence: ' + manifest);
  failure.evidenceDir = state.paths.evidenceDirectory;
  throw failure;
}

function createState(inputs, repoRoot, evidenceDir) {
  return {
    runId: inputs.expectedSha.slice(0, 12) + '-' + randomUUID(),
    result: 'RUNNING',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    gitSha: inputs.expectedSha,
    repositoryRoot: repoRoot,
    device: { serial: redactSerial(inputs.serial) },
    app: { applicationId: APP_ID },
    metro: { port: inputs.port, pid: null },
    artifact: {},
    runtime: {},
    paths: { evidenceDirectory: evidenceDir },
    phases: [],
    errors: [],
    evidenceComplete: false,
  };
}

async function preflight({ inputs, env, repoRoot, adapter, state }) {
  assertGitState(inputs, repoRoot, adapter);
  const tools = resolveTools(env, repoRoot, adapter);
  const row = verifyDevice(inputs, tools.adb, adapter);
  state.device.model = parseDetail(row.details, 'model');
  state.device.androidVersion = adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['shell', 'getprop', 'ro.build.version.release'],
  ).stdout.trim();
  await adapter.checkPort(inputs.port);
  const reverse = adbRun(adapter, tools.adb, inputs.serial, ['reverse', '--list']).stdout;
  assertNoReverseMapping(reverse, inputs.port);
  assertAndroidAbsent(repoRoot, adapter.fs);
  recordPhase(state, 'preflight');
  return tools;
}

export function assertGitState(inputs, repoRoot, adapter) {
  const top = adapter.run('git', ['rev-parse', '--show-toplevel'], { cwd: repoRoot }).stdout.trim();
  if (adapter.fs.realpath(top) !== repoRoot) throw new Error('Runner must execute at the exact repository root.');
  const head = adapter.run('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }).stdout.trim().toLowerCase();
  if (head !== inputs.expectedSha) {
    throw new Error('HEAD ' + head + ' does not equal SKILLFLOW_ANDROID_EXPECTED_SHA.');
  }
  const dirty = adapter.run(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    { cwd: repoRoot },
  ).stdout;
  if (dirty.trim()) throw new Error('Checkout must be completely clean, including untracked files.');
}

export function assertRuntimeVersions(nodeVersion, javaOutput) {
  const [major] = String(nodeVersion).split('.').map(Number);
  if (major !== 22) throw new Error('Node 22.x is required; running ' + nodeVersion + '.');
  const javaMajor = String(javaOutput).match(/version "([0-9]+)/)?.[1];
  if (javaMajor !== '17') throw new Error('JDK 17 is required; detected ' + (javaMajor ?? 'unknown') + '.');
}

function resolveTools(env, repoRoot, adapter) {
  const sdkRoot = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  if (!sdkRoot) throw new Error('ANDROID_HOME or ANDROID_SDK_ROOT is required.');
  if (env.ANDROID_HOME && env.ANDROID_SDK_ROOT) {
    const home = adapter.fs.realpath(env.ANDROID_HOME);
    const root = adapter.fs.realpath(env.ANDROID_SDK_ROOT);
    if (home !== root) throw new Error('ANDROID_HOME and ANDROID_SDK_ROOT resolve to different SDKs.');
  }
  const sdk = adapter.fs.realpath(sdkRoot);
  const candidates = sdkToolCandidates(sdk);
  const adb = requireExecutable(candidates.adb, adapter);
  const apkanalyzer = findExecutable(candidates.apkanalyzer, adapter, 'apkanalyzer');
  const expo = requireRegular(path.join(repoRoot, 'node_modules', 'expo', 'bin', 'cli'), adapter, 'Expo CLI');
  const java = env.JAVA_HOME ? path.join(env.JAVA_HOME, 'bin', executableName('java')) : 'java';
  const javaOutput = adapter.run(java, ['-version'], { allowStderr: true }).combined;
  assertRuntimeVersions(process.versions.node, javaOutput);
  return { adb, apkanalyzer, expo };
}

function verifyDevice(inputs, adb, adapter) {
  const devices = adapter.run(adb, ['devices', '-l']).stdout;
  const row = parseAdbDevices(devices, inputs.serial);
  const serialReadback = adbRun(adapter, adb, inputs.serial, ['get-serialno']).stdout.trim();
  if (serialReadback !== inputs.serial) {
    throw new Error('adb serial readback does not exactly match the authorized serial.');
  }
  return row;
}

function buildArtifact({ inputs, env, repoRoot, adapter, tools, cleanup, state }) {
  const childEnv = sanitizedEnvironment(env, { CI: '1', NODE_BINARY: process.execPath });
  const configText = adapter.run(
    process.execPath,
    [tools.expo, 'config', '--json'],
    { cwd: repoRoot, env: childEnv },
  ).stdout;
  const config = parseExpoConfig(configText);
  try {
    adapter.run(
      process.execPath,
      [tools.expo, 'prebuild', '--platform', 'android', '--no-install'],
      { cwd: repoRoot, env: childEnv, timeout: COMMAND_TIMEOUT_MS },
    );
  } finally {
    cleanup.androidCreated = adapter.fs.exists(path.join(repoRoot, 'android'));
  }
  const androidRoot = requireCreatedAndroid(repoRoot, adapter);
  const gradleFile = requireRegular(
    path.join(androidRoot, 'app', 'build.gradle'),
    adapter,
    'generated Gradle app configuration',
  );
  const mutation = mutateVersionName(adapter.fs.read(gradleFile), config.version, inputs.expectedSha);
  adapter.fs.write(gradleFile, mutation.source);
  const gradlew = requireExecutable(path.join(androidRoot, executableName('gradlew', true)), adapter);
  adapter.run(
    gradlew,
    [
      ':app:assembleDebug',
      '-x',
      'lint',
      '-x',
      'test',
      '--configure-on-demand',
      '-PreactNativeDevServerPort=' + inputs.port,
    ],
    { cwd: androidRoot, env: childEnv, timeout: COMMAND_TIMEOUT_MS },
  );
  const metadataPath = path.join(
    androidRoot,
    'app',
    'build',
    'outputs',
    'apk',
    'debug',
    'output-metadata.json',
  );
  const metadataFile = requireRegular(metadataPath, adapter, 'Android output metadata');
  assertContained(androidRoot, metadataFile, 'Android output metadata');
  const apkPath = resolveApkFromMetadata(adapter.fs.read(metadataFile), metadataFile, adapter.fs);
  const summary = adapter.run(tools.apkanalyzer, ['apk', 'summary', apkPath]).stdout;
  parseApkSummary(summary, APP_ID, mutation.marker);
  const apkHash = hashFile(apkPath, adapter.fs);
  const evidenceApk = path.join(state.paths.evidenceDirectory, 'skillflow-' + inputs.expectedSha + '.apk');
  adapter.fs.copy(apkPath, evidenceApk);
  state.app.versionName = mutation.marker;
  state.artifact = { evidencePath: evidenceApk, sha256: apkHash };
  state.paths.apk = evidenceApk;
  recordPhase(state, 'build');
  return { apkPath, marker: mutation.marker };
}

function installArtifact({ inputs, adapter, tools, artifact, state }) {
  const deviceStartText = adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['shell', 'date', '+%Y-%m-%d %H:%M:%S'],
  ).stdout.trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(deviceStartText)) {
    throw new Error('Could not record a comparable device-local run start time.');
  }
  const prior = adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['shell', 'dumpsys', 'package', APP_ID],
    { allowFailure: true },
  ).stdout;
  state.runtime.preinstall = {
    ...summarizePackage(prior),
    trust: 'untrusted-pre-existing-state',
  };
  const install = adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['install', '-r', artifact.apkPath],
    { timeout: COMMAND_TIMEOUT_MS },
  );
  assertInstallSuccess(install.stdout);
  const pmPath = adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['shell', 'pm', 'path', APP_ID],
  ).stdout.trim();
  if (!pmPath.startsWith('package:')) throw new Error('Installed package path readback is missing.');
  const packageText = adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['shell', 'dumpsys', 'package', APP_ID],
  ).stdout;
  state.runtime.postinstall = {
    ...parsePackageReadback(packageText, APP_ID, artifact.marker, deviceStartText),
    packagePath: pmPath,
  };
  recordPhase(state, 'install');
}

async function startAndCapture({ inputs, env, repoRoot, adapter, tools, cleanup, state }) {
  const childEnv = sanitizedEnvironment(env, { CI: '1', NODE_BINARY: process.execPath });
  const metroLog = path.join(state.paths.evidenceDirectory, 'metro.log');
  cleanup.metro = adapter.spawnMetro(
    process.execPath,
    [tools.expo, 'start', '--dev-client', '--localhost', '--port', String(inputs.port)],
    { cwd: repoRoot, env: childEnv, logPath: metroLog },
  );
  state.metro.pid = cleanup.metro.pid;
  state.paths.metroLog = metroLog;
  await adapter.waitForMetro(inputs.port, cleanup.metro, READY_TIMEOUT_MS);
  adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['reverse', 'tcp:' + inputs.port, 'tcp:' + inputs.port],
  );
  cleanup.reverseCreated = true;
  const activity = resolveActivity(adapter, tools.adb, inputs.serial);
  adbRun(adapter, tools.adb, inputs.serial, ['shell', 'am', 'force-stop', APP_ID]);
  const launch = adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['shell', 'am', 'start', '-W', '-n', activity],
    { timeout: 30_000 },
  ).stdout;
  assertLaunchSuccess(launch);
  await adapter.sleep(3_000);
  const pidText = adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['shell', 'pidof', APP_ID],
  ).stdout;
  const pid = parseSinglePid(pidText);
  const activityDump = adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['shell', 'dumpsys', 'activity', 'activities'],
  ).stdout;
  assertForegroundActivity(activityDump);
  captureRuntimeEvidence({ inputs, adapter, tools, state, activity, pid });
}

function captureRuntimeEvidence({ inputs, adapter, tools, state, activity, pid }) {
  const logText = adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['logcat', '--pid', pid, '-d', '-t', '500', '-v', 'threadtime'],
  ).stdout;
  const logPath = path.join(state.paths.evidenceDirectory, 'runtime.log');
  adapter.fs.write(logPath, logText);
  const metroText = adapter.fs.read(state.paths.metroLog);
  const failures = relevantRuntimeFailures(logText + '\n' + metroText);
  if (failures.length) {
    throw new Error('Relevant Android/Metro runtime failure detected: ' + failures[0]);
  }
  const screenshot = adbRun(
    adapter,
    tools.adb,
    inputs.serial,
    ['exec-out', 'screencap', '-p'],
    { encoding: null, maxBuffer: 20 * 1024 * 1024 },
  ).stdout;
  if (!isValidPng(screenshot)) throw new Error('Android screenshot is missing or not a valid PNG.');
  const screenshotPath = path.join(state.paths.evidenceDirectory, 'screenshot.png');
  adapter.fs.write(screenshotPath, screenshot);
  state.runtime.activity = activity;
  state.runtime.pid = pid;
  state.runtime.foregroundConfirmed = true;
  state.paths.runtimeLog = logPath;
  state.paths.screenshot = screenshotPath;
  recordPhase(state, 'runtime');
  recordPhase(state, 'evidence');
}

async function captureFailureLogs({ inputs, adapter, cleanup, state }) {
  if (!cleanup?.adb || !state.phases.some((phase) => phase.name === 'install')) return;
  try {
    const crash = adbRun(
      adapter,
      cleanup.adb,
      inputs.serial,
      ['logcat', '-b', 'crash', '-d', '-t', '200', '-v', 'threadtime'],
      { allowFailure: true },
    ).stdout;
    const filtered = String(crash).split(/\r?\n/)
      .filter((line) => line.includes(APP_ID))
      .join('\n');
    const crashPath = path.join(state.paths.evidenceDirectory, 'failure-crash.log');
    adapter.fs.write(crashPath, filtered);
    state.paths.failureCrashLog = crashPath;
  } catch {
    // Best-effort bounded failure evidence must never bypass owned cleanup.
  }
}

function parseExpoConfig(text) {
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    throw new Error('Expo config output is not valid JSON.');
  }
  const appId = config?.android?.package;
  const version = config?.version;
  if (appId !== APP_ID || typeof version !== 'string' || !version.trim()) {
    throw new Error('Expo config must declare ' + APP_ID + ' and a base version.');
  }
  return { appId, version };
}

function requireCreatedAndroid(repoRoot, adapter) {
  const androidRoot = path.join(repoRoot, 'android');
  const stat = adapter.fs.lstat(androidRoot);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('Prebuild did not create a regular android/ directory.');
  }
  assertContained(repoRoot, adapter.fs.realpath(androidRoot), 'generated Android tree');
  return androidRoot;
}

function resolveActivity(adapter, adb, serial) {
  const output = adbRun(
    adapter,
    adb,
    serial,
    ['shell', 'cmd', 'package', 'resolve-activity', '--brief', '--user', '0', APP_ID],
  ).stdout.trim();
  const component = output.split(/\r?\n/).filter(Boolean).at(-1) ?? '';
  if (!component.startsWith(APP_ID + '/') || /\s/.test(component)) {
    throw new Error('Could not resolve the exact SkillFlow launcher activity.');
  }
  return component;
}

export function parseSinglePid(text) {
  const pids = String(text).trim().split(/\s+/).filter(Boolean);
  if (pids.length !== 1 || !/^\d+$/.test(pids[0])) {
    throw new Error('Expected one live SkillFlow PID; found ' + pids.length + '.');
  }
  return pids[0];
}

export function summarizePackage(text) {
  return {
    present: String(text).includes('Package [' + APP_ID + ']'),
    versionName: String(text).match(/^\s*versionName=(.+)$/m)?.[1]?.trim() ?? null,
    lastUpdateTime: String(text).match(/^\s*lastUpdateTime=(.+)$/m)?.[1]?.trim() ?? null,
  };
}

function adbRun(adapter, adb, serial, args, options = {}) {
  return adapter.run(
    adb,
    deviceArguments(serial, args),
    { timeout: 30_000, ...options },
  );
}

function assertContained(root, candidate, label) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(label + ' must be a child of its owned root.');
  }
}

function requireExecutable(candidate, adapter) {
  const resolved = requireRegular(candidate, adapter, path.basename(candidate));
  adapter.fs.access(resolved, constants.X_OK);
  return resolved;
}

function requireRegular(candidate, adapter, label) {
  const stat = adapter.fs.lstat(candidate);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(label + ' must be a regular non-symlink file.');
  }
  return adapter.fs.realpath(candidate);
}

function findExecutable(candidates, adapter, label) {
  for (const candidate of candidates) {
    try {
      return requireExecutable(candidate, adapter);
    } catch {
      // Continue through the fixed, documented SDK locations only.
    }
  }
  throw new Error('Could not resolve ' + label + ' from the configured Android SDK.');
}

function executableName(name, gradle = false) {
  if (process.platform !== 'win32') return name;
  return gradle ? name + '.bat' : name + '.exe';
}

function hashFile(filePath, fsAdapter) {
  return createHash('sha256').update(fsAdapter.readBuffer(filePath)).digest('hex');
}

function parseDetail(details, key) {
  return details.match(new RegExp('(?:^|\\s)' + key + ':([^\\s]+)'))?.[1] ?? 'unknown';
}

function redactText(value, serial) {
  return String(value).split(serial).join('<redacted-' + serial.slice(-4) + '>');
}

function finishState(state, result) {
  if (result === 'FAIL') recordPhase(state, 'run', 'FAIL');
  state.result = result;
  state.finishedAt = new Date().toISOString();
  delete state.cleanup;
  delete state.evidenceComplete;
}

function recordPhase(state, name, result = 'PASS') {
  if (state.phases.some((phase) => phase.name === name)) return;
  state.phases.push({ name, result, at: new Date().toISOString() });
}

function writeManifest(fsAdapter, state) {
  const manifestPath = path.join(state.paths.evidenceDirectory, 'manifest.json');
  state.paths.manifest = manifestPath;
  fsAdapter.write(manifestPath, JSON.stringify(state, null, 2) + '\n');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
}

const defaultFs = {
  access: (target, mode) => accessSync(target, mode),
  copy: (source, destination) => copyFileSync(source, destination),
  exists: (target) => existsSync(target),
  lstat: (target) => lstatSync(target),
  mkdtemp: (prefix) => mkdtempSync(prefix),
  read: (target) => readFileSync(target, 'utf8'),
  readBuffer: (target) => readFileSync(target),
  realpath: (target) => realpathSync(target),
  rm: (target) => rmSync(target, { recursive: true, force: false }),
  write: (target, value) => writeFileSync(target, value),
};

const defaultAdapter = {
  fs: defaultFs,
  run(command, args, options = {}) {
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      env: options.env,
      encoding: options.encoding === null ? null : 'utf8',
      maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
      shell: false,
      timeout: options.timeout ?? COMMAND_TIMEOUT_MS,
    });
    return normalizeCommandResult(command, result, options);
  },
  checkPort(port) {
    return checkPortAvailability(port);
  },
  spawnMetro(command, args, options) {
    const descriptor = openSync(options.logPath, 'a');
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: process.platform !== 'win32',
      shell: false,
      stdio: ['ignore', descriptor, descriptor],
    });
    closeSync(descriptor);
    return child;
  },
  async waitForMetro(port, child, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error('Owned Metro exited before readiness (' + child.exitCode + ').');
      }
      if (await requestMetro(port)) return;
      await this.sleep(500);
    }
    throw new Error('Owned Metro did not become ready within ' + timeoutMs + 'ms.');
  },
  isAlive(child) {
    if (child.exitCode !== null) return false;
    const target = process.platform === 'win32' ? child.pid : -child.pid;
    try {
      process.kill(target, 0);
      return true;
    } catch (error) {
      if (error.code === 'ESRCH') return false;
      throw error;
    }
  },
  killOwned(child, signal) {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  },
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

function normalizeCommandResult(command, result, options) {
  if (result.error) throw result.error;
  const binary = options.encoding === null;
  const empty = binary ? Buffer.alloc(0) : '';
  const stdout = result.stdout ?? empty;
  const stderr = result.stderr ?? empty;
  const combined = binary ? Buffer.concat([stdout, stderr]) : String(stdout) + String(stderr);
  if (result.status !== 0 && !options.allowFailure) {
    const tail = String(combined).trim().slice(-2_000);
    throw new Error(path.basename(command) + ' failed (' + result.status + '): ' + tail);
  }
  return { status: result.status, stdout, stderr, combined };
}

async function requestMetro(port) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: '127.0.0.1',
        port,
        path: '/_expo/open?platform=android',
        timeout: 1_000,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode >= 200 && response.statusCode < 400);
      },
    );
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

export function helpText() {
  return [
    'Usage:',
    '  SKILLFLOW_ANDROID_SERIAL=<exact-adb-serial> \\',
    '  SKILLFLOW_ANDROID_EXPECTED_SHA=<full-40-character-HEAD-sha> \\',
    '  SKILLFLOW_ANDROID_METRO_PORT=<unused-port> \\',
    '  npm run verify:android-device',
    '',
    'Builds, installs, launches, and records exact-SHA evidence on only the selected device.',
    'Requires Node 22.x, JDK 17, ANDROID_HOME/ANDROID_SDK_ROOT, adb, and apkanalyzer.',
    'The checkout must be clean and android/ must be absent. SIGKILL cannot run cleanup handlers.',
    '',
  ].join('\n');
}

async function runCli() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(helpText());
    return;
  }
  let activeState;
  let finishing = false;
  const emergency = async (reason) => {
    if (finishing) return;
    finishing = true;
    let cleanupSucceeded = true;
    try {
      await activeState?.cleanup?.run();
      if (activeState?.cleanup) recordPhase(activeState, 'cleanup');
    } catch {
      cleanupSucceeded = false;
    }
    const outcome = decideSignalOutcome(Boolean(activeState?.evidenceComplete), cleanupSucceeded);
    if (activeState) {
      activeState.errors.push(reason);
      finishState(activeState, outcome);
      writeManifest(defaultFs, activeState);
    }
    process.stderr.write(reason + ': ' + outcome + '. SIGKILL cannot run cleanup handlers.\n');
    process.exit(outcome === 'PASS' ? 0 : 1);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(signal, () => void emergency(signal));
  }
  process.once('uncaughtException', (error) => {
    void emergency('uncaughtException: ' + error.message);
  });
  process.once('unhandledRejection', (error) => {
    void emergency('unhandledRejection: ' + String(error));
  });
  try {
    activeState = await runVerification({ onState: (state) => { activeState = state; } });
    process.stdout.write('PASS ' + activeState.gitSha + '\nEvidence: ' + activeState.paths.manifest + '\n');
  } catch (error) {
    process.stderr.write('FAIL ' + error.message + '\n');
    process.exitCode = 1;
  } finally {
    finishing = true;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptPath)) {
  await runCli();
}
