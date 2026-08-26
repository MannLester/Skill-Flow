const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4173;
const ASSET_PREFIXES = ['/_expo/', '/assets/'];
const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.otf', 'font/otf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function safeError(message) {
  const error = new Error(message);
  error.code = 'SKILLFLOW_PREVIEW_ERROR';
  return error;
}

function parsePort(value, allowZero = false) {
  const port = Number(value);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isInteger(port) || port < minimum || port > 65535) {
    throw safeError(`Preview port must be an integer from ${minimum} through 65535.`);
  }
  return port;
}

function parseConfiguration(environment = process.env, options = {}) {
  const projectRoot = options.projectRoot ?? path.dirname(require.resolve('../package.json'));
  const rootValue = environment.SKILLFLOW_WEB_PREVIEW_DIR ?? 'dist';
  const root = path.resolve(projectRoot, rootValue);
  const host = environment.SKILLFLOW_WEB_PREVIEW_HOST ?? DEFAULT_HOST;
  const port = parsePort(environment.SKILLFLOW_WEB_PREVIEW_PORT ?? DEFAULT_PORT, options.allowZero);
  if (!host || /[\s\0]/u.test(host)) throw safeError('Preview host is invalid.');
  return { host, port, root, rootLabel: rootValue };
}

function validateRoot(root) {
  let rootReal;
  try {
    rootReal = fs.realpathSync(root);
    if (!fs.statSync(rootReal).isDirectory()) throw new Error('not a directory');
    const indexFile = path.join(rootReal, 'index.html');
    if (!fs.statSync(indexFile).isFile()) throw new Error('index is not a file');
    fs.accessSync(indexFile, fs.constants.R_OK);
  } catch {
    throw safeError('Web export is unavailable. Run `npm run web:export` first.');
  }
  return rootReal;
}

function relativeUrl(fileName) {
  return fileName.split(path.sep).join('/');
}

function walkFiles(root, directory = root, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw safeError('The web export must not contain symbolic links.');
    if (entry.isDirectory()) walkFiles(root, absolute, files);
    else if (entry.isFile()) files.push(relativeUrl(path.relative(root, absolute)));
  }
  return files;
}

function isParameter(segment) {
  return /^\[[^.[\]/]+\]$/u.test(segment);
}

function assertSupportedTemplate(segment) {
  if (segment.includes('[') || segment.includes(']')) {
    if (!isParameter(segment)) throw safeError(`Unsupported exported route template: ${segment}`);
  }
}

function htmlRoute(fileName) {
  if (!fileName.endsWith('.html') || fileName === '+not-found.html') return null;
  const withoutExtension = fileName.slice(0, -'.html'.length);
  const route = withoutExtension === 'index'
    ? '/'
    : `/${withoutExtension.replace(/\/index$/u, '')}`;
  const segments = route === '/' ? [] : route.slice(1).split('/');
  segments.forEach(assertSupportedTemplate);
  return { fileName, literalCount: segments.filter((segment) => !isParameter(segment)).length, route, segments };
}

function templatesOverlap(left, right) {
  if (left.segments.length !== right.segments.length) return false;
  return left.segments.every((segment, index) => (
    isParameter(segment) || isParameter(right.segments[index]) || segment === right.segments[index]
  ));
}

function assertNoAmbiguousTemplates(templates) {
  for (let leftIndex = 0; leftIndex < templates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < templates.length; rightIndex += 1) {
      const left = templates[leftIndex];
      const right = templates[rightIndex];
      if (left.literalCount === right.literalCount && templatesOverlap(left, right)) {
        throw safeError(`Ambiguous exported route templates: ${left.route} and ${right.route}`);
      }
    }
  }
}

function createStaticRoutes(routes) {
  const staticRoutes = new Map();
  for (const route of routes.filter((candidate) => !candidate.segments.some(isParameter))) {
    if (staticRoutes.has(route.route)) throw safeError(`Duplicate exported static route: ${route.route}`);
    staticRoutes.set(route.route, route.fileName);
  }
  return staticRoutes;
}

function createManifest(root) {
  const rootReal = validateRoot(root);
  const files = walkFiles(rootReal).sort();
  const fileSet = new Set(files);
  const routes = files.map(htmlRoute).filter(Boolean);
  const templates = routes.filter((route) => route.segments.some(isParameter));
  const staticRoutes = createStaticRoutes(routes);
  assertNoAmbiguousTemplates(templates);
  templates.sort((left, right) => right.literalCount - left.literalCount || left.route.localeCompare(right.route));
  return { fileSet, notFound: fileSet.has('+not-found.html') ? '+not-found.html' : null, rootReal, staticRoutes, templates };
}

function decodePathname(rawUrl) {
  let pathname;
  try {
    const rawPathname = rawUrl.split('?', 1)[0].split('#', 1)[0];
    if (!rawPathname.startsWith('/')) throw new Error('path must be absolute');
    pathname = decodeURIComponent(rawPathname);
  } catch {
    throw safeError('Malformed request path.');
  }
  if (pathname.includes('\0') || pathname.includes('\\')) throw safeError('Unsafe request path.');
  const segments = pathname.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..' || segment.startsWith('.'))) {
    throw safeError('Unsafe request path.');
  }
  return pathname;
}

function normalizedRoute(pathname) {
  if (pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function routeMatches(template, pathname) {
  const segments = pathname === '/' ? [] : pathname.slice(1).split('/');
  if (segments.length !== template.segments.length) return false;
  return template.segments.every((segment, index) => isParameter(segment) || segment === segments[index]);
}

function isAssetRequest(pathname) {
  return ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || path.posix.extname(pathname) !== '';
}

function resolveRequest(manifest, rawUrl) {
  let pathname;
  try {
    pathname = decodePathname(rawUrl);
  } catch {
    return { kind: 'text', status: 400, text: 'Bad Request\n' };
  }
  const fileName = pathname.slice(1);
  if (fileName && manifest.fileSet.has(fileName)) return { fileName, kind: 'file', status: 200 };
  if (isAssetRequest(pathname)) return { kind: 'text', status: 404, text: 'Not Found\n' };
  const route = normalizedRoute(pathname);
  const staticFile = manifest.staticRoutes.get(route);
  if (staticFile) return { fileName: staticFile, kind: 'file', status: 200 };
  const template = manifest.templates.find((candidate) => routeMatches(candidate, route));
  if (template) return { fileName: template.fileName, kind: 'file', status: 200 };
  if (manifest.notFound) return { fileName: manifest.notFound, kind: 'file', status: 404 };
  return { kind: 'text', status: 404, text: 'Not Found\n' };
}

function cacheControl(fileName) {
  if (fileName.endsWith('.html')) return 'no-store';
  if (/[.-][0-9a-f]{8,}\.[^.]+$/iu.test(fileName)) return 'public, max-age=31536000, immutable';
  return 'no-cache';
}

function responseHeaders(result) {
  if (result.kind === 'text') {
    return { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' };
  }
  return {
    'Cache-Control': cacheControl(result.fileName),
    'Content-Type': MIME_TYPES.get(path.posix.extname(result.fileName).toLowerCase()) ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  };
}

function sendResult(request, response, manifest, result) {
  const headers = responseHeaders(result);
  if (request.method === 'HEAD') {
    response.writeHead(result.status, headers);
    response.end();
    return;
  }
  if (result.kind === 'text') {
    response.writeHead(result.status, headers);
    response.end(result.text);
    return;
  }
  response.writeHead(result.status, headers);
  fs.createReadStream(path.join(manifest.rootReal, result.fileName))
    .on('error', () => response.destroy())
    .pipe(response);
}

function createRequestHandler(manifest, logger = null) {
  return (request, response) => {
    const startedAt = Date.now();
    const method = request.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      response.end('Method Not Allowed\n');
      return;
    }
    const result = resolveRequest(manifest, request.url ?? '/');
    sendResult(request, response, manifest, result);
    if (logger) logger({ durationMs: Date.now() - startedAt, method, pathname: safeLogPath(request.url), status: result.status });
  };
}

function safeLogPath(rawUrl) {
  try {
    return new URL(rawUrl, 'http://preview.invalid').pathname;
  } catch {
    return '<malformed>';
  }
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(safeError(error.code === 'EADDRINUSE' ? 'Preview port is already in use.' : 'Preview could not start.'));
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve(server.address());
    });
  });
}

async function startPreview(options) {
  const manifest = createManifest(options.root);
  const server = http.createServer(createRequestHandler(manifest, options.logger));
  const address = await listen(server, options.host, options.port);
  return { address, close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))), manifest, server };
}

async function runCli() {
  const configuration = parseConfiguration();
  if (configuration.host !== '127.0.0.1' && configuration.host !== '::1' && configuration.host !== 'localhost') {
    process.stderr.write('Warning: the development preview is exposed beyond this machine.\n');
  }
  const preview = await startPreview({ ...configuration, logger: ({ method, pathname, status, durationMs }) => {
    process.stdout.write(`${method} ${pathname} ${status} ${durationMs}ms\n`);
  } });
  const address = typeof preview.address === 'string' ? preview.address : `${configuration.host}:${preview.address.port}`;
  process.stdout.write(`SkillFlow web preview: http://${address}\n`);
  let closing = false;
  const close = async () => {
    if (closing) process.exit(1);
    closing = true;
    await preview.close();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

if (require.main === module) {
  runCli().catch((error) => {
    const message = error?.code === 'SKILLFLOW_PREVIEW_ERROR' ? error.message : 'Web preview failed.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  cacheControl,
  createManifest,
  createRequestHandler,
  decodePathname,
  parseConfiguration,
  parsePort,
  resolveRequest,
  startPreview,
};
