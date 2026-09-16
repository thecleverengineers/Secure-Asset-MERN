import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { markRestoreResult, materializeRestore } from '../server/src/services/backupRecovery.js';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || '') : '';
}

const command = String(process.argv[2] || '');
const backupNumber = argument('--backup-id');

try {
  if (!['prepare-restore', 'complete-restore', 'fail-restore'].includes(command)) {
    throw new Error('Usage: backup-recovery-cli.js prepare-restore|complete-restore|fail-restore --backup-id <SAB-...>');
  }
  if (!backupNumber) throw new Error('--backup-id is required');
  await connectDatabase();
  if (command === 'prepare-restore') {
    const result = await materializeRestore({
      backupNumber,
      token: argument('--restore-token'),
      stageDirectory: argument('--stage-dir'),
      consume: argument('--consume') === 'true',
    });
    console.log(JSON.stringify({ backupNumber: result.backup.backupNumber, stageDirectory: result.stageDirectory, manifest: result.manifest }));
  } else {
    const result = await markRestoreResult(backupNumber, { success: command === 'complete-restore', error: argument('--error') });
    console.log(JSON.stringify({ backupNumber, status: result?.restore?.status || 'not-found' }));
  }
} catch (error) {
  console.error(`Backup recovery command failed: ${error?.message || error}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
