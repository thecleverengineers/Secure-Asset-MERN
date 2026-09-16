import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { queueSystemBackup, runQueuedSystemBackup } from '../server/src/services/backupRecovery.js';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || '') : '';
}

const backupNumber = argument('--backup');
const trigger = argument('--trigger') || 'manual';
const label = argument('--label') || '';

try {
  await connectDatabase();
  let queuedNumber = backupNumber;
  if (!queuedNumber) {
    const backup = await queueSystemBackup({ trigger, label });
    queuedNumber = backup.backupNumber;
  }
  const result = await runQueuedSystemBackup(queuedNumber);
  console.log(JSON.stringify({ service: 'secureasset-backup', backupNumber: queuedNumber, ...result }));
  if (!result.completed && !result.started) process.exitCode = 2;
} catch (error) {
  console.error(`Encrypted backup failed: ${error?.message || error}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
