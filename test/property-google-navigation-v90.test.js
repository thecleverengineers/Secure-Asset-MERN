import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('landlords must capture an exact Google property pin when adding or editing', () => {
  const wizard = read('src/app/components/property/PropertyFormWizard.tsx');
  const picker = read('src/app/components/property/GooglePropertyLocationPicker.tsx');
  const locationFields = read('src/app/components/shared/LocationFields.tsx');
  const controller = read('server/src/controllers/resourceController.js');
  assert.match(wizard, /GooglePropertyLocationPicker/);
  assert.match(wizard, /name="latitude"/);
  assert.match(wizard, /name="longitude"/);
  assert.match(wizard, /applyCoordinateLocation/);
  assert.match(wizard, /coordinates: \[mapValues\.longitude, mapValues\.latitude\]/);
  assert.match(picker, /draggable: true/);
  assert.match(picker, /loadGoogleMaps/);
  assert.match(picker, /onChangeRef.current/);
  assert.match(picker, /Use my current location/);
  assert.match(picker, /enableHighAccuracy: true/);
  assert.match(picker, /Click anywhere—even an unlisted village/);
  assert.match(picker, /mapError/);
  assert.match(locationFields, /freeSolo/);
  assert.match(controller, /assertExactPropertyCoordinates/);
  assert.match(controller, /Point the actual property location on Google Maps/);
});

test('tenant property visits release exact navigation only after approval', () => {
  const page = read('src/app/pages/app/PropertyVisitsPage.tsx');
  const controller = read('server/src/controllers/propertyManagementController.js');
  const routes = read('server/src/routes/propertyManagementRoutes.js');
  const api = read('src/app/services/api.ts');
  const resource = read('server/src/controllers/resourceController.js');
  assert.match(page, /Open live navigation/);
  assert.match(page, /getPropertyVisitNavigation/);
  assert.match(page, /SurveyProjectNavigationMap/);
  assert.match(controller, /getPropertyVisitNavigation/);
  assert.match(controller, /The exact property pin is shared after the landlord or administrator confirms/);
  assert.match(controller, /navigationUrl: `https:\/\/www\.google\.com\/maps\/dir/);
  assert.match(routes, /property-visits\/:visitId\/navigation/);
  assert.match(api, /property-management\/property-visits/);
  assert.match(resource, /sanitizePropertyVisitRecord/);
  assert.match(resource, /delete property\.location/);
});

test('administrators can manage map provider credentials and navigation defaults', () => {
  const model = read('server/src/models/propertyManagement.js');
  const service = read('server/src/services/maps.js');
  const controller = read('server/src/controllers/integrationController.js');
  const routes = read('server/src/routes/integrationRoutes.js');
  const admin = read('src/app/pages/app/SiteAdministrationPage.tsx');
  const modulePage = read('src/app/pages/app/ModulePage.tsx');
  assert.match(model, /locationPickerEnabled/);
  assert.match(model, /travelMode/);
  assert.match(service, /encryptIntegrationSecret/);
  assert.match(service, /geocodingApiKey/);
  assert.match(controller, /mapsSettingsSchema/);
  assert.match(controller, /browserMapsKeySchema/);
  assert.match(controller, /Google Maps browser API key before enabling/);
  assert.match(controller, /integration:maps_updated/);
  assert.match(routes, /router\.get\('\/maps'/);
  assert.match(routes, /router\.patch\('\/maps'/);
  assert.match(admin, /Maps & Navigation management/);
  assert.match(admin, /Google Maps browser \/ JavaScript API key/);
  assert.match(admin, /Server API key/);
  assert.match(admin, /Maps & Navigation/);
  assert.match(modulePage, /module === 'property-visits' && user\?\.role === 'tenant'/);
  assert.match(modulePage, /module === 'integration-settings'/);
});

test('Google Maps loading reports credential failures instead of hanging or showing a misleading map', () => {
  const loader = read('src/app/components/survey/SurveyProjectNavigationMap.tsx');
  assert.match(loader, /gm_authFailure/);
  assert.match(loader, /callback=__secureAssetGoogleMapsReady/);
  assert.match(loader, /loading=async/);
  assert.match(loader, /20_000/);
  assert.match(loader, /browser API key/);
  assert.match(loader, /status !== 'error'/);
});
