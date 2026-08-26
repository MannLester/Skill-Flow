const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { Buffer } = require('node:buffer');
const { afterEach, describe, expect, it } = require('@jest/globals');

const {
  cacheControl,
  createManifest,
  decodePathname,
  networkWarning,
  parseConfiguration,
  parsePort,
  resolveRequest,
  startPreview,
} = require('../scripts/preview-static-web.cjs');

const ownedDirectories = [];

function makeExport(extraFiles = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skillflow-web-preview-test-'));
  ownedDirectories.push(root);
  const files = {
    '+not-found.html': '<h1>APP NOT FOUND</h1>',
    '_expo/static/css/web/styles-deadbeef.css': 'body { color: red; }',
    '_expo/static/js/web/entry-a1b2c3d4.js': 'globalThis.EXPO = true;',
    'assets/font.abcdef12.woff2': Buffer.from([7, 8, 9]),
    'assets/icon-aabbccdd.png': Buffer.from([1, 2, 3, 4]),
    'favicon.ico': Buffer.from([5, 6]),
    'index.html': '<h1>HOME</h1>',
    'messages/index.html': '<h1>MESSAGES</h1>',
    'notifications.html': '<h1>NOTIFICATIONS</h1>',
    'project-posts/[postId]/edit.html': '<h1>EDIT POST</h1>',
    'projects/[projectId].html': '<h1>PROJECT</h1>',
    'projects/discover.html': '<h1>DISCOVER</h1>',
    ...extraFiles,
  };
  for (const [fileName, contents] of Object.entries(files)) {
    const destination = path.join(root, fileName);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents);
  }
  return root;
}

function request(address, requestPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const requestOptions = { headers: { Connection: 'close' }, host: '127.0.0.1', method, path: requestPath, port: address.port };
    const outgoing = http.request(requestOptions, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ body: Buffer.concat(chunks), headers: response.headers, status: response.statusCode }));
    });
    outgoing.once('error', reject);
    outgoing.end();
  });
}

afterEach(() => {
  for (const directory of ownedDirectories.splice(0)) fs.rmSync(directory, { force: true, recursive: true });
});

describe('static web preview configuration', () => {
  it('uses repository-scoped settings and rejects invalid ports', () => {
    const configuration = parseConfiguration({}, { projectRoot: '/project' });
    expect(configuration).toMatchObject({ host: '127.0.0.1', port: 4173, root: path.resolve('/project/dist') });
    expect(() => parsePort('0')).toThrow(/1 through 65535/);
    expect(() => parsePort('65536')).toThrow(/1 through 65535/);
    expect(() => parsePort('not-a-port')).toThrow(/integer/);
    expect(parsePort('0', true)).toBe(0);
    expect(() => parseConfiguration({ SKILLFLOW_WEB_PREVIEW_HOST: 'bad host' }, { projectRoot: '/project' })).toThrow(/host/);
    expect(networkWarning('127.0.0.1')).toBeNull();
    expect(networkWarning('localhost')).toBeNull();
    expect(networkWarning('0.0.0.0')).toMatch(/exposed beyond this machine/);
  });

  it('rejects missing exports and unsupported templates', () => {
    expect(() => createManifest(path.join(os.tmpdir(), 'missing-skillflow-export'))).toThrow(/web:export/);
    expect(() => createManifest(makeExport({ 'projects/[...slug].html': 'catch all' }))).toThrow(/Unsupported/);
  });

  it('requires index.html to be a readable regular file', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skillflow-web-preview-invalid-index-'));
    ownedDirectories.push(root);
    fs.mkdirSync(path.join(root, 'index.html'));
    expect(() => createManifest(root)).toThrow(/web:export/);
  });

  it('rejects duplicate route shapes and export symlinks', () => {
    expect(() => createManifest(makeExport({ 'messages.html': 'duplicate' }))).toThrow(/Duplicate exported static route/);
    const root = makeExport();
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skillflow-web-preview-outside-'));
    ownedDirectories.push(outsideRoot);
    const outsideFile = path.join(outsideRoot, 'outside.html');
    fs.writeFileSync(outsideFile, 'outside');
    fs.symlinkSync(outsideFile, path.join(root, 'linked.html'));
    expect(() => createManifest(root)).toThrow(/symbolic links/);
  });
});

describe('static route discovery and resolution', () => {
  it.each([
    ['/', 'index.html'],
    ['/notifications', 'notifications.html'],
    ['/notifications/', 'notifications.html'],
    ['/notifications?filter=unread', 'notifications.html'],
    ['/messages', 'messages/index.html'],
    ['/messages/', 'messages/index.html'],
    ['/messages?thread=all', 'messages/index.html'],
    ['/projects/discover', 'projects/discover.html'],
    ['/projects/discover?category=all', 'projects/discover.html'],
    ['/projects/booking-123', 'projects/[projectId].html'],
    ['/projects/booking-123?from=notification', 'projects/[projectId].html'],
    ['/project-posts/post-123/edit', 'project-posts/[postId]/edit.html'],
    ['/?role=student', 'index.html'],
  ])('resolves %s to %s', (requestPath, expectedFile) => {
    expect(resolveRequest(createManifest(makeExport()), requestPath)).toMatchObject({ fileName: expectedFile, status: 200 });
  });

  it('prefers literal routes to parameter templates', () => {
    const manifest = createManifest(makeExport());
    expect(resolveRequest(manifest, '/projects/discover').fileName).toBe('projects/discover.html');
  });

  it('rejects equally specific overlapping templates at startup', () => {
    const root = makeExport({ '[section]/edit.html': 'one', 'projects/[projectId].html': 'two' });
    expect(() => createManifest(root)).toThrow(/Ambiguous exported route templates/);
  });

  it.each(['/../secret', '/%2e%2e/secret', '/folder\\secret', '/%00secret', '/.env'])('rejects unsafe path %s', (requestPath) => {
    expect(() => decodePathname(requestPath)).toThrow(/Unsafe/);
  });

  it('returns application HTML only for unknown extensionless routes', () => {
    const manifest = createManifest(makeExport());
    expect(resolveRequest(manifest, '/definitely-not-a-route')).toMatchObject({ fileName: '+not-found.html', status: 404 });
    expect(resolveRequest(manifest, '/assets/missing.png')).toMatchObject({ kind: 'text', status: 404 });
    expect(resolveRequest(manifest, '/assets/')).toMatchObject({ kind: 'text', status: 404 });
    expect(resolveRequest(manifest, '/missing.js')).toMatchObject({ kind: 'text', status: 404 });
    expect(resolveRequest(manifest, '/%E0%A4%A')).toMatchObject({ kind: 'text', status: 400 });
  });

  it('sets conservative HTML caching and immutable hashed-asset caching', () => {
    expect(cacheControl('notifications.html')).toBe('no-store');
    expect(cacheControl('_expo/entry-a1b2c3d4.js')).toContain('immutable');
    expect(cacheControl('favicon.ico')).toBe('no-cache');
  });
});

describe('static preview HTTP server', () => {
  let preview;

  afterEach(async () => {
    if (preview) await preview.close();
    preview = null;
  });

  it('serves routes and exact assets with truthful statuses and headers', async () => {
    preview = await startPreview({ host: '127.0.0.1', port: 0, root: makeExport() });
    const route = await request(preview.address, '/notifications?ignored=yes');
    const asset = await request(preview.address, '/_expo/static/js/web/entry-a1b2c3d4.js');
    const missingAsset = await request(preview.address, '/assets/missing.png');
    const missingRoute = await request(preview.address, '/definitely-not-a-route');

    expect(route.status).toBe(200);
    expect(route.body.toString()).toContain('NOTIFICATIONS');
    expect(route.headers['cache-control']).toBe('no-store');
    expect(asset.status).toBe(200);
    expect(asset.headers['content-type']).toContain('text/javascript');
    expect(asset.headers['x-content-type-options']).toBe('nosniff');
    expect(asset.body.toString()).toContain('EXPO');
    expect(missingAsset).toMatchObject({ status: 404 });
    expect(missingAsset.headers['content-type']).toContain('text/plain');
    expect(missingRoute.status).toBe(404);
    expect(missingRoute.headers['content-type']).toContain('text/html');
  });

  it.each([
    ['/_expo/static/js/web/entry-a1b2c3d4.js', 'globalThis.EXPO = true;', 'text/javascript', 'immutable'],
    ['/_expo/static/css/web/styles-deadbeef.css', 'body { color: red; }', 'text/css', 'immutable'],
    ['/assets/font.abcdef12.woff2', Buffer.from([7, 8, 9]), 'font/woff2', 'immutable'],
    ['/assets/icon-aabbccdd.png', Buffer.from([1, 2, 3, 4]), 'image/png', 'immutable'],
    ['/favicon.ico', Buffer.from([5, 6]), 'image/x-icon', 'no-cache'],
  ])('serves exact generated bytes and headers for %s', async (requestPath, expectedBody, contentType, cachePolicy) => {
    preview = await startPreview({ host: '127.0.0.1', port: 0, root: makeExport() });
    const result = await request(preview.address, requestPath);
    const expectedBytes = Buffer.isBuffer(expectedBody) ? expectedBody : Buffer.from(expectedBody);
    expect(result.status).toBe(200);
    expect(result.body).toEqual(expectedBytes);
    expect(result.headers['content-type']).toContain(contentType);
    expect(result.headers['x-content-type-options']).toBe('nosniff');
    expect(result.headers['cache-control']).toContain(cachePolicy);
  });

  it('supports HEAD and rejects unsupported methods', async () => {
    preview = await startPreview({ host: '127.0.0.1', port: 0, root: makeExport() });
    const get = await request(preview.address, '/messages');
    const head = await request(preview.address, '/messages', 'HEAD');
    const post = await request(preview.address, '/messages', 'POST');
    expect(head.status).toBe(200);
    expect(head.body).toHaveLength(0);
    expect(head.headers['content-type']).toContain('text/html');
    expect(head.headers['content-length']).toBe(get.headers['content-length']);
    expect(head.headers['cache-control']).toBe(get.headers['cache-control']);
    expect(head.headers['x-content-type-options']).toBe(get.headers['x-content-type-options']);
    expect(head.headers['transfer-encoding']).toBe(get.headers['transfer-encoding']);
    expect(post.status).toBe(405);
    expect(post.headers.allow).toBe('GET, HEAD');
  });

  it('keeps simultaneous requests isolated and releases its port', async () => {
    const root = makeExport();
    preview = await startPreview({ host: '127.0.0.1', port: 0, root });
    const releasedPort = preview.address.port;
    const [messages, project] = await Promise.all([
      request(preview.address, '/messages'),
      request(preview.address, '/projects/booking-123'),
    ]);
    expect(messages.body.toString()).toContain('MESSAGES');
    expect(project.body.toString()).toContain('PROJECT');
    await preview.close();
    preview = null;
    const replacement = await startPreview({ host: '127.0.0.1', port: releasedPort, root });
    await replacement.close();
  });

  it('rejects an occupied port without affecting its owner', async () => {
    const owner = http.createServer();
    await new Promise((resolve) => owner.listen(0, '127.0.0.1', resolve));
    const address = owner.address();
    await expect(startPreview({ host: '127.0.0.1', port: address.port, root: makeExport() })).rejects.toThrow(/already in use/);
    expect(owner.listening).toBe(true);
    await new Promise((resolve) => owner.close(resolve));
  });
});
