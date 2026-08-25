const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const suppressionFileName = 'eslint-suppressions.json';
const ceilingFileName = 'eslint-suppressions-ceiling.json';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateSuppressionMap(suppressions, label) {
  if (!isRecord(suppressions)) return [`${label} must contain an object.`];

  return Object.entries(suppressions).flatMap(([file, rules]) => {
    if (!isRecord(rules)) return [`${label}: ${file} rules must be an object.`];

    return Object.entries(rules).flatMap(([rule, entry]) => {
      const count = entry?.count;
      if (!isRecord(entry) || !Number.isInteger(count) || count < 1) {
        return [`${label}: ${file} (${rule}) count must be a positive integer.`];
      }
      return [];
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
      const currentCount = suppressions[file]?.[rule]?.count ?? 0;
      if (currentCount === entry.count) return [];
      return [`${file} (${rule}): committed ceiling ${entry.count} is stale; current count is ${currentCount}.`];
    })
  ));
}

function prefixIssues(label, issues) {
  return issues.map((issue) => `${label}: ${issue}`);
}

function validateTrustedState(suppressions, trustedState) {
  const baseIssues = validateSynchronizedCeiling(
    trustedState.suppressions,
    trustedState.ceiling,
  );
  if (baseIssues.length > 0) return prefixIssues(`trusted ${trustedState.ref}`, baseIssues);
  return prefixIssues(`against trusted ${trustedState.ref}`, (
    validateSuppressions(suppressions, trustedState.ceiling)
  ));
}

function validateAgainstHistory(suppressions, history) {
  if (!history.head) return ['Trusted HEAD suppression state is missing.'];
  if (history.parents.length === 0) {
    return ['No trusted parent suppression state is available; fetch parent history before linting.'];
  }

  return [history.head, ...history.parents].flatMap((state) => (
    validateTrustedState(suppressions, state)
  ));
}

function validateSuppressionState(suppressions, ceiling, history) {
  const currentIssues = validateSynchronizedCeiling(suppressions, ceiling);
  if (currentIssues.length > 0) return currentIssues;
  return validateAgainstHistory(suppressions, history);
}

function parseJson(contents, label) {
  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`Unable to parse ${label}: ${error.message}`);
  }
}

function parseTrustedState(ref, suppressionContents, ceilingContents) {
  if (suppressionContents === null && ceilingContents === null) return null;
  if (suppressionContents === null || ceilingContents === null) {
    throw new Error(`Trusted ${ref} has an incomplete suppression baseline.`);
  }
  return {
    ref,
    suppressions: parseJson(suppressionContents, `${ref}:${suppressionFileName}`),
    ceiling: parseJson(ceilingContents, `${ref}:${ceilingFileName}`),
  };
}

function readWorkingState(projectRoot, readFile = fs.readFileSync) {
  return {
    suppressions: parseJson(
      readFile(path.join(projectRoot, suppressionFileName), 'utf8'),
      suppressionFileName,
    ),
    ceiling: parseJson(
      readFile(path.join(projectRoot, ceilingFileName), 'utf8'),
      ceilingFileName,
    ),
  };
}

function runGit(projectRoot, args, execGit = execFileSync) {
  return execGit('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function readRefFile(projectRoot, ref, fileName, execGit = execFileSync) {
  try {
    return runGit(projectRoot, ['show', `${ref}:${fileName}`], execGit);
  } catch {
    return null;
  }
}

function readTrustedRef(projectRoot, ref, execGit = execFileSync) {
  try {
    runGit(projectRoot, ['cat-file', '-e', `${ref}^{commit}`], execGit);
  } catch {
    throw new Error(`Trusted Git object ${ref} is unavailable; fetch parent history before linting.`);
  }
  return parseTrustedState(
    ref,
    readRefFile(projectRoot, ref, suppressionFileName, execGit),
    readRefFile(projectRoot, ref, ceilingFileName, execGit),
  );
}

function readHeadAndParents(projectRoot, execGit = execFileSync) {
  let fields;
  try {
    fields = runGit(projectRoot, ['rev-list', '--parents', '-n', '1', 'HEAD'], execGit).trim().split(/\s+/);
  } catch {
    throw new Error('Unable to resolve HEAD and its parents for suppression validation.');
  }
  if (!fields[0]) throw new Error('Unable to resolve HEAD for suppression validation.');
  return { headRef: fields[0], parentRefs: fields.slice(1) };
}

function loadTrustedHistory(projectRoot, execGit = execFileSync) {
  const { headRef, parentRefs } = readHeadAndParents(projectRoot, execGit);
  const head = readTrustedRef(projectRoot, headRef, execGit);
  const parents = parentRefs
    .map((ref) => readTrustedRef(projectRoot, ref, execGit))
    .filter(Boolean);
  return { head, parents };
}

function formatIssues(issues) {
  const details = issues.map((issue) => `- ${issue}`).join('\n');
  return `${suppressionFileName} violates the monotonic complexity baseline:\n${details}`;
}

function ratchetCeiling(projectRoot) {
  const { suppressions, ceiling } = readWorkingState(projectRoot);
  const currentIssues = validateSuppressions(suppressions, ceiling);
  const historyIssues = validateAgainstHistory(suppressions, loadTrustedHistory(projectRoot));
  const issues = [...currentIssues, ...historyIssues];
  if (issues.length > 0) throw new Error(formatIssues(issues));

  fs.writeFileSync(
    path.join(projectRoot, ceilingFileName),
    JSON.stringify(suppressions, null, 2),
    'utf8',
  );
}

function main() {
  const projectRoot = process.cwd();
  try {
    if (process.argv.includes('--ratchet')) {
      ratchetCeiling(projectRoot);
      return;
    }
    const { suppressions, ceiling } = readWorkingState(projectRoot);
    const issues = validateSuppressionState(suppressions, ceiling, loadTrustedHistory(projectRoot));
    if (issues.length > 0) throw new Error(formatIssues(issues));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  parseTrustedState,
  validateAgainstHistory,
  validateSuppressionState,
  validateSuppressions,
  validateSynchronizedCeiling,
};

if (require.main === module) main();
