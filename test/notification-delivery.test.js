import test from 'node:test';
import assert from 'node:assert/strict';
import { isInQuietHours } from '../server/src/services/notificationDelivery.js';

test('notification quiet hours handle an overnight timezone window', () => {
  const preference = { quietHours: { enabled: true, start: '22:00', end: '06:00', timezone: 'Asia/Kolkata' } };
  assert.equal(isInQuietHours(preference, new Date('2026-06-26T18:00:00.000Z')), true); // 23:30 IST
  assert.equal(isInQuietHours(preference, new Date('2026-06-26T07:00:00.000Z')), false); // 12:30 IST
});
