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
  if (entry.count > ceilingEntry.count) {
    return [`${file} (${rule}): suppression count increased from ${ceilingEntry.count} to ${entry.count}.`];
  }
  return [];
}

function validateSynchronizedCeiling(suppressions, ceiling) {
  const issues = validateSuppressions(suppressions, ceiling);
  if (issues.length > 0) return issues;

  return Object.entries(ceiling).flatMap(([file, rules]) => (
    Object.entries(rules).flatMap(([rule, entry]) => {
      const currentCount = suppressions[file]?.[rule]?.count ?? 0;
      if (currentCount === entry.count) return [];
      return [
        `${file} (${rule}): committed ceiling ${entry.count} is stale; current count is ${currentCount}. Run npm run lint:prune.`,
      ];
    })
  ));
}

function readJsonFile(projectRoot, fileName, readFile = fs.readFileSync) {
  let contents;
  try {
    contents = readFile(path.join(projectRoot, fileName), 'utf8');
  } catch (error) {
    throw new Error(`Unable to read required ${fileName}: ${error.message}`);
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`Unable to parse ${fileName}: ${error.message}`);
  }
}

function loadSuppressionState(projectRoot, readFile = fs.readFileSync) {
  return {
    suppressions: readJsonFile(projectRoot, suppressionFileName, readFile),
    ceiling: readJsonFile(projectRoot, ceilingFileName, readFile),
  };
}

function formatIssues(issues) {
  const details = issues.map((issue) => `- ${issue}`).join('\n');
  return `${suppressionFileName} exceeds or is out of sync with the committed complexity ceiling:\n${details}`;
}

function ratchetCeiling(projectRoot, readFile = fs.readFileSync, writeFile = fs.writeFileSync) {
  const { suppressions, ceiling } = loadSuppressionState(projectRoot, readFile);
  const issues = validateSuppressions(suppressions, ceiling);
  if (issues.length > 0) throw new Error(formatIssues(issues));

  writeFile(
    path.join(projectRoot, ceilingFileName),
    `${JSON.stringify(suppressions, null, 2)}\n`,
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

    const { suppressions, ceiling } = loadSuppressionState(projectRoot);
    const issues = validateSynchronizedCeiling(suppressions, ceiling);
    if (issues.length > 0) throw new Error(formatIssues(issues));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  ceilingFileName,
  loadSuppressionState,
  ratchetCeiling,
  suppressionFileName,
  validateSuppressions,
  validateSynchronizedCeiling,
};

if (require.main === module) main();
