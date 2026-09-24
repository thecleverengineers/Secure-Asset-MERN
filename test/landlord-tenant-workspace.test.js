import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { hashTenantInvitationToken, findPendingTenantInvitation, mergeLandlordTenantRows } from '../server/src/services/tenantInvitations.js';
import { acceptTenantInvitation, cancelTenantInvitation, createTenantInvitation, listLandlordTenants } from '../server/src/controllers/tenantInvitationController.js';
import { Tenant, Property, Tenancy, AuditLog } from '../server/src/models/index.js';
import { safeUser } from '../server/src/services/safeUser.js';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const token = 'A'.repeat(43);
const uid = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const landlordId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const contactId = 'cccccccccccccccccccccccc';
const phone = '9876543210';
const email = 'tenant@example.test';
const tenantUser = { _id: uid, role: 'tenant', status: 'active', mobileVerifiedAt: new Date(), email, phone };
const landlordUser = { _id: landlordId, role: 'landlord', landlordEnabled: true };
const pending = { _id: contactId, email, phone, invitationStatus: 'pending' };
const query = (value) => ({ select() { return this; }, populate() { return this; }, lean: async () => value, exec: async () => value });
async function invoke(controller, { user = tenantUser, body = { token }, params = {}, query: queryParams = {} } = {}) {
  let error;
  let status = 200;
  let result;
  const headers = {};
  await controller({ user, body, params, query: queryParams, headers: {}, ip: '127.0.0.1' }, {
    set(key, value) { headers[key] = value; return this; },
    status(value) { status = value; return this; },
    json(value) { result = value; return this; },
  }, (value) => { error = value; });
  return { error, status, result, headers };
}

test('invitation lookup rejects malformed tokens without querying the database', async (t) => {
  const find = t.mock.method(Tenant, 'findOne', () => { throw new Error('must not query'); });
  for (const value of ['', 'short', 'x'.repeat(1000), { $ne: null }, '../token']) assert.equal(await findPendingTenantInvitation(value), null);
  assert.equal(find.mock.callCount(), 0);
});

test('invitation lookup scopes by token hash, pending state and future expiry', async (t) => {
  let filter;
  t.mock.method(Tenant, 'findOne', (value) => { filter = value; return query(pending); });
  assert.deepEqual(await findPendingTenantInvitation(token), pending);
  assert.equal(filter.invitationTokenHash, hashTenantInvitationToken(token));
  assert.notEqual(filter.invitationTokenHash, token);
  assert.equal(filter.invitationStatus, 'pending');
  assert.ok(filter.invitationExpiresAt.$gt instanceof Date);
});

test('unverified and non-tenant accounts cannot claim invitations', async (t) => {
  const find = t.mock.method(Tenant, 'findOne', () => { throw new Error('must not query'); });
  for (const user of [{ ...tenantUser, mobileVerifiedAt: null }, { ...tenantUser, status: 'pending_verification' }, { ...tenantUser, role: 'admin' }]) {
    assert.equal((await invoke(acceptTenantInvitation, { user })).error.statusCode, 403);
  }
  assert.equal(find.mock.callCount(), 0);
});

test('invitation claims bind both invited identifiers and consume the exact token once', async (t) => {
  t.mock.method(Tenant, 'findOne', () => query(pending));
  let claim;
  let used = false;
  t.mock.method(Tenant, 'findOneAndUpdate', async (filter, update) => {
    claim = { filter, update };
    if (used) return null;
    used = true;
    return { _id: contactId };
  });
  t.mock.method(AuditLog, 'create', async () => ({}));
  for (const user of [{ ...tenantUser, email: 'other@example.test' }, { ...tenantUser, phone: '9123456780' }]) {
    assert.equal((await invoke(acceptTenantInvitation, { user })).error.statusCode, 403);
  }
  const accepted = await invoke(acceptTenantInvitation);
  assert.equal(accepted.error, undefined);
  assert.equal(accepted.result.data.tenantId, contactId);
  assert.equal(claim.filter.invitationTokenHash, hashTenantInvitationToken(token));
  assert.equal(claim.filter.email, email);
  assert.equal(claim.filter.phone, phone);
  assert.equal(claim.update.$set.user, uid);
  assert.deepEqual(claim.update.$unset, { invitationTokenHash: 1, invitationExpiresAt: 1 });
  assert.equal((await invoke(acceptTenantInvitation)).error.statusCode, 409);
});

test('invites can be created without property or room and never create tenant accounts', async (t) => {
  t.mock.method(Tenant, 'findOne', () => query(null));
  let created;
  t.mock.method(Tenant, 'create', async (value) => { created = { ...value, _id: contactId, save: async () => {} }; return created; });
  t.mock.method(Property, 'findOne', () => { throw new Error('no property lookup expected'); });
  t.mock.method(AuditLog, 'create', async () => ({}));
  const response = await invoke(createTenantInvitation, { user: landlordUser, body: { name: 'Test Tenant', email, phone, property: '' } });
  assert.equal(response.error, undefined);
  assert.equal(response.status, 201);
  assert.equal(created.user, undefined);
  assert.equal(created.createdBy, landlordId);
  const link = new URL(response.result.data.inviteUrl);
  const raw = new URLSearchParams(link.hash.slice(1)).get('tenantInvite');
  assert.equal(created.invitationTokenHash, hashTenantInvitationToken(raw));
  assert.equal(link.searchParams.has('tenantInvite'), false);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('foreign properties cannot be used to invite a tenant', async (t) => {
  let filter;
  t.mock.method(Property, 'findOne', (value) => { filter = value; return query(null); });
  const response = await invoke(createTenantInvitation, { user: landlordUser, body: { name: 'Test Tenant', email, phone, property: uid } });
  assert.equal(response.error.statusCode, 403);
  assert.equal(filter.owner, landlordId);
});

test('cancelling an invite is creator-scoped, unregistered-only and revokes the bearer token', async (t) => {
  let filter, update;
  t.mock.method(Tenant, 'findOneAndUpdate', async (where, changes) => { filter = where; update = changes; return { _id: contactId }; });
  t.mock.method(AuditLog, 'create', async () => ({}));
  assert.equal((await invoke(cancelTenantInvitation, { user: landlordUser, params: { id: contactId } })).error, undefined);
  assert.equal(filter.createdBy, landlordId);
  assert.equal(filter.user, null);
  assert.equal(update.$set.invitationStatus, 'revoked');
  assert.equal(update.$unset.invitationTokenHash, 1);
});

test('linked contacts remain tenancy holders and retain every matching tenancy', () => {
  const contacts = [{ _id: contactId, user: { _id: uid }, createdBy: landlordId, property: 'p1', privateNotes: 'Owner only', invitationTokenHash: 'hidden' }];
  const tenancies = [{ _id: 't1', tenant: { _id: uid }, property: 'p1' }, { _id: 't2', tenant: uid, property: 'p1' }, { _id: 't3', tenant: uid, property: 'p2' }];
  const rows = mergeLandlordTenantRows(contacts, tenancies, landlordId);
  assert.equal(rows.length, 2);
  const contact = rows.find((row) => row._id === contactId);
  assert.equal(contact.isTenancyHolder, true);
  assert.deepEqual(contact.tenancies.map((value) => value._id), ['t1', 't2']);
  assert.equal(contact.privateNotes, 'Owner only');
  assert.equal(contact.invitationTokenHash, undefined);
  assert.ok(rows.some((row) => row.tenancyId === 't3'));
});

test('unverified contact emails never suppress verified tenancy holders or leak another creator notes', () => {
  const rows = mergeLandlordTenantRows([{ _id: contactId, email, createdBy: 'other', privateNotes: 'private', invitationStatus: 'pending', invitationExpiresAt: '2020-01-01' }], [{ _id: 't1', tenant: { _id: uid, email } }], landlordId);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row._id === contactId).privateNotes, undefined);
  assert.equal(rows.find((row) => row._id === contactId).invitationStatus, 'expired');
});

test('landlord workspace has owner-scoped queries and searchable pagination beyond 100 contacts', async (t) => {
  const contacts = Array.from({ length: 105 }, (_, index) => ({ _id: String(index), name: 'Tenant ' + index, createdBy: landlordId }));
  let tenantScope, tenancyScope;
  t.mock.method(Property, 'distinct', async () => ['property1']);
  t.mock.method(Tenant, 'find', (filter) => { tenantScope = filter; return query(contacts); });
  t.mock.method(Tenancy, 'find', (filter) => { tenancyScope = filter; return query([]); });
  let response = await invoke(listLandlordTenants, { user: landlordUser, query: { page: 6, limit: 20 } });
  assert.equal(response.error, undefined);
  assert.equal(response.result.data.length, 5);
  assert.equal(response.result.counts.added, 105);
  assert.equal(tenancyScope.landlord, landlordId);
  assert.deepEqual(tenantScope.$or, [{ createdBy: landlordId }, { property: { $in: ['property1'] } }]);
  response = await invoke(listLandlordTenants, { user: landlordUser, query: { search: 'Tenant 104' } });
  assert.equal(response.result.data.length, 1);
});

test('onboarding uses existing OTP and KYC with pending token hashes excluded from session profiles', () => {
  const auth = read('server/src/controllers/authController.js');
  const login = read('src/app/pages/LoginPage.tsx');
  assert.match(auth, /validateStoredOtp\(user, req\.body\.otp, 'registration'\)/);
  assert.match(auth, /invitationTokenHash: user.pendingTenantTokenHash/);
  assert.match(login, /auth\.verifyRegistration\(phone, otp\); navigate\(invitationToken \? '\/app\/tenant-kyc\?required=complete'/);
  assert.equal(safeUser({ pendingTenantId: contactId, pendingTenantTokenHash: 'hash' }).pendingTenantTokenHash, undefined);
  assert.equal(safeUser({ pendingTenantId: contactId }).pendingTenantId, undefined);
});
