import { ApiError } from '../utils/apiError.js';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function minutesFromClock(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 24 || minute < 0 || minute > 59 || (hour === 24 && minute !== 0)) return null;
  return hour * 60 + minute;
}

export function validateFacilityScheduleDefinition(availableDays = [], availableTimeSlots = []) {
  const invalidDay = availableDays.find((day) => !DAYS.includes(String(day).toLowerCase()));
  if (invalidDay) throw new ApiError(422, `Invalid facility availability day: ${invalidDay}`);
  for (const slot of availableTimeSlots) {
    const start = minutesFromClock(slot?.start);
    const end = minutesFromClock(slot?.end);
    if (start === null || end === null || end <= start) throw new ApiError(422, 'Facility time slots must use valid HH:MM start and end values');
  }
}

export function validateFacilityBookingWindow(facility, startAt, endAt, { now = new Date(), isExisting = false } = {}) {
  if (!(startAt instanceof Date) || !(endAt instanceof Date) || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    throw new ApiError(422, 'Enter a valid booking start and end time');
  }
  if (startAt.toISOString().slice(0, 10) !== endAt.toISOString().slice(0, 10)) throw new ApiError(422, 'Facility bookings must start and end on the same day');

  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!isExisting && startAt.getTime() < nowMs + Number(facility.minimumNoticeHours || 0) * 3600000) {
    throw new ApiError(422, `Bookings require at least ${facility.minimumNoticeHours || 0} hours notice`);
  }
  if (startAt.getTime() > nowMs + Number(facility.maximumAdvanceDays || 90) * 86400000) {
    throw new ApiError(422, `Bookings can be made up to ${facility.maximumAdvanceDays || 90} days in advance`);
  }

  const dayName = DAYS[startAt.getUTCDay()];
  if (facility.availableDays?.length && !facility.availableDays.includes(dayName)) throw new ApiError(422, `Facility is not available on ${dayName}`);

  if (facility.availableTimeSlots?.length) {
    const startMinutes = startAt.getUTCHours() * 60 + startAt.getUTCMinutes();
    const endMinutes = endAt.getUTCHours() * 60 + endAt.getUTCMinutes();
    const withinSlot = facility.availableTimeSlots.some((slot) => {
      const slotStart = minutesFromClock(slot.start);
      const slotEnd = minutesFromClock(slot.end);
      return slotStart !== null && slotEnd !== null && startMinutes >= slotStart && endMinutes <= slotEnd;
    });
    if (!withinSlot) throw new ApiError(422, 'The booking time is outside the facility availability slots');
  }

  const slotMinutes = Number(facility.slotMinutes || 0);
  const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000);
  if (slotMinutes > 0 && (durationMinutes < slotMinutes || durationMinutes % slotMinutes !== 0)) {
    throw new ApiError(422, `Booking duration must be in ${slotMinutes}-minute slot increments`);
  }
  return { dayName, durationMinutes };
}
