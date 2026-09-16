import {
  Payment,
  SurveyJob,
  SurveyProject,
  SurveyQuotation,
} from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { assertSurveyorLimit } from './surveyorSubscription.js';
import { getActiveLandlordSubscription } from './landlordSubscription.js';
import { createNotification } from './notifications.js';

const sameId = (left, right) => String(left?._id || left || '') === String(right?._id || right || '');
const number = (prefix) => `${prefix}-${new Date().getUTCFullYear()}-${Date.now().toString().slice(-9)}`;

export async function acceptSurveyQuotation({ quotationId, actorId, isAdmin = false }) {
  const quotation = await SurveyQuotation.findById(quotationId).populate('job');
  if (!quotation) throw new ApiError(404, 'Quotation not found');
  if (!sameId(quotation.client, actorId) && !isAdmin) throw new ApiError(403, 'Only the landlord who posted this job can hire a Surveyor');
  if (!isAdmin) await getActiveLandlordSubscription(actorId);
  if (!['submitted', 'viewed', 'under_negotiation', 'revised'].includes(quotation.status)) throw new ApiError(409, 'This quotation cannot be accepted');
  if (!quotation.job || !['open', 'quotation_review'].includes(quotation.job.status)) throw new ApiError(409, 'This survey job is no longer available for hiring');

  // The bidder must still have an active Surveyor subscription at the moment
  // the landlord hires them. This prevents expired accounts from receiving a
  // new project while preserving the tenant account role on both sides.
  await assertSurveyorLimit(quotation.surveyor, 'jobs');
  const existingProject = await SurveyProject.findOne({ quotation: quotation._id });
  if (existingProject) throw new ApiError(409, 'This quotation has already created a survey project');

  const now = new Date();
  quotation.status = 'accepted';
  quotation.acceptedAt = now;
  quotation.updatedBy = actorId;
  await quotation.save();
  await SurveyQuotation.updateMany(
    { job: quotation.job._id, _id: { $ne: quotation._id }, status: { $in: ['submitted', 'viewed', 'under_negotiation', 'revised'] } },
    { status: 'rejected', rejectedAt: now },
  );
  await SurveyJob.findByIdAndUpdate(quotation.job._id, {
    status: 'awarded', workflowStage: 'hired', hiredSurveyor: quotation.surveyor, hiredAt: now, updatedBy: actorId,
  });

  const project = await SurveyProject.create({
    projectNumber: number('SP'),
    job: quotation.job._id,
    quotation: quotation._id,
    property: quotation.job.property,
    client: quotation.client,
    surveyor: quotation.surveyor,
    surveyCategory: quotation.job.surveyType,
    startDate: quotation.estimatedStartDate,
    dueDate: quotation.estimatedCompletionDate,
    status: quotation.advanceAmount > 0 ? 'awaiting_advance_payment' : 'new',
    workflowStage: 'hired',
    verificationStatus: 'unverified',
    hiredAt: now,
    propertySite: {
      propertyType: quotation.job.propertyType,
      plotNumber: quotation.job.plotNumber,
      city: quotation.job.exactLocation?.city,
      state: quotation.job.exactLocation?.state,
      country: quotation.job.exactLocation?.country,
      fullAddress: quotation.job.exactLocation?.address,
      latitude: quotation.job.exactLocation?.latitude,
      longitude: quotation.job.exactLocation?.longitude,
      landArea: quotation.job.landArea,
    },
    paymentSummary: { total: quotation.totalAmount, paid: 0, outstanding: quotation.totalAmount },
    createdBy: actorId,
    updatedBy: actorId,
  });

  let advancePayment = null;
  if (Number(quotation.advanceAmount || 0) > 0) {
    advancePayment = await Payment.create({
      invoiceNumber: number('SUR-ADV'),
      payer: quotation.client,
      payee: quotation.surveyor,
      surveyProject: project._id,
      surveyQuotation: quotation._id,
      type: 'survey_advance',
      amount: Number(quotation.advanceAmount),
      paidAmount: 0,
      status: 'pending',
      dueDate: now,
      method: 'offline',
      notes: `Advance for project ${project.projectNumber}`,
      createdBy: actorId,
      updatedBy: actorId,
    });
  }

  await Promise.all([
    createNotification({
      user: quotation.surveyor,
      title: 'Quotation accepted',
      message: `Your proposal ${quotation.quotationNumber || ''} has been accepted. Open the project for navigation and secure check-in.`,
      category: 'survey',
      actionUrl: `/app/survey-projects/${project._id}`,
      metadata: { projectId: project._id, quotationId: quotation._id },
    }),
    createNotification({
      user: quotation.client,
      title: 'Survey project created',
      message: `Project ${project.projectNumber} is ready. Track fieldwork, evidence, report approval and payment from one workspace.`,
      category: 'survey',
      actionUrl: `/app/survey-projects/${project._id}`,
      metadata: { projectId: project._id, quotationId: quotation._id },
    }),
  ]);

  return { quotation, project, advancePayment };
}

export async function createDirectSurveyProject({ job, surveyorId, actorId }) {
  const now = new Date();
  const quotation = await SurveyQuotation.create({
    quotationNumber: number('SQ'),
    job: job._id,
    surveyor: surveyorId,
    client: job.client,
    scope: job.requestMessage || job.purpose || 'Property verification survey',
    methodology: 'To be agreed in the hired project workspace',
    deliverables: job.deliverables || ['Measured property survey report', 'Verification evidence'],
    totalAmount: 0,
    advanceAmount: 0,
    paymentSchedule: [],
    status: 'accepted',
    acceptedAt: now,
    submittedAt: now,
    createdBy: actorId,
    updatedBy: actorId,
  });
  const project = await SurveyProject.create({
    projectNumber: number('SP'),
    job: job._id,
    quotation: quotation._id,
    property: job.property,
    client: job.client,
    surveyor: surveyorId,
    workflowType: 'direct_surveyor',
    surveyCategory: job.surveyType,
    startDate: job.preferredVisitDate,
    dueDate: job.preferredCompletionDate,
    status: 'new',
    workflowStage: 'hired',
    verificationStatus: 'unverified',
    hiredAt: now,
    propertySite: {
      propertyType: job.propertyType,
      city: job.exactLocation?.city,
      state: job.exactLocation?.state,
      country: job.exactLocation?.country,
      fullAddress: job.exactLocation?.address,
      latitude: job.exactLocation?.latitude,
      longitude: job.exactLocation?.longitude,
      landArea: job.landArea,
    },
    // Direct hiring always starts with the two agreed commercial gates:
    // fieldwork/evidence, then the final report/verification.
    milestones: [
      { title: 'Milestone 1 · Site visit, measurements & evidence', description: 'Secure site visit, property measurements, and evidence uploads.', order: 1, status: 'proposed', amount: 0 },
      { title: 'Milestone 2 · Survey report & property verification', description: 'Final report review, second payment, and property verification.', order: 2, status: 'proposed', amount: 0 },
    ],
    paymentSummary: { total: 0, paid: 0, outstanding: 0 },
    createdBy: actorId,
    updatedBy: actorId,
  });
  return { quotation, project };
}

export async function populateSurveyProject(project) {
  return project.populate([
    { path: 'property', select: 'title code referenceNumber type address map location surveyVerificationStatus isVerified' },
    { path: 'job', select: 'jobNumber title surveyType propertyType addressApproximate exactLocation requirements deliverables budget status workflowStage preferredVisitDate preferredCompletionDate' },
    { path: 'quotation', select: 'quotationNumber totalAmount advanceAmount status scope methodology' },
    { path: 'client', select: 'name email phone avatar role' },
    { path: 'surveyor', select: 'name email phone avatar role surveyorEnabled surveyorPlan' },
    { path: 'milestones.payment', select: 'invoiceNumber amount paidAmount status method transactionId dueDate gateway paymentVerification' },
    { path: 'activeVisit', select: 'status confirmedStart checkIn checkOut route' },
    { path: 'fieldData', select: 'observedAt weather gpsCoordinates boundaryPoints measurements fieldNotes observations validation' },
    { path: 'fieldworkReview.submittedBy', select: 'name avatar' },
    { path: 'fieldworkReview.reviewedBy', select: 'name avatar' },
    { path: 'report', select: 'reportNumber title type reportFile sections status issueDate revisionNumber lockedAt' },
    { path: 'finalPayment', select: 'invoiceNumber amount paidAmount status method transactionId dueDate paidAt' },
  ]);
}

export function milestoneFromProject(project, milestoneId) {
  const milestone = project.milestones?.id(milestoneId);
  if (!milestone) throw new ApiError(404, 'Milestone not found');
  return milestone;
}

export async function notifyMilestone({ user, title, message, projectId, milestoneId }) {
  return createNotification({
    user,
    title,
    message,
    category: 'survey',
    actionUrl: '/app/survey-projects',
    metadata: { projectId, milestoneId },
  });
}

export { sameId, number };
