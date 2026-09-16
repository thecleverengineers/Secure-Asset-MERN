import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [marketplace, propertyDetail, routes, propertyUrl, model, serializer, publicController, siteController, resourceController, publicPages] = await Promise.all([
  read('src/app/pages/MarketplacePage.tsx'),
  read('src/app/pages/PropertyDetailPage.tsx'),
  read('src/app/routes.tsx'),
  read('src/app/utils/propertyUrl.ts'),
  read('server/src/models/index.js'),
  read('server/src/services/publicPropertySerialization.js'),
  read('server/src/controllers/publicController.js'),
  read('server/src/controllers/siteController.js'),
  read('server/src/controllers/resourceController.js'),
  read('src/app/pages/PublicPages.tsx'),
]);

test('v198 property cards open the property overview slug route', () => {
  assert.match(propertyUrl, /export function propertyNameSlug/);
  assert.match(propertyUrl, /\/marketplace\/property_overview\/\$\{encodeURIComponent/);
  assert.match(marketplace, /onClick=\{\(\) => navigate\(propertyOverviewPath\(property\)\)\}/);
  assert.match(propertyDetail, /const \{ id = '', slug = '' \} = useParams\(\);/);
  assert.match(propertyDetail, /publicPropertyQueryOptions\(slug \|\| id\)/);
  assert.match(publicPages, /navigate\(propertyOverviewPath\(property\)\)/);
});

test('v198 keeps the legacy property ID route while prioritising slug routes', () => {
  const slugRoute = routes.indexOf("{ path: 'marketplace/property_overview/:slug'");
  const legacyRoute = routes.indexOf("{ path: 'marketplace/:id'");
  assert.ok(slugRoute >= 0 && legacyRoute > slugRoute);
  assert.match(routes, /marketplace\/property_overview\/:slug/);
  assert.match(routes, /marketplace\/:id/);
});

test('v198 persists and resolves unique public property slugs server-side', () => {
  assert.match(model, /slug: \{ type: String, unique: true, sparse: true/);
  assert.match(serializer, /export function publicPropertySlug/);
  assert.match(serializer, /slug: doc\.slug \|\| publicPropertySlug\(doc\.title\)/);
  assert.match(publicController, /publicPropertyFilter\(isId \? \{ _id: identifier \} : \{ slug: identifier \}\)/);
  assert.match(publicController, /href: `\/marketplace\/property_overview\/\$\{encodeURIComponent\(publicPropertySlug/);
  assert.match(siteController, /Property\.findOne\(\{ \.\.\.\(isId \? \{ _id: identifier \} : \{ slug: identifier \}/);
  assert.match(resourceController, /async function uniquePropertySlug/);
  assert.match(resourceController, /body\.slug = await uniquePropertySlug\(body\.title \|\| body\.code\)/);
  assert.match(resourceController, /if \(changes\.title !== undefined \|\| !record\.slug\) changes\.slug = await uniquePropertySlug/);
});
