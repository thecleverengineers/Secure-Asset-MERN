import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const home = readFileSync(new URL('../src/app/pages/PublicPages.tsx', import.meta.url), 'utf8');
const wishlist = readFileSync(new URL('../src/app/pages/WishlistPage.tsx', import.meta.url), 'utf8');

test('home uses the compact property discovery layout instead of the oversized hero', () => {
  assert.match(home, /Find your next property/);
  assert.match(home, /Search verified homes, commercial spaces and public listings in one place\./);
  assert.match(home, /All properties/);
  assert.match(home, /borderRadius: '20px'/);
  assert.doesNotMatch(home, /minHeight: \{ xs: 560, md: 650 \}/);
});

test('homepage and wishlist property cards share the compact rounded treatment', () => {
  assert.match(home, /section\.type === 'featured_properties'[\s\S]*?borderRadius: '16px'/);
  assert.match(wishlist, /Saved properties/);
  assert.match(wishlist, /bgcolor: '#f5f7fa'/);
  assert.match(wishlist, /borderRadius: '16px'/);
  assert.match(wishlist, /size=\{\{ xs: 6, sm: 4, md: 3, xl: 2 \}\}/);
});
