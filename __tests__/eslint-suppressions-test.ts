type SuppressionMap = Record<string, Record<string, { count: number }>>;
type TrustedState = { ref: string; suppressions: SuppressionMap; ceiling: SuppressionMap };
type TrustedHistory = { head: TrustedState | null; parents: TrustedState[] };

const committedSuppressions = jest.requireActual('../eslint-suppressions.json') as SuppressionMap;
const {
  parseTrustedState,
  validateAgainstHistory,
  validateSuppressionState,
  validateSuppressions,
  validateSynchronizedCeiling,
} = jest.requireActual('../scripts/check-eslint-suppressions.cjs') as {
  parseTrustedState: (ref: string, suppressions: string | null, ceiling: string | null) => TrustedState | null;
  validateAgainstHistory: (suppressions: SuppressionMap, history: TrustedHistory) => string[];
  validateSuppressionState: (
    suppressions: SuppressionMap,
    ceiling: SuppressionMap,
    history: TrustedHistory,
  ) => string[];
  validateSuppressions: (suppressions: SuppressionMap, ceiling: SuppressionMap) => string[];
  validateSynchronizedCeiling: (suppressions: SuppressionMap, ceiling: SuppressionMap) => string[];
};

function cloneBaseline(): SuppressionMap {
  return JSON.parse(JSON.stringify(committedSuppressions)) as SuppressionMap;
}

function trustedState(ref = 'base'): TrustedState {
  return { ref, suppressions: cloneBaseline(), ceiling: cloneBaseline() };
}

function trustedHistory(): { head: TrustedState; parents: TrustedState[] } {
  return { head: trustedState('HEAD'), parents: [trustedState('parent')] };
}

describe('ESLint suppression trust anchor', () => {
  it('rejects a paired new file, rule, or count increase', () => {
    const suppressions = cloneBaseline();
    const ceiling = cloneBaseline();
    suppressions['src/new-screen.tsx'] = { complexity: { count: 1 } };
    ceiling['src/new-screen.tsx'] = { complexity: { count: 1 } };
    suppressions['src/app/settings.tsx'].newRule = { count: 1 };
    ceiling['src/app/settings.tsx'].newRule = { count: 1 };
    suppressions['src/context/session.tsx'].complexity.count = 7;
    ceiling['src/context/session.tsx'].complexity.count = 7;

    expect(validateSuppressionState(suppressions, ceiling, trustedHistory())).toEqual(
      expect.arrayContaining([
        'against trusted HEAD: src/new-screen.tsx: new suppression file is not allowed.',
        'against trusted HEAD: src/app/settings.tsx (newRule): new suppression rule is not allowed.',
        'against trusted HEAD: src/context/session.tsx (complexity): suppression count increased from 6 to 7.',
      ]),
    );
  });

  it('fails closed when parent history is unavailable', () => {
    const history = { head: trustedState('HEAD'), parents: [] };
    expect(validateAgainstHistory(cloneBaseline(), history)).toEqual([
      'No trusted parent suppression state is available; fetch parent history before linting.',
    ]);
  });

  it('rejects malformed, incomplete, or stale trusted artifacts', () => {
    expect(() => parseTrustedState('parent', '{bad', '{}')).toThrow(
      'Unable to parse parent:eslint-suppressions.json',
    );
    expect(() => parseTrustedState('parent', '{}', null)).toThrow(
      'Trusted parent has an incomplete suppression baseline.',
    );

    const staleParent = trustedState('parent');
    staleParent.suppressions['src/context/session.tsx'].complexity.count = 5;
    expect(validateAgainstHistory(cloneBaseline(), {
      head: trustedState('HEAD'),
      parents: [staleParent],
    })).toContain(
      'trusted parent: src/context/session.tsx (complexity): committed ceiling 6 is stale; current count is 5.',
    );
  });

  it('permits pruning but rejects ratcheting back above trusted history', () => {
    const suppressions = cloneBaseline();
    const ceiling = cloneBaseline();
    suppressions['src/context/session.tsx'].complexity.count = 5;
    ceiling['src/context/session.tsx'].complexity.count = 5;
    delete suppressions['src/app/settings.tsx'];
    delete ceiling['src/app/settings.tsx'];

    expect(validateSuppressionState(suppressions, ceiling, trustedHistory())).toEqual([]);

    const prunedHistory = trustedHistory();
    prunedHistory.head.suppressions = cloneBaseline();
    prunedHistory.head.ceiling = cloneBaseline();
    prunedHistory.head.suppressions['src/context/session.tsx'].complexity.count = 5;
    prunedHistory.head.ceiling['src/context/session.tsx'].complexity.count = 5;
    expect(validateAgainstHistory(cloneBaseline(), prunedHistory)).toContain(
      'against trusted HEAD: src/context/session.tsx (complexity): suppression count increased from 5 to 6.',
    );
  });

  it('still rejects unsynchronized current files before checking history', () => {
    const suppressions = cloneBaseline();
    const ceiling = cloneBaseline();
    suppressions['src/context/session.tsx'].complexity.count = 5;

    expect(validateSynchronizedCeiling(suppressions, ceiling)).toEqual([
      'src/context/session.tsx (complexity): committed ceiling 6 is stale; current count is 5.',
    ]);
    expect(validateSuppressions(suppressions, ceiling)).toEqual([]);
  });
});
