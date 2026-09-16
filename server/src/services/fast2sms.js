import { IntegrationSetting } from '../models/index.js';
import { env } from '../config/env.js';
import { mobileLookup, normalizeIndianMobile } from '../utils/identity.js';
import {
  decryptAuthenticatedSecret,
  decryptAuthenticatedSecretValue,
  encryptAuthenticatedSecret,
} from '../utils/encryptedSecrets.js';

export { mobileLookup, normalizeIndianMobile };

export const FAST2SMS_DEFAULTS = Object.freeze({
  endpoint: 'https://www.fast2sms.com/dev/bulkV2',
  route: 'dlt',
  senderId: 'SECAST',
  messageId: '204251',
  variablesTemplate: '{otp}',
  scheduleTime: '',
});

export const FAST2SMS_WHATSAPP_DEFAULTS = Object.freeze({
  endpoint: 'https://www.fast2sms.com/dev/whatsapp',
  phoneNumberId: '1202480702956271',
});

// Approved Fast2SMS WhatsApp Business templates supplied by the business.
// Message IDs and variable order are provider contracts; credentials remain
// encrypted in IntegrationSetting and are never stored in this registry.
export const FAST2SMS_WHATSAPP_TEMPLATES = Object.freeze({
  payment_completed: Object.freeze({
    messageId: '26887', category: 'payment', variableCount: 1, variables: ['amount'],
    description: 'Payment completed confirmation',
  }),
  secure_asset_kyc: Object.freeze({
    messageId: '26891', category: 'system', variableCount: 1, variables: ['name'],
    description: 'Mandatory Secure Asset KYC reminder',
  }),
  property_listed_successfully: Object.freeze({
    messageId: '26892', category: 'property', variableCount: 2, variables: ['name', 'propertyAddress'],
    description: 'Public property listing confirmation',
  }),
  lease_agreement_ready: Object.freeze({
    messageId: '27054', category: 'lease', variableCount: 3, variables: ['name', 'propertyAddress', 'signBy'],
    description: 'Lease agreement ready for signature',
  }),
  new_survey_assigned: Object.freeze({
    messageId: '27055', category: 'survey', variableCount: 4, variables: ['name', 'propertyAddress', 'date', 'time'],
    description: 'New property survey assignment',
  }),
  confirming_successful_receipt_of_rent: Object.freeze({
    messageId: '27056', category: 'payment', variableCount: 3, variables: ['name', 'amount', 'propertyAddress'],
    description: 'Successful rent receipt confirmation',
  }),
  rent_reminder: Object.freeze({
    messageId: '27057', category: 'payment', variableCount: 4, variables: ['name', 'amount', 'propertyAddress', 'dueDate'],
    description: 'Rent due reminder',
  }),
});

export function listFast2SmsWhatsAppTemplates() {
  return Object.entries(FAST2SMS_WHATSAPP_TEMPLATES).map(([key, value]) => ({ key, ...value }));
}

export function getFast2SmsWhatsAppTemplate(templateKey) {
  const template = FAST2SMS_WHATSAPP_TEMPLATES[String(templateKey || '').trim()];
  if (!template) throw new Error(`Unknown Fast2SMS WhatsApp template: ${templateKey}`);
  return template;
}

export function normalizeFast2SmsWhatsAppVariables(templateKey, values = []) {
  const template = getFast2SmsWhatsAppTemplate(templateKey);
  if (!Array.isArray(values) || values.length !== template.variableCount) {
    throw new Error(`${templateKey} requires exactly ${template.variableCount} WhatsApp variable${template.variableCount === 1 ? '' : 's'}`);
  }
  return values.map((value, index) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) throw new Error(`${templateKey} variable ${index + 1} is required`);
    if (normalized.length > 500) throw new Error(`${templateKey} variable ${index + 1} is too long`);
    return normalized;
  });
}

export function encryptIntegrationSecret(value) {
  return encryptAuthenticatedSecret(value);
}

export function buildFast2SmsSettingsUpdate({ enabled, whatsappEnabled = false, publicConfig = {}, authorization = '', updatedBy } = {}) {
  const normalizedAuthorization = String(authorization || '').trim();
  const set = {
    provider: 'Fast2SMS',
    category: 'sms',
    enabled: Boolean(enabled),
    status: enabled || whatsappEnabled ? 'configured' : 'disabled',
    publicConfig: { ...FAST2SMS_DEFAULTS, ...FAST2SMS_WHATSAPP_DEFAULTS, ...publicConfig, otpEnabled: Boolean(enabled), whatsappEnabled: Boolean(whatsappEnabled) },
    envRequirements: [],
    updatedBy,
    lastError: '',
  };
  if (normalizedAuthorization) {
    set['secureConfig.authorizationEncrypted'] = encryptIntegrationSecret(normalizedAuthorization);
  }
  // The provider identifier is supplied only by the upsert equality filter
  // ({ key: 'fast2sms' }). Never place `key` in both $set and $setOnInsert:
  // MongoDB rejects that update with "Updating the path 'key' would create a
  // conflict at 'key'".
  return { $set: set };
}

export function decryptIntegrationSecret(payload) {
  return decryptAuthenticatedSecretValue(payload);
}

export function maskMobile(value) {
  const mobile = normalizeIndianMobile(value);
  return mobile ? `******${mobile.slice(-4)}` : '';
}

export function renderVariableValues(template, { otp, name = '' } = {}) {
  return String(template || '{otp}')
    .replaceAll('{otp}', String(otp || ''))
    .replaceAll('{name}', String(name || '').trim());
}

export function buildFast2SmsUrl(config, { mobile, otp, name }) {
  const endpoint = String(config.endpoint || FAST2SMS_DEFAULTS.endpoint).trim();
  const url = new URL(endpoint);
  const parameters = new URLSearchParams({
    authorization: String(config.authorization || ''),
    route: String(config.route || FAST2SMS_DEFAULTS.route),
    sender_id: String(config.senderId || FAST2SMS_DEFAULTS.senderId),
    message: String(config.messageId || FAST2SMS_DEFAULTS.messageId),
    variables_values: renderVariableValues(config.variablesTemplate || FAST2SMS_DEFAULTS.variablesTemplate, { otp, name }),
    numbers: String(mobile),
    schedule_time: String(config.scheduleTime || ''),
  });
  url.search = parameters.toString();
  return url;
}

export function buildFast2SmsWhatsAppUrl(config, { mobile, templateKey, variables = [] }) {
  const normalized = normalizeIndianMobile(mobile);
  if (!normalized) throw new Error('A valid 10-digit Indian mobile number is required');
  const template = getFast2SmsWhatsAppTemplate(templateKey);
  const values = normalizeFast2SmsWhatsAppVariables(templateKey, variables);
  const endpoint = String(config.whatsappEndpoint || FAST2SMS_WHATSAPP_DEFAULTS.endpoint).trim();
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    authorization: String(config.authorization || ''),
    message_id: String(template.messageId),
    phone_number_id: String(config.whatsappPhoneNumberId || FAST2SMS_WHATSAPP_DEFAULTS.phoneNumberId),
    numbers: normalized,
    variables_values: values.join('|'),
  }).toString();
  return url;
}

export async function getFast2SmsConfiguration({ includeAuthorization = false } = {}) {
  const query = IntegrationSetting.findOne({ key: 'fast2sms' }).select('+secureConfig.authorizationEncrypted');
  const record = await query.lean();
  const publicConfig = { ...FAST2SMS_DEFAULTS, ...FAST2SMS_WHATSAPP_DEFAULTS, ...(record?.publicConfig || {}) };
  let authorization = '';
  if (includeAuthorization && record?.secureConfig?.authorizationEncrypted) {
    const decrypted = decryptAuthenticatedSecret(record.secureConfig.authorizationEncrypted);
    authorization = decrypted.value;
    // Existing releases encrypted this field with a JWT signing secret. Once
    // the legacy key succeeds, atomically migrate it to the stable master key
    // so a later JWT rotation cannot break registration or OTP delivery again.
    if (decrypted.usedLegacyKey && env.ENCRYPTION_MASTER_KEY_BASE64) {
      void IntegrationSetting.updateOne(
        { key: 'fast2sms' },
        { $set: { 'secureConfig.authorizationEncrypted': encryptIntegrationSecret(authorization) } },
      ).catch(() => {});
    }
  }
  return {
    id: record?._id,
    enabled: Boolean(record?.publicConfig?.otpEnabled ?? record?.enabled),
    status: record?.status || 'unconfigured',
    lastCheckedAt: record?.lastCheckedAt || null,
    lastError: record?.lastError || '',
    authorizationConfigured: Boolean(record?.secureConfig?.authorizationEncrypted),
    ...publicConfig,
    ...(includeAuthorization ? { authorization } : {}),
    whatsappTemplates: listFast2SmsWhatsAppTemplates(),
  };
}

async function updateProviderHealth({ ok, error = '' }) {
  try {
    await IntegrationSetting.updateOne(
      { key: 'fast2sms' },
      { $set: { status: ok ? 'healthy' : 'error', lastCheckedAt: new Date(), lastError: error } },
    );
  } catch {
    // OTP delivery result must not be hidden by a secondary status-update failure.
  }
}

export async function sendFast2SmsOtp({ mobile, otp, name = '' }) {
  const normalized = normalizeIndianMobile(mobile);
  if (!normalized) throw new Error('A valid 10-digit Indian mobile number is required');
  const config = await getFast2SmsConfiguration({ includeAuthorization: true });
  if (!config.enabled) throw new Error('Fast2SMS OTP delivery is disabled in the admin panel');
  if (!config.authorization || /\*{3,}/.test(config.authorization)) throw new Error('Fast2SMS authorization key is not configured');
  if (!config.senderId || !config.messageId) throw new Error('Fast2SMS sender ID and DLT message ID are required');

  const url = buildFast2SmsUrl(config, { mobile: normalized, otp, name });
  let response;
  let payload;
  try {
    response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  } catch (error) {
    await updateProviderHealth({ ok: false, error: error.message });
    throw new Error(`Fast2SMS request failed: ${error.message}`);
  }

  const providerRejected = payload?.return === false || String(payload?.return || '').toLowerCase() === 'false';
  const accepted = response.ok && !providerRejected;
  if (!accepted) {
    const reason = payload?.message || payload?.error || `HTTP ${response.status}`;
    await updateProviderHealth({ ok: false, error: String(reason) });
    throw new Error(`Fast2SMS rejected the OTP request: ${reason}`);
  }
  await updateProviderHealth({ ok: true });
  return payload;
}

export async function sendFast2SmsWhatsApp({ mobile, templateKey, variables = [] }) {
  const normalized = normalizeIndianMobile(mobile);
  if (!normalized) throw new Error('A valid 10-digit Indian mobile number is required');
  const config = await getFast2SmsConfiguration({ includeAuthorization: true });
  if (!config.whatsappEnabled) throw new Error('Fast2SMS WhatsApp delivery is disabled in the admin panel');
  if (!config.authorization || /\*{3,}/.test(config.authorization)) throw new Error('Fast2SMS authorization key is not configured');
  if (!config.whatsappPhoneNumberId) throw new Error('Fast2SMS WhatsApp phone number ID is required');

  const url = buildFast2SmsWhatsAppUrl(config, { mobile: normalized, templateKey, variables });
  let response;
  let payload;
  try {
    response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  } catch (error) {
    await updateProviderHealth({ ok: false, error: error.message });
    throw new Error(`Fast2SMS WhatsApp request failed: ${error.message}`);
  }

  const providerRejected = payload?.return === false || String(payload?.return || '').toLowerCase() === 'false';
  const accepted = response.ok && !providerRejected;
  if (!accepted) {
    const reason = payload?.message || payload?.error || `HTTP ${response.status}`;
    await updateProviderHealth({ ok: false, error: String(reason) });
    throw new Error(`Fast2SMS rejected the WhatsApp request: ${reason}`);
  }
  await updateProviderHealth({ ok: true });
  return payload;
}
