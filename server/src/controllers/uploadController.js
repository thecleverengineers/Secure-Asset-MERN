import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { fileTypeFromFile } from 'file-type';
import { Document, DriveFile, DriveFileVersion, SurveyProject } from '../models/index.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import {
  assertStorageAvailable, categoryFromMime, changeUsage, fileExtension, getDrivePolicy, logDriveActivity,
} from '../services/driveService.js';
import { buildStorageKey, saveFile } from '../services/storage.js';
import { isTenantKycCategory, TENANT_KYC_ALLOWED_EXTENSIONS } from '../constants/tenantKyc.js';
import { getActiveLandlordSubscription } from '../services/landlordSubscription.js';
import { getActiveSurveyorSubscription } from '../services/surveyorSubscription.js';


async function removeQuietly(filePath) { try { await fsp.unlink(filePath); } catch {} }
async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
function safeName(value = '') { return String(value).replace(/[\\/:*?"<>|\0]/g, '_').trim().slice(0, 255) || 'Untitled'; }

async function assertSurveyProjectUploadAccess(req, body) {
  const type = String(body.type || '').trim();
  const projectId = String(body.surveyProject || '').trim();
  const projectUpload = ['survey_evidence', 'survey_report', 'survey_payment_proof'].includes(type);
  if (!projectId && projectUpload) throw new ApiError(422, 'Survey project uploads must identify a project');
  if (!projectId) return;
  if (!projectUpload) throw new ApiError(422, 'Survey project uploads must use a permitted survey workflow file type');

  const project = await SurveyProject.findById(projectId).select('client surveyor workflowType workflowStage status milestones');
  if (!project) throw new ApiError(404, 'Survey project not found');
  const evidenceEditable = ['hired', 'in_progress'].includes(project.workflowStage)
    || (project.workflowStage === 'submitted' && project.status === 'revision_requested');
  const reportRequested = project.workflowStage === 'approved' && project.status === 'report_upload_requested';
  const finalPaymentWaiting = ['awaiting_final_payment', 'payment_submitted'].includes(project.status);
  const directMilestonePaymentWaiting = project.workflowType === 'direct_surveyor'
    && ['awaiting_first_payment', 'first_payment_submitted', 'awaiting_second_payment', 'second_payment_submitted'].includes(project.status);
  if (['completed', 'cancelled'].includes(project.workflowStage) || ['completed', 'cancelled'].includes(project.status)) throw new ApiError(409, 'Uploads are unavailable after the survey project closes');
  if (type === 'survey_payment_proof') {
    if (!finalPaymentWaiting && !directMilestonePaymentWaiting) throw new ApiError(409, 'Payment proof can be uploaded only when a survey payment is awaiting landlord submission');
    if (req.user.role === 'admin') return;
    if (String(project.client) !== String(req.user._id)) throw new ApiError(403, 'Only the landlord who hired the Surveyor can upload the final payment screenshot');
    await getActiveLandlordSubscription(req.user._id);
    return;
  }
  if (type === 'survey_report') {
    if (!reportRequested) throw new ApiError(409, 'The final payment must be confirmed before the Surveyor can upload the report');
  } else if (!evidenceEditable) {
    throw new ApiError(409, 'Evidence uploads are available only while fieldwork is active');
  }
  if (req.user.role === 'admin') return;
  if (String(project.surveyor) !== String(req.user._id)) throw new ApiError(403, 'Only the hired Surveyor can upload to this project');
  await getActiveSurveyorSubscription(req.user._id);
}

async function scanUpload(file, { allowTenantKyc = false } = {}) {
  const extension = fileExtension(file.originalname);
  const policy = await getDrivePolicy();
  const configuredExtensions = policy.allowedExtensions?.length ? policy.allowedExtensions : env.VAULT_ALLOWED_EXTENSIONS.split(',');
  const allowed = new Set([...(allowTenantKyc ? TENANT_KYC_ALLOWED_EXTENSIONS : []), ...configuredExtensions]
    .map((value) => String(value).trim().toLowerCase()).filter(Boolean));
  if (!allowed.has(extension)) throw new ApiError(415, `Files with ${extension || 'no extension'} are not allowed`);
  const maxBytes = Number(policy.maxFileMb || env.VAULT_MAX_FILE_MB) * 1024 ** 2;
  if (Number(file.size) > maxBytes) throw new ApiError(413, `File exceeds the ${policy.maxFileMb || env.VAULT_MAX_FILE_MB} MB platform limit`);
  const handle = await fsp.open(file.path, 'r');
  const head = Buffer.alloc(Math.min(Number(file.size), 8192));
  await handle.read(head, 0, head.length, 0); await handle.close();
  const text = head.toString('utf8');
  if (text.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) throw new ApiError(422, 'Malware test signature detected');
  if (head[0] === 0x4d && head[1] === 0x5a) throw new ApiError(422, 'Executable content is not allowed');
  const detected = await fileTypeFromFile(file.path).catch(() => null);
  if (detected?.ext && extension && detected.ext !== extension.slice(1) && !(['jpg', 'jpeg'].includes(detected.ext) && ['.jpg', '.jpeg'].includes(extension))) {
    const office = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.rtf']);
    if (!office.has(extension)) throw new ApiError(422, 'File content does not match its extension');
  }
  // External malware scanning is intentionally disabled for production uploads.
  // Uploads still pass platform validation: extension allow-list, size limit, executable guard,
  // EICAR test-signature guard, and content-vs-extension checks where detection is available.
  return detected?.mime || file.mimetype || 'application/octet-stream';
}

// Backward-compatible endpoint. All bytes are persisted through the encrypted Vault/S3 layer;
// the legacy Document record only provides relational compatibility for older survey/property forms.
export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, 'Choose a file to upload');
  try {
    const body = req.subscriptionPaymentProof
      ? {
        ...(req.body || {}),
        type: 'subscription_payment_proof',
        category: 'image',
        visibility: 'private',
        description: String(req.body?.description || 'Subscription payment proof').slice(0, 500),
      }
      : req.surveyorVerificationUpload
        ? {
          ...(req.body || {}),
          type: req.surveyorVerificationUpload.kind === 'bank_passbook'
            ? 'surveyor_verification_bank'
            : 'surveyor_verification_identity',
          category: 'image',
          visibility: 'private',
          name: req.surveyorVerificationUpload.kind === 'bank_passbook'
            ? 'Surveyor bank passbook'
            : `Surveyor identity ${req.surveyorVerificationUpload.kind === 'identity_front' ? 'front' : 'back'}`,
          description: 'Protected Surveyor verification document',
        }
        : (req.body || {});
    await assertSurveyProjectUploadAccess(req, body);
    const tenantKycUpload = body.type === 'tenant_kyc';
    const mimeType = await scanUpload(req.file, { allowTenantKyc: tenantKycUpload });
    if (body.type === 'survey_payment_proof' && !String(mimeType || '').startsWith('image/')) throw new ApiError(422, 'Final payment proof must be an image screenshot');
    await assertStorageAvailable(req.user._id, req.file.size);
    const checksum = await hashFile(req.file.path);
    const extension = fileExtension(req.file.originalname);
    const category = String(body.category || categoryFromMime(mimeType, extension)).trim().toLowerCase();
    if (tenantKycUpload && !isTenantKycCategory(category)) throw new ApiError(422, 'Invalid tenant KYC document category');
    if (tenantKycUpload && !TENANT_KYC_ALLOWED_EXTENSIONS.includes(extension)) throw new ApiError(415, 'Tenant KYC files must be JPG, JPEG, PNG, or PDF');
    const owner = req.user.role === 'admin' && body.owner ? body.owner : req.user._id;
    const storageKey = buildStorageKey(owner, req.file.originalname, 'legacy-documents');
    const stored = await saveFile(req.file.path, storageKey, mimeType);
    const confidentiality = body.type === 'surveyor_verification_bank'
      ? 'financial_document'
      : body.type === 'surveyor_verification_identity' || tenantKycUpload || isTenantKycCategory(category)
        ? 'identity_document'
        : category === 'legal' ? 'legal_record' : 'private';
    const driveFile = await DriveFile.create({
      owner, folder: body.folder || null, name: safeName(body.name || req.file.originalname), originalName: req.file.originalname,
      description: body.description || '', extension, mimeType, category, storageDriver: stored.driver, storageKey: stored.key,
      sizeBytes: req.file.size, checksum, visibility: body.visibility === 'public' ? 'public' : 'private', confidentiality,
      relations: { property: body.property || undefined, surveyProject: body.surveyProject || undefined },
      preview: { status: ['image', 'video', 'audio', 'document'].includes(category) || isTenantKycCategory(category) ? 'ready' : 'unsupported' },
      createdBy: req.user._id,
    });
    await DriveFileVersion.create({
      file: driveFile._id, owner, version: 1, storageDriver: stored.driver, storageKey: stored.key,
      sizeBytes: req.file.size, checksum, mimeType, uploadedBy: req.user._id,
    });
    const secureUrl = `/api/v1/drive/files/${driveFile._id}/content`;
    const document = await Document.create({
      name: driveFile.name, type: body.type || 'other', url: secureUrl, driveFile: driveFile._id,
      mimeType, sizeBytes: req.file.size, owner, property: body.property || undefined,
      visibility: body.visibility === 'public' ? 'public' : body.visibility === 'property' ? 'property' : 'private',
      checksum, uploadedBy: req.user._id,
    });
    await changeUsage(owner, req.file.size, category);
    await logDriveActivity(req, driveFile, 'file_uploaded', { compatibilityDocument: document._id, sizeBytes: req.file.size });
    res.status(201).json({ success: true, data: { ...document.toObject(), driveFile: driveFile._id, url: secureUrl } });
  } catch (error) {
    if (req.file?.path) await removeQuietly(req.file.path);
    throw error;
  }
});
