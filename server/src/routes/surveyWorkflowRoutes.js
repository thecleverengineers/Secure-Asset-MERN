import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  acceptMilestone,
  approveMilestone,
  createMilestone,
  hireSurveyor,
  listSurveyorProposals,
  listSurveyProjects,
  getSurveyProject,
  checkInSurveyProject,
  checkOutSurveyProject,
  saveSurveyFieldwork,
  submitSurveyFieldworkForReview,
  reviewSurveyFieldwork,
  attachSurveyEvidence,
  removeSurveyEvidence,
  streamSurveyEvidence,
  attachSurveyReportFile,
  streamSurveyReportFile,
  acceptSurveyPayment,
  submitSurveyFinalPayment,
  submitSurveyMilestonePayment,
  rejectSurveyFinalPayment,
  streamSurveyPaymentProof,
  submitSurveyReport,
  requestSurveyRevision,
  approveSurveyReport,
  listLandlordSurveyJobs,
  listSurveyJobBids,
  listSurveyMarketplace,
  requestSurveyorQuote,
  listMyDirectSurveyQuoteRequests,
  listIncomingDirectSurveyQuoteRequests,
  respondSurveyorQuoteRequest,
  rejectMilestone,
  submitMilestone,
  updateMilestone,
} from '../controllers/surveyWorkflowController.js';

const router = Router();
router.use(authenticate);

router.get('/marketplace', listSurveyMarketplace);
router.get('/requests/mine', listMyDirectSurveyQuoteRequests);
router.get('/requests/incoming', listIncomingDirectSurveyQuoteRequests);
router.post('/requests', requestSurveyorQuote);
router.post('/requests/:jobId/respond', respondSurveyorQuoteRequest);
router.get('/jobs', listLandlordSurveyJobs);
router.get('/jobs/:jobId/bids', listSurveyJobBids);
router.post('/quotations/:quotationId/hire', hireSurveyor);

router.get('/proposals', listSurveyorProposals);
router.get('/projects', listSurveyProjects);
router.get('/projects/:projectId', getSurveyProject);
router.post('/projects/:projectId/check-in', checkInSurveyProject);
router.post('/projects/:projectId/check-out', checkOutSurveyProject);
router.post('/projects/:projectId/fieldwork', saveSurveyFieldwork);
router.post('/projects/:projectId/fieldwork/submit', submitSurveyFieldworkForReview);
router.post('/projects/:projectId/fieldwork/review', reviewSurveyFieldwork);
router.post('/projects/:projectId/evidence', attachSurveyEvidence);
router.delete('/projects/:projectId/evidence/:evidenceId', removeSurveyEvidence);
router.get('/projects/:projectId/files/:fileId/content', streamSurveyEvidence);
router.post('/projects/:projectId/report/file', attachSurveyReportFile);
router.get('/projects/:projectId/report/file/content', streamSurveyReportFile);
router.post('/projects/:projectId/payments/:paymentId/submit', submitSurveyFinalPayment);
router.post('/projects/:projectId/milestones/:milestoneId/payment', submitSurveyMilestonePayment);
router.post('/projects/:projectId/payments/:paymentId/reject', rejectSurveyFinalPayment);
router.get('/projects/:projectId/payments/:paymentId/proof/content', streamSurveyPaymentProof);
router.post('/projects/:projectId/report/submit', submitSurveyReport);
router.post('/projects/:projectId/report/revision', requestSurveyRevision);
router.post('/projects/:projectId/report/approve', approveSurveyReport);

router.post('/projects/:projectId/milestones', createMilestone);
router.patch('/projects/:projectId/milestones/:milestoneId', updateMilestone);
router.post('/projects/:projectId/milestones/:milestoneId/accept', acceptMilestone);
router.post('/projects/:projectId/milestones/:milestoneId/submit', submitMilestone);
router.post('/projects/:projectId/milestones/:milestoneId/approve', approveMilestone);
router.post('/projects/:projectId/milestones/:milestoneId/reject', rejectMilestone);
router.post('/projects/:projectId/payments/:paymentId/accept', acceptSurveyPayment);

export default router;
