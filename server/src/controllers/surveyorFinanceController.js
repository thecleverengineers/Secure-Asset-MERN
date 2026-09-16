import { Payment, SurveyProject, AuditLog } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { assertSurveyorFeature, getActiveSurveyorSubscription } from '../services/surveyorSubscription.js';
import { env } from '../config/env.js';
import { applyPaidPayment } from '../services/paymentLifecycle.js';
import { createNotification } from '../services/notifications.js';

const same = (a, b) => String(a?._id || a || '') === String(b?._id || b || '');
const number = (prefix) => `${prefix}-${new Date().getUTCFullYear()}-${Date.now().toString().slice(-9)}`;
async function log(req, action, record, previousValue) {
  await AuditLog.create({ user: req.user._id, role: req.user.role, action, module: 'payments', recordId: record._id, ip: req.ip, device: req.get('user-agent'), previousValue, updatedValue: record.toObject() });
}

export const createSurveyInvoice = asyncHandler(async (req, res) => {
  await getActiveSurveyorSubscription(req.user._id);
  await assertSurveyorFeature(req.user._id, 'invoicing');
  const project = await SurveyProject.findById(req.params.projectId);
  if (!project) throw new ApiError(404, 'Survey project not found');
  if (!same(project.surveyor, req.user._id)) throw new ApiError(403, 'Only the assigned Surveyor can create this invoice');
  const type = String(req.body.type || 'survey_milestone');
  if (!['survey_advance', 'survey_milestone', 'survey_final'].includes(type)) throw new ApiError(422, 'Invalid survey invoice type');
  const base = Number(req.body.amount || 0); const tax = Number(req.body.taxAmount || 0); const travel = Number(req.body.travelAmount || 0); const discount = Number(req.body.discountAmount || 0);
  const total = Math.max(0, base + tax + travel - discount);
  if (!total) throw new ApiError(422, 'Invoice total must be greater than zero');
  const commissionRate = env.SURVEY_PLATFORM_COMMISSION_PERCENT;
  const invoice = await Payment.create({
    invoiceNumber: number('SUR-INV'), payer: project.client, payee: project.surveyor, surveyProject: project._id, surveyQuotation: project.quotation,
    type, amount: total, paidAmount: 0, status: 'pending', dueDate: req.body.dueDate || new Date(), method: 'gateway', notes: req.body.notes,
    taxAmount: tax, discountAmount: discount, travelAmount: travel, platformCommission: total * commissionRate / 100,
    createdBy: req.user._id, updatedBy: req.user._id,
  });
  await createNotification({ user: project.client, title: 'New survey invoice', message: `${invoice.invoiceNumber} for ₹${total.toLocaleString('en-IN')} is ready.`, category: 'payment', actionUrl: '/app/payments' });
  await log(req, 'survey-invoice:created', invoice);
  res.status(201).json({ success: true, data: invoice, message: 'Survey invoice created' });
});

export const paySurveyInvoice = asyncHandler(async (req, res) => {
  const invoice = await Payment.findById(req.params.id);
  if (!invoice || !['survey_advance', 'survey_milestone', 'survey_final'].includes(invoice.type)) throw new ApiError(404, 'Survey invoice not found');
  if (!same(invoice.payer, req.user._id)) throw new ApiError(403, 'Only the invoice client can submit this payment');
  if (invoice.status === 'paid') throw new ApiError(409, 'Invoice is already paid');
  const previous = invoice.toObject();
  invoice.status = 'pending';
  invoice.method = ['upi', 'bank_transfer', 'cash', 'cheque', 'offline'].includes(req.body.method) ? req.body.method : 'offline';
  invoice.transactionId = req.body.transactionId ? String(req.body.transactionId) : invoice.transactionId;
  invoice.proofUrl = req.body.proofUrl ? String(req.body.proofUrl) : invoice.proofUrl;
  invoice.gateway = { ...(invoice.gateway || {}), provider: 'manual', submittedAt: new Date() };
  invoice.updatedBy = req.user._id;
  await invoice.save();
  if (env.PAYMENT_AUTO_APPROVE) {
    invoice.status = 'paid'; invoice.paidAmount = invoice.amount; invoice.paidAt = new Date(); invoice.transactionId ||= `DEV-SUR-PAY-${Date.now()}`;
    await invoice.save();
    await applyPaidPayment(invoice, { userId: req.user._id, role: req.user.role, ip: req.ip, device: req.get('user-agent') });
  }
  await log(req, 'survey-invoice:payment-submitted', invoice, previous);
  res.json({ success: true, data: invoice, message: env.PAYMENT_AUTO_APPROVE ? 'Payment successful' : 'Payment submitted and awaiting verification' });
});

