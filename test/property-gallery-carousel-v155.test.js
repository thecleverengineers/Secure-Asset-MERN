import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const details = readFileSync(new URL('../src/app/pages/app/PropertyDetailsPage.tsx', import.meta.url), 'utf8');
const resource = readFileSync(new URL('../src/app/pages/app/ResourcePage.tsx', import.meta.url), 'utf8');

test('property details opts into the attachment-style gallery carousel only for its dedicated page', () => {
  assert.match(details, /<PropertyFullDetailsView[\s\S]*galleryVariant="carousel"/);
  assert.match(resource, /galleryVariant = 'grid'/);
  assert.match(resource, /variant=\{galleryVariant\}/);
});

test('gallery carousel keeps adjacent slides, preview behavior, and clear navigation controls', () => {
  assert.match(resource, /function PropertyGalleryCarousel/);
  assert.match(resource, /data-secureasset-property-gallery-carousel="attachment-style-v155"/);
  assert.match(resource, /data-secureasset-property-gallery-slides="centered-v155"/);
  assert.match(resource, /data-secureasset-property-gallery-controls="slide-v155"/);
  assert.match(resource, /Previous gallery image/);
  assert.match(resource, /Next gallery image/);
  assert.match(resource, /transform: `translateX\(calc\(-50% \+ \$\{offset \* 76\}%\)\) scale/);
  assert.match(resource, /onClick=\{\(\) => onPreview\(previewImage\)\}/);
});

test('carousel image management actions are on the image top corner and retain edit/delete handlers', () => {
  assert.match(resource, /data-secureasset-property-gallery-overlay-actions="top-corner-v155"/);
  assert.match(resource, /data-secureasset-property-gallery-preview-actions="top-corner-v155"/);
  assert.match(resource, /aria-label=\{'Edit ' \+ image\.label\}/);
  assert.match(resource, /aria-label=\{'Delete ' \+ image\.label\}/);
  assert.match(resource, /onEdit\(image\.recordId as string\)/);
  assert.match(resource, /onDelete\(image\.recordId as string, image\.label\)/);
  assert.match(resource, /variant="carousel" active=\{active\}/);
});
