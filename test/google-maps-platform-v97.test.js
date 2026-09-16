import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v97 keeps every requested Google Maps service behind bounded authenticated adapters', () => {
  const service = read('server/src/services/googleMapsPlatform.js');
  const controller = read('server/src/controllers/googleMapsController.js');
  const routes = read('server/src/routes/googleMapsRoutes.js');
  const api = read('src/app/services/api.ts');

  for (const endpoint of [
    'ROUTES_URL', 'ROUTE_MATRIX_URL', 'PLACES_URL', 'ADDRESS_VALIDATION_URL', 'ELEVATION_URL',
    'ROADS_URL', 'NAVIGATION_CONNECT_URL', 'ROUTE_OPTIMIZATION_URL', 'GROUNDING_LITE_URL', 'STREETVIEW_PUBLISH_URL',
  ]) assert.match(service, new RegExp(`\\b${endpoint}\\b`));
  assert.match(service, /X-Goog-FieldMask/);
  assert.match(service, /streamJson: true/);
  assert.match(service, /MCP-Protocol-Version/);
  assert.match(service, /'X-Goog-Upload-Protocol': 'raw'/);
  assert.match(service, /projectNumber\(config\)/);
  assert.match(service, /projects\/\{project_number\}\/trips\/\{uuid\}/);
  assert.match(service, /DEFAULT_TIMEOUT_MS/);
  assert.match(controller, /computeRouteMatrixController/);
  assert.match(controller, /publishStreetViewPhotoController/);
  for (const path of [
    "'/routes'", "'/route-matrix'", "'/address-validation'", "'/places/autocomplete'", "'/places/:placeId'",
    "'/places/search'", "'/elevation'", "'/roads/snap'", "'/roads/nearest'", "'/roads/speed-limits'",
    "'/navigation-connect/trip'", "'/navigation-connect/trips'", "'/route-optimization'", "'/grounding-lite/tools'",
    "'/grounding-lite/call'", "'/street-view/publish'",
  ]) assert.match(routes, new RegExp(`router\\.(?:get|post)\\(${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  for (const clientCall of ['computeMapRouteMatrix', 'validateMapAddress', 'autocompleteMapPlaces', 'getMapElevation', 'getMapRoadSpeedLimits', 'createMapNavigationConnectTrip', 'optimizeMapTours', 'callGroundingLiteTool', 'publishMapStreetViewPhoto']) assert.match(api, new RegExp(`\\b${clientCall}\\b`));
});

test('v97 prevents the Google browser-key failure from becoming a watermarked map', () => {
  const maps = read('server/src/services/maps.js');
  const loader = read('src/app/components/survey/SurveyProjectNavigationMap.tsx');
  const app = read('server/src/app.js');
  const model = read('server/src/models/propertyManagement.js');
  const integration = read('server/src/controllers/integrationController.js');

  assert.match(maps, /isBrowserMapsKey/);
  assert.match(maps, /publicApiKeyCandidate = config\.publicApiKey \|\| env\.GOOGLE_MAPS_BROWSER_API_KEY/);
  assert.doesNotMatch(maps, /publicApiKeyCandidate = .*GOOGLE_MAPS_API_KEY/);
  assert.match(loader, /gm_authFailure/);
  assert.match(loader, /authReferrerPolicy=origin/);
  assert.match(loader, /currentAccuracyCircleRef/);
  assert.doesNotMatch(app, /openstreetmap\.org/);
  assert.match(model, /enum: \['google'\]/);
  assert.match(integration, /provider: z\.literal\('google'\)/);
});

test('v97 keeps exact pinning in rural areas and removes the Audit trail menu surface', () => {
  const picker = read('src/app/components/property/GooglePropertyLocationPicker.tsx');
  const places = read('src/app/components/property/GooglePlacesUiKit.tsx');
  const shell = read('src/app/components/layout/AppShell.tsx');
  const modulePage = read('src/app/pages/app/ModulePage.tsx');

  assert.match(picker, /Click anywhere—even an unlisted village/);
  assert.match(picker, /enableHighAccuracy: true/);
  assert.match(places, /gmp-place-all-content/);
  assert.match(places, /gmp-place-text-search-request/);
  assert.match(places, /gmp-place-details-compact/);
  assert.match(places, /gmp-place-content-config/);
  assert.match(shell, /HIDDEN_MENU_KEYS = new Set\(\['audit-logs'\]\)/);
  assert.match(modulePage, /HIDDEN_MODULES = new Set\(\['audit-logs'\]\)/);
});
