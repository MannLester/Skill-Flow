const packageJson = jest.requireActual('../package.json') as {
  jest: { testPathIgnorePatterns: string[] };
};

describe('Jest repository boundaries', () => {
  it('excludes repo-local agent worktrees without excluding normal tests', () => {
    const configured = packageJson.jest.testPathIgnorePatterns;
    const worktreePattern = configured.find((pattern) => pattern.includes('.agent-worktrees'));

    expect(worktreePattern).toBe('<rootDir>/.agent-worktrees/');
    const matcher = new RegExp(worktreePattern!.replace('<rootDir>', '/repo'));
    expect(matcher.test('/repo/.agent-worktrees/issue-31/__tests__/nested-test.ts')).toBe(true);
    expect(matcher.test('/repo/__tests__/ordinary-test.ts')).toBe(false);
  });
});
