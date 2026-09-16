import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('property details uses the shared React Query cache and the compact image-first header', () => {
  const page = read('src/app/pages/app/PropertyDetailsPage.tsx');

  assert.match(page, /import \{ useQuery, useQueryClient \} from '@tanstack\/react-query'/);
  assert.match(page, /queryKey: \['property-tree', propertyId\] as const/);
  assert.match(page, /refetchInterval: 45_000/);
  assert.match(page, /queryClient\.setQueryData<PropertyTreeData>/);
  assert.match(page, /data-secureasset-property-mobile-workspace="mobile-property-workspace-v154"/);
  assert.doesNotMatch(page, /PropertyContextBanner/);
  assert.match(page, /data-secureasset-property-image-header="property-image-header-v155"/);
  assert.match(page, /data-secureasset-property-image-title="bottom-overlay-v155"/);
  assert.match(page, /data-secureasset-property-action-menu="three-dot-v155"/);
  assert.match(page, /Back to properties/);
  assert.match(page, /MoreVertRounded/);
  assert.match(page, /showContextBanner=\{false\}/);
  assert.match(page, /data-secureasset-property-inventory="mobile-cards-v154"/);
  assert.match(page, /<TableHead><TableRow>/);
  assert.match(page, /Availability status/);
});

test('property details keeps all management actions inside the three-dot dropdown and responsive promotion cards', () => {
  const page = read('src/app/pages/app/PropertyDetailsPage.tsx');

  for (const phrase of ['Visibility', 'Edit Property', 'Add Room / Flat / Apartment', 'Refresh', 'Room Numbers &amp; Spaces · Independent Unit Inventory', 'Add promotion']) {
    assert.ok(page.includes(phrase), `missing ${phrase}`);
  }
  assert.match(page, /data-secureasset-property-action-items="visibility-edit-add-refresh-v155"/);
  assert.match(page, /onVisibility=\{\(\) => void changePropertyVisibility/);
  assert.match(page, /fontFamily: '\"Open Sans\", Arial, sans-serif'/);
  assert.match(page, /fontWeight: '400 !important'/);
  assert.match(page, /data-secureasset-property-promotions="mobile-cards-v154"/);
  assert.match(page, /onDelete\(id, title\)/);
  assert.match(page, /inputProps=\{\{ 'aria-label': `Set \$\{display\(space\.name\)\} availability status` \}\}/);
});

test('property portfolio has a dedicated, touch-first mobile card', () => {
  const resource = read('src/app/pages/app/ResourcePage.tsx');
  const card = read('src/app/components/property/PropertyPortfolioMobileCard.tsx');

  assert.match(resource, /import PropertyPortfolioMobileCard/);
  assert.match(resource, /data-secureasset-property-mobile-list=\{module === 'properties' \? 'portfolio-v154' : undefined\}/);
  assert.match(resource, /module === 'properties' \? rows\.map\(\(row\) => <PropertyPortfolioMobileCard/);
  assert.match(card, /data-secureasset-property-mobile-card="portfolio-v154"/);
  assert.match(card, /Open property/);
  assert.match(card, /Price on request/);
  assert.match(card, /event\.stopPropagation\(\); onEdit\(\);/);
  assert.match(card, /aria-label=\{`Open \$\{title\} details`\}/);
});

test('property information uses reusable data blocks and mobile disclosure sections', () => {
  const primitives = read('src/app/components/property/PropertyWorkspacePrimitives.tsx');
  const resource = read('src/app/pages/app/ResourcePage.tsx');

  assert.match(primitives, /export function PropertyDataBlock/);
  assert.match(primitives, /export function PropertySectionHeader/);
  assert.match(primitives, /export function PropertyContextBanner/);
  assert.match(primitives, /property-data-block-v154/);
  assert.match(resource, /<PropertyDataBlock/);
  assert.match(resource, /<PropertySectionHeader/);
  assert.match(resource, /data-secureasset-property-detail-section="mobile-accordion-v154"/);
  assert.ok(resource.includes("gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }"));
  assert.match(resource, /previewFileName/);
});

test('the established sticky workspace header still provides global Ctrl/Cmd K search', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const search = read('src/app/components/layout/WorkspaceSearch.tsx');

  assert.match(shell, /<AppBar data-secureasset-app-header-theme="design-navigation-v160" position="fixed"/);
  assert.match(shell, /<WorkspaceSearch value=\{globalQuery\}/);
  assert.match(search, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(search, /event\.key\.toLowerCase\(\) === 'k'/);
  assert.match(search, /aria-keyshortcuts/);
});
