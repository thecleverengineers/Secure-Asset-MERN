import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { plainUser } from '../server/src/services/rbac.js';

const read = (file) => fs.readFileSync(file, 'utf8');

test('public property actions open dedicated tenant pages instead of modal-style resource pages', () => {
  const detail = read('src/app/pages/PropertyDetailPage.tsx');
  const routes = read('src/app/routes.tsx');
  assert.match(detail, /Book Now/);
  assert.match(detail, /\/app\/apply_property\/\$\{property\._id\}/);
  assert.match(detail, /\/app\/schedule_visit\/\$\{property\._id\}/);
  assert.match(routes, /apply_property\/:propertyId/);
  assert.match(routes, /schedule_visit\/:propertyId/);
});

test('tenant discovery sidebar is statically sectioned with the required property links', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  const rbac = read('server/src/services/rbac.js');
  for (const label of ['Browse Properties', 'Rent Properties', 'Lease Properties', 'Sales Properties', 'Saved Properties']) {
    assert.match(`${shell}\n${rbac}`, new RegExp(label));
  }
  assert.match(shell, /sectionLabel\(section\)/);
  assert.doesNotMatch(shell, /openSections/);
  assert.doesNotMatch(shell, /<Collapse/);
});

test('tenant dashboard is gated until the KYC form has been completed or submitted', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  assert.match(shell, /tenant-kyc\?required=dashboard/);
  assert.match(shell, /\['submitted', 'under_review', 'verified'\]/);
});

test('tenant KYC supports government identity, address proof, and passport-size photo uploads', () => {
  const page = read('src/app/pages/app/TenantKycPage.tsx');
  const model = read('server/src/models/propertyManagement.js');
  const controller = read('server/src/controllers/propertyManagementController.js');
  for (const phrase of ['Step A — Government Identity', 'Step B — Address Proof', 'Step C — Passport Size Photo', 'Upload Passport-Size Photograph']) {
    assert.match(page, new RegExp(phrase));
  }
  assert.match(model, /governmentIdentity/);
  assert.match(model, /addressProofDetails/);
  assert.match(model, /passportPhoto/);
  assert.match(controller, /Government identity, address proof and passport-size photograph are required/);
});

test('add property opens the dedicated add_property page and not the resource modal shortcut', () => {
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  const addPage = read('src/app/pages/app/AddPropertyPage.tsx');
  const wizard = read('src/app/components/property/PropertyFormWizard.tsx');
  const resource = read('src/app/pages/app/ResourcePage.tsx');
  const rbac = read('server/src/services/rbac.js');
  assert.match(modulePage, /module === 'add_property'/);
  assert.match(addPage, /layout="page"/);
  assert.match(wizard, /layout\?: 'dialog' \| 'page'/);
  assert.match(resource, /navigate\('\/app\/add_property'/);
  assert.doesNotMatch(rbac, /properties\?new=1/);
  assert.match(rbac, /\/app\/add_property/);
});

test('property status actions show clean status labels in the requested order', () => {
  const resource = read('src/app/pages/app/ResourcePage.tsx');
  const wizard = read('src/app/components/property/PropertyFormWizard.tsx');
  const requestedOrder = "['draft','pending_approval','available','partially_occupied','occupied','reserved','rented','sold','leased','maintenance','unavailable','archived']";
  assert.match(resource, /statuses: \['draft','pending_approval','available','partially_occupied','occupied','reserved','rented','sold','leased','maintenance','unavailable','archived'\]/);
  assert.match(wizard, /const statuses = \['draft', 'pending_approval', 'available', 'partially_occupied', 'occupied', 'reserved', 'rented', 'sold', 'leased', 'maintenance', 'unavailable', 'archived'\]/);
  assert.doesNotMatch(resource, /Set status:/);
  for (const label of ['Draft', 'Pending Approval', 'Available', 'Partially Occuped', 'Occupied', 'Reserved', 'Rented', 'Sold', 'Leased', 'Maintenance', 'Unavailable', 'Archidved']) {
    assert.match(`${resource}\n${wizard}`, new RegExp(label));
  }
  assert.ok(requestedOrder.includes('pending_approval'));
});


test('property view dialog exposes full grouped property details', () => {
  const resource = read('src/app/pages/app/ResourcePage.tsx');
  for (const phrase of ['PropertyFullDetailsView', 'Property Details', 'Utilities & Amenities', 'Legal Details', 'Media & Contacts']) {
    assert.match(resource, new RegExp(phrase));
  }
});

test('landlord capability gives a tenant owner-scoped My Listings and property CRUD routes', () => {
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  const resource = read('src/app/pages/app/ResourcePage.tsx');
  const shell = read('src/app/components/layout/AppShell.tsx');
  const rbac = read('server/src/services/rbac.js');
  const scope = read('server/src/services/scope.js');
  const api = read('src/app/services/api.ts');
  const controller = read('server/src/controllers/resourceController.js');
  const routes = read('server/src/routes/resourceRoutes.js');
  assert.match(modulePage, /LANDLORD_PROPERTY_MODULES/);
  assert.match(modulePage, /landlordPropertyRouteAllowed/);
  assert.match(modulePage, /module === 'my-listings'/);
  assert.match(resource, /resourceOverride\?: string/);
  assert.match(resource, /isMyListings/);
  assert.match(resource, /getMyListings/);
  assert.match(api, /export async function getMyListings/);
  assert.match(controller, /export const listOwnedProperties/);
  assert.match(controller, /owner: req\.user\._id, deletedAt: null/);
  assert.match(routes, /router\.get\('\/properties\/mine'/);
  assert.match(shell, /'my-listings': \{ key: 'my-listings', label: 'My Listings'/);
  assert.match(shell, /const landlordMenu = \['dashboard', \.\.\.LANDLORD_FEATURE_MENU_KEYS, 'documents'\]/);
  assert.match(rbac, /\['my-listings','My Listings'/);
  assert.match(rbac, /capability: 'landlord'/);
  assert.match(scope, /!user\.__capabilityScope/);
  assert.match(scope, /const account = plainUser\(user\)/);
  assert.match(scope, /activeMode: 'landlord', __capabilityScope: true/);
  assert.match(scope, /properties: \{ owner: uid, deletedAt: null \}/);
  assert.match(rbac, /export function plainUser\(user\)/);
  assert.match(rbac, /\.\.\.plainUser\(user\), activeMode: capabilityRole/);
});

test('hybrid capability scope preserves fields from hydrated user documents', () => {
  const snapshot = plainUser({ toObject: () => ({ _id: 'tenant-1', role: 'tenant', landlordEnabled: true }) });
  assert.deepEqual(snapshot, { _id: 'tenant-1', role: 'tenant', landlordEnabled: true });
});

test('property eye action opens a dedicated inventory details page', () => {
  const resource = read('src/app/pages/app/ResourcePage.tsx');
  const page = read('src/app/pages/app/PropertyDetailsPage.tsx');
  const routes = read('src/app/routes.tsx');
  const model = read('server/src/models/propertyManagement.js');
  const resources = read('server/src/services/resources.js');
  assert.match(resource, /function openRecord\(row: any\)/);
  assert.match(resource, /const clickable = Boolean\(row\?\._id\)/);
  assert.match(resource, /navigate\(`\/app\/property-details\/\$\{row\._id\}`\)/);
  assert.match(resource, /onClick=\{clickable \? open : undefined\}/);
  assert.match(resource, /role=\{clickable \? 'button' : undefined\}/);
  assert.match(resource, /ArrowOutwardRounded/);
  assert.match(resource, /Open \$\{recordLabel\(row\)\} details/);
  assert.match(routes, /property-details\/:propertyId/);
  assert.match(page, /getPropertyTree/);
  assert.match(page, /Independent Unit Inventory/);
  assert.match(page, /Room number.*Flat number.*Apartment number/);
  assert.match(page, /sold_out/);
  assert.match(resource, /Click to preview/);
  assert.match(resource, /Property image preview/);
  assert.doesNotMatch(resource, /Cover Image URL/);
  assert.match(model, /flatNumber: String/);
  assert.match(model, /'sold_out'/);
  assert.match(resources, /'flatNumber'/);
});

test('every resource record is keyboard and pointer clickable', () => {
  const resource = read('src/app/pages/app/ResourcePage.tsx');
  assert.match(resource, /data-secureasset-clickable-records="clickable-records-v70"/);
  assert.match(resource, /const clickable = Boolean\(row\?\._id\)/);
  assert.match(resource, /onClick=\{clickable \? open : undefined\}/);
  assert.match(resource, /onKeyDown=\{handleKeyDown\}/);
  assert.match(resource, /function recordLabel\(row: any\)/);
  assert.match(resource, /openDialog\('view', row\)/);
});

test('property details owns promotions, galleries and spaces with in-page CRUD actions', () => {
  const page = read('src/app/pages/app/PropertyDetailsPage.tsx');
  const resource = read('src/app/pages/app/ResourcePage.tsx');
  const shell = read('src/app/components/layout/AppShell.tsx');
  const propertyManagement = read('src/app/pages/app/PropertyManagementPage.tsx');
  const controller = read('server/src/controllers/propertyManagementController.js');
  assert.match(controller, /PropertyPromotion\.find\(\{ property: property\._id \}/);
  assert.match(controller, /const propertyMedia = await preparePropertyMediaPreviews\(media, property\._id\)/);
  for (const phrase of ['Property Promotions', 'Property Galleries', 'Room Numbers &amp; Spaces', 'Upload image', 'InlinePropertyEditor', 'Add promotion', 'deleteResource', 'onDeleteGallery']) {
    assert.match(`${page}\n${resource}`, new RegExp(phrase));
  }
  assert.doesNotMatch(page, /\/app\/(property-promotions|property-media|property-spaces)\?/);
  assert.doesNotMatch(page, /<UtilityReadingsPanel/);
  assert.doesNotMatch(`${shell}\n${propertyManagement}`, /\/app\/(property-promotions|property-media|property-spaces)/);
  assert.match(shell, /PROPERTY_DETAIL_ONLY_MENU_KEYS/);
});
