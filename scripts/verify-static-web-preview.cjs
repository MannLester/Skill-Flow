const http = require('node:http');
const path = require('node:path');

const { startPreview } = require('./preview-static-web.cjs');

function request(address, requestPath) {
  return new Promise((resolve, reject) => {
    const outgoing = http.get({ headers: { Connection: 'close' }, host: '127.0.0.1', path: requestPath, port: address.port }, (response) => {
      response.resume();
      response.once('end', () => resolve({ contentType: response.headers['content-type'] ?? '', status: response.statusCode }));
    });
    outgoing.once('error', reject);
    outgoing.setTimeout(5000, () => outgoing.destroy(new Error('Preview smoke request timed out.')));
  });
}

function assertResponse(label, result, expectedStatus, expectedType) {
  if (result.status !== expectedStatus || !result.contentType.includes(expectedType)) {
    throw new Error(`${label} returned ${result.status} ${result.contentType}.`);
  }
}

function selectGeneratedAsset(manifest) {
  const fileName = [...manifest.fileSet].find((candidate) => candidate.startsWith('_expo/') && candidate.endsWith('.js'));
  if (!fileName) throw new Error('The web export does not contain a generated JavaScript asset.');
  return `/${fileName}`;
}

async function run() {
  const root = path.resolve(path.dirname(require.resolve('../package.json')), 'dist');
  const preview = await startPreview({ host: '127.0.0.1', port: 0, root });
  try {
    const cases = [
      ['root', '/', 200, 'text/html'],
      ['static route', '/notifications', 200, 'text/html'],
      ['nested route', '/messages', 200, 'text/html'],
      ['generated asset', selectGeneratedAsset(preview.manifest), 200, 'text/javascript'],
      ['missing asset', '/assets/definitely-missing.png', 404, 'text/plain'],
      ['invalid route', '/definitely-not-a-skillflow-route', 404, 'text/html'],
    ];
    for (const [label, requestPath, status, contentType] of cases) {
      assertResponse(label, await request(preview.address, requestPath), status, contentType);
    }
    process.stdout.write('Static web preview smoke passed.\n');
  } finally {
    await preview.close();
  }
}

run().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
