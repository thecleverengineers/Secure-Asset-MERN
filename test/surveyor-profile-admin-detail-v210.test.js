import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v210 opens surveyor records in a live admin profile workspace', () => {
  const routes = read('src/app/routes.tsx');
  const resourcePage = read('src/app/pages/app/ResourcePage.tsx');
  const profilePage = read('src/app/pages/app/SurveyorProfileAdminPage.tsx');
  const api = read('src/app/services/api.ts');
  const controller = read('server/src/controllers/resourceController.js');

  assert.match(routes, /SurveyorProfileAdminPage = lazyWithRetry\(\(\) => import\('\.\/pages\/app\/SurveyorProfileAdminPage'\)\)/);
  assert.match(routes, /path: 'surveyor-profiles\/:id', Component: SurveyorProfileAdminPage/);
  assert.match(resourcePage, /module === 'surveyor-profiles' && row\?\._id[\s\S]*navigate\(`\/app\/surveyor-profiles\//);
  assert.match(profilePage, /data-secureasset-surveyor-admin-profile="live-detail-v210"/);
  assert.match(profilePage, /getResourceById\('surveyor-profiles', id\)/);
  assert.match(profilePage, /updateResource\('surveyor-profiles', id, profilePayload\(draft\)\)/);
  assert.match(profilePage, /changeResourceStatus\('surveyor-profiles', id, status\)/);
  assert.match(profilePage, /reviewSurveyorVerification\(verification\._id/);
  assert.match(profilePage, /deleteResource\('surveyor-profiles', id\)/);
  assert.match(api, /const live = resource === 'surveyor-profiles';[\s\S]*cache: 'no-store'/);
  assert.match(controller, /for \(const field of \['user', 'surveyor', 'profile', 'project', 'hiredSurveyor', 'requestedSurveyor'\]/);
});
