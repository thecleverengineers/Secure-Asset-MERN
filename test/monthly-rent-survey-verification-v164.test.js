import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v164 enforces the landlord-review, payment-proof, final-report verification sequence', () => {
  const model = read('server/src/models/surveyor.js');
  const payments = read('server/src/models/index.js');
  const controller = read('server/src/controllers/surveyWorkflowController.js');
  const routes = read('server/src/routes/surveyWorkflowRoutes.js');
  const upload = read('server/src/controllers/uploadController.js');
  const lifecycle = read('server/src/services/paymentLifecycle.js');
  const api = read('src/app/services/api.ts');

  for (const status of ['awaiting_landlord_review', 'awaiting_final_payment', 'payment_submitted', 'report_upload_requested']) assert.ok(model.includes(status), `missing secure workflow status: ${status}`);
  assert.match(payments, /proofFile: objectId\('DriveFile'\)/);
  for (const exportName of ['submitSurveyFieldworkForReview', 'reviewSurveyFieldwork', 'submitSurveyFinalPayment', 'streamSurveyPaymentProof']) assert.match(controller, new RegExp(`export const ${exportName}`));
  assert.match(controller, /paymentVerification\?\.status !== 'submitted'/);
  assert.match(controller, /All outstanding survey charges, including the final payment, must be confirmed before report upload/);
  assert.match(controller, /isVerified: true/);
  assert.match(controller, /surveyVerificationStatus: 'fully_verified'/);
  assert.match(controller, /consolidatePendingSurveyCharges/);
  assert.match(routes, /fieldwork\/submit/);
  assert.match(routes, /fieldwork\/review/);
  assert.match(routes, /payments\/:paymentId\/submit/);
  assert.match(routes, /payments\/:paymentId\/proof\/content/);
  assert.match(upload, /survey_payment_proof/);
  assert.match(upload, /Final payment proof must be an image screenshot/);
  assert.match(lifecycle, /report_upload_requested/);
  assert.doesNotMatch(lifecycle, /isVerified: true/);
  assert.match(api, /submitSurveyWorkflowFinalPayment/);
  assert.match(api, /fetchSurveyWorkflowPaymentProof/);
});

test('v164 moves evidence actions into a compact three-dot menu without exposing payment proof IDs', () => {
  const page = read('src/app/pages/app/SurveyProjectsWorkflowPage.tsx');
  const controller = read('server/src/controllers/surveyWorkflowController.js');

  assert.match(page, /data-secureasset-survey-evidence-actions="three-dot-v164"/);
  assert.match(page, /<MoreVertRounded/);
  for (const action of ['Preview', 'Download', 'Delete']) assert.match(page, new RegExp(`>${action}<`));
  assert.match(page, /data-secureasset-survey-workflow="field-review-payment-report-v164"/);
  assert.match(page, /Submit final survey payment/);
  assert.match(page, /Upload payment screenshot/);
  assert.match(controller, /proofSubmitted: Boolean\(payment\.proofFile\)/);
  assert.match(controller, /proofFile: undefined/);
});
