import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../server/src/config/db.js';
import { Conversation, Message, PlatformModule, SiteSetting, User } from '../server/src/models/index.js';
import { ensurePlatformConfiguration } from '../server/src/services/platformConfiguration.js';
import { DEFAULT_PLATFORM_MODULES } from '../server/src/services/platformDefaults.js';

const migrationId = '2026-06-enterprise-platform-v1';

function participantIds(message) {
  const values = [message.sender, ...(message.recipients || [])]
    .map((value) => value?._id || value)
    .filter((value) => mongoose.isValidObjectId(value));
  return [...new Map(values.map((value) => [String(value), value])).values()];
}

async function backfillPlatformAccessRules() {
  let updated = 0;
  for (const definition of DEFAULT_PLATFORM_MODULES.filter((item) => item.scope === 'app')) {
    const result = await PlatformModule.updateOne(
      { scope: 'app', key: definition.key, $or: [{ accessRules: { $exists: false } }, { accessRules: { $size: 0 } }] },
      { $set: { accessRules: definition.accessRules, roles: definition.roles, modes: definition.modes } },
    );
    updated += result.modifiedCount || 0;
  }
  return updated;
}



async function migrateAuthenticationConfiguration() {
  const defaults = {
    'authentication.badge': 'Enterprise property operations',
    'authentication.headline': 'Every property workflow. One secure platform.',
    'authentication.description': 'Manage properties, tenants, payments, surveys, legal records and communication with secure role-based access.',
    'authentication.features': ['Role-based access', 'Encrypted document vault', 'Real-time messaging', 'Automated billing', 'Audit trails'],
    'authentication.footerText': 'Enterprise property, tenancy and survey operations',
    'authentication.loginTitle': 'Welcome back', 'authentication.loginSubtitle': 'Sign in with your organisation account.',
    'authentication.registerTitle': 'Create your account', 'authentication.registerSubtitle': 'Every new account starts as a Tenant and can activate Landlord or Surveyor Mode.',
    'authentication.otpTitle': 'Passwordless login', 'authentication.otpSubtitle': 'Use a secure one-time password sent to your verified email.',
    'authentication.forgotTitle': 'Reset password', 'authentication.forgotSubtitle': 'We will send a time-limited reset link to your email.',
    'authentication.allowRegistration': true, 'authentication.allowPasswordLogin': true, 'authentication.allowOtpLogin': true,
    'authentication.showDemoAccounts': false,
  };
  let modified = 0;
  for (const [path, value] of Object.entries(defaults)) {
    const result = await SiteSetting.updateMany({ [path]: { $exists: false } }, { $set: { [path]: value } });
    modified += result.modifiedCount || 0;
  }
  return modified;
}

async function invalidateLegacyRefreshSessions() {
  const result = await User.updateMany({ 'refreshTokens.0': { $exists: true }, 'refreshTokens.sessionId': { $exists: false } }, { $set: { refreshTokens: [] } });
  return result.modifiedCount || 0;
}

async function migrateLegacyMessageAttachments() {
  const collection = mongoose.connection.db.collection('messages');
  const result = await collection.updateMany(
    { 'attachments.0': { $type: 'string' } },
    [{
      $set: {
        attachments: {
          $map: {
            input: '$attachments',
            as: 'attachment',
            in: {
              $cond: [
                { $eq: [{ $type: '$$attachment' }, 'string'] },
                { legacyUrl: '$$attachment', name: 'Legacy attachment' },
                '$$attachment',
              ],
            },
          },
        },
      },
    }],
  );
  return { matched: result.matchedCount || 0, modified: result.modifiedCount || 0 };
}

async function migrateLegacyMessages() {
  const cursor = Message.find({ $or: [{ conversation: null }, { conversation: { $exists: false } }] }).cursor();
  let migrated = 0; let skipped = 0;
  for await (const message of cursor) {
    const participants = participantIds(message);
    if (participants.length < 2) { skipped += 1; continue; }
    const legacyId = String(message.conversationId || message._id);
    const key = `legacy:${legacyId}`.slice(0, 180);
    const conversation = await Conversation.findOneAndUpdate(
      { key },
      { $setOnInsert: { key, participants, type: 'direct', createdBy: message.sender, lastMessageAt: message.createdAt, lastMessagePreview: String(message.body || '').slice(0, 180), reference: { label: legacyId } } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    message.conversation = conversation._id;
    message.conversationId = String(conversation._id);
    await message.save({ validateModifiedOnly: true });
    migrated += 1;
  }
  return { migrated, skipped };
}

try {
  await connectDatabase();
  await ensurePlatformConfiguration();
  const [platformModulesUpdated, messages, legacyAttachments, authenticationSettings, invalidatedLegacySessions] = await Promise.all([
    backfillPlatformAccessRules(),
    migrateLegacyMessages(),
    migrateLegacyMessageAttachments(),
    migrateAuthenticationConfiguration(),
    invalidateLegacyRefreshSessions(),
  ]);
  await mongoose.connection.db.collection('system_migrations').updateOne(
    { _id: migrationId },
    { $set: { completedAt: new Date(), platformModulesUpdated, messages, legacyAttachments, authenticationSettings, invalidatedLegacySessions, node: process.versions.node, version: 3 } },
    { upsert: true },
  );
  console.log('Enterprise platform migration complete:', { platformModulesUpdated, ...messages, legacyAttachments, authenticationSettings, invalidatedLegacySessions });
} catch (error) {
  console.error('Enterprise platform migration failed:', error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
