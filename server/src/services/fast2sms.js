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
  messageId: '204252',
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
  security_deposit_request: Object.freeze({
    messageId: '34218', phoneNumberId: '1202480702956271', category: 'payment', variableCount: 4,
    variables: ['name', 'amount', 'dueDate', 'paymentLink'],
    description: 'Security deposit payment request after agreement completion',
  }),
  security_deposit_completed: Object.freeze({
    messageId: '34219', phoneNumberId: '1202480702956271', category: 'payment', variableCount: 5,
    variables: ['name', 'amount', 'paymentReference', 'paymentDate', 'receiptLink'],
    description: 'Security deposit verified and completed confirmation',
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
  const endpoint = 'https://www.fast2sms.com/dev/bulkV2';
  const url = new URL(endpoint);
  const parameters = new URLSearchParams({
    authorization: String(config.authorization || ''),
    route: 'dlt',
    sender_id: 'SECAST',
    message: '204252',
    // The approved DLT template receives the SecureAsset-generated OTP at runtime.
    // If the template does not contain a variable, Fast2SMS will ignore the value.
    variables_values: otp ? String(otp) : '',
    numbers: String(mobile || ''),
    schedule_time: '',
  });
  url.search = parameters.toString();
  return url;
}

function fast2SmsFailureReason(payload, httpStatus) {
  const statusCode = payload?.status_code ?? payload?.statusCode ?? payload?.code ?? '';
  const rawMessage = payload?.message ?? payload?.error ?? payload?.errors ?? payload?.msg ?? '';
  const message = Array.isArray(rawMessage)
    ? rawMessage.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('; ')
    : typeof rawMessage === 'object' && rawMessage !== null
      ? JSON.stringify(rawMessage)
      : String(rawMessage || '').trim();
  const parts = [];
  if (statusCode !== '' && statusCode !== null && statusCode !== undefined) parts.push(`code ${statusCode}`);
  if (message) parts.push(message);
  return parts.length ? parts.join(': ') : `HTTP ${httpStatus}`;
}

function extractFast2SmsRequestId(payload) {
  const candidates = [
    payload?.request_id, payload?.requestId, payload?.requestID,
    payload?.data?.request_id, payload?.data?.requestId,
    payload?.sms_details?.request_id, payload?.sms_details?.requestId,
  ];
  return String(candidates.find((value) => value !== undefined && value !== null && String(value).trim()) || '').trim();
}

function normalizeDeliveryRows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const value of [payload?.data, payload?.reports, payload?.report, payload?.result, payload?.delivery_report]) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return [value];
  }
  return payload && typeof payload === 'object' ? [payload] : [];
}

export async function fetchFast2SmsDeliveryReport(requestId, authorization) {
  const id = String(requestId || '').trim();
  if (!id) return { status: 'unknown', description: 'Fast2SMS request ID unavailable', raw: null };
  const url = new URL(`https://www.fast2sms.com/dev/dlr/${encodeURIComponent(id)}`);
  let response;
  let payload;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: String(authorization || '') },
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  } catch (error) {
    return { status: 'unknown', description: `Delivery report lookup failed: ${error.message}`, raw: null };
  }
  if (!response.ok) {
    return { status: 'unknown', description: fast2SmsFailureReason(payload, response.status), raw: payload };
  }
  const rows = normalizeDeliveryRows(payload);
  const statuses = rows.map((row) => String(row?.status || row?.delivery_status || '').trim().toLowerCase()).filter(Boolean);
  const failed = rows.find((row) => {
    const status = String(row?.status || row?.delivery_status || '').trim().toLowerCase();
    return ['failed', 'undelivered', 'rejected', 'expired', 'blocked'].includes(status);
  });
  if (failed) {
    return {
      status: 'failed',
      description: String(failed.status_description || failed.failure_reason || failed.description || failed.message || 'SMS delivery failed'),
      raw: payload,
    };
  }
  if (statuses.some((status) => ['delivered', 'success', 'delivrd'].includes(status))) {
    const delivered = rows.find((row) => ['delivered', 'success', 'delivrd'].includes(String(row?.status || row?.delivery_status || '').trim().toLowerCase()));
    return {
      status: 'delivered',
      description: String(delivered?.status_description || delivered?.description || 'Delivered successfully'),
      raw: payload,
    };
  }
  const first = rows[0] || {};
  return {
    status: statuses[0] || 'pending',
    description: String(first.status_description || first.description || first.message || 'SMS accepted and awaiting delivery report'),
    raw: payload,
  };
}

async function verifyFast2SmsDelivery(requestId, authorization) {
  if (!requestId) return { status: 'unknown', description: 'Fast2SMS accepted the request without a request ID' };
  const waits = [900, 1600];
  let report = { status: 'pending', description: 'SMS accepted and awaiting delivery report' };
  for (const delayMs of waits) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    report = await fetchFast2SmsDeliveryReport(requestId, authorization);
    if (report.status === 'delivered' || report.status === 'failed') break;
  }
  return report;
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
    phone_number_id: String(template.phoneNumberId || config.whatsappPhoneNumberId || FAST2SMS_WHATSAPP_DEFAULTS.phoneNumberId),
    numbers: normalized,
    variables_values: values.join('|'),
  }).toString();
  return url;
}

export async function getFast2SmsConfiguration({ includeAuthorization = false } = {}) {
  const query = IntegrationSetting.findOne({ key: 'fast2sms' }).select('+secureConfig.authorizationEncrypted');
  const record = await query.lean();
  const publicConfig = {
    ...FAST2SMS_DEFAULTS,
    ...FAST2SMS_WHATSAPP_DEFAULTS,
    ...(record?.publicConfig || {}),
    endpoint: FAST2SMS_DEFAULTS.endpoint,
    route: FAST2SMS_DEFAULTS.route,
    senderId: FAST2SMS_DEFAULTS.senderId,
    messageId: FAST2SMS_DEFAULTS.messageId,
    scheduleTime: '',
    whatsappEndpoint: FAST2SMS_WHATSAPP_DEFAULTS.endpoint,
  };
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

export async function sendFast2SmsOtp({ mobile, otp, name = '', configOverride = {} }) {
  const normalized = normalizeIndianMobile(mobile);
  if (!normalized) throw new Error('A valid 10-digit Indian mobile number is required');
  const adminConfig = await getFast2SmsConfiguration({ includeAuthorization: true });
  if (!adminConfig.enabled) throw new Error('Fast2SMS OTP delivery is disabled in the admin panel');
  if (!adminConfig.authorization || /\*{3,}/.test(adminConfig.authorization)) throw new Error('Fast2SMS authorization key is not configured');
  // Purpose-specific DLT templates may override public routing/template fields,
  // but the encrypted administrator-managed authorization key is always used.
  const config = {
    ...adminConfig,
    ...configOverride,
    endpoint: 'https://www.fast2sms.com/dev/bulkV2',
    route: 'dlt',
    senderId: 'SECAST',
    messageId: '204252',
    authorization: adminConfig.authorization,
  };

  const url = buildFast2SmsUrl(config, { mobile: normalized, otp, name });
  let response;
  let payload;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  } catch (error) {
    await updateProviderHealth({ ok: false, error: error.message });
    throw new Error(`Fast2SMS request failed: ${error.message}`);
  }

  const providerRejected = payload?.return === false || String(payload?.return || '').toLowerCase() === 'false';
  const accepted = response.ok && !providerRejected;
  if (!accepted) {
    const reason = fast2SmsFailureReason(payload, response.status);
    console.error('Fast2SMS OTP request rejected', {
      httpStatus: response.status,
      providerStatusCode: payload?.status_code ?? payload?.statusCode ?? payload?.code ?? null,
      reason,
      route: 'dlt',
      senderId: 'SECAST',
      messageId: '204252',
      destinationLast4: normalized.slice(-4),
    });
    await updateProviderHealth({ ok: false, error: reason });
    throw new Error(`Fast2SMS rejected the OTP request: ${reason}`);
  }
  const requestId = extractFast2SmsRequestId(payload);
  console.log('Fast2SMS OTP request accepted', {
    requestId: requestId || null,
    providerStatusCode: payload?.status_code ?? payload?.statusCode ?? payload?.code ?? null,
    providerMessage: String(payload?.message || payload?.msg || ''),
    route: 'dlt',
    senderId: 'SECAST',
    messageId: '204252',
    destinationLast4: normalized.slice(-4),
  });

  const delivery = await verifyFast2SmsDelivery(requestId, config.authorization);
  console.log('Fast2SMS OTP delivery report', {
    requestId: requestId || null,
    status: delivery.status,
    description: delivery.description,
    destinationLast4: normalized.slice(-4),
  });
  if (delivery.status === 'failed') {
    await updateProviderHealth({ ok: false, error: delivery.description });
    throw new Error(`Fast2SMS accepted the OTP but delivery failed: ${delivery.description}`);
  }

  await updateProviderHealth({ ok: true });
  return { ...payload, requestId, deliveryStatus: delivery.status, deliveryDescription: delivery.description };
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
