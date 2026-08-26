type DirectoryEntry = { name: string; isDirectory: () => boolean };

const fs = jest.requireActual('fs') as {
  readFileSync: (file: string, encoding: 'utf8') => string;
  readdirSync: (directory: string, options: { withFileTypes: true }) => DirectoryEntry[];
};
const path = jest.requireActual('path') as {
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
  resolve: (...parts: string[]) => string;
};

const APP_ROOT = path.resolve('src');
const NONCANONICAL_INDEX_ROUTES = [
  '/portfolio/index',
  '/profile/index',
  '/messages/index',
  '/services/[serviceId]/index',
];

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(entryPath) : /\.[jt]sx?$/.test(entry.name) ? [entryPath] : [];
  });
}

describe('canonical Expo Router destinations', () => {
  it('does not navigate to index file names', () => {
    const offenders = sourceFiles(APP_ROOT).flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return NONCANONICAL_INDEX_ROUTES.filter((route) => source.includes(route)).map((route) => ({ file: path.relative(APP_ROOT, file), route }));
    });

    expect(offenders).toEqual([]);
  });
});
