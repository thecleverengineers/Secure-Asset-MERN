import crypto from 'node:crypto';
import { Tenant } from '../models/index.js';

export function hashTenantInvitationToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export function findPendingTenantInvitation(token) {
  const value = String(token || '');
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(value)) return null;
  return Tenant.findOne({
    invitationTokenHash: hashTenantInvitationToken(value),
    invitationStatus: 'pending',
    invitationExpiresAt: { $gt: new Date() },
  })
    .select('_id name email phone invitationStatus invitationExpiresAt')
    .exec();
}

const idOf = (value) => String(value?._id || value || '');

// Keep every tenancy, including two units rented by the same person. A contact
// is linked by verified account and property, never by an unverified email.
export function mergeLandlordTenantRows(contacts, tenancies, landlordId, now = new Date()) {
  const matched = new Set();
  const rows = contacts.map((contact) => {
    const related = contact.user ? tenancies.filter((tenancy) => idOf(tenancy.tenant) === idOf(contact.user)
      && (!contact.property || idOf(tenancy.property) === idOf(contact.property))) : [];
    related.forEach((tenancy) => matched.add(idOf(tenancy)));
    const { invitationTokenHash: _token, privateNotes, ...safe } = contact;
    return {
      ...safe,
      ...(idOf(contact.createdBy) === idOf(landlordId) ? { privateNotes } : {}),
      invitationStatus: contact.invitationStatus === 'pending' && new Date(contact.invitationExpiresAt) <= now ? 'expired' : contact.invitationStatus,
      isTenancyHolder: related.length > 0,
      tenancyId: idOf(related[0]),
      tenancies: related.map((tenancy) => ({ _id: tenancy._id, status: tenancy.status, property: tenancy.property, unitName: tenancy.rentalUnit?.name || tenancy.rentalUnit?.unitNumber || tenancy.space?.name || '' })),
    };
  });
  for (const tenancy of tenancies) {
    if (matched.has(idOf(tenancy))) continue;
    rows.push({
      _id: 'tenancy-' + idOf(tenancy), user: tenancy.tenant,
      property: tenancy.property, unitName: tenancy.rentalUnit?.name || tenancy.rentalUnit?.unitNumber || tenancy.space?.name || '',
      status: tenancy.status, invitationStatus: 'registered', isTenancyHolder: true,
      tenancyId: idOf(tenancy), createdAt: tenancy.createdAt,
    });
  }
  return rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}
