import fs from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.join(process.cwd(), 'src');
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
