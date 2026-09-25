import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell = fs.readFileSync('src/app/components/layout/AppShell.tsx', 'utf8');

test('sidebar orders General then Surveyor features then Tenancy', () => {
  assert.match(shell, /general: 10/);
  assert.match(shell, /surveyor_features: 20/);
  assert.match(shell, /tenancy: 30/);
  assert.match(shell, /sectionPriority\[leftSection\]/);
});

test('combined subscribed tenant sidebar separates general and tenancy items', () => {
  assert.match(shell, /key: 'dashboard'.*section: 'general'.*sectionOrder: 10/);
  assert.match(shell, /key: 'documents'.*section: 'general'.*sectionOrder: 10/);
  assert.match(shell, /key: 'applications'.*section: 'tenancy'.*sectionOrder: 30/);
  assert.match(shell, /key: 'tenancies'.*section: 'tenancy'.*sectionOrder: 30/);
  assert.match(shell, /section: 'surveyor_features', sectionOrder: 20/);
});

test('sidebar displays the requested section labels', () => {
  assert.match(shell, /\? 'General'/);
  assert.match(shell, /value === 'surveyor_features' \? 'Surveyor features'/);
  assert.match(shell, /value === 'tenancy' \? 'Tenancy'/);
});
