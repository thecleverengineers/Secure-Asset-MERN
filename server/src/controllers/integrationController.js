import { z } from 'zod';
import { IntegrationSetting, SiteSetting, AuditLog } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import {
  buildFast2SmsSettingsUpdate, getFast2SmsConfiguration,
  normalizeIndianMobile, sendFast2SmsOtp, sendFast2SmsWhatsApp,
} from '../services/fast2sms.js';
import { buildRazorpaySettingsUpdate, publicRazorpayConfig } from '../services/razorpay.js';
import { buildMapsSettingsUpdate, getMapsConfiguration, invalidateMapsConfigurationCache } from '../services/maps.js';
import { emitSiteChanged } from '../services/realtime.js';

const settingsSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string().url(),
  route: z.string().min(1).max(30),
  senderId: z.string().min(1).max(20),
  messageId: z.string().min(1).max(80),
  variablesTemplate: z.string().max(500).default('{otp}'),
  scheduleTime: z.string().max(80).optional().default(''),
  whatsappEnabled: z.boolean().optional(),
  whatsappEndpoint: z.string().url().optional(),
  whatsappPhoneNumberId: z.string().min(1).max(80).optional(),
  authorization: z.string().max(500).optional(),
}).strict();

export const getFast2SmsSettings = asyncHandler(async (_req, res) => {
  const settings = await getFast2SmsConfiguration();
  res.json({ success: true, data: settings });
});

export const updateFast2SmsSettings = asyncHandler(async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Invalid Fast2SMS configuration', parsed.error.flatten());
  const existing = await IntegrationSetting.findOne({ key: 'fast2sms' }).select('+secureConfig.authorizationEncrypted').lean();
  const { authorization, enabled, whatsappEnabled: requestedWhatsappEnabled, ...incomingPublicConfig } = parsed.data;
  const whatsappEnabled = requestedWhatsappEnabled ?? Boolean(existing?.publicConfig?.whatsappEnabled);
  const publicConfig = { ...(existing?.publicConfig || {}), ...incomingPublicConfig, whatsappEnabled };
  if (authorization && /\*{3,}/.test(authorization)) throw new ApiError(422, 'Enter the complete Fast2SMS authorization key, not a masked value');
  if ((enabled || whatsappEnabled) && !authorization?.trim() && !existing?.secureConfig?.authorizationEncrypted) throw new ApiError(422, 'Configure the Fast2SMS authorization key before enabling Fast2SMS delivery');
  const update = buildFast2SmsSettingsUpdate({
    enabled,
    whatsappEnabled,
    publicConfig,
    authorization,
    updatedBy: req.user._id,
  });
  const record = await IntegrationSetting.findOneAndUpdate(
    { key: 'fast2sms' },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, context: 'query' },
  );
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'integration:fast2sms_updated', module: 'integrations', recordId: record._id, updatedValue: { enabled, whatsappEnabled, ...publicConfig, authorizationChanged: Boolean(authorization?.trim()) }, ip: req.ip, device: req.get('user-agent') });
  res.json({ success: true, data: await getFast2SmsConfiguration(), message: 'Fast2SMS configuration saved' });
});

export const testFast2SmsSettings = asyncHandler(async (req, res) => {
  const mobile = normalizeIndianMobile(req.body.mobile);
  if (!mobile) throw new ApiError(422, 'Enter a valid 10-digit Indian mobile number');
  if (req.body.templateKey) {
    await sendFast2SmsWhatsApp({ mobile, templateKey: req.body.templateKey, variables: req.body.variables });
    res.json({ success: true, message: `WhatsApp template sent to ******${mobile.slice(-4)}` });
    return;
  }
  const otp = String(req.body.otp || '123456').replace(/\D/g, '').slice(0, 6);
  if (!/^\d{6}$/.test(otp)) throw new ApiError(422, 'Test OTP must contain six digits');
  await sendFast2SmsOtp({ mobile, otp, name: req.user.name });
  res.json({ success: true, message: `Test OTP sent to ******${mobile.slice(-4)}` });
});

const razorpaySettingsSchema = z.object({ keyId: z.string().max(120), secret: z.string().max(500).optional(), upiId: z.string().max(160), upiName: z.string().max(120), upiQrUrl: z.string().url().or(z.literal('')).optional() }).strict();
export const getRazorpaySettings = asyncHandler(async (_req, res) => res.json({ success: true, data: await publicRazorpayConfig() }));
export const updateRazorpaySettings = asyncHandler(async (req, res) => {
  const parsed = razorpaySettingsSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Invalid Razorpay or UPI configuration', parsed.error.flatten());
  const existing = await IntegrationSetting.findOne({ key: 'razorpay' }).select('+secureConfig.authorizationEncrypted').lean();
  const secret = String(parsed.data.secret || '').trim();
  if (!secret && !existing?.secureConfig?.authorizationEncrypted && !process.env.RAZORPAY_KEY_SECRET) throw new ApiError(422, 'Enter the Razorpay key secret before saving');
  const update = buildRazorpaySettingsUpdate({ ...parsed.data, secret, hasExistingSecret: Boolean(existing?.secureConfig?.authorizationEncrypted), updatedBy: req.user._id });
  const record = await IntegrationSetting.findOneAndUpdate({ key: 'razorpay' }, update, { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, context: 'query' });
  await AuditLog.create({ user: req.user._id, role: req.user.role, action: 'integration:razorpay_updated', module: 'integrations', recordId: record._id, updatedValue: { keyId: parsed.data.keyId, upiId: parsed.data.upiId, secretChanged: Boolean(secret) }, ip: req.ip, device: req.get('user-agent') });
  res.json({ success: true, data: await publicRazorpayConfig(), message: 'Razorpay and UPI configuration saved securely' });
});

const browserMapsKeySchema = z.string().trim().max(500).refine((value) => !value || /^AIza[0-9A-Za-z_-]{20,}$/.test(value), 'Google browser API keys must use the AIza key format').default('');
const encryptedGoogleCredentialSchema = z.string().trim().max(8000).optional();
const googleProjectReferenceSchema = z.string().trim().max(120).refine((value) => !value || /^(?:[a-z][a-z0-9-]{4,28}[a-z0-9]|[0-9]{6,30})$/.test(value), 'Enter a valid Google Cloud project ID or project number').default('');
const mapsSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.literal('google').default('google'),
  publicApiKey: browserMapsKeySchema,
  serverApiKey: encryptedGoogleCredentialSchema,
  geocodingApiKey: encryptedGoogleCredentialSchema,
  directionsApiKey: encryptedGoogleCredentialSchema,
  placesApiKey: encryptedGoogleCredentialSchema,
  routesApiKey: encryptedGoogleCredentialSchema,
  elevationApiKey: encryptedGoogleCredentialSchema,
  roadsApiKey: encryptedGoogleCredentialSchema,
  addressValidationApiKey: encryptedGoogleCredentialSchema,
  groundingLiteApiKey: encryptedGoogleCredentialSchema,
  navigationConnectAccessToken: encryptedGoogleCredentialSchema,
  routeOptimizationAccessToken: encryptedGoogleCredentialSchema,
  streetViewAccessToken: encryptedGoogleCredentialSchema,
  navigationEnabled: z.boolean().default(true),
  locationPickerEnabled: z.boolean().default(true),
  reverseGeocodeEnabled: z.boolean().default(true),
  directionsEnabled: z.boolean().default(true),
  serverRoutesEnabled: z.boolean().default(true),
  routesEnabled: z.boolean().default(true),
  placesEnabled: z.boolean().default(true),
  placesUiKitEnabled: z.boolean().default(true),
  addressValidationEnabled: z.boolean().default(true),
  elevationEnabled: z.boolean().default(true),
  roadsEnabled: z.boolean().default(true),
  routeOptimizationEnabled: z.boolean().default(false),
  navigationConnectEnabled: z.boolean().default(false),
  groundingLiteEnabled: z.boolean().default(false),
  streetViewPublishEnabled: z.boolean().default(false),
  useTraffic: z.boolean().default(true),
  routeRefreshSeconds: z.coerce.number().int().min(5).max(120).default(10),
  locationUpdateSeconds: z.coerce.number().int().min(1).max(60).default(5),
  maxRouteWaypoints: z.coerce.number().int().min(0).max(25).default(25),
  cloudProjectId: googleProjectReferenceSchema,
  regionCode: z.string().trim().max(8).default('IN'),
  languageCode: z.string().trim().max(24).default('en-US'),
  units: z.enum(['METRIC', 'IMPERIAL']).default('METRIC'),
  navigationConnectAndroidAppId: z.string().trim().max(200).default(''),
  navigationConnectIosAppId: z.string().trim().max(200).default(''),
  mapId: z.string().max(120).default(''),
  defaultLatitude: z.coerce.number().min(-90).max(90).default(20.5937),
  defaultLongitude: z.coerce.number().min(-180).max(180).default(78.9629),
  defaultZoom: z.coerce.number().min(1).max(22).default(15),
  travelMode: z.enum(['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT']).default('DRIVING'),
}).strict();

export const getMapsSettings = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getMapsConfiguration() });
});

export const updateMapsSettings = asyncHandler(async (req, res) => {
  const parsed = mapsSettingsSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Invalid Maps & Navigation configuration', parsed.error.flatten());
  if (parsed.data.enabled && parsed.data.provider !== 'google') throw new ApiError(422, 'Google Maps Platform is the only supported provider for the secured routing workflow');
  const browserKey = String(parsed.data.publicApiKey || env.GOOGLE_MAPS_BROWSER_API_KEY || '').trim();
  if (parsed.data.enabled && !/^AIza[0-9A-Za-z_-]{20,}$/.test(browserKey)) {
    throw new ApiError(422, 'Enter a Google Maps browser API key before enabling Google Maps');
  }
  if (parsed.data.navigationConnectEnabled && !/^[0-9]{6,30}$/.test(parsed.data.cloudProjectId)) throw new ApiError(422, 'Navigation Connect requires the numeric Google Cloud project number');
  if (parsed.data.routeOptimizationEnabled && !/^(?:[a-z][a-z0-9-]{4,28}[a-z0-9]|[0-9]{6,30})$/.test(parsed.data.cloudProjectId)) throw new ApiError(422, 'Route Optimization requires a valid Google Cloud project ID or project number');
  const existing = await IntegrationSetting.findOne({ key: 'maps' }).select('+secureConfig.authorizationEncrypted').lean();
  const secretKeys = ['serverApiKey', 'geocodingApiKey', 'directionsApiKey', 'placesApiKey', 'routesApiKey', 'elevationApiKey', 'roadsApiKey', 'addressValidationApiKey', 'groundingLiteApiKey', 'navigationConnectAccessToken', 'routeOptimizationAccessToken', 'streetViewAccessToken'];
  const secretValues = Object.fromEntries(secretKeys.map((key) => [key, parsed.data[key]]));
  const config = { ...parsed.data };
  for (const key of secretKeys) delete config[key];
  if (Object.values(secretValues).some((value) => value && /\*{3,}/.test(value))) {
    throw new ApiError(422, 'Enter complete map credentials, not masked values');
  }
  const update = buildMapsSettingsUpdate({ config, secretValues, existingAuthorizationEncrypted: existing?.secureConfig?.authorizationEncrypted, updatedBy: req.user._id });
  const record = await IntegrationSetting.findOneAndUpdate(
    { key: 'maps' },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, context: 'query' },
  );
  await SiteSetting.findOneAndUpdate(
    { key: 'default' },
    { $set: { map: config } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, context: 'query' },
  );
  await AuditLog.create({
    user: req.user._id,
    role: req.user.role,
    action: 'integration:maps_updated',
    module: 'integrations',
    recordId: record._id,
    updatedValue: { ...config, credentialsChanged: Object.values(secretValues).some((value) => Boolean(String(value || '').trim())) },
    ip: req.ip,
    device: req.get('user-agent'),
  });
  invalidateMapsConfigurationCache();
  emitSiteChanged('maps');
  res.json({ success: true, data: await getMapsConfiguration(), message: 'Maps & Navigation configuration saved securely' });
});
