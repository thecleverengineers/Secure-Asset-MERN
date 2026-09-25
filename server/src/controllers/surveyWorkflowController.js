import {
  DriveFile,
  FieldData,
  Payment,
  Property,
  SiteVisit,
  SurveyJob,
  SurveyProject,
  SurveyQuotation,
  SurveyReport,
  SurveyorProfile,
  User,
} from '../models/index.js';
import { writeAudit } from '../middleware/audit.js';
import { getActiveLandlordSubscription } from '../services/landlordSubscription.js';
import { getActiveSurveyorSubscription } from '../services/surveyorSubscription.js';
import {
  acceptSurveyQuotation,
  createDirectSurveyProject,
  milestoneFromProject,
  notifyMilestone,
  number,
  populateSurveyProject,
  sameId,
} from '../services/surveyWorkflow.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { createNotification } from '../services/notifications.js';
import { applyPaidPayment } from '../services/paymentLifecycle.js';
import { emitRealtime } from '../services/realtime.js';
import { sendStoredFile } from '../utils/httpFile.js';

function paging(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 12), 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

function safeRegex(value) {
  return String(value || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validDate(value, label) {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(422, `${label} is invalid`);
  return date;
}

function directMilestoneForOrder(project, order) {
  return (project.milestones || []).find((item) => Number(item.order) === Number(order)) || null;
}

function directBudgetReady(project) {
  const milestones = [1, 2].map((order) => directMilestoneForOrder(project, order));
  return milestones.every((milestone) => milestone && milestone.status === 'accepted' && Number(milestone.amount || 0) > 0);
}

async function ensureDirectMilestonePayment(project, milestone, actorId) {
  if (!milestone || Number(milestone.amount || 0) <= 0) throw new ApiError(409, 'Both direct-hiring milestones must have a positive agreed amount');
  let payment = milestone.payment
    ? await Payment.findOne({ _id: milestone.payment, surveyProject: project._id, type: 'survey_milestone' })
    : null;
  if (!payment) {
    payment = await Payment.findOne({ surveyProject: project._id, type: 'survey_milestone', 'gateway.milestoneId': String(milestone._id), status: { $nin: ['failed', 'refunded', 'waived'] } });
  }
  if (!payment) {
    payment = await Payment.create({
      invoiceNumber: number('SUR-MIL'), payer: project.client, payee: project.surveyor,
      surveyProject: project._id, surveyQuotation: project.quotation, property: project.property,
      type: 'survey_milestone', amount: Number(milestone.amount), paidAmount: 0, status: 'pending',
      dueDate: milestone.dueAt || new Date(), method: 'offline',
      gateway: { provider: 'direct_surveyor_milestone', milestoneId: String(milestone._id), order: Number(milestone.order || 0) },
      notes: `${milestone.title} for project ${project.projectNumber}`, createdBy: actorId, updatedBy: actorId,
    });
  }
  milestone.payment = payment._id;
  milestone.status = milestone.status === 'accepted' ? 'approved' : milestone.status;
  return payment;
}

async function requireLandlord(req) {
  if (req.user?.role === 'admin') return null;
  return getActiveLandlordSubscription(req.user._id);
}

async function requireSurveyor(req) {
  if (req.user?.role === 'admin') return null;
  return getActiveSurveyorSubscription(req.user._id);
}

async function projectForSide(projectId, req, side) {
  const project = await SurveyProject.findById(projectId);
  if (!project) throw new ApiError(404, 'Survey project not found');
  if (req.user?.role !== 'admin') {
    const owner = side === 'landlord' ? project.client : project.surveyor;
    if (!sameId(owner, req.user._id)) throw new ApiError(403, `Only the assigned ${side} can perform this milestone action`);
    if (side === 'landlord') await requireLandlord(req);
    else await requireSurveyor(req);
  }
  if (['cancelled', 'completed'].includes(project.status)) throw new ApiError(409, 'This project is already closed');
  return project;
}

export const listSurveyMarketplace = asyncHandler(async (req, res) => {
  await requireSurveyor(req);
  const { page, limit, skip } = paging(req.query);
  const now = new Date();
  const filter = {
    $and: [
      {
        $or: [
          { visibility: 'public' },
          { visibility: 'invited', requestedSurveyor: req.user._id, requestStatus: 'pending', hiringPath: 'direct_surveyor' },
        ],
      },
      { $or: [{ closesAt: null }, { closesAt: { $exists: false } }, { closesAt: { $gt: now } }] },
    ],
    status: { $in: ['open', 'quotation_review'] },
  };
  const search = safeRegex(req.query.search);
  if (search) filter.$and.push({ $or: ['title', 'surveyType', 'propertyType', 'addressApproximate', 'description'].map((field) => ({ [field]: { $regex: search, $options: 'i' } })) });
  if (req.query.location) filter.addressApproximate = { $regex: safeRegex(req.query.location), $options: 'i' };
  if (req.query.category) filter.surveyType = { $regex: safeRegex(req.query.category), $options: 'i' };
  if (req.query.urgency) filter.urgency = String(req.query.urgency);
  const [records, total] = await Promise.all([
    SurveyJob.find(filter)
      .select('-exactLocation -contact -documents -photographs')
      .populate('client', 'name avatar')
      .sort({ urgency: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SurveyJob.countDocuments(filter),
  ]);
  const current = coordinatePair({ latitude: req.query.latitude, longitude: req.query.longitude });
  const proposalRows = records.length ? await SurveyQuotation.find({ surveyor: req.user._id, job: { $in: records.map((item) => item._id) } }).select('job status quotationNumber').lean() : [];
  const proposalByJob = new Map(proposalRows.map((item) => [String(item.job), item]));
  const data = records.map((record) => {
    const result = { ...record };
    const target = Array.isArray(result.location?.coordinates) ? coordinatePair({ latitude: result.location.coordinates[1], longitude: result.location.coordinates[0] }) : null;
    result.distanceKm = current && target ? Math.round(distanceMetres(current, target) / 100) / 10 : null;
    result.myProposal = proposalByJob.get(String(result._id)) || null;
    delete result.location;
    return result;
  });
  res.json({ success: true, data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

export const listLandlordSurveyJobs = asyncHandler(async (req, res) => {
  await requireLandlord(req);
  const { page, limit, skip } = paging(req.query);
  const filter = { client: req.user._id };
  if (req.query.status) filter.status = String(req.query.status);
  const [data, total] = await Promise.all([
    SurveyJob.find(filter)
      .populate('hiredSurveyor', 'name avatar email phone surveyorPlan')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SurveyJob.countDocuments(filter),
  ]);
  res.json({ success: true, data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

export const listMyDirectSurveyQuoteRequests = asyncHandler(async (req, res) => {
  await requireLandlord(req);
  const { page, limit, skip } = paging({ ...req.query, limit: req.query.limit || 50 });
  const filter = { client: req.user._id, hiringPath: 'direct_surveyor' };
  if (req.query.status) filter.requestStatus = String(req.query.status);
  const [records, total] = await Promise.all([
    SurveyJob.find(filter)
      .populate('requestedSurveyor', 'name avatar surveyorPlan surveyorEnabled')
      .populate('hiredSurveyor', 'name avatar surveyorPlan')
      .populate('property', 'title name code referenceNumber address')
      .sort({ requestedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SurveyJob.countDocuments(filter),
  ]);
  const projects = records.length
    ? await SurveyProject.find({ job: { $in: records.map((item) => item._id) }, client: req.user._id })
      .select('_id job projectNumber status workflowStage')
      .lean()
    : [];
  const projectByJob = new Map(projects.map((project) => [String(project.job), project]));
  const data = records.map((item) => ({ ...item, project: projectByJob.get(String(item._id)) || null }));
  res.json({ success: true, data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

export const listIncomingDirectSurveyQuoteRequests = asyncHandler(async (req, res) => {
  await requireSurveyor(req);
  const { page, limit, skip } = paging({ ...req.query, limit: req.query.limit || 50 });
  const filter = { requestedSurveyor: req.user._id, hiringPath: 'direct_surveyor' };
  if (req.query.status) filter.requestStatus = String(req.query.status);
  const [records, total] = await Promise.all([
    SurveyJob.find(filter)
      .select('-exactLocation -contact -documents -photographs')
      .populate('client', 'name avatar')
      .sort({ requestedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SurveyJob.countDocuments(filter),
  ]);
  const projects = records.length
    ? await SurveyProject.find({ job: { $in: records.map((item) => item._id) }, surveyor: req.user._id })
      .select('_id job projectNumber status workflowStage')
      .lean()
    : [];
  const projectByJob = new Map(projects.map((project) => [String(project.job), project]));
  const data = records
    .map((item) => ({ ...item, project: projectByJob.get(String(item._id)) || null }))
    .sort((left, right) => {
      const leftPending = left.requestStatus === 'pending' ? 0 : 1;
      const rightPending = right.requestStatus === 'pending' ? 0 : 1;
      return leftPending - rightPending || new Date(right.requestedAt || right.createdAt).getTime() - new Date(left.requestedAt || left.createdAt).getTime();
    });
  res.json({ success: true, data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

export const requestSurveyorQuote = asyncHandler(async (req, res) => {
  await requireLandlord(req);
  const surveyorId = String(req.body.surveyorId || '').trim();
  const propertyId = String(req.body.propertyId || '').trim();
  if (!/^[a-f\d]{24}$/i.test(surveyorId)) throw new ApiError(422, 'Choose a verified Surveyor');
  if (!/^[a-f\d]{24}$/i.test(propertyId)) throw new ApiError(422, 'Choose one of your properties');

  const [profile, property] = await Promise.all([
    SurveyorProfile.findOne({ user: surveyorId, visibility: 'public', publicationStatus: 'published', verificationStatus: 'verified' }).lean(),
    Property.findOne({ _id: propertyId, owner: req.user._id, deletedAt: null }).lean(),
  ]);
  if (!profile) throw new ApiError(404, 'The selected Surveyor is not currently available for direct requests');
  await getActiveSurveyorSubscription(surveyorId);
  if (!property) throw new ApiError(403, 'You can request a survey only for your own active property');

  const existing = await SurveyJob.findOne({
    client: req.user._id, property: property._id, requestedSurveyor: surveyorId,
    requestStatus: { $in: ['pending', 'accepted'] },
  }).select('_id requestStatus').lean();
  if (existing) throw new ApiError(409, existing.requestStatus === 'accepted' ? 'A hired survey project already exists for this Surveyor and property' : 'A quote request is already waiting for this Surveyor');

  const title = String(req.body.title || `Property verification survey · ${property.title || property.code || property.referenceNumber || 'property'}`).trim().slice(0, 180);
  const surveyType = String(req.body.surveyType || 'land_measurement').trim().slice(0, 80);
  const purpose = String(req.body.purpose || 'Property verification').trim().slice(0, 500);
  if (!title || !purpose) throw new ApiError(422, 'Add a request title and purpose');
  const landArea = Number(req.body.landArea || 0);
  if (!Number.isFinite(landArea) || landArea <= 0) throw new ApiError(422, 'Enter the approximate property size');
  const preferredVisitDate = validDate(req.body.preferredVisitDate, 'Preferred visit date');
  const preferredCompletionDate = validDate(req.body.preferredCompletionDate, 'Report deadline');
  if (preferredVisitDate && preferredCompletionDate && preferredCompletionDate < preferredVisitDate) throw new ApiError(422, 'Report deadline must be on or after the preferred visit date');
  const latitude = Number(property.map?.latitude ?? property.location?.coordinates?.[1]);
  const longitude = Number(property.map?.longitude ?? property.location?.coordinates?.[0]);
  const exactLocation = {
    country: property.address?.country, state: property.address?.state, city: property.address?.city,
    address: [property.address?.line1, property.address?.line2, property.address?.locality, property.address?.city, property.address?.state, property.address?.postalCode].filter(Boolean).join(', '),
    ...(Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0) ? { latitude, longitude } : {}),
  };
  const now = new Date();
  const job = await SurveyJob.create({
    jobNumber: number('SJ'), client: req.user._id, property: property._id,
    title, surveyType, propertyType: property.type,
    addressApproximate: [property.address?.locality, property.address?.city, property.address?.state].filter(Boolean).join(', '),
    ...(Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0) ? { location: { type: 'Point', coordinates: [longitude, latitude] } } : {}),
    exactLocation, landArea, measurementUnit: String(req.body.measurementUnit || 'sq_ft'), purpose,
    preferredVisitDate, preferredCompletionDate,
    budget: { min: Math.max(0, Number(req.body.budgetMin || 0)), max: Math.max(0, Number(req.body.budgetMax || 0)), currency: 'INR' },
    description: String(req.body.description || '').trim().slice(0, 2000),
    requirements: Array.isArray(req.body.requirements) ? req.body.requirements.map((item) => String(item).trim()).filter(Boolean).slice(0, 20) : ['Property measurements and verification'],
    deliverables: Array.isArray(req.body.deliverables) ? req.body.deliverables.map((item) => String(item).trim()).filter(Boolean).slice(0, 20) : ['Measured survey report', 'Evidence photographs'],
    siteAccess: String(req.body.siteAccess || '').trim().slice(0, 1000),
    contact: { name: req.user.name, phone: req.user.phone, email: req.user.email },
    urgency: ['normal', 'priority', 'urgent', 'emergency'].includes(String(req.body.urgency)) ? String(req.body.urgency) : 'normal',
    visibility: 'invited', invitedSurveyors: [surveyorId], bookingType: 'quotation', hiringPath: 'direct_surveyor',
    requestStatus: 'pending', requestedSurveyor: surveyorId, requestMessage: String(req.body.requestMessage || purpose).trim().slice(0, 2000), requestedAt: now,
    status: 'open', workflowStage: 'posted', postedAt: now, createdBy: req.user._id, updatedBy: req.user._id,
  });
  await createNotification({
    user: surveyorId, title: 'New direct survey quote request',
    message: `${req.user.name || 'A landlord'} requested a quote for ${property.title || property.code || 'a property'}. Accept or reject the request to continue.`,
    category: 'survey', actionUrl: '/app/survey-job-marketplace', metadata: { jobId: job._id, event: 'direct_survey_quote_requested' },
  });
  await writeAudit(req, { action: 'survey-quote:requested-directly', module: 'survey-projects', recordId: job._id, updatedValue: { surveyorId, propertyId: property._id, requestStatus: 'pending' } });
  res.status(201).json({ success: true, data: { job }, message: 'Quote request sent. The Surveyor will be notified to accept or reject it.' });
});

export const respondSurveyorQuoteRequest = asyncHandler(async (req, res) => {
  await requireSurveyor(req);
  const job = await SurveyJob.findOne({ _id: req.params.jobId, requestedSurveyor: req.user._id });
  if (!job) throw new ApiError(404, 'Direct survey quote request not found');
  if (job.hiringPath !== 'direct_surveyor' || job.requestStatus !== 'pending') throw new ApiError(409, 'This quote request is no longer awaiting your response');
  const decision = String(req.body.decision || '').toLowerCase();
  if (!['accept', 'reject'].includes(decision)) throw new ApiError(422, 'Choose accept or reject');
  const reason = String(req.body.reason || '').trim().slice(0, 1200);
  const now = new Date();
  if (decision === 'reject') {
    job.requestStatus = 'rejected'; job.respondedAt = now; job.responseReason = reason || 'The Surveyor is unavailable for this request.';
    job.status = 'cancelled'; job.workflowStage = 'cancelled'; job.updatedBy = req.user._id;
    await job.save();
    await createNotification({ user: job.client, title: 'Survey quote request declined', message: `${job.title} was declined by the Surveyor.`, category: 'survey', actionUrl: '/surveyors', metadata: { jobId: job._id, event: 'direct_survey_quote_rejected' } });
    await writeAudit(req, { action: 'survey-quote:rejected-directly', module: 'survey-projects', recordId: job._id, updatedValue: { requestStatus: job.requestStatus, responseReason: job.responseReason } });
    return res.json({ success: true, data: { job }, message: 'Quote request rejected' });
  }
  const existingProject = await SurveyProject.findOne({ job: job._id }).select('_id').lean();
  if (existingProject) throw new ApiError(409, 'This request already has a survey project');
  const result = await createDirectSurveyProject({ job, surveyorId: req.user._id, actorId: req.user._id });
  job.requestStatus = 'accepted'; job.respondedAt = now; job.responseReason = reason; job.status = 'awarded'; job.workflowStage = 'hired'; job.hiredSurveyor = req.user._id; job.hiredAt = now; job.updatedBy = req.user._id;
  await job.save();
  await Promise.all([
    createNotification({ user: job.client, title: 'Survey quote request accepted', message: `${job.title} was accepted. Open the hired project to chat, agree the two milestones, and track verification.`, category: 'survey', actionUrl: `/app/survey-projects/${result.project._id}`, metadata: { jobId: job._id, projectId: result.project._id, event: 'direct_survey_quote_accepted' } }),
    createNotification({ user: req.user._id, title: 'Direct survey project created', message: `Open ${result.project.projectNumber} to chat, agree the two milestones, capture evidence, submit the report, and verify the property.`, category: 'survey', actionUrl: `/app/survey-projects/${result.project._id}`, metadata: { jobId: job._id, projectId: result.project._id, event: 'direct_survey_project_created' } }),
  ]);
  await writeAudit(req, { action: 'survey-quote:accepted-directly', module: 'survey-projects', recordId: result.project._id, updatedValue: { jobId: job._id, quotationId: result.quotation._id, requestStatus: job.requestStatus } });
  res.json({ success: true, data: { job, quotation: result.quotation, project: result.project }, message: 'Quote request accepted and hired project created' });
});

export const listSurveyJobBids = asyncHandler(async (req, res) => {
  await requireLandlord(req);
  const job = await SurveyJob.findOne({ _id: req.params.jobId, client: req.user._id }).select('_id title status quotationCount hiredSurveyor').lean();
  if (!job) throw new ApiError(404, 'Survey job not found');
  const bids = await SurveyQuotation.find({ job: job._id, status: { $nin: ['draft', 'rejected', 'withdrawn', 'expired'] } })
    .populate('surveyor', 'name avatar email phone surveyorPlan surveyorEnabled')
    .sort({ totalAmount: 1, createdAt: 1 })
    .lean();
  const profiles = await SurveyorProfile.find({ user: { $in: bids.map((item) => item.surveyor?._id || item.surveyor) } })
    .select('user professionalTitle yearsExperience qualifications certifications specialisations portfolio completedProjects rating verificationStatus availability averageCompletionDays')
    .lean();
  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const enriched = bids.map((bid) => ({ ...bid, professionalProfile: profileByUser.get(String(bid.surveyor?._id || bid.surveyor)) || null }));
  res.json({ success: true, data: { job, bids: enriched } });
});

export const hireSurveyor = asyncHandler(async (req, res) => {
  const result = await acceptSurveyQuotation({ quotationId: req.params.quotationId, actorId: req.user._id, isAdmin: req.user.role === 'admin' });
  await writeAudit(req, { action: 'survey-quotation:hired', module: 'survey-quotations', recordId: result.quotation._id, updatedValue: { quotation: result.quotation.toObject(), project: result.project.toObject() } });
  res.json({ success: true, data: result, message: 'Surveyor hired and project created' });
});

export const createMilestone = asyncHandler(async (req, res) => {
  const project = await projectForSide(req.params.projectId, req, 'landlord');
  if (project.workflowType === 'direct_surveyor') throw new ApiError(409, 'Direct Surveyor hiring uses exactly the two milestones created with the project');
  const title = String(req.body.title || '').trim();
  if (!title) throw new ApiError(422, 'Milestone title is required');
  if (title.length > 180) throw new ApiError(422, 'Milestone title is too long');
  const amount = Number(req.body.amount || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new ApiError(422, 'Milestone amount must be zero or greater');
  const dueAt = validDate(req.body.dueAt, 'Milestone due date');
  const order = (project.milestones || []).reduce((max, item) => Math.max(max, Number(item.order || 0)), 0) + 1;
  project.milestones.push({ title, description: String(req.body.description || '').trim().slice(0, 2000), amount, dueAt, order, status: 'proposed' });
  project.updatedBy = req.user._id;
  await project.save();
  const milestone = project.milestones[project.milestones.length - 1];
  await notifyMilestone({ user: project.surveyor, title: 'New survey milestone', message: `${title} was proposed for project ${project.projectNumber}.`, projectId: project._id, milestoneId: milestone._id });
  await writeAudit(req, { action: 'survey-milestone:created', module: 'survey-projects', recordId: project._id, updatedValue: milestone.toObject() });
  res.status(201).json({ success: true, data: { project: await populateSurveyProject(project), milestone }, message: 'Milestone proposed to the hired Surveyor' });
});

export const updateMilestone = asyncHandler(async (req, res) => {
  const project = await projectForSide(req.params.projectId, req, 'landlord');
  const milestone = milestoneFromProject(project, req.params.milestoneId);
  if (!['proposed', 'rejected'].includes(milestone.status)) throw new ApiError(409, 'Only proposed or rejected milestones can be edited');
  if (req.body.title !== undefined) {
    const title = String(req.body.title || '').trim();
    if (!title || title.length > 180) throw new ApiError(422, 'Milestone title is required and must be 180 characters or fewer');
    milestone.title = title;
  }
  if (req.body.description !== undefined) milestone.description = String(req.body.description || '').trim().slice(0, 2000);
  if (req.body.amount !== undefined) {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new ApiError(422, 'Milestone amount must be zero or greater');
    milestone.amount = amount;
  }
  if (req.body.dueAt !== undefined) milestone.dueAt = validDate(req.body.dueAt, 'Milestone due date');
  milestone.status = 'proposed';
  milestone.rejectionReason = undefined;
  if (project.workflowType === 'direct_surveyor') {
    const total = (project.milestones || []).reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0);
    project.paymentSummary = { ...(project.paymentSummary?.toObject?.() || project.paymentSummary || {}), total, paid: 0, outstanding: total };
  }
  project.updatedBy = req.user._id;
  await project.save();
  await notifyMilestone({ user: project.surveyor, title: 'Survey milestone updated', message: `${milestone.title} was updated and is ready for your acceptance.`, projectId: project._id, milestoneId: milestone._id });
  await writeAudit(req, { action: 'survey-milestone:updated', module: 'survey-projects', recordId: project._id, updatedValue: milestone.toObject() });
  res.json({ success: true, data: { project: await populateSurveyProject(project), milestone }, message: 'Milestone updated' });
});

export const acceptMilestone = asyncHandler(async (req, res) => {
  const project = await projectForSide(req.params.projectId, req, 'surveyor');
  const milestone = milestoneFromProject(project, req.params.milestoneId);
  if (!['proposed', 'rejected'].includes(milestone.status)) throw new ApiError(409, 'This milestone is not awaiting Surveyor acceptance');
  if (project.workflowType === 'direct_surveyor' && Number(milestone.amount || 0) <= 0) throw new ApiError(422, 'The landlord must enter a positive amount before you can accept this milestone');
  milestone.status = 'accepted';
  milestone.acceptedAt = new Date();
  milestone.rejectedAt = undefined;
  milestone.rejectionReason = undefined;
  project.updatedBy = req.user._id;
  await project.save();
  await notifyMilestone({ user: project.client, title: 'Milestone accepted', message: `${milestone.title} was accepted by the hired Surveyor.`, projectId: project._id, milestoneId: milestone._id });
  await writeAudit(req, { action: 'survey-milestone:accepted', module: 'survey-projects', recordId: project._id, updatedValue: milestone.toObject() });
  res.json({ success: true, data: { project: await populateSurveyProject(project), milestone }, message: 'Milestone accepted' });
});

export const submitMilestone = asyncHandler(async (req, res) => {
  const project = await projectForSide(req.params.projectId, req, 'surveyor');
  const milestone = milestoneFromProject(project, req.params.milestoneId);
  if (!['accepted', 'in_progress'].includes(milestone.status)) throw new ApiError(409, 'Accept the milestone before submitting it');
  milestone.status = 'submitted';
  milestone.submittedAt = new Date();
  project.status = project.status === 'new' || project.status === 'awaiting_advance_payment' ? 'client_review' : project.status;
  project.updatedBy = req.user._id;
  await project.save();
  await notifyMilestone({ user: project.client, title: 'Milestone submitted', message: `${milestone.title} is ready for your review.`, projectId: project._id, milestoneId: milestone._id });
  await writeAudit(req, { action: 'survey-milestone:submitted', module: 'survey-projects', recordId: project._id, updatedValue: milestone.toObject() });
  res.json({ success: true, data: { project: await populateSurveyProject(project), milestone }, message: 'Milestone submitted for landlord review' });
});

export const approveMilestone = asyncHandler(async (req, res) => {
  const project = await projectForSide(req.params.projectId, req, 'landlord');
  const milestone = milestoneFromProject(project, req.params.milestoneId);
  if (milestone.status !== 'submitted') throw new ApiError(409, 'Only submitted milestones can be approved');
  const amount = Number(milestone.amount || 0);
  let payment = null;
  if (amount > 0) {
    payment = await Payment.create({
      invoiceNumber: number('SUR-MIL'),
      payer: project.client,
      payee: project.surveyor,
      surveyProject: project._id,
      surveyQuotation: project.quotation,
      type: 'survey_milestone',
      amount,
      paidAmount: 0,
      status: 'pending',
      dueDate: milestone.dueAt || new Date(),
      method: 'offline',
      gateway: { provider: 'survey_milestone', milestoneId: String(milestone._id) },
      notes: `${milestone.title} for project ${project.projectNumber}`,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    milestone.payment = payment._id;
  }
  milestone.status = 'approved';
  milestone.approvedAt = new Date();
  project.updatedBy = req.user._id;
  await project.save();
  await notifyMilestone({ user: project.surveyor, title: 'Milestone approved', message: `${milestone.title} was approved${payment ? `; payment ${payment.invoiceNumber} is ready` : ''}.`, projectId: project._id, milestoneId: milestone._id });
  await writeAudit(req, { action: 'survey-milestone:approved', module: 'survey-projects', recordId: project._id, updatedValue: { milestone: milestone.toObject(), payment: payment?.toObject?.() || payment } });
  res.json({ success: true, data: { project: await populateSurveyProject(project), milestone, payment }, message: payment ? 'Milestone approved and payment invoice created' : 'Milestone approved' });
});

export const rejectMilestone = asyncHandler(async (req, res) => {
  const project = await projectForSide(req.params.projectId, req, 'landlord');
  const milestone = milestoneFromProject(project, req.params.milestoneId);
  if (milestone.status !== 'submitted') throw new ApiError(409, 'Only submitted milestones can be rejected');
  milestone.status = 'rejected';
  milestone.rejectedAt = new Date();
  milestone.rejectionReason = String(req.body.reason || 'Please revise this milestone and submit it again.').trim().slice(0, 1000);
  project.updatedBy = req.user._id;
  await project.save();
  await notifyMilestone({ user: project.surveyor, title: 'Milestone needs revision', message: `${milestone.title} was returned for revision.`, projectId: project._id, milestoneId: milestone._id });
  await writeAudit(req, { action: 'survey-milestone:rejected', module: 'survey-projects', recordId: project._id, updatedValue: milestone.toObject() });
  res.json({ success: true, data: { project: await populateSurveyProject(project), milestone }, message: 'Milestone returned for revision' });
});

const WORKFLOW_CLOSED = new Set(['completed', 'cancelled']);
const CHECK_IN_RADIUS_METRES = 1000;
const WORKFLOW_RANK = Object.freeze({ hired: 0, in_progress: 1, submitted: 2, approved: 3, completed: 4, cancelled: 5 });

function normalizedWorkflowStage(project) {
  const status = String(project.status || '');
  const current = String(project.workflowStage || 'hired');
  if (status === 'cancelled' || current === 'cancelled') return 'cancelled';
  if (status === 'completed' || current === 'completed') return 'completed';
  const legacy = ['awaiting_final_payment', 'payment_submitted', 'report_upload_requested', 'awaiting_second_payment', 'second_payment_submitted', 'final_report_ready'].includes(status) ? 'approved'
    : ['client_review', 'awaiting_landlord_review', 'revision_requested', 'draft_report_ready'].includes(status) ? 'submitted'
      : ['awaiting_first_payment', 'first_payment_submitted'].includes(status) ? 'submitted'
      : ['site_visit_completed', 'fieldwork_in_progress', 'data_processing'].includes(status) ? 'in_progress'
        : 'hired';
  return Number(WORKFLOW_RANK[legacy] || 0) > Number(WORKFLOW_RANK[current] || 0) ? legacy : current;
}

function fieldworkEditable(project) {
  return project.workflowStage === 'in_progress'
    || (project.workflowStage === 'submitted' && project.status === 'revision_requested');
}

function asPlain(value) {
  return value?.toObject ? value.toObject() : value || null;
}

function fieldNoteCount(fieldData) {
  if (Array.isArray(fieldData?.fieldNotes) && fieldData.fieldNotes.length) return fieldData.fieldNotes.length;
  return Array.isArray(fieldData?.observations?.notes) ? fieldData.observations.notes.length : 0;
}

function fieldworkReviewSnapshot(project, fieldData, capturedAt = new Date()) {
  return {
    measurementCount: Number(fieldData?.measurements?.length || 0),
    fieldNoteCount: fieldNoteCount(fieldData),
    evidenceCount: Number(project.evidence?.length || 0),
    evidenceNames: (project.evidence || []).slice(0, 50).map((item) => String(item.name || 'Survey evidence').slice(0, 255)),
    fieldDataUpdatedAt: fieldData?.updatedAt || null,
    capturedAt,
  };
}

function archiveActiveFieldworkReview(project) {
  const current = asPlain(project.fieldworkReview);
  if (!current?.status || current.status === 'not_requested') return;
  const history = (project.fieldworkReviewHistory || []).map(asPlain).filter(Boolean);
  project.fieldworkReviewHistory = [...history, current].slice(-12);
}

function requiredReviewChecklist(value) {
  const checklist = {
    measurementsReviewed: value?.measurementsReviewed === true,
    evidenceReviewed: value?.evidenceReviewed === true,
    scopeReviewed: value?.scopeReviewed === true,
  };
  if (!checklist.measurementsReviewed || !checklist.evidenceReviewed || !checklist.scopeReviewed) {
    throw new ApiError(422, 'Confirm that you reviewed the measurements, evidence, and agreed scope before approving fieldwork');
  }
  return checklist;
}

function finalPaymentConfirmed(payment) {
  return Boolean(payment && payment.status === 'paid' && payment.paymentVerification?.status === 'approved');
}

function hiredProjectEditable(project) {
  return ['hired', 'in_progress'].includes(project.workflowStage)
    || (project.workflowStage === 'submitted' && project.status === 'revision_requested');
}

function finiteNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ApiError(422, `${label} is required`);
  return parsed;
}

function coordinatePair(source = {}) {
  const latitude = Number(source.latitude);
  const longitude = Number(source.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0)
    ? { latitude, longitude }
    : null;
}

function distanceMetres(left, right) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const earth = 6371000;
  const deltaLatitude = radians(right.latitude - left.latitude);
  const deltaLongitude = radians(right.longitude - left.longitude);
  const latitude1 = radians(left.latitude);
  const latitude2 = radians(right.latitude);
  const value = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function mapUrlFor(project) {
  const coordinates = coordinatePair(project.job?.exactLocation || project.propertySite || {})
    || coordinatePair({ latitude: project.property?.map?.latitude, longitude: project.property?.map?.longitude })
    || (Array.isArray(project.property?.location?.coordinates) ? coordinatePair({ latitude: project.property.location.coordinates[1], longitude: project.property.location.coordinates[0] }) : null);
  const address = project.job?.exactLocation?.address || project.propertySite?.fullAddress;
  if (coordinates) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${coordinates.latitude},${coordinates.longitude}`)}`;
  if (address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  return null;
}

async function workflowProject(req, side = 'participant', { allowClosed = true } = {}) {
  const project = await SurveyProject.findById(req.params.projectId);
  if (!project) throw new ApiError(404, 'Survey project not found');
  const normalizedStage = normalizedWorkflowStage(project);
  if (project.workflowStage !== normalizedStage) {
    project.workflowStage = normalizedStage;
    await project.save();
  }
  const admin = req.user?.role === 'admin';
  const landlord = sameId(project.client, req.user?._id);
  const surveyor = sameId(project.surveyor, req.user?._id);
  if (!admin && side === 'landlord' && !landlord) throw new ApiError(403, 'Only the landlord who hired the Surveyor can perform this action');
  if (!admin && side === 'surveyor' && !surveyor) throw new ApiError(403, 'Only the hired Surveyor can perform this action');
  if (!admin && side === 'participant' && !landlord && !surveyor) throw new ApiError(403, 'Survey project access denied');
  if (!admin && side === 'landlord') await requireLandlord(req);
  if (!admin && side === 'surveyor') await requireSurveyor(req);
  if (!allowClosed && WORKFLOW_CLOSED.has(project.workflowStage)) throw new ApiError(409, 'This survey project is already closed');
  return { project, admin, landlord, surveyor };
}

async function notifySurveyAdmins({ title, message, projectId, event }) {
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();
  await Promise.all(admins.map((admin) => createNotification({
    user: admin._id, title, message, category: 'survey', actionUrl: `/app/survey-projects/${projectId}`,
    metadata: { projectId, event },
  })));
}

async function projectBundle(project, req) {
  const populated = await populateSurveyProject(project);
  const fileIds = (populated.evidence || []).map((item) => item.file).filter(Boolean);
  const reportId = populated.report?._id || populated.report;
  const reportFileId = populated.report?.reportFile?._id || populated.report?.reportFile;
  if (reportFileId) fileIds.push(reportFileId);
  const [files, payments] = await Promise.all([
    DriveFile.find({ _id: { $in: fileIds }, status: 'active' }).select('name originalName mimeType category sizeBytes preview createdAt').lean(),
    Payment.find({ surveyProject: populated._id, type: { $in: ['survey_advance', 'survey_milestone', 'survey_final'] } }).select('invoiceNumber type amount paidAmount status dueDate paidAt method transactionId proofFile paymentVerification gateway').sort({ createdAt: 1 }).lean(),
  ]);
  const byFile = new Map(files.map((file) => [String(file._id), file]));
  const data = populated.toObject ? populated.toObject() : populated;
  const activeReview = asPlain(data.fieldworkReview);
  data.fieldworkReview = activeReview?.status ? activeReview : { status: 'not_requested', version: 0, checklist: {} };
  // The audit log retains the complete review history. The project workspace
  // needs only the current decision, which avoids exposing stale comments in
  // every normal project response.
  delete data.fieldworkReviewHistory;
  data.evidence = (data.evidence || []).map((item) => ({
    ...item,
    file: byFile.get(String(item.file?._id || item.file)) || item.file,
    contentUrl: `/api/v1/survey-workflow/projects/${data._id}/files/${item.file?._id || item.file}/content`,
  }));
  if (data.report) {
    const currentReportFileId = data.report.reportFile?._id || data.report.reportFile;
    data.report = {
      ...data.report,
      reportFile: byFile.get(String(currentReportFileId)) || data.report.reportFile || null,
      reportFileUrl: currentReportFileId ? `/api/v1/survey-workflow/projects/${data._id}/report/file/content` : null,
    };
  }
  const finalPayment = payments.find((payment) => payment.type === 'survey_final') || null;
  const finalVerification = finalPayment?.paymentVerification || null;
  data.finalPaymentWorkflow = {
    status: !finalPayment ? 'not_required'
      : finalPaymentConfirmed(finalPayment) ? 'confirmed'
        : finalVerification?.status === 'submitted' ? 'proof_submitted'
          : finalVerification?.status === 'rejected' ? 'returned'
            : 'awaiting_landlord',
    invoiceNumber: finalPayment?.invoiceNumber || null,
    amount: finalPayment ? Number(finalPayment.amount || 0) : 0,
    dueDate: finalPayment?.dueDate || null,
    proofSubmittedAt: finalVerification?.submittedAt || null,
    payerDeclaredAt: finalVerification?.payerDeclaredAt || null,
    receiptConfirmedAt: finalVerification?.receiptConfirmedAt || finalVerification?.approvedAt || null,
    rejectionReason: finalVerification?.rejectionReason || '',
  };
  data.payments = payments.map((payment) => ({
    ...payment,
    proofSubmitted: Boolean(payment.proofFile),
    paymentVerification: payment.paymentVerification ? {
      status: payment.paymentVerification.status,
      submittedAt: payment.paymentVerification.submittedAt || null,
      approvedAt: payment.paymentVerification.approvedAt || null,
      rejectedAt: payment.paymentVerification.rejectedAt || null,
      rejectionReason: payment.paymentVerification.rejectionReason || '',
      submissionCount: Number(payment.paymentVerification.submissionCount || 0),
      payerDeclaredAt: payment.paymentVerification.payerDeclaredAt || null,
      receiptConfirmedAt: payment.paymentVerification.receiptConfirmedAt || null,
      confirmationNote: payment.paymentVerification.confirmationNote || '',
    } : null,
    proofFile: undefined,
  }));
  const totalPaid = payments.reduce((sum, payment) => sum + (['paid', 'partial'].includes(payment.status) ? Number(payment.paidAmount || 0) : 0), 0);
  const total = Number(data.paymentSummary?.total || 0);
  data.paymentSummary = { ...(data.paymentSummary || {}), total, paid: totalPaid, outstanding: Math.max(0, total - totalPaid) };
  data.paymentStatus = total > 0 && totalPaid >= total ? 'paid' : totalPaid > 0 ? 'partial' : payments.some((payment) => ['pending', 'overdue'].includes(payment.status)) ? 'pending' : 'unpaid';
  data.navigationUrl = mapUrlFor(data);
  data.permissions = {
    landlord: req.user.role === 'admin' || sameId(data.client, req.user._id),
    surveyor: req.user.role === 'admin' || sameId(data.surveyor, req.user._id),
  };
  return data;
}

export const listSurveyorProposals = asyncHandler(async (req, res) => {
  await requireSurveyor(req);
  const { page, limit, skip } = paging(req.query);
  const filter = { surveyor: req.user._id };
  if (req.query.status) filter.status = String(req.query.status);
  const [records, total] = await Promise.all([
    SurveyQuotation.find(filter)
      .populate('job', 'jobNumber title surveyType propertyType addressApproximate budget status workflowStage hiredSurveyor')
      .populate('client', 'name avatar')
      .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SurveyQuotation.countDocuments(filter),
  ]);
  const projectRows = records.length ? await SurveyProject.find({ quotation: { $in: records.map((item) => item._id) } }).select('quotation _id projectNumber workflowStage').lean() : [];
  const projectByQuotation = new Map(projectRows.map((item) => [String(item.quotation), item]));
  const data = records.map((item) => ({ ...item, project: projectByQuotation.get(String(item._id)) || null }));
  res.json({ success: true, data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

export const listSurveyProjects = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const participant = req.user.role === 'admin' ? {} : { $or: [{ client: req.user._id }, { surveyor: req.user._id }] };
  const filter = { ...participant };
  if (req.query.stage) filter.workflowStage = String(req.query.stage);
  const [records, total] = await Promise.all([
    SurveyProject.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    SurveyProject.countDocuments(filter),
  ]);
  const paymentRows = records.length ? await Payment.find({
    surveyProject: { $in: records.map((record) => record._id) },
    type: { $in: ['survey_advance', 'survey_milestone', 'survey_final'] },
  }).select('surveyProject invoiceNumber type amount paidAmount status dueDate paidAt').sort({ createdAt: 1 }).lean() : [];
  const paymentsByProject = new Map();
  paymentRows.forEach((payment) => {
    const key = String(payment.surveyProject);
    const current = paymentsByProject.get(key) || [];
    current.push(payment);
    paymentsByProject.set(key, current);
  });
  const data = await Promise.all(records.map(async (record) => {
    const normalizedStage = normalizedWorkflowStage(record);
    if (record.workflowStage !== normalizedStage) {
      record.workflowStage = normalizedStage;
      await record.save();
    }
    const populated = await populateSurveyProject(record);
    const value = populated.toObject();
    const payments = paymentsByProject.get(String(value._id)) || [];
    const total = Number(value.paymentSummary?.total || 0);
    const paid = payments.reduce((sum, payment) => sum + (['paid', 'partial'].includes(payment.status) ? Number(payment.paidAmount || 0) : 0), 0);
    return {
      ...value,
      payments,
      paymentSummary: { ...(value.paymentSummary || {}), total, paid, outstanding: Math.max(0, total - paid) },
      paymentStatus: total > 0 && paid >= total ? 'paid' : paid > 0 ? 'partial' : payments.some((payment) => ['pending', 'overdue'].includes(payment.status)) ? 'pending' : 'unpaid',
      navigationUrl: mapUrlFor(value), evidenceCount: value.evidence?.length || 0,
    };
  }));
  res.json({ success: true, data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

export const getSurveyProject = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req);
  res.json({ success: true, data: await projectBundle(project, req) });
});

export const checkInSurveyProject = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'surveyor', { allowClosed: false });
  if (!['hired', 'in_progress'].includes(project.workflowStage)) throw new ApiError(409, 'Secure check-in is available only after you are hired');
  const unpaidAdvance = await Payment.exists({ surveyProject: project._id, type: 'survey_advance', status: { $ne: 'paid' } });
  if (unpaidAdvance) throw new ApiError(409, 'The agreed advance payment must be secured before site check-in');
  const current = {
    latitude: finiteNumber(req.body.latitude, 'Latitude'),
    longitude: finiteNumber(req.body.longitude, 'Longitude'),
  };
  const accuracy = Math.max(0, finiteNumber(req.body.accuracy ?? 0, 'GPS accuracy'));
  if (accuracy > 150) throw new ApiError(422, 'GPS accuracy is too low for secure check-in; move outdoors and try again');
  const property = project.property ? await Property.findById(project.property).lean() : null;
  const job = project.job ? await SurveyJob.findById(project.job).lean() : null;
  const target = coordinatePair(job?.exactLocation || project.propertySite || {})
    || coordinatePair({ latitude: property?.map?.latitude, longitude: property?.map?.longitude })
    || (Array.isArray(property?.location?.coordinates) ? coordinatePair({ latitude: property.location.coordinates[1], longitude: property.location.coordinates[0] }) : null);
  if (!target) throw new ApiError(422, 'The landlord must add exact property GPS coordinates before secure check-in');
  const distance = Math.round(distanceMetres(current, target));
  if (distance > CHECK_IN_RADIUS_METRES) throw new ApiError(403, `Check-in denied: you are ${distance} metres from the property`);
  const now = new Date();
  let visit = project.activeVisit ? await SiteVisit.findById(project.activeVisit) : null;
  if (!visit) visit = new SiteVisit({ project: project._id, client: project.client, surveyor: project.surveyor, requestedStart: job?.preferredVisitDate, confirmedStart: now, createdBy: req.user._id });
  visit.status = 'in_progress';
  visit.checkIn = { at: now, ...current, accuracy, verified: true, distanceMetres: distance };
  visit.route = { ...(visit.route || {}), destination: job?.exactLocation?.address || project.propertySite?.fullAddress };
  visit.updatedBy = req.user._id;
  await visit.save();
  project.activeVisit = visit._id;
  project.workflowStage = 'in_progress'; project.status = 'fieldwork_in_progress'; project.startedAt ||= now;
  project.verificationStatus = 'surveyed'; project.updatedBy = req.user._id;
  await project.save();
  await Promise.all([
    SurveyJob.findByIdAndUpdate(project.job, { status: 'in_progress', workflowStage: 'in_progress', startedAt: now, updatedBy: req.user._id }),
    project.property ? Property.findByIdAndUpdate(project.property, { surveyVerificationStatus: 'surveyed', surveyedAt: now, lastSurveyProject: project._id }) : null,
    createNotification({ user: project.client, title: 'Surveyor checked in', message: `Secure GPS check-in completed for ${project.projectNumber}.`, category: 'survey', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, event: 'survey_check_in' } }),
  ]);
  await writeAudit(req, { action: 'survey-project:secure-check-in', module: 'survey-projects', recordId: project._id, updatedValue: { visitId: visit._id, distanceMetres: distance, accuracy } });
  res.json({ success: true, data: await projectBundle(project, req), message: 'Secure property check-in verified' });
});

export const checkOutSurveyProject = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'surveyor', { allowClosed: false });
  const visit = project.activeVisit ? await SiteVisit.findById(project.activeVisit) : null;
  if (!visit?.checkIn?.at) throw new ApiError(409, 'Check in before completing the site visit');
  if (visit.checkOut?.at) throw new ApiError(409, 'This site visit is already complete');
  const now = new Date();
  visit.checkOut = {
    at: now,
    latitude: finiteNumber(req.body.latitude, 'Latitude'),
    longitude: finiteNumber(req.body.longitude, 'Longitude'),
    accuracy: Math.max(0, finiteNumber(req.body.accuracy ?? 0, 'GPS accuracy')),
  };
  visit.status = 'completed'; visit.updatedBy = req.user._id;
  await visit.save();
  project.status = 'data_processing'; project.updatedBy = req.user._id;
  await project.save();
  await writeAudit(req, { action: 'survey-project:check-out', module: 'survey-projects', recordId: project._id, updatedValue: { visitId: visit._id, checkOutAt: now } });
  res.json({ success: true, data: await projectBundle(project, req), message: 'Site visit completed' });
});

export const saveSurveyFieldwork = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'surveyor', { allowClosed: false });
  if (!hiredProjectEditable(project)) throw new ApiError(409, 'Field tools are available only while you are the hired Surveyor on an active project');
  let fieldData = project.fieldData
    ? await FieldData.findOne({ _id: project.fieldData, project: project._id, surveyor: req.user._id })
    : null;
  // Older offline-sync records may exist before the project reference was
  // linked. Reuse the latest record for this hired project instead of creating
  // another FieldData document during the online save.
  if (!fieldData) fieldData = await FieldData.findOne({ project: project._id, surveyor: req.user._id }).sort('-updatedAt');
  if (!fieldData) fieldData = new FieldData({ project: project._id, visit: project.activeVisit || undefined, surveyor: project.surveyor, observedAt: new Date(), createdBy: req.user._id });

  if (!fieldData.fieldNotes?.length && Array.isArray(fieldData.observations?.notes) && fieldData.observations.notes.length) {
    fieldData.fieldNotes = fieldData.observations.notes
      .map((item) => ({ text: String(item?.text || item || '').trim(), capturedAt: item?.at || item?.capturedAt, author: item?.by || item?.author }))
      .filter((item) => item.text);
  }

  const measurement = req.body.measurement;
  let measurementSaved = false;
  if (measurement) {
    const label = String(measurement.label || '').trim();
    const value = finiteNumber(measurement.value, 'Measurement value');
    const unit = String(measurement.unit || '').trim();
    if (!label || !unit) throw new ApiError(422, 'Measurement label and unit are required');
    const measurementValue = { type: String(measurement.type || 'dimension'), label: label.slice(0, 180), value, unit: unit.slice(0, 40), angle: measurement.angle, notes: String(measurement.notes || '').slice(0, 1000) };
    const measurementId = String(req.body.measurementId || measurement._id || '').trim();
    const rawMeasurementIndex = req.body.measurementIndex;
    const measurementIndex = rawMeasurementIndex === undefined || rawMeasurementIndex === null || rawMeasurementIndex === '' ? -1 : Number(rawMeasurementIndex);
    const existing = measurementId ? fieldData.measurements.id(measurementId) : Number.isInteger(measurementIndex) && measurementIndex >= 0 ? fieldData.measurements[measurementIndex] : null;
    if (measurementId || measurementIndex >= 0) {
      if (!existing) throw new ApiError(404, 'Measurement not found in this survey project');
      Object.assign(existing, measurementValue);
    } else fieldData.measurements.push(measurementValue);
    measurementSaved = true;
  }

  const noteInput = req.body.note;
  const note = noteInput && typeof noteInput === 'object' ? String(noteInput.text || '').trim() : String(noteInput || '').trim();
  let noteSaved = false;
  if (note) {
    const noteId = String(req.body.noteId || (typeof noteInput === 'object' ? noteInput._id || noteInput.noteId : '') || '').trim();
    const rawNoteIndex = req.body.noteIndex;
    const noteIndex = rawNoteIndex === undefined || rawNoteIndex === null || rawNoteIndex === '' ? -1 : Number(rawNoteIndex);
    const noteValue = {
      text: note.slice(0, 3000), category: String(req.body.noteCategory || (typeof noteInput === 'object' ? noteInput.category : '') || 'site').slice(0, 80),
      latitude: req.body.latitude ?? (typeof noteInput === 'object' ? noteInput.latitude : undefined), longitude: req.body.longitude ?? (typeof noteInput === 'object' ? noteInput.longitude : undefined),
      accuracy: req.body.accuracy ?? (typeof noteInput === 'object' ? noteInput.accuracy : undefined),
      capturedAt: typeof noteInput === 'object' && noteInput.capturedAt ? validDate(noteInput.capturedAt, 'Field note capture date') : new Date(),
      author: req.user._id, updatedBy: req.user._id,
    };
    const existing = noteId ? fieldData.fieldNotes.id(noteId) : Number.isInteger(noteIndex) && noteIndex >= 0 ? fieldData.fieldNotes[noteIndex] : null;
    if (noteId || noteIndex >= 0) {
      if (!existing) throw new ApiError(404, 'Field note not found in this survey project');
      Object.assign(existing, noteValue);
    } else fieldData.fieldNotes.push(noteValue);
    const notes = fieldData.fieldNotes.map((item) => ({ text: item.text, at: item.capturedAt || item.createdAt || new Date(), by: item.author || req.user._id, noteId: item._id }));
    fieldData.observations = { ...(fieldData.observations || {}), notes };
    project.fieldNotes = notes.map((item) => item.text);
    noteSaved = true;
  }

  let gpsSaved = false;
  if (req.body.gps) {
    fieldData.gpsCoordinates.push({
      label: String(req.body.gps.label || 'Field observation').slice(0, 180),
      latitude: finiteNumber(req.body.gps.latitude, 'Latitude'), longitude: finiteNumber(req.body.gps.longitude, 'Longitude'),
      elevation: req.body.gps.elevation, accuracy: Number(req.body.gps.accuracy || 0), capturedAt: new Date(),
    });
    gpsSaved = true;
  }
  if (!measurementSaved && !noteSaved && !gpsSaved) throw new ApiError(422, 'Add a measurement, GPS point, or field note');
  fieldData.syncStatus = 'synced'; fieldData.updatedBy = req.user._id;
  await fieldData.save();
  project.fieldData = fieldData._id; project.updatedBy = req.user._id;
  await project.save();
  await writeAudit(req, { action: measurementSaved || noteSaved ? 'survey-project:fieldwork-updated' : 'survey-project:fieldwork-recorded', module: 'survey-projects', recordId: project._id, updatedValue: { fieldDataId: fieldData._id, measurement: measurement || undefined, note: note || undefined, measurementId: req.body.measurementId, measurementIndex: req.body.measurementIndex, noteId: req.body.noteId, noteIndex: req.body.noteIndex } });
  res.json({ success: true, data: await projectBundle(project, req), message: 'Fieldwork saved' });
});

// Field data and evidence are reviewed before any final report is requested.
// This deliberately prevents a surveyor from publishing a final report before
// the landlord has inspected the completed site work and settled the balance.
export const submitSurveyFieldworkForReview = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'surveyor', { allowClosed: false });
  if (!fieldworkEditable(project)) throw new ApiError(409, 'Fieldwork can be submitted only while the hired Surveyor is actively working on this project');
  const fieldData = project.fieldData ? await FieldData.findOne({ _id: project.fieldData, project: project._id, surveyor: req.user._id }) : null;
  if (!(fieldData?.measurements || []).length) throw new ApiError(422, 'Record at least one field measurement before requesting landlord review');
  if (!(project.evidence || []).length) throw new ApiError(422, 'Attach at least one photo, video, or document before requesting landlord review');
  const now = new Date();
  if (project.workflowType === 'direct_surveyor') {
    const firstMilestone = directMilestoneForOrder(project, 1);
    if (!directBudgetReady(project) || !firstMilestone || firstMilestone.status !== 'accepted') {
      throw new ApiError(409, 'Both milestones must be agreed before the Surveyor submits fieldwork');
    }
    const firstPayment = await ensureDirectMilestonePayment(project, firstMilestone, req.user._id);
    project.workflowStage = 'submitted';
    project.status = 'awaiting_first_payment';
    project.fieldworkSubmittedAt = now;
    project.submittedAt = now;
    project.verificationStatus = 'field_verified';
    project.paymentSummary = { ...(project.paymentSummary?.toObject?.() || project.paymentSummary || {}), total: (project.milestones || []).reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0)), 0) };
    project.updatedBy = req.user._id;
    await project.save();
    await Promise.all([
      SurveyJob.findByIdAndUpdate(project.job, { workflowStage: 'submitted', status: 'in_progress', submittedAt: now, updatedBy: req.user._id }),
      project.property ? Property.findByIdAndUpdate(project.property, { surveyVerificationStatus: 'field_verified', fieldVerifiedAt: now, lastSurveyProject: project._id }) : null,
      createNotification({ user: project.client, title: 'First survey milestone is ready', message: `${project.projectNumber} fieldwork and evidence are submitted. Pay milestone 1 with the transaction ID and payment proof.`, category: 'payment', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, paymentId: firstPayment._id, milestoneId: firstMilestone._id, event: 'direct_first_milestone_payment_requested' } }),
    ]);
    await writeAudit(req, { action: 'direct-survey:fieldwork-submitted', module: 'survey-projects', recordId: project._id, updatedValue: { fieldDataId: fieldData._id, evidenceCount: project.evidence.length, paymentId: firstPayment._id, submittedAt: now } });
    return res.json({ success: true, data: await projectBundle(project, req), message: 'Fieldwork submitted. The landlord can now pay milestone 1.' });
  }
  const previousReview = asPlain(project.fieldworkReview);
  archiveActiveFieldworkReview(project);
  project.fieldworkReview = {
    status: 'awaiting_landlord',
    version: Math.max(0, Number(previousReview?.version || 0)) + 1,
    submittedAt: now,
    submittedBy: req.user._id,
    checklist: { measurementsReviewed: false, evidenceReviewed: false, scopeReviewed: false },
    comment: '',
    revisionReason: '',
    snapshot: fieldworkReviewSnapshot(project, fieldData, now),
  };
  project.workflowStage = 'submitted';
  project.status = 'awaiting_landlord_review';
  project.fieldworkSubmittedAt = now;
  project.submittedAt = now;
  project.verificationStatus = 'field_verified';
  project.updatedBy = req.user._id;
  await project.save();
  await Promise.all([
    SurveyJob.findByIdAndUpdate(project.job, { workflowStage: 'submitted', submittedAt: now, updatedBy: req.user._id }),
    project.property ? Property.findByIdAndUpdate(project.property, { surveyVerificationStatus: 'field_verified', fieldVerifiedAt: now, lastSurveyProject: project._id }) : null,
    createNotification({ user: project.client, title: 'Fieldwork ready for review', message: `${project.projectNumber} is ready for your recorded review. Inspect the measurements, evidence, and agreed scope before making a decision.`, category: 'survey', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, reviewVersion: project.fieldworkReview.version, event: 'survey_fieldwork_submitted_for_review' } }),
    notifySurveyAdmins({ title: 'Survey fieldwork submitted', message: `${project.projectNumber} is waiting for landlord review.`, projectId: project._id, event: 'survey_fieldwork_submitted_for_review' }),
  ]);
  await writeAudit(req, { action: 'survey-fieldwork:submitted-for-review', module: 'survey-projects', recordId: project._id, updatedValue: { fieldDataId: fieldData._id, evidenceCount: project.evidence.length, submittedAt: now, review: asPlain(project.fieldworkReview) } });
  res.json({ success: true, data: await projectBundle(project, req), message: 'Field data and evidence submitted for landlord review' });
});

export const attachSurveyEvidence = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'surveyor', { allowClosed: false });
  if (!hiredProjectEditable(project)) throw new ApiError(409, 'Evidence tools are available only while you are the hired Surveyor on an active project');
  const fileId = String(req.body.fileId || '').trim();
  const file = await DriveFile.findOne({ _id: fileId, owner: req.user._id, status: 'active', 'relations.surveyProject': project._id }).lean();
  if (!file) throw new ApiError(422, 'Upload this file for the selected survey project before attaching it');
  if ((project.evidence || []).some((item) => sameId(item.file, file._id))) throw new ApiError(409, 'This evidence file is already attached');
  const mime = String(file.mimeType || '').toLowerCase();
  const inferred = mime.startsWith('image/') ? 'photo' : mime.startsWith('video/') ? 'video' : 'document';
  const kind = ['photo', 'video', 'document'].includes(req.body.kind) ? req.body.kind : inferred;
  project.evidence.push({
    file: file._id, kind, name: file.name, mimeType: file.mimeType, note: String(req.body.note || '').trim().slice(0, 2000),
    latitude: req.body.latitude, longitude: req.body.longitude, accuracy: req.body.accuracy,
    capturedAt: req.body.capturedAt ? validDate(req.body.capturedAt, 'Evidence capture date') : new Date(), uploadedBy: req.user._id,
  });
  project.updatedBy = req.user._id;
  await project.save();
  await writeAudit(req, { action: 'survey-project:evidence-added', module: 'survey-projects', recordId: project._id, updatedValue: { fileId: file._id, kind, name: file.name } });
  res.status(201).json({ success: true, data: await projectBundle(project, req), message: 'Evidence attached to this survey' });
});

export const removeSurveyEvidence = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'surveyor', { allowClosed: false });
  if (!hiredProjectEditable(project)) throw new ApiError(409, 'Submitted evidence can no longer be removed');
  const evidence = project.evidence?.id(req.params.evidenceId);
  if (!evidence) throw new ApiError(404, 'Evidence not found');
  const removed = { fileId: evidence.file, name: evidence.name };
  evidence.deleteOne(); project.updatedBy = req.user._id;
  await project.save();
  await writeAudit(req, { action: 'survey-project:evidence-removed', module: 'survey-projects', recordId: project._id, previousValue: removed });
  res.json({ success: true, data: await projectBundle(project, req), message: 'Evidence removed from this survey' });
});

export const streamSurveyEvidence = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req);
  const attached = (project.evidence || []).some((item) => sameId(item.file, req.params.fileId));
  if (!attached) throw new ApiError(404, 'Survey evidence not found');
  const file = await DriveFile.findOne({ _id: req.params.fileId, status: 'active', 'relations.surveyProject': project._id }).select('+storageKey');
  if (!file) throw new ApiError(404, 'Survey evidence file not found');
  await sendStoredFile(req, res, file, { download: req.query.download === 'true' });
});

export const attachSurveyReportFile = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'surveyor', { allowClosed: false });
  if (project.workflowStage !== 'approved' || project.status !== 'report_upload_requested') throw new ApiError(409, 'Landlord review and final payment confirmation are required before the final report can be uploaded');
  if (project.workflowType === 'direct_surveyor') {
    const firstMilestone = directMilestoneForOrder(project, 1);
    const firstPayment = firstMilestone?.payment
      ? await Payment.findOne({ _id: firstMilestone.payment, surveyProject: project._id, type: 'survey_milestone' })
      : await Payment.findOne({ surveyProject: project._id, type: 'survey_milestone', 'gateway.order': 1 }).sort('-createdAt');
    if (!firstPayment || !finalPaymentConfirmed(firstPayment)) throw new ApiError(409, 'The first milestone payment must be confirmed by the Surveyor before the report can be submitted');
    const fileId = String(req.body.fileId || '').trim();
    const file = await DriveFile.findOne({ _id: fileId, owner: req.user._id, status: 'active', 'relations.surveyProject': project._id }).lean();
    if (!file) throw new ApiError(422, 'Upload this report for the selected survey project before attaching it');
    let report = project.report ? await SurveyReport.findById(project.report) : null;
    if (report?.status === 'locked') throw new ApiError(409, 'The verified survey report cannot be replaced');
    const previous = report?.toObject?.();
    if (!report) report = new SurveyReport({ reportNumber: number('SR'), project: project._id, surveyor: project.surveyor, client: project.client, type: project.surveyCategory || 'property_survey', createdBy: req.user._id });
    report.reportFile = file._id;
    report.title = String(req.body.title || report.title || file.name || 'Survey report').trim().slice(0, 250);
    report.attachments = [...new Set([...(report.attachments || []).map((item) => String(item)), String(file._id)])];
    const now = new Date();
    report.status = 'client_preview';
    report.issueDate = now;
    report.lockedAt = undefined;
    report.lockedBy = undefined;
    report.updatedBy = req.user._id;
    await report.save();
    const secondMilestone = directMilestoneForOrder(project, 2);
    const secondPayment = await ensureDirectMilestonePayment(project, secondMilestone, req.user._id);
    project.report = report._id;
    project.workflowStage = 'approved';
    project.status = 'awaiting_second_payment';
    project.reportUploadRequestedAt = now;
    project.updatedBy = req.user._id;
    await project.save();
    await Promise.all([
      createNotification({ user: project.client, title: 'Survey report ready — second milestone payment needed', message: `${project.projectNumber} has submitted the survey report for your review. Read it, then submit milestone 2 payment proof.`, category: 'payment', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, reportId: report._id, paymentId: secondPayment._id, milestoneId: secondMilestone._id, event: 'direct_second_milestone_payment_requested' } }),
      writeAudit(req, { action: 'direct-survey:report-submitted-for-review', module: 'survey-projects', recordId: project._id, previousValue: previous, updatedValue: { reportId: report._id, fileId: file._id, secondPaymentId: secondPayment._id, submittedAt: now } }),
    ]);
    return res.status(201).json({ success: true, data: await projectBundle(project, req), message: 'Survey report submitted for landlord review. Milestone 2 payment is now ready.' });
  }
  if (project.fieldworkReview?.status !== 'approved') throw new ApiError(409, 'A recorded landlord fieldwork approval is required before the final report can be uploaded');
  const finalPayment = project.finalPayment
    ? await Payment.findOne({ _id: project.finalPayment, surveyProject: project._id, type: 'survey_final' })
    : await Payment.findOne({ surveyProject: project._id, type: 'survey_final' }).sort('-createdAt');
  const financials = await surveyPaymentFinancials(project);
  if ((finalPayment && !finalPaymentConfirmed(finalPayment)) || financials.outstanding > 0) throw new ApiError(409, 'All outstanding survey charges, including the final payment, must be confirmed before report upload');
  const fileId = String(req.body.fileId || '').trim();
  const file = await DriveFile.findOne({ _id: fileId, owner: req.user._id, status: 'active', 'relations.surveyProject': project._id }).lean();
  if (!file) throw new ApiError(422, 'Upload this report for the selected survey project before attaching it');
  let report = project.report ? await SurveyReport.findById(project.report) : null;
  if (report?.status === 'locked' || report?.status === 'final') throw new ApiError(409, 'The approved survey report cannot be replaced');
  const previous = report?.toObject?.();
  if (!report) report = new SurveyReport({ reportNumber: number('SR'), project: project._id, surveyor: project.surveyor, client: project.client, type: project.surveyCategory || 'property_survey', createdBy: req.user._id });
  report.reportFile = file._id;
  report.title = String(req.body.title || report.title || file.name || 'Survey report').trim().slice(0, 250);
  report.attachments = [...new Set([...(report.attachments || []).map((item) => String(item)), String(file._id)])];
  const now = new Date();
  report.status = 'final';
  report.issueDate = now;
  report.lockedAt = now;
  report.lockedBy = req.user._id;
  report.updatedBy = req.user._id;
  await report.save();
  project.report = report._id;
  project.workflowStage = 'completed';
  project.status = 'completed';
  project.verificationStatus = 'fully_verified';
  project.completedAt = now;
  project.updatedBy = req.user._id;
  await project.save();
  await Promise.all([
    SurveyJob.findByIdAndUpdate(project.job, { workflowStage: 'completed', status: 'completed', completedAt: now, updatedBy: req.user._id }),
    project.property ? Property.findByIdAndUpdate(project.property, { surveyVerificationStatus: 'fully_verified', isVerified: true, documentVerifiedAt: now, fullyVerifiedAt: now, lastSurveyProject: project._id }) : null,
    ...[project.client, project.surveyor].filter(Boolean).map((user) => createNotification({ user, title: 'Survey completed and property verified', message: `${project.projectNumber} now has its final report and the property is verified.`, category: 'survey', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, reportId: report._id, event: 'survey_report_uploaded_and_property_verified' } })),
    writeAudit(req, { action: 'survey-report:uploaded-and-completed', module: 'survey-projects', recordId: project._id, previousValue: previous, updatedValue: { reportId: report._id, fileId: file._id, name: file.name, verifiedAt: now } }),
  ]);
  res.status(201).json({ success: true, data: await projectBundle(project, req), message: 'Final report uploaded. The survey is complete and the property is verified.' });
});

export const streamSurveyReportFile = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req);
  const report = project.report ? await SurveyReport.findOne({ _id: project.report, project: project._id }).lean() : null;
  if (!report?.reportFile) throw new ApiError(404, 'Uploaded survey report not found');
  const file = await DriveFile.findOne({ _id: report.reportFile, status: 'active', 'relations.surveyProject': project._id }).select('+storageKey');
  if (!file) throw new ApiError(404, 'Uploaded survey report file not found');
  await sendStoredFile(req, res, file, { download: req.query.download === 'true' });
});

// Compatibility route: clients that still post to /report/submit are treated
// as submitting fieldwork for review. They cannot bypass final payment and the
// required final-report upload sequence.
export const submitSurveyReport = submitSurveyFieldworkForReview;

export const requestSurveyRevision = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'landlord', { allowClosed: false });
  if (project.workflowStage !== 'submitted' || !['awaiting_landlord_review', 'client_review'].includes(project.status)) throw new ApiError(409, 'Only submitted fieldwork can be returned for revision');
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 5 || reason.length > 1200) throw new ApiError(422, 'Explain the required fieldwork changes in 5 to 1200 characters');
  const now = new Date();
  const activeReview = asPlain(project.fieldworkReview);
  project.fieldworkReview = {
    ...(activeReview?.status ? activeReview : {
      version: 1,
      submittedAt: project.fieldworkSubmittedAt || now,
      submittedBy: project.surveyor,
      snapshot: { measurementCount: 0, fieldNoteCount: 0, evidenceCount: Number(project.evidence?.length || 0), evidenceNames: [], capturedAt: project.fieldworkSubmittedAt || now },
    }),
    status: 'changes_requested',
    reviewedAt: now,
    reviewedBy: req.user._id,
    revisionReason: reason,
  };
  const report = project.report ? await SurveyReport.findById(project.report) : null;
  if (report) {
    report.status = 'revision_requested';
    report.revisions.push({ revision: Number(report.revisionNumber || 0) + 1, previousSnapshot: report.toObject(), reason, revisedBy: req.user._id, revisedAt: now, clientComments: reason });
    report.updatedBy = req.user._id;
    await report.save();
  }
  project.status = 'revision_requested'; project.updatedBy = req.user._id; await project.save();
  await createNotification({ user: project.surveyor, title: 'Fieldwork needs revision', message: reason.slice(0, 500), category: 'survey', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, reportId: report?._id || null, event: 'survey_fieldwork_revision_requested' } });
  await writeAudit(req, { action: 'survey-fieldwork:revision-requested', module: 'survey-projects', recordId: project._id, updatedValue: { reportId: report?._id || null, reason, review: asPlain(project.fieldworkReview) } });
  res.json({ success: true, data: await projectBundle(project, req), message: 'Fieldwork revision request sent to the Surveyor' });
});

export const acceptSurveyPayment = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'surveyor', { allowClosed: false });
  const payment = await Payment.findOne({
    _id: req.params.paymentId,
    surveyProject: project._id,
    payee: req.user.role === 'admin' ? project.surveyor : req.user._id,
    type: { $in: ['survey_advance', 'survey_milestone', 'survey_final'] },
  });
  if (!payment) throw new ApiError(404, 'Survey payment not found in this project');
  if (project.workflowType === 'direct_surveyor' && payment.type === 'survey_milestone') {
    const order = Number(payment.gateway?.order || 0);
    const milestone = directMilestoneForOrder(project, order);
    if (!milestone || String(milestone.payment || '') !== String(payment._id)) throw new ApiError(409, 'This payment is not linked to a direct-hiring milestone');
    if (payment.status === 'paid') return res.json({ success: true, data: await projectBundle(project, req), message: `Milestone ${order} payment is already accepted` });
    if (!['pending', 'partial', 'overdue'].includes(payment.status)) throw new ApiError(409, 'This milestone payment cannot be accepted');
    if (payment.paymentVerification?.status !== 'submitted') throw new ApiError(409, 'The landlord must submit the transaction ID and payment proof before this milestone can be accepted');
    const previousValue = payment.toObject();
    const now = new Date();
    payment.paidAmount = Number(payment.amount || 0);
    payment.status = 'paid'; payment.paidAt = now; payment.method ||= 'offline';
    payment.paymentVerification = {
      ...(payment.paymentVerification?.toObject?.() || payment.paymentVerification || {}),
      status: 'approved', approvedAt: now, approvedBy: req.user._id,
      receiptConfirmedAt: now, receiptConfirmedBy: req.user._id,
    };
    payment.gateway = { ...(payment.gateway || {}), provider: 'direct_surveyor_milestone', acceptedBy: req.user._id, acceptedAt: now };
    payment.updatedBy = req.user._id;
    await payment.save();
    await applyPaidPayment(payment, { userId: req.user._id, role: req.user.role, ip: req.ip, device: req.get('user-agent') });
    const current = await SurveyProject.findById(project._id);
    const currentMilestone = current ? directMilestoneForOrder(current, order) : null;
    if (currentMilestone) { currentMilestone.status = 'paid'; currentMilestone.paidAt = now; }
    if (current && order === 1) {
      current.workflowStage = 'approved'; current.status = 'report_upload_requested'; current.reportUploadRequestedAt = now; current.verificationStatus = 'field_verified';
      current.updatedBy = req.user._id; await current.save();
    }
    if (current && order === 2) {
      const report = current.report ? await SurveyReport.findById(current.report) : null;
      if (!report || !['client_preview', 'submitted', 'approved', 'final'].includes(report.status)) throw new ApiError(409, 'The Surveyor must submit the survey report before milestone 2 can be accepted');
      report.status = 'locked'; report.lockedAt = now; report.lockedBy = req.user._id; report.updatedBy = req.user._id; await report.save();
      current.workflowStage = 'completed'; current.status = 'completed'; current.verificationStatus = 'fully_verified'; current.completedAt = now; current.updatedBy = req.user._id; await current.save();
      await Promise.all([
        SurveyJob.findByIdAndUpdate(current.job, { workflowStage: 'completed', status: 'completed', completedAt: now, updatedBy: req.user._id }),
        current.property ? Property.findByIdAndUpdate(current.property, { surveyVerificationStatus: 'fully_verified', isVerified: true, documentVerifiedAt: now, fullyVerifiedAt: now, lastSurveyProject: current._id }) : null,
      ]);
    }
    await Promise.all([
      createNotification({ user: payment.payer, title: `Milestone ${order} payment accepted`, message: order === 1 ? `${project.projectNumber} payment is confirmed. The Surveyor can now submit the survey report.` : `${project.projectNumber} payment is confirmed and the property is now verified.`, category: 'payment', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, paymentId: payment._id, milestoneId: milestone._id, event: 'direct_milestone_payment_accepted' } }),
      ...(order === 1 ? [createNotification({ user: payment.payee, title: 'Submit survey report', message: `${project.projectNumber} milestone 1 payment is confirmed. Upload the survey report for landlord review.`, category: 'survey', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, paymentId: payment._id, event: 'direct_report_upload_requested' } })] : [createNotification({ user: payment.payer, title: 'Property verified', message: `${project.projectNumber} milestone 2 payment is accepted and the submitted report is locked as the verified record.`, category: 'survey', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, paymentId: payment._id, event: 'direct_property_verified' } })]),
      writeAudit(req, { action: 'direct-survey:milestone-payment-accepted', module: 'survey-projects', recordId: project._id, previousValue, updatedValue: { paymentId: payment._id, milestoneId: milestone._id, order, status: 'paid', acceptedAt: now } }),
    ]);
    return res.json({ success: true, data: await projectBundle(current || project, req), message: order === 1 ? 'Milestone 1 payment accepted. The Surveyor can now submit the survey report.' : 'Milestone 2 payment accepted. The property is verified.' });
  }
  if (payment.status === 'paid') {
    if (payment.type === 'survey_final' && !finalPaymentConfirmed(payment)) throw new ApiError(409, 'The final payment is marked paid but has no recorded Surveyor receipt confirmation');
    if (!payment.gateway?.lifecycleAppliedAt) await applyPaidPayment(payment, { userId: req.user._id, role: req.user.role, ip: req.ip, device: req.get('user-agent') });
    const current = await SurveyProject.findById(project._id);
    if (payment.type === 'survey_final' && current) {
      const financials = await surveyPaymentFinancials(current);
      if (financials.outstanding <= 0) {
        current.workflowStage = 'approved';
        current.status = 'report_upload_requested';
        current.reportUploadRequestedAt ||= new Date();
        current.updatedBy = req.user._id;
        await current.save();
      }
    }
    return res.json({ success: true, data: await projectBundle(current || project, req), message: 'Payment is already marked paid' });
  }
  if (!['pending', 'partial', 'overdue'].includes(payment.status)) throw new ApiError(409, 'This survey payment cannot be accepted');
  if (payment.type === 'survey_final' && payment.paymentVerification?.status !== 'submitted') throw new ApiError(409, 'The landlord must submit a transaction ID and payment screenshot before final payment can be accepted');
  if (payment.type === 'survey_final' && req.body?.receiptConfirmed !== true) throw new ApiError(422, 'Confirm that you reviewed the transaction ID and screenshot and received the final payment');
  const confirmationNote = payment.type === 'survey_final' ? String(req.body?.confirmationNote || '').trim().slice(0, 1200) : '';
  const previousValue = payment.toObject();
  const now = new Date();
  payment.paidAmount = Number(payment.amount || 0);
  payment.status = 'paid'; payment.paidAt = now; payment.method ||= 'offline';
  payment.paymentVerification = {
    ...(payment.paymentVerification?.toObject?.() || payment.paymentVerification || {}),
    status: 'approved', approvedAt: now, approvedBy: req.user._id,
    ...(payment.type === 'survey_final' ? { receiptConfirmedAt: now, receiptConfirmedBy: req.user._id, confirmationNote } : {}),
  };
  payment.gateway = { ...(payment.gateway || {}), provider: payment.gateway?.provider || 'surveyor_acceptance', acceptedBy: req.user._id, acceptedAt: now };
  payment.updatedBy = req.user._id;
  await payment.save();
  await applyPaidPayment(payment, { userId: req.user._id, role: req.user.role, ip: req.ip, device: req.get('user-agent') });
  let current = await SurveyProject.findById(project._id);
  let finalReportAvailable = false;
  if (payment.type === 'survey_final' && current) {
    const financials = await surveyPaymentFinancials(current);
    if (financials.outstanding <= 0) {
      current.workflowStage = 'approved';
      current.status = 'report_upload_requested';
      current.reportUploadRequestedAt = now;
      current.verificationStatus = 'field_verified';
      current.paymentSummary = { ...(current.paymentSummary?.toObject?.() || current.paymentSummary || {}), ...financials };
      current.updatedBy = req.user._id;
      await current.save();
      finalReportAvailable = true;
    }
  }
  await Promise.all([
    createNotification({ user: payment.payer, title: payment.type === 'survey_final' ? 'Final survey payment confirmed' : 'Survey payment accepted', message: payment.type === 'survey_final' ? `${payment.invoiceNumber || 'Final survey payment'} was confirmed by the hired Surveyor. The report can now be uploaded.` : `${payment.invoiceNumber || 'Survey payment'} was accepted by the hired Surveyor and marked paid.`, category: 'payment', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, paymentId: payment._id, event: payment.type === 'survey_final' ? 'survey_final_payment_confirmed' : 'survey_payment_accepted' } }),
    ...(finalReportAvailable ? [createNotification({ user: project.surveyor, title: 'Upload final survey report', message: `${project.projectNumber} final payment is confirmed. Upload the final report to complete verification.`, category: 'survey', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, paymentId: payment._id, event: 'survey_report_upload_requested' } })] : []),
    writeAudit(req, { action: 'survey-payment:accepted', module: 'survey-projects', recordId: project._id, previousValue, updatedValue: payment.toObject() }),
  ]);
  emitRealtime('payments', 'survey-payment-accepted', payment, { users: [payment.payer, payment.payee] });
  emitRealtime('survey-projects', 'survey-payment-accepted', { _id: project._id, paymentId: payment._id, status: 'paid' }, { users: [project.client, project.surveyor] });
  current ||= await SurveyProject.findById(project._id);
  res.json({ success: true, data: await projectBundle(current || project, req), message: payment.type === 'survey_final' ? (finalReportAvailable ? 'Final payment receipt confirmed. The Surveyor can now upload the report.' : 'Final payment receipt confirmed. Any remaining survey charges must be settled before report upload.') : 'Payment accepted and marked paid' });
});

async function surveyPaymentFinancials(project) {
  const total = Math.max(0, Number(project.paymentSummary?.total || 0));
  const rows = await Payment.aggregate([
    { $match: { surveyProject: project._id, type: { $in: ['survey_advance', 'survey_milestone', 'survey_final'] }, status: { $in: ['paid', 'partial'] } } },
    { $group: { _id: null, paid: { $sum: '$paidAmount' } } },
  ]);
  const paid = Math.max(0, Number(rows[0]?.paid || 0));
  return { total, paid, outstanding: Math.max(0, total - paid) };
}

async function consolidatePendingSurveyCharges(project, actorId, now) {
  const charges = await Payment.find({
    surveyProject: project._id,
    type: { $in: ['survey_advance', 'survey_milestone'] },
    status: { $in: ['draft', 'pending', 'overdue'] },
  }).select('_id invoiceNumber gateway notes').lean();
  if (!charges.length) return [];
  const ids = charges.map((charge) => charge._id);
  await Payment.updateMany({ _id: { $in: ids } }, {
    $set: {
      status: 'waived',
      updatedBy: actorId,
      'gateway.consolidatedIntoFinalAt': now,
      'gateway.consolidatedIntoFinal': true,
    },
  });
  return charges.map((charge) => ({ id: charge._id, invoiceNumber: charge.invoiceNumber || null }));
}

async function createFinalSurveyPayment(project, actorId) {
  const financials = await surveyPaymentFinancials(project);
  const existing = await Payment.findOne({ surveyProject: project._id, type: 'survey_final', status: { $nin: ['failed', 'refunded'] } });
  if (existing) {
    if (existing.status === 'paid' && !finalPaymentConfirmed(existing)) throw new ApiError(409, 'The existing final payment requires a recorded Surveyor receipt confirmation before the report can be released');
    return { payment: existing, financials, consolidatedCharges: [] };
  }
  if (!financials.outstanding) return { payment: null, financials, consolidatedCharges: [] };
  const partiallyPaid = await Payment.exists({
    surveyProject: project._id,
    type: { $in: ['survey_advance', 'survey_milestone'] },
    status: 'partial',
  });
  if (partiallyPaid) throw new ApiError(409, 'Settle the existing partial survey payment before requesting one final payment invoice');
  const now = new Date();
  // One final invoice is the authoritative collection point for every amount
  // still unpaid after landlord fieldwork review. Older pending milestone rows
  // are retained and marked as consolidated, so the landlord is never charged
  // twice and the audit trail explains why they no longer require payment.
  const consolidatedCharges = await consolidatePendingSurveyCharges(project, actorId, now);
  const payment = await Payment.create({
    invoiceNumber: number('SUR-FINAL'), payer: project.client, payee: project.surveyor, surveyProject: project._id, surveyQuotation: project.quotation,
    property: project.property, type: 'survey_final', amount: financials.outstanding, paidAmount: 0, status: 'pending', dueDate: now, method: 'offline',
    gateway: { provider: 'survey_workflow', projectId: String(project._id) }, notes: `Final survey payment for ${project.projectNumber}`,
    createdBy: actorId, updatedBy: actorId,
  });
  return { payment, financials, consolidatedCharges };
}

export const reviewSurveyFieldwork = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'landlord', { allowClosed: false });
  if (project.workflowStage !== 'submitted' || !['awaiting_landlord_review', 'client_review'].includes(project.status)) {
    throw new ApiError(409, 'Only submitted fieldwork can be reviewed before requesting the final payment');
  }
  const fieldData = project.fieldData ? await FieldData.findById(project.fieldData) : null;
  if (!(fieldData?.measurements || []).length || !(project.evidence || []).length) throw new ApiError(409, 'The Surveyor must provide measurements and evidence before landlord review');
  const checklist = requiredReviewChecklist(req.body?.checklist);
  const comment = String(req.body?.comment || '').trim().slice(0, 2000);
  const activeReview = asPlain(project.fieldworkReview);
  if (activeReview?.status && !['not_requested', 'awaiting_landlord'].includes(activeReview.status)) throw new ApiError(409, 'This fieldwork review has already received a decision');
  const finalization = await createFinalSurveyPayment(project, req.user._id);
  const finalPayment = finalization.payment;
  const now = new Date();
  const paymentIsConfirmed = !finalPayment || finalPaymentConfirmed(finalPayment);
  project.fieldworkReview = {
    ...(activeReview?.status ? activeReview : {
      version: 1,
      submittedAt: project.fieldworkSubmittedAt || now,
      submittedBy: project.surveyor,
      snapshot: fieldworkReviewSnapshot(project, fieldData, now),
    }),
    status: 'approved',
    checklist,
    comment,
    revisionReason: '',
    reviewedAt: now,
    reviewedBy: req.user._id,
    finalPayment: finalPayment?._id || undefined,
    finalPaymentRequestedAt: finalPayment ? now : undefined,
  };
  project.workflowStage = 'approved';
  project.status = paymentIsConfirmed ? 'report_upload_requested' : 'awaiting_final_payment';
  project.fieldworkReviewedAt = now;
  project.approvedAt = now;
  project.finalPayment = finalPayment?._id || project.finalPayment;
  project.paymentSummary = { ...(project.paymentSummary?.toObject?.() || project.paymentSummary || {}), ...finalization.financials };
  if (paymentIsConfirmed) project.reportUploadRequestedAt = now;
  project.updatedBy = req.user._id;
  await project.save();
  await Promise.all([
    createNotification({ user: project.surveyor, title: paymentIsConfirmed ? 'Fieldwork approved — upload final report' : 'Fieldwork approved — final payment pending', message: paymentIsConfirmed ? `${project.projectNumber} has a recorded landlord review and payment confirmation. Upload the final report to complete property verification.` : `${project.projectNumber} was approved by the landlord. Wait for the landlord's declared payment proof, then explicitly confirm receipt before report upload.`, category: 'survey', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, paymentId: finalPayment?._id, reviewVersion: project.fieldworkReview.version, event: paymentIsConfirmed ? 'survey_report_upload_requested' : 'survey_final_payment_requested' } }),
    createNotification({ user: project.client, title: paymentIsConfirmed ? 'Final report requested' : 'Final survey payment ready', message: paymentIsConfirmed ? `${project.projectNumber} has no remaining balance; the Surveyor can upload the final report.` : `Your recorded fieldwork review is complete. Pay ${finalPayment?.invoiceNumber || 'the final invoice'}, then enter the transaction ID, upload the screenshot, and confirm the declaration.`, category: 'payment', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, paymentId: finalPayment?._id, reviewVersion: project.fieldworkReview.version, event: paymentIsConfirmed ? 'survey_report_upload_requested' : 'survey_final_payment_requested' } }),
  ]);
  await writeAudit(req, { action: 'survey-fieldwork:reviewed', module: 'survey-projects', recordId: project._id, updatedValue: { finalPaymentId: finalPayment?._id || null, consolidatedCharges: finalization.consolidatedCharges, financials: finalization.financials, checklist, comment, review: asPlain(project.fieldworkReview), status: project.status } });
  res.json({ success: true, data: await projectBundle(project, req), message: paymentIsConfirmed ? 'Fieldwork review is recorded. The Surveyor can upload the final report.' : 'Fieldwork review is recorded. Submit the final payment transaction, screenshot, and declaration.' });
});

export const submitSurveyMilestonePayment = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'landlord', { allowClosed: false });
  if (project.workflowType !== 'direct_surveyor') throw new ApiError(409, 'Milestone payment proof is available only for direct Surveyor hiring');
  const milestone = milestoneFromProject(project, req.params.milestoneId);
  const order = Number(milestone.order || 0);
  if (![1, 2].includes(order)) throw new ApiError(422, 'Only the two direct-hiring milestones can receive payment proof');
  const expectedStatus = order === 1 ? 'awaiting_first_payment' : 'awaiting_second_payment';
  if (project.status !== expectedStatus) throw new ApiError(409, `Milestone ${order} payment is not awaiting landlord submission`);
  const payment = await ensureDirectMilestonePayment(project, milestone, req.user._id);
  if (!['pending', 'partial', 'overdue'].includes(payment.status)) throw new ApiError(409, 'This milestone payment cannot be submitted');
  const transactionId = String(req.body.transactionId || '').trim();
  const proofFileId = String(req.body.proofFileId || '').trim();
  if (transactionId.length < 6 || transactionId.length > 160) throw new ApiError(422, 'Enter a valid transaction ID for this milestone payment');
  if (!/^[a-f\d]{24}$/i.test(proofFileId)) throw new ApiError(422, 'Upload the milestone payment proof before submitting');
  const proof = await DriveFile.findOne({ _id: proofFileId, owner: req.user._id, status: 'active', 'relations.surveyProject': project._id }).select('mimeType');
  if (!proof || !String(proof.mimeType || '').startsWith('image/')) throw new ApiError(422, 'Milestone payment proof must be an active image uploaded for this project');
  if (req.body?.payerDeclaration !== true) throw new ApiError(422, 'Confirm that you made or authorised this milestone payment');
  const method = ['upi', 'bank_transfer', 'offline'].includes(String(req.body.method || '')) ? String(req.body.method) : 'offline';
  const now = new Date();
  payment.method = method;
  payment.transactionId = transactionId;
  payment.proofFile = proof._id;
  payment.proofUrl = `/api/v1/survey-workflow/projects/${project._id}/payments/${payment._id}/proof/content`;
  payment.gateway = { ...(payment.gateway || {}), provider: 'direct_surveyor_milestone', milestoneId: String(milestone._id), order, paymentProofSubmittedAt: now };
  payment.paymentVerification = {
    ...(payment.paymentVerification?.toObject?.() || payment.paymentVerification || {}),
    status: 'submitted', submittedAt: now, submittedBy: req.user._id,
    payerDeclaredAt: now, payerDeclaredBy: req.user._id,
    submissionCount: Number(payment.paymentVerification?.submissionCount || 0) + 1,
    rejectedAt: undefined, rejectedBy: undefined, rejectionReason: undefined,
    approvedAt: undefined, approvedBy: undefined, receiptConfirmedAt: undefined, receiptConfirmedBy: undefined, confirmationNote: undefined,
  };
  payment.updatedBy = req.user._id;
  try { await payment.save(); } catch (error) { if (error?.code === 11000) throw new ApiError(409, 'This transaction ID has already been used'); throw error; }
  milestone.payment = payment._id;
  milestone.status = 'approved';
  project.status = order === 1 ? 'first_payment_submitted' : 'second_payment_submitted';
  project.updatedBy = req.user._id;
  await project.save();
  await Promise.all([
    createNotification({ user: project.surveyor, title: `Milestone ${order} payment proof submitted`, message: `${project.projectNumber} has a landlord-declared transaction and payment proof ready for your review.`, category: 'payment', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, paymentId: payment._id, milestoneId: milestone._id, event: 'direct_milestone_payment_submitted' } }),
    writeAudit(req, { action: 'direct-survey:milestone-payment-submitted', module: 'survey-projects', recordId: project._id, updatedValue: { paymentId: payment._id, milestoneId: milestone._id, order, transactionId, proofFileId, submittedAt: now } }),
  ]);
  res.json({ success: true, data: await projectBundle(project, req), message: `Milestone ${order} payment proof submitted for Surveyor receipt confirmation` });
});

export const submitSurveyFinalPayment = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'landlord', { allowClosed: false });
  if (!['awaiting_final_payment', 'payment_submitted'].includes(project.status)) throw new ApiError(409, 'The final payment is not awaiting submission for this project');
  const payment = await Payment.findOne({
    _id: req.params.paymentId,
    surveyProject: project._id,
    payer: project.client,
    type: 'survey_final',
    status: { $in: ['pending', 'partial', 'overdue'] },
  });
  if (!payment) throw new ApiError(404, 'Final survey payment not found');
  const transactionId = String(req.body.transactionId || '').trim();
  const proofFileId = String(req.body.proofFileId || '').trim();
  if (transactionId.length < 6 || transactionId.length > 160) throw new ApiError(422, 'Enter the valid transaction ID for the final payment');
  if (!/^[a-f\d]{24}$/i.test(proofFileId)) throw new ApiError(422, 'Upload the payment screenshot before submitting the final payment');
  if (req.body?.payerDeclaration !== true) throw new ApiError(422, 'Confirm that you made or authorised this exact final payment before submitting it for receipt confirmation');
  const proof = await DriveFile.findOne({ _id: proofFileId, owner: req.user._id, status: 'active', 'relations.surveyProject': project._id }).select('mimeType');
  if (!proof || !String(proof.mimeType || '').startsWith('image/')) throw new ApiError(422, 'Final payment proof must be an active image screenshot uploaded for this project');
  const method = ['upi', 'bank_transfer', 'offline'].includes(String(req.body.method || '')) ? String(req.body.method) : 'offline';
  const now = new Date();
  const previous = payment.toObject();
  payment.method = method;
  payment.transactionId = transactionId;
  payment.proofFile = proof._id;
  payment.proofUrl = `/api/v1/survey-workflow/projects/${project._id}/payments/${payment._id}/proof/content`;
  payment.gateway = { ...(payment.gateway || {}), provider: 'survey_manual_final_payment', paymentProofSubmittedAt: now };
  payment.paymentVerification = {
    ...(payment.paymentVerification?.toObject?.() || payment.paymentVerification || {}),
    status: 'submitted', submittedAt: now, submittedBy: req.user._id,
    payerDeclaredAt: now, payerDeclaredBy: req.user._id,
    submissionCount: Number(payment.paymentVerification?.submissionCount || 0) + 1,
    rejectedAt: undefined, rejectedBy: undefined, rejectionReason: undefined,
    approvedAt: undefined, approvedBy: undefined,
    receiptConfirmedAt: undefined, receiptConfirmedBy: undefined, confirmationNote: undefined,
  };
  payment.updatedBy = req.user._id;
  try {
    await payment.save();
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, 'This transaction ID has already been used');
    throw error;
  }
  project.status = 'payment_submitted';
  project.finalPaymentSubmittedAt = now;
  project.updatedBy = req.user._id;
  await project.save();
  await Promise.all([
    createNotification({ user: project.surveyor, title: 'Final payment proof and declaration submitted', message: `${project.projectNumber} has a landlord-declared transaction ID and screenshot ready for your receipt confirmation.`, category: 'payment', actionUrl: `/app/survey-projects/${project._id}`, metadata: { projectId: project._id, paymentId: payment._id, event: 'survey_final_payment_submitted' } }),
    writeAudit(req, { action: 'survey-final-payment:submitted', module: 'survey-projects', recordId: project._id, previousValue: previous, updatedValue: { paymentId: payment._id, transactionId, proofFileId: proof._id, payerDeclaredAt: now } }),
  ]);
  res.json({ success: true, data: await projectBundle(project, req), message: 'Final payment proof and landlord declaration submitted for Surveyor receipt confirmation' });
});

// A final payment proof is never silently discarded. The assigned Surveyor can
// return it with an actionable reason, and the landlord can resubmit the same
// final-payment invoice without restarting the whole survey workflow.
export const rejectSurveyFinalPayment = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req, 'surveyor', { allowClosed: false });
  if (project.status !== 'payment_submitted') throw new ApiError(409, 'Only a submitted final payment proof can be returned for correction');
  const payment = await Payment.findOne({
    _id: req.params.paymentId,
    surveyProject: project._id,
    payee: req.user.role === 'admin' ? project.surveyor : req.user._id,
    type: 'survey_final',
    status: { $in: ['pending', 'partial', 'overdue'] },
  });
  if (!payment) throw new ApiError(404, 'Submitted final survey payment not found');
  if (payment.paymentVerification?.status !== 'submitted') throw new ApiError(409, 'This final payment proof is not waiting for Surveyor confirmation');
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 5 || reason.length > 1200) throw new ApiError(422, 'Enter a clear payment-proof correction reason between 5 and 1200 characters');
  const now = new Date();
  const previousValue = payment.toObject();
  payment.paymentVerification = {
    ...(payment.paymentVerification?.toObject?.() || payment.paymentVerification || {}),
    status: 'rejected',
    rejectedAt: now,
    rejectedBy: req.user._id,
    rejectionReason: reason,
    approvedAt: undefined,
    approvedBy: undefined,
    receiptConfirmedAt: undefined,
    receiptConfirmedBy: undefined,
    confirmationNote: undefined,
  };
  payment.updatedBy = req.user._id;
  await payment.save();
  project.status = 'awaiting_final_payment';
  project.workflowStage = 'approved';
  project.updatedBy = req.user._id;
  await project.save();
  await Promise.all([
    createNotification({
      user: project.client,
      title: 'Final payment proof needs an update',
      message: `${project.projectNumber}: ${reason.slice(0, 500)}`,
      category: 'payment',
      actionUrl: `/app/survey-projects/${project._id}`,
      metadata: { projectId: project._id, paymentId: payment._id, event: 'survey_final_payment_rejected' },
    }),
    writeAudit(req, {
      action: 'survey-final-payment:rejected',
      module: 'survey-projects',
      recordId: project._id,
      previousValue,
      updatedValue: { paymentId: payment._id, reason, rejectedAt: now },
    }),
  ]);
  emitRealtime('survey-projects', 'survey-final-payment-rejected', { _id: project._id, paymentId: payment._id, status: 'awaiting_final_payment' }, { users: [project.client, project.surveyor] });
  res.json({ success: true, data: await projectBundle(project, req), message: 'Payment proof returned to the landlord for correction' });
});

export const streamSurveyPaymentProof = asyncHandler(async (req, res) => {
  const { project } = await workflowProject(req);
  const payment = await Payment.findOne({ _id: req.params.paymentId, surveyProject: project._id, type: { $in: ['survey_final', 'survey_milestone'] } }).select('proofFile');
  if (!payment?.proofFile) throw new ApiError(404, 'Survey payment proof not found');
  const file = await DriveFile.findOne({ _id: payment.proofFile, status: 'active', 'relations.surveyProject': project._id }).select('+storageKey');
  if (!file) throw new ApiError(404, 'Survey payment proof not found');
  await sendStoredFile(req, res, file, { download: req.query.download === 'true' });
});

// Retain the prior route name for clients that have not refreshed yet, but
// enforce the v164 order: landlord review first, final payment next, then
// final report upload and property verification.
export const approveSurveyReport = reviewSurveyFieldwork;
