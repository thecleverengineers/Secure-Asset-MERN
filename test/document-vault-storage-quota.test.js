import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const drive = fs.readFileSync('server/src/services/driveService.js', 'utf8');
const landlord = fs.readFileSync('server/src/models/propertyManagement.js', 'utf8');
const surveyor = fs.readFileSync('server/src/models/surveyor.js', 'utf8');
const subscription = fs.readFileSync('server/src/models/index.js', 'utf8');
const admin = fs.readFileSync('src/app/pages/app/SiteAdministrationPage.tsx', 'utf8') + fs.readFileSync('src/app/pages/app/ResourcePage.tsx', 'utf8') + fs.readFileSync('server/src/services/resources.js', 'utf8');
test('Document Vault quota source is configured', () => {
  assert.ok(drive.includes('DEFAULT_VAULT_STORAGE_MB = 200'));
  assert.ok(drive.includes('landlord.limits?.storageMB'));
  assert.ok(drive.includes('surveyor.planSnapshot?.limits?.storageMb'));
  assert.ok(drive.includes('surveyor.plan?.limits?.storageMb'));
  assert.ok(!drive.includes('const gb = { starter: 10'));
  assert.ok(!drive.includes('fallbackGb = {'));
});
test('Subscription plans expose bounded Document Vault storage controls', () => {
  assert.ok(landlord.includes('min: 200, max: 10485760'));
  assert.ok(surveyor.includes('min: 200, max: 10485760'));
  assert.ok(subscription.includes('min: 200, max: 10485760'));
  assert.ok(admin.includes('landlord-plans'));
  assert.ok(admin.includes('surveyor-plans'));
  assert.ok(admin.includes('storageMB') || admin.includes('storageMb'));
});

test('landlord subscription plans use structured controls instead of JSON editors', () => {
  const resourcePage = fs.readFileSync('src/app/pages/app/ResourcePage.tsx', 'utf8');
  const siteAdministration = fs.readFileSync('src/app/pages/app/SiteAdministrationPage.tsx', 'utf8');
  const resourceBlock = resourcePage.slice(resourcePage.indexOf("'landlord-plans': {"), resourcePage.indexOf("'site-settings': {"));
  const siteBlock = siteAdministration.slice(siteAdministration.indexOf("resource: 'landlord-plans'"), siteAdministration.indexOf("resource: 'landlord-plans'") + 2200);
  const allowed = ['name', 'limits.properties', 'limits.buildings', 'limits.apartments', 'limits.rooms', 'limits.beds', 'limits.publicListings', 'limits.activeTenants', 'limits.storageMB', 'features.apiAccess', 'features.prioritySupport', 'billingCycle', 'price'];
  for (const field of allowed) {
    assert.ok(resourceBlock.includes(`name:'${field}'`), `missing ResourcePage landlord field: ${field}`);
    assert.ok(siteBlock.includes(`key:'${field}'`), `missing Site Administration landlord field: ${field}`);
  }
  for (const field of ['key', 'description', 'rank', 'limits.teamMembers', 'features.rentAutomation', 'features.advancedReports', 'features.propertyPromotions', 'features.tenantInterviews', 'features.utilityBilling', 'features.multipleBranches', 'features.customRoles', 'graceDays', 'featured', 'active']) {
    assert.doesNotMatch(resourceBlock, new RegExp(`name:'${field.replace('.', '\\.')}'`), `unexpected ResourcePage landlord field: ${field}`);
    assert.doesNotMatch(siteBlock, new RegExp(`key:'${field.replace('.', '\\.')}'`), `unexpected Site Administration landlord field: ${field}`);
  }
  assert.match(resourcePage, /prices\.\$\{billingCycle\}/);
  assert.match(siteAdministration, /payload\.key = generatedKey/);
  assert.doesNotMatch(admin, /'prices',label:'Prices',type:'json'/);
  assert.doesNotMatch(admin, /'limits',label:'Limits',type:'json'/);
  assert.doesNotMatch(admin, /'features',label:'Features',type:'json'/);
});
