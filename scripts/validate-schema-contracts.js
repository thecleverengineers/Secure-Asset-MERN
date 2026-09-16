import mongoose from 'mongoose';
import {
  Property,
  Application,
  FieldData,
  SurveyorVerification,
  SurveyEquipment,
  PropertyTypeConfig,
  Facility,
  FacilityBooking,
  Payment,
} from '../server/src/models/index.js';

const errors = [];

function assertSubdocumentArray(Model, path, requiredPaths) {
  const schemaPath = Model.schema.path(path);
  const childSchema = schemaPath?.schema;
  if (!childSchema) {
    errors.push(`${Model.modelName}.${path} must be a subdocument array, not a primitive array.`);
    return;
  }
  for (const [childPath, expected] of Object.entries(requiredPaths)) {
    const actual = childSchema.path(childPath)?.instance;
    if (actual !== expected) errors.push(`${Model.modelName}.${path}.${childPath} must be ${expected}; found ${actual || 'missing'}.`);
  }
}

assertSubdocumentArray(Property, 'map.nearbyPlaces', { name: 'String', distance: 'String', type: 'String' });
assertSubdocumentArray(Application, 'vehicles', { type: 'String', registration: 'String' });
assertSubdocumentArray(Application, 'pets', { type: 'String', count: 'Number' });
assertSubdocumentArray(SurveyorVerification, 'documents', { type: 'String', url: 'String' });
assertSubdocumentArray(FieldData, 'measurements', { type: 'String', label: 'String', value: 'Number', unit: 'String' });
assertSubdocumentArray(FieldData, 'calculations', { type: 'String', formula: 'String' });
assertSubdocumentArray(FieldData, 'media', { type: 'String', url: 'String' });
assertSubdocumentArray(SurveyEquipment, 'maintenanceHistory', { type: 'String', date: 'Date' });
assertSubdocumentArray(PropertyTypeConfig, 'fields', { key: 'String', label: 'String', type: 'String' });
assertSubdocumentArray(Facility, 'availableTimeSlots', { start: 'String', end: 'String' });

if (Payment.schema.path('facilityBooking')?.options?.ref !== 'FacilityBooking') errors.push('Payment.facilityBooking must reference FacilityBooking.');
const paymentTypeValues = Payment.schema.path('type')?.enumValues || [];
if (!paymentTypeValues.includes('facility_booking')) errors.push('Payment.type must include facility_booking.');


for (const [name, Model] of Object.entries(mongoose.models)) {
  const declaredIndexes = Model.schema.indexes();
  const textIndexes = declaredIndexes.filter(([keys]) => Object.values(keys).includes('text'));
  if (textIndexes.length > 1) errors.push(`${name} declares ${textIndexes.length} text indexes. MongoDB permits only one text index per collection.`);
  for (const [keys, options] of textIndexes) if (!options?.name) errors.push(`${name} text index ${JSON.stringify(keys)} must have a stable explicit name.`);

  const signatures = new Map();
  for (const [keys, options] of declaredIndexes) {
    const signature = JSON.stringify(keys);
    if (signatures.has(signature)) errors.push(`${name} declares duplicate indexes on ${signature}.`);
    signatures.set(signature, options);
  }
}

const sampleId = new mongoose.Types.ObjectId();
const validationSamples = [
  new FieldData({ project: sampleId, surveyor: sampleId, measurements: [{ type: 'distance', label: 'North boundary', value: 52.4, unit: 'm' }], calculations: [{ type: 'area', formula: 'length*width', inputs: { length: 10, width: 5 }, output: 50, unit: 'sqm' }], media: [{ type: 'photo', url: '/test.jpg' }] }),
  new Application({ applicant: sampleId, vehicles: [{ type: 'car', registration: 'NL-01-A-0001' }], pets: [{ type: 'dog', count: 1 }] }),
  new Property({ title: 'Schema Test', type: 'house', map: { nearbyPlaces: [{ name: 'Hospital', distance: '1 km', type: 'health' }] } }),
  new Facility({ property: sampleId, owner: sampleId, name: 'Clubhouse', type: 'clubhouse', availableDays: ['monday'], availableTimeSlots: [{ start: '09:00', end: '18:00' }] }),
  new FacilityBooking({ facility: sampleId, property: sampleId, owner: sampleId, requester: sampleId, startAt: new Date('2026-06-29T10:00:00Z'), endAt: new Date('2026-06-29T11:00:00Z') }),
];
for (const document of validationSamples) {
  const error = document.validateSync();
  if (error) errors.push(`${document.constructor.modelName} representative validation failed: ${error.message}`);
}

if (errors.length) {
  console.error('Schema contract validation failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Schema contracts and representative documents passed for ${Object.keys(mongoose.models).length} models.`);
