import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import express, { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { authenticate, authorize, requireDeviceUnlock } from '../middleware/auth.js';
import { requireFeaturePermission } from '../middleware/rolePermission.js';
import { vaultSecurityHeaders } from '../middleware/vaultSecurity.js';
import { secureMultipartLimits } from '../middleware/uploadSecurity.js';
import {
  bootstrapDrive, createTemplates, listItems, getBreadcrumbs, createFolder, updateFolder, duplicateFolder,
  uploadFile, createScannedPdf, createGeneratedDocument, getFile, streamFile, updateFile, uploadNewVersion, restoreVersion, setFileApproval,
  moveToTrash, restoreItem, permanentlyDelete, shareItem, listShares, revokeShare, sharedWithMe,
  createPublicLink, revokePublicLink, addComment, listComments, resolveComment, searchDrive, getActivity,
  getAnalytics, downloadFolder, initiateChunkedUpload, uploadChunk, completeChunkedUpload, cancelChunkedUpload,
  bulkAction, reportContent, adminDriveOverview, adminRecalculateUsage, adminListDriveUsage, adminListContentReports, adminReviewContentReport, adminGetDrivePolicy, adminUpdateDrivePolicy,
} from '../controllers/driveController.js';

fs.mkdirSync(env.VAULT_TEMP_DIR, { recursive: true, mode: 0o700 });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.VAULT_TEMP_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({ storage, limits: secureMultipartLimits({ fileSize: env.VAULT_MAX_FILE_MB * 1024 * 1024, files: 50, fields: 16, fieldSize: 64 * 1024 }) });
const router = Router();
router.use(authenticate, requireDeviceUnlock, vaultSecurityHeaders);
router.use(requireFeaturePermission('module:documents'));
router.get('/bootstrap', bootstrapDrive);
router.post('/legal-templates', createTemplates);
router.get('/items', listItems);
router.get('/search', searchDrive);
router.get('/shared-with-me', sharedWithMe);
router.get('/activity', getActivity);
router.get('/analytics', getAnalytics);
router.post('/bulk', bulkAction);
router.post('/folders', createFolder);
router.get('/folders/:id/breadcrumbs', getBreadcrumbs);
router.patch('/folders/:id', updateFolder);
router.post('/folders/:id/duplicate', duplicateFolder);
router.get('/folders/:id/download', downloadFolder);
router.post('/files', upload.single('file'), uploadFile);
router.post('/scan-to-pdf', upload.array('pages', 50), createScannedPdf);
router.post('/generated-documents', createGeneratedDocument);
router.get('/files/:id', getFile);
router.get('/files/:id/content', streamFile);
router.patch('/files/:id', updateFile);
router.post('/files/:id/versions', upload.single('file'), uploadNewVersion);
router.post('/files/:id/versions/:version/restore', restoreVersion);
router.post('/files/:id/approval', setFileApproval);
router.get('/files/:id/comments', listComments);
router.post('/files/:id/comments', addComment);
router.post('/comments/:commentId/resolve', resolveComment);
router.post('/:type/:id/trash', moveToTrash);
router.post('/:type/:id/restore', restoreItem);
router.delete('/:type/:id/permanent', permanentlyDelete);
router.get('/:type/:id/shares', listShares);
router.post('/:type/:id/shares', shareItem);
router.delete('/shares/:shareId', revokeShare);
router.post('/:type/:id/public-link', createPublicLink);
router.delete('/:type/:id/public-link', revokePublicLink);
router.post('/:type/:id/report', reportContent);
const chunkLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 2000, standardHeaders: true, legacyHeaders: false });
router.post('/uploads/initiate', initiateChunkedUpload);
router.put('/uploads/:sessionId/chunks/:index', chunkLimiter, express.raw({ type: 'application/octet-stream', limit: `${env.VAULT_CHUNK_MB}mb` }), uploadChunk);
router.post('/uploads/:sessionId/complete', completeChunkedUpload);
router.delete('/uploads/:sessionId', cancelChunkedUpload);
router.get('/admin/overview', authorize('admin'), adminDriveOverview);
router.get('/admin/usage', authorize('admin'), adminListDriveUsage);
router.get('/admin/reports', authorize('admin'), adminListContentReports);
router.post('/admin/reports/:id/review', authorize('admin'), adminReviewContentReport);
router.get('/admin/policy', authorize('admin'), adminGetDrivePolicy);
router.patch('/admin/policy', authorize('admin'), adminUpdateDrivePolicy);
router.post('/admin/users/:userId/recalculate', authorize('admin'), adminRecalculateUsage);
export default router;
