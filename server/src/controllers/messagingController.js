import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Application, Conversation, Message, User } from '../models/index.js';
import { createNotification } from '../services/notifications.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { getRealtimeServer } from '../services/realtime.js';
import { assertMessagingParticipants, listMessagingContactsForUser, prepareMessageAttachments } from '../services/messaging.js';
import { writeAudit } from '../middleware/audit.js';
import { isApplicationAccepted, sameId } from '../services/applicationWorkflow.js';

const conversationSchema = z.object({
  participants: z.array(z.string()).min(1).max(25),
  title: z.string().trim().max(180).optional(),
  type: z.enum(['direct', 'group', 'property', 'complaint', 'survey', 'application', 'support']).default('direct'),
  reference: z.object({ model: z.string().max(80).optional(), id: z.string().optional(), label: z.string().max(200).optional() }).optional(),
});
const messageSchema = z.object({ body: z.string().trim().max(10000).default(''), attachments: z.array(z.union([z.string(), z.object({ file: z.string(), name: z.string().optional(), mimeType: z.string().optional(), sizeBytes: z.number().optional() })])).max(20).default([]) }).refine((value) => Boolean(value.body || value.attachments.length), { message: 'Add a message or attachment' });
const directKey = (ids) => `direct:${crypto.createHash('sha256').update(ids.map(String).sort().join(':')).digest('hex').slice(0, 32)}`;

async function assertAcceptedApplicationConversation(user, conversation, participantIds) {
  if (conversation.type !== 'application') return;
  const reference = conversation.reference || {};
  if (String(reference.model || '').toLowerCase() !== 'application' || !mongoose.isValidObjectId(reference.id)) {
    throw new ApiError(422, 'An application conversation must reference an accepted application');
  }
  const application = await Application.findById(reference.id).populate('property', 'owner').lean();
  if (!application || !isApplicationAccepted(application.status)) throw new ApiError(409, 'Landlord chat is available after the application is accepted');
  const landlordId = application.landlord || application.property?.owner;
  const participantSet = new Set(participantIds.map(String));
  if (!landlordId || !sameId(application.applicant, user._id) || participantSet.size !== 2 || !participantSet.has(String(application.applicant)) || !participantSet.has(String(landlordId))) {
    throw new ApiError(403, 'Only the accepted applicant and property landlord can start this conversation');
  }
}

async function conversationForUser(id, userId) {
  const conversation = await Conversation.findOne({ _id: id, participants: userId });
  if (!conversation) throw new ApiError(404, 'Conversation not found');
  return conversation;
}


export const listMessagingContacts = asyncHandler(async (req, res) => {
  const data = await listMessagingContactsForUser(req.user, req.query.search);
  res.json({ success: true, data });
});

export const listConversations = asyncHandler(async (req, res) => {
  const data = await Conversation.find({ participants: req.user._id, archivedBy: { $ne: req.user._id } })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate('participants', 'name avatar role activeMode status')
    .lean();
  const unread = await Message.aggregate([
    { $match: { recipients: req.user._id, 'readBy.user': { $ne: req.user._id } } },
    { $group: { _id: '$conversation', count: { $sum: 1 } } },
  ]);
  const counts = new Map(unread.map((row) => [String(row._id), row.count]));
  res.json({ success: true, data: data.map((row) => ({ ...row, unreadCount: counts.get(String(row._id)) || 0 })) });
});

export const createConversation = asyncHandler(async (req, res) => {
  const parsed = conversationSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Invalid conversation details', parsed.error.flatten());
  const participantIds = [...new Set([String(req.user._id), ...parsed.data.participants.filter((id) => id !== String(req.user._id))])];
  await assertAcceptedApplicationConversation(req.user, parsed.data, participantIds);
  await assertMessagingParticipants(req.user, participantIds);
  const users = await User.find({ _id: { $in: participantIds }, status: 'active' }).select('_id').lean();
  if (users.length !== participantIds.length) throw new ApiError(422, 'One or more participants are unavailable');
  const key = parsed.data.type === 'application'
    ? `application:${String(parsed.data.reference?.id)}:${crypto.createHash('sha256').update(participantIds.map(String).sort().join(':')).digest('hex').slice(0, 24)}`
    : parsed.data.type === 'direct' && participantIds.length === 2 ? directKey(participantIds) : undefined;
  let conversation = key ? await Conversation.findOne({ key }) : null;
  if (!conversation) conversation = await Conversation.create({ ...parsed.data, key, participants: participantIds, createdBy: req.user._id, lastMessageAt: new Date() });
  await writeAudit(req, { action: 'create', module: 'conversations', recordId: conversation._id, updatedValue: { participants: participantIds, type: parsed.data.type } });
  res.status(201).json({ success: true, data: await conversation.populate('participants', 'name avatar role activeMode') });
});

export const listMessages = asyncHandler(async (req, res) => {
  const conversation = await conversationForUser(req.params.id, req.user._id);
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
  const filter = { conversation: conversation._id };
  if (req.query.before) filter.createdAt = { $lt: new Date(String(req.query.before)) };
  const rows = await Message.find(filter).sort({ createdAt: -1 }).limit(limit).populate('sender', 'name avatar').lean();
  res.json({ success: true, data: rows.reverse(), hasMore: rows.length === limit });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const conversation = await conversationForUser(req.params.id, req.user._id);
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Invalid message', parsed.error.flatten());
  const recipients = conversation.participants.filter((id) => String(id) !== String(req.user._id));
  const attachments = await prepareMessageAttachments({ sender: req.user, recipients, attachments: parsed.data.attachments });
  const message = await Message.create({ conversation: conversation._id, conversationId: String(conversation._id), sender: req.user._id, recipients, body: parsed.data.body, attachments, readBy: [{ user: req.user._id, readAt: new Date() }] });
  const preview = message.body?.slice(0, 180) || attachments[0]?.name || 'Attachment';
  conversation.lastMessageAt = message.createdAt; conversation.lastMessagePreview = preview; await conversation.save();
  const populated = await message.populate('sender', 'name avatar');
  const io = getRealtimeServer();
  io?.to(`conversation:${conversation._id}`).emit('message:new', populated);
  for (const recipient of recipients) {
    io?.to(`user:${recipient}`).emit('message:new', populated);
    await createNotification({ user: recipient, title: `New message from ${req.user.name}`, message: preview.slice(0, 160), category: 'message', actionUrl: `/app/messages?conversation=${conversation._id}`, metadata: { conversation: conversation._id, message: message._id } });
  }
  res.status(201).json({ success: true, data: populated });
});

export const markConversationRead = asyncHandler(async (req, res) => {
  const conversation = await conversationForUser(req.params.id, req.user._id);
  await Message.updateMany({ conversation: conversation._id, recipients: req.user._id, 'readBy.user': { $ne: req.user._id } }, { $push: { readBy: { user: req.user._id, readAt: new Date() } } });
  res.json({ success: true, message: 'Conversation marked as read' });
});

export const archiveConversation = asyncHandler(async (req, res) => {
  const conversation = await conversationForUser(req.params.id, req.user._id);
  await Conversation.updateOne({ _id: conversation._id }, { $addToSet: { archivedBy: req.user._id } });
  res.json({ success: true, message: 'Conversation archived' });
});
