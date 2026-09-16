import crypto from 'crypto';
import path from 'node:path';
import fs from 'fs/promises';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { AuditLog } from '../models/index.js';
import { env } from '../config/env.js';

const allowed = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/gif', '.gif'],
]);
function validImage(buffer, mime) {
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  if (mime === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString());
  return false;
}

async function persistImage(req, subdirectory = '') {
  if (!req.file) throw new ApiError(422, 'Choose an image to upload');
  const ext = allowed.get(req.file.mimetype);
  if (!ext || !validImage(req.file.buffer, req.file.mimetype)) throw new ApiError(422, 'Unsupported or invalid image');
  const directory = path.join(env.CMS_ASSET_DIR, subdirectory);
  await fs.mkdir(directory, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
  await fs.writeFile(path.join(directory, filename), req.file.buffer, { flag: 'wx', mode: 0o640 });
  const relative = [subdirectory, filename].filter(Boolean).join('/');
  return { url: `/site-assets/${relative}`, filename, mimeType: req.file.mimetype, size: req.file.size };
}

export const uploadSiteAsset = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Administrator access required');
  const uploaded = await persistImage(req);
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'upload', module: 'site-assets', updatedValue: uploaded, ip: req.ip, device: req.get('user-agent') });
  res.status(201).json({ success: true, data: uploaded });
});

export const uploadProfileAvatar = asyncHandler(async (req, res) => {
  const previousAvatar = req.user.avatar || null;
  const uploaded = await persistImage(req, 'avatars');
  req.user.avatar = uploaded.url;
  await req.user.save({ validateModifiedOnly: true });
  await AuditLog.create({
    user: req.user._id, role: req.user.role, action: 'profile:avatar-updated', module: 'auth', recordId: req.user._id,
    previousValue: { avatar: previousAvatar }, updatedValue: { avatar: uploaded.url, mimeType: uploaded.mimeType, size: uploaded.size },
    ip: req.ip, device: req.get('user-agent'),
  });
  res.status(201).json({ success: true, data: uploaded, message: 'Profile photo updated' });
});
