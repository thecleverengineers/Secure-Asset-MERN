const CURRENT_STATUSES = new Set(['active', 'notice', 'notice_period', 'vacating']);
const PAST_STATUSES = new Set(['move_out', 'move_out_inspection', 'final_calculation', 'landlord_review', 'final_payment', 'deposit_settlement', 'closed', 'completed']);
const PENDING_STATUSES = new Set(['reserved', 'application_pending', 'deposit_pending', 'agreement_pending', 'payment_pending']);
const timestamp = (value) => value ? new Date(value).getTime() : NaN;
const amount = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
export const historyId = (value) => String(value?._id || value || '');

export function tenancyHistoryGroup(record, now = new Date()) {
  if (record.status === 'cancelled') return 'cancelled';
  if (PAST_STATUSES.has(record.status) || Number.isFinite(timestamp(record.closedAt))) return 'past';
  if (PENDING_STATUSES.has(record.status)) return 'upcoming';
  if (CURRENT_STATUSES.has(record.status)) return timestamp(record.startDate) > now.getTime() ? 'upcoming' : 'current';
  return 'other';
}

export function historyCounts(records, now = new Date()) {
  const counts = { all: records.length, current: 0, past: 0, upcoming: 0, cancelled: 0, other: 0 };
  for (const record of records) counts[tenancyHistoryGroup(record, now)] += 1;
  return counts;
}

export function propertyHistoryRent(property, tenancies = [], units = [], now = new Date()) {
  const current = tenancies.filter((record) => tenancyHistoryGroup(record, now) === 'current');
  if (current.length) {
    const values = current.map((record) => amount(record.monthlyRent));
    // A missing contractual amount must not silently become zero rent.
    if (values.every((value) => value !== null)) return { amount: values.reduce((sum, value) => sum + value, 0), kind: 'current', label: 'Current monthly rent' };
    return { amount: null, kind: 'incomplete', label: 'Current rent not fully recorded' };
  }
  const purpose = String(property.purpose || property.listingType || 'rent');
  const propertyRent = amount(property.pricing?.monthlyRent);
  if (propertyRent !== null && purpose === 'rent' && propertyRent > 0) return { amount: propertyRent, kind: 'listed', label: 'Listed monthly rent' };
  const unitRents = units.filter((unit) => !unit.archivedAt && unit.publicationStatus !== 'archived').map((unit) => amount(unit.pricing?.monthlyRent)).filter((value) => value !== null && value > 0);
  if (unitRents.length) return { amount: Math.min(...unitRents), maximum: Math.max(...unitRents), kind: 'unit', label: 'Listed monthly rent per room' };
  return { amount: null, kind: 'unset', label: 'Monthly rent not set' };
}

export function tenancyHistoryEvents(record) {
  const events = [];
  const add = (at, title, detail = '') => { if (Number.isFinite(timestamp(at))) events.push({ at, title, detail }); };
  add(record.createdAt, 'Tenancy record created');
  for (const event of record.statusHistory || []) add(event.changedAt, 'Status changed: ' + String(event.to || 'updated').replaceAll('_', ' '), event.reason || '');
  for (const notice of record.notices || []) add(notice.servedAt, notice.title || 'Notice served', notice.message || '');
  add(record.moveInInspection?.completedAt, 'Move-in inspection completed');
  add(record.moveOutInspection?.completedAt, 'Move-out inspection completed');
  add(record.moveOutSettlement?.settledAt, 'Deposit settlement completed');
  add(record.closedAt, 'Tenancy closed');
  return events.sort((left, right) => timestamp(right.at) - timestamp(left.at));
}

export function tenancyHistoryRow(record, now = new Date()) {
  const activations = (record.statusHistory || []).filter((event) => event.to === 'active' && Number.isFinite(timestamp(event.changedAt))).sort((a, b) => timestamp(a.changedAt) - timestamp(b.changedAt));
  return {
    _id: record._id, tenancyNumber: record.tenancyNumber, tenant: record.tenant,
    status: record.status, group: tenancyHistoryGroup(record, now),
    unitName: record.rentalUnit?.name || record.space?.name || 'Property tenancy',
    roomNumber: record.rentalUnit?.roomNumber || record.space?.unitNumber || '',
    floorName: record.rentalUnit?.floor?.name || '',
    startDate: record.startDate || null, endDate: record.endDate || null,
    activatedAt: activations[0]?.changedAt || null, closedAt: record.closedAt || null,
    monthlyRent: amount(record.monthlyRent), createdAt: record.createdAt,
    events: tenancyHistoryEvents(record),
  };
}
