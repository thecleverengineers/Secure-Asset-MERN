import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { requireFeaturePermission, requireSubscriptionPaymentProofUpload, requireSurveyorVerificationDocumentUpload } from '../middleware/rolePermission.js';
import { secureMultipartLimits } from '../middleware/uploadSecurity.js';
import { uploadDocument } from '../controllers/uploadController.js';
import { TENANT_KYC_ALLOWED_EXTENSIONS } from '../constants/tenantKyc.js';

fs.mkdirSync(env.VAULT_TEMP_DIR, { recursive: true, mode: 0o700 });
const allowedExtensions = new Set(env.VAULT_ALLOWED_EXTENSIONS.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, env.VAULT_TEMP_DIR),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: secureMultipartLimits({ fileSize: env.VAULT_MAX_FILE_MB * 1024 * 1024, fields: 12, fieldSize: 64 * 1024 }),
  fileFilter: (_req, file, callback) => new Set([...allowedExtensions, ...TENANT_KYC_ALLOWED_EXTENSIONS]).has(path.extname(file.originalname).toLowerCase())
    ? callback(null, true) : callback(new Error('Unsupported file type')),
});
const proofUpload = multer({
  storage,
  limits: secureMultipartLimits({ fileSize: Math.min(Math.max(Number(env.VAULT_MAX_FILE_MB) || 8, 1), 8) * 1024 * 1024, fields: 6 }),
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(extension) && String(file.mimetype || '').startsWith('image/');
    isImage ? callback(null, true) : callback(new Error('Subscription payment proof must be a PNG, JPG, JPEG, or WebP image'));
  },
});
const verificationDocumentUpload = multer({
  storage,
  limits: secureMultipartLimits({ fileSize: Math.min(Math.max(Number(env.VAULT_MAX_FILE_MB) || 8, 1), 8) * 1024 * 1024, fields: 4 }),
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.webp'].includes(extension) && String(file.mimetype || '').startsWith('image/');
    isImage ? callback(null, true) : callback(new Error('Verification documents must be PNG, JPG, JPEG, or WebP images'));
  },
});
const router = Router();
router.post('/document', authenticate, requireFeaturePermission('module:documents', 'create'), upload.single('file'), uploadDocument);
router.post('/subscription-payment-proof', authenticate, requireSubscriptionPaymentProofUpload, proofUpload.single('file'), uploadDocument);
router.post('/surveyor-verification-document', authenticate, requireSurveyorVerificationDocumentUpload, verificationDocumentUpload.single('file'), uploadDocument);
export default router;
