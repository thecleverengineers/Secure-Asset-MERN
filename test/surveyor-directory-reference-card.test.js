import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');

test('surveyor cards follow the cover-avatar-reference layout',()=>{
  const page=read('src/app/pages/SurveyorMarketplacePage.tsx');
  const css=read('src/styles/surveyor-marketplace-premium.css');
  const cover=page.indexOf('sa-surveyor-card-cover');
  const avatar=page.indexOf('sa-surveyor-card-avatar-wrap');
  const name=page.indexOf('sa-surveyor-card-name-row');
  const meta=page.indexOf('sa-surveyor-card-meta');
  const actions=page.indexOf('sa-surveyor-card-actions');
  assert.ok(cover>=0&&avatar>cover&&name>avatar&&meta>name&&actions>meta);
  assert.match(css,/\.sa-surveyor-card-cover\{height:92px/);
  assert.match(css,/\.sa-surveyor-card-avatar-wrap\{[^}]*border-radius:50%/);
  assert.match(css,/\.sa-surveyor-card-avatar\{[^}]*border-radius:50%/);
});

test('surveyor cards remain four desktop and two mobile with profile and quote actions',()=>{
  const page=read('src/app/pages/SurveyorMarketplacePage.tsx');
  assert.match(page,/size=\{\{xs:6,sm:6,lg:3\}\}/);
  assert.match(page,/>Profile<\/Button>/);
  assert.match(page,/>Quote<\/Button>/);
  assert.match(page,/sa-surveyor-profile-location/);
  assert.match(page,/sa-surveyor-profile-rating/);
});
