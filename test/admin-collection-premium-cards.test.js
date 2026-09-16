import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('src/app/pages/app/SiteAdministrationPage.tsx', 'utf8');
const resourcePage = fs.readFileSync('src/app/pages/app/ResourcePage.tsx', 'utf8');

test('admin collections use the shared premium card system', () => {
  for (const resource of ['landlord-plans', 'area-units', 'seo-pages', 'home-carousel', 'home-sections']) {
    assert.match(source, new RegExp(`'${resource}'`), `${resource} definition is present`);
    assert.match(source, new RegExp(`['"]${resource}['"]:`), `${resource} has a visual card mapping`);
  }

  assert.match(source, /function PremiumCollectionCard\(/);
  assert.match(source, /<PremiumCollectionCard definition=\{definition\} row=\{row\}/);
  assert.match(source, /onEdit=\{\(\) => open\(row\)\}/);
  assert.match(source, /onRemove=\{\(\) => remove\(row\)\}/);
  assert.match(source, /linear-gradient\(135deg/);
  assert.match(source, /#0B5270/);
  assert.match(source, /label=\{active \? 'Active' : 'Inactive'\}/);
  assert.match(source, /row\.imageUrl, row\.mobileImageUrl, row\.ogImageUrl/);
  assert.match(source, /JSON\.parse\(row\.content\)/);
  assert.match(source, /clickToEdit=\{definition\.resource === 'landlord-plans'\}/);
  assert.match(source, /Click anywhere to edit plan/);
  assert.match(source, /aria-label=\{clickToEdit \? `Edit \$\{title\} landlord subscription plan`/);
  assert.match(source, /function LandlordPlanAccordion\(/);
  assert.match(source, /<AccordionSummary/);
  assert.match(source, /Capacity limits/);
  assert.match(source, /Edit and update plan/);
  assert.match(source, /Delete plan/);
  assert.match(source, /definition\.resource === 'landlord-plans' \? <Stack/);
  assert.match(resourcePage, /function LandlordPlanResourceAccordion\(/);
  assert.match(resourcePage, /module === 'landlord-plans' \? \(/);
  assert.match(resourcePage, /<LandlordPlanResourceAccordion/);
  assert.match(resourcePage, /canEdit=\{canEdit\}/);
  assert.match(resourcePage, /canDelete=\{canDelete\}/);
  assert.match(resourcePage, /onEdit=\{\(\) => openDialog\('edit', row\)\}/);
  assert.match(resourcePage, /onRemove=\{\(\) => remove\(row\)\}/);
  assert.match(resourcePage, /Edit and update plan/);
  assert.match(resourcePage, /Delete plan/);
});
