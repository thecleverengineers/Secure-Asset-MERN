import crypto from 'node:crypto';
import { IntegrationSetting } from '../models/index.js';
import { env } from '../config/env.js';
import { decryptIntegrationSecret, encryptIntegrationSecret } from './fast2sms.js';

export async function getRazorpayConfiguration({ includeSecret = false } = {}) {
  const record = await IntegrationSetting.findOne({ key: 'razorpay' }).select('+secureConfig.authorizationEncrypted').lean();
  const keyId = String(record?.publicConfig?.keyId || env.RAZORPAY_KEY_ID || '').trim();
  const secret = record?.secureConfig?.authorizationEncrypted ? decryptIntegrationSecret(record.secureConfig.authorizationEncrypted) : String(env.RAZORPAY_KEY_SECRET || '').trim();
  return { keyId, secret, upiId: String(record?.publicConfig?.upiId || env.UPI_ID || '').trim(), upiName: String(record?.publicConfig?.upiName || env.UPI_NAME || 'SecureAsset'), upiQrUrl: String(record?.publicConfig?.upiQrUrl || env.UPI_QR_URL || '').trim(), configured: Boolean(keyId && secret), ...(includeSecret ? {} : { secret: undefined }) };
}

export async function createRazorpayOrder({ amount, receipt, notes = {} }) {
  const config = await getRazorpayConfiguration({ includeSecret: true });
  if (!config.configured) throw new Error('Razorpay is not configured by the administrator');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${config.keyId}:${config.secret}`).toString('base64')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(Number(amount) * 100), currency: 'INR', receipt: String(receipt).slice(0, 40), notes }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) throw new Error(payload.error?.description || 'Razorpay order creation failed');
  return payload;
}

export async function verifyRazorpaySignature(orderId, paymentId, signature) {
  const config = await getRazorpayConfiguration({ includeSecret: true });
  if (!config.configured) return false;
  const expected = crypto.createHmac('sha256', config.secret).update(`${orderId}|${paymentId}`).digest('hex');
  const actual = String(signature || '');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export async function publicRazorpayConfig() {
  const config = await getRazorpayConfiguration();
  return { keyId: config.keyId, upiId: config.upiId, upiName: config.upiName, upiQrUrl: config.upiQrUrl, configured: config.configured };
}

export function buildRazorpaySettingsUpdate({ keyId, secret, upiId, upiName, upiQrUrl, updatedBy, hasExistingSecret = false }) {
  const set = { provider: 'Razorpay + UPI', category: 'payment', enabled: Boolean(keyId), status: keyId && (secret || hasExistingSecret || env.RAZORPAY_KEY_SECRET) ? 'configured' : 'unconfigured', publicConfig: { keyId: String(keyId || '').trim(), upiId: String(upiId || '').trim(), upiName: String(upiName || 'SecureAsset').trim(), upiQrUrl: String(upiQrUrl || '').trim() }, updatedBy, lastError: '' };
  if (String(secret || '').trim()) set['secureConfig.authorizationEncrypted'] = encryptIntegrationSecret(secret);
  return { $set: set };
}
