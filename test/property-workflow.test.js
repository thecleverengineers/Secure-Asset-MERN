import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wizard = readFileSync(new URL('../src/app/components/property/PropertyFormWizard.tsx', import.meta.url), 'utf8');
const models = readFileSync(new URL('../server/src/models/index.js', import.meta.url), 'utf8');
const resources = readFileSync(new URL('../server/src/services/resources.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../server/src/controllers/resourceController.js', import.meta.url), 'utf8');
const publicController = readFileSync(new URL('../server/src/controllers/publicController.js', import.meta.url), 'utf8');
const publicRoutes = readFileSync(new URL('../server/src/routes/publicRoutes.js', import.meta.url), 'utf8');
const serializer = readFileSync(new URL('../server/src/services/publicPropertySerialization.js', import.meta.url), 'utf8');
const resourcePage = readFileSync(new URL('../src/app/pages/app/ResourcePage.tsx', import.meta.url), 'utf8');

const requestedLabels = [
  'Property Title', 'Property Type', 'Listing Type', 'Property Status', 'Property Description', 'Property Profile Image',
  'Listing Visibility',
  'Country', 'State', 'City', 'Use Current Location', 'Locality', 'Landmark', 'PIN Code', 'Full Address', 'Google Map',
  'Enable Property Specifications', 'Number of Bedrooms', 'Number of Bathrooms', 'Number of Balconies', 'Floor Number', 'Kitchen Attached',
  'Area in sq. feet', 'Property Age (years)', 'Furnishing Status', 'Ownership Type', 'Available From',
  'Enable Parking Details', 'Car Parking Spaces', 'Two Wheeler Parking Spaces', 'Visitor Parking',
  'Sale Price', 'Monthly Rent', 'Lease Amount', 'Security Deposit', 'Maintenance Charges', 'Price per sq. feet', 'Tax',
  'Water Supply', 'Electricity Connection', 'Power Backup', 'Internet Availability', 'Gas Connection', 'Sewage Connection',
  'Lift', 'Security', 'CCTV', 'Gated Community', 'Garden', 'Swimming Pool', 'Gym', 'Clubhouse',
  "Children's Play Area", 'Jogging Track', 'Community Hall', 'Terrace', 'Balcony', 'Air Conditioning',
  'Modular Kitchen', 'Store Room', 'Servant Room', 'Wheelchair Access', 'RERA Number (if applicable)',
  'Title Clear', 'Loan Approved', 'Occupancy Certificate', 'Completion Certificate', 'Property Photos', 'Floor Plan',
  'Video Tour', '360° Virtual Tour', 'Property Documents', 'Owner Name', 'Agent Name', 'Phone Number',
  'Email Address', 'Preferred Contact Method', 'School', 'Hospital', 'Market', 'Bus Stop', 'Railway Station',
  'Airport', 'Shopping Mall', 'Park', 'Bank', 'Pharmacy',
];

test('property create and edit use the requested four-step workflow', () => {
  for (const step of ['Property Details', 'Utilities & Amenities', 'Legal Details', 'Media & Contact']) {
    assert.match(wizard, new RegExp(step.replace(/[&]/g, '\\&')));
  }
  for (const label of requestedLabels) assert.ok(wizard.includes(label), `missing property field: ${label}`);
  assert.match(resourcePage, /module === 'properties'.*PropertyFormWizard/s);
  assert.match(resourcePage, /statuses: \['draft','pending_approval','available','partially_occupied','occupied','reserved','rented','sold','leased','maintenance','unavailable','archived'\]/);
});

test('property visibility can be changed between private and public and is persisted by the API', () => {
  assert.match(wizard, /visibility: property\?\._id \? \(property\?\.visibility === 'public' \? 'public' : 'private'\) : 'public'/);
  assert.match(wizard, /name="visibility"/);
  assert.match(wizard, /value: 'private', label: 'Private — owner workspace only'/);
  assert.match(wizard, /value: 'public', label: 'Public — visible on marketplace'/);
  assert.match(wizard, /visibility: values\.visibility === 'public' \? 'public' : 'private'/);
  assert.match(controller, /function normalizePropertyVisibility/);
  assert.match(controller, /Property visibility must be either private or public/);
  assert.match(controller, /changes\.visibility = normalizePropertyVisibility\(changes\.visibility\)/);
  assert.match(controller, /if \(changes\.visibility === 'private'\) changes\.publicationStatus = 'draft'/);
  assert.match(resourcePage, /data-secureasset-property-visibility="property-visibility-v71"/);
  assert.match(resourcePage, /async function changeVisibility\(row: any\)/);
  assert.match(resourcePage, /Click to change visibility/);
  const detailsPage = readFileSync(new URL('../src/app/pages/app/PropertyDetailsPage.tsx', import.meta.url), 'utf8');
  assert.match(detailsPage, /data-secureasset-property-visibility="property-visibility-v71"/);
  assert.match(detailsPage, /async function changePropertyVisibility\(next: 'private' \| 'public'\)/);
  assert.match(detailsPage, /data-secureasset-property-action-items="visibility-edit-add-refresh-v155"/);
  assert.match(detailsPage, /onVisibility=\{\(\) => void changePropertyVisibility\(property\.visibility === 'public' \? 'private' : 'public'\)\}/);
});

test('property workflow maps every group to MongoDB and writable API fields', () => {
  for (const group of ['specifications', 'parking', 'utilities', 'amenityDetails', 'legalDetails', 'contactInformation', 'nearbyFacilities']) {
    assert.match(models, new RegExp(`${group}: \\{`), `missing MongoDB group ${group}`);
    assert.ok(resources.includes(`'${group}'`) || resources.includes(`${group}`), `missing writable group ${group}`);
  }
  for (const field of ['locality', 'landmark', 'googleMapsLocation', 'propertyTax', 'tax', 'pricePerUnitArea', 'kitchenAttached']) assert.ok(models.includes(field), `missing MongoDB field ${field}`);
  assert.match(publicRoutes, /locations\/reverse/);
  assert.match(controller, /normalizePropertyWorkflowFields/);
  assert.match(controller, /Sale price.*Lease amount.*Monthly rent/s);
  assert.match(controller, /contact phone number or email address/);
});

test('property media is vault-backed and public files use a controlled streaming route', () => {
  assert.match(wizard, /uploadDocument/);
  assert.match(wizard, /createResource\('property-media'/);
  assert.doesNotMatch(wizard, /await updateResource\('properties', propertyId/);
  assert.match(controller, /syncPropertyMediaReferences/);
  assert.match(controller, /Property\.updateOne\(\{ _id: media\.property, deletedAt: null \}/);
  assert.match(controller, /owner: req\.user\._id, deletedAt: null/);
  assert.match(publicRoutes, /property-media\/:id\/content/);
  assert.match(publicController, /streamPublicPropertyMedia/);
  assert.match(publicController, /visibility: 'public'/);
  assert.match(publicController, /visibility: 'public'/);
  assert.ok(!publicController.includes("mediaType === 'document'"), 'public floor-plan documents should remain streamable');
});

test('private landlord gallery previews use the authenticated property media stream', () => {
  const propertyManagementController = readFileSync(new URL('../server/src/controllers/propertyManagementController.js', import.meta.url), 'utf8');
  const propertyMediaFile = readFileSync(new URL('../server/src/services/propertyMediaFile.js', import.meta.url), 'utf8');
  const propertyManagementRoutes = readFileSync(new URL('../server/src/routes/propertyManagementRoutes.js', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/app/services/api.ts', import.meta.url), 'utf8');
  assert.match(propertyManagementController, /export const streamPropertyMedia/);
  assert.match(propertyManagementController, /export const streamPropertyMediaForProperty/);
  assert.match(propertyManagementController, /await propertyForUser\(req\.user, media\.property\)/);
  assert.match(propertyMediaFile, /media\?\.driveFile/);
  assert.match(propertyMediaFile, /Document\.findById\(documentId\)/);
  assert.match(propertyManagementController, /sendStoredFile\(req, res, file/);
  assert.match(propertyManagementRoutes, /property-media\/:mediaId\/content/);
  assert.match(propertyManagementRoutes, /properties\/:propertyId\/media\/:mediaId\/content/);
  assert.match(api, /export async function fetchPropertyMediaBlob/);
  assert.match(api, /properties\/\$\{encodeURIComponent\(propertyId\)\}\/media/);
  assert.match(resourcePage, /fetchPropertyMediaBlob\(image\.mediaId as string, image\.propertyId/);
  assert.match(resourcePage, /property-management\/properties\/\$\{encodeURIComponent\(propertyId\)\}\/media/);
  assert.match(propertyManagementController, /export const streamLegacyPropertyImage/);
  assert.match(propertyManagementController, /Property\.images\/galleryCover/);
  assert.match(propertyManagementController, /preparePropertyMediaPreviews/);
  assert.match(propertyManagementController, /previewAvailable: true/);
  assert.match(propertyManagementController, /resolvePropertyMediaFile/);
  assert.match(propertyMediaFile, /PropertyMedia\.findOne/);
  assert.match(propertyMediaFile, /excludedIds/);
  assert.match(propertyMediaFile, /relations\.property/);
  assert.match(propertyMediaFile, /originalName/);
  assert.match(propertyMediaFile, /Document\.findOne/);
  assert.doesNotMatch(propertyMediaFile, /if \(!relatedDocument\) return null/);
  assert.match(propertyManagementRoutes, /properties\/:propertyId\/images\/:fileId\/content/);
  assert.match(api, /export async function fetchPropertyImageBlob/);
  assert.match(api, /fetchAuthenticatedBlob/);
  assert.match(api, /normalizeImageBlob/);
  assert.match(api, /cache: 'no-store'/);
  assert.match(api, /function mediaSourceId\(source/);
  assert.match(resourcePage, /propertyMediaIdFromSource/);
  assert.match(resourcePage, /fetchPropertyImageBlob\(image\.secureSource as string/);
  assert.match(resourcePage, /secureasset-gallery-preview-v65/);
  assert.match(resourcePage, /Click the image to zoom/);
  assert.match(resourcePage, /ZoomInRounded/);
  assert.match(resourcePage, /ZoomOutRounded/);
  assert.match(resourcePage, /fallbackSources/);
  assert.match(resourcePage, /previewFileId/);
  assert.doesNotMatch(resourcePage, /const images = \[\.\.\.imageMap\.values\(\)\]\.slice\(0, 12\)/);
  assert.doesNotMatch(resourcePage, /Thumbnail unavailable/);
});

test('resource list scopes always reach Mongoose as safe filter objects', () => {
  const scope = readFileSync(new URL('../server/src/services/scope.js', import.meta.url), 'utf8');
  const searchController = readFileSync(new URL('../server/src/controllers/searchController.js', import.meta.url), 'utf8');
  assert.match(scope, /export function normalizeQueryFilter/);
  assert.match(scope, /const clauses = scopes\.flatMap/);
  assert.match(controller, /const scope = normalizeQueryFilter\(await buildScope/);
  assert.match(controller, /const safeFilter = normalizeQueryFilter\(filter\)/);
  assert.match(controller, /config\.model\.find\(safeFilter\)/);
  assert.match(controller, /config\.model\.countDocuments\(safeFilter\)/);
  assert.match(searchController, /normalizeQueryFilter\(await buildScope/);
  assert.doesNotMatch(controller, /\{ \.\.\.await buildScope\(/);
});

test('public property serialization exposes listing details without leaking direct contact data', () => {
  for (const group of ['specifications', 'parking', 'utilities', 'amenityDetails', 'legalDetails', 'nearbyFacilities']) assert.ok(serializer.includes(`${group}:`));
  assert.match(serializer, /publicContact: \{ ownerName:.*agentName:.*preferredContactMethod:/s);
  const publicContact = serializer.match(/publicContact: \{([^}]+)\}/s)?.[1] || '';
  assert.ok(!publicContact.includes('phoneNumber'));
  assert.ok(!publicContact.includes('emailAddress'));
});


test('property management view shows full details in grouped sections', () => {
  for (const phrase of ['PropertyFullDetailsView', 'Property Details', 'Utilities & Amenities', 'Legal Details', 'Media & Contacts']) {
    assert.match(resourcePage, new RegExp(phrase));
  }
  for (const field of ['Property Description', 'Google Map Location', 'RERA Number', 'Preferred Contact Method', 'Media Preview']) {
    assert.ok(resourcePage.includes(field), `missing property view field: ${field}`);
  }
});
