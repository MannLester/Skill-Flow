const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, expect, it } = require('@jest/globals');
const {
  compareBaselines,
  compareIdentitySets,
  createIdentity,
  parseBaseline,
  validateComplexityRule,
} = require('../scripts/check-eslint-complexity-debt.cjs');

const projectRoot = path.resolve('virtual-project');
const checkerPath = path.resolve('scripts/check-eslint-complexity-debt.cjs');
const diagnostic = {
  ruleId: 'complexity',
  message: "Function 'inherited' has a complexity of 12. Maximum allowed is 10.",
  line: 1,
  column: 10,
  nodeType: 'FunctionDeclaration',
};
const complexFunctionSource = `function hidden(values) {
  if (values[0]) return 0;
  if (values[1]) return 1;
  if (values[2]) return 2;
  if (values[3]) return 3;
  if (values[4]) return 4;
  if (values[5]) return 5;
  if (values[6]) return 6;
  if (values[7]) return 7;
  if (values[8]) return 8;
  if (values[9]) return 9;
  return values[10] ? 10 : 11;
}
hidden([]);\n`;

function identityFor(source, overrides = {}) {
  const message = { ...diagnostic, ...overrides };
  return createIdentity(projectRoot, {
    filePath: path.join(projectRoot, 'src/example.ts'),
    source,
  }, message);
}

function baseline(violations) {
  return { version: 1, violations, inlineExceptions: [] };
}

function makeLintProject(max, source, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'complexity-policy-'));
  const ignores = options.ignores ?? [];
  const parserPath = require.resolve('@typescript-eslint/parser');
  fs.writeFileSync(
    path.join(root, 'eslint.config.js'),
    `const parser = require(${JSON.stringify(parserPath)}); module.exports = [{ ignores: ${JSON.stringify(ignores)} }, { files: ['**/*.{js,jsx,cjs,mjs,ts,tsx,cts,mts}'], languageOptions: { parser }, rules: { complexity: ['error', { max: ${max} }] } }];\n`,
    'utf8',
  );
  const filePath = path.join(root, options.file ?? 'probe.js');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source, 'utf8');
  return root;
}

function collectFromProject(root) {
  const output = execFileSync(process.execPath, [checkerPath, '--print'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}

describe('identity-aware complexity debt', () => {
  const original = 'function inherited(a, b, c) { return a ? 1 : b ? 2 : c ? 3 : 4; }';

  it('accepts the exact inherited function identity', () => {
    const identity = identityFor(original);
    expect(compareIdentitySets(baseline([identity]), baseline([identity]), 'new', 'stale')).toEqual([]);
  });

  it('rejects same-file replacement even when name, location, and count stay equal', () => {
    const inherited = identityFor(original);
    const replacement = identityFor('function inherited(a, b, c) { return a && b ? 1 : b && c ? 2 : 3; }');
    expect(compareIdentitySets(baseline([replacement]), baseline([inherited]), 'new', 'stale')).toEqual([
      'new: src/example.ts:1',
      'stale: src/example.ts:1',
    ]);
  });

  it('allows harmless line shifts while rejecting cross-file moves, renames, and additions', () => {
    const inherited = identityFor(original);
    const shifted = identityFor(`\n${original}`, { line: 2 });
    const moved = { ...inherited, file: 'src/moved.ts' };
    const renamed = identityFor(original.replace('inherited', 'replacement'));
    const added = identityFor(original.replace('inherited', 'additional'));
    expect(compareIdentitySets(baseline([shifted]), baseline([inherited]), 'new', 'stale')).toEqual([]);
    for (const changed of [moved, renamed, added]) {
      expect(compareIdentitySets(baseline([changed]), baseline([inherited]), 'new')).toEqual([
        expect.stringContaining('new: src/'),
      ]);
    }
  });

  it('allows reduction or removal to be pruned but reports a stale unpruned entry', () => {
    const inherited = baseline([identityFor(original)]);
    const reduced = baseline([]);
    expect(compareIdentitySets(reduced, inherited, 'new')).toEqual([]);
    expect(compareIdentitySets(reduced, inherited, 'new', 'stale')).toEqual([
      'stale: src/example.ts:1',
    ]);
  });

  it('rejects a new inline complexity disable but preserves an exact inherited exception', () => {
    const inlineIdentity = identityFor(original);
    const current = baseline([]);
    const live = { ...baseline([]), inlineExceptions: [inlineIdentity] };
    expect(compareBaselines(live, current)).toContain(
      'new inline complexity disable: src/example.ts:1',
    );
    expect(compareBaselines(live, live)).toEqual([]);

    const replaced = identityFor(original.replace('inherited', 'replacement'));
    expect(compareBaselines(
      { ...baseline([]), inlineExceptions: [replaced] },
      live,
    )).toContain('new inline complexity disable: src/example.ts:1');
  });

  it('pins the ESLint complexity policy to error/max 10 exactly', () => {
    expect(validateComplexityRule([2, { max: 10 }])).toBe(true);
    expect(validateComplexityRule([1, { max: 10 }])).toBe(false);
    expect(validateComplexityRule([2, { max: 100 }])).toBe(false);
    expect(validateComplexityRule([2, { max: 10, variant: 'modified' }])).toBe(false);
  });

  it('collects an inline-disabled complexity-12 function as an exception candidate', async () => {
    const source = `// eslint-disable-next-line complexity\n${complexFunctionSource}`;
    const root = makeLintProject(10, source);
    try {
      const collected = collectFromProject(root);
      expect(collected.violations).toEqual([]);
      expect(collected.inlineExceptions).toEqual([
        expect.objectContaining({ file: 'probe.js', name: 'hidden', complexity: 12 }),
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['js', 'jsx', 'cjs', 'mjs', 'ts', 'tsx', 'cts', 'mts'])(
    'collects real complexity diagnostics from .%s files',
    (extension) => {
      const root = makeLintProject(10, complexFunctionSource, { file: `src/probe.${extension}` });
      try {
        expect(collectFromProject(root).violations).toEqual([
          expect.objectContaining({ file: `src/probe.${extension}`, name: 'hidden', complexity: 12 }),
        ]);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it.each(['cts', 'mts'])('uses the repository ESLint config for real .%s diagnostics', (extension) => {
    const result = spawnSync(
      path.resolve('node_modules/.bin/eslint'),
      ['--stdin', '--stdin-filename', `src/complexity-probe.${extension}`, '--format', 'json'],
      { cwd: path.resolve('.'), input: complexFunctionSource, encoding: 'utf8' },
    );
    const [lintResult] = JSON.parse(result.stdout);
    expect(result.status).toBe(1);
    expect(lintResult.messages).toEqual([
      expect.objectContaining({ ruleId: 'complexity', severity: 2 }),
    ]);
  });

  it('rejects an imported active-code file symlinked to an ignored target', () => {
    const root = makeLintProject(10, "import './symlinked-debt.js';\n", { file: 'src/index.js' });
    try {
      fs.mkdirSync(path.join(root, 'references'), { recursive: true });
      fs.writeFileSync(path.join(root, 'references', 'debt.js'), complexFunctionSource, 'utf8');
      fs.symlinkSync(path.join('..', 'references', 'debt.js'), path.join(root, 'src', 'symlinked-debt.js'));
      execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
      execFileSync('git', ['add', 'src/index.js', 'src/symlinked-debt.js'], { cwd: root, stdio: 'ignore' });
      expect(() => collectFromProject(root)).toThrow();
      try {
        collectFromProject(root);
      } catch (error) {
        expect(error.stderr).toContain('must not be a symbolic link: src/symlinked-debt.js');
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects directory symlinks nested in required active-code roots', () => {
    const root = makeLintProject(10, 'export const safe = true;\n', { file: 'src/index.js' });
    try {
      fs.mkdirSync(path.join(root, 'references', 'linked'), { recursive: true });
      fs.symlinkSync(path.join('..', 'references', 'linked'), path.join(root, 'src', 'linked'));
      expect(() => collectFromProject(root)).toThrow();
      try {
        collectFromProject(root);
      } catch (error) {
        expect(error.stderr).toContain('must not be a symbolic link: src/linked');
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects an executable extensionless root symlink imported by root code', () => {
    const root = makeLintProject(10, "require('./payload');\n", {
      file: 'probe.js',
      ignores: ['references/**'],
    });
    try {
      fs.mkdirSync(path.join(root, 'references'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'references', 'debt.js'),
        `${complexFunctionSource}module.exports = 'executed';\n`,
        'utf8',
      );
      fs.symlinkSync(path.join('references', 'debt.js'), path.join(root, 'payload'));
      execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
      execFileSync('git', ['add', 'probe.js', 'payload'], { cwd: root, stdio: 'ignore' });
      expect(execFileSync(process.execPath, ['probe.js'], { cwd: root, encoding: 'utf8' })).toBe('');
      expect(() => collectFromProject(root)).toThrow();
      try {
        collectFromProject(root);
      } catch (error) {
        expect(error.stderr).toContain('must not be a symbolic link: payload');
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['outside-root directory', os.tmpdir()],
    ['root cycle', '.'],
  ])('rejects a root symlink without following its %s target', (_, target) => {
    const root = makeLintProject(10, 'module.exports = true;\n', { file: 'probe.js' });
    try {
      fs.symlinkSync(target, path.join(root, 'payload'));
      expect(() => collectFromProject(root)).toThrow();
      try {
        collectFromProject(root);
      } catch (error) {
        expect(error.stderr).toContain('must not be a symbolic link: payload');
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects max 100 before collecting or pruning debt', async () => {
    const root = makeLintProject(100, 'function simple() { return true; }\n');
    try {
      expect(() => collectFromProject(root)).toThrow();
      try {
        collectFromProject(root);
      } catch (error) {
        expect(error.stderr).toContain('must be exactly error/max 10');
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['src/**', 'src/ignored.ts'],
    ['src/ignored.jsx', 'src/ignored.jsx'],
    ['src/ignored.mts', 'src/ignored.mts'],
    ['src/ignored.cts', 'src/ignored.cts'],
    ['ignored.jsx', 'ignored.jsx'],
    ['__tests__/ignored-test.mts', '__tests__/ignored-test.mts'],
    ['scripts/ignored.cts', 'scripts/ignored.cts'],
    ['convex/ignored.jsx', 'convex/ignored.jsx'],
  ])('rejects broad active-code ignore pattern %s', (ignore, file) => {
    const root = makeLintProject(10, complexFunctionSource, {
      ignores: [ignore],
      file,
    });
    try {
      expect(() => collectFromProject(root)).toThrow();
      try {
        collectFromProject(root);
      } catch (error) {
        expect(error.stderr).toContain(file);
        expect(error.stderr).toMatch(/ignore policy excludes required code|must be exactly error\/max 10/);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed for malformed baseline data', () => {
    expect(() => parseBaseline('{bad', 'baseline')).toThrow('Unable to parse baseline');
    expect(() => parseBaseline('{"version":2,"violations":[]}', 'baseline')).toThrow(
      'must use complexity baseline version 1',
    );
    expect(() => parseBaseline('{"version":1,"violations":[{}],"inlineExceptions":[]}', 'baseline')).toThrow(
      'has invalid identity fields',
    );
    const duplicate = identityFor(original);
    expect(() => parseBaseline(JSON.stringify({
      version: 1,
      violations: [duplicate, { ...duplicate, line: duplicate.line + 10 }],
      inlineExceptions: [],
    }), 'baseline')).toThrow('contains duplicate identities');
  });
});
