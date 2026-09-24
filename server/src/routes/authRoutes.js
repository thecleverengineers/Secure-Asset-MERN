import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import {
  register, verifyRegistration, resendRegistrationOtp, login, completeTwoFactorLogin, refresh, logout, me, updateMe, changePassword,
  sendOtp, verifyOtp, forgotPassword, resetPassword, getSecurityOverview, beginTwoFactorSetup,
  enableTwoFactor, disableTwoFactor, regenerateBackupCodes, revokeSession, revokeOtherSessions,
  beginDeviceUnlockSetup, completeDeviceUnlockSetup, beginDeviceUnlockAuthentication, completeDeviceUnlockAuthentication,
  resetDeviceUnlock, requestVaultPinOtp, setVaultPin, unlockVaultPin, requestContactChange, verifyContactChange,
} from '../controllers/authController.js';
import { listAdminSessions, revokeAdminSession, revokeAdminUserSessions } from '../controllers/adminSessionController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { secureMultipartLimits } from '../middleware/uploadSecurity.js';
import { uploadProfileAvatar } from '../controllers/siteAssetController.js';

const router = Router();
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: secureMultipartLimits({ fileSize: 8 * 1024 * 1024, fields: 4 }) });
const standardLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const credentialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true });
const otpRequestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const otpVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true });

router.post('/register', otpRequestLimiter, register);
router.post('/register/verify', otpVerifyLimiter, verifyRegistration);
router.post('/register/resend-otp', otpRequestLimiter, resendRegistrationOtp);
router.post('/login', credentialLimiter, login);
router.post('/two-factor/challenge', otpVerifyLimiter, completeTwoFactorLogin);
router.post('/refresh', credentialLimiter, refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.patch('/me', authenticate, standardLimiter, updateMe);
router.post('/me/avatar', authenticate, standardLimiter, avatarUpload.single('file'), uploadProfileAvatar);
router.post('/change-password', authenticate, credentialLimiter, changePassword);
router.post('/device-unlock/setup/options', authenticate, credentialLimiter, beginDeviceUnlockSetup);
router.post('/device-unlock/setup/verify', authenticate, credentialLimiter, completeDeviceUnlockSetup);
router.post('/device-unlock/authentication/options', authenticate, standardLimiter, beginDeviceUnlockAuthentication);
router.post('/device-unlock/authentication/verify', authenticate, credentialLimiter, completeDeviceUnlockAuthentication);
router.delete('/device-unlock', authenticate, credentialLimiter, resetDeviceUnlock);
router.post('/vault-pin/otp', authenticate, otpRequestLimiter, requestVaultPinOtp);
router.post('/vault-pin/set', authenticate, credentialLimiter, setVaultPin);
router.post('/vault-pin/unlock', authenticate, credentialLimiter, unlockVaultPin);
router.post('/contact-change/request', authenticate, credentialLimiter, requestContactChange);
router.post('/contact-change/verify', authenticate, otpVerifyLimiter, verifyContactChange);
router.post('/send-otp', otpRequestLimiter, sendOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyOtp);
router.post('/forgot-password', otpRequestLimiter, forgotPassword);
router.post('/reset-password', credentialLimiter, resetPassword);
router.get('/security', authenticate, getSecurityOverview);
router.post('/two-factor/setup', authenticate, credentialLimiter, beginTwoFactorSetup);
router.post('/two-factor/enable', authenticate, credentialLimiter, enableTwoFactor);
router.post('/two-factor/disable', authenticate, credentialLimiter, disableTwoFactor);
router.post('/two-factor/backup-codes', authenticate, credentialLimiter, regenerateBackupCodes);
router.delete('/sessions/:sessionId', authenticate, standardLimiter, revokeSession);
router.post('/sessions/revoke-others', authenticate, credentialLimiter, revokeOtherSessions);
router.get('/admin/sessions', authenticate, authorize('admin'), standardLimiter, listAdminSessions);
router.delete('/admin/sessions/:sessionId', authenticate, authorize('admin'), standardLimiter, revokeAdminSession);
router.post('/admin/users/:userId/sessions/revoke', authenticate, authorize('admin'), credentialLimiter, revokeAdminUserSessions);
export default router;
