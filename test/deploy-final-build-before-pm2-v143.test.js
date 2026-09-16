import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('deployment performs a final frontend build immediately before PM2 release startup', () => {
  const source = fs.readFileSync(new URL('../scripts/deploy-production.sh', import.meta.url), 'utf8');
  const finalBuild = source.indexOf('Finalizing the frontend build for the PM2 release');
  const pm2Start = source.indexOf('Starting or reloading PM2');
  assert.ok(finalBuild >= 0 && finalBuild < pm2Start);
  assert.match(source.slice(finalBuild, pm2Start), /run_app npm run build/);
});
