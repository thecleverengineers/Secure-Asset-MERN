import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v166 gives every survey participant one clear, gated next action', () => {
  const page = read('src/app/pages/app/SurveyProjectsWorkflowPage.tsx');
  const controller = read('server/src/controllers/surveyWorkflowController.js');
  const routes = read('server/src/routes/surveyWorkflowRoutes.js');
  const api = read('src/app/services/api.ts');

  assert.match(page, /data-secureasset-survey-version="guided-journey-v166"/);
  assert.match(page, /data-secureasset-survey-journey="field-review-payment-report-v166"/);
  assert.match(page, /const surveyJourneySteps = \[/);
  for (const step of ['Field data & evidence', 'Landlord review', 'Final payment proof', 'Surveyor confirmation', 'Final report upload', 'Property verified']) assert.match(page, new RegExp(step));
  assert.match(page, /Survey journey/);
  assert.match(page, /YOUR NEXT STEP/);
  assert.match(page, /fontFamily: '\"Open Sans\", Arial, sans-serif'/);
  assert.match(page, /Return proof with reason/);
  assert.match(page, /Correct & resubmit payment proof/);
  assert.match(page, /Return payment proof/);

  assert.match(controller, /export const rejectSurveyFinalPayment/);
  assert.match(controller, /status: 'rejected'/);
  assert.match(controller, /project\.status = 'awaiting_final_payment'/);
  assert.match(controller, /rejectionReason: payment\.paymentVerification\.rejectionReason/);
  assert.match(routes, /payments\/:paymentId\/reject/);
  assert.match(api, /rejectSurveyWorkflowFinalPayment/);
});

test('v166 retains the owner-safe port-5000 and PM2 release handoff', () => {
  const deploy = read('scripts/deploy-production.sh');
  const repair = read('scripts/repair-auth-routing.sh');
  const listener = read('scripts/reconcile-http-listener.js');

  assert.match(deploy, /SECUREASSET_PORT_HANDOFF_CONTRACT="v166-safe-pm2-port-5000"/);
  assert.ok(deploy.indexOf('reconcile-http-listener.js --status') < deploy.indexOf('reconcile-pm2-release.js --stop'));
  assert.ok(deploy.indexOf('reconcile-pm2-release.js --stop') < deploy.indexOf('reconcile-http-listener.js --clear'));
  assert.ok(deploy.indexOf('reconcile-http-listener.js --clear') < deploy.indexOf('pm2 startOrReload "$APP_DIR/ecosystem.config.cjs" --env production --update-env'));
  assert.ok(deploy.indexOf('pm2 startOrReload "$APP_DIR/ecosystem.config.cjs" --env production --update-env') < deploy.indexOf('reconcile-http-listener.js --verify-pm2'));
  assert.match(repair, /reconcile-http-listener\.js --status/);
  assert.match(listener, /Refusing to stop a non-SecureAsset process/);
  assert.match(listener, /process\.kill\(listener\.pid, 'SIGTERM'\)/);
  assert.match(listener, /process\.kill\(listener\.pid, 'SIGKILL'\)/);
});
