import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const propertyDetail = await readFile(new URL('../src/app/pages/PropertyDetailPage.tsx', import.meta.url), 'utf8');

test('v197 rental room cards use a clickable full-image marketplace layout', () => {
  assert.match(propertyDetail, /const roomImage = unit\.primaryImage\?\.url/);
  assert.match(propertyDetail, /height: \{ xs: 320, sm: 370 \}/);
  assert.match(propertyDetail, /position: 'absolute', inset: 0, background:/);
  assert.match(propertyDetail, /onClick=\{\(\) => navigate\(`\/room_details\/\$\{unit\._id\}`\)\}/);
  assert.match(propertyDetail, /<Typography fontWeight=\{950\} noWrap title=\{roomTitle\}/);
  assert.match(propertyDetail, /money\(Number\(unit\.pricing\?\.monthlyRent \|\| 0\)\)/);
});

test('v197 locked rental room cards remain viewable while booking is disabled', () => {
  assert.match(propertyDetail, /aria-label=\{`\$\{locked \? 'View locked details for' : 'View details for'\} \$\{roomTitle\}`\}/);
  assert.match(propertyDetail, /disabled=\{!canBook\}/);
  assert.match(propertyDetail, /\{locked \? 'Locked' : 'Book now'\}/);
  assert.match(propertyDetail, /Locked rooms stay visible for details but cannot be booked/);
});
