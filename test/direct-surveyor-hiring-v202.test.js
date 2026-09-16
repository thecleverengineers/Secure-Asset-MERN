import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v202 hides landlord job posting and exposes direct Surveyor hiring', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const defaults = read('server/src/services/platformDefaults.js');
  const configuration = read('server/src/services/platformConfiguration.js');
  const rbac = read('server/src/services/rbac.js');
  assert.match(shell, /'survey-projects', 'active-projects'/);
  assert.doesNotMatch(shell, /const landlordMenu = [^\n]*'survey-jobs'/);
  assert.doesNotMatch(shell, /const landlordMenu = [^\n]*'survey-quotations'/);
  assert.match(defaults, /appModule\('survey-projects', 'Manage Hired Surveyors'/);
  assert.match(defaults, /appModule\('active-projects', 'Active Projects'/);
  assert.match(configuration, /LANDLORD_RETIRED_SURVEY_MODULE_KEYS/);
  assert.match(rbac, /'survey-jobs': \{ admin: ADMIN_ACTIONS, surveyor: SURVEYOR_ACTIONS \}/);
  assert.match(rbac, /'survey-quotations': \{ admin: ADMIN_ACTIONS, surveyor: SURVEYOR_ACTIONS \}/);
});

test('v202 direct Surveyor hiring enforces the eight-step project gates', () => {
  const model = read('server/src/models/surveyor.js');
  const controller = read('server/src/controllers/surveyWorkflowController.js');
  const routes = read('server/src/routes/surveyWorkflowRoutes.js');
  const profile = read('src/app/pages/SurveyorPublicProfilePage.tsx');
  const marketplace = read('src/app/pages/app/SurveyJobMarketplacePage.tsx');
  const project = read('src/app/pages/app/SurveyProjectsWorkflowPage.tsx');
  assert.match(model, /hiringPath: \{ type: String, enum: \['marketplace', 'direct_surveyor'\]/);
  assert.match(model, /workflowType: \{ type: String, enum: \['marketplace', 'direct_surveyor'\]/);
  for (const marker of ['requestSurveyorQuote', 'respondSurveyorQuoteRequest', 'submitSurveyMilestonePayment', 'awaiting_first_payment', 'first_payment_submitted', 'awaiting_second_payment', 'second_payment_submitted', 'client_preview', 'fully_verified']) assert.match(controller + model, new RegExp(marker));
  assert.match(routes, /\/requests/);
  assert.match(routes, /\/requests\/:jobId\/respond/);
  assert.match(routes, /milestones\/:milestoneId\/payment/);
  assert.match(profile, /Request a quote/);
  assert.match(marketplace, />Accept</);
  assert.match(marketplace, />Reject</);
  for (const marker of ['Two-milestone budget', 'Secure check-in', 'Upload evidence', 'submitSurveyWorkflowMilestonePayment', 'Upload survey report', 'Accept milestone 2 payment']) assert.match(project, new RegExp(marker));
});
