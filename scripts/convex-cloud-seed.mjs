import { spawnSync } from 'node:child_process';
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

const identity = JSON.stringify({
  subject: 'seed',
  issuer: 'skillflow.dev.operator',
  tokenIdentifier: 'skillflow.dev.operator|seed',
});
const convexCli = fileURLToPath(new URL('../node_modules/convex/bin/main.js', import.meta.url));
const result = spawnSync(process.execPath, [
  convexCli, 'run', `devSeed:${command}`, JSON.stringify(args),
  '--identity', identity, '--deployment', 'dev',
], { stdio: 'inherit', shell: false });
if (result.error) fail(result.error.message);
process.exit(result.status ?? 1);

function fail(message) {
  console.error(`SkillFlow cloud-development seed: ${message}`);
  process.exit(1);
}
