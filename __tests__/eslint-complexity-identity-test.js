const path = require('node:path');
const { describe, expect, it } = require('@jest/globals');
const {
  compareIdentitySets,
  createIdentity,
  parseBaseline,
} = require('../scripts/check-eslint-complexity-debt.cjs');

const projectRoot = path.resolve('virtual-project');
const diagnostic = {
  ruleId: 'complexity',
  message: "Function 'inherited' has a complexity of 12. Maximum allowed is 10.",
  line: 1,
  column: 10,
  nodeType: 'FunctionDeclaration',
};

function identityFor(source, overrides = {}) {
  const message = { ...diagnostic, ...overrides };
  return createIdentity(projectRoot, {
    filePath: path.join(projectRoot, 'src/example.ts'),
    source,
  }, message);
}

function baseline(violations) {
  return { version: 1, violations };
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

  it('rejects moving, renaming, and adding a complex function', () => {
    const inherited = identityFor(original);
    const moved = identityFor(`\n${original}`, { line: 2 });
    const renamed = identityFor(original.replace('inherited', 'replacement'));
    const added = identityFor(original.replace('inherited', 'additional'));
    for (const changed of [moved, renamed, added]) {
      expect(compareIdentitySets(baseline([changed]), baseline([inherited]), 'new')).toEqual([
        expect.stringContaining('new: src/example.ts'),
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

  it('fails closed for malformed baseline data', () => {
    expect(() => parseBaseline('{bad', 'baseline')).toThrow('Unable to parse baseline');
    expect(() => parseBaseline('{"version":2,"violations":[]}', 'baseline')).toThrow(
      'must use complexity baseline version 1',
    );
    expect(() => parseBaseline('{"version":1,"violations":[{}]}', 'baseline')).toThrow(
      'has invalid identity fields',
    );
  });
});
