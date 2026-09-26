import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');

test('landlord My Survey Quotes is an active platform module',()=>{
  const defaults=read('server/src/services/platformDefaults.js');
  const config=read('server/src/services/platformConfiguration.js');
  assert.match(defaults,/appModule\('survey-jobs', 'My Survey Quotes'.*tenant, landlord/);
  assert.match(config,/LANDLORD_SIDEBAR_KEYS[\s\S]*'survey-jobs'/);
  assert.match(config,/LANDLORD_RETIRED_SURVEY_MODULE_KEYS = new Set\(\['survey-quotations'\]\)/);
});

test('landlord RBAC grants view access to survey-jobs',()=>{
  const rbac=read('server/src/services/rbac.js');
  assert.match(rbac,/\['survey-jobs','My Survey Quotes'.*'landlord'/);
  assert.match(rbac,/'survey-jobs': \{ admin: ADMIN_ACTIONS, landlord: VIEW_ONLY, surveyor: SURVEYOR_ACTIONS \}/);
});

test('ModulePage does not turn a valid landlord quote workspace into Access denied',()=>{
  const page=read('src/app/pages/app/ModulePage.tsx');
  assert.match(page,/module === 'survey-jobs' && hasLandlordFeatures/);
  assert.match(page,/module === 'survey-jobs' && hasLandlordFeatures\) return renderLazy\(<SurveyJobsWorkspacePage \/>\)/);
});
