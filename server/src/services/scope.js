import mongoose from 'mongoose';
import { Property, Tenant, Application, Tenancy, Survey } from '../models/index.js';
import { getEffectiveRole, plainUser } from './rbac.js';

function objectIds(values = []) {
  return values
    .map((value) => value?._id || value)
    .filter((value) => mongoose.isValidObjectId(value))
    .map((value) => new mongoose.Types.ObjectId(value));
}

export function assignedPropertyIds(user) {
  return objectIds(user?.assignedProperties || []);
}

// Mongoose requires the top-level filter passed to find/countDocuments to be
// an object. Keep every caller fail-closed when a legacy capability scope or
// a malformed extension returns an array instead of a Mongo filter object.
// Arrays represent OR clauses, so preserve their meaning without allowing a
// non-object value to become an unscoped query.
export function normalizeQueryFilter(filter) {
  if (Array.isArray(filter)) {
    const clauses = filter
      .filter((item) => item && typeof item === 'object')
      .map((item) => normalizeQueryFilter(item));
    return clauses.length ? { $or: clauses } : { _id: null };
  }
  if (!filter || typeof filter !== 'object') return { _id: null };
  return filter;
}

async function managerContext(user) {
  const uid = user._id;
  const assigned = assignedPropertyIds(user);
  const managedPropertyIds = await Property.distinct('_id', {
    deletedAt: null,
    $or: [{ manager: uid }, { _id: { $in: assigned } }],
  });
  if (!managedPropertyIds.length) return { propertyIds: [], tenantIds: [], surveyorIds: [] };

  const [tenantRecords, applicationTenantIds, tenancyTenantIds, surveyorIds] = await Promise.all([
    Tenant.distinct('user', { property: { $in: managedPropertyIds } }),
    Application.distinct('applicant', { property: { $in: managedPropertyIds } }),
    Tenancy.distinct('tenant', { property: { $in: managedPropertyIds } }),
    Survey.distinct('surveyor', { property: { $in: managedPropertyIds } }),
  ]);
  const tenantIds = [...new Map([...tenantRecords, ...applicationTenantIds, ...tenancyTenantIds].filter(Boolean).map((id) => [String(id), id])).values()];
  return { propertyIds: managedPropertyIds, tenantIds, surveyorIds: surveyorIds.filter(Boolean) };
}

export async function buildScope(user, resource) {
  if (!user || user.role === 'admin') return {};
  const uid = user._id;

  if (user.role === 'manager') {
    const { propertyIds, tenantIds, surveyorIds } = await managerContext(user);
    const propertyScope = { $in: propertyIds };
    if (resource === 'properties') return { _id: propertyScope };
    if (['units', 'tenants', 'leases', 'surveys', 'applications', 'payments', 'complaints', 'property-spaces', 'property-media', 'tenant-interviews', 'property-visits', 'tenancies', 'rental-invoices', 'utility-readings', 'property-promotions', 'facilities', 'facility-bookings'].includes(resource)) {
      return { property: propertyScope };
    }
    if (resource === 'users') return { _id: { $in: [...tenantIds, ...surveyorIds, uid] } };
    if (resource === 'tenant-profiles' || resource === 'tenant-kyc') return { user: { $in: tenantIds } };
    if (resource === 'occupants') return { tenant: { $in: tenantIds } };
    if (resource === 'reminder-rules') return { $or: [{ property: propertyScope }, { owner: uid }] };
    if (resource === 'site-enquiries') return { $or: [{ property: propertyScope }, { assignedTo: uid }] };
    if (resource === 'approvals') return { $or: [{ property: propertyScope }, { requester: uid }] };
    if (resource === 'documents') return { $or: [{ property: propertyScope }, { owner: uid }] };
    if (resource === 'messages') return { $or: [{ sender: uid }, { recipients: uid }] };
    if (resource === 'notifications' || resource === 'notification-preferences') return { user: uid };
    if (resource === 'attendance') return { user: { $in: surveyorIds } };
    if (resource === 'audit-logs') return { user: uid };
    return { _id: null };
  }

  const effectiveRole = getEffectiveRole(user);

  if (effectiveRole === 'landlord') {
    const propertyIds = await Property.distinct('_id', { owner: uid, deletedAt: null });
    const propertyScope = { $in: propertyIds };
    const tenantIds = await Tenancy.distinct('tenant', { landlord: uid, property: propertyScope });
    const scopes = {
      properties: { owner: uid, deletedAt: null }, subscriptions: { user: uid }, tenants: { property: propertyScope }, leases: { property: propertyScope }, payments: { $or: [{ payee: uid }, { property: propertyScope }] }, complaints: { property: propertyScope },
      documents: { $or: [{ owner: uid }, { property: propertyScope }] }, notifications: { user: uid }, 'notification-preferences': { user: uid }, messages: { $or: [{ sender: uid }, { recipients: uid }] }, approvals: { $or: [{ property: propertyScope }, { requester: uid }] },
      applications: { $or: [{ landlord: uid }, { property: propertyScope }] }, 'property-spaces': { owner: uid }, 'property-media': { owner: uid },
      'tenant-profiles': { user: { $in: tenantIds } }, 'tenant-kyc': { user: { $in: tenantIds } }, occupants: { $or: [{ tenant: { $in: tenantIds } }, { tenancy: { $exists: true } }] },
      'tenant-interviews': { landlord: uid }, 'property-visits': { landlord: uid }, tenancies: { landlord: uid }, 'rental-invoices': { landlord: uid }, 'utility-readings': { landlord: uid }, 'reminder-rules': { owner: uid }, 'property-promotions': { owner: uid },
      facilities: { owner: uid }, 'facility-bookings': { owner: uid }, 'site-enquiries': { property: propertyScope },
      'survey-jobs': { client: uid }, 'survey-quotations': { client: uid }, 'survey-projects': { client: uid },
    };
    return scopes[resource] || { _id: null };
  }

  if (effectiveRole === 'surveyor') {
    const surveyPropertyIds = await Survey.distinct('property', { surveyor: uid });
    const assigned = [...new Map([...assignedPropertyIds(user), ...surveyPropertyIds].filter(Boolean).map((id) => [String(id), id])).values()];
    const propertyScope = { $in: assigned };
    const scopes = {
      properties: { _id: propertyScope }, 'property-spaces': { property: propertyScope }, 'property-media': { property: propertyScope }, surveys: { surveyor: uid }, attendance: { user: uid }, documents: { owner: uid }, notifications: { user: uid }, 'notification-preferences': { user: uid },
      messages: { $or: [{ sender: uid }, { recipients: uid }] }, approvals: { requester: uid }, 'site-visits': { $or: [{ surveyor: uid }, { assignedTo: uid }] }, 'field-data': { surveyor: uid }, 'survey-reports': { surveyor: uid },
      'surveyor-subscriptions': { user: uid }, 'surveyor-verifications': { user: uid }, 'surveyor-profiles': { user: uid }, 'survey-services': { surveyor: uid }, 'survey-jobs': { $or: [{ hiredSurveyor: uid }, { invitedSurveyors: uid }, { shortlistedSurveyors: uid }] },
      'survey-quotations': { surveyor: uid }, 'survey-projects': { surveyor: uid }, 'survey-equipment': { surveyor: uid }, 'survey-team': { owner: uid }, 'survey-clients': { surveyor: uid }, 'survey-reviews': { surveyor: uid }, 'survey-disputes': { $or: [{ raisedBy: uid }, { against: uid }] }, 'survey-promotions': { surveyor: uid },
      payments: { $or: [{ payer: uid }, { payee: uid }] },
    };
    return scopes[resource] || { _id: null };
  }

  // Tenant accounts retain their tenant scope while subscribed landlord and
  // surveyor capabilities add their own ownership/assignment scope. This is
  // what lets one tenant sidebar expose both paid workspaces safely.
  if (user.role === 'tenant' && !user.__baseTenantScope && !user.__capabilityScope && (user.landlordEnabled || user.surveyorEnabled)) {
    const account = plainUser(user);
    const tenantScope = await buildScope({ ...account, activeMode: 'regular', __baseTenantScope: true }, resource);
    const capabilityScopes = [];
    if (user.landlordEnabled) capabilityScopes.push(await buildScope({ ...account, activeMode: 'landlord', __capabilityScope: true }, resource));
    if (user.surveyorEnabled) capabilityScopes.push(await buildScope({ ...account, activeMode: 'surveyor', __capabilityScope: true }, resource));
    const scopes = [tenantScope, ...capabilityScopes]
      .map((scope) => normalizeQueryFilter(scope))
      .filter((scope) => Object.keys(scope).length);
    if (scopes.length <= 1) return scopes[0] || { _id: null };
    const clauses = scopes.flatMap((scope) => scope.$or && Object.keys(scope).length === 1 ? scope.$or : [scope]);
    return clauses.length ? { $or: clauses } : { _id: null };
  }

  if (user.role === 'tenant') {
    const tenantPropertyIds = await Tenancy.distinct('property', { tenant: uid, status: { $in: ['reserved', 'deposit_pending', 'agreement_pending', 'active', 'notice', 'move_out'] } });
    const scopes = {
      properties: { owner: uid, deletedAt: null }, subscriptions: { user: uid }, tenants: { user: uid }, leases: { tenant: uid }, payments: { $or: [{ payer: uid }, { payee: uid }] }, complaints: { raisedBy: uid },
      documents: { owner: uid }, notifications: { user: uid }, 'notification-preferences': { user: uid }, messages: { $or: [{ sender: uid }, { recipients: uid }] },
      approvals: { requester: uid }, applications: { $or: [{ applicant: uid }, { landlord: uid }] },
      'surveyor-subscriptions': { user: uid }, 'surveyor-verifications': { user: uid }, 'surveyor-profiles': { user: uid },
      'survey-services': { surveyor: uid },
      'survey-jobs': { $or: [{ client: uid }, { hiredSurveyor: uid }, { invitedSurveyors: uid }, { shortlistedSurveyors: uid }] },
      'survey-quotations': { $or: [{ surveyor: uid }, { client: uid }] },
      'survey-projects': { $or: [{ surveyor: uid }, { client: uid }] },
      'site-visits': { $or: [{ surveyor: uid }, { client: uid }] },
      'field-data': { surveyor: uid }, 'survey-equipment': { surveyor: uid },
      'survey-reports': { $or: [{ surveyor: uid }, { client: uid }] },
      'survey-team': { owner: uid }, 'survey-clients': { surveyor: uid },
      'survey-reviews': { $or: [{ surveyor: uid }, { client: uid }] },
      'survey-disputes': { $or: [{ raisedBy: uid }, { against: uid }] }, 'survey-promotions': { surveyor: uid },
      'property-spaces': { owner: uid }, 'property-media': { owner: uid },
      'tenant-profiles': { user: uid }, 'tenant-kyc': { user: uid }, 'occupants': { tenant: uid },
      'tenant-interviews': { $or: [{ landlord: uid }, { tenant: uid }] },
      'property-visits': { $or: [{ landlord: uid }, { requester: uid }] },
      tenancies: { $or: [{ landlord: uid }, { tenant: uid }] },
      'rental-invoices': { $or: [{ landlord: uid }, { tenant: uid }] },
      'utility-readings': { $or: [{ landlord: uid }, { tenant: uid }] },
      'reminder-rules': { owner: uid }, 'property-promotions': { owner: uid },
      facilities: { $or: [{ owner: uid }, { property: { $in: tenantPropertyIds }, visibility: { $in: ['tenant', 'public'] }, status: 'active' }, { visibility: 'public', status: 'active' }] },
      'facility-bookings': { $or: [{ requester: uid }, { owner: uid }] },
    };
    return scopes[resource] || { _id: null };
  }

  if (user.role === 'user') {
    const scopes = {
      applications: { applicant: uid }, payments: { $or: [{ payer: uid }, { payee: uid }] }, complaints: { raisedBy: uid }, documents: { owner: uid },
      notifications: { user: uid }, 'notification-preferences': { user: uid }, messages: { $or: [{ sender: uid }, { recipients: uid }] }, approvals: { requester: uid },
    };
    return scopes[resource] || { _id: null };
  }

  if (user.role === 'surveyor') {
    const scopes = {
      surveys: { surveyor: uid }, attendance: { user: uid }, documents: { owner: uid }, notifications: { user: uid }, 'notification-preferences': { user: uid },
      messages: { $or: [{ sender: uid }, { recipients: uid }] }, approvals: { requester: uid },
    };
    return scopes[resource] || { _id: null };
  }

  return { _id: null };
}
