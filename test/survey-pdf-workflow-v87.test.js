import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('survey lifecycle follows the supplied workflow from posting through completion', () => {
  const models = read('server/src/models/surveyor.js');
  const properties = read('server/src/models/index.js');
  const controller = read('server/src/controllers/surveyWorkflowController.js');
  const routes = read('server/src/routes/surveyWorkflowRoutes.js');
  const payments = read('server/src/services/paymentLifecycle.js');
  assert.match(models, /\['draft', 'posted', 'applications', 'hired', 'in_progress', 'submitted', 'approved', 'completed', 'cancelled'\]/);
  assert.match(models, /verificationStatus: \{ type: String, enum: \['unverified', 'surveyed', 'field_verified', 'document_verified', 'fully_verified'\]/);
  assert.match(properties, /surveyVerificationStatus/);
  for (const path of ['check-in', 'check-out', 'fieldwork', 'fieldwork\/submit', 'fieldwork\/review', 'evidence', 'payments\/:paymentId\/submit', 'report\/file']) assert.match(routes, new RegExp(path));
  assert.match(controller, /CHECK_IN_RADIUS_METRES = 1000/);
  assert.match(controller, /advance payment must be secured before site check-in/);
  assert.match(controller, /Attach at least one photo, video, or document before requesting landlord review/);
  assert.match(controller, /Record at least one field measurement before requesting landlord review/);
  assert.match(controller, /notifySurveyAdmins/);
  assert.match(controller, /export const submitSurveyFieldworkForReview/);
  assert.match(controller, /export const reviewSurveyFieldwork/);
  assert.match(controller, /export const submitSurveyFinalPayment/);
  assert.match(controller, /surveyVerificationStatus: 'fully_verified'/);
  assert.match(controller, /isVerified: true/);
  assert.match(payments, /report_upload_requested/);
  assert.doesNotMatch(payments, /project\.workflowStage = 'completed'/);
});

test('new survey jobs are property-linked, complete, and owner-scoped', () => {
  const resource = read('server/src/controllers/resourceController.js');
  const jobs = read('src/app/pages/app/SurveyJobsWorkspacePage.tsx');
  assert.match(resource, /Choose one of your properties before posting a survey job/);
  assert.match(resource, /owner: user\._id/);
  assert.match(resource, /Add an exact map pin to this property/);
  assert.match(resource, /Preferred visit date and report deadline are required/);
  assert.match(resource, /Add at least one survey requirement/);
  assert.match(jobs, /getMyListings/);
  assert.match(jobs, /Compare experience, rating, portfolio, distance, price, and dates/);
  assert.match(jobs, /Chat \/ negotiate/);
  assert.match(jobs, /Hire Surveyor/);
});

test('surveyor workspace contains only PDF workflow destinations', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const modules = read('src/app/pages/app/ModulePage.tsx');
  const configuration = read('server/src/services/platformConfiguration.js');
  assert.match(shell, /const surveyorMenu = \['surveyor-dashboard', 'survey-job-marketplace', 'survey-quotations', 'survey-projects', 'surveyor-profile', 'surveyor-verification'\]/);
  assert.match(shell, /Find Survey Jobs/);
  assert.match(shell, /My Proposals/);
  assert.match(shell, /Active Projects/);
  assert.match(modules, /RETIRED_SURVEYOR_MODULES/);
  assert.match(configuration, /SURVEYOR_WORKFLOW_MODULE_KEYS/);
  assert.match(configuration, /effectiveRole === 'surveyor' && !SURVEYOR_WORKFLOW_MODULE_KEYS\.has/);
});

test('project UI keeps navigation, secure evidence, report and payment together', () => {
  const page = read('src/app/pages/app/SurveyProjectsWorkflowPage.tsx');
  const marketplace = read('src/app/pages/app/SurveyJobMarketplacePage.tsx');
  const proposals = read('src/app/pages/app/SurveyProposalsPage.tsx');
  const routes = read('src/app/routes.tsx');
  const workflowController = read('server/src/controllers/surveyWorkflowController.js');
  for (const marker of ['Navigate', 'Secure check-in', 'Add field data', 'Upload evidence', 'Submit for landlord review', 'Review fieldwork', 'Submit final payment transaction', 'Upload final report', 'Payment']) assert.match(page, new RegExp(marker));
  assert.doesNotMatch(page, /Audit trail/);
  assert.doesNotMatch(page, /project\.audit/);
  assert.doesNotMatch(workflowController, /data\.audit\s*=|AuditLog\.find\(\{ recordId:/);
  assert.match(page, /fetchSurveyWorkflowEvidence/);
  assert.match(page, /window\.open\(url/);
  assert.match(marketplace, /distanceKm/);
  assert.match(marketplace, /Apply & propose/);
  assert.match(marketplace, /myProposal/);
  assert.match(proposals, /Open active project/);
  assert.match(routes, /survey-projects\/:projectId/);
});
