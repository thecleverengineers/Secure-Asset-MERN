import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import surveyRoutes from './routes/surveyRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import surveyorSubscriptionRoutes from './routes/surveyorSubscriptionRoutes.js';
import surveyWorkflowRoutes from './routes/surveyWorkflowRoutes.js';
import subscriptionPaymentRoutes from './routes/subscriptionPaymentRoutes.js';
import driveRoutes from './routes/driveRoutes.js';
import drivePublicRoutes from './routes/drivePublicRoutes.js';
import siteRoutes from './routes/siteRoutes.js';
import propertyManagementRoutes from './routes/propertyManagementRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import messagingRoutes from './routes/messagingRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import googleMapsRoutes from './routes/googleMapsRoutes.js';
import rentalPaymentRoutes from './routes/rentalPaymentRoutes.js';
import rolePermissionRoutes from './routes/rolePermissionRoutes.js';
import agreementRoutes from './routes/agreementRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import backupRecoveryRoutes from './routes/backupRecoveryRoutes.js';
import { notFound, errorHandler } from './middleware/error.js';
import { requestContext, rejectUnsafeObjectKeys } from './middleware/requestContext.js';
import { mountProductionSpa } from './middleware/spa.js';
import { csrfProtection } from './middleware/csrf.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com', 'https://maps.googleapis.com', 'https://maps.gstatic.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'https:'],
        frameSrc: ["'self'", 'blob:', 'https://checkout.razorpay.com', 'https://api.razorpay.com', 'https://www.google.com', 'https://maps.google.com'],
        fontSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", ...env.CLIENT_URL.split(',').map((value) => value.trim()).filter(Boolean), 'https://maps.googleapis.com', 'https://maps.gstatic.com', 'https://maps.google.com', 'https://www.google.com', 'https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.google.com', 'ws:', 'wss:'],
        formAction: ["'self'"],
        upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(cors({ origin(origin, cb) { const allowed = env.CLIENT_ORIGINS; if (!origin || allowed.includes(origin)) cb(null, true); else cb(new Error('Origin not allowed')); }, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(rejectUnsafeObjectKeys);
  app.use(cookieParser());
  app.use(csrfProtection);
  morgan.token('request-id', (req) => req.id);
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? ':remote-addr - :request-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms' : 'dev'));
  const health = (_req, res, readyOnly = true) => {
    const databaseReady = mongoose.connection.readyState === 1;
    const buildReady = env.NODE_ENV !== 'production' || fs.existsSync(path.resolve('dist', 'index.html'));
    const ready = databaseReady && buildReady;
    res.status(readyOnly && !ready ? 503 : 200).json({
      success: readyOnly ? ready : true,
      service: 'secureasset-api',
      status: ready ? 'ready' : 'degraded',
      database: databaseReady ? 'connected' : 'disconnected',
      build: buildReady ? 'available' : 'missing',
      runtime: { node: process.versions.node, environment: env.NODE_ENV },
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    });
  };
  app.get('/api/health/live', (req, res) => health(req, res, false));
  app.get('/api/health/ready', (req, res) => health(req, res, true));
  app.get('/api/health', (req, res) => health(req, res, true));
  const siteAssetDir = env.CMS_ASSET_DIR;
  fs.mkdirSync(siteAssetDir, { recursive: true });
  app.use('/site-assets', express.static(siteAssetDir, { maxAge: env.NODE_ENV === 'production' ? '7d' : '1h', immutable: false, etag: true, dotfiles: 'deny', fallthrough: false }));
  if (env.LEGACY_PUBLIC_UPLOADS && env.NODE_ENV !== 'production') app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR), { maxAge: '1h', dotfiles: 'deny' }));
  app.use('/api/v1/auth', authRoutes);
  // Compatibility path for older/static frontend builds that used /api/auth.
  // Keep this alias during upgrades so login and registration do not fail with
  // a misleading 404 while the browser cache or CDN still serves an old bundle.
  app.use('/api/auth', authRoutes);
  app.use('/api/v1/public', publicRoutes);
  app.use('/api/v1/site', siteRoutes);
  app.use('/api/v1/permissions', rolePermissionRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/rentals', rentalPaymentRoutes);
  app.use('/api/v1/resources', resourceRoutes);
  app.use('/api/v1/uploads', uploadRoutes);
  app.use('/api/v1/attendance', attendanceRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/surveys', surveyRoutes);
  app.use('/api/v1/subscriptions', subscriptionRoutes);
  app.use('/api/v1/surveyor-subscriptions', surveyorSubscriptionRoutes);
  app.use('/api/v1/survey-workflow', surveyWorkflowRoutes);
  app.use('/api/v1/subscription-payments', subscriptionPaymentRoutes);
  app.use('/api/v1/drive', driveRoutes);
  app.use('/api/v1/property-management', propertyManagementRoutes);
  app.use('/api/v1/agreements', agreementRoutes);
  app.use('/api/v1/wishlist', wishlistRoutes);
  app.use('/api/v1/backup-recovery', backupRecoveryRoutes);
  app.use('/api/v1/search', searchRoutes);
  app.use('/api/v1/messaging', messagingRoutes);
  app.use('/api/v1/integrations', integrationRoutes);
  app.use('/api/v1/maps', googleMapsRoutes);
  app.use('/api/v1/public-drive', drivePublicRoutes);
  const dist = path.resolve('dist');
  if (env.NODE_ENV === 'production') mountProductionSpa(app, dist);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
