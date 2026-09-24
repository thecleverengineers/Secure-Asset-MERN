import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Property, Tenant, Tenancy } from '../models/index.js';
import { env } from '../config/env.js';
import { capabilityRolesForUser } from '../services/rbac.js';
import { findPendingTenantInvitation, hashTenantInvitationToken, mergeLandlordTenantRows } from '../services/tenantInvitations.js';
import { writeAudit } from '../middleware/audit.js';
import { normalizeEmail, normalizeIndianMobile } from '../utils/identity.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(10).max(40),
  property: z.string().trim().regex(/^[a-f\d]{24}$/i).or(z.literal('')).optional(),
  unitName: z.string().trim().max(120).optional().default(''),
  privateNotes: z.string().trim().max(2000).optional().default(''),
}).strict();

function assertLandlord(user) {
  if (!capabilityRolesForUser(user).includes('landlord')) throw new ApiError(403, 'An active landlord workspace is required');
}

function invitationLink(token) {
  const url = new URL('/login?mode=register', env.TENANT_INVITATION_BASE_URL || env.PUBLIC_APP_URL);
  // Fragment tokens are not sent to the server in request paths or access logs.
  url.hash = new URLSearchParams({ tenantInvite: token }).toString();
  return url.toString();
}

async function rotateInvitation(tenant) {
  const token = randomBytes(32).toString('base64url');
  tenant.invitationStatus = 'pending';
  tenant.invitationTokenHash = hashTenantInvitationToken(token);
  tenant.invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await tenant.save({ validateModifiedOnly: true });
  return { inviteUrl: invitationLink(token), expiresAt: tenant.invitationExpiresAt };
}

export const createTenantInvitation = asyncHandler(async (req, res) => {
  assertLandlord(req.user);
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, 'Enter a valid tenant name, email and WhatsApp mobile number', parsed.error.flatten());
  const email = normalizeEmail(parsed.data.email);
  const phone = normalizeIndianMobile(parsed.data.phone);
  if (!phone) throw new ApiError(422, 'Enter a valid Indian mobile number for WhatsApp and OTP verification');
  const property = parsed.data.property ? await Property.findOne({ _id: parsed.data.property, owner: req.user._id, deletedAt: null }).select('_id title').lean() : null;
  if (parsed.data.property && !property) throw new ApiError(403, 'Choose one of your own active properties');
  const duplicate = await Tenant.findOne({
    createdBy: req.user._id,
    property: property?._id || null,
    email,
    invitationStatus: { $in: ['pending', 'registered'] },
  }).select('_id invitationStatus').lean();
  if (duplicate) throw new ApiError(409, duplicate.invitationStatus === 'registered' ? 'This tenant is already registered for the property' : 'An invitation for this tenant is already active');

  const tenant = await Tenant.create({
    name: parsed.data.name,
    email,
    phone,
    property: property?._id,
    unitName: parsed.data.unitName,
    privateNotes: parsed.data.privateNotes,
    status: 'applicant',
    invitationStatus: 'not_sent',
    createdBy: req.user._id,
  });
  const invite = await rotateInvitation(tenant);
  await writeAudit(req, { action: 'tenant-invitation:created', module: 'tenants', recordId: tenant._id });
  res.set('Cache-Control', 'no-store');
  res.status(201).json({
    success: true,
    data: { tenant: { _id: tenant._id, name: tenant.name, email: tenant.email, phone: tenant.phone, invitationStatus: tenant.invitationStatus }, ...invite },
    message: 'Tenant invitation created. Open WhatsApp to send the secure registration link.',
  });
});

export const resendTenantInvitation = asyncHandler(async (req, res) => {
  assertLandlord(req.user);
  if (!/^[a-f\d]{24}$/i.test(req.params.id || '')) throw new ApiError(404, 'Tenant contact not found');
  const tenant = await Tenant.findOne({ _id: req.params.id, createdBy: req.user._id }).select('+invitationTokenHash');
  if (!tenant) throw new ApiError(404, 'Tenant contact not found');
  if (tenant.user || tenant.invitationStatus === 'registered') throw new ApiError(409, 'This tenant has already registered');
  if (!tenant.phone || !tenant.email) throw new ApiError(422, 'Add an email and WhatsApp mobile number before sending an invitation');
  const invite = await rotateInvitation(tenant);
  await writeAudit(req, { action: 'tenant-invitation:renewed', module: 'tenants', recordId: tenant._id });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { tenant: { _id: tenant._id, name: tenant.name, email: tenant.email, phone: tenant.phone, invitationStatus: tenant.invitationStatus }, ...invite }, message: 'Invitation link renewed.' });
});

export const lookupTenantInvitation = asyncHandler(async (req, res) => {
  const tenant = await findPendingTenantInvitation(req.body?.token);
  if (!tenant) throw new ApiError(404, 'This tenant invitation is invalid or has expired. Ask the landlord for a new link.');
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: { name: tenant.name, email: tenant.email, phone: tenant.phone, expiresAt: tenant.invitationExpiresAt },
  });
});

export const acceptTenantInvitation = asyncHandler(async (req, res) => {
  const user = req.user;
  if (String(user?.role || '').toLowerCase() !== 'tenant' || user.status !== 'active' || !user.mobileVerifiedAt) {
    throw new ApiError(403, 'Sign in to a mobile-verified tenant account to accept this invitation');
  }
  const tenant = await findPendingTenantInvitation(req.body?.token);
  if (!tenant) throw new ApiError(404, 'This tenant invitation is invalid or has expired. Ask the landlord to send a new link.');
  if (tenant.email !== normalizeEmail(user.email) || tenant.phone !== normalizeIndianMobile(user.phone)) {
    throw new ApiError(403, 'This invitation was sent to a different email address or mobile number');
  }
  const updated = await Tenant.findOneAndUpdate({
    _id: tenant._id,
    invitationTokenHash: hashTenantInvitationToken(req.body.token),
    invitationStatus: 'pending',
    invitationExpiresAt: { $gt: new Date() },
    email: normalizeEmail(user.email),
    phone: normalizeIndianMobile(user.phone),
  }, {
    $set: { user: user._id, name: user.name, invitationStatus: 'registered' },
    $unset: { invitationTokenHash: 1, invitationExpiresAt: 1 },
  }, { new: true });
  if (!updated) throw new ApiError(409, 'This invitation has already been used or has expired');
  await writeAudit(req, { action: 'tenant-invitation:accepted', module: 'tenants', recordId: updated._id });
  res.json({ success: true, data: { tenantId: updated._id }, message: 'Tenant invitation accepted' });
});

export const listLandlordTenants = asyncHandler(async (req, res) => {
  assertLandlord(req.user);
  const parsed = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    filter: z.enum(['all', 'added', 'holders']).default('all'),
    search: z.string().trim().max(160).default(''),
  }).safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, 'Invalid tenant list filters');
  const uid = req.user._id;
  const propertyIds = await Property.distinct('_id', { owner: uid, deletedAt: null });
  const personFields = 'name email phone avatar kycStatus mobileVerifiedAt';
  const [contacts, tenancies] = await Promise.all([
    Tenant.find({ invitationStatus: { $ne: 'revoked' }, $or: [{ createdBy: uid }, { property: { $in: propertyIds } }] })
      .select('name email phone user property unitName status privateNotes createdBy invitationStatus invitationExpiresAt createdAt')
      .populate('user', personFields).populate('property', 'title address images').lean(),
    Tenancy.find({ landlord: uid, status: { $ne: 'cancelled' } })
      .select('tenant property space rentalUnit status createdAt')
      .populate('tenant', personFields).populate('property', 'title address images')
      .populate('rentalUnit', 'name unitNumber').populate('space', 'name').lean(),
  ]);
  const all = mergeLandlordTenantRows(contacts, tenancies, uid);
  const isAdded = (row) => String(row.createdBy || '') === String(uid);
  const counts = { all: all.length, added: all.filter(isAdded).length, holders: all.filter((row) => row.isTenancyHolder).length };
  const { filter, search, limit } = parsed.data;
  const needle = search.toLowerCase();
  const filtered = all.filter((row) => (filter === 'all' || (filter === 'added' ? isAdded(row) : row.isTenancyHolder))
    && (!needle || [row.name, row.email, row.phone, row.user?.name, row.user?.email, row.user?.phone, row.property?.title, row.unitName]
      .some((value) => String(value || '').toLowerCase().includes(needle))));
  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const page = Math.min(parsed.data.page, pages);
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: filtered.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: filtered.length, pages }, counts });
});

export const cancelTenantInvitation = asyncHandler(async (req, res) => {
  assertLandlord(req.user);
  if (!/^[a-f\d]{24}$/i.test(req.params.id || '')) throw new ApiError(404, 'Tenant contact not found');
  const tenant = await Tenant.findOneAndUpdate({
    _id: req.params.id, createdBy: req.user._id, user: null,
    invitationStatus: { $in: ['not_sent', 'pending', 'expired'] },
  }, {
    $set: { invitationStatus: 'revoked' },
    $unset: { invitationTokenHash: 1, invitationExpiresAt: 1 },
  }, { new: true });
  if (!tenant) throw new ApiError(409, 'Only your unregistered tenant invitations can be cancelled');
  await writeAudit(req, { action: 'tenant-invitation:cancelled', module: 'tenants', recordId: tenant._id });
  res.json({ success: true, message: 'Invitation cancelled and link revoked.' });
});
