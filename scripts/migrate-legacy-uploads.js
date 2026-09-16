import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { env } from '../server/src/config/env.js';
import { Document, DriveFile, DriveFileVersion } from '../server/src/models/index.js';
import { buildStorageKey, saveFile } from '../server/src/services/storage.js';
import { categoryFromMime, changeUsage, fileExtension } from '../server/src/services/driveService.js';

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256'); const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk)); stream.on('end', () => resolve(hash.digest('hex'))); stream.on('error', reject);
  });
}
function safeLegacyPath(url) {
  const name = path.basename(String(url || ''));
  if (!name || name === '.' || name === '/') return null;
  return path.resolve(env.UPLOAD_DIR, name);
}

try {
  await connectDatabase();
  const cursor = Document.find({ driveFile: { $exists: false }, url: /^\/uploads\// }).cursor();
  let migrated = 0; let missing = 0; let failed = 0;
  for await (const record of cursor) {
    const source = safeLegacyPath(record.url);
    try {
      if (!source) { missing += 1; continue; }
      const stat = await fsp.stat(source).catch(() => null);
      if (!stat?.isFile()) { missing += 1; continue; }
      const extension = fileExtension(record.name || source);
      const mimeType = record.mimeType || 'application/octet-stream';
      const checksum = record.checksum || await hashFile(source);
      const category = categoryFromMime(mimeType, extension);
      const staging = path.resolve(env.VAULT_TEMP_DIR, `legacy-${crypto.randomUUID()}${extension}`);
      await fsp.mkdir(env.VAULT_TEMP_DIR, { recursive: true, mode: 0o700 });
      await fsp.copyFile(source, staging);
      const key = buildStorageKey(record.owner, record.name || path.basename(source), 'legacy-documents');
      const stored = await saveFile(staging, key, mimeType);
      const file = await DriveFile.create({
        owner: record.owner, name: record.name, originalName: record.name, extension, mimeType, category,
        storageDriver: stored.driver, storageKey: stored.key, sizeBytes: stat.size, checksum,
        visibility: record.visibility === 'public' ? 'public' : 'private', confidentiality: category === 'legal' ? 'legal_record' : 'private',
        relations: { property: record.property || undefined }, preview: { status: ['image','video','audio','document'].includes(category) ? 'ready' : 'unsupported' },
        createdBy: record.uploadedBy || record.owner,
      });
      await DriveFileVersion.create({ file: file._id, owner: record.owner, version: 1, storageDriver: stored.driver, storageKey: stored.key, sizeBytes: stat.size, checksum, mimeType, uploadedBy: record.uploadedBy || record.owner });
      await changeUsage(record.owner, stat.size, category);
      record.driveFile = file._id; record.url = `/api/v1/drive/files/${file._id}/content`; record.sizeBytes = stat.size; record.checksum = checksum;
      await record.save({ validateModifiedOnly: true });
      await fsp.unlink(source).catch(() => {});
      migrated += 1;
    } catch (error) {
      failed += 1; console.error(`Could not migrate document ${record._id}:`, error.message);
    }
  }
  console.log('Legacy upload migration complete:', { migrated, missing, failed });
  if (failed) process.exitCode = 1;
} catch (error) {
  console.error('Legacy upload migration failed:', error); process.exitCode = 1;
} finally { await disconnectDatabase().catch(() => {}); }
