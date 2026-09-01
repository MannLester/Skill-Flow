import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const [command = 'preview', studentProfileId, clientProfileId] = process.argv.slice(2);
const allowed = new Set(['preview', 'candidates', 'apply', 'reset']);
if (!allowed.has(command)) fail('Use preview, candidates, apply, or reset.');

let args = {};
if (command === 'apply') {
  if (!studentProfileId || !clientProfileId) fail('Apply requires a Student profile ID followed by a Client profile ID.');
  args = { studentProfileId, clientProfileId };
}
if (command === 'reset') args = { confirmation: 'RESET skillflow-foundation:v1' };

const identity = JSON.stringify({ subject: 'seed', issuer: 'skillflow.dev.operator', tokenIdentifier: 'skillflow.dev.operator|seed' });
const convexCli = fileURLToPath(new URL('../node_modules/convex/bin/main.js', import.meta.url));
runConvex(`devSeed:${command}`, args, false);
if (command === 'apply') await uploadSeedMedia();

async function uploadSeedMedia() {
  const manifest = [
    media('assets/images/optimized/student-avatar.jpg', 'profile-maya', 'profile', 'profile-maya', 'avatar', 'Maya S. profile image'),
    media('assets/images/optimized/student-avatar.jpg', 'profile-nico', 'profile', 'profile-nico', 'avatar', 'Nico V. profile image'),
    media('assets/images/optimized/service-poster.jpg', 'profile-maya', 'service', 'service-event-poster', 'service_cover', 'Event poster service cover'),
    media('assets/images/optimized/service-illustration.jpg', 'profile-maya', 'service', 'service-social-kit', 'service_cover', 'Social media kit service cover'),
    media('assets/images/optimized/service-uiux.jpg', 'profile-nico', 'service', 'service-presentation', 'service_cover', 'Presentation design service cover'),
    media('assets/images/optimized/service-poster.jpg', 'profile-maya', 'portfolio', 'portfolio-workshop-posters', 'portfolio_evidence', 'Workshop poster portfolio sample'),
    media('assets/images/optimized/service-uiux.jpg', 'profile-nico', 'portfolio', 'portfolio-ordering-ui', 'portfolio_evidence', 'Mobile ordering UI portfolio sample'),
    media('assets/images/tutorial-web.png', 'profile-maya', 'certification', 'cert-layout', 'certification_evidence', 'Poster layout certification evidence'),
    media('assets/images/tutorial-web.png', 'profile-nico', 'certification', 'cert-ui', 'certification_evidence', 'Mobile UI certification evidence'),
  ];
  for (const item of manifest) await uploadOne(item);
  console.log(`Seeded ${manifest.length} repository-owned media attachments.`);
}

function media(path, ownerSeedKey, targetType, targetSeedKey, purpose, altText) {
  return { path, ownerSeedKey, targetType, targetSeedKey, purpose, altText, position: 0, width: 1000, height: 1000 };
}

async function uploadOne(item) {
  const uploadUrl = runConvex('devSeed:createMediaUpload', {}, true);
  const bytes = await readFile(fileURLToPath(new URL(`../${item.path}`, import.meta.url)));
  const contentType = item.path.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': contentType }, body: bytes });
  if (!response.ok) fail(`Media upload failed (${response.status}) for ${item.path}.`);
  const { storageId } = await response.json();
  const { path: _path, ...metadata } = item;
  runConvex('devSeed:finalizeMediaUpload', { ...metadata, storageId, originalName: item.path.split('/').at(-1) }, true);
}

function runConvex(functionName, functionArgs, capture) {
  const result = spawnSync(process.execPath, [convexCli, 'run', functionName, JSON.stringify(functionArgs), '--identity', identity, '--deployment', 'dev'], { encoding: capture ? 'utf8' : undefined, stdio: capture ? 'pipe' : 'inherit', shell: false });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(capture ? result.stderr || `Convex command failed: ${functionName}` : `Convex command failed: ${functionName}`);
  if (!capture) return '';
  try { return JSON.parse(result.stdout.trim()); }
  catch { fail(`Convex returned an invalid response for ${functionName}.`); }
}

function fail(message) {
  console.error(`SkillFlow cloud-development seed: ${message}`);
  process.exit(1);
}
