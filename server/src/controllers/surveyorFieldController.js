import { FieldData, SurveyProject } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

const SYNC_FIELDS = [
  'visit', 'syncStatus', 'observedAt', 'weather', 'teamMembers', 'equipmentUsed', 'gpsCoordinates',
  'boundaryPoints', 'measurements', 'fieldNotes', 'observations', 'calculations', 'media', 'voiceNotes',
  'sketches', 'clientSignature', 'surveyorSignature', 'validation', 'revisions',
];

function sameId(a, b) { return a && b && String(a?._id || a) === String(b?._id || b); }
function distance(a, b) { const dx = Number(b.x ?? b.longitude ?? 0) - Number(a.x ?? a.longitude ?? 0); const dy = Number(b.y ?? b.latitude ?? 0) - Number(a.y ?? a.latitude ?? 0); return Math.sqrt(dx * dx + dy * dy); }
function polygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) throw new ApiError(422, 'At least three coordinate points are required');
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]; const b = points[(i + 1) % points.length];
    sum += Number(a.x ?? a.longitude ?? 0) * Number(b.y ?? b.latitude ?? 0) - Number(b.x ?? b.longitude ?? 0) * Number(a.y ?? a.latitude ?? 0);
  }
  return Math.abs(sum) / 2;
}
function convertUnit(value, from, to) {
  const length = { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, ft: 0.3048, yard: 0.9144, mile: 1609.344 };
  const area = { sqm: 1, sqft: 0.09290304, acre: 4046.8564224, hectare: 10000, sqkm: 1000000 };
  const table = length[from] && length[to] ? length : area[from] && area[to] ? area : null;
  if (!table) throw new ApiError(422, 'Unsupported unit conversion');
  return Number(value) * table[from] / table[to];
}
function calculate(type, input) {
  switch (type) {
    case 'plot_area': return { output: polygonArea(input.points), unit: input.unit || 'square_units', formula: 'Shoelace polygon formula' };
    case 'perimeter': {
      const points = input.points || []; if (points.length < 2) throw new ApiError(422, 'At least two points are required');
      let output = 0; for (let i = 0; i < points.length; i += 1) output += distance(points[i], points[(i + 1) % points.length]);
      return { output, unit: input.unit || 'units', formula: 'Sum of segment distances' };
    }
    case 'distance': return { output: distance(input.a, input.b), unit: input.unit || 'units', formula: '√((x₂-x₁)²+(y₂-y₁)²)' };
    case 'elevation_difference': return { output: Number(input.end) - Number(input.start), unit: input.unit || 'm', formula: 'End elevation - Start elevation' };
    case 'slope': {
      const rise = Number(input.rise); const run = Number(input.run); if (!run) throw new ApiError(422, 'Run must be greater than zero');
      return { output: (rise / run) * 100, unit: '%', formula: '(Rise ÷ Run) × 100' };
    }
    case 'volume': return { output: Number(input.length) * Number(input.width) * Number(input.height), unit: input.unit || 'cubic_units', formula: 'Length × Width × Height' };
    case 'built_up_area': return { output: Number(input.length) * Number(input.width) * Number(input.floors || 1), unit: input.unit || 'sqft', formula: 'Length × Width × Floors' };
    case 'carpet_area': return { output: Number(input.builtUpArea) * (1 - Number(input.wallAndCommonPercent || 20) / 100), unit: input.unit || 'sqft', formula: 'Built-up area × (1 - deductions %)' };
    case 'land_valuation': return { output: Number(input.area) * Number(input.ratePerUnit), unit: input.currency || 'INR', formula: 'Area × Rate per unit' };
    case 'quantity_estimate': return { output: Number(input.quantity) * Number(input.unitRate), unit: input.currency || 'INR', formula: 'Quantity × Unit rate' };
    case 'unit_conversion': return { output: convertUnit(input.value, input.from, input.to), unit: input.to, formula: `${input.from} to ${input.to} conversion` };
    default: throw new ApiError(422, 'Unsupported calculation type');
  }
}

function duplicateKey(error) { return error?.code === 11000 || error?.codeName === 'DuplicateKey'; }

async function upsertOfflineFieldData(query, update) {
  try {
    return await FieldData.findOneAndUpdate(
      query,
      { $set: update, $setOnInsert: { createdBy: update.surveyor } },
      { new: true, upsert: true, runValidators: true },
    );
  } catch (error) {
    // Two tabs or two queued sync workers can race on the same offline ID.
    // Once the winner has inserted the record, retry as an update so the
    // client receives a successful, idempotent result instead of E11000.
    if (!duplicateKey(error)) throw error;
    const existing = await FieldData.findOneAndUpdate(
      query,
      { $set: update },
      { new: true, runValidators: true, upsert: false },
    );
    if (existing) return existing;
    throw error;
  }
}

export const syncFieldData = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 100) : [];
  if (!items.length) throw new ApiError(422, 'No offline field records supplied');
  const results = [];
  for (const rawItem of items) {
    const item = rawItem && typeof rawItem === 'object' && !Array.isArray(rawItem) ? rawItem : {};
    const offlineId = typeof item.offlineId === 'string' ? item.offlineId.trim() : '';
    if (!offlineId || !item.project) { results.push({ offlineId: offlineId || null, success: false, message: 'offlineId and project are required' }); continue; }
    try {
      const project = await SurveyProject.findById(item.project).lean();
      if (!project || !sameId(project.surveyor, req.user._id)) throw new ApiError(403, 'Project access denied');
      if (['completed', 'cancelled'].includes(String(project.workflowStage || '')) || project.status === 'cancelled') {
        throw new ApiError(409, 'Field data cannot be changed after this survey project is closed');
      }
      const update = Object.fromEntries(SYNC_FIELDS.filter((field) => item[field] !== undefined).map((field) => [field, item[field]]));
      Object.assign(update, { project: project._id, offlineId, surveyor: req.user._id, syncStatus: 'synced', updatedBy: req.user._id });
      const record = await upsertOfflineFieldData(
        { surveyor: req.user._id, offlineId },
        update,
      );
      results.push({ offlineId, success: true, id: record._id });
    } catch (error) { results.push({ offlineId, success: false, message: duplicateKey(error) ? 'This offline field record was changed concurrently; retry the same record.' : error.message }); }
  }
  res.json({ success: true, data: results });
});

export const performCalculation = asyncHandler(async (req, res) => {
  const fieldData = await FieldData.findOne({ _id: req.params.id, surveyor: req.user._id });
  if (!fieldData) throw new ApiError(404, 'Field data record not found');
  const result = calculate(String(req.body.type || ''), req.body.input || {});
  const entry = { type: req.body.type, inputs: req.body.input, formula: result.formula, output: result.output, unit: result.unit, calculatedBy: req.user._id, calculatedAt: new Date(), approved: false };
  fieldData.calculations.push(entry); fieldData.updatedBy = req.user._id; await fieldData.save();
  res.json({ success: true, data: entry });
});

export const approveCalculation = asyncHandler(async (req, res) => {
  const fieldData = await FieldData.findOne({ _id: req.params.id, surveyor: req.user._id });
  if (!fieldData) throw new ApiError(404, 'Field data record not found');
  const calculation = fieldData.calculations.id(req.params.calculationId);
  if (!calculation) throw new ApiError(404, 'Calculation not found');
  calculation.approved = true; calculation.approvedBy = req.user._id; fieldData.updatedBy = req.user._id; await fieldData.save();
  res.json({ success: true, data: calculation });
});

export const exportGeoJson = asyncHandler(async (req, res) => {
  const project = await SurveyProject.findById(req.params.projectId).lean();
  if (!project || (!sameId(project.surveyor, req.user._id) && !sameId(project.client, req.user._id) && req.user.role !== 'admin')) throw new ApiError(403, 'Project access denied');
  const rows = await FieldData.find({ project: project._id }).lean();
  const features = [];
  for (const row of rows) {
    if (row.boundaryPoints?.length >= 3) features.push({ type: 'Feature', properties: { fieldDataId: row._id, kind: 'boundary' }, geometry: { type: 'Polygon', coordinates: [[...row.boundaryPoints.map((p) => [p.longitude, p.latitude]), [row.boundaryPoints[0].longitude, row.boundaryPoints[0].latitude]]] } });
    for (const point of row.gpsCoordinates || []) features.push({ type: 'Feature', properties: { fieldDataId: row._id, label: point.label, elevation: point.elevation, accuracy: point.accuracy }, geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] } });
  }
  res.setHeader('Content-Type', 'application/geo+json');
  res.setHeader('Content-Disposition', `attachment; filename="${project.projectNumber || project._id}.geojson"`);
  res.json({ type: 'FeatureCollection', features });
});

export const exportKml = asyncHandler(async (req, res) => {
  const project = await SurveyProject.findById(req.params.projectId).lean();
  if (!project || (!sameId(project.surveyor, req.user._id) && !sameId(project.client, req.user._id) && req.user.role !== 'admin')) throw new ApiError(403, 'Project access denied');
  const rows = await FieldData.find({ project: project._id }).lean();
  const placemarks = [];
  for (const row of rows) {
    if (row.boundaryPoints?.length >= 3) {
      const coords = [...row.boundaryPoints, row.boundaryPoints[0]].map((p) => `${p.longitude},${p.latitude},0`).join(' ');
      placemarks.push(`<Placemark><name>Boundary</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`);
    }
    for (const point of row.gpsCoordinates || []) placemarks.push(`<Placemark><name>${String(point.label || 'Point').replace(/[<>&]/g, '')}</name><Point><coordinates>${point.longitude},${point.latitude},${point.elevation || 0}</coordinates></Point></Placemark>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${project.projectNumber || project._id}</name>${placemarks.join('')}</Document></kml>`;
  res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
  res.setHeader('Content-Disposition', `attachment; filename="${project.projectNumber || project._id}.kml"`);
  res.send(xml);
});
