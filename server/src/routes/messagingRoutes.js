import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireFeaturePermission } from '../middleware/rolePermission.js';
import { archiveConversation, createConversation, listConversations, listMessages, listMessagingContacts, markConversationRead, sendMessage } from '../controllers/messagingController.js';
const router = Router();
router.use(authenticate, requireFeaturePermission('module:messages'));
router.get('/contacts', listMessagingContacts);
router.get('/conversations', listConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:id/messages', listMessages);
router.post('/conversations/:id/messages', sendMessage);
router.patch('/conversations/:id/read', markConversationRead);
router.patch('/conversations/:id/archive', archiveConversation);
// Backward-compatible aliases for older clients.
router.post('/conversations/:id/read', markConversationRead);
router.post('/conversations/:id/archive', archiveConversation);
export default router;
