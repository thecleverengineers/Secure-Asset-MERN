import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { ZipArchive } from 'archiver';
import PDFDocument from 'pdfkit';
import { fileTypeFromFile } from 'file-type';
import {
  User, DriveFolder, DriveFile, DriveFileVersion, DriveShare, DriveActivity, DriveComment,
  DriveUsage, DriveUploadSession, DriveContentReport, DrivePolicy,
} from '../models/index.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  ensurePersonalDrive, createLegalTemplateFolders, getStorageQuota, getUsage, assertStorageAvailable, changeUsage,
  recalculateUsage, categoryFromMime, resolveFolderAncestors, resolveItemAccess, createPublicToken,
  logDriveActivity, purgeDate, fileExtension, SENSITIVE_CONFIDENTIALITY, getDrivePolicy, getSmartDocumentFolders,
  smartDocumentFolderDefaults,
} from '../services/driveService.js';
import { buildStorageKey, saveFile, saveBuffer, createReadStream, readBuffer, deleteObject, tempUploadPath } from '../services/storage.js';
import { sendStoredFile } from '../utils/httpFile.js';

const ALLOWED_EXTENSIONS = new Set(env.VAULT_ALLOWED_EXTENSIONS.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
const permissionCapabilities = {
  viewer: { view: true, preview: true },
  commenter: { view: true, preview: true, comment: true },
  downloader: { view: true, preview: true, download: true },
  uploader: { view: true, preview: true, upload: true },
  editor: { view: true, preview: true, download: true, comment: true, upload: true, editMetadata: true, rename: true, move: true },
  manager: { view: true, preview: true, download: true, comment: true, upload: true, editMetadata: true, rename: true, move: true, delete: true, reshare: true },
  co_owner: { view: true, preview: true, download: true, comment: true, upload: true, editMetadata: true, rename: true, move: true, delete: true, reshare: true, managePermissions: true },
};

function serialize(item) {
  const obj = item?.toJSON ? item.toJSON() : { ...item };
  if (obj.publicLink) {
    delete obj.publicLink.tokenHash;
    delete obj.publicLink.passwordHash;
    obj.publicLink.passwordProtected = Boolean(item?.publicLink?.passwordHash);
  }
  return obj;
}
function boolean(value, fallback = false) { return value === undefined ? fallback : ['true', '1', true, 1].includes(value); }
function safeName(value = '') { return String(value).replace(/[\\/:*?"<>|\0]/g, '_').trim().slice(0, 255) || 'Untitled'; }
function isSensitive(file) { return Boolean(file?.sensitive) || SENSITIVE_CONFIDENTIALITY.has(file?.confidentiality) || file?.category === 'legal'; }
async function totalStoredBytes(fileId) { const rows = await DriveFileVersion.aggregate([{ $match: { file: fileId } }, { $group: { _id: null, total: { $sum: '$sizeBytes' } } }]); return rows[0]?.total || 0; }
function parseLegalMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { throw new ApiError(422, 'Invalid document metadata'); }
}
function serializeSmartDocumentGroup(group) {
  const root = group.folder ? serialize(group.folder) : {};
  return {
    ...root,
    key: group.key,
    quickAccessKey: group.key,
    name: root.name || group.name,
    description: root.description || group.description,
    icon: group.icon,
    color: group.color,
    fileCount: group.fileCount || 0,
    documentTypes: group.documentTypes,
    children: group.children.map((child) => ({
      ...(child.folder ? serialize(child.folder) : {}),
      key: child.key,
      name: child.folder?.name || child.name,
      documentType: child.name,
      systemKey: child.systemKey,
      fileCount: child.fileCount || 0,
    })),
  };
}
function serializeSmartDocumentShortcut(shortcut) {
  const folder = shortcut.folder ? serialize(shortcut.folder) : {};
  return {
    ...folder,
    key: shortcut.key,
    quickAccessKey: shortcut.key,
    systemKey: shortcut.systemKey,
    name: shortcut.name,
    description: shortcut.description,
    eyebrow: shortcut.eyebrow,
    icon: shortcut.icon,
    color: shortcut.color,
    documentType: shortcut.documentType,
    fileCount: shortcut.fileCount || 0,
  };
}

async function scanUpload(file) {
  const extension = fileExtension(file.originalname);
  const policy = await getDrivePolicy(); const allowedExtensions = new Set((policy.allowedExtensions?.length ? policy.allowedExtensions : [...ALLOWED_EXTENSIONS]).map((x) => x.toLowerCase()));
  if (Number(file.size || 0) > Number(policy.maxFileMb || env.VAULT_MAX_FILE_MB) * 1024 ** 2) throw new ApiError(413, `File exceeds the ${policy.maxFileMb || env.VAULT_MAX_FILE_MB} MB platform limit`);
  if (!allowedExtensions.has(extension)) throw new ApiError(415, `Files with ${extension || 'no extension'} are not allowed`);
  const handle = await fsp.open(file.path, 'r');
  const head = Buffer.alloc(Math.min(Number(file.size), 8192));
  await handle.read(head, 0, head.length, 0); await handle.close();
  const text = head.toString('utf8');
  if (text.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) throw new ApiError(422, 'Malware test signature detected');
  if (head[0] === 0x4d && head[1] === 0x5a) throw new ApiError(422, 'Executable content is not allowed');
  const detected = await fileTypeFromFile(file.path).catch(() => null);
  if (detected && detected.ext && extension && detected.ext !== extension.slice(1) && !(['jpg', 'jpeg'].includes(detected.ext) && ['.jpg', '.jpeg'].includes(extension))) {
    const documentExtensions = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.rtf']);
    if (!documentExtensions.has(extension)) throw new ApiError(422, 'File content does not match its extension');
  }
  // External malware scanning is intentionally disabled for production uploads.
  // Uploads still pass platform validation: extension allow-list, size limit, executable guard,
  // EICAR test-signature guard, and content-vs-extension checks where detection is available.
  return detected?.mime || file.mimetype || 'application/octet-stream';
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256'); const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk)); stream.on('end', () => resolve(hash.digest('hex'))); stream.on('error', reject);
  });
}

export const bootstrapDrive = asyncHandler(async (req, res) => {
  const folders = await ensurePersonalDrive(req.user._id);
  const [quotaBytes, usage, smartGroups] = await Promise.all([getStorageQuota(req.user), getUsage(req.user._id), getSmartDocumentFolders(req.user._id)]);
  const recent = await DriveFile.find({ owner: req.user._id, status: 'active' }).sort({ updatedAt: -1 }).limit(10).lean();
  const starred = await DriveFile.find({ owner: req.user._id, status: 'active', starred: true }).sort({ updatedAt: -1 }).limit(10).lean();
  res.json({ success: true, data: { folders: folders.map(serialize), quickAccess: smartGroups.map(serializeSmartDocumentGroup), quickAccessDocuments: smartGroups.flatMap((group) => group.pinnedQuickAccess || []).map(serializeSmartDocumentShortcut), quotaBytes, usage, recent, starred, warningLevel: usage.usedBytes >= quotaBytes ? 100 : usage.usedBytes / quotaBytes >= .9 ? 90 : usage.usedBytes / quotaBytes >= .75 ? 75 : 0 } });
});

export const createTemplates = asyncHandler(async (req, res) => {
  const root = await createLegalTemplateFolders(req.user);
  res.status(201).json({ success: true, data: root, message: 'Legal folder templates created' });
});

export const listItems = asyncHandler(async (req, res) => {
  await ensurePersonalDrive(req.user._id);
  const folderId = req.query.folderId || null;
  if (folderId) await resolveItemAccess(req.user, 'folder', folderId, 'view');
  const status = req.query.status || 'active';
  const search = String(req.query.search || '').trim();
  const visibility = req.query.visibility;
  const category = req.query.category;
  const starred = req.query.starred === 'true';
  const fileQuery = { owner: req.user._id, folder: folderId, status };
  const folderQuery = { owner: req.user._id, parent: folderId, status };
  if (search) { fileQuery.$text = { $search: search }; folderQuery.$text = { $search: search }; }
  if (visibility) { fileQuery.visibility = visibility; folderQuery.visibility = visibility; }
  if (category) { fileQuery.category = category; folderQuery.category = category; }
  if (starred) { fileQuery.starred = true; folderQuery.starred = true; }
  const [folders, files] = await Promise.all([
    DriveFolder.find(folderQuery).sort({ starred: -1, name: 1 }).lean(),
    DriveFile.find(fileQuery).sort({ starred: -1, updatedAt: -1 }).lean(),
  ]);
  res.json({ success: true, data: { folders, files } });
});

export const getBreadcrumbs = asyncHandler(async (req, res) => {
  const { item: folder } = await resolveItemAccess(req.user, 'folder', req.params.id, 'view');
  const ids = [...folder.ancestors, folder._id];
  const folders = await DriveFolder.find({ _id: { $in: ids } }).lean();
  const byId = new Map(folders.map((f) => [String(f._id), f]));
  res.json({ success: true, data: ids.map((id) => byId.get(String(id))).filter(Boolean) });
});

export const createFolder = asyncHandler(async (req, res) => {
  const parent = req.body.parent || null;
  const ancestors = await resolveFolderAncestors(req.user._id, parent);
  const name = safeName(req.body.name);
  if (await DriveFolder.exists({ owner: req.user._id, parent, name, status: { $ne: 'trashed' } })) throw new ApiError(409, 'A folder with this name already exists here');
  const folder = await DriveFolder.create({ owner: req.user._id, parent, ancestors, name, description: req.body.description || '', category: req.body.category || 'general', icon: req.body.icon || 'folder', color: req.body.color || '#0B5270', sensitive: boolean(req.body.sensitive), createdBy: req.user._id });
  await logDriveActivity(req, folder, 'folder_created');
  res.status(201).json({ success: true, data: folder });
});

export const updateFolder = asyncHandler(async (req, res) => {
  const { item: folder } = await resolveItemAccess(req.user, 'folder', req.params.id, 'edit');
  if (folder.systemKey && req.body.parent !== undefined) throw new ApiError(422, 'System folders cannot be moved');
  const allowed = ['name', 'description', 'icon', 'color', 'coverImage', 'starred', 'branding', 'inheritanceMode'];
  for (const key of allowed) if (req.body[key] !== undefined) folder[key] = key === 'name' ? safeName(req.body[key]) : req.body[key];
  if (req.body.parent !== undefined && String(req.body.parent || '') !== String(folder.parent || '')) {
    if (req.body.parent && (String(req.body.parent) === String(folder._id) || folder.ancestors.map(String).includes(String(req.body.parent)))) throw new ApiError(422, 'A folder cannot be moved into itself or its descendants');
    folder.parent = req.body.parent || null; folder.ancestors = await resolveFolderAncestors(req.user._id, folder.parent);
    const descendants = await DriveFolder.find({ owner: req.user._id, ancestors: folder._id });
    for (const child of descendants) {
      const suffixIndex = child.ancestors.map(String).indexOf(String(folder._id));
      child.ancestors = [...folder.ancestors, folder._id, ...child.ancestors.slice(suffixIndex + 1)];
      await child.save();
    }
  }
  folder.updatedBy = req.user._id; await folder.save(); await logDriveActivity(req, folder, 'folder_updated');
  res.json({ success: true, data: folder });
});

export const duplicateFolder = asyncHandler(async (req, res) => {
  const { item: source } = await resolveItemAccess(req.user, 'folder', req.params.id, 'view');
  const destination = req.body.parent || source.parent;
  const ancestors = await resolveFolderAncestors(req.user._id, destination);
  const clone = await DriveFolder.create({ owner: req.user._id, parent: destination, ancestors, name: safeName(req.body.name || `${source.name} copy`), description: source.description, icon: source.icon, color: source.color, category: source.category, createdBy: req.user._id });
  res.status(201).json({ success: true, data: clone, message: 'Folder copied. Use bulk copy for contents.' });
});

export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, 'Choose a file to upload');
  try {
    const mimeType = await scanUpload(req.file);
    await assertStorageAvailable(req.user._id, req.file.size);
    const checksum = await hashFile(req.file.path);
    const duplicate = await DriveFile.findOne({ owner: req.user._id, checksum, sizeBytes: req.file.size, status: { $ne: 'trashed' } });
    const duplicateAction = req.body.duplicateAction || 'warn';
    if (duplicate && duplicateAction === 'warn') throw new ApiError(409, 'Potential duplicate detected', { duplicateId: duplicate._id, options: ['copy', 'new_version', 'cancel'] });
    if (duplicate && duplicateAction === 'new_version') throw new ApiError(409, 'Upload this file through the version endpoint', { duplicateId: duplicate._id, versionEndpoint: `/api/v1/drive/files/${duplicate._id}/versions` });
    const folder = req.body.folder || null;
    let parent = null;
    let smart = null;
    // Uploads always enter the vault as private records. A public or
    // restricted link must be created later through the audited sharing flow;
    // accepting visibility from multipart input would allow a caller to
    // bypass that deliberate confirmation step.
    if (req.body.visibility && String(req.body.visibility).toLowerCase() !== 'private') throw new ApiError(422, 'New vault files are private by default. Create a controlled share link after upload.');
    if (folder) {
      ({ item: parent } = await resolveItemAccess(req.user, 'folder', folder, 'upload'));
      smart = smartDocumentFolderDefaults(parent);
      if (parent.visibility === 'public' && parent.inheritanceMode === 'inherit') throw new ApiError(403, 'Uploads into public folders are disabled. Use a private vault folder for new records.');
    }
    const extension = fileExtension(req.file.originalname);
    const category = smart?.category || req.body.category || categoryFromMime(mimeType, extension);
    const legalMetadata = parseLegalMetadata(req.body.legalMetadata);
    if (smart) legalMetadata.documentType = req.body.documentType || smart.documentType;
    const tags = String(req.body.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (smart) tags.push(smart.smartFolderKey);
    const storageKey = buildStorageKey(req.user._id, req.file.originalname);
    const stored = await saveFile(req.file.path, storageKey, mimeType);
    const file = await DriveFile.create({
      owner: req.user._id, folder, name: safeName(req.body.name || req.file.originalname), originalName: req.file.originalname,
      description: req.body.description || '', extension, mimeType, category, storageDriver: stored.driver, storageKey: stored.key,
      sizeBytes: req.file.size, checksum, visibility: 'private',
      smartFolderKey: smart?.smartFolderKey, documentType: smart?.documentType || req.body.documentType || legalMetadata.documentType,
      confidentiality: smart?.confidentiality || req.body.confidentiality || (category === 'legal' ? 'legal_record' : 'private'), tags,
      relations: { property: req.body.property || undefined, surveyProject: req.body.surveyProject || undefined, legalMatter: req.body.legalMatter || undefined },
      legalMetadata,
      preview: { status: ['image', 'video', 'audio', 'document'].includes(category) ? 'ready' : 'unsupported' },
      createdBy: req.user._id,
    });
    await DriveFileVersion.create({ file: file._id, owner: req.user._id, version: 1, storageDriver: stored.driver, storageKey: stored.key, sizeBytes: req.file.size, checksum, mimeType, uploadedBy: req.user._id });
    const activityAction = req.body.source === 'scan-securely' ? 'scan_to_png_created' : 'file_uploaded';
    await changeUsage(req.user._id, req.file.size, category); await logDriveActivity(req, file, activityAction, { sizeBytes: req.file.size, enhancement: req.body.enhancement || 'none', outputFormat: req.body.source === 'scan-securely' ? 'png' : undefined });
    res.status(201).json({ success: true, data: serialize(file), ...(duplicate && { duplicateOf: duplicate._id }) });
  } catch (error) { if (req.file?.path) await fsp.unlink(req.file.path).catch(() => {}); throw error; }
});

export const createScannedPdf = asyncHandler(async (req, res) => {
  const pages = Array.isArray(req.files) ? req.files : [];
  if (!pages.length) throw new ApiError(422, 'Add at least one JPG or PNG page');
  const unsupported = pages.find((file) => !['image/jpeg', 'image/png'].includes(file.mimetype));
  if (unsupported) {
    await Promise.all(pages.map((file) => fsp.unlink(file.path).catch(() => {})));
    throw new ApiError(415, 'Document scanning supports JPG and PNG pages');
  }
  const policy = await getDrivePolicy();
  const totalInputBytes = pages.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (totalInputBytes > Number(policy.maxFileMb || env.VAULT_MAX_FILE_MB) * 1024 ** 2) {
    await Promise.all(pages.map((file) => fsp.unlink(file.path).catch(() => {})));
    throw new ApiError(413, 'Scanned pages exceed the platform upload limit');
  }
  const outputName = safeName(req.body.name || `Scanned document ${new Date().toISOString().slice(0, 10)}.pdf`).replace(/\.pdf$/i, '') + '.pdf';
  const pdfPath = path.join(env.VAULT_TEMP_DIR, `${crypto.randomUUID()}.pdf`);
  try {
    await new Promise((resolve, reject) => {
      const document = new PDFDocument({ autoFirstPage: false, compress: true, info: { Title: outputName, Creator: 'SecureAsset Document Scanner' } });
      const output = fs.createWriteStream(pdfPath, { mode: 0o600 });
      output.on('finish', resolve); output.on('error', reject); document.on('error', reject); document.pipe(output);
      for (const page of pages) {
        const image = document.openImage(page.path);
        const portrait = image.height >= image.width;
        const size = portrait ? [595.28, 841.89] : [841.89, 595.28];
        document.addPage({ size, margin: 24 });
        document.image(image, 24, 24, { fit: [size[0] - 48, size[1] - 48], align: 'center', valign: 'center' });
      }
      document.end();
    });
    const stat = await fsp.stat(pdfPath);
    await scanUpload({ path: pdfPath, originalname: outputName, mimetype: 'application/pdf', size: stat.size });
    await assertStorageAvailable(req.user._id, stat.size);
    const folder = req.body.folder || null;
    let smart = null;
    if (folder) smart = smartDocumentFolderDefaults((await resolveItemAccess(req.user, 'folder', folder, 'upload')).item);
    const checksum = await hashFile(pdfPath); const storageKey = buildStorageKey(req.user._id, outputName, 'scans');
    const stored = await saveFile(pdfPath, storageKey, 'application/pdf');
    const category = smart?.category || req.body.category || (boolean(req.body.legal) ? 'legal' : 'document');
    const legalMetadata = parseLegalMetadata(req.body.legalMetadata);
    if (smart) legalMetadata.documentType = req.body.documentType || smart.documentType;
    const file = await DriveFile.create({
      owner: req.user._id, folder, name: outputName, originalName: outputName, extension: '.pdf', mimeType: 'application/pdf',
      category, storageDriver: stored.driver, storageKey: stored.key, sizeBytes: stat.size, checksum, visibility: 'private',
      smartFolderKey: smart?.smartFolderKey, documentType: smart?.documentType || req.body.documentType || legalMetadata.documentType,
      confidentiality: smart?.confidentiality || (category === 'legal' ? 'legal_record' : 'private'), tags: ['scanned', ...(smart ? [smart.smartFolderKey] : [])], preview: { status: 'ready', pageCount: pages.length },
      legalMetadata, createdBy: req.user._id,
    });
    await DriveFileVersion.create({ file: file._id, owner: req.user._id, version: 1, storageDriver: stored.driver, storageKey: stored.key, sizeBytes: stat.size, checksum, mimeType: 'application/pdf', uploadedBy: req.user._id });
    await changeUsage(req.user._id, stat.size, category); await logDriveActivity(req, file, 'scan_to_pdf_created', { pages: pages.length, enhancement: req.body.enhancement || 'none' });
    res.status(201).json({ success: true, data: serialize(file) });
  } finally {
    await Promise.all(pages.map((file) => fsp.unlink(file.path).catch(() => {})));
    await fsp.unlink(pdfPath).catch(() => {});
  }
});

export const createGeneratedDocument = asyncHandler(async (req, res) => {
  const content = req.body.contentBase64
    ? Buffer.from(String(req.body.contentBase64), 'base64')
    : Buffer.from(String(req.body.content || ''), 'utf8');
  if (!content.length) throw new ApiError(422, 'Generated document content is required');
  const policy = await getDrivePolicy();
  if (content.length > Number(policy.maxFileMb || env.VAULT_MAX_FILE_MB) * 1024 ** 2) throw new ApiError(413, 'Generated document exceeds the platform file limit');
  await assertStorageAvailable(req.user._id, content.length);
  const folder = req.body.folder || null;
  let smart = null;
  if (folder) smart = smartDocumentFolderDefaults((await resolveItemAccess(req.user, 'folder', folder, 'upload')).item);
  const requestedName = safeName(req.body.name || 'Generated document.txt');
  const extension = fileExtension(requestedName) || '.txt';
  const mimeType = req.body.mimeType || (extension === '.pdf' ? 'application/pdf' : 'text/plain');
  const allowedExtensions = new Set((policy.allowedExtensions?.length ? policy.allowedExtensions : [...ALLOWED_EXTENSIONS]).map((value) => String(value).toLowerCase()));
  if (!allowedExtensions.has(extension)) throw new ApiError(415, `Generated ${extension} files are not allowed`);
  const checksum = crypto.createHash('sha256').update(content).digest('hex');
  const storageKey = buildStorageKey(req.user._id, requestedName, 'generated');
  const stored = await saveBuffer(content, storageKey, mimeType);
  const category = smart?.category || req.body.category || categoryFromMime(mimeType, extension);
  const file = await DriveFile.create({
    owner: req.user._id, folder, name: requestedName, originalName: requestedName, description: req.body.description || '',
    extension, mimeType, category, storageDriver: stored.driver, storageKey: stored.key, sizeBytes: content.length, checksum,
    visibility: 'private', smartFolderKey: smart?.smartFolderKey, documentType: smart?.documentType || req.body.documentType,
    confidentiality: smart?.confidentiality || req.body.confidentiality || (category === 'legal' ? 'legal_record' : 'private'),
    tags: [...(Array.isArray(req.body.tags) ? req.body.tags : []), ...(smart ? [smart.smartFolderKey] : [])], relations: req.body.relations || {}, legalMetadata: { ...parseLegalMetadata(req.body.legalMetadata), ...(smart ? { documentType: smart.documentType } : {}) },
    preview: { status: ['text/plain', 'application/pdf'].includes(mimeType) ? 'ready' : 'unsupported' }, createdBy: req.user._id,
  });
  await DriveFileVersion.create({ file: file._id, owner: req.user._id, version: 1, storageDriver: stored.driver, storageKey: stored.key, sizeBytes: content.length, checksum, mimeType, uploadedBy: req.user._id });
  await changeUsage(req.user._id, content.length, category);
  await logDriveActivity(req, file, 'generated_document_saved', { source: req.body.source || 'platform' });
  res.status(201).json({ success: true, data: serialize(file) });
});

export const getFile = asyncHandler(async (req, res) => {
  const { item: file, permission } = await resolveItemAccess(req.user, 'file', req.params.id, 'view');
  const versions = await DriveFileVersion.find({ file: file._id }).sort({ version: -1 }).select('-storageKey').lean();
  const shares = String(file.owner) === String(req.user._id) ? await DriveShare.find({ itemType: 'file', itemId: file._id, revokedAt: null }).populate('granteeUser', 'name email avatar').lean() : [];
  await logDriveActivity(req, file, 'file_viewed');
  res.json({ success: true, data: { file: serialize(file), versions, shares, permission } });
});

export const streamFile = asyncHandler(async (req, res) => {
  const { item: file } = await resolveItemAccess(req.user, 'file', req.params.id, req.query.download === 'true' ? 'download' : 'preview', true);
  if (file.status === 'quarantined') throw new ApiError(423, 'This file is quarantined');
  await sendStoredFile(req, res, file, { download: req.query.download === 'true' });
  await logDriveActivity(req, file, req.query.download === 'true' ? 'file_downloaded' : 'file_previewed');
});

export const updateFile = asyncHandler(async (req, res) => {
  const { item: file } = await resolveItemAccess(req.user, 'file', req.params.id, 'edit');
  if (file.immutable && ['name', 'folder'].some((key) => req.body[key] !== undefined)) throw new ApiError(423, 'Finalised legal records cannot be modified');
  const allowed = ['name', 'description', 'starred', 'tags', 'internalNotes', 'expiresAt', 'reminderAt', 'confidentiality', 'legalMetadata', 'relations', 'locked'];
  for (const key of allowed) { if (req.body[key] === undefined) continue; if (key === 'locked' && file.immutable && req.body[key] === false) throw new ApiError(423, 'Finalised records cannot be unlocked'); file[key] = key === 'name' ? safeName(req.body[key]) : req.body[key]; }
  if (req.body.folder !== undefined) { file.folder = req.body.folder || null; await resolveFolderAncestors(req.user._id, file.folder); }
  file.updatedBy = req.user._id; await file.save(); await logDriveActivity(req, file, 'file_updated');
  res.json({ success: true, data: serialize(file) });
});

export const uploadNewVersion = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, 'Choose a version file');
  const { item: file } = await resolveItemAccess(req.user, 'file', req.params.id, 'edit', true);
  if (file.locked || file.immutable) throw new ApiError(423, 'This file is locked or finalised');
  try {
    const mimeType = await scanUpload(req.file); await assertStorageAvailable(req.user._id, req.file.size);
    const checksum = await hashFile(req.file.path); const latestVersion = await DriveFileVersion.findOne({ file: file._id }).sort({ version: -1 }).select('version').lean(); const version = Number(latestVersion?.version || 0) + 1;
    const storageKey = buildStorageKey(req.user._id, req.file.originalname, 'versions');
    const stored = await saveFile(req.file.path, storageKey, mimeType);
    await DriveFileVersion.create({ file: file._id, owner: file.owner, version, storageDriver: stored.driver, storageKey: stored.key, sizeBytes: req.file.size, checksum, mimeType, changeDescription: req.body.changeDescription, uploadedBy: req.user._id });
    file.currentVersion = version; file.storageDriver = stored.driver; file.storageKey = stored.key; file.sizeBytes = req.file.size; file.checksum = checksum; file.mimeType = mimeType; file.originalName = req.file.originalname; file.updatedBy = req.user._id; await file.save();
    await changeUsage(file.owner, req.file.size, file.category); await logDriveActivity(req, file, 'version_uploaded', { version });
    res.status(201).json({ success: true, data: serialize(file) });
  } catch (error) { await fsp.unlink(req.file.path).catch(() => {}); throw error; }
});

export const restoreVersion = asyncHandler(async (req, res) => {
  const { item: file } = await resolveItemAccess(req.user, 'file', req.params.id, 'edit', true);
  if (file.locked || file.immutable) throw new ApiError(423, 'This file is locked or finalised');
  const version = await DriveFileVersion.findOne({ file: file._id, version: Number(req.params.version) }).select('+storageKey');
  if (!version) throw new ApiError(404, 'Version not found');
  file.storageDriver = version.storageDriver; file.storageKey = version.storageKey; file.sizeBytes = version.sizeBytes; file.checksum = version.checksum; file.mimeType = version.mimeType; file.currentVersion = version.version; file.updatedBy = req.user._id; await file.save();
  await logDriveActivity(req, file, 'version_restored', { version: version.version });
  res.json({ success: true, data: serialize(file) });
});

export const setFileApproval = asyncHandler(async (req, res) => {
  const { item: file } = await resolveItemAccess(req.user, 'file', req.params.id, 'edit');
  const status = req.body.status;
  const allowed = ['draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'final', 'archived'];
  if (!allowed.includes(status)) throw new ApiError(422, 'Invalid approval status');
  file.approval.status = status; file.approval.reason = req.body.reason; file.approval.reviewedBy = ['approved', 'rejected', 'final'].includes(status) ? req.user._id : file.approval.reviewedBy; file.approval.reviewedAt = ['approved', 'rejected', 'final'].includes(status) ? new Date() : file.approval.reviewedAt;
  if (status === 'submitted') { file.approval.requestedBy = req.user._id; file.approval.requestedAt = new Date(); }
  if (status === 'final') { file.immutable = true; file.locked = true; await DriveFileVersion.updateMany({ file: file._id }, { immutable: true, approvalStatus: 'final' }); }
  await file.save(); await logDriveActivity(req, file, `file_${status}`, { reason: req.body.reason });
  res.json({ success: true, data: serialize(file) });
});

async function trashCore(req, itemType, itemId) {
  const { item } = await resolveItemAccess(req.user, itemType, itemId, 'delete');
  const policy = await getDrivePolicy();
  if (itemType === 'file' && item.immutable) throw new ApiError(423, 'Final legal records follow retention policy and cannot be deleted');
  if (itemType === 'file') {
    const retentionDays = isSensitive(item) ? policy.legalRetentionDays : policy.trashRetentionDays;
    const bytes = await totalStoredBytes(item._id);
    item.status = 'trashed'; item.deletedAt = new Date(); item.purgeAt = purgeDate(retentionDays); await item.save();
    await DriveUsage.updateOne({ user: item.owner }, { $inc: { trashBytes: bytes } });
  } else {
    const folderIds = [item._id, ...(await DriveFolder.find({ owner: item.owner, ancestors: item._id }).distinct('_id'))];
    const files = await DriveFile.find({ owner: item.owner, folder: { $in: folderIds }, status: { $ne: 'trashed' } });
    const immutable = files.find((file) => file.immutable);
    if (immutable) throw new ApiError(423, `Folder contains final or legally retained record: ${immutable.name}`);
    const fileIds = files.map((file) => file._id);
    const bytesRows = await DriveFileVersion.aggregate([{ $match: { file: { $in: fileIds } } }, { $group: { _id: null, bytes: { $sum: '$sizeBytes' } } }]);
    const normalPurgeAt = purgeDate(policy.trashRetentionDays);
    const legalPurgeAt = purgeDate(policy.legalRetentionDays);
    await DriveFolder.updateMany({ _id: { $in: folderIds } }, { status: 'trashed', deletedAt: new Date(), purgeAt: normalPurgeAt });
    const sensitiveIds = files.filter(isSensitive).map((file) => file._id);
    const normalIds = files.filter((file) => !isSensitive(file)).map((file) => file._id);
    if (normalIds.length) await DriveFile.updateMany({ _id: { $in: normalIds } }, { status: 'trashed', deletedAt: new Date(), purgeAt: normalPurgeAt });
    if (sensitiveIds.length) await DriveFile.updateMany({ _id: { $in: sensitiveIds } }, { status: 'trashed', deletedAt: new Date(), purgeAt: legalPurgeAt });
    await DriveUsage.updateOne({ user: item.owner }, { $inc: { trashBytes: bytesRows[0]?.bytes || 0 } });
  }
  await logDriveActivity(req, item, 'moved_to_trash');
  return item;
}

async function restoreCore(req, itemType, itemId) {
  const { item } = await resolveItemAccess(req.user, itemType, itemId, 'delete');
  if (item.status !== 'trashed') throw new ApiError(422, 'Item is not in Trash');
  if (itemType === 'file') {
    const bytes = await totalStoredBytes(item._id);
    item.status = 'active'; item.deletedAt = undefined; item.purgeAt = undefined; await item.save();
    await DriveUsage.updateOne({ user: item.owner }, { $inc: { trashBytes: -bytes } });
  } else {
    const folderIds = [item._id, ...(await DriveFolder.find({ owner: item.owner, ancestors: item._id }).distinct('_id'))];
    const fileIds = await DriveFile.find({ owner: item.owner, folder: { $in: folderIds }, status: 'trashed' }).distinct('_id');
    const bytesRows = await DriveFileVersion.aggregate([{ $match: { file: { $in: fileIds } } }, { $group: { _id: null, bytes: { $sum: '$sizeBytes' } } }]);
    await DriveFolder.updateMany({ _id: { $in: folderIds } }, { status: 'active', $unset: { deletedAt: 1, purgeAt: 1 } });
    await DriveFile.updateMany({ _id: { $in: fileIds } }, { status: 'active', $unset: { deletedAt: 1, purgeAt: 1 } });
    await DriveUsage.updateOne({ user: item.owner }, { $inc: { trashBytes: -(bytesRows[0]?.bytes || 0) } });
  }
  await logDriveActivity(req, item, 'restored');
  return item;
}

async function permanentDeleteFileCore(req, file) {
  if (file.immutable) throw new ApiError(423, 'Final legal records cannot be permanently deleted');
  const versions = await DriveFileVersion.find({ file: file._id }).select('+storageKey');
  const bytes = versions.reduce((sum, v) => sum + Number(v.sizeBytes || 0), 0);
  await Promise.all(versions.map((v) => deleteObject(v.storageDriver, v.storageKey)));
  await DriveFileVersion.deleteMany({ file: file._id });
  await DriveShare.deleteMany({ itemType: 'file', itemId: file._id });
  await DriveComment.deleteMany({ file: file._id });
  await DriveFile.deleteOne({ _id: file._id });
  await DriveUsage.updateOne({ user: file.owner }, { $inc: { usedBytes: -bytes, trashBytes: file.status === 'trashed' ? -bytes : 0 } });
}

async function permanentDeleteCore(req, itemType, itemId) {
  const { item } = await resolveItemAccess(req.user, itemType, itemId, 'delete');
  if (itemType === 'file') {
    await permanentDeleteFileCore(req, item);
  } else {
    if (item.systemKey) throw new ApiError(422, 'System folders cannot be permanently deleted');
    const folderIds = [item._id, ...(await DriveFolder.find({ owner: item.owner, ancestors: item._id }).distinct('_id'))];
    const files = await DriveFile.find({ folder: { $in: folderIds } });
    for (const file of files) await permanentDeleteFileCore(req, file);
    await DriveShare.deleteMany({ itemType: 'folder', itemId: { $in: folderIds } });
    await DriveFolder.deleteMany({ _id: { $in: folderIds } });
  }
  return item;
}

export const moveToTrash = asyncHandler(async (req, res) => {
  await trashCore(req, req.params.type, req.params.id);
  res.json({ success: true, message: 'Moved to Trash' });
});

export const restoreItem = asyncHandler(async (req, res) => {
  const item = await restoreCore(req, req.params.type, req.params.id);
  res.json({ success: true, data: serialize(item) });
});

export const permanentlyDelete = asyncHandler(async (req, res) => {
  await permanentDeleteCore(req, req.params.type, req.params.id);
  res.json({ success: true, message: 'Permanently deleted' });
});

export const shareItem = asyncHandler(async (req, res) => {
  const itemType = req.params.type; const { item } = await resolveItemAccess(req.user, itemType, req.params.id, 'share');
  const permission = req.body.permission || 'viewer'; if (!permissionCapabilities[permission]) throw new ApiError(422, 'Invalid permission');
  let granteeUser = req.body.userId; let granteeEmail = String(req.body.email || '').toLowerCase().trim() || undefined;
  if (!granteeUser && granteeEmail) granteeUser = (await User.findOne({ email: granteeEmail }).select('_id'))?._id;
  if (!granteeUser && !granteeEmail && !req.body.teamKey) throw new ApiError(422, 'Choose a user, email or team');
  const query = { itemType, itemId: item._id, ...(granteeUser ? { granteeUser } : { granteeEmail }), revokedAt: null };
  const share = await DriveShare.findOneAndUpdate(query, { owner: item.owner, itemType, itemId: item._id, granteeUser, granteeEmail, teamKey: req.body.teamKey, permission, capabilities: { ...permissionCapabilities[permission], ...(req.body.capabilities || {}) }, expiresAt: req.body.expiresAt || undefined, createdBy: req.user._id }, { upsert: true, new: true, setDefaultsOnInsert: true });
  if (item.visibility === 'private') { item.visibility = 'selected_users'; await item.save(); }
  await logDriveActivity(req, item, 'item_shared', { permission, granteeEmail });
  res.status(201).json({ success: true, data: share });
});

export const listShares = asyncHandler(async (req, res) => {
  const { item } = await resolveItemAccess(req.user, req.params.type, req.params.id, 'view');
  if (String(item.owner) !== String(req.user._id)) throw new ApiError(403, 'Only the owner can manage sharing');
  const shares = await DriveShare.find({ itemType: req.params.type, itemId: item._id, revokedAt: null }).populate('granteeUser', 'name email avatar').lean();
  res.json({ success: true, data: shares });
});

export const revokeShare = asyncHandler(async (req, res) => {
  const share = await DriveShare.findById(req.params.shareId); if (!share) throw new ApiError(404, 'Share not found');
  if (String(share.owner) !== String(req.user._id)) throw new ApiError(403, 'Only the owner can revoke access');
  share.revokedAt = new Date(); await share.save(); res.json({ success: true, message: 'Access revoked' });
});

export const sharedWithMe = asyncHandler(async (req, res) => {
  const shares = await DriveShare.find({ revokedAt: null, $and: [{ $or: [{ granteeUser: req.user._id }, { granteeEmail: req.user.email.toLowerCase() }] }, { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }] }).sort({ createdAt: -1 }).lean();
  const fileIds = shares.filter((s) => s.itemType === 'file').map((s) => s.itemId); const folderIds = shares.filter((s) => s.itemType === 'folder').map((s) => s.itemId);
  const [files, folders] = await Promise.all([DriveFile.find({ _id: { $in: fileIds }, status: 'active' }).populate('owner', 'name email avatar').lean(), DriveFolder.find({ _id: { $in: folderIds }, status: 'active' }).populate('owner', 'name email avatar').lean()]);
  res.json({ success: true, data: { files, folders, shares } });
});

export const createPublicLink = asyncHandler(async (req, res) => {
  const itemType = req.params.type; const { item } = await resolveItemAccess(req.user, itemType, req.params.id, 'share');
  const policy = await getDrivePolicy(); if (!policy.publicSharingEnabled) throw new ApiError(403, 'Public sharing is disabled by platform policy');
  if (isSensitive(item) && !policy.legalPublicSharingEnabled) throw new ApiError(403, 'Public sharing of sensitive and legal records is disabled');
  if (isSensitive(item) && !boolean(req.body.confirmSensitive)) throw new ApiError(422, 'This sensitive document or folder requires explicit confirmation before public sharing');
  if (req.body.expiresAt) {
    const expiresAt = new Date(req.body.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new ApiError(422, 'Link expiry must be a valid future date');
    const latestAllowed = Date.now() + Number(policy.maxPublicLinkDays || 365) * 86400000;
    if (expiresAt.getTime() > latestAllowed) throw new ApiError(422, `Public links may be active for at most ${policy.maxPublicLinkDays || 365} days`);
  }
  const token = await createPublicToken(item, req.body); item.visibility = req.body.restricted ? 'restricted_link' : 'public';
  if (itemType === 'folder') {
    item.inheritanceMode = req.body.inheritanceMode || item.inheritanceMode; await item.save();
    if (item.inheritanceMode === 'include_existing') {
      const folders = await DriveFolder.find({ owner: item.owner, $or: [{ _id: item._id }, { ancestors: item._id }] });
      const folderIds = folders.map((f) => f._id);
      await DriveFolder.updateMany({ _id: { $in: folderIds }, sensitive: false }, { visibility: 'public' });
      await DriveFile.updateMany({ folder: { $in: folderIds }, confidentiality: { $nin: [...SENSITIVE_CONFIDENTIALITY] }, category: { $ne: 'legal' } }, { visibility: 'public' });
    }
  } else await item.save();
  await logDriveActivity(req, item, 'public_link_created');
  res.status(201).json({ success: true, data: { token, slug: item.publicLink.slug, url: `${env.PUBLIC_APP_URL}/public-drive/${itemType}/${item.publicLink.slug || token}` } });
});

export const revokePublicLink = asyncHandler(async (req, res) => {
  const { item } = await resolveItemAccess(req.user, req.params.type, req.params.id, 'share');
  item.publicLink.enabled = false; item.publicLink.revokedAt = new Date(); item.visibility = 'private'; await item.save(); await logDriveActivity(req, item, 'public_link_revoked');
  res.json({ success: true, message: 'Public access revoked immediately' });
});

export const addComment = asyncHandler(async (req, res) => {
  const { item: file } = await resolveItemAccess(req.user, 'file', req.params.id, 'comment');
  const comment = await DriveComment.create({ file: file._id, user: req.user._id, parent: req.body.parent || undefined, body: req.body.body, mentions: req.body.mentions || [] });
  await logDriveActivity(req, file, 'comment_added'); res.status(201).json({ success: true, data: await comment.populate('user', 'name avatar') });
});

export const listComments = asyncHandler(async (req, res) => {
  await resolveItemAccess(req.user, 'file', req.params.id, 'view');
  res.json({ success: true, data: await DriveComment.find({ file: req.params.id }).populate('user', 'name avatar').sort({ createdAt: 1 }).lean() });
});

export const resolveComment = asyncHandler(async (req, res) => {
  const comment = await DriveComment.findById(req.params.commentId); if (!comment) throw new ApiError(404, 'Comment not found');
  await resolveItemAccess(req.user, 'file', comment.file, 'edit'); comment.resolvedAt = new Date(); comment.resolvedBy = req.user._id; await comment.save(); res.json({ success: true, data: comment });
});

export const searchDrive = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim(); const filters = { owner: req.user._id, status: req.query.status || 'active' };
  if (q) filters.$text = { $search: q };
  if (req.query.category) filters.category = req.query.category;
  if (req.query.smartFolderKey) filters.smartFolderKey = String(req.query.smartFolderKey);
  if (req.query.visibility) filters.visibility = req.query.visibility;
  if (req.query.tag) filters.tags = String(req.query.tag).toLowerCase();
  if (req.query.property) filters['relations.property'] = req.query.property;
  if (req.query.surveyProject) filters['relations.surveyProject'] = req.query.surveyProject;
  if (req.query.expiringBefore) filters.expiresAt = { $lte: new Date(req.query.expiringBefore) };
  const files = await DriveFile.find(filters).sort({ updatedAt: -1 }).limit(Math.min(Number(req.query.limit || 100), 200)).lean();
  const folderQuery = { owner: req.user._id, status: req.query.status || 'active', ...(q && { $text: { $search: q } }) };
  const folders = await DriveFolder.find(folderQuery).sort({ updatedAt: -1 }).limit(100).lean();
  res.json({ success: true, data: { files, folders } });
});

export const getActivity = asyncHandler(async (req, res) => {
  const query = { owner: req.user._id }; if (req.query.itemId) query.itemId = req.query.itemId;
  const rows = await DriveActivity.find(query).populate('actor', 'name email avatar').sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit || 100), 500)).lean();
  res.json({ success: true, data: rows });
});

export const getAnalytics = asyncHandler(async (req, res) => {
  const [usage, quotaBytes, views, downloads, failed] = await Promise.all([
    getUsage(req.user._id), getStorageQuota(req.user), DriveActivity.countDocuments({ owner: req.user._id, action: { $in: ['file_viewed', 'file_previewed', 'public_file_viewed'] } }), DriveActivity.countDocuments({ owner: req.user._id, action: { $in: ['file_downloaded', 'public_file_downloaded'] } }), DriveActivity.countDocuments({ owner: req.user._id, action: 'public_access_failed' }),
  ]);
  const largest = await DriveFile.find({ owner: req.user._id, status: { $ne: 'trashed' } }).sort({ sizeBytes: -1 }).limit(10).select('name sizeBytes category updatedAt').lean();
  const mostViewed = await DriveActivity.aggregate([{ $match: { owner: req.user._id, action: { $in: ['file_viewed', 'file_previewed', 'public_file_viewed'] }, itemId: { $ne: null } } }, { $group: { _id: '$itemId', views: { $sum: 1 }, lastViewedAt: { $max: '$createdAt' } } }, { $sort: { views: -1 } }, { $limit: 10 }]);
  res.json({ success: true, data: { usage, quotaBytes, views, downloads, failedAccessAttempts: failed, largest, mostViewed } });
});

export const downloadFolder = asyncHandler(async (req, res) => {
  const { item: folder } = await resolveItemAccess(req.user, 'folder', req.params.id, 'download');
  const folderIds = [folder._id, ...(await DriveFolder.find({ ancestors: folder._id, status: 'active' }).distinct('_id'))];
  const folders = await DriveFolder.find({ _id: { $in: folderIds } }).lean(); const files = await DriveFile.find({ folder: { $in: folderIds }, status: 'active' }).select('+storageKey').lean();
  res.attachment(`${safeName(folder.name)}.zip`); const archive = new ZipArchive({ zlib: { level: 6 } }); archive.on('error', (error) => res.destroy(error)); archive.pipe(res);
  const folderById = new Map(folders.map((f) => [String(f._id), f]));
  function relativePath(file) { const parts = []; let current = folderById.get(String(file.folder)); while (current && String(current._id) !== String(folder._id)) { parts.unshift(current.name); current = folderById.get(String(current.parent)); } return path.posix.join(...parts, file.name); }
  for (const file of files) archive.append(await createReadStream(file.storageDriver, file.storageKey), { name: relativePath(file) });
  await archive.finalize(); await logDriveActivity(req, folder, 'folder_downloaded');
});

export const initiateChunkedUpload = asyncHandler(async (req, res) => {
  const policy = await getDrivePolicy();
  const maxBytes = Number(policy.maxFileMb || env.VAULT_MAX_FILE_MB) * 1024 ** 2;
  const totalBytes = Number(req.body.totalBytes); if (!totalBytes || totalBytes > maxBytes) throw new ApiError(422, `Invalid upload or file exceeds ${policy.maxFileMb || env.VAULT_MAX_FILE_MB} MB`);
  await assertStorageAvailable(req.user._id, totalBytes); const chunkSize = Math.min(Number(req.body.chunkSize || 5 * 1024 ** 2), 10 * 1024 ** 2); const totalChunks = Math.ceil(totalBytes / chunkSize);
  const folderId = req.body.folder || null;
  let smart = null;
  if (folderId) {
    const { item: parent } = await resolveItemAccess(req.user, 'folder', folderId, 'upload');
    smart = smartDocumentFolderDefaults(parent);
    if (parent.visibility === 'public' && parent.inheritanceMode === 'inherit') throw new ApiError(403, 'Uploads into public folders are disabled. Use a private vault folder for new records.');
  }
  const incomingMetadata = parseLegalMetadata(req.body.metadata);
  const metadata = { ...incomingMetadata };
  if (smart) {
    metadata.category = smart.category;
    metadata.confidentiality = smart.confidentiality;
    metadata.smartFolderKey = smart.smartFolderKey;
    metadata.documentType = req.body.documentType || smart.documentType;
    metadata.legalMetadata = { ...parseLegalMetadata(metadata.legalMetadata), documentType: metadata.documentType };
    metadata.tags = [...(Array.isArray(metadata.tags) ? metadata.tags : []), smart.smartFolderKey];
  }
  const session = await DriveUploadSession.create({ user: req.user._id, folder: folderId || undefined, filename: safeName(req.body.filename), mimeType: req.body.mimeType || 'application/octet-stream', totalBytes, chunkSize, totalChunks, tempKey: crypto.randomUUID(), metadata, expiresAt: new Date(Date.now() + 24 * 3600000) });
  res.status(201).json({ success: true, data: { id: session._id, chunkSize, totalChunks, receivedChunks: [] } });
});

export const uploadChunk = asyncHandler(async (req, res) => {
  const session = await DriveUploadSession.findOne({ _id: req.params.sessionId, user: req.user._id, status: { $in: ['initiated', 'uploading'] } }).select('+tempKey');
  if (!session) throw new ApiError(404, 'Upload session not found or expired'); const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= session.totalChunks) throw new ApiError(422, 'Invalid chunk index');
  const location = tempUploadPath(session._id, index); await fsp.mkdir(path.dirname(location), { recursive: true }); await fsp.writeFile(location, req.body, { mode: 0o600 });
  if (!session.receivedChunks.includes(index)) session.receivedChunks.push(index); session.status = 'uploading'; await session.save();
  res.json({ success: true, data: { receivedChunks: session.receivedChunks, progress: Math.round(session.receivedChunks.length / session.totalChunks * 100) } });
});

export const completeChunkedUpload = asyncHandler(async (req, res) => {
  const session = await DriveUploadSession.findOne({ _id: req.params.sessionId, user: req.user._id, status: { $in: ['initiated', 'uploading'] } }).select('+tempKey');
  if (!session) throw new ApiError(404, 'Upload session not found');
  if (session.receivedChunks.length !== session.totalChunks) throw new ApiError(409, 'Not all chunks have been uploaded');
  const sessionDir = path.dirname(tempUploadPath(session._id, 0));
  const assembledPath = path.join(sessionDir, 'assembled.upload');
  try {
    await fsp.writeFile(assembledPath, Buffer.alloc(0), { mode: 0o600 });
    let assembledBytes = 0;
    for (let index = 0; index < session.totalChunks; index += 1) {
      const chunk = await fsp.readFile(tempUploadPath(session._id, index));
      assembledBytes += chunk.length;
      if (assembledBytes > session.totalBytes) throw new ApiError(422, 'Uploaded chunks exceed the declared file size');
      await fsp.appendFile(assembledPath, chunk);
    }
    if (assembledBytes !== session.totalBytes) throw new ApiError(422, 'Uploaded size does not match the declared file size');
    const mimeType = await scanUpload({ path: assembledPath, originalname: session.filename, mimetype: session.mimeType, size: assembledBytes });
    const checksum = await hashFile(assembledPath);
    const duplicate = await DriveFile.findOne({ owner: req.user._id, checksum, sizeBytes: assembledBytes, status: { $ne: 'trashed' } }).select('_id name').lean();
    if (duplicate && session.metadata?.duplicateAction !== 'copy') throw new ApiError(409, 'Potential duplicate detected', { duplicateId: duplicate._id, duplicateName: duplicate.name });
    const extension = fileExtension(session.filename);
    const key = buildStorageKey(req.user._id, session.filename);
    const stored = await saveFile(assembledPath, key, mimeType);
    const category = session.metadata?.category || categoryFromMime(mimeType, extension);
    const file = await DriveFile.create({
      owner: req.user._id, folder: session.folder, name: session.filename, originalName: session.filename, extension, mimeType,
      category, storageDriver: stored.driver, storageKey: stored.key, sizeBytes: assembledBytes, checksum,
      smartFolderKey: session.metadata?.smartFolderKey, documentType: session.metadata?.documentType || session.metadata?.legalMetadata?.documentType,
      visibility: 'private', confidentiality: session.metadata?.confidentiality || (category === 'legal' ? 'legal_record' : 'private'),
      description: session.metadata?.description || '', tags: session.metadata?.tags || [], relations: session.metadata?.relations || {},
      legalMetadata: session.metadata?.legalMetadata || {}, createdBy: req.user._id,
    });
    await DriveFileVersion.create({ file: file._id, owner: req.user._id, version: 1, storageDriver: stored.driver, storageKey: stored.key, sizeBytes: assembledBytes, checksum, mimeType, uploadedBy: req.user._id });
    await changeUsage(req.user._id, assembledBytes, category);
    session.status = 'completed'; await session.save();
    await logDriveActivity(req, file, 'chunked_upload_completed');
    res.status(201).json({ success: true, data: serialize(file) });
  } finally {
    await fsp.rm(sessionDir, { recursive: true, force: true }).catch(() => {});
  }
});

export const cancelChunkedUpload = asyncHandler(async (req, res) => {
  const session = await DriveUploadSession.findOne({ _id: req.params.sessionId, user: req.user._id }).select('+tempKey'); if (!session) throw new ApiError(404, 'Upload session not found');
  session.status = 'cancelled'; await session.save(); await fsp.rm(path.dirname(tempUploadPath(session._id, 0)), { recursive: true, force: true }); res.json({ success: true, message: 'Upload cancelled' });
});

export const bulkAction = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 200) : []; const action = req.body.action;
  const results = [];
  for (const entry of items) {
    try {
      if (action === 'trash') await trashCore(req, entry.type, entry.id)
      else if (action === 'restore') await restoreCore(req, entry.type, entry.id)
      else if (action === 'star') { const { item } = await resolveItemAccess(req.user, entry.type, entry.id, 'edit'); item.starred = true; await item.save(); }
      else if (action === 'archive') { const { item } = await resolveItemAccess(req.user, entry.type, entry.id, 'edit'); item.status = 'archived'; await item.save(); }
      else if (action === 'move') { const { item } = await resolveItemAccess(req.user, entry.type, entry.id, 'move'); if (entry.type === 'file') item.folder = req.body.destination || null; else { item.parent = req.body.destination || null; item.ancestors = await resolveFolderAncestors(req.user._id, item.parent); } await item.save(); }
      else throw new ApiError(422, 'Unsupported bulk action');
      results.push({ ...entry, success: true });
    } catch (error) { results.push({ ...entry, success: false, message: error.message }); }
  }
  res.json({ success: true, data: results });
});

export const reportContent = asyncHandler(async (req, res) => {
  const report = await DriveContentReport.create({ reporter: req.user?._id, itemType: req.params.type, itemId: req.params.id, reason: req.body.reason, details: req.body.details });
  res.status(201).json({ success: true, data: report });
});

export const adminDriveOverview = asyncHandler(async (_req, res) => {
  const [usage, publicFiles, publicFolders, reports, quarantined] = await Promise.all([
    DriveUsage.aggregate([{ $group: { _id: null, usedBytes: { $sum: '$usedBytes' }, trashBytes: { $sum: '$trashBytes' }, users: { $sum: 1 } } }]),
    DriveFile.countDocuments({ visibility: 'public', status: 'active' }), DriveFolder.countDocuments({ visibility: 'public', status: 'active' }),
    DriveContentReport.countDocuments({ status: { $in: ['submitted', 'under_review'] } }), DriveFile.countDocuments({ status: 'quarantined' }),
  ]);
  res.json({ success: true, data: { usage: usage[0] || { usedBytes: 0, trashBytes: 0, users: 0 }, publicFiles, publicFolders, openReports: reports, quarantined } });
});

export const adminRecalculateUsage = asyncHandler(async (req, res) => {
  const usage = await recalculateUsage(req.params.userId); res.json({ success: true, data: usage });
});


export const adminListDriveUsage = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1); const limit = Math.min(Number(req.query.limit || 50), 200);
  const [rows, total] = await Promise.all([DriveUsage.find().populate('user', 'name email role status landlordEnabled surveyorEnabled').sort({ usedBytes: -1 }).skip((page - 1) * limit).limit(limit).lean(), DriveUsage.countDocuments()]);
  res.json({ success: true, data: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

export const adminListContentReports = asyncHandler(async (req, res) => {
  const rows = await DriveContentReport.find(req.query.status ? { status: req.query.status } : {}).populate('reporter', 'name email').sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, data: rows });
});

export const adminReviewContentReport = asyncHandler(async (req, res) => {
  const report = await DriveContentReport.findById(req.params.id); if (!report) throw new ApiError(404, 'Report not found');
  report.status = req.body.status || 'resolved'; report.decision = req.body.decision; report.reviewedBy = req.user._id; await report.save();
  if (req.body.restrict === true) {
    const Model = report.itemType === 'file' ? DriveFile : DriveFolder; const item = await Model.findById(report.itemId);
    if (item) { item.visibility = 'private'; if (item.publicLink) { item.publicLink.enabled = false; item.publicLink.revokedAt = new Date(); } if (report.itemType === 'file' && req.body.quarantine) item.status = 'quarantined'; await item.save(); }
  }
  res.json({ success: true, data: report });
});

export const adminGetDrivePolicy = asyncHandler(async (_req, res) => res.json({ success: true, data: await getDrivePolicy() }));
export const adminUpdateDrivePolicy = asyncHandler(async (req, res) => {
  const allowed = ['maxFileMb', 'allowedExtensions', 'trashRetentionDays', 'legalRetentionDays', 'publicSharingEnabled', 'legalPublicSharingEnabled', 'maxPublicLinkDays'];
  const update = { updatedBy: req.user._id, malwareScanRequired: false };
  for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
  const policy = await DrivePolicy.findOneAndUpdate({ key: 'default' }, update, { upsert: true, new: true, runValidators: true }); res.json({ success: true, data: policy });
});
