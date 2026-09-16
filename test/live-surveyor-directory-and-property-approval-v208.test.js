import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v208 surveyor directory uses the live SurveyorProfile resource contract', () => {
  const marketplace = read('src/app/pages/SurveyorMarketplacePage.tsx');
  const api = read('src/app/services/api.ts');
  const resourcePage = read('src/app/pages/app/ResourcePage.tsx');
  const resourceController = read('server/src/controllers/resourceController.js');
  const resources = read('server/src/services/resources.js');
  const publicController = read('server/src/controllers/publicController.js');

  assert.match(marketplace, /data-secureasset-surveyor-directory="live-api-v208"/);
  assert.match(marketplace, /const DIRECTORY_PAGE_SIZE=50/);
  assert.match(marketplace, /getPublicSurveyors\(\{\.\.\.filters,page:next,limit:DIRECTORY_PAGE_SIZE\}\)/);
  assert.doesNotMatch(marketplace, /const\s+(surveyors|profiles|fallback)\s*=\s*\[/);
  assert.match(api, /getPublicSurveyors[\s\S]*cache: 'no-store'/);
  assert.match(api, /getResource[\s\S]*resource === 'surveyor-profiles'[\s\S]*cache: 'no-store'/);
  assert.match(resourcePage, /data-secureasset-surveyor-profile-source=\{module === 'surveyor-profiles' \? 'live-resource-api-v208' : undefined\}/);
  assert.match(resources, /'surveyor-profiles':\s*\{[\s\S]*model: SurveyorProfile/);
  assert.match(resourceController, /req\.params\.resource === 'surveyor-profiles'[\s\S]*Cache-Control/);
  assert.match(publicController, /setLiveDirectoryHeaders\(res\)/);
  assert.match(publicController, /SurveyorProfile\.find\(filter\)/);
});

test('v208 landlord property publication requires administrator approval', () => {
  const controller = read('server/src/controllers/resourceController.js');
  const model = read('server/src/models/index.js');
  const resources = read('server/src/services/resources.js');

  assert.match(model, /publicationStatus: \{ type: String, enum: \['draft', 'published', 'archived'\]/);
  assert.match(controller, /body\.publicationStatus = 'draft'; body\.publishedAt = undefined; body\.status = 'pending_approval'/);
  assert.match(controller, /Only an administrator can approve this property for marketplace publication/);
  assert.match(controller, /req\.user\.role === 'admin' && approvalStatuses\.has\(status\) && record\.visibility === 'public'/);
  assert.match(controller, /changes\.publicationStatus === 'published'[\s\S]*changes\.visibility = 'public'[\s\S]*changes\.publishedAt = new Date\(\)/);
  assert.match(resources, /properties:\s*\{[\s\S]*readRoles: \['admin', 'manager', 'landlord', 'tenant'\]/);
});
