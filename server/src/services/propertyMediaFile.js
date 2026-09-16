import mongoose from 'mongoose';
import { Document, DriveFile, PropertyMedia } from '../models/index.js';

const UNAVAILABLE_FILE_STATUSES = { $nin: ['trashed', 'quarantined'] };

function idString(value) {
  return String(value?._id || value || '').trim();
}

function driveFileIdFromSource(source) {
  const raw = String(source || '').trim();
  const bare = raw.replace(/^\/+/, '').split(/[?#]/, 1)[0];
  if (mongoose.isValidObjectId(bare) && /^[a-f\d]{24}$/i.test(bare)) return bare;
  return raw.match(/\/(?:api\/v\d+\/)?(?:drive\/files|files)\/([a-f\d]{24})(?:\/content)?(?:[/?#]|$)/i)?.[1] || '';
}

function propertyMediaIdFromSource(source) {
  return String(source || '').match(/\/(?:api\/v\d+\/)?property-media\/([a-f\d]{24})(?:\/content)?(?:[/?#]|$)/i)?.[1] || '';
}

function statusFilter(publicOnly) {
  return publicOnly ? 'active' : UNAVAILABLE_FILE_STATUSES;
}

function imageFileFilter() {
  return { mimeType: /^image\//i };
}

function normalizedLabels(media, document) {
  return [...new Set([media?.caption, media?.altText, media?.originalName, document?.name]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean))];
}

function labelMatches(item, labels) {
  const names = [item?.name, item?.originalName].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
  return labels.some((label) => names.includes(label));
}

function closestByCreatedAt(items, media, labels = []) {
  if (!items.length) return null;
  const target = new Date(media?.createdAt || 0).getTime();
  return [...items].sort((left, right) => {
    const leftLabel = labelMatches(left, labels) ? 0 : 1;
    const rightLabel = labelMatches(right, labels) ? 0 : 1;
    if (leftLabel !== rightLabel) return leftLabel - rightLabel;
    const leftTime = new Date(left?.createdAt || 0).getTime();
    const rightTime = new Date(right?.createdAt || 0).getTime();
    const leftDistance = Number.isFinite(target) ? Math.abs(leftTime - target) : leftTime;
    const rightDistance = Number.isFinite(target) ? Math.abs(rightTime - target) : rightTime;
    return leftDistance - rightDistance || leftTime - rightTime;
  })[0] || null;
}

async function findDriveFile(id, publicOnly = false, excludedIds = []) {
  const candidate = idString(id);
  if (!mongoose.isValidObjectId(candidate) || excludedIds.includes(candidate)) return null;
  return DriveFile.findOne({ _id: candidate, status: statusFilter(publicOnly) })
    .select('+storageKey')
    .lean();
}

// PropertyMedia was introduced after some properties had already stored image
// URLs. Resolve every supported reference shape in a deterministic order, then
// use the property relation plus the original filename as a safe repair path
// for records created before driveFile/document was written directly.
export async function resolvePropertyMediaFile(media, propertyId, { publicOnly = false, excludedIds = [], visitedIds = [] } = {}) {
  const candidateIds = [];
  const addCandidate = (value) => {
    const candidate = idString(value);
    if (mongoose.isValidObjectId(candidate) && !candidateIds.includes(candidate) && !excludedIds.includes(candidate)) candidateIds.push(candidate);
  };

  addCandidate(media?.driveFile);

  let document = null;
  const documentId = idString(media?.document);
  if (mongoose.isValidObjectId(documentId)) {
    document = await Document.findById(documentId).select('driveFile url property name').lean();
    addCandidate(document?.driveFile);
    addCandidate(driveFileIdFromSource(document?.url));
  }

  // A few legacy imports stored the DriveFile/ObjectId itself in `url` or
  // `thumbnailUrl` instead of a route. Treat that exact value as a file ID,
  // but never parse an arbitrary path into an ID.
  addCandidate(media?.url);
  addCandidate(media?.thumbnailUrl);
  addCandidate(driveFileIdFromSource(media?.url));
  addCandidate(driveFileIdFromSource(media?.thumbnailUrl));

  for (const candidate of candidateIds) {
    const file = await findDriveFile(candidate, publicOnly, excludedIds);
    if (file) return file;
  }

  const propertyKey = idString(propertyId);
  if (!mongoose.isValidObjectId(propertyKey)) return null;

  const currentMediaId = idString(media?._id);
  const visited = [...new Set([...visitedIds, currentMediaId].filter(Boolean))];
  const referencedMediaIds = [media?.url, media?.thumbnailUrl]
    .flatMap((source) => propertyMediaIdFromSource(source))
    .filter((id) => id && !visited.includes(id));
  for (const referencedMediaId of referencedMediaIds) {
    const referencedMedia = await PropertyMedia.findOne({ _id: referencedMediaId, property: propertyKey, deletedAt: null }).lean();
    if (referencedMedia) {
      const referencedFile = await resolvePropertyMediaFile(referencedMedia, propertyKey, { publicOnly, excludedIds, visitedIds: visited });
      if (referencedFile) return referencedFile;
    }
  }

  const labels = normalizedLabels(media, document);

  // uploadDocument always records the property on the DriveFile. Matching the
  // exact stored filename keeps this fallback property-specific and prevents
  // an image from another landlord/property being selected accidentally.
  const labelCandidates = labels.flatMap((label) => [{ name: label }, { originalName: label }]);
  const relatedFile = labels.length ? await DriveFile.findOne({
    'relations.property': propertyKey,
    _id: { $nin: excludedIds },
    status: statusFilter(publicOnly),
    $and: [imageFileFilter(), { $or: labelCandidates }],
  }).sort({ createdAt: -1 }).select('+storageKey').lean() : null;
  if (relatedFile) return relatedFile;

  // Some early records retained only a Document property/name link. Resolve
  // that link as a final deterministic fallback, without scanning arbitrary
  // files or exposing a bare storage path.
  const relatedDocument = await Document.findOne({
    property: propertyKey,
    $or: [
      ...labels.map((label) => ({ name: new RegExp(`^${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i') })),
      ...(media?.url ? [{ url: String(media.url) }] : []),
      ...(media?.thumbnailUrl ? [{ url: String(media.thumbnailUrl) }] : []),
    ],
  }).sort({ createdAt: -1 }).select('driveFile url').lean();
  if (relatedDocument) {
    const relatedId = idString(relatedDocument.driveFile) || driveFileIdFromSource(relatedDocument.url);
    const documentFile = await findDriveFile(relatedId, publicOnly, excludedIds);
    if (documentFile) return documentFile;
  }

  // A few early uploads created a Document with the property relation but did
  // not copy its DriveFile id onto PropertyMedia. Resolve those image
  // documents by filename/date, then verify the actual DriveFile status.
  const relatedDocuments = await Document.find({
    property: propertyKey,
    $or: [{ mimeType: /^image\//i }, { type: { $in: ['image', 'property_image'] } }],
  }).select('driveFile url name createdAt').sort({ createdAt: 1 }).lean();
  const documentCandidates = [];
  for (const item of relatedDocuments) {
    const id = idString(item.driveFile) || driveFileIdFromSource(item.url);
    const file = await findDriveFile(id, publicOnly, excludedIds);
    if (file && !documentCandidates.some((candidate) => String(candidate._id) === String(file._id))) documentCandidates.push({ ...file, name: item.name, createdAt: item.createdAt });
  }
  const documentFileFallback = closestByCreatedAt(documentCandidates, media, labels);
  if (documentFileFallback) return documentFileFallback;

  // Last repair path: uploadDocument records the property on DriveFile. This
  // lets old PropertyMedia rows with only a caption/URL recover their own
  // image, while never scanning files from another property.
  const relatedImages = await DriveFile.find({
    'relations.property': propertyKey,
    _id: { $nin: excludedIds },
    status: statusFilter(publicOnly),
    ...imageFileFilter(),
  }).sort({ createdAt: 1 }).select('+storageKey').lean();
  return closestByCreatedAt(relatedImages, media, labels);
}
