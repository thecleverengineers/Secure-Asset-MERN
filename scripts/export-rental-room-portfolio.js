import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildRentalUnits, ROOM_SEED_VERSION } from './seed-rental-room-portfolio.js';

const landlordId = String(process.env.TARGET_USER_ID || '').trim();
const inputFile = path.resolve(process.env.PROPERTIES_FILE || '/workspace/scratch/secureasset-atlas-import/properties.json');
const outputDirectory = path.resolve(process.env.OUTPUT_DIR || '/workspace/scratch/secureasset-atlas-import');
if (!/^[a-f\d]{24}$/i.test(landlordId)) throw new Error('TARGET_USER_ID must be a 24-character MongoDB ObjectId');

const rawProperties = JSON.parse(await readFile(inputFile, 'utf8'));
const now = new Date('2026-09-21T12:00:00.000Z');
const units = buildRentalUnits(rawProperties, landlordId, now);

function extended(value) {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (value?._bsontype === 'ObjectId') return { $oid: value.toHexString() };
  if (Array.isArray(value)) return value.map(extended);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, extended(item)]));
  return value;
}

function shell(value) {
  if (value instanceof Date) return `ISODate(${JSON.stringify(value.toISOString())})`;
  if (value?._bsontype === 'ObjectId') return `ObjectId(${JSON.stringify(value.toHexString())})`;
  if (Array.isArray(value)) return `[${value.map(shell).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}:${shell(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

const summaries = rawProperties.filter((property) => property.purpose === 'rent').map((property) => {
  const id = property._id.$oid;
  const propertyUnits = units.filter((unit) => String(unit.property) === id);
  return {
    _id: property._id,
    totalUnits: 10,
    occupiedUnits: 0,
    status: 'available',
    rentalSummary: {
      totalUnits: 10,
      availableUnits: 10,
      occupiedUnits: 0,
      startingMonthlyRent: Math.min(...propertyUnits.map((unit) => unit.pricing.monthlyRent)),
      lastSyncedAt: { $date: now.toISOString() },
    },
    updatedBy: { $oid: landlordId },
    updatedAt: { $date: now.toISOString() },
  };
});

const audit = {
  _id: { $oid: units[0]._id.toHexString().replace(/^./, 'f') },
  user: { $oid: landlordId },
  role: 'system',
  action: 'seed_global_rental_rooms',
  module: 'rental-units',
  updatedValue: { seedVersion: ROOM_SEED_VERSION, rooms: 200, roomsPerProperty: 10, galleryImages: 1200 },
  createdAt: { $date: now.toISOString() },
  __v: 0,
};

const roomPipeline = `{$limit:1},{$project:{docs:${shell(units)}}},{$unwind:"$docs"},{$replaceWith:"$docs"},{$merge:{into:"rentalunits",on:"_id",whenMatched:"replace",whenNotMatched:"insert"}}`;
const summaryPipeline = `{$limit:1},{$project:{docs:${shell(summaries.map((item) => ({ ...item, _id: { _bsontype: 'ObjectId', toHexString: () => item._id.$oid }, updatedBy: { _bsontype: 'ObjectId', toHexString: () => landlordId }, updatedAt: now, rentalSummary: { ...item.rentalSummary, lastSyncedAt: now } })))}}},{$unwind:"$docs"},{$replaceWith:"$docs"},{$merge:{into:"properties",on:"_id",whenMatched:[{$set:{totalUnits:"$$new.totalUnits",occupiedUnits:"$$new.occupiedUnits",status:"$$new.status",rentalSummary:"$$new.rentalSummary",updatedBy:"$$new.updatedBy",updatedAt:"$$new.updatedAt"}}],whenNotMatched:"discard"}}`;
const auditPipeline = `{$limit:1},{$project:{docs:[${shell({ ...audit, _id: { _bsontype: 'ObjectId', toHexString: () => audit._id.$oid }, user: { _bsontype: 'ObjectId', toHexString: () => landlordId }, createdAt: now })}]}},{$unwind:"$docs"},{$replaceWith:"$docs"},{$merge:{into:"auditlogs",on:"_id",whenMatched:"replace",whenNotMatched:"insert"}}`;

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDirectory, 'rentalunits.json'), JSON.stringify(units.map(extended), null, 2)),
  writeFile(path.join(outputDirectory, 'rental-property-summaries.json'), JSON.stringify(summaries, null, 2)),
  writeFile(path.join(outputDirectory, 'rentalunits.pipeline.js'), roomPipeline),
  writeFile(path.join(outputDirectory, 'rental-property-summaries.pipeline.js'), summaryPipeline),
  writeFile(path.join(outputDirectory, 'rental-room-audit.pipeline.js'), auditPipeline),
]);

console.log(JSON.stringify({ outputDirectory, properties: summaries.length, rentalUnits: units.length, galleryImages: units.length * 6 }, null, 2));
