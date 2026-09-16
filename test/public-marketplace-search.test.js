import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicRoutes = fs.readFileSync('server/src/routes/publicRoutes.js', 'utf8');
const controller = fs.readFileSync('server/src/controllers/publicController.js', 'utf8');
const api = fs.readFileSync('src/app/services/api.ts', 'utf8');
const frontLayout = fs.readFileSync('src/app/components/FrontLayout.tsx', 'utf8');
const routes = fs.readFileSync('src/app/routes.tsx', 'utf8');

test('public marketplace search route is rate-limited and does not require login', () => {
  assert.match(publicRoutes, /router\.get\('\/search',\s*searchLimiter,\s*searchPublicMarketplace\)/);
  assert.doesNotMatch(publicRoutes, /router\.get\('\/search'[^\n]*authenticate/);
  assert.match(api, /\/public\/search\?/);
});

test('public marketplace search covers all requested public result types and location fields', () => {
  for (const type of ['property', 'verified_rental', 'surveyor', 'trusted_seller', 'landlord', 'location']) {
    assert.match(controller, new RegExp(`['\"]${type}['\"]`), type);
  }
  for (const field of ['address.line1', 'address.city', 'address.state', 'address.country', 'map.locality', 'map.district']) {
    assert.match(controller, new RegExp(field.replace('.', '\\.'), 'i'), field);
  }
});

test('public mobile shell contains a fixed app header, bottom navigation and dedicated search page', () => {
  assert.match(frontLayout, /<AppBar[\s\S]*position="fixed"/);
  assert.match(frontLayout, /<BottomNavigation/);
  assert.match(frontLayout, /UniversalSearchDialog/);
  assert.match(routes, /path:\s*'search'/);
});
