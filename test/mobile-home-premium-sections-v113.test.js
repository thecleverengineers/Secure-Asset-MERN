import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('mobile homepage renders the requested premium section order and destinations', () => {
  const source = read('src/app/pages/PublicPages.tsx');
  assert.ok(source.indexOf('<MobileHomeCarousel') < source.indexOf('<MobileCoreFeatures'));
  assert.ok(source.indexOf('<MobileCoreFeatures') < source.indexOf('<MobileFeaturedProperties'));
  assert.ok(source.indexOf('<MobileFeaturedProperties') < source.indexOf('<MobileVerifiedSurveyors'));
  assert.ok(source.indexOf('<MobileVerifiedSurveyors') < source.indexOf('<MobileAccountCta'));
  for (const path of ['/app/documents', '/app/my-property', '/app/properties', '/app/rentals', '/surveyors', '/app/survey-projects']) assert.match(source, new RegExp(path.replaceAll('/', '\\/')));
  assert.match(source, /Grid size=\{\{ xs: 6 \}\}/);
  assert.match(source, /navigate\(propertyOverviewPath\(property\)\)/);
});
