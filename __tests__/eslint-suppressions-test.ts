type SuppressionMap = Record<string, Record<string, { count: number }>>;
type BaseContext = {
  baseRef: string;
  baseSha: string;
  headSha: string;
  state: null | { ref: string; suppressions: SuppressionMap; ceiling: SuppressionMap };
};

const committedSuppressions = jest.requireActual('../eslint-suppressions.json') as SuppressionMap;
const {
  parseBaseState,
  requireExpectedBaseSha,
  validateAgainstBase,
  validateExpectedBaseSha,
  validateSuppressionState,
  validateSuppressions,
  validateSynchronizedCeiling,
} = jest.requireActual('../scripts/check-eslint-suppressions.cjs') as {
  parseBaseState: (ref: string, suppressions: string | null, ceiling: string | null) => BaseContext['state'];
  requireExpectedBaseSha: (expectedSha: string | undefined, required: boolean) => void;
  validateAgainstBase: (suppressions: SuppressionMap, context: BaseContext) => string[];
  validateExpectedBaseSha: (baseSha: string, expectedSha?: string) => void;
  validateSuppressionState: (suppressions: SuppressionMap, ceiling: SuppressionMap, context: BaseContext) => string[];
  validateSuppressions: (suppressions: SuppressionMap, ceiling: SuppressionMap) => string[];
  validateSynchronizedCeiling: (suppressions: SuppressionMap, ceiling: SuppressionMap) => string[];
};

function cloneBaseline(): SuppressionMap {
  return JSON.parse(JSON.stringify(committedSuppressions)) as SuppressionMap;
}

function baseContext(): BaseContext {
  return {
    baseRef: 'origin/main',
    baseSha: 'a'.repeat(40),
    headSha: 'b'.repeat(40),
    state: { ref: 'origin/main', suppressions: cloneBaseline(), ceiling: cloneBaseline() },
  };
}

describe('ESLint suppression trust anchor', () => {
  it('rejects paired current-tree additions and count increases', () => {
    const suppressions = cloneBaseline();
    const ceiling = cloneBaseline();
    suppressions['src/new-screen.tsx'] = { complexity: { count: 1 } };
    ceiling['src/new-screen.tsx'] = { complexity: { count: 1 } };
    suppressions['src/context/session.tsx'].complexity.count = 7;
    ceiling['src/context/session.tsx'].complexity.count = 7;

    expect(validateSuppressionState(suppressions, ceiling, baseContext())).toEqual(
      expect.arrayContaining([
        'against base origin/main: src/new-screen.tsx: new suppression file is not allowed.',
        'against base origin/main: src/context/session.tsx (complexity): suppression count increased from 6 to 7.',
      ]),
    );
  });

  it('fails closed for incomplete, malformed, and stale base artifacts', () => {
    expect(() => parseBaseState('origin/main', '{bad', '{}')).toThrow(
      'Unable to parse origin/main:eslint-suppressions.json',
    );
    expect(() => parseBaseState('origin/main', '{}', null)).toThrow(
      'Base origin/main has an incomplete suppression baseline.',
    );
    const context = baseContext();
    context.state!.suppressions['src/context/session.tsx'].complexity.count = 5;
    expect(validateAgainstBase(cloneBaseline(), context)).toContain(
      'base origin/main: src/context/session.tsx (complexity): committed ceiling 6 is stale; current count is 5.',
    );
  });

  it('requires a full exact expected base SHA', () => {
    expect(() => requireExpectedBaseSha(undefined, true)).toThrow(
      'ESLINT_SUPPRESSIONS_BASE_SHA is required in CI',
    );
    expect(() => validateExpectedBaseSha('a'.repeat(40), 'abc')).toThrow(
      'must be a full 40-character commit SHA',
    );
    expect(() => validateExpectedBaseSha('a'.repeat(40), 'b'.repeat(40))).toThrow(
      'Base ref is stale',
    );
    expect(() => validateExpectedBaseSha('a'.repeat(40), 'a'.repeat(40))).not.toThrow();
  });

  it('permits pruning and rejects ratcheting back above the base', () => {
    const suppressions = cloneBaseline();
    const ceiling = cloneBaseline();
    suppressions['src/context/session.tsx'].complexity.count = 5;
    ceiling['src/context/session.tsx'].complexity.count = 5;
    delete suppressions['src/app/settings.tsx'];
    delete ceiling['src/app/settings.tsx'];
    expect(validateSuppressionState(suppressions, ceiling, baseContext())).toEqual([]);

    const context = baseContext();
    context.state!.suppressions['src/context/session.tsx'].complexity.count = 5;
    context.state!.ceiling['src/context/session.tsx'].complexity.count = 5;
    expect(validateAgainstBase(cloneBaseline(), context)).toContain(
      'against base origin/main: src/context/session.tsx (complexity): suppression count increased from 5 to 6.',
    );
  });

  it('rejects unsynchronized current files before checking the base', () => {
    const suppressions = cloneBaseline();
    const ceiling = cloneBaseline();
    suppressions['src/context/session.tsx'].complexity.count = 5;
    expect(validateSynchronizedCeiling(suppressions, ceiling)).toEqual([
      'src/context/session.tsx (complexity): committed ceiling 6 is stale; current count is 5.',
    ]);
    expect(validateSuppressions(suppressions, ceiling)).toEqual([]);
  });
});
