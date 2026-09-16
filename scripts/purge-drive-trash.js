import fs from 'fs/promises';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import {
  DriveFile, DriveFolder, DriveFileVersion, DriveShare, DriveComment, DriveActivity, DriveUsage, DriveUploadSession,
} from '../server/src/models/index.js';
import { deleteObject, tempUploadPath } from '../server/src/services/storage.js';

const now = new Date();
let filesPurged = 0;
let foldersPurged = 0;
let bytesPurged = 0;

async function purgeFile(file) {
  if (file.immutable || file.approval?.status === 'final') return false;
  const versions = await DriveFileVersion.find({ file: file._id }).select('+storageKey');
  for (const version of versions) await deleteObject(version.storageDriver, version.storageKey);
  const bytes = versions.reduce((sum, version) => sum + Number(version.sizeBytes || 0), 0);
  await Promise.all([
    DriveFileVersion.deleteMany({ file: file._id }),
    DriveShare.deleteMany({ itemType: 'file', itemId: file._id }),
    DriveComment.deleteMany({ file: file._id }),
  ]);
  await DriveFile.deleteOne({ _id: file._id });
  await DriveUsage.updateOne({ user: file.owner }, { $inc: { usedBytes: -bytes, trashBytes: -bytes } });
  await DriveActivity.create({ owner: file.owner, itemType: 'system', itemId: file._id, action: 'retention_purge_completed', metadata: { fileName: file.name, bytes } });
  filesPurged += 1; bytesPurged += bytes;
  return true;
}

try {
  await connectDatabase();
  const expiredFiles = await DriveFile.find({ status: 'trashed', purgeAt: { $lte: now }, immutable: { $ne: true }, 'approval.status': { $ne: 'final' } });
  for (const file of expiredFiles) await purgeFile(file);

  const expiredFolders = (await DriveFolder.find({ status: 'trashed', purgeAt: { $lte: now }, systemKey: null })).sort((a, b) => (b.ancestors?.length || 0) - (a.ancestors?.length || 0));
  for (const folder of expiredFolders) {
    const retainedFiles = await DriveFile.exists({ folder: folder._id });
    const retainedFolders = await DriveFolder.exists({ parent: folder._id });
    if (!retainedFiles && !retainedFolders) {
      await DriveShare.deleteMany({ itemType: 'folder', itemId: folder._id });
      await DriveFolder.deleteOne({ _id: folder._id });
      foldersPurged += 1;
    }
  }

  const expiredSessions = await DriveUploadSession.find({ expiresAt: { $lte: now } }).select('_id');
  for (const session of expiredSessions) {
    await fs.rm(path.dirname(tempUploadPath(session._id, 0)), { recursive: true, force: true }).catch(() => {});
  }
  await DriveUploadSession.deleteMany({ expiresAt: { $lte: now } });

  console.log(JSON.stringify({ success: true, filesPurged, foldersPurged, bytesPurged, expiredUploadSessions: expiredSessions.length, completedAt: new Date().toISOString() }));
} catch (error) {
  console.error('Drive retention worker failed:', error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
