const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, describe, expect, it } = require('@jest/globals');
const {
  checkProject,
  ratchetCeiling,
} = require('../scripts/check-eslint-suppressions.cjs');
const {
  checkComplexityDebt,
  pruneComplexityDebt,
} = require('../scripts/check-eslint-complexity-debt.cjs');

const suppressionFile = 'eslint-suppressions.json';
const ceilingFile = 'eslint-suppressions-ceiling.json';
const identityFile = 'eslint-complexity-baseline.json';
const baseRef = 'refs/remotes/origin/main';
const baseline = { 'src/example.ts': { complexity: { count: 2 } } };
const identityBaseline = {
  version: 1,
  violations: [{
    file: 'src/example.ts',
    line: 1,
    column: 1,
    nodeType: 'FunctionDeclaration',
    name: 'example',
    complexity: 12,
    sourceHash: 'a'.repeat(64),
  }],
};

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function gitWithInput(root, args, input) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function writeMap(root, fileName, map) {
  fs.writeFileSync(path.join(root, fileName), JSON.stringify(map, null, 2), 'utf8');
}

function writePair(root, map = baseline) {
  writeMap(root, suppressionFile, map);
  writeMap(root, ceilingFile, map);
}

function writeIdentityBaseline(root, value = identityBaseline) {
  fs.writeFileSync(path.join(root, identityFile), JSON.stringify(value, null, 2), 'utf8');
}

function commit(root, message) {
  git(root, ['add', '.']);
  git(root, ['commit', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function initRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'suppression-git-'));
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Suppression Test']);
  writePair(root);
  writeIdentityBaseline(root);
  const sha = commit(root, 'base');
  git(root, ['update-ref', baseRef, sha]);
  return root;
}

function initArtifactFreeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'suppression-bootstrap-'));
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Suppression Test']);
  fs.writeFileSync(path.join(root, 'seed.txt'), 'seed', 'utf8');
  const bootstrapSha = commit(root, 'bootstrap');
  fs.writeFileSync(path.join(root, 'unrelated.txt'), 'unrelated', 'utf8');
  const baseSha = commit(root, 'unrelated main advance');
  git(root, ['update-ref', baseRef, baseSha]);
  return { baseSha, bootstrapSha, root };
}

function digest(map) {
  return crypto.createHash('sha256').update(JSON.stringify(map)).digest('hex');
}

function setRemoteMainToHead(root) {
  const sha = git(root, ['rev-parse', 'HEAD']);
  git(root, ['update-ref', baseRef, sha]);
  return sha;
}

function checkAtCurrentBase(root) {
  const sha = git(root, ['rev-parse', baseRef]);
  expect(() => checkProject(root, { baseRef, baseSha: sha })).not.toThrow();
}

describe('ESLint suppression Git base contract', () => {
  const roots = [];

  afterEach(() => {
    roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true }));
  });

  it('passes on main after a normal merge', () => {
    const root = initRepo();
    roots.push(root);
    git(root, ['checkout', '-b', 'feature']);
    fs.writeFileSync(path.join(root, 'feature.txt'), 'feature', 'utf8');
    commit(root, 'feature');
    git(root, ['checkout', 'main']);
    git(root, ['merge', '--no-ff', 'feature', '-m', 'merge feature']);
    setRemoteMainToHead(root);
    checkAtCurrentBase(root);
  });

  it('passes on main after a squash merge', () => {
    const root = initRepo();
    roots.push(root);
    git(root, ['checkout', '-b', 'feature']);
    fs.writeFileSync(path.join(root, 'feature.txt'), 'feature', 'utf8');
    commit(root, 'feature');
    git(root, ['checkout', 'main']);
    git(root, ['merge', '--squash', 'feature']);
    commit(root, 'squash feature');
    setRemoteMainToHead(root);
    checkAtCurrentBase(root);
  });

  it('accepts a rebased feature when artifact-free main advanced from the bootstrap', () => {
    const { baseSha, bootstrapSha, root } = initArtifactFreeRepo();
    roots.push(root);
    git(root, ['checkout', '-b', 'feature']);
    writePair(root);
    commit(root, 'add verification gate');
    expect(() => checkProject(root, {
      baseRef,
      baseSha,
      bootstrapSha,
      bootstrapDigest: digest(baseline),
    })).not.toThrow();
  });

  it('rejects a non-descendant bootstrap and a mutated bootstrap pair', () => {
    const { baseSha, bootstrapSha, root } = initArtifactFreeRepo();
    roots.push(root);
    git(root, ['checkout', '-b', 'feature']);
    writePair(root);
    commit(root, 'add verification gate');
    const emptyTree = gitWithInput(root, ['mktree'], '');
    const unrelatedBootstrap = gitWithInput(root, ['commit-tree', emptyTree, '-m', 'unrelated root'], '');
    expect(() => checkProject(root, {
      baseRef,
      baseSha,
      bootstrapSha: unrelatedBootstrap,
      bootstrapDigest: digest(baseline),
    })).toThrow('is not a descendant of the pinned bootstrap');

    const mutated = { 'src/example.ts': { complexity: { count: 3 } } };
    writePair(root, mutated);
    expect(() => checkProject(root, {
      baseRef,
      baseSha,
      bootstrapSha,
      bootstrapDigest: digest(baseline),
    })).toThrow('differs from the pinned bootstrap baseline');
  });

  it('rejects a stale feature branch after the base advances', () => {
    const root = initRepo();
    roots.push(root);
    git(root, ['checkout', '-b', 'feature']);
    git(root, ['checkout', 'main']);
    writePair(root, { 'src/example.ts': { complexity: { count: 1 } } });
    setRemoteMainToHead(root);
    const sha = commit(root, 'prune base');
    git(root, ['update-ref', baseRef, sha]);
    git(root, ['checkout', 'feature']);
    expect(() => checkProject(root, { baseRef, baseSha: sha })).toThrow(
      'HEAD does not contain base',
    );
  });

  it('fails closed in a shallow checkout without the exact base ref', () => {
    const source = initRepo();
    const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'suppression-shallow-'));
    roots.push(source, clone);
    git(source, ['checkout', '-b', 'feature']);
    fs.writeFileSync(path.join(source, 'feature.txt'), 'feature', 'utf8');
    commit(source, 'feature');
    execFileSync('git', ['clone', '--depth=1', '--branch', 'feature', `file://${source}`, clone], { stdio: 'pipe' });
    expect(() => checkProject(clone, { baseRef })).toThrow('Base ref refs/remotes/origin/main is unavailable');
  });

  it('rejects malformed base artifacts and paired increases', () => {
    const root = initRepo();
    roots.push(root);
    const baseSha = git(root, ['rev-parse', baseRef]);
    git(root, ['checkout', '-b', 'feature']);
    const increased = { 'src/example.ts': { complexity: { count: 3 } } };
    writePair(root, increased);
    commit(root, 'paired increase');
    expect(() => checkProject(root, { baseRef, baseSha })).toThrow('suppression count increased from 2 to 3');

    git(root, ['checkout', 'main']);
    fs.writeFileSync(path.join(root, ceilingFile), '{bad', 'utf8');
    const malformedSha = commit(root, 'malformed base');
    git(root, ['update-ref', baseRef, malformedSha]);
    writeMap(root, ceilingFile, baseline);
    expect(() => checkProject(root, { baseRef, baseSha: malformedSha })).toThrow('Unable to parse');
  });

  it('ratchets a pruned working suppression before validating it', () => {
    const root = initRepo();
    roots.push(root);
    const baseSha = git(root, ['rev-parse', baseRef]);
    git(root, ['checkout', '-b', 'feature']);
    writeMap(root, suppressionFile, { 'src/example.ts': { complexity: { count: 1 } } });
    ratchetCeiling(root, { baseRef, baseSha });
    checkProject(root, { baseRef, baseSha });
    expect(JSON.parse(fs.readFileSync(path.join(root, ceilingFile), 'utf8'))).toEqual(
      { 'src/example.ts': { complexity: { count: 1 } } },
    );
  });

  it('uses existing identity artifacts and rejects paired growth or malformed base data', async () => {
    const root = initRepo();
    roots.push(root);
    const baseSha = git(root, ['rev-parse', baseRef]);
    git(root, ['checkout', '-b', 'feature']);
    await expect(checkComplexityDebt(root, {
      baseRef,
      baseSha,
      liveBaseline: identityBaseline,
    })).resolves.toBeUndefined();

    const added = {
      version: 1,
      violations: [...identityBaseline.violations, {
        ...identityBaseline.violations[0],
        line: 2,
        sourceHash: 'b'.repeat(64),
      }],
    };
    writeIdentityBaseline(root, added);
    await expect(checkComplexityDebt(root, { baseRef, baseSha, liveBaseline: added })).rejects.toThrow(
      'new complexity debt: src/example.ts:2',
    );

    git(root, ['checkout', 'main']);
    fs.writeFileSync(path.join(root, identityFile), '{bad', 'utf8');
    const malformedSha = commit(root, 'malformed identity baseline');
    git(root, ['update-ref', baseRef, malformedSha]);
    writeIdentityBaseline(root);
    await expect(checkComplexityDebt(root, {
      baseRef,
      baseSha: malformedSha,
      liveBaseline: identityBaseline,
    })).rejects.toThrow('Unable to parse');
  });

  it('prunes removed complexity identities without allowing additions', async () => {
    const root = initRepo();
    roots.push(root);
    const baseSha = git(root, ['rev-parse', baseRef]);
    git(root, ['checkout', '-b', 'feature']);
    const reduced = { version: 1, violations: [] };
    await pruneComplexityDebt(root, { baseRef, baseSha, liveBaseline: reduced });
    expect(JSON.parse(fs.readFileSync(path.join(root, identityFile), 'utf8'))).toEqual(reduced);
    await expect(checkComplexityDebt(root, {
      baseRef,
      baseSha,
      liveBaseline: reduced,
    })).resolves.toBeUndefined();
  });

  it('fails closed for a missing identity base and a stale feature head', async () => {
    const missingRoot = initRepo();
    roots.push(missingRoot);
    fs.unlinkSync(path.join(missingRoot, identityFile));
    const missingSha = commit(missingRoot, 'remove identity baseline');
    git(missingRoot, ['update-ref', baseRef, missingSha]);
    git(missingRoot, ['checkout', '-b', 'feature']);
    writeIdentityBaseline(missingRoot);
    await expect(checkComplexityDebt(missingRoot, {
      baseRef,
      baseSha: missingSha,
      liveBaseline: identityBaseline,
    })).rejects.toThrow(`is missing ${identityFile}`);

    const staleRoot = initRepo();
    roots.push(staleRoot);
    git(staleRoot, ['checkout', '-b', 'feature']);
    git(staleRoot, ['checkout', 'main']);
    fs.writeFileSync(path.join(staleRoot, 'advance.txt'), 'advance', 'utf8');
    const advancedSha = commit(staleRoot, 'advance main');
    git(staleRoot, ['update-ref', baseRef, advancedSha]);
    git(staleRoot, ['checkout', 'feature']);
    await expect(checkComplexityDebt(staleRoot, {
      baseRef,
      baseSha: advancedSha,
      liveBaseline: identityBaseline,
    })).rejects.toThrow('HEAD does not contain base');
  });
});
