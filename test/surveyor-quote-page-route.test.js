import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');

test('dedicated surveyor quote page is routed publicly',()=>{
  const routes=read('src/app/routes.tsx');
  assert.match(routes,/SurveyorQuotePage = lazyWithRetry/);
  assert.match(routes,/path: 'surveyor_quote\/:id', Component: SurveyorQuotePage/);
});

test('surveyor directory Quote button opens surveyor_quote page',()=>{
  const marketplace=read('src/app/pages/SurveyorMarketplacePage.tsx');
  assert.match(marketplace,/navigate\(\`\/surveyor_quote\/\$\{p\.publicSlug\|\|p\._id\}\`\)/);
  assert.doesNotMatch(marketplace,/\?quote=1/);
});

test('public surveyor profile quote action opens surveyor_quote page',()=>{
  const profile=read('src/app/pages/SurveyorPublicProfilePage.tsx');
  assert.match(profile,/navigate\(\`\/surveyor_quote\/\$\{data\.publicSlug\|\|id\}\`\)/);
});

test('surveyor quote page uses existing secure quote workflow',()=>{
  const page=read('src/app/pages/SurveyorQuotePage.tsx');
  assert.match(page,/getPublicSurveyor\(id\)/);
  assert.match(page,/getMyListings\(\{limit:100\}\)/);
  assert.match(page,/requestSurveyorQuote\(/);
  assert.match(page,/surveyorId:surveyor\.user/);
  assert.match(page,/Property to verify/);
  assert.match(page,/Survey purpose/);
  assert.match(page,/Send quote request/);
  assert.match(page,/\/login\?next=/);
});
