import test from 'node:test';
import assert from 'node:assert/strict';
import { serializePublicProperty, serializePublicRentalUnit, serializePublicSpace } from '../server/src/services/publicPropertySerialization.js';

const base = {
  _id: 'property-1', title: 'Private Address Test', description: 'A listing', type: 'house', purpose: 'rent', status: 'available',
  pricing: { monthlyRent: 15000 }, areas: { total: 1200, unit: 'sqft' },
  address: { line1: 'Secret house number', line2: 'Secret street', city: 'Dimapur', state: 'Nagaland', country: 'India', postalCode: '797112' },
  map: { latitude: 25.912345, longitude: 93.712345, approximateLatitude: 25.91, approximateLongitude: 93.71, locality: 'Locality', district: 'Dimapur' },
  location: { type: 'Point', coordinates: [93.712345, 25.912345] }, documents: ['secret-document'], manager: { email: 'manager@example.com' },
  owner: { _id: 'owner-1', name: 'Owner', phone: '9999999999', email: 'owner@example.com', avatar: '/avatar.jpg', kycStatus: 'verified' },
  createdBy: 'creator', updatedBy: 'updater', images: ['/photo.jpg'], amenities: ['Parking'],
};

test('approximate public property never exposes exact address, phone, email or documents', () => {
  const output = serializePublicProperty({ ...base, locationPrivacy: 'approximate_public' });
  assert.equal(output.address.line1, undefined);
  assert.equal(output.address.postalCode, undefined);
  assert.equal(output.map.latitude, 25.91);
  assert.equal(output.owner.phone, undefined);
  assert.equal(output.owner.email, undefined);
  assert.equal(output.documents, undefined);
  assert.equal(output.manager, undefined);
  assert.equal(output.area, 1200);
});

test('hidden location modes expose only broad location', () => {
  const output = serializePublicProperty({ ...base, locationPrivacy: 'after_visit_approval' });
  assert.equal(output.map.latitude, undefined);
  assert.equal(output.map.longitude, undefined);
  assert.equal(output.address.city, 'Dimapur');
});

test('exact public mode exposes coordinates only when explicitly selected', () => {
  const output = serializePublicProperty({ ...base, locationPrivacy: 'exact_public' });
  assert.equal(output.address.line1, 'Secret house number');
  assert.equal(output.map.latitude, 25.912345);
  assert.equal(output.map.longitude, 93.712345);
});

test('space serialization inherits public-safe property data', () => {
  const output = serializePublicSpace({ _id: 'room-1', name: 'Room 101', level: 'room', price: 5000, purpose: 'rent', status: 'available', property: { ...base, locationPrivacy: 'approximate_public' } });
  assert.equal(output.property.address.line1, undefined);
  assert.equal(output.owner.phone, undefined);
  assert.equal(output.title, 'Room 101 · Private Address Test');
});

test('public rental units expose room pricing and lock booked rooms without tenant data', () => {
  const available = serializePublicRentalUnit({ _id: 'room-available', roomNumber: '101', name: 'Room 101', availabilityStatus: 'AVAILABLE', pricing: { monthlyRent: 12000 } });
  const booked = serializePublicRentalUnit({ _id: 'room-booked', roomNumber: '102', name: 'Room 102', availabilityStatus: 'OCCUPIED', currentTenantId: 'tenant-secret', pricing: { monthlyRent: 13000 } });
  assert.equal(available.canBook, true);
  assert.equal(available.isLocked, false);
  assert.equal(available.pricing.monthlyRent, 12000);
  assert.equal(booked.canBook, false);
  assert.equal(booked.isLocked, true);
  assert.equal(booked.availabilityLabel, 'Locked — already booked');
  assert.equal(booked.currentTenantId, undefined);
});
