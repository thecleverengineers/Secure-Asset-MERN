import { IntegrationSetting, SiteSetting } from '../models/index.js';
import { env } from '../config/env.js';
import { decryptAuthenticatedSecret } from '../utils/encryptedSecrets.js';
import { encryptIntegrationSecret } from './fast2sms.js';

export const MAP_DEFAULTS = Object.freeze({
  provider: 'google',
  publicApiKey: '',
  enabled: false,
  navigationEnabled: true,
  locationPickerEnabled: true,
  reverseGeocodeEnabled: true,
  directionsEnabled: true,
  serverRoutesEnabled: true,
  routesEnabled: true,
  placesEnabled: true,
  placesUiKitEnabled: true,
  addressValidationEnabled: true,
  elevationEnabled: true,
  roadsEnabled: true,
  routeOptimizationEnabled: false,
  navigationConnectEnabled: false,
  groundingLiteEnabled: false,
  streetViewPublishEnabled: false,
  useTraffic: true,
  routeRefreshSeconds: 10,
  locationUpdateSeconds: 5,
  maxRouteWaypoints: 25,
  cloudProjectId: '',
  regionCode: 'IN',
  languageCode: 'en-US',
  units: 'METRIC',
  navigationConnectAndroidAppId: '',
  navigationConnectIosAppId: '',
  mapId: '',
  defaultLatitude: 20.5937,
  defaultLongitude: 78.9629,
  defaultZoom: 15,
  travelMode: 'DRIVING',
});

const SECRET_KEYS = [
  'serverApiKey', 'geocodingApiKey', 'directionsApiKey', 'placesApiKey',
  'routesApiKey', 'elevationApiKey', 'roadsApiKey', 'addressValidationApiKey',
  'groundingLiteApiKey', 'navigationConnectAccessToken', 'routeOptimizationAccessToken', 'streetViewAccessToken',
];

const BOOLEAN_CONFIG_KEYS = [
  'enabled', 'navigationEnabled', 'locationPickerEnabled', 'reverseGeocodeEnabled', 'directionsEnabled',
  'serverRoutesEnabled', 'routesEnabled', 'placesEnabled', 'placesUiKitEnabled', 'addressValidationEnabled',
  'elevationEnabled', 'roadsEnabled', 'routeOptimizationEnabled', 'navigationConnectEnabled', 'groundingLiteEnabled',
  'streetViewPublishEnabled', 'useTraffic',
];

const SERVICE_ENV_KEYS = Object.freeze({
  serverApiKey: ['GOOGLE_MAPS_SERVER_API_KEY', 'GOOGLE_MAPS_API_KEY'],
  geocodingApiKey: ['GOOGLE_MAPS_GEOCODING_API_KEY', 'GOOGLE_MAPS_SERVER_API_KEY', 'GOOGLE_MAPS_API_KEY'],
  directionsApiKey: ['GOOGLE_MAPS_ROUTES_API_KEY', 'GOOGLE_MAPS_SERVER_API_KEY', 'GOOGLE_MAPS_API_KEY'],
  routesApiKey: ['GOOGLE_MAPS_ROUTES_API_KEY', 'GOOGLE_MAPS_SERVER_API_KEY', 'GOOGLE_MAPS_API_KEY'],
  placesApiKey: ['GOOGLE_MAPS_PLACES_API_KEY', 'GOOGLE_MAPS_SERVER_API_KEY', 'GOOGLE_MAPS_API_KEY'],
  elevationApiKey: ['GOOGLE_MAPS_ELEVATION_API_KEY', 'GOOGLE_MAPS_SERVER_API_KEY', 'GOOGLE_MAPS_API_KEY'],
  roadsApiKey: ['GOOGLE_MAPS_ROADS_API_KEY', 'GOOGLE_MAPS_SERVER_API_KEY', 'GOOGLE_MAPS_API_KEY'],
  addressValidationApiKey: ['GOOGLE_MAPS_ADDRESS_VALIDATION_API_KEY', 'GOOGLE_MAPS_SERVER_API_KEY', 'GOOGLE_MAPS_API_KEY'],
  groundingLiteApiKey: ['GOOGLE_MAPS_GROUNDING_LITE_API_KEY', 'GOOGLE_MAPS_SERVER_API_KEY', 'GOOGLE_MAPS_API_KEY'],
});

function isBrowserMapsKey(value) {
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(String(value || '').trim());
}

function storedMapSecrets(encrypted) {
  if (!encrypted) return {};
  try {
    const value = decryptAuthenticatedSecret(encrypted).value;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : { serverApiKey: value };
    } catch {
      // A single-key value keeps compatibility with a credential saved by an
      // early v90 build or manually migrated from the old integration shape.
      return { serverApiKey: value };
    }
  } catch {
    return {};
  }
}

function mapPublicConfiguration(siteMap = {}, integrationMap = {}) {
  const merged = { ...MAP_DEFAULTS, ...(siteMap || {}), ...(integrationMap || {}) };
  const booleans = Object.fromEntries(BOOLEAN_CONFIG_KEYS.map((key) => [key, merged[key] === true]));
  return {
    ...merged,
    ...booleans,
    // v97 is Google-only for routing, pinning and navigation. Do not silently
    // switch to an unrelated tile/geocoder provider when a Google service is
    // unavailable; surface the configuration problem to the operator.
    provider: String(merged.provider) === 'google' ? 'google' : MAP_DEFAULTS.provider,
    publicApiKey: String(merged.publicApiKey || merged.browserApiKey || '').trim(),
    cloudProjectId: String(merged.cloudProjectId || '').trim().slice(0, 120),
    regionCode: String(merged.regionCode || MAP_DEFAULTS.regionCode).trim().toUpperCase().slice(0, 8),
    languageCode: String(merged.languageCode || MAP_DEFAULTS.languageCode).trim().slice(0, 24),
    units: ['METRIC', 'IMPERIAL'].includes(String(merged.units)) ? String(merged.units) : MAP_DEFAULTS.units,
    routeRefreshSeconds: Math.min(Math.max(Number(merged.routeRefreshSeconds) || MAP_DEFAULTS.routeRefreshSeconds, 5), 120),
    locationUpdateSeconds: Math.min(Math.max(Number(merged.locationUpdateSeconds) || MAP_DEFAULTS.locationUpdateSeconds, 1), 60),
    maxRouteWaypoints: Math.min(Math.max(Number(merged.maxRouteWaypoints) || MAP_DEFAULTS.maxRouteWaypoints, 0), 25),
    mapId: String(merged.mapId || '').trim(),
    defaultLatitude: Number.isFinite(Number(merged.defaultLatitude)) ? Number(merged.defaultLatitude) : MAP_DEFAULTS.defaultLatitude,
    defaultLongitude: Number.isFinite(Number(merged.defaultLongitude)) ? Number(merged.defaultLongitude) : MAP_DEFAULTS.defaultLongitude,
    defaultZoom: Number.isFinite(Number(merged.defaultZoom)) ? Number(merged.defaultZoom) : MAP_DEFAULTS.defaultZoom,
    travelMode: ['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT'].includes(String(merged.travelMode)) ? String(merged.travelMode) : MAP_DEFAULTS.travelMode,
  };
}

async function loadMapsConfiguration() {
  const [record, site] = await Promise.all([
    IntegrationSetting.findOne({ key: 'maps' }).select('+secureConfig.authorizationEncrypted').lean(),
    SiteSetting.findOne({ key: 'default' }).select('map').lean(),
  ]);
  const config = mapPublicConfiguration(site?.map, record?.publicConfig);
  const stored = storedMapSecrets(record?.secureConfig?.authorizationEncrypted);
  // Never expose the generic/server key to a browser. A key restricted by
  // server IP cannot authorize Maps JavaScript and leaking it also weakens the
  // server boundary. The public key must be explicitly browser-scoped.
  const publicApiKeyCandidate = config.publicApiKey || env.GOOGLE_MAPS_BROWSER_API_KEY;
  // Do not send a malformed or server-scoped value to Maps JavaScript. Google
  // otherwise renders a watermarked map and reports the failure asynchronously,
  // which looks like a working map to the rest of the application.
  const publicApiKey = isBrowserMapsKey(publicApiKeyCandidate) ? String(publicApiKeyCandidate).trim() : '';
  const secrets = Object.fromEntries(Object.entries(SERVICE_ENV_KEYS).map(([key, envNames]) => {
    const configured = stored[key] || envNames.map((name) => env[name]).find(Boolean) || '';
    return [key, String(configured).trim()];
  }));
  // Keep the old compatibility shape explicit. Existing v90/v96 installations
  // may only have serverApiKey or directionsApiKey saved.
  secrets.serverApiKey ||= String(stored.serverApiKey || env.GOOGLE_MAPS_SERVER_API_KEY || env.GOOGLE_MAPS_API_KEY || '').trim();
  secrets.directionsApiKey ||= String(stored.directionsApiKey || secrets.routesApiKey || '').trim();
  secrets.placesApiKey ||= String(stored.placesApiKey || secrets.serverApiKey || '').trim();
  secrets.geocodingApiKey ||= String(stored.geocodingApiKey || secrets.serverApiKey || '').trim();
  for (const key of ['elevationApiKey', 'roadsApiKey', 'addressValidationApiKey', 'groundingLiteApiKey']) secrets[key] ||= secrets.serverApiKey;
  secrets.navigationConnectAccessToken = String(stored.navigationConnectAccessToken || env.GOOGLE_MAPS_NAVIGATION_CONNECT_ACCESS_TOKEN || '').trim();
  secrets.routeOptimizationAccessToken = String(stored.routeOptimizationAccessToken || env.GOOGLE_MAPS_ROUTE_OPTIMIZATION_ACCESS_TOKEN || '').trim();
  secrets.streetViewAccessToken = String(stored.streetViewAccessToken || env.GOOGLE_MAPS_STREETVIEW_ACCESS_TOKEN || '').trim();
  const integrationEnabled = record?.enabled;
  const enabled = integrationEnabled === undefined ? Boolean(config.enabled) : Boolean(integrationEnabled);
  const configured = Boolean(publicApiKey && (Object.values(secrets).some(Boolean) || config.serverRoutesEnabled === false));
  const status = record?.status === 'error'
    ? 'error'
    : !enabled ? 'disabled' : configured ? (record?.status === 'healthy' ? 'healthy' : 'configured') : 'degraded';
  return {
    id: record?._id,
    ...config,
    enabled,
    publicApiKey,
    publicApiKeyConfigured: Boolean(publicApiKey),
    browserApiKeyValid: Boolean(publicApiKey),
    serverApiKeyConfigured: Boolean(secrets.serverApiKey),
    serverCredentialConfigured: Object.values(secrets).some(Boolean),
    geocodingApiKeyConfigured: Boolean(secrets.geocodingApiKey),
    directionsApiKeyConfigured: Boolean(secrets.directionsApiKey),
    placesApiKeyConfigured: Boolean(secrets.placesApiKey),
    routesApiKeyConfigured: Boolean(secrets.routesApiKey),
    elevationApiKeyConfigured: Boolean(secrets.elevationApiKey),
    roadsApiKeyConfigured: Boolean(secrets.roadsApiKey),
    addressValidationApiKeyConfigured: Boolean(secrets.addressValidationApiKey),
    groundingLiteApiKeyConfigured: Boolean(secrets.groundingLiteApiKey),
    navigationConnectConfigured: Boolean(secrets.navigationConnectAccessToken && config.cloudProjectId),
    routeOptimizationConfigured: Boolean(secrets.routeOptimizationAccessToken && config.cloudProjectId),
    streetViewPublishConfigured: Boolean(secrets.streetViewAccessToken),
    services: {
      routes: Boolean(secrets.routesApiKey), places: Boolean(secrets.placesApiKey), placesUiKit: Boolean(publicApiKey && config.placesUiKitEnabled),
      addressValidation: Boolean(secrets.addressValidationApiKey), elevation: Boolean(secrets.elevationApiKey), roads: Boolean(secrets.roadsApiKey),
      routeOptimization: Boolean(secrets.routeOptimizationAccessToken && config.cloudProjectId), navigationConnect: Boolean(secrets.navigationConnectAccessToken && config.cloudProjectId),
      groundingLite: Boolean(secrets.groundingLiteApiKey), streetViewPublish: Boolean(secrets.streetViewAccessToken),
    },
    configured,
    status,
    lastCheckedAt: record?.lastCheckedAt || null,
    lastError: record?.lastError || '',
    ...secrets,
  };
}

// Route refreshes can arrive every few seconds from multiple field devices.
// Coalesce concurrent reads and keep only a short successful snapshot so the
// hot path does not perform a MongoDB read for every GPS update. A settings
// write explicitly invalidates this snapshot below; errors are never served
// from stale state.
const MAP_CONFIGURATION_CACHE_MS = 5_000;
let mapsConfigurationCache = null;
let mapsConfigurationCacheExpiresAt = 0;
let mapsConfigurationInFlight = null;

export async function getMapsConfiguration({ includeSecrets = false } = {}) {
  const now = Date.now();
  if (!mapsConfigurationCache || mapsConfigurationCacheExpiresAt <= now) {
    if (!mapsConfigurationInFlight) {
      mapsConfigurationInFlight = loadMapsConfiguration()
        .then((value) => { mapsConfigurationCache = value; mapsConfigurationCacheExpiresAt = Date.now() + MAP_CONFIGURATION_CACHE_MS; return value; })
        .finally(() => { mapsConfigurationInFlight = null; });
    }
    await mapsConfigurationInFlight;
  }
  const full = mapsConfigurationCache;
  if (includeSecrets) return full;
  const safe = { ...full };
  SECRET_KEYS.forEach((key) => { delete safe[key]; });
  return safe;
}

export function invalidateMapsConfigurationCache() {
  mapsConfigurationCache = null;
  mapsConfigurationCacheExpiresAt = 0;
}

export function buildMapsSettingsUpdate({ config = {}, secretValues = {}, existingAuthorizationEncrypted = '', updatedBy } = {}) {
  const publicConfig = { ...MAP_DEFAULTS, ...config, publicApiKey: String(config.publicApiKey || '').trim(), mapId: String(config.mapId || '').trim(), cloudProjectId: String(config.cloudProjectId || '').trim() };
  const previousSecrets = storedMapSecrets(existingAuthorizationEncrypted);
  const mergedSecrets = { ...previousSecrets };
  for (const key of SECRET_KEYS) {
    const value = String(secretValues[key] || '').trim();
    if (value) mergedSecrets[key] = value;
  }
  const hasBrowserKey = isBrowserMapsKey(publicConfig.publicApiKey || env.GOOGLE_MAPS_BROWSER_API_KEY);
  const hasServerKey = Boolean(Object.values(mergedSecrets).some(Boolean) || env.GOOGLE_MAPS_SERVER_API_KEY || env.GOOGLE_MAPS_GEOCODING_API_KEY || env.GOOGLE_MAPS_API_KEY);
  const enabled = Boolean(config.enabled);
  const status = !enabled ? 'disabled' : hasBrowserKey && (hasServerKey || config.reverseGeocodeEnabled === false) ? 'configured' : 'degraded';
  const set = {
    provider: String(config.provider || MAP_DEFAULTS.provider), category: 'maps', enabled, status,
    publicConfig,
    envRequirements: ['GOOGLE_MAPS_BROWSER_API_KEY', 'GOOGLE_MAPS_ROUTES_API_KEY', 'GOOGLE_MAPS_PLACES_API_KEY', 'GOOGLE_MAPS_ADDRESS_VALIDATION_API_KEY'],
    updatedBy, lastError: '',
  };
  if (Object.keys(mergedSecrets).length) set['secureConfig.authorizationEncrypted'] = encryptIntegrationSecret(JSON.stringify(mergedSecrets));
  return { $set: set };
}
