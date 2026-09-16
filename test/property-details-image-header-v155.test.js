import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/app/pages/app/PropertyDetailsPage.tsx', import.meta.url), 'utf8');

test('property details replaces the text hero with an image-first property header', () => {
  assert.doesNotMatch(page, /PropertyContextBanner/);
  assert.match(page, /function propertyHeaderImage/);
  assert.match(page, /fetchPropertyMediaBlob\(cover\.mediaId, propertyId\)/);
  assert.match(page, /data-secureasset-property-image-header="property-image-header-v155"/);
  assert.match(page, /data-secureasset-property-image-title="bottom-overlay-v155"/);
  assert.match(page, /Back to properties/);
  assert.match(page, /position: 'absolute'/);
});

test('the property image header keeps the requested actions in the three-dot menu', () => {
  assert.match(page, /data-secureasset-property-action-menu="three-dot-v155"/);
  assert.match(page, /MoreVertRounded/);
  assert.match(page, /data-secureasset-property-action-items="visibility-edit-add-refresh-v155"/);
  for (const action of ['Visibility', 'Edit Property', 'Add Room \/ Flat \/ Apartment', 'Refresh']) {
    assert.match(page, new RegExp(action));
  }
  assert.match(page, /onVisibility=\{\(\) => void changePropertyVisibility/);
  assert.match(page, /onEdit=\{editProperty\}/);
  assert.match(page, /onAddSpace=\{addSpace\}/);
  assert.match(page, /onRefresh=\{\(\) => void load\(\)\}/);
});

test('the complete property-details surface uses regular Open Sans', () => {
  assert.match(page, /data-secureasset-property-details-font="open-sans-regular-v155"/);
  assert.match(page, /fontFamily: '\"Open Sans\", Arial, sans-serif'/);
  assert.match(page, /fontWeight: '400 !important'/);
  assert.doesNotMatch(page, /fontWeight:\s*(?:[5-9]\d\d|[5-9]\d)/);
});
