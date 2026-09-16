import mongoose from 'mongoose';
import { resources } from '../server/src/services/resources.js';
import { LEGACY_ROLE_KEYS, ROLE_KEYS } from '../server/src/services/rbac.js';
import '../server/src/models/index.js';

const roles = new Set([...ROLE_KEYS, ...LEGACY_ROLE_KEYS]);
const errors = [];
const warnings = [];

function rootPath(value) { return String(value).split('.')[0]; }
function hasSchemaPath(schema, value) { return schema.pathType(value) !== 'adhocOrUndefined' || schema.pathType(rootPath(value)) !== 'adhocOrUndefined'; }
for (const [name, config] of Object.entries(resources)) {
  if (!config?.model?.schema) { errors.push(`${name} has no valid Mongoose model`); continue; }
  for (const key of ['readRoles', 'createRoles', 'updateRoles', 'deleteRoles', 'search', 'writable']) {
    if (!Array.isArray(config[key])) errors.push(`${name}.${key} must be an array`);
  }
  for (const key of ['readRoles', 'createRoles', 'updateRoles', 'deleteRoles']) {
    for (const role of config[key] || []) if (!roles.has(role)) errors.push(`${name}.${key} contains unknown role ${role}`);
  }
  for (const role of [...(config.createRoles || []), ...(config.updateRoles || []), ...(config.deleteRoles || [])]) {
    if (!(config.readRoles || []).includes(role)) errors.push(`${name} grants mutation to ${role} without read access`);
  }
  for (const field of config.writable || []) {
    if (!hasSchemaPath(config.model.schema, field)) errors.push(`${name}.writable references missing schema path ${field}`);
  }
  for (const field of config.search || []) {
    if (!hasSchemaPath(config.model.schema, field)) warnings.push(`${name}.search references non-schema/Mixed path ${field}`);
  }
  for (const field of Array.isArray(config.populate) ? config.populate : config.populate ? [config.populate] : []) {
    if (!hasSchemaPath(config.model.schema, field)) errors.push(`${name}.populate references missing schema path ${field}`);
  }
}

for (const [name, Model] of Object.entries(mongoose.models)) {
  const textIndexes = Model.schema.indexes().filter(([keys]) => Object.values(keys).includes('text'));
  if (textIndexes.length > 1) errors.push(`${name} has more than one declared text index`);
}

if (warnings.length) {
  console.warn('Feature contract warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}
if (errors.length) {
  console.error('Feature contract verification failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Feature contracts passed for ${Object.keys(resources).length} resources and ${Object.keys(mongoose.models).length} models.`);
