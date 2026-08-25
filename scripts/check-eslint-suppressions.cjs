const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const suppressionFileName = 'eslint-suppressions.json';

// This is the ceiling introduced with the first complexity baseline. Once the
// baseline is merged, the checker compares against origin/main so a pruned
// ceiling stays pruned on later branches.
const initialSuppressions = {
  'src/app/marketplace.tsx': { complexity: { count: 2 } },
  'src/app/profile/edit.tsx': { complexity: { count: 1 } },
  'src/app/profile/index.tsx': { complexity: { count: 1 } },
  'src/app/profiles/[userId].tsx': { complexity: { count: 1 } },
  'src/app/project-posts/[postId].tsx': { complexity: { count: 1 } },
  'src/app/projects/[projectId].tsx': { complexity: { count: 2 } },
  'src/app/projects/index.tsx': { complexity: { count: 1 } },
  'src/app/register.tsx': { complexity: { count: 1 } },
  'src/app/settings.tsx': { complexity: { count: 1 } },
  'src/app/student-home.tsx': { complexity: { count: 1 } },
  'src/app/verification.tsx': { complexity: { count: 1 } },
  'src/components/project-post-form.tsx': { complexity: { count: 1 } },
  'src/components/service-form.tsx': { complexity: { count: 1 } },
  'src/components/ui.tsx': { complexity: { count: 1 } },
  'src/context/session.tsx': { complexity: { count: 6 } },
  'src/domain/career-readiness.ts': { complexity: { count: 1 } },
};

function validateSuppressions(suppressions, ceiling = initialSuppressions) {
  if (!suppressions || typeof suppressions !== 'object' || Array.isArray(suppressions)) {
    return ['The suppression file must contain an object.'];
  }

  return Object.entries(suppressions).flatMap(([file, rules]) => (
    validateSuppressionFile(file, rules, ceiling[file])
  ));
}

function validateSuppressionFile(file, rules, ceilingRules) {
  if (!ceilingRules) return [`${file}: new suppression file is not allowed.`];
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    return [`${file}: suppression rules must be an object.`];
  }

  return Object.entries(rules).flatMap(([rule, entry]) => (
    validateSuppressionRule(file, rule, entry, ceilingRules[rule])
  ));
}

function validateSuppressionRule(file, rule, entry, ceilingEntry) {
  if (!ceilingEntry) return [`${file} (${rule}): new suppression rule is not allowed.`];

  const count = entry?.count;
  if (!Number.isInteger(count) || count < 1) {
    return [`${file} (${rule}): suppression count must be a positive integer.`];
  }
  if (count > ceilingEntry.count) {
    return [`${file} (${rule}): suppression count increased from ${ceilingEntry.count} to ${count}.`];
  }
  return [];
}

function readCurrentSuppressions(projectRoot) {
  const filePath = path.join(projectRoot, suppressionFileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readMergedCeiling(projectRoot) {
  try {
    const content = execFileSync('git', ['show', `origin/main:${suppressionFileName}`], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(content);
  } catch {
    return initialSuppressions;
  }
}

function main() {
  const projectRoot = process.cwd();
  let suppressions;
  try {
    suppressions = readCurrentSuppressions(projectRoot);
  } catch (error) {
    console.error(`Unable to read ${suppressionFileName}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const issues = validateSuppressions(suppressions, readMergedCeiling(projectRoot));
  if (issues.length === 0) return;

  console.error(`${suppressionFileName} exceeds the committed complexity ceiling:`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
}

module.exports = { initialSuppressions, validateSuppressions };

if (require.main === module) main();
