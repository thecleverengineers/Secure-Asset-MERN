import {
  Application, Conversation, DriveActivity, DriveFile, DriveShare, Property, PropertyVisit,
  SurveyJob, SurveyQuotation, SurveyProject, Tenancy, User,
} from '../models/index.js';
import { ApiError } from '../utils/apiError.js';

const objectIdString = (value) => value ? String(value._id || value) : '';

async function relatedContactIds(user) {
  const userId = user._id;
  if (['admin', 'manager'].includes(user.role)) {
    const rows = await User.find({ _id: { $ne: userId }, status: 'active' }).select('_id').lean();
    return new Set(rows.map((row) => String(row._id)));
  }
  const ids = new Set();
  const [support, conversations, applications, tenancies, visits, properties, projects, jobs, quotations] = await Promise.all([
    User.find({ role: { $in: ['admin', 'manager'] }, status: 'active' }).select('_id').lean(),
    Conversation.find({ participants: userId }).select('participants').lean(),
    Application.find({ $or: [{ applicant: userId }, { landlord: userId }] }).select('applicant landlord').lean(),
    Tenancy.find({ $or: [{ tenant: userId }, { landlord: userId }] }).select('tenant landlord').lean(),
    PropertyVisit.find({ $or: [{ requester: userId }, { landlord: userId }, { assignedTo: userId }] }).select('requester landlord assignedTo').lean(),
    Property.find({ $or: [{ owner: userId }, { manager: userId }] }).select('owner manager').lean(),
    SurveyProject.find({ $or: [{ client: userId }, { surveyor: userId }] }).select('client surveyor').lean(),
    SurveyJob.find({ $or: [{ client: userId }, { hiredSurveyor: userId }, { invitedSurveyors: userId }, { shortlistedSurveyors: userId }] }).select('client hiredSurveyor invitedSurveyors shortlistedSurveyors').lean(),
    SurveyQuotation.find({ $or: [{ client: userId }, { surveyor: userId }] }).select('client surveyor').lean(),
  ]);
  for (const row of support) ids.add(String(row._id));
  for (const conversation of conversations) for (const id of conversation.participants || []) ids.add(String(id));
  for (const row of applications) { ids.add(objectIdString(row.applicant)); ids.add(objectIdString(row.landlord)); }
  for (const row of tenancies) { ids.add(objectIdString(row.tenant)); ids.add(objectIdString(row.landlord)); }
  for (const row of visits) { ids.add(objectIdString(row.requester)); ids.add(objectIdString(row.landlord)); ids.add(objectIdString(row.assignedTo)); }
  for (const row of properties) { ids.add(objectIdString(row.owner)); ids.add(objectIdString(row.manager)); }
  for (const row of projects) { ids.add(objectIdString(row.client)); ids.add(objectIdString(row.surveyor)); }
  for (const row of jobs) {
    ids.add(objectIdString(row.client));
    ids.add(objectIdString(row.hiredSurveyor));
    for (const id of row.invitedSurveyors || []) ids.add(String(id));
    for (const id of row.shortlistedSurveyors || []) ids.add(String(id));
  }
  for (const row of quotations) { ids.add(objectIdString(row.client)); ids.add(objectIdString(row.surveyor)); }
  ids.delete(''); ids.delete(String(userId));
  return ids;
}

export async function listMessagingContactsForUser(user, search = '') {
  const ids = await relatedContactIds(user);
  const filter = { _id: { $in: [...ids] }, status: 'active' };
  const term = String(search || '').trim();
  if (term) filter.name = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  return User.find(filter).select('name avatar role activeMode landlordEnabled surveyorEnabled').sort({ name: 1 }).limit(100).lean();
}

export async function assertMessagingParticipants(user, participantIds) {
  if (['admin', 'manager'].includes(user.role)) return;
  const allowed = await relatedContactIds(user);
  const denied = participantIds.filter((id) => String(id) !== String(user._id) && !allowed.has(String(id)));
  if (denied.length) throw new ApiError(403, 'You can only start conversations with users connected to your property, tenancy, survey, application or support workflow');
}

export async function prepareMessageAttachments({ sender, recipients, attachments = [] }) {
  if (!attachments.length) return [];
  const fileIds = [...new Set(attachments.map((item) => String(item.file || item)).filter(Boolean))];
  const shares = await DriveShare.find({ itemType: 'file', itemId: { $in: fileIds }, revokedAt: null, $or: [{ granteeUser: sender._id }, { granteeEmail: String(sender.email || '').toLowerCase() }] }).select('itemId').lean();
  const sharedIds = new Set(shares.map((row) => String(row.itemId)));
  const files = await DriveFile.find({ _id: { $in: fileIds }, status: 'active' }).select('owner name mimeType sizeBytes confidentiality').lean();
  const accessible = files.filter((file) => String(file.owner) === String(sender._id) || sharedIds.has(String(file._id)));
  if (accessible.length !== fileIds.length) throw new ApiError(403, 'One or more attachments are unavailable');

  const now = new Date();
  for (const file of accessible) {
    for (const recipient of recipients) {
      if (String(file.owner) === String(recipient)) continue;
      await DriveShare.findOneAndUpdate(
        { itemType: 'file', itemId: file._id, granteeUser: recipient, revokedAt: null },
        { $set: { owner: file.owner, permission: 'viewer', capabilities: { view: true, preview: true, download: true, comment: false, upload: false, editMetadata: false, rename: false, move: false, delete: false, reshare: false, managePermissions: false } }, $setOnInsert: { createdBy: sender._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      await DriveActivity.create({ owner: file.owner, actor: sender._id, itemType: 'file', itemId: file._id, action: 'shared_as_message_attachment', sharingMethod: 'conversation', metadata: { recipient, at: now } });
    }
  }
  return accessible.map((file) => ({ file: file._id, name: file.name, mimeType: file.mimeType, sizeBytes: file.sizeBytes }));
}
