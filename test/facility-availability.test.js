import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFacilityBookingWindow, validateFacilityScheduleDefinition } from '../server/src/services/facilityAvailability.js';

const facility = {
  minimumNoticeHours: 1,
  maximumAdvanceDays: 90,
  slotMinutes: 60,
  availableDays: ['monday'],
  availableTimeSlots: [{ start: '09:00', end: '18:00' }],
};

const monday = new Date('2026-06-29T10:00:00.000Z');
const mondayEnd = new Date('2026-06-29T12:00:00.000Z');
const now = new Date('2026-06-28T08:00:00.000Z');

test('facility schedule definitions accept valid days and slots', () => {
  assert.doesNotThrow(() => validateFacilityScheduleDefinition(['monday', 'friday'], [{ start: '09:00', end: '18:00' }]));
});

test('facility schedule definitions reject malformed or reversed slots', () => {
  assert.throws(() => validateFacilityScheduleDefinition(['monday'], [{ start: '18:00', end: '09:00' }]), /valid HH:MM/);
  assert.throws(() => validateFacilityScheduleDefinition(['funday'], []), /Invalid facility availability day/);
});

test('facility booking accepts an available aligned slot', () => {
  const result = validateFacilityBookingWindow(facility, monday, mondayEnd, { now });
  assert.equal(result.dayName, 'monday');
  assert.equal(result.durationMinutes, 120);
});

test('facility booking rejects unavailable times and non-slot durations', () => {
  assert.throws(() => validateFacilityBookingWindow(facility, new Date('2026-06-29T08:00:00Z'), new Date('2026-06-29T09:00:00Z'), { now }), /outside the facility availability slots/);
  assert.throws(() => validateFacilityBookingWindow(facility, new Date('2026-06-29T10:00:00Z'), new Date('2026-06-29T11:30:00Z'), { now }), /60-minute slot increments/);
});

test('facility booking rejects overnight, insufficient-notice and over-advance requests', () => {
  assert.throws(() => validateFacilityBookingWindow(facility, new Date('2026-06-29T23:00:00Z'), new Date('2026-06-30T00:00:00Z'), { now }), /same day/);
  assert.throws(() => validateFacilityBookingWindow(facility, new Date('2026-06-28T08:30:00Z'), new Date('2026-06-28T09:30:00Z'), { now }), /at least 1 hours notice/);
  assert.throws(() => validateFacilityBookingWindow(facility, new Date('2026-10-05T10:00:00Z'), new Date('2026-10-05T11:00:00Z'), { now }), /up to 90 days/);
});
