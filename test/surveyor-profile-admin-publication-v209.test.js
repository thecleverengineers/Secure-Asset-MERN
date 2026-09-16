import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('v209 admin publication changes the SurveyorProfile publicationStatus field', () => {
  const controller = read('server/src/controllers/resourceController.js');
  const model = read('server/src/models/surveyor.js');
  const page = read('src/app/pages/app/ResourcePage.tsx');

  assert.match(controller, /'surveyor-profiles': \{ admin: \['draft', 'pending_moderation', 'published', 'paused', 'archived'\], tenant: \['draft', 'pending_moderation', 'paused', 'archived'\] \}/);
  assert.match(controller, /req\.params\.resource === 'surveyor-profiles'[\s\S]*record\.publicationStatus = status;[\s\S]*record\.visibility = status === 'published' \? 'public' : 'private'/);
  assert.match(model, /publicationStatus: \{ type: String, enum: \['draft', 'pending_moderation', 'published', 'paused', 'archived'\]/);
  assert.match(page, /'surveyor-profiles': \{[^\n]*statuses: \['draft','pending_moderation','published','paused','archived'\]/);
});
