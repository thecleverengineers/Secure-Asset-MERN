import { DriveFolder, DriveFile, DriveActivity, DriveContentReport } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { validatePublicAccess } from '../services/driveService.js';
import { sendStoredFile } from '../utils/httpFile.js';

function passwordFrom(req) { return req.headers['x-share-password'] || req.query.password || req.body?.password || ''; }
function accessContext(req) { return { email: req.headers['x-share-email'] || req.query.email || '', country: req.headers['cf-ipcountry'] || req.headers['x-country-code'] || '' }; }
function publicFileView(file) {
  return {
    _id: file._id, name: file.name, description: file.description, extension: file.extension, mimeType: file.mimeType,
    category: file.category, sizeBytes: file.sizeBytes, tags: file.tags, updatedAt: file.updatedAt, createdAt: file.createdAt,
    preview: file.preview, publicLink: {
      allowDownload: file.publicLink?.allowDownload, allowPreview: file.publicLink?.allowPreview,
      expiresAt: file.publicLink?.expiresAt, watermark: file.publicLink?.watermark,
    },
    relations: { property: file.relations?.property, surveyProject: file.relations?.surveyProject },
  };
}
async function logPublic(req, item, action, metadata = {}) {
  await DriveActivity.create({ owner: item.owner, itemType: item.mimeType ? 'file' : 'folder', itemId: item._id, action, ip: req.ip, device: req.headers['user-agent'], country: req.headers['cf-ipcountry'], metadata });
}

export const publicItemMetadata = asyncHandler(async (req, res) => {
  const itemType = req.params.type;
  const item = await validatePublicAccess(itemType, req.params.token, passwordFrom(req), 'preview', accessContext(req));
  if (itemType === 'folder') { item.publicLink.views += 1; await item.save({ validateModifiedOnly: true }); }
  await logPublic(req, item, itemType === 'file' ? 'public_file_metadata_viewed' : 'public_folder_viewed');
  if (itemType === 'file') return res.json({ success: true, data: { type: 'file', item: publicFileView(item) } });
  let current = item;
  if (req.query.folderId && String(req.query.folderId) !== String(item._id)) {
    current = await DriveFolder.findOne({ _id: req.query.folderId, owner: item.owner, ancestors: item._id, status: 'active', visibility: 'public' });
    if (!current) throw new ApiError(404, 'Public subfolder not found');
  }
  const descendants = await DriveFolder.find({ parent: current._id, status: 'active', visibility: 'public' }).select('name description icon color coverImage category updatedAt publicLink').lean();
  const files = await DriveFile.find({ folder: current._id, status: 'active', visibility: 'public' }).select('name description extension mimeType category sizeBytes tags updatedAt createdAt preview publicLink').lean();
  const breadcrumbIds = [...(current.ancestors || []).filter((id) => String(id) === String(item._id) || (current.ancestors || []).map(String).includes(String(id))), current._id];
  const breadcrumbs = await DriveFolder.find({ _id: { $in: breadcrumbIds }, $or: [{ _id: item._id }, { ancestors: item._id }] }).select('name parent').lean();
  const byId = new Map(breadcrumbs.map((folder) => [String(folder._id), folder]));
  res.json({ success: true, data: { type: 'folder', root: { _id: item._id, name: item.name }, item: { _id: current._id, name: current.name, description: current.description, coverImage: current.coverImage, branding: item.branding, updatedAt: current.updatedAt, publicLink: { allowDownload: item.publicLink.allowDownload, allowUpload: item.publicLink.allowUpload, expiresAt: item.publicLink.expiresAt } }, breadcrumbs: breadcrumbIds.map((id) => byId.get(String(id))).filter(Boolean), folders: descendants, files: files.map(publicFileView) } });
});

export const publicFileContent = asyncHandler(async (req, res) => {
  const file = await validatePublicAccess('file', req.params.token, passwordFrom(req), req.query.download === 'true' ? 'download' : 'preview', accessContext(req));
  if (file.status !== 'active') throw new ApiError(404, 'File is unavailable');
  if (req.query.download === 'true') file.publicLink.downloads += 1; else file.publicLink.views += 1;
  await file.save({ validateModifiedOnly: true });
  if (file.publicLink?.watermark?.enabled) res.setHeader('X-SecureAsset-Watermark', file.publicLink.watermark.text || 'Preview Only');
  await sendStoredFile(req, res, file, { download: req.query.download === 'true' });
  await logPublic(req, file, req.query.download === 'true' ? 'public_file_downloaded' : 'public_file_previewed');
});


export const publicFolderFileContent = asyncHandler(async (req, res) => {
  const root = await validatePublicAccess('folder', req.params.token, passwordFrom(req), req.query.download === 'true' ? 'download' : 'content', accessContext(req));
  const file = await DriveFile.findOne({ _id: req.params.fileId, owner: root.owner, status: 'active', visibility: 'public' }).select('+storageKey');
  if (!file) throw new ApiError(404, 'Public file not found');
  const folder = file.folder ? await DriveFolder.findById(file.folder).select('ancestors') : null;
  if (!folder || (String(folder._id) !== String(root._id) && !(folder.ancestors || []).map(String).includes(String(root._id)))) throw new ApiError(403, 'File is outside this public folder');
  if (req.query.download === 'true' && !root.publicLink.allowDownload) throw new ApiError(403, 'Downloads are disabled for this folder');
  if (req.query.download === 'true') { root.publicLink.downloads += 1; await root.save({ validateModifiedOnly: true }); }
  await sendStoredFile(req, res, file, { download: req.query.download === 'true' });
  await logPublic(req, file, req.query.download === 'true' ? 'public_file_downloaded' : 'public_file_previewed', { viaFolder: root._id });
});

export const reportPublicItem = asyncHandler(async (req, res) => {
  const itemType = req.params.type;
  const Model = itemType === 'file' ? DriveFile : DriveFolder;
  const item = await Model.findById(req.params.id);
  if (!item || item.visibility !== 'public') throw new ApiError(404, 'Public item not found');
  const report = await DriveContentReport.create({ reporter: req.user?._id, itemType, itemId: item._id, reason: req.body.reason, details: req.body.details });
  await logPublic(req, item, 'public_content_reported', { reason: req.body.reason });
  res.status(201).json({ success: true, data: report });
});
