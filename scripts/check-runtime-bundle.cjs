const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const documentedPublicRuntimeKeys = new Set([
  'EXPO_PUBLIC_RUNTIME_TARGET',
  'EXPO_PUBLIC_CONVEX_URL',
  'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
]);
const publicRuntimeKeyPattern = /\bEXPO_PUBLIC_[A-Z0-9_]+\b/g;
const forbiddenSentinel = 'SkillFlowVerifierSecretSentinel';

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

function exportWebBundle(projectRoot) {
  execFileSync('npx', ['expo', 'export', '--platform', 'web'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PUBLIC_RUNTIME_TARGET: 'web',
      EXPO_PUBLIC_CONVEX_URL: 'http://127.0.0.1:3210',
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_c2tpbGxmbG93',
      EXPO_PUBLIC_UNDOCUMENTED_VALUE: forbiddenSentinel,
      EXPO_PUBLIC_CLERK_SECRET_KEY: forbiddenSentinel,
      EXPO_PUBLIC_CONVEX_ADMIN_KEY: forbiddenSentinel,
    },
  });
}

function main() {
  const projectRoot = process.cwd();
  if (process.argv.includes('--export')) exportWebBundle(projectRoot);
  assertBundleSafe(path.join(projectRoot, 'dist', '_expo', 'static', 'js', 'web'));
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
