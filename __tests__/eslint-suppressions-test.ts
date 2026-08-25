type SuppressionMap = Record<string, Record<string, { count: number }>>;

const { initialSuppressions, validateSuppressions } = jest.requireActual('../scripts/check-eslint-suppressions.cjs') as {
  initialSuppressions: SuppressionMap;
  validateSuppressions: (suppressions: SuppressionMap, ceiling?: SuppressionMap) => string[];
};

function cloneInitialSuppressions(): SuppressionMap {
  return JSON.parse(JSON.stringify(initialSuppressions)) as SuppressionMap;
}

describe('ESLint suppression ceiling', () => {
  it('rejects a new file or rule', () => {
    const suppressions = cloneInitialSuppressions();
    suppressions['src/new-screen.tsx'] = { complexity: { count: 1 } };
    suppressions['src/app/settings.tsx'].noUnexpectedRule = { count: 1 };

    expect(validateSuppressions(suppressions)).toEqual(expect.arrayContaining([
      'src/new-screen.tsx: new suppression file is not allowed.',
      'src/app/settings.tsx (noUnexpectedRule): new suppression rule is not allowed.',
    ]));
    expect(validateSuppressions(suppressions)).toHaveLength(2);
  });

  it('rejects an increased count', () => {
    const suppressions = cloneInitialSuppressions();
    suppressions['src/context/session.tsx'].complexity.count = 7;

    expect(validateSuppressions(suppressions)).toEqual([
      'src/context/session.tsx (complexity): suppression count increased from 6 to 7.',
    ]);
  });

  it('allows a lower count or a fully pruned entry', () => {
    const suppressions = cloneInitialSuppressions();
    suppressions['src/context/session.tsx'].complexity.count = 5;
    delete suppressions['src/app/settings.tsx'];

    expect(validateSuppressions(suppressions)).toEqual([]);
  });
});
