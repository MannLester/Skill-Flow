type SuppressionMap = Record<string, Record<string, { count: number }>>;
type ReadFile = (filePath: string, encoding: string) => string;
type WriteFile = (filePath: string, contents: string, encoding: string) => void;

const committedSuppressions = jest.requireActual('../eslint-suppressions.json') as SuppressionMap;
const {
  ceilingFileName,
  loadSuppressionState,
  ratchetCeiling,
  suppressionFileName,
  validateSuppressions,
  validateSynchronizedCeiling,
} = jest.requireActual('../scripts/check-eslint-suppressions.cjs') as {
  ceilingFileName: string;
  loadSuppressionState: (projectRoot: string, readFile?: ReadFile) => {
    suppressions: SuppressionMap;
    ceiling: SuppressionMap;
  };
  ratchetCeiling: (projectRoot: string, readFile?: ReadFile, writeFile?: WriteFile) => void;
  suppressionFileName: string;
  validateSuppressions: (suppressions: SuppressionMap, ceiling: SuppressionMap) => string[];
  validateSynchronizedCeiling: (suppressions: SuppressionMap, ceiling: SuppressionMap) => string[];
};

function cloneCommittedSuppressions(): SuppressionMap {
  return JSON.parse(JSON.stringify(committedSuppressions)) as SuppressionMap;
}

function stateReader(suppressions: SuppressionMap, ceiling: SuppressionMap): ReadFile {
  return (filePath) => JSON.stringify(filePath.endsWith(ceilingFileName) ? ceiling : suppressions);
}

describe('ESLint suppression ceiling', () => {
  it('rejects a new file, rule, or increased count', () => {
    const suppressions = cloneCommittedSuppressions();
    const ceiling = cloneCommittedSuppressions();
    suppressions['src/new-screen.tsx'] = { complexity: { count: 1 } };
    suppressions['src/app/settings.tsx'].noUnexpectedRule = { count: 1 };
    suppressions['src/context/session.tsx'].complexity.count = 7;

    expect(validateSuppressions(suppressions, ceiling)).toEqual(expect.arrayContaining([
      'src/new-screen.tsx: new suppression file is not allowed.',
      'src/app/settings.tsx (noUnexpectedRule): new suppression rule is not allowed.',
      'src/context/session.tsx (complexity): suppression count increased from 6 to 7.',
    ]));
  });

  it('fails when the committed ceiling is missing or malformed', () => {
    const missingCeiling: ReadFile = (filePath) => {
      if (filePath.endsWith(ceilingFileName)) throw new Error('ENOENT');
      return JSON.stringify(committedSuppressions);
    };
    const malformedCeiling: ReadFile = (filePath) => (
      filePath.endsWith(ceilingFileName) ? '{invalid' : JSON.stringify(committedSuppressions)
    );

    expect(() => loadSuppressionState('/project', missingCeiling)).toThrow(
      `Unable to read required ${ceilingFileName}: ENOENT`,
    );
    expect(() => loadSuppressionState('/project', malformedCeiling)).toThrow(
      `Unable to parse ${ceilingFileName}`,
    );
  });

  it('fails closed when the committed ceiling is stale', () => {
    const suppressions = cloneCommittedSuppressions();
    const staleCeiling = cloneCommittedSuppressions();
    suppressions['src/context/session.tsx'].complexity.count = 5;

    expect(validateSynchronizedCeiling(suppressions, staleCeiling)).toEqual([
      'src/context/session.tsx (complexity): committed ceiling 6 is stale; current count is 5. Run npm run lint:prune.',
    ]);
  });

  it('ratchets only downward and writes a synchronized committed ceiling', () => {
    const suppressions = cloneCommittedSuppressions();
    const ceiling = cloneCommittedSuppressions();
    suppressions['src/context/session.tsx'].complexity.count = 5;
    delete suppressions['src/app/settings.tsx'];
    let written = '';
    const writeFile: WriteFile = (_filePath, contents) => { written = contents; };

    ratchetCeiling('/project', stateReader(suppressions, ceiling), writeFile);

    expect(validateSynchronizedCeiling(suppressions, JSON.parse(written) as SuppressionMap)).toEqual([]);

    suppressions['src/context/session.tsx'].complexity.count = 7;
    expect(() => ratchetCeiling('/project', stateReader(suppressions, ceiling), writeFile)).toThrow(
      'suppression count increased from 6 to 7',
    );
  });

  it('loads the two committed files without consulting a remote Git ref', () => {
    const readFile = stateReader(committedSuppressions, committedSuppressions);
    const state = loadSuppressionState('/offline-shallow-clone', readFile);

    expect(state).toEqual({
      suppressions: committedSuppressions,
      ceiling: committedSuppressions,
    });
    expect(suppressionFileName).toBe('eslint-suppressions.json');
  });
});
