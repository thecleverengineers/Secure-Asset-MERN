import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const siteAdministration = readFileSync(new URL('../src/app/pages/app/SiteAdministrationPage.tsx', import.meta.url), 'utf8');
const resourcePage = readFileSync(new URL('../src/app/pages/app/ResourcePage.tsx', import.meta.url), 'utf8');
const publicPages = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');

test('homepage carousel uses secure image uploads instead of manual desktop and mobile URL fields', () => {
  assert.match(siteAdministration, /key:'imageUrl',label:'Desktop carousel image',type:'image'/);
  assert.match(siteAdministration, /key:'mobileImageUrl',label:'Mobile carousel image',type:'image'/);
  assert.match(siteAdministration, /allowManualInput=\{false\}/);
  assert.match(siteAdministration, /uploadSiteAsset\(file\)/);
  assert.doesNotMatch(siteAdministration, /label:'Desktop image URL'/);
  assert.doesNotMatch(siteAdministration, /label:'Mobile image URL'/);
  assert.match(resourcePage, /name:'imageUrl',label:'Desktop carousel image',type:'image'/);
  assert.match(resourcePage, /name:'mobileImageUrl',label:'Mobile carousel image',type:'image'/);
});

test('homepage carousel uses the uploaded mobile image at mobile breakpoints', () => {
  assert.match(publicPages, /component="picture"/);
  assert.match(publicPages, /media="\(max-width: 899px\)"/);
  assert.match(publicPages, /srcSet=\{slide\.mobileImageUrl\}/);
  assert.match(publicPages, /slide\?\.imageUrl \|\| slide\?\.mobileImageUrl/);
});
