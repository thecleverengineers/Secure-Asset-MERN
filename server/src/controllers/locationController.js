import { City, Country, State } from 'country-state-city';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { reverseGeocodeCoordinates } from '../services/googleMapsPlatform.js';

const countries = Country.getAllCountries()
  .map(({ name, isoCode, phonecode, flag }) => ({ name, isoCode, phonecode, flag }))
  .sort((left, right) => left.name.localeCompare(right.name));

function code(value, label) {
  const result = String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,8}$/.test(result)) throw new ApiError(422, `Select a valid ${label}`);
  return result;
}

export const listCountries = asyncHandler(async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.json({ success: true, data: countries });
});

export const listStates = asyncHandler(async (req, res) => {
  const countryCode = code(req.query.country, 'country');
  const rows = State.getStatesOfCountry(countryCode)
    .map(({ name, isoCode }) => ({ name, isoCode, countryCode }))
    .sort((left, right) => left.name.localeCompare(right.name));
  res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.json({ success: true, data: rows });
});

export const listCities = asyncHandler(async (req, res) => {
  const countryCode = code(req.query.country, 'country');
  const stateCode = req.query.state ? code(req.query.state, 'state or province') : '';
  const source = stateCode ? City.getCitiesOfState(countryCode, stateCode) : (City.getCitiesOfCountry(countryCode) || []);
  const rows = source
    .map(({ name, latitude, longitude, stateCode: cityStateCode }) => ({ name, countryCode, stateCode: cityStateCode || stateCode, latitude, longitude }))
    .sort((left, right) => left.name.localeCompare(right.name));
  res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.json({ success: true, data: rows });
});


function numberParam(value, label, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new ApiError(422, `Enter a valid ${label}`);
  return number;
}

function cleanAddressPart(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function firstValue(address = {}, keys = []) {
  for (const key of keys) {
    const value = cleanAddressPart(address[key]);
    if (value) return value;
  }
  return '';
}

function normalizeReverseAddress(address = {}, fallback = {}) {
  const country = firstValue(address, ['country']) || fallback.country || '';
  const state = firstValue(address, ['state', 'province', 'region', 'state_district']) || fallback.state || '';
  const city = firstValue(address, ['city', 'town', 'village', 'municipality', 'county', 'district']) || fallback.city || '';
  const locality = firstValue(address, ['suburb', 'neighbourhood', 'quarter', 'hamlet', 'city_district', 'locality']) || fallback.locality || '';
  const landmark = firstValue(address, ['road', 'pedestrian', 'footway', 'building', 'amenity', 'attraction']) || fallback.landmark || '';
  const pinCode = firstValue(address, ['postcode', 'postal_code']) || fallback.pinCode || '';
  return { country, state, city, locality, landmark, pinCode };
}

async function googleReverseGeocode(latitude, longitude) {
  const resolved = await reverseGeocodeCoordinates({ latitude, longitude });
  const result = resolved?.result;
  if (!result) return null;
  const address = {};
  for (const component of result.address_components || []) {
    const types = component.types || [];
    if (types.includes('country')) address.country = component.long_name;
    if (types.includes('administrative_area_level_1')) address.state = component.long_name;
    if (types.includes('locality')) address.city = component.long_name;
    if (!address.city && types.includes('administrative_area_level_2')) address.city = component.long_name;
    if (types.includes('sublocality') || types.includes('sublocality_level_1')) address.suburb = component.long_name;
    if (types.includes('route')) address.road = component.long_name;
    if (types.includes('postal_code')) address.postcode = component.long_name;
  }
  return { ...normalizeReverseAddress(address), fullAddress: cleanAddressPart(result.formatted_address), provider: 'google' };
}

export const reverseGeocode = asyncHandler(async (req, res) => {
  const latitude = numberParam(req.query.lat, 'latitude', -90, 90);
  const longitude = numberParam(req.query.lng ?? req.query.lon, 'longitude', -180, 180);
  let resolved = null;
  try { resolved = await googleReverseGeocode(latitude, longitude); } catch { resolved = null; }
  if (!resolved) throw new ApiError(503, 'Address auto-fill is temporarily unavailable. Coordinates were captured successfully.');
  res.set('Cache-Control', 'private, max-age=3600');
  res.json({
    success: true,
    data: {
      ...resolved,
      latitude,
      longitude,
      googleMapsLocation: `https://www.google.com/maps?q=${latitude},${longitude}`,
    },
  });
});
