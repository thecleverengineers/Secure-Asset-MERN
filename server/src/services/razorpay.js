import crypto from 'node:crypto';
import { IntegrationSetting } from '../models/index.js';
import { env } from '../config/env.js';
import { decryptIntegrationSecret, encryptIntegrationSecret } from './fast2sms.js';

function safeTimingEqual(expected, actual) {
  const left = Buffer.from(String(expected || ''), 'utf8');
  const right = Buffer.from(String(actual || ''), 'utf8');
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

export async function getRazorpayConfiguration({ includeSecret = false, includeWebhookSecret = false } = {}) {
  const record = await IntegrationSetting.findOne({ key: 'razorpay' })
    .select('+secureConfig.authorizationEncrypted +secureConfig.webhookSecretEncrypted')
    .lean();
  const keyId = String(record?.publicConfig?.keyId || env.RAZORPAY_KEY_ID || '').trim();
  const secret = record?.secureConfig?.authorizationEncrypted
    ? decryptIntegrationSecret(record.secureConfig.authorizationEncrypted)
    : String(env.RAZORPAY_KEY_SECRET || '').trim();
  const webhookSecret = record?.secureConfig?.webhookSecretEncrypted
    ? decryptIntegrationSecret(record.secureConfig.webhookSecretEncrypted)
    : String(env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  return {
    keyId,
    secret,
    webhookSecret,
    upiId: String(record?.publicConfig?.upiId || env.UPI_ID || '').trim(),
    upiName: String(record?.publicConfig?.upiName || env.UPI_NAME || 'SecureAsset'),
    upiQrUrl: String(record?.publicConfig?.upiQrUrl || env.UPI_QR_URL || '').trim(),
    configured: Boolean(keyId && secret),
    webhookConfigured: Boolean(webhookSecret),
    ...(includeSecret ? {} : { secret: undefined }),
    ...(includeWebhookSecret ? {} : { webhookSecret: undefined }),
  };
}

function basicAuthorization(config) {
  return `Basic ${Buffer.from(`${config.keyId}:${config.secret}`).toString('base64')}`;
}

export async function createRazorpayOrder({ amount, receipt, notes = {} }) {
  const config = await getRazorpayConfiguration({ includeSecret: true });
  if (!config.configured) throw new Error('Razorpay is not configured by the administrator');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { authorization: basicAuthorization(config), 'content-type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(Number(amount) * 100), currency: 'INR', receipt: String(receipt).slice(0, 40), notes }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) throw new Error(payload.error?.description || 'Razorpay order creation failed');
  return payload;
}

export async function fetchRazorpayPayment(paymentId) {
  const config = await getRazorpayConfiguration({ includeSecret: true });
  if (!config.configured) throw new Error('Razorpay is not configured by the administrator');
  const id = String(paymentId || '').trim();
  if (!/^pay_[A-Za-z0-9]+$/.test(id)) throw new Error('Invalid Razorpay payment id');
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(id)}`, {
    headers: { authorization: basicAuthorization(config), accept: 'application/json' },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.id !== id) throw new Error(payload.error?.description || 'Could not verify Razorpay payment');
  return payload;
}

export async function verifyRazorpaySignature(orderId, paymentId, signature) {
  const config = await getRazorpayConfiguration({ includeSecret: true });
  if (!config.configured) return false;
  const expected = crypto.createHmac('sha256', config.secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeTimingEqual(expected, signature);
}

export async function verifyRazorpayWebhookSignature(rawBody, signature) {
  const config = await getRazorpayConfiguration({ includeWebhookSecret: true });
  if (!config.webhookConfigured) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  const expected = crypto.createHmac('sha256', config.webhookSecret).update(body).digest('hex');
  return safeTimingEqual(expected, signature);
}

export function razorpayWebhookEventKey(rawBody, signature, suppliedEventId = '') {
  const explicit = String(suppliedEventId || '').trim();
  if (explicit) return explicit.slice(0, 180);
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  return `sha256:${crypto.createHash('sha256').update(body).update(String(signature || '')).digest('hex')}`;
}

export async function publicRazorpayConfig() {
  const config = await getRazorpayConfiguration();
  return {
    keyId: config.keyId,
    upiId: config.upiId,
    upiName: config.upiName,
    upiQrUrl: config.upiQrUrl,
    configured: config.configured,
    webhookConfigured: config.webhookConfigured,
  };
}

export function buildRazorpaySettingsUpdate({
  keyId, secret, webhookSecret, upiId, upiName, upiQrUrl, updatedBy,
  hasExistingSecret = false, hasExistingWebhookSecret = false,
}) {
  const hasSecret = Boolean(secret || hasExistingSecret || env.RAZORPAY_KEY_SECRET);
  const hasWebhookSecret = Boolean(webhookSecret || hasExistingWebhookSecret || env.RAZORPAY_WEBHOOK_SECRET);
  const set = {
    provider: 'Razorpay + UPI',
    category: 'payment',
    enabled: Boolean(keyId),
    status: keyId && hasSecret ? 'configured' : 'unconfigured',
    publicConfig: {
      keyId: String(keyId || '').trim(),
      upiId: String(upiId || '').trim(),
      upiName: String(upiName || 'SecureAsset').trim(),
      upiQrUrl: String(upiQrUrl || '').trim(),
      webhookConfigured: hasWebhookSecret,
    },
    updatedBy,
    lastError: '',
  };
  if (String(secret || '').trim()) set['secureConfig.authorizationEncrypted'] = encryptIntegrationSecret(secret);
  if (String(webhookSecret || '').trim()) set['secureConfig.webhookSecretEncrypted'] = encryptIntegrationSecret(webhookSecret);
  return { $set: set };
}
