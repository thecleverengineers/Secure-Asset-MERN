import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../server/src/seeds/ensureAdmin.js', import.meta.url), 'utf8');

test('bootstrap administrator resolves email before mobile to avoid duplicate-key collisions', () => {
  assert.match(source, /const emailUser = await User\.findOne\(identifierDescriptor\(admin\.email\)\.query\)/);
  assert.match(source, /const phoneUser = await User\.findOne\(identifierDescriptor\(admin\.phone\)\.query\)/);
  assert.match(source, /let user = emailUser \|\| phoneUser/);
  assert.match(source, /phoneUser\.\_id.*user\.\_id/);
  assert.match(source, /already used by another account/);
});
