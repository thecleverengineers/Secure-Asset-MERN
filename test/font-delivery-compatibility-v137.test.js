import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fonts = readFileSync(new URL('../src/styles/fonts.css', import.meta.url), 'utf8');
const mobileHome = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
const legacyTitleTest = readFileSync(new URL('./property-title-open-sans-v132.test.js', import.meta.url), 'utf8');

test('font delivery has no remote stylesheet dependency', () => {
  assert.doesNotMatch(fonts, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(fonts, /font-family: "Open Sans", Arial, sans-serif;/);
});

test('legacy deployment checks remain compatible with the current mobile search and title behavior', () => {
  assert.match(mobileHome, /Start your search: property, area or city/);
  assert.doesNotMatch(legacyTitleTest, /fontWeight:\s*350|weight 350/);
  assert.match(legacyTitleTest, /legacy v132 title check accepts the current Open Sans default weight/);
});
