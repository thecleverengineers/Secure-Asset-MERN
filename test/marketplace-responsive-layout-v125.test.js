import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const marketplace = readFileSync(new URL('../src/app/pages/MarketplacePage.tsx', import.meta.url), 'utf8');

test('marketplace removes the old Property and Trust hero in favour of a compact property listing header', () => {
  assert.doesNotMatch(marketplace, /PROPERTY & TRUST MARKETPLACE/);
  assert.match(marketplace, /Available Properties for Rent/);
  assert.match(marketplace, /Find a verified home, commercial space or plot that fits your needs\./);
});

test('marketplace has responsive compact filters and a property-first card layout', () => {
  assert.match(marketplace, /const \[filtersOpen, setFiltersOpen\] = useState\(false\)/);
  assert.match(marketplace, /display: \{ xs: 'block', md: 'none' \}/);
  assert.match(marketplace, /display: \{ xs: 'none', md: 'block' \}/);
  assert.match(marketplace, /Featured properties/);
  assert.match(marketplace, /borderRadius: '20px'/);
});
