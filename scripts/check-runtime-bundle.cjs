const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  applicationPublicRuntimeKeys,
  frameworkPublicRuntimeKeys,
} = require('./runtime-public-environment.cjs');

const documentedPublicRuntimeKeys = new Set([
  ...applicationPublicRuntimeKeys,
  ...frameworkPublicRuntimeKeys,
]);
const publicRuntimeKeyPattern = /\bEXPO_PUBLIC_[A-Z0-9_]+\b/g;
const forbiddenSentinel = 'SkillFlowVerifierSecretSentinel';
const validExpoEnvironment = {
  EXPO_PUBLIC_RUNTIME_TARGET: 'web',
  EXPO_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3210',
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_c2tpbGxmbG93',
  EXPO_PUBLIC_PROJECT_ROOT: '/framework-owned/expo-router',
};
const adversarialExpoEnvironment = {
  ...validExpoEnvironment,
  EXPO_PUBLIC_API_KEY: forbiddenSentinel,
  EXPO_PUBLIC_UNDOCUMENTED_VALUE: forbiddenSentinel,
  EXPO_PUBLIC_CLERK_SECRET_KEY: forbiddenSentinel,
  EXPO_PUBLIC_CONVEX_ADMIN_KEY: forbiddenSentinel,
};

function bundleFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) bundleFiles(entryPath, files);
    else if (/\.(html?|js|json)$/.test(entry.name)) files.push(entryPath);
  }
  return files;
}

function scanBundleText(contents) {
  const publicKeys = [...new Set(contents.match(publicRuntimeKeyPattern) ?? [])];
  const unknownPublicKeys = publicKeys.filter((key) => !documentedPublicRuntimeKeys.has(key));
  return {
    unknownPublicKeys,
    containsForbiddenSentinel: contents.includes(forbiddenSentinel),
  };
}

function assertBundleSafe(bundleDirectory) {
  if (!fs.existsSync(bundleDirectory)) throw new Error(`Missing web bundle directory: ${bundleDirectory}`);
  const findings = bundleFiles(bundleDirectory).flatMap((file) => {
    const result = scanBundleText(fs.readFileSync(file, 'utf8'));
    return result.unknownPublicKeys.map((key) => `${file}: unexpected ${key}`)
      .concat(result.containsForbiddenSentinel ? [`${file}: synthetic secret sentinel`] : []);
  });
  if (findings.length > 0) throw new Error(`Runtime bundle contains forbidden configuration data:\n${findings.join('\n')}`);
}

function readExpoPublicConfiguration(projectRoot, environment) {
  const output = execFileSync('npx', ['expo', 'config', '--type', 'public', '--json'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
  return { output, configuration: JSON.parse(output) };
}

function assertExpoRuntimeBoundary(projectRoot) {
  const valid = readExpoPublicConfiguration(projectRoot, validExpoEnvironment);
  const adversarial = readExpoPublicConfiguration(projectRoot, adversarialExpoEnvironment);
  if (valid.configuration.extra?.runtimeConfigurationHasUnknownPublicValues !== false) {
    throw new Error('Expo rejected its exact framework-owned public runtime key.');
  }
  if (adversarial.configuration.extra?.runtimeConfigurationHasUnknownPublicValues !== true) {
    throw new Error('Expo did not reject an undocumented public runtime key.');
  }
  assertBundleOutputSafe(valid.output);
  assertBundleOutputSafe(adversarial.output);
}

function assertBundleOutputSafe(contents) {
  const result = scanBundleText(contents);
  if (result.unknownPublicKeys.length > 0 || result.containsForbiddenSentinel) {
    throw new Error('Expo public configuration serialized forbidden names or values.');
  }
}

function exportWebBundle(projectRoot) {
  execFileSync('npx', ['expo', 'export', '--platform', 'web'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...adversarialExpoEnvironment,
    },
  });
}

function main() {
  const projectRoot = process.cwd();
  if (process.argv.includes('--export')) {
    assertExpoRuntimeBoundary(projectRoot);
    exportWebBundle(projectRoot);
  }
  assertBundleSafe(path.join(projectRoot, 'dist'));
  console.log('Web runtime bundle contains only the documented public configuration contract.');
}

module.exports = { assertBundleSafe, scanBundleText };

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
