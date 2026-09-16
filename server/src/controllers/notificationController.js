import { z } from 'zod';
import { Notification, NotificationPreference } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

const preferencesSchema = z.object({
  channels: z.object({ inApp: z.boolean().optional(), email: z.boolean().optional(), sms: z.boolean().optional(), whatsapp: z.boolean().optional(), push: z.boolean().optional() }).optional(),
  categories: z.object({ payment: z.boolean().optional(), survey: z.boolean().optional(), complaint: z.boolean().optional(), lease: z.boolean().optional(), maintenance: z.boolean().optional(), message: z.boolean().optional(), system: z.boolean().optional() }).optional(),
  quietHours: z.object({ enabled: z.boolean().optional(), start: z.string().max(10).optional(), end: z.string().max(10).optional(), timezone: z.string().max(80).optional() }).optional(),
}).strict();

export const listNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.readAt = null;
  if (req.query.category) filter.category = String(req.query.category);
  const [data, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);
  res.json({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) });
});
export const unreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user._id, readAt: null });
  res.json({ success: true, data: { count } });
});
export const markRead = asyncHandler(async (req, res) => {
  const item = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: { readAt: new Date() } }, { new: true });
  if (!item) throw new ApiError(404, 'Notification not found');
  res.json({ success: true, data: item });
});
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ success: true, message: 'Notifications marked as read' });
});
export const deleteNotification = asyncHandler(async (req, res) => {
  const result = await Notification.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!result.deletedCount) throw new ApiError(404, 'Notification not found');
  res.json({ success: true, message: 'Notification deleted' });
});
export const getPreferences = asyncHandler(async (req, res) => {
  const data = await NotificationPreference.findOneAndUpdate({ user: req.user._id }, { $setOnInsert: { user: req.user._id } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
  res.json({ success: true, data });
});
export const updatePreferences = asyncHandler(async (req, res) => {
  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Invalid notification preferences', parsed.error.flatten());
  const updates = {};
  for (const [group, values] of Object.entries(parsed.data)) for (const [key, value] of Object.entries(values || {})) updates[`${group}.${key}`] = value;
  const data = await NotificationPreference.findOneAndUpdate({ user: req.user._id }, { $set: updates, $setOnInsert: { user: req.user._id } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  res.json({ success: true, data, message: 'Notification preferences updated' });
});
