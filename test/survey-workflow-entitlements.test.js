import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DEFAULT_PLATFORM_MODULES } from '../server/src/services/platformDefaults.js';
import { RESOURCE_ACCESS, capabilityRolesForUser, defaultPermissionEntriesForRole } from '../server/src/services/rbac.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('landlord direct hiring and surveyor subscription capabilities expose the shared survey workflow', () => {
  const jobs = DEFAULT_PLATFORM_MODULES.find((item) => item.scope === 'app' && item.key === 'survey-jobs');
  const bids = DEFAULT_PLATFORM_MODULES.find((item) => item.scope === 'app' && item.key === 'survey-quotations');
  const projects = DEFAULT_PLATFORM_MODULES.find((item) => item.scope === 'app' && item.key === 'survey-projects');
  const activeProjects = DEFAULT_PLATFORM_MODULES.find((item) => item.scope === 'app' && item.key === 'active-projects');
  assert.ok(jobs?.accessRules.every((rule) => !rule.roles.includes('tenant') || !rule.modes.includes('landlord')));
  assert.ok(bids?.accessRules.every((rule) => !rule.roles.includes('tenant') || !rule.modes.includes('landlord')));
  assert.ok(projects?.accessRules.some((rule) => rule.roles.includes('tenant') && rule.modes.includes('landlord')));
  assert.ok(activeProjects?.accessRules.some((rule) => rule.roles.includes('tenant') && rule.modes.includes('landlord')));
  assert.equal(RESOURCE_ACCESS['survey-jobs'].landlord, undefined);
  assert.equal(RESOURCE_ACCESS['survey-quotations'].landlord, undefined);
  assert.ok(RESOURCE_ACCESS['survey-projects'].landlord.includes('approve'));
  assert.deepEqual(capabilityRolesForUser({ role: 'tenant', landlordEnabled: true, surveyorEnabled: true }), ['tenant', 'landlord', 'surveyor']);
  const surveyorPermissionKeys = new Set(defaultPermissionEntriesForRole('surveyor').map((entry) => entry.key));
  for (const key of [
    'surveyor-dashboard', 'surveyor-subscription', 'surveyor-verification', 'surveyor-profile',
    'survey-services', 'survey-job-marketplace', 'survey-jobs', 'survey-quotations', 'survey-projects',
    'site-visits', 'field-data', 'survey-reports', 'survey-equipment', 'survey-team', 'survey-clients',
    'payments', 'survey-reviews', 'survey-disputes', 'survey-promotions', 'documents', 'messages', 'notifications',
  ]) {
    assert.ok(surveyorPermissionKeys.has(`module:${key}`), `missing surveyor permission default for ${key}`);
  }
  assert.ok(defaultPermissionEntriesForRole('tenant').some((entry) => entry.key === 'module:my-property'));
});

test('survey workflow protects posting, bidding, hiring and milestone transitions server-side', () => {
  const defaults = read('server/src/controllers/resourceController.js');
  const controller = read('server/src/controllers/surveyWorkflowController.js');
  const service = read('server/src/services/surveyWorkflow.js');
  const routes = read('server/src/routes/surveyWorkflowRoutes.js');
  const model = read('server/src/models/surveyor.js');
  const payment = read('server/src/services/paymentLifecycle.js');
  assert.match(defaults, /resource === 'survey-jobs'[\s\S]*getActiveLandlordSubscription/);
  assert.match(defaults, /resource === 'survey-jobs'[\s\S]*return;\n  }\n  if \(!isSurveyorActor\(user\)\) return;/);
  assert.match(service, /Only the landlord who posted this job can hire a Surveyor/);
  assert.match(service, /assertSurveyorLimit\(quotation\.surveyor, 'jobs'\)/);
  assert.match(controller, /export const listSurveyMarketplace/);
  assert.match(controller, /export const createMilestone/);
  assert.match(controller, /export const approveMilestone/);
  assert.match(routes, /\/quotations\/:quotationId\/hire/);
  assert.match(routes, /\/projects\/:projectId\/milestones\/:milestoneId\/accept/);
  assert.match(routes, /\/projects\/:projectId\/milestones\/:milestoneId\/approve/);
  assert.match(routes, /\/projects\/:projectId\/milestones\/:milestoneId\/payment/);
  assert.match(controller, /export const requestSurveyorQuote/);
  assert.match(controller, /export const respondSurveyorQuoteRequest/);
  assert.match(controller, /directMilestoneForOrder/);
  assert.match(controller, /awaiting_first_payment/);
  assert.match(controller, /awaiting_second_payment/);
  assert.match(model, /hiringPath: \{ type: String, enum: \['marketplace', 'direct_surveyor'\]/);
  assert.match(model, /workflowType: \{ type: String, enum: \['marketplace', 'direct_surveyor'\]/);
  assert.match(model, /status: \{ type: String, enum: \['proposed', 'accepted', 'in_progress', 'submitted', 'approved', 'rejected', 'paid'/);
  assert.match(payment, /payment\.gateway\?\.milestoneId/);
});

test('landlord-surveyor chat includes quotation and hired-job relationships', () => {
  const messaging = read('server/src/services/messaging.js');
  assert.match(messaging, /SurveyQuotation/);
  assert.match(messaging, /hiredSurveyor/);
  assert.match(messaging, /row\.client.*row\.surveyor/);
});

test('frontend exposes direct Surveyor hiring and the canonical field workflow', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  const profile = read('src/app/pages/SurveyorPublicProfilePage.tsx');
  const marketplace = read('src/app/pages/app/SurveyJobMarketplacePage.tsx');
  const projects = read('src/app/pages/app/SurveyProjectsWorkflowPage.tsx');
  const api = read('src/app/services/api.ts');
  assert.match(shell, /'agreement-templates', 'survey-projects', 'active-projects'/);
  assert.doesNotMatch(shell, /const landlordMenu = [^\n]*'survey-jobs'/);
  assert.doesNotMatch(shell, /const landlordMenu = [^\n]*'survey-quotations'/);
  assert.match(profile, /Request a quote/);
  assert.match(profile, /requestSurveyorQuote/);
  assert.match(marketplace, /respondSurveyorQuoteRequest/);
  assert.match(marketplace, />Accept</);
  assert.match(marketplace, />Reject</);
  assert.match(projects, /Secure check-in/);
  assert.match(projects, /Upload evidence/);
  assert.match(projects, /Submit for landlord review/);
  assert.match(projects, /Review fieldwork/);
  assert.match(projects, /Submit final payment transaction/);
  assert.match(projects, /Request fieldwork revision/);
  assert.match(projects, /direct-surveyor-budget/);
  assert.match(projects, /submitSurveyWorkflowMilestonePayment/);
  assert.match(api, /getSurveyJobMarketplace/);
  assert.match(api, /requestSurveyorQuote/);
  assert.match(api, /respondSurveyorQuoteRequest/);
  assert.match(api, /submitSurveyWorkflowMilestonePayment/);
  assert.match(api, /checkInSurveyWorkflowProject/);
  assert.match(api, /submitSurveyWorkflowFieldwork/);
  assert.match(api, /reviewSurveyWorkflowFieldwork/);
  assert.match(api, /submitSurveyWorkflowFinalPayment/);
});
