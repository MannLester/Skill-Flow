const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { ESLint } = require('eslint');
const ts = require('typescript');

const { loadBaseContext } = require('./check-eslint-suppressions.cjs');

const baselineFileName = 'eslint-complexity-baseline.json';
const bootstrapBaselineDigest = 'f07f83fc6a2b7e2a853ba944bdeb9d479c00c7bd7224355dc66385fc6dd67056';

function isFunctionLike(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)
    || ts.isConstructorDeclaration(node);
}

function findFunctionNode(sourceFile, offset) {
  let match = null;
  function visit(node) {
    if (node.getStart(sourceFile) > offset || node.end < offset) return;
    if (isFunctionLike(node)) match = node;
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return match;
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function functionName(node, sourceFile) {
  let current = node;
  while (current && current !== sourceFile) {
    if (current.name && typeof current.name.getText === 'function') {
      return current.name.getText(sourceFile);
    }
    current = current.parent;
  }
  return '';
}

function complexityFromMessage(message) {
  const match = message.match(/complexity of (\d+)/);
  if (!match) throw new Error(`Unexpected complexity diagnostic: ${message}`);
  return Number(match[1]);
}

function createIdentity(projectRoot, result, diagnostic) {
  const source = result.source ?? fs.readFileSync(result.filePath, 'utf8');
  const sourceFile = ts.createSourceFile(result.filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const offset = sourceFile.getPositionOfLineAndCharacter(diagnostic.line - 1, diagnostic.column - 1);
  const node = findFunctionNode(sourceFile, offset);
  if (!node) throw new Error(`Unable to locate complex function at ${result.filePath}:${diagnostic.line}.`);
  return {
    file: path.relative(projectRoot, result.filePath).split(path.sep).join('/'),
    line: diagnostic.line,
    column: diagnostic.column,
    nodeType: diagnostic.nodeType,
    name: functionName(node, sourceFile),
    complexity: complexityFromMessage(diagnostic.message),
    sourceHash: hash(source.slice(node.getStart(sourceFile), node.end)),
  };
}

function identityKey(identity) {
  return [identity.file, identity.line, identity.column, identity.nodeType, identity.name, identity.complexity, identity.sourceHash].join(':');
}

function sortIdentities(identities) {
  return [...identities].sort((left, right) => identityKey(left).localeCompare(identityKey(right)));
}

function validateComplexityRule(rule) {
  if (!Array.isArray(rule) || rule[0] !== 2 || !isRecord(rule[1])) return false;
  return rule[1].max === 10 && Object.keys(rule[1]).length === 1;
}

async function assertComplexityPolicy(eslint, results) {
  for (const result of results) {
    const config = await eslint.calculateConfigForFile(result.filePath);
    if (!validateComplexityRule(config?.rules?.complexity)) {
      throw new Error(`ESLint complexity policy for ${result.filePath} must be exactly error/max 10.`);
    }
  }
}

async function collectComplexityDebt(projectRoot) {
  const eslint = new ESLint({ cwd: projectRoot });
  const results = await eslint.lintFiles(['.']);
  await assertComplexityPolicy(eslint, results);
  const violations = results.flatMap((result) => result.messages
    .filter((message) => message.ruleId === 'complexity')
    .map((message) => createIdentity(projectRoot, result, message)));
  const inlineExceptions = results.flatMap((result) => result.suppressedMessages
    .filter((message) => message.ruleId === 'complexity')
    .map((message) => createIdentity(projectRoot, result, message)));
  return {
    version: 1,
    violations: sortIdentities(violations),
    inlineExceptions: sortIdentities(inlineExceptions),
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateIdentity(identity, label) {
  if (!isRecord(identity)) return [`${label} must be an object.`];
  const validText = ['file', 'nodeType', 'name'].every((key) => typeof identity[key] === 'string');
  const validHash = /^[0-9a-f]{64}$/.test(identity.sourceHash);
  const validNumbers = ['line', 'column', 'complexity'].every((key) => Number.isInteger(identity[key]) && identity[key] > 0);
  return validText && validHash && validNumbers ? [] : [`${label} has invalid identity fields.`];
}

function parseBaseline(contents, label) {
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Unable to parse ${label}: ${error.message}`);
  }
  if (!isRecord(parsed) || parsed.version !== 1
    || !Array.isArray(parsed.violations) || !Array.isArray(parsed.inlineExceptions)) {
    throw new Error(`${label} must use complexity baseline version 1.`);
  }
  const identities = [...parsed.violations, ...parsed.inlineExceptions];
  const issues = identities.flatMap((identity, index) => validateIdentity(identity, `${label}[${index}]`));
  if (issues.length > 0) throw new Error(issues.join('\n'));
  if (new Set(identities.map(identityKey)).size !== identities.length) throw new Error(`${label} contains duplicate identities.`);
  return {
    version: 1,
    violations: sortIdentities(parsed.violations),
    inlineExceptions: sortIdentities(parsed.inlineExceptions),
  };
}

function readBaseline(projectRoot) {
  return parseBaseline(fs.readFileSync(path.join(projectRoot, baselineFileName), 'utf8'), baselineFileName);
}

function runGit(projectRoot, args) {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function readBaseBaseline(projectRoot, context) {
  let contents;
  try {
    contents = runGit(projectRoot, ['show', `${context.baseSha}:${baselineFileName}`]);
  } catch {
    return null;
  }
  return parseBaseline(contents, `${context.baseRef}:${baselineFileName}`);
}

function compareIdentitySets(current, allowed, addedLabel, staleLabel) {
  const currentKeys = new Set(current.violations.map(identityKey));
  const allowedKeys = new Set(allowed.violations.map(identityKey));
  const added = current.violations.filter((identity) => !allowedKeys.has(identityKey(identity)));
  const stale = allowed.violations.filter((identity) => !currentKeys.has(identityKey(identity)));
  return [
    ...added.map((identity) => `${addedLabel}: ${identity.file}:${identity.line}`),
    ...(staleLabel ? stale.map((identity) => `${staleLabel}: ${identity.file}:${identity.line}`) : []),
  ];
}

function compareBaselines(current, allowed, stale = true) {
  return [
    ...compareIdentitySets(current, allowed, 'new complexity debt', stale ? 'stale complexity identity' : undefined),
    ...compareIdentitySets(
      { violations: current.inlineExceptions },
      { violations: allowed.inlineExceptions },
      'new inline complexity disable',
      stale ? 'stale inline complexity exception' : undefined,
    ),
  ];
}

function validateBaseBaseline(projectRoot, current, context) {
  const base = readBaseBaseline(projectRoot, context);
  if (context.state && !base) return [`Base ${context.baseRef} is missing ${baselineFileName}.`];
  if (!context.state && base) return [`Base ${context.baseRef} has an identity baseline without suppression artifacts.`];
  if (base) return compareBaselines(current, base, false);
  if (!context.bootstrapEligible) return [`Base ${context.baseRef} has no trusted complexity identity baseline.`];
  if (hash(JSON.stringify(current)) === bootstrapBaselineDigest) return [];
  return ['Initial complexity identities differ from the pinned bootstrap baseline.'];
}

function formatIssues(issues) {
  return `${baselineFileName} violates the identity-aware complexity baseline:\n${issues.map((issue) => `- ${issue}`).join('\n')}`;
}

async function checkComplexityDebt(projectRoot, options = {}) {
  const current = readBaseline(projectRoot);
  const live = options.liveBaseline ?? await collectComplexityDebt(projectRoot);
  const liveIssues = compareBaselines(live, current);
  const baseIssues = validateBaseBaseline(projectRoot, current, loadBaseContext(projectRoot, options));
  const issues = [...liveIssues, ...baseIssues];
  if (issues.length > 0) throw new Error(formatIssues(issues));
}

async function pruneComplexityDebt(projectRoot, options = {}) {
  const current = readBaseline(projectRoot);
  const live = options.liveBaseline ?? await collectComplexityDebt(projectRoot);
  const additions = compareBaselines(live, current, false);
  const baseIssues = validateBaseBaseline(projectRoot, live, loadBaseContext(projectRoot, options));
  const issues = [...additions, ...baseIssues];
  if (issues.length > 0) throw new Error(formatIssues(issues));
  fs.writeFileSync(path.join(projectRoot, baselineFileName), `${JSON.stringify(live, null, 2)}\n`, 'utf8');
}

async function main() {
  try {
    if (process.argv.includes('--print')) {
      console.log(JSON.stringify(await collectComplexityDebt(process.cwd()), null, 2));
    } else if (process.argv.includes('--policy-only')) {
      await collectComplexityDebt(process.cwd());
    } else if (process.argv.includes('--prune')) {
      await pruneComplexityDebt(process.cwd());
    } else {
      await checkComplexityDebt(process.cwd());
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkComplexityDebt,
  collectComplexityDebt,
  compareBaselines,
  compareIdentitySets,
  createIdentity,
  identityKey,
  parseBaseline,
  pruneComplexityDebt,
  validateBaseBaseline,
  validateComplexityRule,
};

if (require.main === module) main();
