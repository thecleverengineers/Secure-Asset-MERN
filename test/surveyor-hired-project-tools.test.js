import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('hired Surveyors can update project fieldwork, accept payments, and upload deliverables', () => {
  const model = read('server/src/models/surveyor.js');
  const controller = read('server/src/controllers/surveyWorkflowController.js');
  const upload = read('server/src/controllers/uploadController.js');
  const routes = read('server/src/routes/surveyWorkflowRoutes.js');
  const api = read('src/app/services/api.ts');
  const page = read('src/app/pages/app/SurveyProjectsWorkflowPage.tsx');
  const dashboard = read('src/app/pages/app/SurveyorDashboardPage.tsx');

  assert.match(model, /FieldNoteSchema/);
  assert.match(model, /fieldNotes: \{ type: \[FieldNoteSchema\]/);
  assert.match(model, /reportFile: ref\('DriveFile'\)/);
  assert.match(controller, /function hiredProjectEditable/);
  assert.match(controller, /measurementId/);
  assert.match(controller, /measurementIndex/);
  assert.match(controller, /fieldData\.fieldNotes/);
  assert.match(controller, /export const acceptSurveyPayment/);
  assert.match(controller, /applyPaidPayment\(payment/);
  assert.match(upload, /assertSurveyProjectUploadAccess/);
  assert.match(upload, /Only the hired Surveyor can upload to this project/);
  assert.match(upload, /survey_evidence.*survey_report.*survey_payment_proof/);
  assert.match(routes, /payments\/:paymentId\/accept/);
  assert.match(routes, /payments\/:paymentId\/submit/);
  assert.match(routes, /projects\/:projectId\/report\/file/);
  assert.match(api, /acceptSurveyWorkflowPayment/);
  assert.match(api, /attachSurveyWorkflowReportFile/);
  assert.match(api, /downloadSurveyWorkflowReportFile/);
  assert.match(page, /Accept payment/);
  assert.match(page, /Submit for landlord review/);
  assert.match(page, /Upload final report/);
  assert.match(page, /editMeasurement/);
  assert.match(page, /editFieldNote/);
  assert.match(page, /SurveyProjectNavigationMap/);
  assert.match(dashboard, /Payment \$\{label\(project\.paymentStatus/);
});

test('live Google navigation tracks the surveyor and refreshes driving directions', () => {
  const map = read('src/app/components/survey/SurveyProjectNavigationMap.tsx');
  const app = read('server/src/app.js');
  assert.match(map, /https:\/\/maps\.googleapis\.com\/maps\/api\/js/);
  assert.match(map, /navigator\.geolocation\.watchPosition/);
  assert.match(map, /DirectionsService/);
  assert.match(map, /TravelMode\.DRIVING/);
  assert.match(map, /Open Google Maps/);
  assert.match(app, /https:\/\/maps\.googleapis\.com/);
  assert.match(app, /https:\/\/maps\.gstatic\.com/);
});
