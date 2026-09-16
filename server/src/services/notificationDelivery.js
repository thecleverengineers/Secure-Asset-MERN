import { NotificationDelivery, NotificationPreference, User } from '../models/index.js';
import { env } from '../config/env.js';
import { emailConfigured, sendEmail } from './mail.js';
import { getFast2SmsConfiguration, sendFast2SmsWhatsApp } from './fast2sms.js';

const MAX_ATTEMPTS = 6;

export function isInQuietHours(preference, now = new Date()) {
  const quiet = preference?.quietHours;
  if (!quiet?.enabled || !quiet.start || !quiet.end) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: quiet.timezone || 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
    const current = Number(parts.find((part) => part.type === 'hour')?.value || 0) * 60
      + Number(parts.find((part) => part.type === 'minute')?.value || 0);
    const [startHour, startMinute] = quiet.start.split(':').map(Number);
    const [endHour, endMinute] = quiet.end.split(':').map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return start <= end ? current >= start && current < end : current >= start || current < end;
  } catch { return false; }
}

function webhookFor(channel) {
  if (channel === 'sms') return { url: env.SMS_WEBHOOK_URL, token: env.SMS_WEBHOOK_TOKEN };
  if (channel === 'whatsapp') return { url: env.WHATSAPP_WEBHOOK_URL, token: env.WHATSAPP_WEBHOOK_TOKEN };
  if (channel === 'push') return { url: env.PUSH_WEBHOOK_URL, token: env.PUSH_WEBHOOK_TOKEN };
  return { url: '', token: '' };
}

export function deliveryChannelConfigured(channel) {
  if (channel === 'email') return emailConfigured();
  return Boolean(webhookFor(channel).url);
}

function retryDate(attempts) {
  const minutes = Math.min(360, 2 ** Math.max(0, attempts - 1) * 5);
  return new Date(Date.now() + minutes * 60_000);
}

async function deliverWebhook(delivery, user) {
  const provider = webhookFor(delivery.channel);
  if (!provider.url) throw new Error(`${delivery.channel} webhook is not configured`);
  const response = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(provider.token ? { authorization: `Bearer ${provider.token}` } : {}),
      'x-secureasset-delivery-id': String(delivery._id),
    },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      deliveryId: String(delivery._id),
      channel: delivery.channel,
      destination: delivery.destination,
      user: { id: String(user._id), name: user.name, email: user.email, phone: user.phone },
      title: delivery.metadata?.title || 'SecureAsset notification',
      message: delivery.metadata?.message || '',
      actionUrl: delivery.metadata?.actionUrl || '',
      category: delivery.metadata?.category || 'system',
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${delivery.channel} provider returned ${response.status}: ${text.slice(0, 300)}`);
  let result = {};
  try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text }; }
  return result;
}

async function deliverFast2SmsWhatsApp(delivery, user) {
  return sendFast2SmsWhatsApp({
    mobile: user.phone || delivery.destination,
    templateKey: delivery.metadata?.whatsappTemplate,
    variables: delivery.metadata?.whatsappVariables || [],
  });
}

async function channelConfiguredForDelivery(delivery) {
  if (delivery.channel === 'whatsapp' && delivery.metadata?.whatsappTemplate) {
    const config = await getFast2SmsConfiguration();
    return Boolean(config.whatsappEnabled && config.authorizationConfigured && config.whatsappPhoneNumberId);
  }
  return deliveryChannelConfigured(delivery.channel);
}

async function executeDelivery(delivery, user, preference) {
  if (isInQuietHours(preference)) {
    delivery.status = 'pending';
    delivery.lockedAt = undefined;
    delivery.nextAttemptAt = new Date(Date.now() + 60 * 60_000);
    await delivery.save();
    return { status: 'deferred' };
  }
  if (delivery.channel === 'email') {
    if (!emailConfigured() || !user.email) throw new Error(!user.email ? 'User has no email address' : 'SMTP is not configured');
    const result = await sendEmail({
      to: user.email,
      subject: delivery.metadata?.title || 'SecureAsset notification',
      text: `${delivery.metadata?.message || ''}${delivery.metadata?.actionUrl ? `\n\n${delivery.metadata.actionUrl}` : ''}`,
    });
    return { messageId: result.messageId };
  }
  if (delivery.channel === 'whatsapp' && delivery.metadata?.whatsappTemplate) {
    return deliverFast2SmsWhatsApp(delivery, user);
  }
  return deliverWebhook(delivery, user);
}

export async function processNotificationDelivery(delivery) {
  const [user, preference] = await Promise.all([
    User.findById(delivery.user).select('name email phone status').lean(),
    NotificationPreference.findOne({ user: delivery.user }).lean(),
  ]);
  if (!user || user.status !== 'active') {
    delivery.status = 'skipped'; delivery.lastError = 'Recipient is unavailable'; delivery.lockedAt = undefined;
    await delivery.save(); return { status: 'skipped' };
  }
  try {
    delivery.attempts += 1;
    const result = await executeDelivery(delivery, user, preference);
    if (result.status === 'deferred') return result;
    delivery.status = 'sent'; delivery.sentAt = new Date(); delivery.nextAttemptAt = undefined; delivery.lockedAt = undefined;
    delivery.providerMessageId = String(result.messageId || result.id || result.providerMessageId || '');
    delivery.lastError = '';
    await delivery.save();
    return { status: 'sent' };
  } catch (error) {
    delivery.lastError = error instanceof Error ? error.message : String(error);
    delivery.lockedAt = undefined;
    const configured = await channelConfiguredForDelivery(delivery);
    if (!configured || delivery.attempts >= MAX_ATTEMPTS) {
      delivery.status = configured ? 'failed' : 'skipped';
      delivery.nextAttemptAt = undefined;
    } else {
      delivery.status = 'failed';
      delivery.nextAttemptAt = retryDate(delivery.attempts);
    }
    await delivery.save();
    return { status: delivery.status, error: delivery.lastError };
  }
}

export async function claimNextNotificationDelivery(now = new Date()) {
  const staleLock = new Date(now.getTime() - 10 * 60_000);
  return NotificationDelivery.findOneAndUpdate({
    $or: [
      { status: 'pending', $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }] },
      { status: 'failed', attempts: { $lt: MAX_ATTEMPTS }, nextAttemptAt: { $lte: now } },
      { status: 'processing', lockedAt: { $lte: staleLock } },
    ],
  }, { $set: { status: 'processing', lockedAt: now } }, { new: true, sort: { createdAt: 1 } });
}

export async function processNotificationQueue({ limit = 100 } = {}) {
  const summary = { claimed: 0, sent: 0, failed: 0, skipped: 0, deferred: 0 };
  while (summary.claimed < limit) {
    const delivery = await claimNextNotificationDelivery();
    if (!delivery) break;
    summary.claimed += 1;
    const result = await processNotificationDelivery(delivery);
    if (result.status in summary) summary[result.status] += 1;
  }
  return summary;
}
