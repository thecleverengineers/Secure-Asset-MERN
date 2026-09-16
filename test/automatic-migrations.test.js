import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AUTOMATIC_MIGRATION_STEPS,
  automaticMigrationsEnabled,
  computeMigrationFingerprint,
} from '../scripts/run-automatic-migrations.js';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ecosystem = fs.readFileSync(new URL('../ecosystem.config.cjs', import.meta.url), 'utf8');
const deploy = fs.readFileSync(new URL('../scripts/deploy-production.sh', import.meta.url), 'utf8');
const tenantMigration = fs.readFileSync(new URL('../scripts/migrate-tenant-landlord.js', import.meta.url), 'utf8');

test('automatic migration suite contains the required commands in dependency order', () => {
  assert.deepEqual(
    AUTOMATIC_MIGRATION_STEPS.map((step) => step.command),
    [
      'db:check',
      'db:repair-field-data-index',
      'db:repair-surveyor-index',
      'db:repair-user-phone-index',
      'db:repair-legacy-objectids',
      'migrate:auth-identifiers',
      'migrate:tenant-landlord',
      'migrate:surveyor-subscription',
      'migrate:document-vault',
      'migrate:advanced-rental',
      'migrate:rental-units',
      'migrate:open-sans',
      'db:indexes',
    ],
  );
});

test('automatic migration feature is enabled by default and validates explicit values', () => {
  assert.equal(automaticMigrationsEnabled(undefined), true);
  assert.equal(automaticMigrationsEnabled('true'), true);
  assert.equal(automaticMigrationsEnabled('0'), false);
  assert.throws(() => automaticMigrationsEnabled('sometimes'), /must be true or false/);
});

test('migration fingerprint is deterministic and content-addressed', async () => {
  const first = await computeMigrationFingerprint();
  const second = await computeMigrationFingerprint();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
});

test('all production entry points pass through the migration gate', () => {
  assert.match(packageJson.scripts.start, /start-after-migrations\.js server\/src\/server\.js/);
  assert.match(packageJson.scripts['start:production'], /start-after-migrations\.js server\/src\/server\.js/);
  assert.equal(packageJson.scripts['db:auto-migrate'], 'node scripts/run-automatic-migrations.js');
  assert.equal((ecosystem.match(/script: 'scripts\/start-after-migrations\.js'/g) || []).length, 5);
  assert.match(ecosystem, /name: 'secureasset-backup-automation'/);
  assert.match(deploy, /npm run db:auto-migrate/);
  assert.match(deploy, /npm run audit:production/);
  assert.match(packageJson.scripts['audit:production'], /audit-production-dependencies\.js/);
});


test('tenant migration restores active subscriptions using the correct expiry field', () => {
  assert.match(tenantMigration, /expiresAt: mongoose\.trusted\(\{ \$gt: now \}\)/);
  assert.doesNotMatch(tenantMigration, /^\s*esAt:/m);
});
