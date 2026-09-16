import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLATFORM_MODULES } from '../server/src/services/platformDefaults.js';
import { resources } from '../server/src/services/resources.js';
import { serializePublicProperty, serializePublicSpace } from '../server/src/services/publicPropertySerialization.js';

const appModules = DEFAULT_PLATFORM_MODULES.filter((module) => module.scope === 'app');
const byKey = new Map(appModules.map((module) => [module.key, module]));

test('admin workspace contains the requested management sections in order', () => {
  const expected = [
    ['users', 'User Management', 'user_management'],
    ['properties', 'Property Management', 'property_management'],
    ['rental-invoices', 'Rent Management', 'rent_management'],
    ['leases', 'Lease Management', 'lease_management'],
    ['property-sales', 'Property Sales Management', 'sales_management'],
    ['payments', 'Track All Payments', 'payments'],
    ['subscriptions', 'Manage Subscriptions', 'subscriptions'],
    ['surveyor-profiles', 'Manage Surveyors', 'surveyors'],
    ['landlords', 'Manage Landlords', 'landlords'],
    ['messages', 'Messages', 'communications'],
    ['site-enquiries', 'Website Inquiries', 'communications'],
    ['complaints', 'Complaint & Maintenance', 'complaints'],
    ['tenants', 'Manage Tenants', 'tenant_management'],
    ['applications', 'Tenant Applications', 'applications'],
    ['tenancies', 'Active Tenancy', 'tenancy'],
  ];
  for (const [key, label, section] of expected) {
    const module = byKey.get(key);
    assert.ok(module, `${key} should exist in admin workspace defaults`);
    assert.equal(module.label, label);
    assert.equal(module.section, section);
    assert.ok(module.accessRules.some((rule) => rule.roles.includes('admin')), `${key} should be accessible to admin`);
  }
  const ordered = expected.map(([key]) => byKey.get(key).sectionOrder);
  assert.deepEqual([...ordered].sort((a, b) => a - b), ordered);
  assert.equal(byKey.has('property-spaces'), false);
  assert.equal(byKey.has('property-media'), false);
  assert.equal(byKey.has('property-promotions'), false);
});

test('settings menu contains the requested dropdown items', () => {
  const settingsItems = ['drive-admin','security','site-admin','platform-modules','content-pages','integration-settings','site-settings','notification-preferences','seo-pages','home-carousel','home-sections','property-type-configs','area-units'];
  for (const key of settingsItems) {
    const module = byKey.get(key);
    assert.ok(module, `${key} should be present`);
    assert.equal(module.section, 'settings');
  }
});

test('rent lease and sale management resources support payment cycles, whatsapp reminders and sale payments', () => {
  assert.ok(resources['rental-invoices'].writable.includes('paymentCycle'));
  assert.ok(resources['rental-invoices'].writable.includes('whatsappReminderEnabled'));
  assert.ok(resources.leases.writable.includes('paymentCycle'));
  assert.ok(resources.leases.writable.includes('legalAgreement'));
  assert.ok(resources.payments.writable.includes('type'));
});

test('public tenant view exposes property specifications, exact map, room numbers and area unit conversions', () => {
  const property = serializePublicProperty({
    _id: 'property-1', title: 'Tenant Visible Home', description: 'Public listing', type: 'apartment', status: 'available', purpose: 'rent',
    visibility: 'public', publicationStatus: 'published', locationPrivacy: 'exact_public',
    address: { line1: 'Exact address', city: 'Dimapur', state: 'Nagaland', country: 'India' },
    map: { latitude: 25.9, longitude: 93.7, googleMapsLocation: 'https://maps.google.com/?q=25.9,93.7' },
    specifications: { bedrooms: 3, bathrooms: 2, balconies: 1, numberOfFloors: 4, floorNumber: 2, builtUpAreaSqm: 111.48, carpetAreaSqm: 92.9, ownershipType: 'freehold', furnishingStatus: 'semi_furnished', facing: 'east' },
    areas: { builtUp: 1200, carpet: 1000, unit: 'sqft' },
  });
  assert.equal(property.specifications.bedrooms, 3);
  assert.equal(property.areas.builtUpSqft, 1200);
  assert.equal(property.areas.builtUpSqm, 111.48);
  assert.equal(property.map.latitude, 25.9);
  assert.equal(property.map.googleMapsLocation, 'https://maps.google.com/?q=25.9,93.7');

  const space = serializePublicSpace({ _id: 'room-1', property: { ...property, owner: null }, level: 'room', name: 'Room 101', code: '101', roomNumber: '101', apartmentNumber: 'A-1', status: 'available', purpose: 'rent', price: 8000, visibility: 'public', publicationStatus: 'published' });
  assert.equal(space.roomNumber, '101');
  assert.equal(space.apartmentNumber, 'A-1');
  assert.equal(space.galleryScope, 'room');
});
