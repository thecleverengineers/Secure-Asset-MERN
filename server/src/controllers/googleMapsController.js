import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { getMapsConfiguration } from '../services/maps.js';
import {
  autocompletePlaces,
  callGroundingLiteTool,
  computeRouteMatrix,
  computeRoutes,
  createNavigationConnectTrip,
  elevation,
  getNavigationConnectTrip,
  getPlaceDetails,
  listGroundingLiteTools,
  nearestRoads,
  optimizeTours,
  publicProviderError,
  publishStreetViewPhoto,
  roadSpeedLimits,
  searchPlaces,
  snapToRoads,
  validateAddress,
} from '../services/googleMapsPlatform.js';

const coordinateSchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
}).refine((value) => value.latitude !== 0 || value.longitude !== 0, 'Coordinates cannot be 0,0');

function parse(schema, value, message) {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(422, message, result.error.flatten());
  return result.data;
}

async function withProvider(task) {
  try { return await task(); } catch (error) {
    const detail = publicProviderError(error);
    throw new ApiError(detail.statusCode, detail.message, detail.details);
  }
}

export const getMapsPlatformStatus = asyncHandler(async (_req, res) => {
  const configuration = await getMapsConfiguration();
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, data: {
    ...configuration,
    credentials: {
      browser: configuration.publicApiKeyConfigured,
      routes: configuration.routesApiKeyConfigured,
      places: configuration.placesApiKeyConfigured,
      addressValidation: configuration.addressValidationApiKeyConfigured,
      elevation: configuration.elevationApiKeyConfigured,
      roads: configuration.roadsApiKeyConfigured,
      navigationConnect: configuration.navigationConnectConfigured,
      routeOptimization: configuration.routeOptimizationConfigured,
      groundingLite: configuration.groundingLiteApiKeyConfigured,
      streetViewPublish: configuration.streetViewPublishConfigured,
    },
    security: {
      browserKeyMustBeHttpReferrerRestricted: true,
      serverCredentialsStayOnBackend: true,
      routeRequestsUseFieldMasks: true,
      upstreamTimeoutMs: 8000,
    },
  } });
});

export const computeRoutesController = asyncHandler(async (req, res) => {
  const body = parse(z.object({
    origin: coordinateSchema,
    destination: coordinateSchema,
    travelMode: z.enum(['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT', 'TWO_WHEELER']).optional(),
    intermediates: z.array(coordinateSchema).max(25).optional(),
    routingPreference: z.enum(['TRAFFIC_AWARE', 'TRAFFIC_AWARE_OPTIMAL', 'TRAFFIC_UNAWARE']).optional(),
    departureTime: z.string().datetime().optional(),
  }).strict(), req.body, 'Invalid route request');
  res.json({ success: true, data: await withProvider(() => computeRoutes(body)) });
});

export const computeRouteMatrixController = asyncHandler(async (req, res) => {
  const body = parse(z.object({
    origins: z.array(coordinateSchema).min(1).max(25),
    destinations: z.array(coordinateSchema).min(1).max(25),
    travelMode: z.enum(['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT', 'TWO_WHEELER']).optional(),
    routingPreference: z.enum(['TRAFFIC_AWARE', 'TRAFFIC_AWARE_OPTIMAL', 'TRAFFIC_UNAWARE']).optional(),
    departureTime: z.string().datetime().optional(), arrivalTime: z.string().datetime().optional(),
  }).strict().superRefine((value, context) => {
    const count = value.origins.length * value.destinations.length;
    if (count > 625) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Route Matrix is limited to 625 elements' });
    if (value.departureTime && value.arrivalTime) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide either departureTime or arrivalTime' });
    if ((value.travelMode === 'TRANSIT' || value.routingPreference === 'TRAFFIC_AWARE_OPTIMAL') && count > 100) context.addIssue({ code: z.ZodIssueCode.custom, message: 'This Route Matrix mode supports at most 100 elements' });
  }), req.body, 'Invalid route matrix request');
  res.json({ success: true, data: await withProvider(() => computeRouteMatrix(body)) });
});

export const validateAddressController = asyncHandler(async (req, res) => {
  const body = parse(z.object({
    addressLines: z.array(z.string().trim().min(1).max(200)).min(1).max(5),
    regionCode: z.string().trim().max(8).optional(), locality: z.string().trim().max(120).optional(),
    administrativeArea: z.string().trim().max(120).optional(), postalCode: z.string().trim().max(40).optional(), languageCode: z.string().trim().max(24).optional(),
  }).strict(), req.body, 'Invalid address validation request');
  res.json({ success: true, data: await withProvider(() => validateAddress(body)) });
});

export const autocompletePlacesController = asyncHandler(async (req, res) => {
  const body = parse(z.object({
    input: z.string().trim().min(2).max(200), sessionToken: z.string().trim().max(200).optional(),
    locationBias: z.object({ latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180), radius: z.coerce.number().min(1).max(50_000).optional() }).optional(),
    includedRegionCodes: z.array(z.string().trim().max(8)).max(15).optional(), languageCode: z.string().trim().max(24).optional(),
  }).strict(), req.body, 'Invalid Places Autocomplete request');
  res.json({ success: true, data: await withProvider(() => autocompletePlaces(body)) });
});

export const getPlaceDetailsController = asyncHandler(async (req, res) => {
  const id = String(req.params.placeId || '').trim();
  if (!id || id.length > 200) throw new ApiError(422, 'A valid Google Place ID is required');
  res.json({ success: true, data: await withProvider(() => getPlaceDetails(id)) });
});

export const searchPlacesController = asyncHandler(async (req, res) => {
  const body = parse(z.object({
    textQuery: z.string().trim().min(2).max(200), maxResultCount: z.coerce.number().int().min(1).max(20).optional(), includedType: z.string().trim().max(80).optional(), languageCode: z.string().trim().max(24).optional(),
    locationBias: z.object({ latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180), radius: z.coerce.number().min(1).max(50_000).optional() }).optional(),
  }).strict(), req.body, 'Invalid Places search request');
  res.json({ success: true, data: await withProvider(() => searchPlaces(body)) });
});

const pointsSchema = z.object({ points: z.array(coordinateSchema).min(1).max(100) }).strict();
export const elevationController = asyncHandler(async (req, res) => {
  const { points } = parse(pointsSchema, req.body, 'Invalid elevation request');
  res.json({ success: true, data: await withProvider(() => elevation(points)) });
});
export const snapToRoadsController = asyncHandler(async (req, res) => {
  const body = parse(pointsSchema.extend({ interpolate: z.boolean().optional() }), req.body, 'Invalid snap-to-roads request');
  res.json({ success: true, data: await withProvider(() => snapToRoads(body.points, body)) });
});
export const nearestRoadsController = asyncHandler(async (req, res) => {
  const { points } = parse(pointsSchema, req.body, 'Invalid nearest-roads request');
  res.json({ success: true, data: await withProvider(() => nearestRoads(points)) });
});
export const speedLimitsController = asyncHandler(async (req, res) => {
  const body = parse(z.object({
    points: z.array(coordinateSchema).min(1).max(100).optional(),
    placeIds: z.array(z.string().trim().min(1).max(200)).min(1).max(100).optional(),
    units: z.enum(['KPH', 'MPH']).optional(),
  }).strict().refine((value) => Boolean(value.points?.length) !== Boolean(value.placeIds?.length), 'Provide either points or road segment place IDs'), req.body, 'Invalid speed-limits request');
  res.json({ success: true, data: await withProvider(() => roadSpeedLimits(body)) });
});

export const getNavigationConnectTripController = asyncHandler(async (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name) throw new ApiError(422, 'Navigation Connect trip resource is required');
  const routePolylineFormat = String(req.query.routePolylineFormat || 'SIMPLE').trim().toUpperCase();
  if (!['SIMPLE', 'ENCODED', 'S2ENCODED', 'GEO_JSON'].includes(routePolylineFormat)) throw new ApiError(422, 'Invalid Navigation Connect polyline format');
  res.json({ success: true, data: await withProvider(() => getNavigationConnectTrip(name, routePolylineFormat)) });
});

export const createNavigationConnectTripController = asyncHandler(async (req, res) => {
  const body = parse(z.object({
    destination: coordinateSchema.optional(), destinationPlaceId: z.string().trim().max(200).optional(),
    androidAppId: z.string().trim().max(200).optional(), iosAppId: z.string().trim().max(200).optional(),
    enableHighFrequencyUpdates: z.boolean().optional(), enablePubsub: z.boolean().optional(), pubsubFieldMask: z.string().trim().max(500).optional(), enableRemainingRouteReporting: z.boolean().optional(),
  }).strict().refine((value) => value.destination || value.destinationPlaceId, 'A destination coordinate or Place ID is required'), req.body, 'Invalid Navigation Connect trip request');
  res.status(201).json({ success: true, data: await withProvider(() => createNavigationConnectTrip(body)) });
});

export const optimizeToursController = asyncHandler(async (req, res) => {
  const body = parse(z.object({ model: z.record(z.unknown()), projectId: z.string().trim().max(120).optional(), validateOnly: z.boolean().optional() }).strict(), req.body, 'Invalid Route Optimization request');
  res.json({ success: true, data: await withProvider(() => optimizeTours(body)) });
});

export const groundingToolsController = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await withProvider(() => listGroundingLiteTools()) });
});

export const groundingCallController = asyncHandler(async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(1).max(120), arguments: z.record(z.unknown()).optional() }).strict(), req.body, 'Invalid Maps Grounding Lite tool request');
  res.json({ success: true, data: await withProvider(() => callGroundingLiteTool(body.name, body.arguments || {})) });
});

export const publishStreetViewPhotoController = asyncHandler(async (req, res) => {
  if (!req.file?.buffer?.length) throw new ApiError(422, 'Attach a JPEG or PNG 360 photo');
  const body = parse(z.object({
    latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180),
    heading: z.coerce.number().min(0).max(359.9999).optional(), pitch: z.coerce.number().min(-90).max(90).optional(), roll: z.coerce.number().min(0).max(359.9999).optional(), altitude: z.coerce.number().min(-1000).max(100_000).optional(), placeId: z.string().trim().max(200).optional(),
  }).strict(), req.body, 'Invalid Street View pose');
  res.status(201).json({ success: true, data: await withProvider(() => publishStreetViewPhoto({ ...body, buffer: req.file.buffer, mimeType: req.file.mimetype })) });
});
