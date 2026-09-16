import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [share, propertyDetail, roomDetail] = await Promise.all([
  read('src/app/utils/publicShare.ts'),
  read('src/app/pages/PropertyDetailPage.tsx'),
  read('src/app/pages/RentalRoomDetailsPage.tsx'),
]);

test('v200 public share attaches the public image and preserves the listing route', () => {
  assert.match(share, /navigator\.share/);
  assert.match(share, /fetch\(imageUrl, \{ credentials: 'same-origin' \}\)/);
  assert.match(share, /files: \[imageFile\]/);
  assert.match(share, /title: shareTitle/);
  assert.match(share, /text: shareText/);
  assert.match(share, /url: shareUrl/);
  assert.match(share, /navigator\.clipboard\.writeText/);
});

test('v200 property overview exposes a direct Share action with the property image and name', () => {
  assert.match(propertyDetail, /import \{ sharePublicListing \} from '\.\.\/utils\/publicShare';/);
  assert.match(propertyDetail, /const shareTitle = active\.name \? `\$\{active\.name\} · \$\{property\.title\}` : property\.title/);
  assert.match(propertyDetail, /const shareImage = displayImages\[0\] \|\| property\.galleryCover/);
  assert.match(propertyDetail, /data-secureasset-public-property-share="public-listing-share-v200"/);
  assert.match(propertyDetail, /sharePublicListing\(\{ title: shareTitle, imageUrl: shareImage, url: publicUrl \}\)/);
});

test('v200 room details exposes a direct Share action with the room image and room/property name', () => {
  assert.match(roomDetail, /import ShareRounded from '@mui\/icons-material\/ShareRounded';/);
  assert.match(roomDetail, /import \{ sharePublicListing \} from '\.\.\/utils\/publicShare';/);
  assert.match(roomDetail, /const shareTitle = `\$\{roomTitle\} · \$\{property\.title\}`/);
  assert.match(roomDetail, /const shareImage = images\[0\] \|\| fallback/);
  assert.match(roomDetail, /data-secureasset-public-room-share="public-room-share-v200"/);
  assert.match(roomDetail, /sharePublicListing\(\{ title: shareTitle, imageUrl: shareImage, url: window\.location\.href \}\)/);
  assert.match(roomDetail, /disabled=\{!canBook\}/);
});
