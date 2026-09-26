import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');

test('landlord workspace is direct quote tracking only',()=>{
  const page=read('src/app/pages/app/SurveyJobsWorkspacePage.tsx');
  assert.match(page,/title="My Survey Quotes"/);
  assert.match(page,/getMySurveyorQuoteRequests/);
  assert.match(page,/Request Quote/);
  assert.doesNotMatch(page,/Post survey job/i);
  assert.doesNotMatch(page,/createResource\('survey-jobs'/);
  assert.doesNotMatch(page,/Marketplace Survey Jobs/);
});

test('surveyor workspace shows only incoming direct quote requests',()=>{
  const page=read('src/app/pages/app/SurveyJobMarketplacePage.tsx');
  assert.match(page,/title="Quote Requests"/);
  assert.match(page,/getIncomingSurveyorQuoteRequests/);
  assert.match(page,/Review & Accept/);
  assert.match(page,/Reject Request/);
  assert.doesNotMatch(page,/getSurveyJobMarketplace/);
  assert.doesNotMatch(page,/Find Survey Jobs/i);
  assert.doesNotMatch(page,/Apply & propose/i);
});

test('quote ownership is enforced server side for both parties',()=>{
  const controller=read('server/src/controllers/surveyWorkflowController.js');
  assert.match(controller,/client: req\.user\._id, hiringPath: 'direct_surveyor'/);
  assert.match(controller,/requestedSurveyor: req\.user\._id, hiringPath: 'direct_surveyor'/);
  assert.match(controller,/SurveyJob\.findOne\(\{ _id: req\.params\.jobId, requestedSurveyor: req\.user\._id \}\)/);
});

test('accepted direct quote creates a secure project and exposes it to both sides',()=>{
  const controller=read('server/src/controllers/surveyWorkflowController.js');
  const landlordPage=read('src/app/pages/app/SurveyJobsWorkspacePage.tsx');
  const surveyorPage=read('src/app/pages/app/SurveyJobMarketplacePage.tsx');
  assert.match(controller,/createDirectSurveyProject\(\{ job, surveyorId: req\.user\._id, actorId: req\.user\._id \}\)/);
  assert.match(controller,/requestStatus = 'accepted'/);
  assert.match(landlordPage,/\/app\/survey-projects\/\$\{item\.project\._id\}/);
  assert.match(surveyorPage,/\/app\/survey-projects\/\$\{projectId\}/);
});

test('sidebar hides find-job wording and exposes quote-specific destinations',()=>{
  const shell=read('src/app/components/layout/AppShell.tsx');
  assert.match(shell,/'survey-job-marketplace': 'Quote Requests'/);
  assert.match(shell,/'survey-jobs': 'My Survey Quotes'/);
  assert.doesNotMatch(shell,/Quote Requests & Jobs/);
});

test('landlord is returned to My Survey Quotes after a rejection',()=>{
  const controller=read('server/src/controllers/surveyWorkflowController.js');
  assert.match(controller,/direct_survey_quote_rejected/);
  assert.match(controller,/actionUrl: '\/app\/survey-jobs'/);
});
