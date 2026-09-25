import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');

test('landlord direct quote list is scoped to the current landlord',()=>{
  const controller=read('server/src/controllers/surveyWorkflowController.js');
  assert.match(controller,/export const listMyDirectSurveyQuoteRequests/);
  assert.match(controller,/client: req\.user\._id, hiringPath: 'direct_surveyor'/);
  assert.match(controller,/getActiveLandlordSubscription|requireLandlord/);
  assert.match(controller,/requestedSurveyor.*name avatar surveyorPlan surveyorEnabled/);
  assert.match(controller,/projectByJob/);
});

test('incoming Surveyor quote list is scoped to only the requested Surveyor',()=>{
  const controller=read('server/src/controllers/surveyWorkflowController.js');
  assert.match(controller,/export const listIncomingDirectSurveyQuoteRequests/);
  assert.match(controller,/requestedSurveyor: req\.user\._id, hiringPath: 'direct_surveyor'/);
  assert.match(controller,/select\('-exactLocation -contact -documents -photographs'\)/);
  assert.match(controller,/left\.requestStatus === 'pending'/);
});

test('quote request endpoints expose owned landlord and incoming Surveyor views',()=>{
  const routes=read('server/src/routes/surveyWorkflowRoutes.js');
  const api=read('src/app/services/api.ts');
  assert.match(routes,/router\.get\('\/requests\/mine', listMyDirectSurveyQuoteRequests\)/);
  assert.match(routes,/router\.get\('\/requests\/incoming', listIncomingDirectSurveyQuoteRequests\)/);
  assert.match(api,/getMySurveyorQuoteRequests/);
  assert.match(api,/getIncomingSurveyorQuoteRequests/);
});

test('landlord workspace shows My Quote Requests and accepted project',()=>{
  const page=read('src/app/pages/app/SurveyJobsWorkspacePage.tsx');
  assert.match(page,/My Quote Requests/);
  assert.match(page,/getMySurveyorQuoteRequests/);
  assert.match(page,/Waiting for Surveyor review/);
  assert.match(page,/Requested Surveyor:/);
  assert.match(page,/\/app\/survey-projects\/\$\{item\.project\._id\}/);
});

test('requested Surveyor can review accept or reject direct requests',()=>{
  const page=read('src/app/pages/app/SurveyJobMarketplacePage.tsx');
  assert.match(page,/Incoming Quote Requests/);
  assert.match(page,/getIncomingSurveyorQuoteRequests/);
  assert.match(page,/Review & Accept/);
  assert.match(page,/respondSurveyorQuoteRequest/);
  assert.match(page,/decision: 'accept'/);
  assert.match(page,/decision: 'reject'/);
});

test('landlord and Surveyor navigation exposes quote workflow',()=>{
  const shell=read('src/app/components/layout/AppShell.tsx');
  const quotePage=read('src/app/pages/SurveyorQuotePage.tsx');
  assert.match(shell,/label: 'My Survey Quotes'/);
  assert.match(shell,/Quote Requests & Jobs/);
  assert.match(quotePage,/View my quotes/);
  assert.match(quotePage,/navigate\('\/app\/survey-jobs'\)/);
});
