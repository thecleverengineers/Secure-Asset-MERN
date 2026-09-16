import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runner = readFileSync(new URL('../scripts/run-automatic-migrations.js', import.meta.url), 'utf8');
const contract = readFileSync(new URL('./automatic-migrations.test.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('the Open Sans migration is present in both the production runner and its ordered contract', () => {
  const advancedRental = runner.indexOf("{ name: 'advanced-rental', command: 'migrate:advanced-rental'");
  const openSans = runner.indexOf("{ name: 'global-open-sans', command: 'migrate:open-sans'");
  const indexes = runner.indexOf("{ name: 'production-indexes', command: 'db:indexes'");

  assert.ok(advancedRental >= 0, 'advanced-rental migration must exist');
  assert.ok(openSans > advancedRental, 'Open Sans migration must run after advanced-rental');
  assert.ok(indexes > openSans, 'Open Sans migration must finish before production indexes');
  assert.match(contract, /'migrate:advanced-rental',\s*'migrate:rental-units',\s*'migrate:open-sans',\s*'db:indexes'/);
  assert.equal(packageJson.scripts['migrate:open-sans'], 'node scripts/migrate-open-sans-global.js');
});
