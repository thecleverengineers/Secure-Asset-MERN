import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const resourcePage = read('src/app/pages/app/ResourcePage.tsx');
const professionalDialog = read('src/app/components/shared/ProfessionalDialog.tsx');
const locationFields = read('src/app/components/shared/LocationFields.tsx');
const utilityPage = read('src/app/pages/app/UtilityPage.tsx');
const navigationPage = read('src/app/pages/app/NavigationManagementPage.tsx');
const appShell = read('src/app/components/layout/AppShell.tsx');
const modulePage = read('src/app/pages/app/ModulePage.tsx');
const models = read('server/src/models/propertyManagement.js');
const userModels = read('server/src/models/index.js');
const resources = read('server/src/services/resources.js');
const platformConfiguration = read('server/src/services/platformConfiguration.js');
const authRoutes = read('server/src/routes/authRoutes.js');
const locationController = read('server/src/controllers/locationController.js');
const publicRoutes = read('server/src/routes/publicRoutes.js');
const packageJson = JSON.parse(read('package.json'));

function filesUnder(directory) {
  const output = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) output.push(...filesUnder(path));
    else if (/\.(tsx|ts)$/.test(name)) output.push(path);
  }
  return output;
}

test('approval add and edit select a property reference instead of accepting a raw id', () => {
  assert.match(resourcePage, /approvals:.*name: 'property'.*type: 'reference'.*reference: 'properties'/s);
  assert.match(resourcePage, /getResource\(resource, \{ limit: 100 \}\)/);
  assert.match(resourcePage, /field\.type === 'reference'/);
});

test('business dialogs use the shared responsive professional window header', () => {
  assert.match(professionalDialog, /Minimize/);
  assert.match(professionalDialog, /Maximize/);
  assert.match(professionalDialog, /Close dialog/);
  assert.match(professionalDialog, /fullScreen=\{Boolean\(!minimized && \(fullScreen \|\| mobile \|\| maximized\)\)\}/);

  const root = new URL('../src/app', import.meta.url).pathname;
  const offenders = filesUnder(root)
    .filter((path) => !path.includes('/components/ui/'))
    .filter((path) => /<Dialog(?:\s|>)/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, [], `raw MUI Dialog remains in: ${offenders.join(', ')}`);
});

test('administrators can organize sidebar modules by section and order', () => {
  assert.match(models, /sectionOrder: \{ type: Number/);
  assert.match(resources, /'section', 'sectionOrder'.*'sortOrder'/s);
  assert.match(platformConfiguration, /sort\(\{ sectionOrder: 1, section: 1, sortOrder: 1, label: 1 \}\)/);
  assert.match(navigationPage, /Sidebar Navigation/);
  assert.match(navigationPage, /Move up/);
  assert.match(navigationPage, /Move down/);
  assert.match(navigationPage, /updateResource\('platform-modules'/);
  assert.match(modulePage, /module === 'platform-modules'.*NavigationManagementPage/s);
  assert.match(appShell, /menuGroups/);
  assert.match(appShell, /sectionLabel\(section\)/);
});

test('avatar fields upload image files rather than requiring external links', () => {
  assert.match(resourcePage, /name: 'avatar'.*type: 'image'/s);
  assert.match(resourcePage, /accept="image\/jpeg,image\/png,image\/webp,image\/gif"/);
  assert.match(utilityPage, /uploadProfileAvatar/);
  assert.ok(!utilityPage.includes('Avatar URL'));
  assert.match(authRoutes, /\/me\/avatar/);
});

test('worldwide country, dependent state and dependent city selectors are shared across regional forms', () => {
  assert.equal(packageJson.dependencies['country-state-city'], '3.2.1');
  assert.match(locationController, /Country\.getAllCountries/);
  assert.match(locationController, /State\.getStatesOfCountry/);
  assert.match(locationController, /City\.getCitiesOfState/);
  assert.match(locationFields, /getLocationCountries/);
  assert.match(locationFields, /getLocationStates/);
  assert.match(locationFields, /getLocationCities/);
  assert.match(publicRoutes, /locations\/countries/);
  assert.match(publicRoutes, /locations\/states/);
  assert.match(publicRoutes, /locations\/cities/);
  assert.match(publicRoutes, /locations\/reverse/);
  assert.match(resourcePage, /<LocationFields/);
  assert.match(appShell, /sectionOrder/);
  for (const field of ['country', 'state', 'city']) assert.match(userModels, new RegExp(`${field}: \\{ type: String`));
  assert.match(models, /region: \{ country: String, state: String, city: String/);
});
