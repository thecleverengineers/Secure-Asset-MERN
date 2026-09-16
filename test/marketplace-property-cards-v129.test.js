import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const marketplace = readFileSync(new URL('../src/app/pages/MarketplacePage.tsx', import.meta.url), 'utf8');
const listingCard = marketplace.slice(marketplace.indexOf('function ListingCard'), marketplace.indexOf('function MobileListingRail'));

test('marketplace cards keep landlord details private', () => {
  assert.doesNotMatch(listingCard, /owner|landlord/i);
});

test('marketplace cards use compact Open Sans pricing with rent and lease periods', () => {
  assert.match(marketplace, /property\.pricing\?\.leaseAmount \?\? property\.price/);
  assert.match(marketplace, /label: 'Lease amount'/);
  assert.match(marketplace, /period: '\/ year'/);
  assert.match(marketplace, /property\.pricing\?\.monthlyRent \?\? property\.price/);
  assert.match(marketplace, /label: 'Rent amount'/);
  assert.match(marketplace, /period: '\/ month'/);
  assert.match(listingCard, /fontFamily: '"Open Sans", Arial, sans-serif'/);
  assert.match(listingCard, /fontSize: compact \? 12\.5 : 13/);
});
