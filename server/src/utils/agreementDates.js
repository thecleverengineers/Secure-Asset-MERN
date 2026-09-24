export function parseAgreementDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function addCalendarMonthsClamped(value, months) {
  const source = value instanceof Date ? value : new Date(value);
  const term = Number(months);
  if (Number.isNaN(source.getTime())) throw new RangeError('Agreement start date is invalid.');
  if (!Number.isInteger(term) || term < 1) throw new RangeError('Agreement duration must be a positive whole number of months.');
  const targetMonthIndex = source.getUTCMonth() + term;
  const targetYear = source.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const sourceDay = source.getUTCDate();
  const finalDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(sourceDay, finalDay)));
}

export function formatAgreementDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}
