const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, describe, expect, it } = require('@jest/globals');
const {
  checkProject,
  ratchetCeiling,
} = require('../scripts/check-eslint-suppressions.cjs');

const suppressionFile = 'eslint-suppressions.json';
const ceilingFile = 'eslint-suppressions-ceiling.json';
const baseRef = 'refs/remotes/origin/main';
const baseline = { 'src/example.ts': { complexity: { count: 2 } } };

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function writeMap(root, fileName, map) {
  fs.writeFileSync(path.join(root, fileName), JSON.stringify(map, null, 2), 'utf8');
}

function writePair(root, map = baseline) {
  writeMap(root, suppressionFile, map);
  writeMap(root, ceilingFile, map);
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
  const sha = commit(root, 'base');
  git(root, ['update-ref', baseRef, sha]);
  return root;
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
});
