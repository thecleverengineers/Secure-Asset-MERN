import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { verifyMongoCompatibility } from './lib/database-health.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const LOCK_ID = 'automatic-database-migrations-lock';
const SUITE_VERSION = '2026-09-10.7';

export const AUTOMATIC_MIGRATION_STEPS = Object.freeze([
  { name: 'database-check', command: 'db:check', file: 'scripts/check-mongodb.js' },
  { name: 'field-data-index', command: 'db:repair-field-data-index', file: 'scripts/repair-field-data-index.js' },
  { name: 'surveyor-subscription-index', command: 'db:repair-surveyor-index', file: 'scripts/repair-surveyor-subscription-index.js' },
  { name: 'user-phone-index', command: 'db:repair-user-phone-index', file: 'scripts/repair-user-phone-index.js' },
  { name: 'legacy-objectid-placeholders', command: 'db:repair-legacy-objectids', file: 'scripts/repair-legacy-objectid-placeholders.js' },
  { name: 'auth-identifiers', command: 'migrate:auth-identifiers', file: 'scripts/migrate-auth-identifiers.js' },
  { name: 'tenant-landlord', command: 'migrate:tenant-landlord', file: 'scripts/migrate-tenant-landlord.js' },
  { name: 'surveyor-subscription', command: 'migrate:surveyor-subscription', file: 'scripts/migrate-surveyor-subscription.js' },
  { name: 'document-vault', command: 'migrate:document-vault', file: 'scripts/migrate-document-vault.js' },
  { name: 'advanced-rental', command: 'migrate:advanced-rental', file: 'scripts/migrate-advanced-rental.js' },
  { name: 'rental-units-v168', command: 'migrate:rental-units', file: 'scripts/migrate-rental-units-v168.js' },
  { name: 'global-open-sans', command: 'migrate:open-sans', file: 'scripts/migrate-open-sans-global.js' },
  { name: 'production-indexes', command: 'db:indexes', file: 'scripts/create-production-indexes.js' },
]);

const RESUMABLE_COMMANDS = new Set(AUTOMATIC_MIGRATION_STEPS.filter((step) => step.command.startsWith('migrate:')).map((step) => step.command));

function positiveInteger(name, fallback, { min = 1000, max = 86_400_000 } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function automaticMigrationsEnabled(value = process.env.AUTO_DB_MIGRATIONS) {
  if (value === undefined || value === '') return true;
  const normalised = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalised)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalised)) return false;
  throw new Error('AUTO_DB_MIGRATIONS must be true or false.');
}

async function listJavaScriptFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listJavaScriptFiles(target));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(target);
  }
  return files;
}

export async function computeMigrationFingerprint() {
  const hash = crypto.createHash('sha256');
  hash.update(`secureasset-auto-migrations:${SUITE_VERSION}\n`);
  const dependencies = [
    ...AUTOMATIC_MIGRATION_STEPS.map((step) => path.join(APP_DIR, step.file)),
    path.join(APP_DIR, 'scripts/lib/indexes.js'),
    path.join(APP_DIR, 'server/src/services/landlordSubscription.js'),
    path.join(APP_DIR, 'server/src/services/surveyorSubscription.js'),
    path.join(APP_DIR, 'server/src/services/driveService.js'),
    ...await listJavaScriptFiles(path.join(APP_DIR, 'server/src/models')),
  ];
  for (const filename of [...new Set(dependencies)].sort()) {
    const relative = path.relative(APP_DIR, filename);
    hash.update(`${relative}\n`);
    hash.update(await fs.readFile(filename));
  }
  return hash.digest('hex');
}

function migrationRecordId(fingerprint) {
  return `automatic-database-migrations:${fingerprint}`;
}

async function runNodeScript(step, { logger }) {
  logger.log(`\n==> Automatically running npm script equivalent: ${step.command}`);
  const child = spawn(process.execPath, [path.join(APP_DIR, step.file)], {
    cwd: APP_DIR,
    env: process.env,
    stdio: 'inherit',
  });

  const forwardSignal = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.once('SIGTERM', forwardSignal);
  process.once('SIGINT', forwardSignal);

  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    if (result.code !== 0) {
      throw new Error(`${step.command} failed${result.signal ? ` after ${result.signal}` : ''} with exit code ${result.code ?? 'unknown'}.`);
    }
  } finally {
    process.removeListener('SIGTERM', forwardSignal);
    process.removeListener('SIGINT', forwardSignal);
  }
}

async function tryAcquireLock(collection, { ownerId, fingerprint, lockTtlMs }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + lockTtlMs);
  try {
    const result = await collection.findOneAndUpdate(
      {
        _id: LOCK_ID,
        $or: [
          { status: { $ne: 'running' } },
          { expiresAt: { $lte: now } },
          { ownerId },
        ],
      },
      {
        $set: {
          status: 'running', ownerId, fingerprint, suiteVersion: SUITE_VERSION,
          startedAt: now, heartbeatAt: now, expiresAt, currentStep: 'db:check', error: null,
        },
        $inc: { attempt: 1 },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return result;
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
}

async function waitForMigrationTurn(collection, { ownerId, fingerprint, lockTtlMs, waitTimeoutMs, pollMs, logger, ignoreCompleted = false }) {
  const deadline = Date.now() + waitTimeoutMs;
  const recordId = migrationRecordId(fingerprint);

  while (Date.now() < deadline) {
    const now = new Date();
    const activeLock = await collection.findOne({
      _id: LOCK_ID,
      status: 'running',
      expiresAt: { $gt: now },
      ownerId: { $ne: ownerId },
    });
    if (activeLock) {
      const current = activeLock.currentStep ? ` (${activeLock.currentStep})` : '';
      logger.log(`Another process is applying database migrations${current}; waiting...`);
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }

    if (!ignoreCompleted) {
      const completed = await collection.findOne({ _id: recordId, status: 'completed' });
      if (completed) return { completed: true, lock: null };
    }

    const lock = await tryAcquireLock(collection, { ownerId, fingerprint, lockTtlMs });
    if (lock?.ownerId === ownerId) return { completed: false, lock };
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Timed out after ${waitTimeoutMs}ms while waiting for automatic database migrations.`);
}

export async function runAutomaticMigrations({ logger = console, force = false } = {}) {
  if (!automaticMigrationsEnabled()) {
    logger.warn('Automatic database migrations are disabled by AUTO_DB_MIGRATIONS=false.');
    return { status: 'disabled' };
  }

  const lockTtlMs = positiveInteger('AUTO_DB_MIGRATION_LOCK_TTL_MS', 20 * 60 * 1000, { min: 60_000 });
  const waitTimeoutMs = positiveInteger('AUTO_DB_MIGRATION_WAIT_MS', 30 * 60 * 1000, { min: 10_000 });
  const pollMs = positiveInteger('AUTO_DB_MIGRATION_POLL_MS', 3_000, { min: 500, max: 60_000 });
  const ownerId = `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;
  const fingerprint = await computeMigrationFingerprint();
  const recordId = migrationRecordId(fingerprint);
  let collection;
  let heartbeat;
  let ownsLock = false;

  try {
    await connectDatabase();
    await verifyMongoCompatibility(mongoose.connection, { logger });
    collection = mongoose.connection.db.collection('system_migrations');

    const forceRun = force || process.env.FORCE_AUTO_DB_MIGRATIONS === 'true';
    if (!forceRun) {
      const completed = await collection.findOne({ _id: recordId, status: 'completed' });
      if (completed) {
        logger.log(`Automatic database migrations already applied for fingerprint ${fingerprint.slice(0, 12)}.`);
        return { status: 'already-applied', fingerprint };
      }
    }

    const turn = await waitForMigrationTurn(collection, {
      ownerId, fingerprint, lockTtlMs, waitTimeoutMs, pollMs, logger, ignoreCompleted: forceRun,
    });
    if (turn.completed) {
      logger.log(`Automatic database migrations were completed by another process for fingerprint ${fingerprint.slice(0, 12)}.`);
      return { status: 'already-applied', fingerprint };
    }
    ownsLock = true;

    heartbeat = setInterval(() => {
      const now = new Date();
      void collection.updateOne(
        { _id: LOCK_ID, ownerId, status: 'running' },
        { $set: { heartbeatAt: now, expiresAt: new Date(now.getTime() + lockTtlMs) } },
      ).catch((error) => logger.error('Automatic migration lock heartbeat failed:', error));
    }, Math.min(30_000, Math.max(5_000, Math.floor(lockTtlMs / 4))));
    heartbeat.unref();

    const startedAt = new Date();
    const previousRecord = await collection.findOne({ _id: recordId });
    const previousCompleted = new Map((previousRecord?.steps || []).filter((step) => step?.status === 'completed').map((step) => [step.command, step]));
    const completedSteps = [];
    await collection.updateOne(
      { _id: recordId },
      { $set: { status: 'running', fingerprint, suiteVersion: SUITE_VERSION, ownerId, startedAt, updatedAt: startedAt, steps: [], error: null } },
      { upsert: true },
    );

    for (const step of AUTOMATIC_MIGRATION_STEPS) {
      if (!forceRun && RESUMABLE_COMMANDS.has(step.command) && previousCompleted.has(step.command)) {
        const resumed = { ...previousCompleted.get(step.command), resumedAt: new Date(), status: 'completed' };
        completedSteps.push(resumed);
        logger.log(`\n==> Resuming after previous failure; already completed: ${step.command}`);
        await collection.updateOne({ _id: recordId }, { $set: { updatedAt: new Date(), steps: completedSteps } });
        continue;
      }
      const stepStartedAt = new Date();
      await collection.updateOne(
        { _id: LOCK_ID, ownerId },
        { $set: { currentStep: step.command, heartbeatAt: stepStartedAt, expiresAt: new Date(stepStartedAt.getTime() + lockTtlMs) } },
      );
      await runNodeScript(step, { logger });
      const stepResult = { name: step.name, command: step.command, startedAt: stepStartedAt, completedAt: new Date(), status: 'completed' };
      completedSteps.push(stepResult);
      await collection.updateOne(
        { _id: recordId },
        { $set: { updatedAt: new Date(), steps: completedSteps } },
      );
    }

    const completedAt = new Date();
    await collection.updateOne(
      { _id: recordId },
      { $set: { status: 'completed', completedAt, updatedAt: completedAt, steps: completedSteps, error: null } },
      { upsert: true },
    );
    await collection.updateOne(
      { _id: LOCK_ID, ownerId },
      { $set: { status: 'completed', currentStep: null, completedAt, heartbeatAt: completedAt, expiresAt: completedAt } },
    );
    logger.log(`Automatic database migrations completed successfully (${fingerprint.slice(0, 12)}).`);
    return { status: 'completed', fingerprint, steps: completedSteps.map((step) => step.command) };
  } catch (error) {
    const failedAt = new Date();
    if (collection) {
      await collection.updateOne(
        { _id: recordId },
        { $set: { status: 'failed', failedAt, updatedAt: failedAt, ownerId, error: String(error?.stack || error?.message || error).slice(0, 16_000) } },
        { upsert: true },
      ).catch(() => {});
      if (ownsLock) {
        await collection.updateOne(
          { _id: LOCK_ID, ownerId },
          { $set: { status: 'failed', failedAt, heartbeatAt: failedAt, expiresAt: failedAt, error: String(error?.message || error).slice(0, 2_000) } },
        ).catch(() => {});
      }
    }
    throw error;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await disconnectDatabase().catch(() => {});
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  runAutomaticMigrations({ force: process.argv.includes('--force') })
    .catch((error) => {
      console.error('Automatic database migration failed. Application startup has been stopped.');
      console.error(error?.stack || error);
      process.exitCode = 1;
    });
}
