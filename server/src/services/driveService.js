import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import path from 'path';
import { Subscription, LandlordPlan, SurveyorSubscription, User, DriveFolder, DriveFile, DriveFileVersion, DriveShare, DriveUsage, DriveActivity, DrivePolicy } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import { TENANT_KYC_DOCUMENT_CATEGORIES } from '../constants/tenantKyc.js';

export const SENSITIVE_CONFIDENTIALITY = new Set(['confidential', 'highly_confidential', 'legal_record', 'identity_document', 'financial_document']);

const SYSTEM_FOLDERS = [
  ['my-drive', 'My Drive', 'general'], ['legal-documents', 'Legal Documents', 'legal'], ['property-documents', 'Property Documents', 'property'],
  ['survey-documents', 'Survey Documents', 'survey'], ['images', 'Images', 'images'], ['videos', 'Videos', 'videos'], ['audio-files', 'Audio Files', 'audio'],
  ['agreements', 'Agreements', 'agreements'], ['reports', 'Reports', 'reports'], ['receipts-invoices', 'Receipts and Invoices', 'receipts'],
  ['archived-files', 'Archived Files', 'archive'], ['trash', 'Trash', 'trash'],
];

// These are deliberately provisioned by the server rather than created from
// client input. Every account gets the same practical Indian document
// taxonomy, while each document type remains a normal protected DriveFolder
// so the existing sharing, audit, version and retention controls continue to
// apply without a second storage system.
export const SMART_DOCUMENT_FOLDERS = [
  {
    key: 'smart-national-identity-financial-proofs',
    name: 'Primary National Identity & Financial Proofs',
    description: 'Aadhaar, PAN, Voter ID and Indian Passport records.',
    icon: 'identity', color: '#2563eb',
    children: [
      { key: 'aadhaar-card', name: 'Aadhaar Card' },
      { key: 'pan-card', name: 'PAN Card (Permanent Account Number)' },
      { key: 'voter-id', name: 'Voter ID (EPIC)' },
      { key: 'indian-passport', name: 'Indian Passport' },
    ],
  },
  {
    key: 'smart-civil-life-event-certificates',
    name: 'Civil & Life Event Certificates',
    description: 'Birth, marriage, death, caste, domicile and income certificates.',
    icon: 'civil', color: '#7c3aed',
    children: [
      { key: 'birth-certificate', name: 'Birth Certificate' },
      { key: 'marriage-certificate', name: 'Marriage Certificate' },
      { key: 'death-certificate', name: 'Death Certificate' },
      { key: 'caste-domicile-income-certificates', name: 'Caste / Domicile / Income Certificate' },
    ],
  },
  {
    key: 'smart-transport-mobility',
    name: 'Transport & Mobility',
    description: 'Driving licence and vehicle ownership records.',
    icon: 'transport', color: '#0891b2',
    children: [
      { key: 'driving-licence', name: 'Driving Licence (DL)' },
      { key: 'vehicle-registration-certificate', name: 'Vehicle Registration Certificate (RC)' },
    ],
  },
  {
    key: 'smart-educational-academic-credentials',
    name: 'Educational & Academic Credentials',
    description: 'School leaving records, marksheets and higher education credentials.',
    icon: 'education', color: '#0f766e',
    children: [
      { key: 'class-10-certificate-marksheet', name: '10th Class Passing Certificate & Marksheet (Matriculation)' },
      { key: 'class-12-marksheet-leaving-certificate', name: '12th Marksheet & School/College Leaving Certificate (TC)' },
      { key: 'degree-diploma-certificates', name: 'Degree / Diploma Certificates' },
    ],
  },
  {
    key: 'smart-standard-address-proofs',
    name: 'Standard Proofs of Address (PoA)',
    description: 'Utility, banking, rental, ownership and ration records used for address verification.',
    icon: 'address', color: '#c2410c',
    children: [
      { key: 'utility-bills', name: 'Utility Bills' },
      { key: 'bank-passbook-statement', name: 'Bank Passbook / Bank Statement with Photo' },
      { key: 'rent-agreement-property-sale-deed', name: 'Registered Rent Agreement or Property Sale Deed' },
      { key: 'ration-card-address', name: 'Ration Card' },
    ],
  },
  {
    key: 'smart-healthcare-welfare-schemes',
    name: 'Healthcare & Welfare Schemes',
    description: 'ABHA, Ration/PDS and UDID welfare records.',
    icon: 'welfare', color: '#be185d',
    children: [
      { key: 'abha-card', name: 'ABHA Card (Ayushman Bharat Health Account)' },
      { key: 'ration-pds-card', name: 'Ration Card / PDS Card' },
      { key: 'udid-card', name: 'UDID (Unique Disability ID)' },
    ],
  },
  {
    key: 'smart-property-land-records',
    name: 'Property & Land Records',
    description: 'Land patta and property ownership records.',
    icon: 'land', color: '#65a30d',
    children: [
      { key: 'land-patta', name: 'Land Patta' },
    ],
  },
];

// These are the high-frequency identity and mobility folders shown as direct
// shortcuts in the vault. They point to the child folders above; no duplicate
// storage or parallel permission model is created for the pinned view.
export const SMART_DOCUMENT_PINNED_QUICK_ACCESS = [
  {
    key: 'smart-national-identity-financial-proofs-pan-card', name: 'PAN Card',
    description: 'Tax identity and financial proof.', eyebrow: 'Identity & finance', icon: 'pan', color: '#38bdf8',
  },
  {
    key: 'smart-civil-life-event-certificates-birth-certificate', name: 'Birth Certificate',
    description: 'Official date and place of birth record.', eyebrow: 'Life event', icon: 'birth', color: '#c084fc',
  },
  {
    key: 'smart-national-identity-financial-proofs-indian-passport', name: 'Indian Passport',
    description: 'Citizenship and international travel record.', eyebrow: 'Identity & travel', icon: 'passport', color: '#60a5fa',
  },
  {
    key: 'smart-national-identity-financial-proofs-voter-id', name: 'Voter ID',
    description: 'EPIC identity and voting eligibility record.', eyebrow: 'Identity & civic', icon: 'voter', color: '#818cf8',
  },
  {
    key: 'smart-national-identity-financial-proofs-aadhaar-card', name: 'Aadhaar Card',
    description: 'UIDAI identity and address proof.', eyebrow: 'Identity & address', icon: 'aadhaar', color: '#2dd4bf',
  },
  {
    key: 'smart-transport-mobility-driving-licence', name: 'Driving Licence',
    description: 'Motor vehicle authorization and photo ID.', eyebrow: 'Mobility', icon: 'driving', color: '#fbbf24',
  },
  {
    key: 'smart-transport-mobility-vehicle-registration-certificate', name: 'Vehicle Registration Certificate',
    description: 'Vehicle ownership and registration record.', eyebrow: 'Mobility', icon: 'vehicle', color: '#fb7185',
  },
  {
    key: 'smart-property-land-records-land-patta', name: 'Land Patta',
    description: 'Land ownership and revenue record.', eyebrow: 'Property & land', icon: 'land', color: '#84cc16',
  },
];

// Every account receives this protected baseline until an active landlord or
// surveyor subscription supplies a larger plan entitlement. Plan values are
// stored in MB in the admin subscription editors.
export const DEFAULT_VAULT_STORAGE_MB = 200;
export const BYTES_PER_MB = 1024 ** 2;

const LEGAL_TEMPLATES = {
  tenant: ['Identity Documents', 'Rental Agreements', 'Payment Receipts', 'Notices Received', 'Notices Sent', 'Deposit Records', 'Maintenance Records', 'Dispute Documents', 'Move-In Records', 'Move-Out Records'],
  landlord: ['Ownership Documents', 'Property Tax Records', 'Tenant Agreements', 'Tenant Verification', 'Rent Receipts', 'Deposit Records', 'Legal Notices', 'Property Compliance', 'Disputes', 'Registration Records'],
  surveyor: ['Professional Licence', 'Registration Documents', 'Client Agreements', 'Site Consent', 'Survey Reports', 'Survey Declarations', 'Insurance Records', 'Equipment Certificates', 'Dispute Records'],
};


export async function getDrivePolicy() {
  return DrivePolicy.findOneAndUpdate({ key: 'default' }, {
    $setOnInsert: {
      maxFileMb: env.VAULT_MAX_FILE_MB,
      allowedExtensions: env.VAULT_ALLOWED_EXTENSIONS.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
      trashRetentionDays: env.TRASH_RETENTION_DAYS,
    },
    $set: { malwareScanRequired: false },
  }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

async function ensureSmartDocumentFolders(userId) {
  const groups = [];
  for (const definition of SMART_DOCUMENT_FOLDERS) {
    const root = await DriveFolder.findOneAndUpdate(
      { owner: userId, parent: null, systemKey: definition.key },
      {
        $set: { category: 'legal', sensitive: true },
        $setOnInsert: {
          owner: userId, parent: null, ancestors: [], name: definition.name, description: definition.description,
          icon: definition.icon, color: definition.color, systemKey: definition.key, createdBy: userId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const children = [];
    for (const childDefinition of definition.children) {
      const systemKey = `${definition.key}-${childDefinition.key}`;
      const child = await DriveFolder.findOneAndUpdate(
        { owner: userId, parent: root._id, systemKey },
        {
          $set: { category: 'legal', sensitive: true },
          $setOnInsert: {
            owner: userId, parent: root._id, ancestors: [root._id], name: childDefinition.name,
            description: `Protected ${childDefinition.name} records.`, icon: 'document-type', color: definition.color,
            systemKey, createdBy: userId,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      children.push(child);
    }
    groups.push({ definition, folder: root, children });
  }
  return groups;
}

export async function ensurePersonalDrive(userId) {
  let roots = await DriveFolder.find({ owner: userId, systemKey: { $in: SYSTEM_FOLDERS.map(([key]) => key) } });
  const existing = new Set(roots.map((item) => item.systemKey));
  const created = [];
  for (const [systemKey, name, category] of SYSTEM_FOLDERS) {
    if (existing.has(systemKey)) continue;
    created.push(await DriveFolder.create({ owner: userId, name, category, systemKey, sensitive: category === 'legal', createdBy: userId }));
  }
  roots = [...roots, ...created];
  const smartGroups = await ensureSmartDocumentFolders(userId);
  roots = [...roots, ...smartGroups.map((group) => group.folder)];
  await DriveUsage.updateOne({ user: userId }, { $setOnInsert: { usedBytes: 0, trashBytes: 0 } }, { upsert: true });
  const order = new Map([
    ...SYSTEM_FOLDERS.map(([key], index) => [key, index]),
    ...SMART_DOCUMENT_FOLDERS.map((definition, index) => [definition.key, SYSTEM_FOLDERS.length + index]),
  ]);
  return roots.sort((a, b) => (order.get(a.systemKey) ?? 999) - (order.get(b.systemKey) ?? 999));
}

export async function getSmartDocumentFolders(userId) {
  const keys = SMART_DOCUMENT_FOLDERS.map((definition) => definition.key);
  const roots = await DriveFolder.find({ owner: userId, parent: null, systemKey: { $in: keys } }).lean();
  const rootIds = roots.map((folder) => folder._id);
  const childKeys = SMART_DOCUMENT_FOLDERS.flatMap((definition) => definition.children.map((child) => `${definition.key}-${child.key}`));
  const children = rootIds.length
    ? await DriveFolder.find({ owner: userId, parent: { $in: rootIds }, systemKey: { $in: childKeys } }).lean()
    : [];
  const fileCounts = rootIds.length || children.length
    ? await DriveFile.aggregate([
      { $match: { owner: userId, status: 'active', folder: { $in: [...rootIds, ...children.map((folder) => folder._id)] } } },
      { $group: { _id: '$folder', count: { $sum: 1 } } },
    ])
    : [];
  const rootByKey = new Map(roots.map((folder) => [folder.systemKey, folder]));
  const childByKey = new Map(children.map((folder) => [folder.systemKey, folder]));
  const countById = new Map(fileCounts.map((row) => [String(row._id), row.count]));
  return SMART_DOCUMENT_FOLDERS.map((definition) => ({
    key: definition.key,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    color: definition.color,
    folder: rootByKey.get(definition.key) || null,
    fileCount: (countById.get(String(rootByKey.get(definition.key)?._id)) || 0) + definition.children.reduce((total, child) => total + (countById.get(String(childByKey.get(`${definition.key}-${child.key}`)?._id)) || 0), 0),
    documentTypes: definition.children,
    children: definition.children.map((childDefinition) => {
      const systemKey = `${definition.key}-${childDefinition.key}`;
      const folder = childByKey.get(systemKey) || null;
      return { ...childDefinition, systemKey, folder, fileCount: countById.get(String(folder?._id)) || 0 };
    }),
    pinnedQuickAccess: SMART_DOCUMENT_PINNED_QUICK_ACCESS
      .filter((shortcut) => shortcut.key.startsWith(`${definition.key}-`))
      .map((shortcut) => {
        const folder = childByKey.get(shortcut.key) || null;
        return { ...shortcut, systemKey: shortcut.key, documentType: folder?.name || shortcut.name, folder, fileCount: countById.get(String(folder?._id)) || 0 };
      }),
  }));
}

export function smartDocumentFolderDefaults(folder) {
  const systemKey = String(folder?.systemKey || '');
  if (!systemKey.startsWith('smart-')) return null;
  const definition = SMART_DOCUMENT_FOLDERS.find((entry) => systemKey === entry.key || systemKey.startsWith(`${entry.key}-`));
  if (!definition) return null;
  const child = definition.children.find((entry) => systemKey === `${definition.key}-${entry.key}`);
  const financial = definition.key === 'smart-national-identity-financial-proofs'
    || systemKey === 'smart-standard-address-proofs-bank-passbook-statement';
  return {
    smartFolderKey: definition.key,
    documentType: child?.name || definition.name,
    category: 'legal',
    confidentiality: financial ? (definition.key === 'smart-national-identity-financial-proofs' ? 'identity_document' : 'financial_document') : 'legal_record',
  };
}

export async function createLegalTemplateFolders(user) {
  const roots = await ensurePersonalDrive(user._id);
  const legalRoot = roots.find((folder) => folder.systemKey === 'legal-documents');
  const template = new Set(LEGAL_TEMPLATES.tenant);
  if (user.landlordEnabled) LEGAL_TEMPLATES.landlord.forEach((x) => template.add(x));
  if (user.surveyorEnabled || user.role === 'surveyor') LEGAL_TEMPLATES.surveyor.forEach((x) => template.add(x));
  const existing = new Set((await DriveFolder.find({ owner: user._id, parent: legalRoot._id })).map((x) => x.name));
  const docs = [...template].filter((name) => !existing.has(name)).map((name) => ({ owner: user._id, parent: legalRoot._id, ancestors: [legalRoot._id], name, category: 'legal', sensitive: true, createdBy: user._id }));
  if (docs.length) await DriveFolder.insertMany(docs);
  return legalRoot;
}

export async function getStorageQuota(userOrId) {
  const user = typeof userOrId === 'object' && userOrId._id ? userOrId : await User.findById(userOrId);
  if (!user) throw new ApiError(404, 'User not found');
  const now = new Date();
  let bytes = DEFAULT_VAULT_STORAGE_MB * BYTES_PER_MB;
  // Administrators need operational headroom for moderation and support.
  if (user.role === 'admin') bytes = 100 * 1024 ** 3;

  const [landlord, surveyor] = await Promise.all([
    Subscription.findOne({ user: user._id, status: 'active', expiresAt: { $gt: now } }).sort({ expiresAt: -1 }).lean(),
    SurveyorSubscription.findOne({
      user: user._id,
      status: { $in: ['trial', 'active', 'expiring_soon', 'grace_period'] },
      $or: [{ graceEndsAt: { $gt: now } }, { expiresAt: { $gt: now } }],
    }).sort({ expiresAt: -1 }).populate('plan', 'limits').lean(),
  ]);

  if (landlord) {
    // Subscription.limits is the immutable plan snapshot captured at
    // checkout. The plan lookup keeps older subscriptions compatible.
    const configuredPlan = await LandlordPlan.findOne({ key: landlord.plan }).select('limits.storageMB').lean();
    const planMb = Number(landlord.limits?.storageMB || configuredPlan?.limits?.storageMB || 0);
    if (planMb > 0) bytes = Math.max(bytes, planMb * BYTES_PER_MB);
  }

  if (surveyor) {
    const planMb = Number(surveyor.planSnapshot?.limits?.storageMb || surveyor.plan?.limits?.storageMb || 0);
    if (planMb > 0) bytes = Math.max(bytes, planMb * BYTES_PER_MB);
  }
  return bytes;
}

export async function getUsage(userId) {
  return DriveUsage.findOneAndUpdate({ user: userId }, { $setOnInsert: { usedBytes: 0, trashBytes: 0 } }, { upsert: true, new: true });
}

export async function assertStorageAvailable(userId, incomingBytes) {
  const [quota, usage] = await Promise.all([getStorageQuota(userId), getUsage(userId)]);
  if (usage.usedBytes + Number(incomingBytes || 0) > quota) throw new ApiError(413, 'Storage limit reached. Clear files or upgrade your subscription.');
  return { quota, usage };
}

export async function changeUsage(userId, delta, category = 'other', trashDelta = 0) {
  const map = {
    document: 'documents', legal: 'documents', property: 'documents', survey: 'documents', image: 'images', video: 'videos', audio: 'audio',
    ...Object.fromEntries(TENANT_KYC_DOCUMENT_CATEGORIES.map((value) => [value, value === 'tenant_passport_photo' ? 'images' : 'documents'])),
  };
  const key = map[category] || 'other';
  return DriveUsage.findOneAndUpdate({ user: userId }, { $inc: { usedBytes: delta, trashBytes: trashDelta, [`byCategory.${key}`]: delta } }, { upsert: true, new: true });
}

export async function recalculateUsage(userId) {
  const [total] = await DriveFileVersion.aggregate([{ $match: { owner: userId } }, { $group: { _id: null, bytes: { $sum: '$sizeBytes' } } }]);
  const [trash] = await DriveFileVersion.aggregate([
    { $match: { owner: userId } },
    { $lookup: { from: 'drivefiles', localField: 'file', foreignField: '_id', as: 'fileRecord' } },
    { $unwind: '$fileRecord' },
    { $match: { 'fileRecord.status': 'trashed' } },
    { $group: { _id: null, bytes: { $sum: '$sizeBytes' } } },
  ]);
  return DriveUsage.findOneAndUpdate({ user: userId }, { usedBytes: total?.bytes || 0, trashBytes: trash?.bytes || 0, lastRecalculatedAt: new Date() }, { upsert: true, new: true });
}

export function categoryFromMime(mimeType = '', extension = '') {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (['.zip', '.rar', '.7z'].includes(extension)) return 'compressed';
  if (['.dxf', '.dwg', '.kml', '.kmz', '.geojson'].includes(extension)) return 'survey';
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('sheet') || mimeType.includes('presentation') || mimeType.startsWith('text/')) return 'document';
  return 'other';
}

export async function resolveFolderAncestors(ownerId, parentId) {
  if (!parentId) return [];
  const parent = await DriveFolder.findOne({ _id: parentId, owner: ownerId, status: { $ne: 'trashed' } });
  if (!parent) throw new ApiError(404, 'Destination folder not found');
  return [...(parent.ancestors || []), parent._id];
}

export async function getItem(itemType, itemId, selectStorage = false) {
  const Model = itemType === 'folder' ? DriveFolder : DriveFile;
  let query = Model.findById(itemId);
  if (selectStorage && itemType === 'file') query = query.select('+storageKey');
  const item = await query;
  if (!item) throw new ApiError(404, `${itemType === 'folder' ? 'Folder' : 'File'} not found`);
  return item;
}

export async function resolveItemAccess(user, itemType, itemId, required = 'view', selectStorage = false) {
  const item = await getItem(itemType, itemId, selectStorage);
  if (user?.role === 'admin' && required === 'admin') return { item, permission: 'admin' };
  if (user && String(item.owner) === String(user._id)) return { item, permission: 'owner' };
  const permissionCapabilities = {
    viewer: ['view', 'preview'], commenter: ['view', 'preview', 'comment'], downloader: ['view', 'preview', 'download'],
    uploader: ['view', 'preview', 'upload'], editor: ['view', 'preview', 'download', 'comment', 'upload', 'edit', 'rename', 'move'],
    manager: ['view', 'preview', 'download', 'comment', 'upload', 'edit', 'rename', 'move', 'delete', 'share'],
    co_owner: ['view', 'preview', 'download', 'comment', 'upload', 'edit', 'rename', 'move', 'delete', 'share', 'manage_permissions'],
  };
  if (user) {
    const principal = { $or: [{ granteeUser: user._id }, { granteeEmail: user.email.toLowerCase() }] };
    const active = { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };
    let share = await DriveShare.findOne({ itemType, itemId: item._id, revokedAt: null, $and: [principal, active] });
    if (!share) {
      let folderIds = [];
      if (itemType === 'file' && item.folder) {
        const folder = await DriveFolder.findById(item.folder).select('ancestors');
        folderIds = folder ? [...folder.ancestors, folder._id] : [];
      } else if (itemType === 'folder') folderIds = [...(item.ancestors || [])];
      if (folderIds.length) share = await DriveShare.findOne({ itemType: 'folder', itemId: { $in: folderIds }, revokedAt: null, $and: [principal, active] }).sort({ createdAt: -1 });
    }
    if (share) {
      const allowed = share.capabilities?.[required] || permissionCapabilities[share.permission]?.includes(required);
      if (allowed || required === 'view') return { item, permission: share.permission, share };
    }
  }
  throw new ApiError(403, 'You do not have access to this item');
}

export async function createPublicToken(item, options = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const passwordHash = options.password ? await bcrypt.hash(String(options.password), 12) : undefined;
  const list = (value, transform = (entry) => entry) => (Array.isArray(value) ? value : String(value || '').split(',')).map((entry) => transform(String(entry).trim())).filter(Boolean);
  const slug = String(options.slug || item.publicLink?.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || undefined;
  item.publicLink = {
    ...(item.publicLink?.toObject?.() || item.publicLink || {}), enabled: true, tokenHash, slug,
    passwordHash, startsAt: options.startsAt || undefined, expiresAt: options.expiresAt || undefined,
    allowDownload: options.allowDownload !== false, allowPreview: options.allowPreview !== false,
    allowUpload: Boolean(options.allowUpload), maxViews: Number(options.maxViews) || undefined, maxDownloads: Number(options.maxDownloads) || undefined,
    allowedEmails: list(options.allowedEmails, (entry) => entry.toLowerCase()),
    allowedDomains: list(options.allowedDomains, (entry) => entry.toLowerCase().replace(/^@/, '')),
    allowedCountries: list(options.allowedCountries, (entry) => entry.toUpperCase()),
    watermark: options.watermark || {}, views: 0, downloads: 0, regeneratedAt: new Date(), revokedAt: undefined,
  };
  await item.save();
  return token;
}

export async function validatePublicAccess(itemType, tokenOrSlug, password, action = 'preview', context = {}) {
  const Model = itemType === 'folder' ? DriveFolder : DriveFile;
  const tokenHash = crypto.createHash('sha256').update(String(tokenOrSlug)).digest('hex');
  const item = await Model.findOne({ $or: [{ 'publicLink.tokenHash': tokenHash }, { 'publicLink.slug': String(tokenOrSlug).toLowerCase() }], 'publicLink.enabled': true }).select(itemType === 'file' ? '+storageKey +publicLink.tokenHash +publicLink.passwordHash' : '+publicLink.tokenHash +publicLink.passwordHash');
  if (!item || item.publicLink?.revokedAt) throw new ApiError(404, 'Public link not found or revoked');
  const now = new Date();
  if (item.publicLink.startsAt && item.publicLink.startsAt > now) throw new ApiError(403, 'This link is not active yet');
  if (item.publicLink.expiresAt && item.publicLink.expiresAt < now) throw new ApiError(410, 'This public link has expired');
  if (action === 'preview' && item.publicLink.maxViews && item.publicLink.views >= item.publicLink.maxViews) throw new ApiError(410, 'Maximum public views reached');
  if (action === 'download' && item.publicLink.maxDownloads && item.publicLink.downloads >= item.publicLink.maxDownloads) throw new ApiError(410, 'Maximum downloads reached');
  if (item.publicLink.passwordHash && !(await bcrypt.compare(String(password || ''), item.publicLink.passwordHash))) throw new ApiError(401, 'A valid link password is required');
  const requestedEmail = String(context.email || '').trim().toLowerCase();
  const requestedCountry = String(context.country || '').trim().toUpperCase();
  const allowedEmails = (item.publicLink.allowedEmails || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean);
  const allowedDomains = (item.publicLink.allowedDomains || []).map((value) => String(value).trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  const allowedCountries = (item.publicLink.allowedCountries || []).map((value) => String(value).trim().toUpperCase()).filter(Boolean);
  if ((allowedEmails.length || allowedDomains.length) && !requestedEmail) throw new ApiError(401, 'An authorised email address is required');
  if (allowedEmails.length && !allowedEmails.includes(requestedEmail)) throw new ApiError(403, 'This email address is not authorised for the link');
  if (allowedDomains.length) {
    const domain = requestedEmail.split('@')[1] || '';
    if (!allowedDomains.includes(domain)) throw new ApiError(403, 'This email domain is not authorised for the link');
  }
  if (allowedCountries.length && (!requestedCountry || !allowedCountries.includes(requestedCountry))) throw new ApiError(403, 'This link is unavailable in your region');
  if (action === 'download' && !item.publicLink.allowDownload) throw new ApiError(403, 'Downloads are disabled for this link');
  if (['preview', 'content'].includes(action) && !item.publicLink.allowPreview) throw new ApiError(403, 'Preview is disabled for this link');
  return item;
}

export async function logDriveActivity(req, item, action, metadata = {}) {
  await DriveActivity.create({ owner: item?.owner, actor: req.user?._id, itemType: item?.name ? (item.mimeType ? 'file' : 'folder') : 'system', itemId: item?._id, action, ip: req.ip, device: req.headers['user-agent'], metadata });
}

export function purgeDate(days = env.TRASH_RETENTION_DAYS) { return new Date(Date.now() + Number(days) * 86400000); }

export function fileExtension(name = '') { return path.extname(name).toLowerCase(); }
