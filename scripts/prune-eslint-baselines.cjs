const { execFileSync } = require('node:child_process');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  checkProject,
  loadBaseContext,
  validateAgainstBase,
  validateSuppressions,
} = require('./check-eslint-suppressions.cjs');
const { prepareComplexityPrune } = require('./check-eslint-complexity-debt.cjs');

const suppressionFile = 'eslint-suppressions.json';
const ceilingFile = 'eslint-suppressions-ceiling.json';
const identityFile = 'eslint-complexity-baseline.json';
const artifactFiles = [suppressionFile, ceilingFile, identityFile];

function formatSuppressionIssues(issues) {
  return `${suppressionFile} violates the monotonic complexity baseline:\n${issues.map((issue) => `- ${issue}`).join('\n')}`;
}

function defaultRunEslint(projectRoot, temporarySuppressions) {
  execFileSync(path.join(projectRoot, 'node_modules', '.bin', 'eslint'), [
    '.',
    '--max-warnings', '0',
    '--suppressions-location', temporarySuppressions,
    '--prune-suppressions',
  ], { cwd: projectRoot, stdio: 'inherit' });
}

function readSnapshots(projectRoot) {
  return new Map(artifactFiles.map((file) => [file, fs.readFileSync(path.join(projectRoot, file))]));
}

function restoreSnapshots(projectRoot, snapshots) {
  for (const [file, contents] of snapshots) fs.writeFileSync(path.join(projectRoot, file), contents);
}

function commitArtifacts(projectRoot, contents, writeArtifact) {
  for (const file of artifactFiles) writeArtifact(path.join(projectRoot, file), contents.get(file));
}

async function pruneBaselines(projectRoot, options = {}) {
  const snapshots = readSnapshots(projectRoot);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eslint-prune-'));
  const temporarySuppressions = path.join(temporaryRoot, suppressionFile);
  let mutationStarted = false;
  try {
    checkProject(projectRoot, options);
    const context = loadBaseContext(projectRoot, options);
    const nextIdentity = await prepareComplexityPrune(projectRoot, options);
    fs.writeFileSync(temporarySuppressions, snapshots.get(suppressionFile));
    (options.runEslint ?? defaultRunEslint)(projectRoot, temporarySuppressions);
    const nextSuppressions = JSON.parse(fs.readFileSync(temporarySuppressions, 'utf8'));
    const currentCeiling = JSON.parse(snapshots.get(ceilingFile).toString('utf8'));
    const issues = [
      ...validateSuppressions(nextSuppressions, currentCeiling),
      ...validateAgainstBase(nextSuppressions, context),
    ];
    if (issues.length > 0) throw new Error(formatSuppressionIssues(issues));
    const contents = new Map([
      [suppressionFile, fs.readFileSync(temporarySuppressions)],
      [ceilingFile, Buffer.from(JSON.stringify(nextSuppressions, null, 2))],
      [identityFile, Buffer.from(`${JSON.stringify(nextIdentity, null, 2)}\n`)],
    ]);
    mutationStarted = true;
    commitArtifacts(projectRoot, contents, options.writeArtifact ?? fs.writeFileSync);
  } catch (error) {
    if (mutationStarted) restoreSnapshots(projectRoot, snapshots);
    throw error;
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

async function main() {
  try {
    await pruneBaselines(process.cwd());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { pruneBaselines };

if (require.main === module) main();
