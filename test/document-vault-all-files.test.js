import assert from 'node:assert/strict';
import test from 'node:test';
import { DriveFile, DriveFolder, DriveShare, DriveUsage } from '../server/src/models/index.js';
import { listItems } from '../server/src/controllers/driveController.js';

const owner = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const other = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const fixtures = [
  { _id: 'root', owner, folder: null, status: 'active' },
  { _id: 'pan', owner, folder: 'pan-folder', status: 'active' },
  { _id: 'passport', owner, folder: 'passport-folder', status: 'active' },
  { _id: 'deleted', owner, folder: 'pan-folder', status: 'trashed' },
  { _id: 'someone-else', owner: other, folder: 'pan-folder', status: 'active' },
];
function query(value) {
  return { sort() { return this; }, lean: async () => value, then(resolve) { return Promise.resolve(value).then(resolve); } };
}
function prepare(t) {
  t.mock.method(DriveFolder, 'find', filter => query(filter.systemKey?.$in?.map(systemKey => ({ _id: systemKey, systemKey, owner })) || []));
  t.mock.method(DriveFolder, 'findOneAndUpdate', async filter => ({ ...filter, _id: filter.systemKey }));
  t.mock.method(DriveUsage, 'updateOne', async () => ({}));
  return t.mock.method(DriveFile, 'find', filter => query(fixtures.filter(file => Object.entries(filter).every(([key, value]) => file[key] === value))));
}
async function invoke(filters) {
  let error, response;
  await listItems({ user: { _id: owner, email: 'fixture@example.test' }, query: filters }, { json(value) { response = value; } }, value => { error = value; });
  return { error, response };
}

test('all-document listing includes every owned active category and excludes other owners and trash', async t => {
  const find = prepare(t);
  const { error, response } = await invoke({ scope: 'all', owner: other });
  assert.ifError(error);
  assert.deepEqual(response.data.files.map(file => file._id), ['root', 'pan', 'passport']);
  assert.deepEqual(response.data.folders, []);
  assert.equal(find.mock.calls[0].arguments[0].owner, owner);
});

test('default root listing still excludes files in child folders', async t => {
  prepare(t);
  const { error, response } = await invoke({});
  assert.ifError(error);
  assert.deepEqual(response.data.files.map(file => file._id), ['root']);
});

test('an explicit folder stays scoped even when all-document scope is supplied', async t => {
  prepare(t);
  t.mock.method(DriveFolder, 'findById', () => query({ _id: 'pan-folder', owner }));
  const { error, response } = await invoke({ scope: 'all', folderId: 'pan-folder' });
  assert.ifError(error);
  assert.deepEqual(response.data.files.map(file => file._id), ['pan']);
});

test('all-document scope cannot bypass an explicit folder access check', async t => {
  const find = prepare(t);
  t.mock.method(DriveFolder, 'findById', () => query({ _id: 'private-folder', owner: other, ancestors: [] }));
  t.mock.method(DriveShare, 'findOne', () => query(null));
  const { error, response } = await invoke({ scope: 'all', folderId: 'private-folder' });
  assert.equal(error?.statusCode, 403);
  assert.equal(response, undefined);
  assert.equal(find.mock.calls.length, 0);
});
