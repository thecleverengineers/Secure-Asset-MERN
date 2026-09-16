import { Property, User } from '../models/index.js';
import { notifyOnce } from './notifications.js';
import { normalizeFast2SmsWhatsAppVariables } from './fast2sms.js';

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function dateOnly(value, fallback = 'the agreed date') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('en-IN');
}

function timeOnly(value, fallback = 'the scheduled time') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function dateTime(value, fallback = 'the due date') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString('en-IN');
}

function propertyAddress(property, fallback = 'your property') {
  if (!property) return fallback;
  const address = property.address || {};
  return [property.title, address.line1, address.locality, address.city, address.state]
    .map((value) => String(value || '').trim()).filter(Boolean).join(', ') || fallback;
}

async function resolveUser(value) {
  if (!value) return null;
  if (typeof value === 'object' && value.name !== undefined) return value;
  try {
    return await User.findById(value).select('name phone status kycStatus').lean();
  } catch {
    // Payment and resource lifecycle operations may be exercised with
    // non-Mongo fixture identifiers. A notification lookup must never make
    // the underlying business transaction fail.
    return null;
  }
}

async function resolveProperty(value) {
  if (!value) return null;
  if (typeof value === 'object' && (value.title !== undefined || value.address !== undefined)) return value;
  try {
    return await Property.findById(value).select('title address').lean();
  } catch {
    return null;
  }
}

async function sendTemplate({ user, key, templateKey, variables, title, message, category = 'system', actionUrl }) {
  try {
    const recipient = await resolveUser(user);
    if (!recipient?._id || recipient.status === 'suspended' || recipient.status === 'locked') return null;
    const normalizedVariables = normalizeFast2SmsWhatsAppVariables(templateKey, variables);
    return await notifyOnce({
      user: recipient._id,
      key,
      title,
      message,
      category,
      actionUrl,
      metadata: {
        event: key,
        whatsappTemplate: templateKey,
        whatsappVariables: normalizedVariables,
      },
    });
  } catch (error) {
    // Notification delivery must never roll back a successful property,
    // payment, lease, survey, or registration transaction.
    console.error(`WhatsApp notification ${templateKey} was not queued:`, error?.message || error);
    return null;
  }
}

export async function notifyKycRequired(user) {
  const recipient = await resolveUser(user);
  if (!recipient || ['verified', 'under_review'].includes(recipient.kycStatus)) return null;
  return sendTemplate({
    user: recipient,
    key: `secure-asset-kyc-${recipient._id}`,
    templateKey: 'secure_asset_kyc',
    variables: [recipient.name || 'Secure Asset user'],
    title: 'Complete your Secure Asset KYC',
    message: 'Complete your mandatory KYC verification to keep your account secure.',
    actionUrl: '/app/tenant-kyc',
  });
}

export async function notifyPropertyListed(property, owner) {
  if (!property || property.visibility !== 'public' || property.publicationStatus !== 'published') return null;
  const recipient = await resolveUser(property.owner || owner);
  const storedProperty = await resolveProperty(property);
  return sendTemplate({
    user: recipient,
    key: `property-listed-${property._id}`,
    templateKey: 'property_listed_successfully',
    variables: [recipient?.name || 'Property owner', propertyAddress(storedProperty)],
    title: 'Property listed successfully',
    message: `${propertyAddress(storedProperty)} is now live on Secure Asset.`,
    category: 'system',
    actionUrl: '/app/properties',
  });
}

export async function notifyLeaseAgreementReady(lease) {
  if (!lease || !['pending_approval', 'active'].includes(String(lease.status || ''))) return null;
  const recipient = await resolveUser(lease.tenant);
  const property = await resolveProperty(lease.property);
  const signBy = dateOnly(lease.startDate || lease.endDate);
  return sendTemplate({
    user: recipient,
    key: `lease-agreement-ready-${lease._id}`,
    templateKey: 'lease_agreement_ready',
    variables: [recipient?.name || 'Tenant', propertyAddress(property), signBy],
    title: 'Lease agreement ready',
    message: `The lease agreement for ${propertyAddress(property)} is ready for your review and signature.`,
    category: 'lease',
    actionUrl: '/app/leases',
  });
}

export async function notifySurveyAssigned(survey) {
  if (!survey?.surveyor) return null;
  const recipient = await resolveUser(survey.surveyor);
  const property = await resolveProperty(survey.property);
  const scheduledAt = survey.deadline || survey.scheduledAt;
  return sendTemplate({
    user: recipient,
    key: `survey-assigned-${survey._id}-${String(survey.surveyor?._id || survey.surveyor)}`,
    templateKey: 'new_survey_assigned',
    variables: [recipient?.name || 'Surveyor', propertyAddress(property), dateOnly(scheduledAt, 'as assigned'), timeOnly(scheduledAt, 'as assigned')],
    title: 'New survey assigned',
    message: `A new property inspection has been assigned at ${propertyAddress(property)}.`,
    category: 'survey',
    actionUrl: '/app/surveys',
  });
}

export async function notifyRentReminder(invoice) {
  if (!invoice?.tenant) return null;
  const recipient = await resolveUser(invoice.tenant);
  const property = await resolveProperty(invoice.property);
  return sendTemplate({
    user: recipient,
    key: `rental-invoice-issued-${invoice._id}`,
    templateKey: 'rent_reminder',
    variables: [recipient?.name || 'Tenant', money(invoice.balanceAmount || invoice.totalAmount), propertyAddress(property, 'your rented property'), dateTime(invoice.dueDate)],
    title: 'Rent payment reminder',
    message: `${invoice.invoiceNumber || 'Your rent invoice'} for ${money(invoice.balanceAmount || invoice.totalAmount)} is due on ${dateTime(invoice.dueDate)}.`,
    category: 'payment',
    actionUrl: '/app/payments?type=rent',
  });
}

export async function notifyRentReceipt(invoice, payment) {
  if (!invoice?.tenant) return null;
  const recipient = await resolveUser(invoice.tenant);
  const property = await resolveProperty(invoice.property);
  return sendTemplate({
    user: recipient,
    key: `rent-receipt-${payment?._id || invoice._id}`,
    templateKey: 'confirming_successful_receipt_of_rent',
    variables: [recipient?.name || 'Tenant', money(payment?.paidAmount || payment?.amount), propertyAddress(property, 'your rented property')],
    title: 'Rent receipt confirmed',
    message: `Your rent payment of ${money(payment?.paidAmount || payment?.amount)} has been received successfully.`,
    category: 'payment',
    actionUrl: '/app/payments?status=paid',
  });
}

export async function notifyPaymentCompleted(payment, recipient = payment?.payer) {
  const user = await resolveUser(recipient);
  if (!user) return null;
  return sendTemplate({
    user,
    key: `payment-completed-${payment?._id}-${user._id}`,
    templateKey: 'payment_completed',
    variables: [money(payment?.paidAmount || payment?.amount)],
    title: 'Payment completed',
    message: `Your payment of ${money(payment?.paidAmount || payment?.amount)} was completed successfully.`,
    category: 'payment',
    actionUrl: '/app/payments?status=paid',
  });
}
