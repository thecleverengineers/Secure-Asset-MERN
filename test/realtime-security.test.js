import test from 'node:test';
import assert from 'node:assert/strict';
import { emitRealtime, setRealtimeServer } from '../server/src/services/realtime.js';

test('shared realtime resource rooms receive invalidation metadata, not sensitive records', () => {
  const emitted = [];
  const fakeIo = { to(room) { return { emit(event, payload) { emitted.push({ room, event, payload }); } }; }, emit(event, payload) { emitted.push({ room: '*', event, payload }); } };
  setRealtimeServer(fakeIo);
  emitRealtime('tenant-kyc', 'update', { _id: 'record-1', governmentId: 'SECRET' }, { users: ['user-1'] });
  const shared = emitted.find((row) => row.room === 'resource:tenant-kyc' && row.event === 'resource:changed');
  assert.ok(shared);
  assert.equal('data' in shared.payload, false);
  const user = emitted.find((row) => row.room === 'user:user-1' && row.event === 'resource:changed');
  assert.ok(user);
  assert.equal('data' in user.payload, false);
  const admin = emitted.find((row) => row.room === 'role:admin' && row.event === 'resource:changed' && row.payload.data);
  assert.equal(admin.payload.data.governmentId, 'SECRET');
  setRealtimeServer(null);
});
