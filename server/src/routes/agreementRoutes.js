import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { requireCapabilityPermission } from '../middleware/rolePermission.js';
import { secureMultipartLimits } from '../middleware/uploadSecurity.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  approveAgreementRequest, cancelAgreementCycle, closeAgreementCycle, createAgreementTemplate,
  deleteAgreementTemplate, getAgreementPartyMark, getAgreementSecurityDepositProof, listAgreementRequests, listAgreementTemplates,
  prepareAgreementRequest, previewAgreementRequest, rejectAgreementCancellation, rejectAgreementSecurityDeposit,
  renewAgreementCycle, requestAgreementCancellation, sendInternalAgreementRequest, submitAgreementSecurityDeposit,
  updateAgreementTemplate, uploadFirstPartyMark, uploadSecondPartySignature,
} from '../controllers/agreementController.js';

// Administrators may inspect the workflow during support, while the normal
// management surface is available only to an active landlord capability.
const landlordPermission = (action = 'view') => asyncHandler(async (req, res, next) => {
  if (String(req.user?.role || '').toLowerCase() === 'admin') return next();
  return requireCapabilityPermission('landlord', 'module:agreement-templates', action)(req, res, next);
});

const router = Router();
const depositProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: secureMultipartLimits({ fileSize: 8 * 1024 * 1024, fields: 5 }),
  fileFilter: (_req, file, callback) => {
    const accepted = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(String(file.mimetype || '').toLowerCase());
    callback(accepted ? null : new Error('Payment proof must be a PNG, JPEG, WebP or PDF file'), accepted);
  },
});

const agreementMarkUpload = multer({
  storage: multer.memoryStorage(),
  limits: secureMultipartLimits({ fileSize: 5 * 1024 * 1024, fields: 4 }),
  fileFilter: (_req, file, callback) => {
    const accepted = ['image/png', 'image/jpeg'].includes(String(file.mimetype || '').toLowerCase());
    callback(accepted ? null : new Error('Signature or stamp/seal must be a PNG or JPEG image'), accepted);
  },
});
router.use(authenticate);
router.get('/templates', landlordPermission('view'), listAgreementTemplates);
router.post('/templates', landlordPermission('create'), createAgreementTemplate);
router.patch('/templates/:id', landlordPermission('edit'), updateAgreementTemplate);
router.delete('/templates/:id', landlordPermission('delete'), deleteAgreementTemplate);
router.get('/requests', listAgreementRequests);
router.post('/requests', landlordPermission('create'), prepareAgreementRequest);
router.post('/requests/:id/first-party-mark', landlordPermission('edit'), agreementMarkUpload.single('file'), uploadFirstPartyMark);
router.post('/requests/:id/send', landlordPermission('create'), sendInternalAgreementRequest);
router.post('/requests/:id/second-party-signature', agreementMarkUpload.single('file'), uploadSecondPartySignature);
router.post('/requests/:id/security-deposit', depositProofUpload.single('file'), submitAgreementSecurityDeposit);
router.get('/requests/:id/security-deposit-proof', getAgreementSecurityDepositProof);
router.post('/requests/:id/security-deposit/reject', landlordPermission('edit'), rejectAgreementSecurityDeposit);
router.post('/requests/:id/approve', landlordPermission('edit'), approveAgreementRequest);
router.post('/requests/:id/renew', renewAgreementCycle);
router.post('/requests/:id/cancellation-request', requestAgreementCancellation);
router.post('/requests/:id/cancellation-request/reject', landlordPermission('edit'), rejectAgreementCancellation);
router.post('/requests/:id/cancel', landlordPermission('edit'), cancelAgreementCycle);
router.post('/requests/:id/close', landlordPermission('edit'), closeAgreementCycle);
router.get('/requests/:id/preview', previewAgreementRequest);
router.get('/requests/:id/marks/:party', getAgreementPartyMark);

export default router;
