import assert from 'node:assert/strict';
import test from 'node:test';
import { Property, PropertyMedia, RentalUnit, Tenancy } from '../server/src/models/index.js';
import { getPropertyTenancyHistory, listTenancyHistoryProperties } from '../server/src/controllers/propertyTenancyHistoryController.js';
import { historyCounts, propertyHistoryRent, tenancyHistoryEvents, tenancyHistoryGroup, tenancyHistoryRow } from '../server/src/services/propertyTenancyHistory.js';
import { defaultPermissionEntriesForRole } from '../server/src/services/rbac.js';

const landlordId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const propertyId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const landlord = { _id: landlordId, role: 'tenant', landlordEnabled: true };
const now = new Date('2026-09-24T12:00:00Z');
function query(value) {
  return { select() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, populate() { return this; }, lean: async () => value };
}
async function invoke(controller, { user = landlord, params = { propertyId }, query: filters = {} } = {}) {
  let error, result;
  const headers = {};
  await controller({ user, params, query: filters }, {
    set(key, value) { headers[key] = value; return this; },
    json(value) { result = value; return this; },
  }, (value) => { error = value; });
  return { error, result, headers };
}

test('history separates pending and cancelled bookings from current and past tenancies', () => {
  const records = [
    { status: 'active', startDate: '2026-01-01', endDate: '2026-09-01' },
    { status: 'notice_period', startDate: '2026-01-01' },
    { status: 'move_out_inspection' }, { status: 'closed' },
    { status: 'reserved', startDate: '2026-01-01' },
    { status: 'active', startDate: '2026-10-01' },
    { status: 'cancelled', startDate: '2026-01-01' }, { status: 'unknown_legacy' },
  ];
  assert.deepEqual(historyCounts(records, now), { all: 8, current: 2, past: 2, upcoming: 2, cancelled: 1, other: 1 });
  assert.equal(tenancyHistoryGroup({ status: 'active', closedAt: '2026-09-01' }, now), 'past');
});

test('monthly rent totals count only current rooms and preserve missing amounts', () => {
  const records = [
    { status: 'active', monthlyRent: 12000 }, { status: 'notice', monthlyRent: 8000 },
    { status: 'closed', monthlyRent: 5000 }, { status: 'reserved', monthlyRent: 3000 },
  ];
  assert.deepEqual(propertyHistoryRent({}, records, [], now), { amount: 20000, kind: 'current', label: 'Current monthly rent' });
  assert.equal(propertyHistoryRent({}, [...records, { status: 'active' }], [], now).amount, null);
  assert.equal(propertyHistoryRent({}, [{ status: 'active', monthlyRent: 0 }], [], now).amount, 0);
});

test('vacant properties show listed monthly or room rents without reusing sale and lease prices', () => {
  assert.equal(propertyHistoryRent({ purpose: 'rent', pricing: { monthlyRent: 18000 } }).amount, 18000);
  for (const purpose of ['sale', 'lease']) {
    assert.equal(propertyHistoryRent({ purpose, pricing: { monthlyRent: 12000, salePrice: 5000000, leaseAmount: 200000 } }).amount, null);
  }
  const units = [{ pricing: { monthlyRent: 7000 } }, { pricing: { monthlyRent: 9000 } }, { pricing: { monthlyRent: 50000 }, archivedAt: new Date() }];
  assert.deepEqual(propertyHistoryRent({}, [], units), { amount: 7000, maximum: 9000, kind: 'unit', label: 'Listed monthly rent per room' });
});

test('history dates use recorded events without inventing activation or closure times', () => {
  const record = {
    _id: 't1', status: 'closed', tenant: { name: 'Example Tenant' }, startDate: '2026-01-01', endDate: '2026-09-01',
    createdAt: '2025-12-20T10:11:12Z',
    statusHistory: [{ to: 'active', changedAt: '2026-01-01T08:15:30Z' }, { to: 'notice', changedAt: 'invalid' }],
    notices: [{ title: 'Move-out notice', servedAt: '2026-08-01T17:00:00Z' }],
    moveOutInspection: { completedAt: '2026-09-01T11:45:00Z' }, closedAt: '2026-09-02T15:30:45Z',
    privateNotes: 'not part of history',
  };
  const row = tenancyHistoryRow(record, now);
  assert.equal(row.activatedAt, '2026-01-01T08:15:30Z');
  assert.equal(row.closedAt, '2026-09-02T15:30:45Z');
  assert.equal(row.privateNotes, undefined);
  assert.deepEqual(tenancyHistoryEvents(record).map((event) => event.at), [record.closedAt, record.moveOutInspection.completedAt, record.notices[0].servedAt, record.statusHistory[0].changedAt, record.createdAt]);
  const legacy = tenancyHistoryRow({ status: 'active', startDate: record.startDate, createdAt: record.createdAt });
  assert.equal(legacy.activatedAt, null);
  assert.equal(legacy.closedAt, null);
});

test('history denies regular or expired accounts before any property lookup', async (t) => {
  const lookup = t.mock.method(Property, 'findOne', () => { throw new Error('must not query'); });
  const list = t.mock.method(Property, 'countDocuments', () => { throw new Error('must not query'); });
  for (const user of [{ role: 'tenant' }, { ...landlord, landlordSubscriptionExpiresAt: '2020-01-01' }, { role: 'surveyor' }]) {
    assert.equal((await invoke(getPropertyTenancyHistory, { user })).error.statusCode, 403);
    assert.equal((await invoke(listTenancyHistoryProperties, { user })).error.statusCode, 403);
  }
  assert.equal(lookup.mock.callCount(), 0);
  assert.equal(list.mock.callCount(), 0);
});

test('foreign and malformed property IDs never expose tenancy records', async (t) => {
  let scope;
  t.mock.method(Property, 'findOne', (filter) => { scope = filter; return query(null); });
  const lookup = t.mock.method(Tenancy, 'find', () => { throw new Error('must not query'); });
  assert.equal((await invoke(getPropertyTenancyHistory)).error.statusCode, 404);
  assert.deepEqual(scope, { _id: propertyId, owner: landlordId, listingType: 'rent' });
  assert.equal((await invoke(getPropertyTenancyHistory, { params: { propertyId: 'bad-id' } })).error.statusCode, 404);
  assert.equal(lookup.mock.callCount(), 0);
});

test('property history list scopes searches and totals to owned rent properties, including empty and archived listings', async (t) => {
  const property = { _id: propertyId, title: 'Example Home', listingType: 'rent', deletedAt: new Date(), pricing: { monthlyRent: 15000 } };
  let propertyScope, tenancyScope, roomScope, imageScope;
  t.mock.method(Property, 'countDocuments', async (filter) => { propertyScope = filter; return 13; });
  t.mock.method(Property, 'find', (filter) => { assert.deepEqual(filter, propertyScope); return query([property]); });
  t.mock.method(Tenancy, 'find', (filter) => { tenancyScope = filter; return query([]); });
  t.mock.method(RentalUnit, 'find', (filter) => { roomScope = filter; return query([]); });
  t.mock.method(PropertyMedia, 'find', (filter) => { imageScope = filter; return query([{ _id: 'image1', property: propertyId, cover: true, url: '/example.jpg' }]); });
  const response = await invoke(listTenancyHistoryProperties, { query: { page: 999, search: '[Home]' } });
  assert.equal(response.error, undefined);
  assert.equal(propertyScope.owner, landlordId);
  assert.equal(propertyScope.listingType, 'rent');
  assert.equal(propertyScope.deletedAt, undefined);
  assert.equal(propertyScope.$or[0].title.test('[Home]'), true);
  assert.equal(propertyScope.$or[0].title.test('H'), false);
  assert.deepEqual(tenancyScope, { landlord: landlordId, property: { $in: [propertyId] } });
  assert.deepEqual(roomScope.property, tenancyScope.property);
  assert.equal(roomScope.landlord, landlordId);
  assert.deepEqual(imageScope.property, tenancyScope.property);
  assert.equal(response.result.data[0].counts.all, 0);
  assert.equal(response.result.data[0].rent.amount, 15000);
  assert.equal(response.result.data[0].propertyMedia[0].url, '/example.jpg');
  assert.deepEqual(response.result.pagination, { total: 13, page: 2, pages: 2, limit: 12 });
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
});

test('property detail filters and paginates records while keeping overall totals', async (t) => {
  const records = Array.from({ length: 23 }, (_, index) => ({ _id: 't' + index, tenant: { name: 'Example Tenant ' + index }, status: 'closed', monthlyRent: 1000 }));
  records.push({ _id: 'current', tenant: { name: 'Current Tenant' }, status: 'active', monthlyRent: 2000 });
  let tenancyScope;
  t.mock.method(Property, 'findOne', () => query({ _id: propertyId, title: 'Home' }));
  t.mock.method(Tenancy, 'find', (filter) => { tenancyScope = filter; return query(records); });
  t.mock.method(RentalUnit, 'find', () => query([]));
  t.mock.method(PropertyMedia, 'find', () => query([]));
  let response = await invoke(getPropertyTenancyHistory, { query: { page: 2, limit: 20, filter: 'past' } });
  assert.equal(response.error, undefined);
  assert.deepEqual(tenancyScope, { landlord: landlordId, property: propertyId });
  assert.equal(response.result.data.records.length, 3);
  assert.equal(response.result.data.counts.all, 24);
  assert.equal(response.result.data.counts.current, 1);
  assert.equal(response.result.data.rent.amount, 2000);
  response = await invoke(getPropertyTenancyHistory, { query: { search: 'TENANT 22', filter: 'past' } });
  assert.equal(response.result.data.records[0]._id, 't22');
  assert.equal(response.result.data.records.length, 1);
  assert.equal(response.result.data.counts.all, 24);
});

test('new history module grants landlord read access without mutation rights', () => {
  const permissions = defaultPermissionEntriesForRole('landlord');
  const history = permissions.find((entry) => entry.key === 'module:tenancy-history');
  assert.ok(history);
  assert.deepEqual(history.actions, ['view']);
  assert.equal(history.scope, 'own');
  assert.equal(defaultPermissionEntriesForRole('tenant').some((entry) => entry.key === 'module:tenancy-history'), false);
});
