import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('surveyor directory uses four desktop cards and two mobile cards', () => {
  const page = read('src/app/pages/SurveyorMarketplacePage.tsx');
  assert.match(page, /size=\{\{xs:6,sm:6,lg:3\}\}/);
});

test('surveyor card hierarchy is image then name then location and rating then actions', () => {
  const page = read('src/app/pages/SurveyorMarketplacePage.tsx');
  const image = page.indexOf('sa-surveyor-card-image-wrap');
  const name = page.indexOf('sa-surveyor-card-name-row');
  const location = page.indexOf('sa-surveyor-profile-location', name);
  const rating = page.indexOf('sa-surveyor-profile-rating', location);
  const actions = page.indexOf('sa-surveyor-card-actions', rating);
  assert.ok(image >= 0 && name > image && location > name && rating > location && actions > rating);
  assert.match(page, />Profile<\/Button>/);
  assert.match(page, />Quote<\/Button>/);
});

test('surveyor image uses ten percent border radius', () => {
  const css = read('src/styles/surveyor-marketplace-premium.css');
  assert.match(css, /\.sa-surveyor-card-image\{[^}]*border-radius:10%!important/);
});

test('quote card action opens the existing quote workflow', () => {
  const marketplace = read('src/app/pages/SurveyorMarketplacePage.tsx');
  const profile = read('src/app/pages/SurveyorPublicProfilePage.tsx');
  assert.match(marketplace, /\?quote=1/);
  assert.match(profile, /new URLSearchParams\(location\.search\)\.get\('quote'\)==='1'/);
  assert.match(profile, /void openRequest\(\)/);
});
