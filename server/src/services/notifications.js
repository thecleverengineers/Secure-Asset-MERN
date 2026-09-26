import { Notification, NotificationDelivery, NotificationPreference, User } from '../models/index.js';
import { emitNotification } from './realtime.js';
import { deliveryChannelConfigured } from './notificationDelivery.js';

const categoryKey = {
  payment: 'payment', survey: 'survey', complaint: 'complaint', lease: 'lease', maintenance: 'maintenance',
  message: 'message', system: 'system',
};

export async function createNotification({ user: userId, title, message, category = 'system', actionUrl, metadata = {} }) {
  const [user, preference] = await Promise.all([
    User.findById(userId).select('email phone whatsappNumber status').lean(),
    NotificationPreference.findOne({ user: userId }).lean(),
  ]);
  if (!user || user.status !== 'active') return null;
  const key = categoryKey[category] || 'system';
  if (preference?.categories?.[key] === false) return null;
  const channels = preference?.channels || { inApp: true, email: true };
  const whatsappTemplate = metadata?.whatsappTemplate || metadata?.whatsapp?.templateKey;
  let notification = null;
  if (channels.inApp !== false) {
    notification = await Notification.create({ user: userId, title, message, category, actionUrl, metadata });
    emitNotification(notification);
  }
  const commonMetadata = { category, title, message, actionUrl, ...metadata };
  for (const channel of ['email', 'sms', 'whatsapp', 'push']) {
    // Transactional approved WhatsApp templates are opt-in by default when no
    // preference exists, while an explicit user opt-out is always respected.
    const channelEnabled = channels[channel] || (channel === 'whatsapp' && whatsappTemplate && channels.whatsapp !== false);
    if (!channelEnabled) continue;
    const destination = channel === 'email'
      ? user.email
      : channel === 'whatsapp'
        ? (user.whatsappNumber || user.phone)
        : user.phone;
    // A template delivery is deliberately queued even if the provider is
    // currently disabled. The worker will mark it skipped with a clear reason;
    // this avoids a race when an admin enables WhatsApp after the event fires.
    const configured = channel === 'whatsapp' && whatsappTemplate ? true : deliveryChannelConfigured(channel);
    await NotificationDelivery.create({
      notification: notification?._id,
      user: userId,
      channel,
      destination,
      status: configured && destination ? 'pending' : 'skipped',
      lastError: !destination ? `User has no ${channel === 'email' ? 'email address' : channel === 'whatsapp' ? 'WhatsApp number' : 'phone number'}` : configured ? '' : `${channel} provider is not configured`,
      metadata: commonMetadata,
    });
  }
  return notification;
}

export async function notifyOnce({ user, key, title, message, actionUrl, category = 'system', metadata = {} }) {
  const [notificationExists, deliveryExists] = await Promise.all([
    Notification.exists({ user, 'metadata.key': key }),
    NotificationDelivery.exists({ user, 'metadata.key': key }),
  ]);
  if (notificationExists || deliveryExists) return null;
  return createNotification({ user, title, message, actionUrl, category, metadata: { ...metadata, key } });
}
