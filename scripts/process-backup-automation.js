import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { AuditLog } from '../server/src/models/index.js';
import { queueScheduledSystemBackup, runQueuedSystemBackup } from '../server/src/services/backupRecovery.js';

try {
  await connectDatabase();
  const queued = await queueScheduledSystemBackup();
  const result = await runQueuedSystemBackup(queued.backupNumber);
  await AuditLog.create({
    role: 'system',
    action: 'backup:scheduled-run',
    module: 'backup-recovery',
    recordId: queued._id,
    updatedValue: { backupNumber: queued.backupNumber, started: Boolean(result.started), completed: Boolean(result.completed), reason: result.reason || undefined },
  });
  console.log(JSON.stringify({ service: 'secureasset-backup-automation', backupNumber: queued.backupNumber, ...result }));
  if (!result.completed && !result.started) process.exitCode = 2;
} catch (error) {
  console.error(`Scheduled encrypted backup failed: ${error?.message || error}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
