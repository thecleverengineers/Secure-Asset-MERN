import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_PLATFORM_MODULES } from '../server/src/services/platformDefaults.js';
import { resources } from '../server/src/services/resources.js';

test('platform module records are unique and access-controlled', () => {
  const ids = DEFAULT_PLATFORM_MODULES.map((module) => `${module.scope}:${module.key}`);
  assert.equal(new Set(ids).size, ids.length);
  for (const module of DEFAULT_PLATFORM_MODULES.filter((item) => item.scope === 'app')) {
    assert.ok(Array.isArray(module.accessRules));
    assert.ok(module.accessRules.length > 0);
  }
});

test('every enabled application module resolves to a backend resource or specialised screen', () => {
  const modulePage = fs.readFileSync(new URL('../src/app/pages/app/ModulePage.tsx', import.meta.url), 'utf8');
  const resourcePage = fs.readFileSync(new URL('../src/app/pages/app/ResourcePage.tsx', import.meta.url), 'utf8');
  const resourceBlock = resourcePage.split('const configs:')[1].split('function getValue')[0];
  const uiResources = new Set([...resourceBlock.matchAll(/^  ['"]?([a-z0-9-]+)['"]?: \{/gm)].map((match) => match[1]));
  const specialised = new Set([...modulePage.matchAll(/module === '([^']+)'/g)].map((match) => match[1]));
  for (const key of ['dashboard', 'profile', 'reports', 'my-property']) specialised.add(key);
  const external = new Set(DEFAULT_PLATFORM_MODULES.filter((module) => module.kind === 'external').map((module) => module.key));
  const routeTarget = (module) => {
    const modulePath = String(module.path || `/app/${module.key}`).split('?')[0].split('#')[0];
    const match = modulePath.match(/^\/app\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : module.key;
  };
  const unresolved = [...new Map(DEFAULT_PLATFORM_MODULES
    .filter((module) => module.scope === 'app' && module.enabled)
    .map((module) => [`${module.key}:${module.path || ''}`, module]))
    .values()]
    .filter((module) => {
      const target = routeTarget(module);
      return !uiResources.has(target) && !specialised.has(target) && !external.has(module.key) && !external.has(target);
    })
    .map((module) => module.key);
  assert.deepEqual(unresolved, []);
  assert.deepEqual([...uiResources].filter((key) => !resources[key]), []);
});
