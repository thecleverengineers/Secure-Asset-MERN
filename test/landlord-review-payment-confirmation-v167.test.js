import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v167 records a complete landlord fieldwork decision before it creates or unlocks the final invoice', () => {
  const projectModel = read('server/src/models/surveyor.js');
  const paymentModel = read('server/src/models/index.js');
  const controller = read('server/src/controllers/surveyWorkflowController.js');
  const page = read('src/app/pages/app/SurveyProjectsWorkflowPage.tsx');

  for (const phrase of ['FieldworkReviewChecklistSchema', 'FieldworkReviewSchema', 'fieldworkReviewHistory', "'awaiting_landlord'", "'changes_requested'", 'measurementsReviewed', 'evidenceReviewed', 'scopeReviewed']) {
    assert.ok(projectModel.includes(phrase), `missing recorded fieldwork review contract: ${phrase}`);
  }
  for (const phrase of ['payerDeclaredAt', 'payerDeclaredBy', 'receiptConfirmedAt', 'receiptConfirmedBy', 'confirmationNote']) {
    assert.ok(paymentModel.includes(phrase), `missing two-person final payment record: ${phrase}`);
  }
  for (const phrase of ['requiredReviewChecklist', 'fieldworkReviewSnapshot', 'archiveActiveFieldworkReview', "project.fieldworkReview?.status !== 'approved'", 'payerDeclaration !== true', 'receiptConfirmed !== true', 'finalPaymentConfirmed', 'proofFile: undefined']) {
    assert.ok(controller.includes(phrase), `missing protected workflow gate: ${phrase}`);
  }
  for (const phrase of ['data-secureasset-landlord-review-desk="recorded-review-payment-v167"', 'Landlord review &amp; payment desk', 'Open recorded review', 'Approve fieldwork & create final invoice', 'Submit proof & declaration', 'Confirm receipt & unlock report']) {
    assert.ok(page.includes(phrase), `missing landlord action surface: ${phrase}`);
  }
});

test('v167 makes final-report availability depend on independent payment declaration and receipt confirmation', () => {
  const controller = read('server/src/controllers/surveyWorkflowController.js');
  const api = read('src/app/services/api.ts');
  const page = read('src/app/pages/app/SurveyProjectsWorkflowPage.tsx');

  assert.match(controller, /Final payment proof and landlord declaration submitted for Surveyor receipt confirmation/);
  assert.match(controller, /Final payment receipt confirmed\. The Surveyor can now upload the report\./);
  assert.match(controller, /A recorded landlord fieldwork approval is required before the final report can be uploaded/);
  assert.match(api, /receiptConfirmed\?: boolean; confirmationNote\?: string/);
  assert.match(api, /payerDeclaration: boolean/);
  assert.match(page, /The final report stays unavailable until a recorded landlord review, landlord payment declaration, and Surveyor receipt confirmation are all complete\./);
});

test('v167 applies Open Sans regular weight across every rendered browser surface', () => {
  const fonts = read('src/styles/fonts.css');
  const app = read('src/app/App.tsx');

  assert.match(fonts, /--sa-font-weight: 400;/);
  assert.match(fonts, /font-weight: var\(--sa-font-weight\) !important;/);
  assert.match(app, /fontWeightLight: 400, fontWeightRegular: 400, fontWeightMedium: 400, fontWeightBold: 400/);
});
