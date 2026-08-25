const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const suppressionFileName = 'eslint-suppressions.json';
const ceilingFileName = 'eslint-suppressions-ceiling.json';
const defaultBaseRef = 'origin/main';
const bootstrapBaseSha = '8290f4dfb1537b1050ac786c3644a8c6dc3e7a24';
const bootstrapDigest = '3894d4fad4545e8eaa200d4adb9adca239897cb800120c0404f09dbe0d8a1894';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateSuppressionMap(suppressions, label) {
  if (!isRecord(suppressions)) return [`${label} must contain an object.`];
  return Object.entries(suppressions).flatMap(([file, rules]) => {
    if (!isRecord(rules)) return [`${label}: ${file} rules must be an object.`];
    return Object.entries(rules).flatMap(([rule, entry]) => {
      const count = entry?.count;
      if (isRecord(entry) && Number.isInteger(count) && count > 0) return [];
      return [`${label}: ${file} (${rule}) count must be a positive integer.`];
    });
  });
}

function validateSuppressions(suppressions, ceiling) {
  const shapeIssues = [
    ...validateSuppressionMap(suppressions, suppressionFileName),
    ...validateSuppressionMap(ceiling, ceilingFileName),
  ];
  if (shapeIssues.length > 0) return shapeIssues;
  return Object.entries(suppressions).flatMap(([file, rules]) => (
    validateSuppressionFile(file, rules, ceiling[file])
  ));
}

function validateSuppressionFile(file, rules, ceilingRules) {
  if (!ceilingRules) return [`${file}: new suppression file is not allowed.`];
  return Object.entries(rules).flatMap(([rule, entry]) => (
    validateSuppressionRule(file, rule, entry, ceilingRules[rule])
  ));
}

function validateSuppressionRule(file, rule, entry, ceilingEntry) {
  if (!ceilingEntry) return [`${file} (${rule}): new suppression rule is not allowed.`];
  if (entry.count <= ceilingEntry.count) return [];
  return [`${file} (${rule}): suppression count increased from ${ceilingEntry.count} to ${entry.count}.`];
}

function validateSynchronizedCeiling(suppressions, ceiling) {
  const issues = validateSuppressions(suppressions, ceiling);
  if (issues.length > 0) return issues;
  return Object.entries(ceiling).flatMap(([file, rules]) => (
    Object.entries(rules).flatMap(([rule, entry]) => {
      const count = suppressions[file]?.[rule]?.count ?? 0;
      return count === entry.count
        ? []
        : [`${file} (${rule}): committed ceiling ${entry.count} is stale; current count is ${count}.`];
    })
  ));
}

function parseJson(contents, label) {
  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`Unable to parse ${label}: ${error.message}`);
  }
}

function runGit(projectRoot, args, execGit = execFileSync) {
  return execGit('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function resolveCommit(projectRoot, ref, execGit = execFileSync) {
  try {
    return runGit(projectRoot, ['rev-parse', '--verify', `${ref}^{commit}`], execGit);
  } catch {
    throw new Error(`Base ref ${ref} is unavailable; fetch the exact base branch before linting.`);
  }
}

function readRefFile(projectRoot, ref, fileName, execGit = execFileSync) {
  try {
    return runGit(projectRoot, ['show', `${ref}:${fileName}`], execGit);
  } catch {
    return null;
  }
}

function parseBaseState(ref, suppressionContents, ceilingContents) {
  if (suppressionContents === null && ceilingContents === null) return null;
  if (suppressionContents === null || ceilingContents === null) {
    throw new Error(`Base ${ref} has an incomplete suppression baseline.`);
  }
  return {
    ref,
    suppressions: parseJson(suppressionContents, `${ref}:${suppressionFileName}`),
    ceiling: parseJson(ceilingContents, `${ref}:${ceilingFileName}`),
  };
}

function validateExpectedBaseSha(baseSha, expectedSha) {
  if (expectedSha === undefined) return;
  if (!/^[0-9a-f]{40}$/i.test(expectedSha)) {
    throw new Error('ESLINT_SUPPRESSIONS_BASE_SHA must be a full 40-character commit SHA.');
  }
  if (baseSha !== expectedSha.toLowerCase()) {
    throw new Error(`Base ref is stale: expected ${expectedSha}, resolved ${baseSha}.`);
  }
}

function requireExpectedBaseSha(expectedSha, required) {
  if (required && expectedSha === undefined) {
    throw new Error('ESLINT_SUPPRESSIONS_BASE_SHA is required in CI.');
  }
}

function requireBaseAncestor(projectRoot, baseSha, headSha, execGit = execFileSync) {
  if (baseSha === headSha) return;
  try {
    runGit(projectRoot, ['merge-base', '--is-ancestor', baseSha, headSha], execGit);
  } catch {
    throw new Error(`HEAD does not contain base ${baseSha}; fetch and rebase onto the latest base.`);
  }
}

function isCommitAncestor(projectRoot, ancestorSha, descendantSha, execGit = execFileSync) {
  try {
    runGit(projectRoot, ['cat-file', '-e', `${ancestorSha}^{commit}`], execGit);
    runGit(projectRoot, ['merge-base', '--is-ancestor', ancestorSha, descendantSha], execGit);
    return true;
  } catch {
    return false;
  }
}

function loadBaseContext(projectRoot, options = {}) {
  const execGit = options.execGit ?? execFileSync;
  const baseRef = options.baseRef ?? process.env.ESLINT_SUPPRESSIONS_BASE_REF ?? defaultBaseRef;
  const expectedSha = options.baseSha ?? process.env.ESLINT_SUPPRESSIONS_BASE_SHA;
  const bootstrapSha = options.bootstrapSha ?? bootstrapBaseSha;
  const expectedBootstrapDigest = options.bootstrapDigest ?? bootstrapDigest;
  requireExpectedBaseSha(expectedSha, options.requireBaseSha ?? Boolean(process.env.CI));
  const baseSha = resolveCommit(projectRoot, baseRef, execGit).toLowerCase();
  const headSha = resolveCommit(projectRoot, 'HEAD', execGit).toLowerCase();
  validateExpectedBaseSha(baseSha, expectedSha);
  requireBaseAncestor(projectRoot, baseSha, headSha, execGit);
  const state = parseBaseState(
    baseRef,
    readRefFile(projectRoot, baseSha, suppressionFileName, execGit),
    readRefFile(projectRoot, baseSha, ceilingFileName, execGit),
  );
  const bootstrapEligible = state === null
    && isCommitAncestor(projectRoot, bootstrapSha, baseSha, execGit);
  return {
    baseRef,
    baseSha,
    bootstrapEligible,
    expectedBootstrapDigest,
    headSha,
    state,
  };
}

function readWorkingState(projectRoot, readFile = fs.readFileSync) {
  return {
    suppressions: parseJson(readFile(path.join(projectRoot, suppressionFileName), 'utf8'), suppressionFileName),
    ceiling: parseJson(readFile(path.join(projectRoot, ceilingFileName), 'utf8'), ceilingFileName),
  };
}

function digestSuppressionMap(suppressions) {
  return crypto.createHash('sha256').update(JSON.stringify(suppressions)).digest('hex');
}

function validateBootstrap(suppressions, context) {
  if (!context.bootstrapEligible) {
    return [`Base ${context.baseRef} is missing suppression artifacts and is not a descendant of the pinned bootstrap.`];
  }
  if (digestSuppressionMap(suppressions) === context.expectedBootstrapDigest) return [];
  return ['Initial suppression baseline differs from the pinned bootstrap baseline.'];
}

function validateAgainstBase(suppressions, context) {
  if (!context.state) return validateBootstrap(suppressions, context);
  const issues = validateSynchronizedCeiling(context.state.suppressions, context.state.ceiling);
  if (issues.length > 0) return issues.map((issue) => `base ${context.baseRef}: ${issue}`);
  return validateSuppressions(suppressions, context.state.ceiling)
    .map((issue) => `against base ${context.baseRef}: ${issue}`);
}

function validateSuppressionState(suppressions, ceiling, context) {
  const issues = validateSynchronizedCeiling(suppressions, ceiling);
  if (issues.length > 0) return issues;
  return validateAgainstBase(suppressions, context);
}

function formatIssues(issues) {
  const details = issues.map((issue) => `- ${issue}`).join('\n');
  return `${suppressionFileName} violates the monotonic complexity baseline:\n${details}`;
}

function checkProject(projectRoot, options = {}) {
  const current = readWorkingState(projectRoot);
  const context = loadBaseContext(projectRoot, options);
  const issues = validateSuppressionState(current.suppressions, current.ceiling, context);
  if (issues.length > 0) throw new Error(formatIssues(issues));
}

function ratchetCeiling(projectRoot, options = {}) {
  const current = readWorkingState(projectRoot);
  const context = loadBaseContext(projectRoot, options);
  const issues = [
    ...validateSuppressions(current.suppressions, current.ceiling),
    ...validateAgainstBase(current.suppressions, context),
  ];
  if (issues.length > 0) throw new Error(formatIssues(issues));
  fs.writeFileSync(path.join(projectRoot, ceilingFileName), JSON.stringify(current.suppressions, null, 2), 'utf8');
}

function main() {
  const projectRoot = process.cwd();
  try {
    if (process.argv.includes('--ratchet')) ratchetCeiling(projectRoot);
    else checkProject(projectRoot);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkProject,
  loadBaseContext,
  parseBaseState,
  ratchetCeiling,
  requireExpectedBaseSha,
  validateAgainstBase,
  validateExpectedBaseSha,
  validateSuppressionState,
  validateSuppressions,
  validateSynchronizedCeiling,
};

if (require.main === module) main();
