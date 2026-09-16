import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FieldData } from '../server/src/models/index.js';

const controller = fs.readFileSync(new URL('../server/src/controllers/surveyorFieldController.js', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../server/src/controllers/surveyWorkflowController.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../scripts/repair-field-data-index.js', import.meta.url), 'utf8');
const productionIndexes = fs.readFileSync(new URL('../scripts/lib/indexes.js', import.meta.url), 'utf8');

test('FieldData allows multiple online records without offline IDs', () => {
  const index = FieldData.schema.indexes().find(([keys]) => keys.surveyor === 1 && keys.offlineId === 1);
  assert.ok(index, 'surveyor/offlineId index should be declared');
  assert.equal(index[1].unique, true);
  assert.equal(index[1].sparse, undefined);
  assert.deepEqual(index[1].partialFilterExpression, { offlineId: { $type: 'string' } });
});

test('field-data sync is restricted, allowlisted, and retry-safe', () => {
  assert.match(controller, /const SYNC_FIELDS = \[/);
  assert.match(controller, /project\.surveyor, req\.user\._id/);
  assert.match(controller, /async function upsertOfflineFieldData/);
  assert.match(controller, /if \(!duplicateKey\(error\)\) throw error/);
  assert.match(controller, /upsert: false/);
  assert.match(controller, /offlineId, success: true/);
});

test('online hired-project saves reuse existing project field data', () => {
  assert.match(workflow, /project: project\._id, surveyor: req\.user\._id/);
  assert.match(workflow, /FieldData\.findOne\(\{ project: project\._id, surveyor: req\.user\._id \}\)\.sort\('-updatedAt'\)/);
});

test('deployment repairs both legacy FieldData indexes before model index verification', () => {
  assert.match(migration, /partialFilterExpression/);
  assert.match(migration, /dropIndex/);
  assert.match(migration, /duplicate surveyor\/offlineId records/);
  assert.match(migration, /OFFLINE_LOOKUP_KEYS = \{ offlineId: 1 \}/);
  assert.match(migration, /canRepairSparseOfflineLookupIndex/);
  assert.match(productionIndexes, /modelName: 'FieldData'/);
  assert.match(productionIndexes, /Legacy releases created the optional offline field-data lookup index with sparse=true/);
});
