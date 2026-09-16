import crypto from 'node:crypto';
import { Server } from 'socket.io';
import { z } from 'zod';
import { verifyAccessToken } from '../utils/tokens.js';
import { Conversation, User, Message } from '../models/index.js';
import { env } from '../config/env.js';
import { setRealtimeServer } from './realtime.js';
import { createNotification } from './notifications.js';
import { resources } from './resources.js';
import { prepareMessageAttachments } from './messaging.js';
import { canResourceAction, getEffectiveRole } from './rbac.js';
import { isServerSessionActive, resolveSessionToken, SESSION_COOKIE_NAME } from './serverSession.js';

const messageSchema = z.object({
  conversationId: z.string().min(3).max(160).optional(),
  conversation: z.string().optional(),
  recipients: z.array(z.string()).min(1).max(25).optional(),
  body: z.string().trim().max(10000).default(''),
  attachments: z.array(z.union([z.string(), z.object({ file: z.string(), name: z.string().optional(), mimeType: z.string().optional(), sizeBytes: z.number().optional() })])).max(20).default([]),
  reference: z.object({ type: z.string().max(60).optional(), id: z.string().optional(), label: z.string().max(200).optional() }).optional(),
}).refine((value) => Boolean(value.body || value.attachments.length), { message: 'Add a message or attachment' });

function directConversationKey(ids) {
  return crypto.createHash('sha256').update(ids.map(String).sort().join(':')).digest('hex').slice(0, 32);
}

function handshakeCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { cookies[key] = decodeURIComponent(value); } catch { cookies[key] = value; }
  }
  return cookies;
}

async function authenticateSocket(socket, next) {
  try {
    const cookies = handshakeCookies(socket.handshake.headers?.cookie || '');
    const serverSession = await resolveSessionToken(cookies[SESSION_COOKIE_NAME]);
    if (serverSession?.user) {
      socket.user = serverSession.user;
      socket.sessionId = serverSession.record.sessionId;
      socket.authMethod = 'server-session';
      return next();
    }
    // A bearer handshake is accepted only as a bounded rolling-deployment
    // bridge. New clients authenticate with the HttpOnly session cookie.
    const token = socket.handshake.auth?.token || String(socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active') throw new Error('Unauthorized');
    socket.user = user;
    socket.authMethod = 'legacy-bearer';
    return next();
  } catch { return next(new Error('Unauthorized')); }
}

function monitorSocketSession(socket) {
  if (!socket.sessionId) return;
  const timer = setInterval(async () => {
    try {
      if (!await isServerSessionActive(socket.sessionId)) {
        socket.emit('session:revoked');
        socket.disconnect(true);
      }
    } catch { /* The next authenticated API call remains authoritative. */ }
  }, 60_000);
  timer.unref?.();
  socket.once('disconnect', () => clearInterval(timer));
}

async function resolveConversation(user, payload) {
  if (payload.conversation) {
    const conversation = await Conversation.findOne({ _id: payload.conversation, participants: user._id });
    if (!conversation) throw new Error('Conversation not found');
    return conversation;
  }
  const recipientIds = [...new Set((payload.recipients || []).filter((id) => String(id) !== String(user._id)))];
  const validRecipients = await User.find({ _id: { $in: recipientIds }, status: 'active' }).select('_id').lean();
  if (validRecipients.length !== recipientIds.length) throw new Error('One or more recipients are unavailable');
  const participants = [user._id, ...validRecipients.map((row) => row._id)];
  const key = payload.conversationId || `direct:${directConversationKey(participants)}`;
  return Conversation.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, participants, type: 'direct', createdBy: user._id, reference: { label: key } } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export function attachSocket(server) {
  const io = new Server(server, {
    cors: { origin: env.CLIENT_ORIGINS, credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 2 * 1024 * 1024,
  });
  setRealtimeServer(io);
  io.use(authenticateSocket);
  io.on('connection', (socket) => {
    monitorSocketSession(socket);
    socket.join(`user:${socket.user._id}`);
    socket.join(`role:${socket.user.role}`);
    socket.join(`role:${getEffectiveRole(socket.user)}`);
    socket.on('resource:subscribe', async (resource, callback) => {
      try {
        const key = String(resource || '');
        const config = resources[key];
        const allowed = /^[a-z0-9-]{2,80}$/i.test(key) && await canResourceAction(key, socket.user, 'view', config);
        if (!allowed) throw new Error('Resource access denied');
        socket.join(`resource:${key}`);
        callback?.({ success: true });
      } catch (error) {
        callback?.({ success: false, message: error.message || 'Resource access denied' });
      }
    });
    socket.on('resource:unsubscribe', (resource) => socket.leave(`resource:${String(resource || '')}`));
    socket.on('conversation:join', async (conversationId, callback) => {
      try {
        const allowed = await Conversation.exists({ _id: conversationId, participants: socket.user._id });
        if (!allowed) throw new Error('Conversation access denied');
        socket.join(`conversation:${conversationId}`);
        callback?.({ success: true });
      } catch (error) { callback?.({ success: false, message: error.message }); }
    });
    socket.on('conversation:leave', (conversationId) => {
      const id = String(conversationId || '');
      if (/^[a-f0-9]{24}$/i.test(id)) socket.leave(`conversation:${id}`);
    });
    socket.on('message:send', async (input, callback) => {
      try {
        const parsed = messageSchema.safeParse(input);
        if (!parsed.success) throw new Error('Invalid message');
        const conversation = await resolveConversation(socket.user, parsed.data);
        const recipients = conversation.participants.filter((id) => String(id) !== String(socket.user._id));
        const attachments = await prepareMessageAttachments({ sender: socket.user, recipients, attachments: parsed.data.attachments });
        const message = await Message.create({
          conversation: conversation._id,
          conversationId: String(conversation._id),
          sender: socket.user._id,
          recipients,
          body: parsed.data.body,
          attachments,
          reference: parsed.data.reference,
          readBy: [{ user: socket.user._id, readAt: new Date() }],
        });
        const preview = message.body?.slice(0, 180) || attachments[0]?.name || 'Attachment';
        conversation.lastMessageAt = message.createdAt;
        conversation.lastMessagePreview = preview;
        await conversation.save();
        const populated = await message.populate([{ path: 'sender', select: 'name avatar' }, { path: 'recipients', select: 'name avatar' }]);
        io.to(`conversation:${conversation._id}`).emit('message:new', populated);
        for (const recipient of recipients) {
          io.to(`user:${recipient}`).emit('message:new', populated);
          await createNotification({ user: recipient, title: `New message from ${socket.user.name}`, message: preview.slice(0, 160), category: 'message', actionUrl: `/app/messages?conversation=${conversation._id}`, metadata: { conversation: conversation._id, message: message._id } });
        }
        callback?.({ success: true, data: populated, conversation });
      } catch (error) { callback?.({ success: false, message: error.message }); }
    });
  });

  // Presence has its own namespace and connection lifecycle. Notification
  // delivery can reconnect independently without changing a user's presence
  // state, and both namespaces validate the same revocable server session.
  const presence = io.of('/presence');
  presence.use(authenticateSocket);
  const online = new Map();
  presence.on('connection', (socket) => {
    monitorSocketSession(socket);
    const userId = String(socket.user._id);
    const count = Number(online.get(userId) || 0) + 1;
    online.set(userId, count);
    socket.emit('presence:state', { userId, status: 'online' });
    socket.broadcast.emit('presence:changed', { userId, status: 'online' });
    socket.on('presence:heartbeat', () => socket.emit('presence:state', { userId, status: 'online' }));
    socket.on('disconnect', () => {
      const remaining = Math.max(0, Number(online.get(userId) || 1) - 1);
      if (remaining) online.set(userId, remaining);
      else {
        online.delete(userId);
        socket.broadcast.emit('presence:changed', { userId, status: 'offline' });
      }
    });
  });
  return io;
}
