import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('public mobile navigation opens a compact property discovery home', () => {
  const layout = read('src/app/components/FrontLayout.tsx');
  const home = read('src/app/pages/PublicPages.tsx');
  assert.match(layout, /const headerColor = design\.colors\?\.navigation \|\| '#0B5270'/);
  assert.match(layout, /label="Home"/);
  assert.match(layout, /label="Explore"/);
  assert.match(layout, /label="Wishlist"/);
  assert.match(layout, /label="Login"/);
  assert.match(home, /Start your search/);
  assert.match(home, /Find your next property/);
  assert.match(home, /MobileFeaturedProperties/);
  assert.match(home, /borderRadius: '20px'/);
});

test('tenant mobile navigation exposes Home, Explore, Vault, Wishlist, and Profile', () => {
  const shell = read('src/app/components/layout/AppShell.tsx');
  assert.match(shell, /user\?\.role === 'tenant'/);
  assert.match(shell, /path: '\/marketplace', icon: ExploreRounded/);
  assert.match(shell, /path: '\/app\/documents', icon: FolderRounded/);
  assert.match(shell, /path: '\/app\/wishlist', icon: FavoriteRounded/);
  assert.match(shell, /path: '\/app\/profile', icon: PersonRounded/);
});

test('wishlist is persisted for tenant accounts and kept on-device for guests', () => {
  const context = read('src/app/context/WishlistContext.tsx');
  const api = read('src/app/services/api.ts');
  const model = read('server/src/models/index.js');
  const controller = read('server/src/controllers/wishlistController.js');
  const routes = read('server/src/routes/wishlistRoutes.js');
  assert.match(context, /secureasset:wishlist:v1/);
  assert.match(context, /syncWishlistItems/);
  assert.match(context, /tenantAccount = user\?\.role === 'tenant'/);
  assert.match(api, /getWishlist/);
  assert.match(api, /addWishlistItem/);
  assert.match(api, /removeWishlistItem/);
  assert.match(model, /const WishlistSchema/);
  assert.match(model, /wishlist_user_listing_unique/);
  assert.match(controller, /publicPropertyFilter/);
  assert.match(controller, /MAX_WISHLIST_ITEMS = 100/);
  assert.match(routes, /router\.use\(authenticate, authorize\('tenant'\)\)/);
});

test('wishlist has public and authenticated routes and property actions', () => {
  const routes = read('src/app/routes.tsx');
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  const marketplace = read('src/app/pages/MarketplacePage.tsx');
  const detail = read('src/app/pages/PropertyDetailPage.tsx');
  assert.match(routes, /path: 'wishlist', Component: WishlistPage/);
  assert.match(modulePage, /module === 'wishlist'/);
  assert.match(marketplace, /FavoriteBorderRounded/);
  assert.match(marketplace, /wishlist\.toggle/);
  assert.match(detail, /wishlist\.isWishlisted/);
  assert.match(detail, /wishlist\.toggle/);
});
