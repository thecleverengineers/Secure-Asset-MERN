import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { getMapsConfiguration } from './maps.js';

// Google Maps Platform is intentionally accessed from one bounded server
// adapter. Browser keys are limited to rendering the map; server credentials
// never leave this process. Keeping the provider boundary here also prevents
// a slow or malformed upstream response from holding an application request
// open indefinitely.
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const ROUTE_MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
const PLACES_URL = 'https://places.googleapis.com/v1';
const ADDRESS_VALIDATION_URL = 'https://addressvalidation.googleapis.com/v1:validateAddress';
const ELEVATION_URL = 'https://maps.googleapis.com/maps/api/elevation/json';
const ROADS_URL = 'https://roads.googleapis.com/v1';
const NAVIGATION_CONNECT_URL = 'https://navigationconnect.googleapis.com/v1';
const ROUTE_OPTIMIZATION_URL = 'https://routeoptimization.googleapis.com/v1';
const GROUNDING_LITE_URL = 'https://mapstools.googleapis.com/mcp';
const STREETVIEW_PUBLISH_URL = 'https://streetviewpublish.googleapis.com/v1';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_POINTS = 100;
const MAX_TEXT_LENGTH = 500;

export class GoogleMapsProviderError extends Error {
  constructor(message, { status = 503, service = 'google-maps', providerCode = '' } = {}) {
    super(message);
    this.name = 'GoogleMapsProviderError';
    this.status = status;
    this.service = service;
    this.providerCode = providerCode;
  }
}

function text(value, max = MAX_TEXT_LENGTH) {
  return String(value || '').trim().slice(0, max);
}

function coordinate(value, label) {
  const latitude = Number(value?.latitude ?? value?.lat);
  const longitude = Number(value?.longitude ?? value?.lng ?? value?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || (latitude === 0 && longitude === 0)) {
    throw new GoogleMapsProviderError(`A valid ${label} latitude and longitude are required`, { status: 422, service: 'validation' });
  }
  return { latitude, longitude };
}

function latLng(value, label) {
  const point = coordinate(value, label);
  return { latitude: point.latitude, longitude: point.longitude };
}

function normalizeTravelMode(value) {
  const mode = String(value || 'DRIVING').trim().toUpperCase();
  const modes = { DRIVING: 'DRIVE', DRIVE: 'DRIVE', WALKING: 'WALK', WALK: 'WALK', BICYCLING: 'BICYCLE', BICYCLE: 'BICYCLE', TRANSIT: 'TRANSIT', TWO_WHEELER: 'TWO_WHEELER' };
  if (!modes[mode]) throw new GoogleMapsProviderError('Unsupported travel mode', { status: 422, service: 'routes' });
  return modes[mode];
}

function durationSeconds(value) {
  const match = String(value || '').match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  return match ? Number(match[1]) : 0;
}

function serviceKey(configuration, key, service) {
  if (configuration.enabled === false) throw new GoogleMapsProviderError('Google Maps Platform is disabled by the administrator', { service });
  const feature = {
    routes: 'routesEnabled', places: 'placesEnabled', addressValidation: 'addressValidationEnabled', elevation: 'elevationEnabled',
    roads: 'roadsEnabled', routeOptimization: 'routeOptimizationEnabled', navigationConnect: 'navigationConnectEnabled',
    groundingLite: 'groundingLiteEnabled', streetViewPublish: 'streetViewPublishEnabled',
  }[service];
  if (feature && configuration[feature] === false) throw new GoogleMapsProviderError(`${service} is disabled by the administrator`, { status: 503, service });
  const value = text(configuration[key], 1000);
  if (!value) throw new GoogleMapsProviderError(`${service} is not configured. Add its server credential in Maps & Navigation.`, { status: 503, service });
  return value;
}

function requestHeaders(configuration, headers = {}) {
  return {
    Accept: 'application/json',
    ...(configuration.cloudProjectId ? { 'X-Goog-User-Project': text(configuration.cloudProjectId, 120) } : {}),
    ...headers,
  };
}

async function boundedText(response, service) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_RESPONSE_BYTES) throw new GoogleMapsProviderError(`${service} returned an oversized response`, { status: 502, service });
  if (!response.body?.getReader) {
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) throw new GoogleMapsProviderError(`${service} returned an oversized response`, { status: 502, service });
    return body;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new GoogleMapsProviderError(`${service} returned an oversized response`, { status: 502, service });
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

function parseBody(body, response, service, { streamJson = false } = {}) {
  if (!body) return {};
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('json') || /^[[{]/.test(body.trim())) {
    try { return JSON.parse(body); } catch {
      if (streamJson) {
        const rows = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
          try { return JSON.parse(line); } catch { throw new GoogleMapsProviderError(`${service} returned invalid streamed JSON`, { status: 502, service }); }
        });
        if (rows.length) return rows;
      }
      throw new GoogleMapsProviderError(`${service} returned invalid JSON`, { status: 502, service });
    }
  }
  return { raw: body.slice(0, MAX_RESPONSE_BYTES) };
}

async function providerRequest(url, { method = 'GET', headers = {}, body, service, timeoutMs = DEFAULT_TIMEOUT_MS, streamJson = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(Math.max(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 1000), 30_000));
  try {
    const response = await fetch(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body: typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body) }),
      signal: controller.signal,
    });
    const raw = await boundedText(response, service);
    const payload = parseBody(raw, response, service, { streamJson });
    if (!response.ok) {
      const providerError = payload?.error || payload;
      const providerCode = text(providerError?.status || providerError?.code || '', 80);
      const detail = text(providerError?.message || providerError?.error?.message || '', 360);
      throw new GoogleMapsProviderError(`${service} request was rejected${detail ? `: ${detail}` : ` (${response.status})`}`, { status: response.status >= 400 && response.status < 500 ? response.status : 502, service, providerCode });
    }
    return payload;
  } catch (error) {
    if (error instanceof GoogleMapsProviderError) throw error;
    const message = error?.name === 'AbortError' ? `${service} timed out` : `${service} could not be reached`;
    throw new GoogleMapsProviderError(message, { status: 503, service });
  } finally {
    clearTimeout(timer);
  }
}

async function configuration() {
  return getMapsConfiguration({ includeSecrets: true });
}

function routeWaypoint(value, label) {
  const point = latLng(value, label);
  return { location: { latLng: point } };
}

function normalizeRoute(route) {
  const distanceMeters = Number(route?.distanceMeters || 0);
  const duration = durationSeconds(route?.duration);
  const localized = route?.localizedValues || {};
  return {
    distanceMeters,
    durationSeconds: duration,
    distanceText: text(localized.distance?.text || (distanceMeters ? `${(distanceMeters / 1000).toFixed(1)} km` : ''), 80),
    durationText: text(localized.duration?.text || (duration ? `${Math.ceil(duration / 60)} min` : ''), 80),
    encodedPolyline: text(route?.polyline?.encodedPolyline, 1_000_000),
    legs: Array.isArray(route?.legs) ? route.legs.map((leg) => ({
      distanceMeters: Number(leg?.distanceMeters || 0), durationSeconds: durationSeconds(leg?.duration),
      encodedPolyline: text(leg?.polyline?.encodedPolyline, 1_000_000),
      steps: Array.isArray(leg?.steps) ? leg.steps.slice(0, 500).map((step) => ({
        distanceMeters: Number(step?.distanceMeters || 0), durationSeconds: durationSeconds(step?.staticDuration || step?.duration),
        instruction: text(step?.navigationInstruction?.instructions, 500),
        maneuver: text(step?.navigationInstruction?.maneuver, 80),
      })) : [],
    })) : [],
    warnings: Array.isArray(route?.warnings) ? route.warnings.slice(0, 20).map((item) => text(item, 300)) : [],
  };
}

export async function computeRoutes({ origin, destination, travelMode = 'DRIVING', intermediates = [], routingPreference, departureTime } = {}) {
  const config = await configuration();
  const apiKey = serviceKey(config, 'routesApiKey', 'routes');
  const mode = normalizeTravelMode(travelMode);
  const points = Array.isArray(intermediates) ? intermediates.slice(0, Number(config.maxRouteWaypoints || 25)) : [];
  const request = {
    origin: routeWaypoint(origin, 'origin'),
    destination: routeWaypoint(destination, 'destination'),
    travelMode: mode,
    polylineQuality: 'HIGH_QUALITY',
    polylineEncoding: 'ENCODED_POLYLINE',
    units: config.units || 'METRIC',
    languageCode: config.languageCode || 'en-US',
    regionCode: config.regionCode || 'IN',
    ...(points.length ? { intermediates: points.map((point) => routeWaypoint(point, 'waypoint')) } : {}),
    ...(departureTime ? { departureTime: new Date(departureTime).toISOString() } : {}),
    ...(mode === 'DRIVE' || mode === 'TWO_WHEELER' ? { routingPreference: routingPreference || (config.useTraffic ? 'TRAFFIC_AWARE' : 'TRAFFIC_UNAWARE') } : {}),
  };
  const payload = await providerRequest(ROUTES_URL, {
    method: 'POST', service: 'routes', headers: requestHeaders(config, {
      'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.localizedValues,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration,routes.legs.localizedValues,routes.legs.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.warnings',
    }), body: request,
  });
  const routes = Array.isArray(payload?.routes) ? payload.routes.slice(0, 3).map(normalizeRoute) : [];
  if (!routes.length) throw new GoogleMapsProviderError('Routes API returned no reachable route', { status: 422, service: 'routes' });
  return { provider: 'google-routes-api', routes, route: routes[0], requested: { origin: coordinate(origin, 'origin'), destination: coordinate(destination, 'destination'), travelMode: mode } };
}

export async function computeRouteMatrix({ origins = [], destinations = [], travelMode = 'DRIVING', routingPreference, departureTime, arrivalTime } = {}) {
  const config = await configuration();
  const apiKey = serviceKey(config, 'routesApiKey', 'routes');
  if (!Array.isArray(origins) || !origins.length || !Array.isArray(destinations) || !destinations.length || origins.length * destinations.length > 625) {
    throw new GoogleMapsProviderError('Route Matrix requires 1–625 origin/destination elements', { status: 422, service: 'routes' });
  }
  const mode = normalizeTravelMode(travelMode);
  if (departureTime && arrivalTime) throw new GoogleMapsProviderError('Route Matrix accepts either departureTime or arrivalTime, not both', { status: 422, service: 'routes' });
  const preference = routingPreference || (mode === 'DRIVE' || mode === 'TWO_WHEELER' ? (config.useTraffic ? 'TRAFFIC_AWARE' : 'TRAFFIC_UNAWARE') : undefined);
  if (preference && mode !== 'DRIVE' && mode !== 'TWO_WHEELER') throw new GoogleMapsProviderError('Routing preference is only valid for driving routes', { status: 422, service: 'routes' });
  const elementCount = origins.length * destinations.length;
  if ((mode === 'TRANSIT' || preference === 'TRAFFIC_AWARE_OPTIMAL') && elementCount > 100) throw new GoogleMapsProviderError('This Route Matrix mode supports at most 100 origin/destination elements', { status: 422, service: 'routes' });
  const request = {
    origins: origins.map((item) => ({ waypoint: routeWaypoint(item, 'origin') })),
    destinations: destinations.map((item) => ({ waypoint: routeWaypoint(item, 'destination') })),
    travelMode: mode,
    ...(preference ? { routingPreference: preference } : {}),
    ...(departureTime ? { departureTime: new Date(departureTime).toISOString() } : {}),
    ...(arrivalTime ? { arrivalTime: new Date(arrivalTime).toISOString() } : {}),
    languageCode: config.languageCode || 'en-US', regionCode: config.regionCode || 'IN', units: config.units || 'METRIC',
  };
  const payload = await providerRequest(ROUTE_MATRIX_URL, {
    method: 'POST', service: 'route-matrix', headers: requestHeaders(config, {
      'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition,localizedValues',
    }), body: request, streamJson: true,
  });
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
  return { provider: 'google-route-matrix-api', elements: rows.slice(0, 625).map((row) => ({ originIndex: Number(row.originIndex || 0), destinationIndex: Number(row.destinationIndex || 0), distanceMeters: Number(row.distanceMeters || 0), durationSeconds: durationSeconds(row.duration), status: text(row.status?.code || row.status || '', 80), condition: text(row.condition, 80), distanceText: text(row.localizedValues?.distance?.text, 80), durationText: text(row.localizedValues?.duration?.text, 80), fallbackInfo: row.fallbackInfo || null })) };
}

export async function validateAddress({ addressLines = [], regionCode, locality, administrativeArea, postalCode, languageCode } = {}) {
  const config = await configuration();
  const apiKey = serviceKey(config, 'addressValidationApiKey', 'addressValidation');
  const lines = (Array.isArray(addressLines) ? addressLines : [addressLines]).map((line) => text(line, 200)).filter(Boolean).slice(0, 5);
  if (!lines.length) throw new GoogleMapsProviderError('At least one address line is required', { status: 422, service: 'address-validation' });
  const address = { addressLines: lines, ...(text(regionCode || config.regionCode, 8) ? { regionCode: text(regionCode || config.regionCode, 8).toUpperCase() } : {}), ...(text(locality, 120) ? { locality: text(locality, 120) } : {}), ...(text(administrativeArea, 120) ? { administrativeArea: text(administrativeArea, 120) } : {}), ...(text(postalCode, 40) ? { postalCode: text(postalCode, 40) } : {}), ...(text(languageCode || config.languageCode, 24) ? { languageCode: text(languageCode || config.languageCode, 24) } : {}) };
  const inputLength = [...lines, regionCode, locality, administrativeArea, postalCode, languageCode].reduce((total, value) => total + String(value || '').length, 0);
  if (inputLength > 280) throw new GoogleMapsProviderError('Address Validation input must be 280 characters or fewer', { status: 422, service: 'address-validation' });
  const payload = await providerRequest(`${ADDRESS_VALIDATION_URL}?key=${encodeURIComponent(apiKey)}`, { method: 'POST', service: 'address-validation', headers: requestHeaders(config, { 'Content-Type': 'application/json' }), body: { address } });
  return { provider: 'google-address-validation-api', verdict: payload.verdict || {}, address: payload.address || {}, geocode: payload.geocode || {}, metadata: payload.metadata || {}, uspsData: payload.uspsData || null };
}

export async function reverseGeocodeCoordinates({ latitude, longitude } = {}) {
  const config = await configuration();
  if (config.reverseGeocodeEnabled === false) return null;
  const apiKey = serviceKey(config, 'geocodingApiKey', 'geocoding');
  const point = coordinate({ latitude, longitude }, 'reverse-geocode');
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${point.latitude},${point.longitude}`);
  url.searchParams.set('key', apiKey);
  const payload = await providerRequest(url, { service: 'geocoding', headers: requestHeaders(config) });
  if (payload.status && payload.status !== 'OK') throw new GoogleMapsProviderError(`Geocoding API returned ${text(payload.error_message || payload.status, 200)}`, { status: 502, service: 'geocoding', providerCode: text(payload.status, 80) });
  const result = payload.results?.[0];
  return result ? { result, provider: 'google-geocoding-api' } : null;
}

function placeId(value) {
  const normalized = text(value, 200).replace(/^places\//, '');
  if (!normalized || normalized.includes('/') || !/^[A-Za-z0-9_-]+$/.test(normalized)) throw new GoogleMapsProviderError('A valid Google Place ID is required', { status: 422, service: 'places' });
  return normalized;
}

export async function autocompletePlaces({ input, sessionToken = '', locationBias, includedRegionCodes = [], languageCode } = {}) {
  const config = await configuration();
  const apiKey = serviceKey(config, 'placesApiKey', 'places');
  const value = text(input, 200);
  if (value.length < 2) return { provider: 'google-places-api-new', suggestions: [] };
  const request = {
    input: value,
    ...(text(sessionToken, 200) ? { sessionToken: text(sessionToken, 200) } : {}),
    ...(text(languageCode || config.languageCode, 24) ? { languageCode: text(languageCode || config.languageCode, 24) } : {}),
    ...(Array.isArray(includedRegionCodes) && includedRegionCodes.length ? { includedRegionCodes: includedRegionCodes.map((item) => text(item, 8).toUpperCase()).filter(Boolean).slice(0, 15) } : {}),
    ...(locationBias ? { locationBias: { circle: { center: latLng(locationBias.center || locationBias, 'location bias'), radius: Math.min(Math.max(Number(locationBias.radius) || 5000, 1), 50_000) } } } : {}),
  };
  const payload = await providerRequest(`${PLACES_URL}/places:autocomplete`, { method: 'POST', service: 'places', headers: requestHeaders(config, { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.queryPrediction.text' }), body: request });
  return { provider: 'google-places-api-new', suggestions: (payload.suggestions || []).slice(0, 10).map((item) => ({ placeId: item.placePrediction?.placeId || '', text: item.placePrediction?.text?.text || item.queryPrediction?.text?.text || '', mainText: item.placePrediction?.structuredFormat?.mainText?.text || '', secondaryText: item.placePrediction?.structuredFormat?.secondaryText?.text || '', query: item.queryPrediction?.text?.text || '' })).filter((item) => item.text) };
}

export async function getPlaceDetails(id) {
  const config = await configuration();
  const apiKey = serviceKey(config, 'placesApiKey', 'places');
  const payload = await providerRequest(`${PLACES_URL}/places/${encodeURIComponent(placeId(id))}`, { service: 'places', headers: requestHeaders(config, { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,viewport,addressComponents,types,googleMapsUri,plusCode,postalAddress,regularOpeningHours,currentOpeningHours' }) });
  return { provider: 'google-places-api-new', place: payload };
}

export async function searchPlaces({ textQuery, locationBias, maxResultCount = 10, includedType, languageCode } = {}) {
  const config = await configuration();
  const apiKey = serviceKey(config, 'placesApiKey', 'places');
  const query = text(textQuery, 200);
  if (!query) throw new GoogleMapsProviderError('A place search query is required', { status: 422, service: 'places' });
  const request = { textQuery: query, maxResultCount: Math.min(Math.max(Number(maxResultCount) || 10, 1), 20), ...(text(includedType, 80) ? { includedType: text(includedType, 80) } : {}), ...(text(languageCode || config.languageCode, 24) ? { languageCode: text(languageCode || config.languageCode, 24) } : {}), ...(locationBias ? { locationBias: { circle: { center: latLng(locationBias.center || locationBias, 'location bias'), radius: Math.min(Math.max(Number(locationBias.radius) || 5000, 1), 50_000) } } } : {}) };
  const payload = await providerRequest(`${PLACES_URL}/places:searchText`, { method: 'POST', service: 'places', headers: requestHeaders(config, { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.googleMapsUri' }), body: request });
  return { provider: 'google-places-api-new', places: (payload.places || []).slice(0, 20) };
}

function pointQuery(points, label) {
  if (!Array.isArray(points) || !points.length || points.length > MAX_POINTS) throw new GoogleMapsProviderError(`${label} supports 1–${MAX_POINTS} points`, { status: 422, service: 'roads' });
  return points.map((item) => { const point = coordinate(item, 'road point'); return `${point.latitude},${point.longitude}`; }).join('|');
}

export async function elevation(points) {
  const config = await configuration();
  const apiKey = serviceKey(config, 'elevationApiKey', 'elevation');
  const url = new URL(ELEVATION_URL);
  url.searchParams.set('locations', pointQuery(points, 'Elevation API'));
  url.searchParams.set('key', apiKey);
  const payload = await providerRequest(url, { service: 'elevation', headers: requestHeaders(config) });
  if (payload.status && payload.status !== 'OK') throw new GoogleMapsProviderError(`Elevation API returned ${text(payload.error_message || payload.status, 200)}`, { status: 502, service: 'elevation', providerCode: text(payload.status, 80) });
  return { provider: 'google-elevation-api', results: (payload.results || []).slice(0, MAX_POINTS).map((item) => ({ elevation: Number(item.elevation), latitude: Number(item.location?.lat), longitude: Number(item.location?.lng), resolution: Number(item.resolution || 0) })) };
}

function placeIdQuery(placeIds, label = 'Roads API') {
  if (!Array.isArray(placeIds) || !placeIds.length || placeIds.length > MAX_POINTS) throw new GoogleMapsProviderError(`${label} supports 1–${MAX_POINTS} place IDs`, { status: 422, service: 'roads' });
  return placeIds.map((item) => {
    const value = text(item, 200).replace(/^places\//, '');
    if (!value || value.includes('/') || !/^[A-Za-z0-9_-]+$/.test(value)) throw new GoogleMapsProviderError('Invalid road segment place ID', { status: 422, service: 'roads' });
    return value;
  });
}

async function roadsRequest(path, points, { interpolate = false, service = 'roads', placeIds = [], units = 'KPH' } = {}) {
  const config = await configuration();
  const apiKey = serviceKey(config, 'roadsApiKey', 'roads');
  const url = new URL(`${ROADS_URL}/${path}`);
  if (Array.isArray(placeIds) && placeIds.length) placeIdQuery(placeIds).forEach((value) => url.searchParams.append('placeId', value));
  else url.searchParams.set('path', pointQuery(points, 'Roads API'));
  url.searchParams.set('key', apiKey);
  if (path === 'snapToRoads') url.searchParams.set('interpolate', interpolate ? 'true' : 'false');
  if (path === 'speedLimits') url.searchParams.set('units', units === 'MPH' ? 'MPH' : 'KPH');
  const payload = await providerRequest(url, { service, headers: requestHeaders(config) });
  return { provider: 'google-roads-api', ...payload };
}

export async function snapToRoads(points, { interpolate = true } = {}) { return roadsRequest('snapToRoads', points, { interpolate }); }
export async function nearestRoads(points) { return roadsRequest('nearestRoads', points); }
export async function roadSpeedLimits({ points = [], placeIds = [], units = 'KPH' } = {}) { return roadsRequest('speedLimits', points, { placeIds, units, service: 'roads-speed-limits' }); }

function oauthToken(configuration, key, service) {
  return serviceKey(configuration, key, service);
}

function projectId(configuration, supplied) {
  const value = text(supplied || configuration.cloudProjectId, 120);
  if (!/^(?:[a-z][a-z0-9-]{4,28}[a-z0-9]|[0-9]{6,30})$/.test(value)) throw new GoogleMapsProviderError('A valid Google Cloud project ID or project number is required for this service', { status: 422, service: 'google-cloud' });
  return value;
}

function projectNumber(configuration) {
  const value = text(configuration.cloudProjectId, 120);
  // Navigation Connect documents its parent as projects/{project_number}; a
  // project ID is valid for other Google APIs but is not a valid parent here.
  if (!/^[0-9]{6,30}$/.test(value)) throw new GoogleMapsProviderError('Navigation Connect requires the numeric Google Cloud project number', { status: 422, service: 'navigation-connect' });
  return value;
}

function uuid(value, service) {
  const normalized = text(value, 80);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) throw new GoogleMapsProviderError(`${service} trip ID must be an RFC-4122 UUID`, { status: 422, service });
  return normalized;
}

export async function createNavigationConnectTrip({ destination, placeId: destinationPlaceId, androidAppId = '', iosAppId = '', tripId = crypto.randomUUID(), enableHighFrequencyUpdates = true, enablePubsub = false, pubsubFieldMask = '', enableRemainingRouteReporting = true } = {}) {
  const config = await configuration();
  const token = oauthToken(config, 'navigationConnectAccessToken', 'navigation-connect');
  const cloudProjectId = projectNumber(config);
  const normalizedTripId = uuid(tripId, 'Navigation Connect');
  const androidId = text(androidAppId || config.navigationConnectAndroidAppId, 200);
  const iosId = text(iosAppId || config.navigationConnectIosAppId, 200);
  if (!androidId && !iosId) throw new GoogleMapsProviderError('Navigation Connect requires a verified Android package ID or iOS bundle ID', { status: 422, service: 'navigation-connect' });
  const destinationPoint = destination ? coordinate(destination, 'destination') : null;
  const normalizedDestinationPlaceId = destinationPoint ? '' : placeId(destinationPlaceId);
  const payload = await providerRequest(`${NAVIGATION_CONNECT_URL}/projects/${encodeURIComponent(cloudProjectId)}/trips?tripId=${encodeURIComponent(normalizedTripId)}`, {
    method: 'POST', service: 'navigation-connect', headers: requestHeaders(config, { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    body: {
      ...(androidId ? { androidAppId: androidId } : {}), ...(iosId ? { iosAppId: iosId } : {}),
      config: { enableHighFrequencyUpdates: Boolean(enableHighFrequencyUpdates), enableRemainingRouteReporting: Boolean(enableRemainingRouteReporting), ...(enablePubsub ? { enablePubsub: true, ...(text(pubsubFieldMask, 500) ? { pubsubFieldMask: text(pubsubFieldMask, 500) } : {}) } : {}) },
    },
  });
  const authToken = text(payload.authToken?.token, 4000);
  if (!authToken) throw new GoogleMapsProviderError('Navigation Connect did not return a trip token', { status: 502, service: 'navigation-connect' });
  const query = new URLSearchParams({ api: '1', ...(destinationPoint ? { destination: `${destinationPoint.latitude},${destinationPoint.longitude}` } : { destination_place_id: normalizedDestinationPlaceId }), dir_action: 'navigate', action_token: authToken });
  const wazeQuery = new URLSearchParams(destinationPoint ? { ll: `${destinationPoint.latitude},${destinationPoint.longitude}`, navigate: 'yes', external_trip_token: authToken } : { google_place_id: normalizedDestinationPlaceId, navigate: 'yes', external_trip_token: authToken });
  return { provider: 'google-navigation-connect-api', trip: payload, googleMapsUrl: `https://www.google.com/maps/dir/?${query}`, wazeUrl: `https://waze.com/ul?${wazeQuery}`, expiresAt: payload.authToken?.expireTime || null };
}

export async function getNavigationConnectTrip(name, routePolylineFormat = 'SIMPLE') {
  const config = await configuration();
  const token = oauthToken(config, 'navigationConnectAccessToken', 'navigation-connect');
  const normalized = text(name, 240);
  if (!/^projects\/[0-9]{6,30}\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) throw new GoogleMapsProviderError('Invalid Navigation Connect trip resource; use projects/{project_number}/trips/{uuid}', { status: 422, service: 'navigation-connect' });
  const format = ['SIMPLE', 'ENCODED', 'S2ENCODED', 'GEO_JSON'].includes(routePolylineFormat) ? routePolylineFormat : 'SIMPLE';
  return providerRequest(`${NAVIGATION_CONNECT_URL}/${normalized}?routePolylineFormat=${encodeURIComponent(format)}`, { service: 'navigation-connect', headers: requestHeaders(config, { Authorization: `Bearer ${token}` }) });
}

export async function optimizeTours({ model, projectId: suppliedProjectId, validateOnly = false } = {}) {
  const config = await configuration();
  const token = oauthToken(config, 'routeOptimizationAccessToken', 'route-optimization');
  const cloudProjectId = projectId(config, suppliedProjectId);
  if (!model || typeof model !== 'object' || Array.isArray(model)) throw new GoogleMapsProviderError('Route Optimization requires a model object', { status: 422, service: 'route-optimization' });
  const payload = await providerRequest(`${ROUTE_OPTIMIZATION_URL}/projects/${encodeURIComponent(cloudProjectId)}:optimizeTours`, { method: 'POST', service: 'route-optimization', headers: requestHeaders(config, { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), body: { model, ...(validateOnly ? { validateOnly: true } : {}) }, timeoutMs: 30_000 });
  return { provider: 'google-route-optimization-api', ...payload };
}

async function groundingRequest(payload, sessionId = '') {
  const config = await configuration();
  const apiKey = serviceKey(config, 'groundingLiteApiKey', 'grounding-lite');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(GROUNDING_LITE_URL, { method: 'POST', headers: requestHeaders(config, { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18', 'X-Goog-Api-Key': apiKey, ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}) }), body: JSON.stringify(payload), signal: controller.signal });
    const raw = await boundedText(response, 'grounding-lite');
    const session = response.headers.get('mcp-session-id') || sessionId;
    if (!response.ok) throw new GoogleMapsProviderError(`Maps Grounding Lite request was rejected (${response.status})`, { status: response.status >= 400 && response.status < 500 ? response.status : 502, service: 'grounding-lite' });
    const lines = raw.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).filter(Boolean);
    let result = {};
    try { result = lines.length ? JSON.parse(lines.at(-1)) : (raw ? JSON.parse(raw) : {}); } catch { throw new GoogleMapsProviderError('Maps Grounding Lite returned an invalid MCP response', { status: 502, service: 'grounding-lite' }); }
    return { result, sessionId: session };
  } catch (error) {
    if (error instanceof GoogleMapsProviderError) throw error;
    throw new GoogleMapsProviderError(error?.name === 'AbortError' ? 'Maps Grounding Lite timed out' : 'Maps Grounding Lite could not be reached', { status: 503, service: 'grounding-lite' });
  } finally {
    clearTimeout(timer);
  }
}

export async function listGroundingLiteTools() {
  const initialized = await groundingRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'secureasset', version: 'v97' } } });
  await groundingRequest({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }, initialized.sessionId);
  const response = await groundingRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, initialized.sessionId);
  return response.result?.result || response.result;
}

export async function callGroundingLiteTool(name, args = {}) {
  const tool = text(name, 120);
  if (!/^[A-Za-z0-9_.-]+$/.test(tool)) throw new GoogleMapsProviderError('Invalid Maps Grounding Lite tool name', { status: 422, service: 'grounding-lite' });
  const initialized = await groundingRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'secureasset', version: 'v97' } } });
  await groundingRequest({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }, initialized.sessionId);
  const response = await groundingRequest({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args && typeof args === 'object' ? args : {} } }, initialized.sessionId);
  return response.result?.result || response.result;
}

function streetViewUploadUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.hostname !== 'streetviewpublish.googleapis.com') throw new Error('host');
    return url;
  } catch {
    throw new GoogleMapsProviderError('Street View returned an unsafe upload URL', { status: 502, service: 'streetview-publish' });
  }
}

export async function startStreetViewPhotoUpload() {
  const config = await configuration();
  const token = oauthToken(config, 'streetViewAccessToken', 'streetview-publish');
  const payload = await providerRequest(`${STREETVIEW_PUBLISH_URL}/photo:startUpload`, { method: 'POST', service: 'streetview-publish', headers: requestHeaders(config, { Authorization: `Bearer ${token}` }) });
  if (!payload.uploadUrl) throw new GoogleMapsProviderError('Street View Publish did not return an upload URL', { status: 502, service: 'streetview-publish' });
  return { ...payload, uploadUrl: streetViewUploadUrl(payload.uploadUrl).toString() };
}

export async function publishStreetViewPhoto({ buffer, mimeType = 'image/jpeg', latitude, longitude, heading, pitch, roll, altitude, placeId: associatedPlaceId } = {}) {
  const config = await configuration();
  const token = oauthToken(config, 'streetViewAccessToken', 'streetview-publish');
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 50 * 1024 * 1024) throw new GoogleMapsProviderError('Street View photo must be a non-empty file up to 50 MB', { status: 422, service: 'streetview-publish' });
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!/^image\/(?:jpeg|jpg|png)$/i.test(String(mimeType)) || (!isJpeg && !isPng)) throw new GoogleMapsProviderError('Street View Publish accepts a valid JPEG or PNG 360 photo', { status: 422, service: 'streetview-publish' });
  const upload = await startStreetViewPhotoUpload();
  const uploadController = new AbortController();
  const uploadTimer = setTimeout(() => uploadController.abort(), 30_000);
  let uploadResponse;
  try {
    uploadResponse = await fetch(streetViewUploadUrl(upload.uploadUrl), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType, 'X-Goog-Upload-Protocol': 'raw', 'X-Goog-Upload-Content-Length': String(buffer.length) }, body: buffer, signal: uploadController.signal });
  } catch {
    uploadResponse = null;
  } finally {
    clearTimeout(uploadTimer);
  }
  if (!uploadResponse?.ok) throw new GoogleMapsProviderError('Street View photo bytes could not be uploaded', { status: 502, service: 'streetview-publish' });
  const point = coordinate({ latitude, longitude }, 'Street View pose');
  const pose = { latLngPair: { latitude: point.latitude, longitude: point.longitude }, ...(Number.isFinite(Number(heading)) ? { heading: Number(heading) } : {}), ...(Number.isFinite(Number(pitch)) ? { pitch: Number(pitch) } : {}), ...(Number.isFinite(Number(roll)) ? { roll: Number(roll) } : {}), ...(Number.isFinite(Number(altitude)) ? { altitude: Number(altitude) } : {}) };
  const photo = await providerRequest(`${STREETVIEW_PUBLISH_URL}/photo`, { method: 'POST', service: 'streetview-publish', headers: requestHeaders(config, { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), body: { photo: { uploadReference: { uploadUrl: upload.uploadUrl }, pose, ...(text(associatedPlaceId, 200) ? { places: [{ placeId: placeId(associatedPlaceId) }] } : {}) } } });
  return { provider: 'google-street-view-publish-api', photo };
}

export function publicProviderError(error) {
  if (error instanceof GoogleMapsProviderError) return { statusCode: error.status, message: error.message, details: { service: error.service, providerCode: error.providerCode } };
  return { statusCode: 503, message: 'Google Maps Platform request failed', details: {} };
}

export const GOOGLE_MAPS_PLATFORM_ENDPOINTS = Object.freeze({ ROUTES_URL, ROUTE_MATRIX_URL, PLACES_URL, ADDRESS_VALIDATION_URL, ELEVATION_URL, ROADS_URL, NAVIGATION_CONNECT_URL, ROUTE_OPTIMIZATION_URL, GROUNDING_LITE_URL, STREETVIEW_PUBLISH_URL });

// Keep the env import intentionally referenced in this module so deployments
// with only environment-based credentials remain supported by maps.js.
void env;
