import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const propertyDetail = await readFile(new URL('../src/app/pages/PropertyDetailPage.tsx', import.meta.url), 'utf8');

test('v199 rental room grid keeps two mobile and four desktop cards per row', () => {
  assert.match(propertyDetail, /data-secureasset-room-grid="four-desktop-two-mobile-v199"/);
  assert.match(propertyDetail, /size=\{\{ xs: 6, sm: 6, md: 3 \}\}/);
});

test('v199 keeps room links, bottom pricing and locked booking behavior', () => {
  assert.match(propertyDetail, /onClick=\{\(\) => navigate\(`\/room_details\/\$\{unit\._id\}`\)\}/);
  assert.match(propertyDetail, /<Typography fontWeight=\{950\} noWrap title=\{roomTitle\}/);
  assert.match(propertyDetail, /money\(Number\(unit\.pricing\?\.monthlyRent \|\| 0\)\)/);
  assert.match(propertyDetail, /disabled=\{!canBook\}/);
  assert.match(propertyDetail, /\{locked \? 'Locked' : 'Book now'\}/);
});
