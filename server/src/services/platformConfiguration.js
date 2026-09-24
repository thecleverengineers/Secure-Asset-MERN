import { ContentPage, HomeSection, PlatformModule, RolePermission, IntegrationSetting, SiteSetting } from '../models/index.js';
import { DEFAULT_CONTENT_PAGES, DEFAULT_DESIGN_SYSTEM, DEFAULT_HOME_SECTIONS, DEFAULT_PLATFORM_MODULES, DEFAULT_SITE_FOOTER } from './platformDefaults.js';
import { ROLE_KEYS, canAccessPlatformModule, defaultPermissionEntriesForRole, getEffectiveRole, getEffectiveMode, permissionPayloadForModules, permissionPayloadForResources, plainUser, subscriptionContextForUser } from './rbac.js';
import { syncTenantEntitlements } from './tenantEntitlements.js';

let bootstrapPromise;
const ADMIN_HIDDEN_SIDEBAR_KEYS = new Set(['all-users', 'admin-users', 'landlords', 'manage-landlords', 'landlord-documents']);
const PROPERTY_DETAIL_ONLY_MODULE_KEYS = Object.freeze(['property-spaces', 'property-media', 'property-promotions']);
const RETIRED_SURVEYOR_MODULE_KEYS = Object.freeze([
  'assigned-properties', 'pending-surveys', 'in-progress-surveys', 'completed-surveys', 'correction-required',
  'survey-services', 'location-verification', 'specification-verification', 'room-verification', 'facility-verification',
  'field-data', 'survey-reports', 'submitted-reports', 'approved-reports', 'rejected-reports', 'site-visits', 'assigned-visits',
  'survey-equipment', 'survey-team', 'survey-clients', 'survey-reviews', 'survey-disputes', 'survey-promotions',
]);
const SURVEYOR_WORKFLOW_MODULE_KEYS = new Set(['surveyor-dashboard', 'survey-job-marketplace', 'survey-quotations', 'survey-projects', 'surveyor-profile', 'surveyor-verification']);
const TENANT_ONLY_ACTIVATION_MODULE_KEYS = new Set(['subscription', 'surveyor-subscription']);
const LANDLORD_SIDEBAR_KEYS = new Set([
  'dashboard', 'my-listings', 'applications', 'tenants', 'tenancies', 'property-visits', 'rental-invoices',
  'utility-readings', 'leases', 'payments', 'agreement-templates', 'survey-projects', 'active-projects',
  'documents', 'profile',
]);
const LANDLORD_RETIRED_SURVEY_MODULE_KEYS = new Set(['survey-jobs', 'survey-quotations']);

export async function ensurePlatformConfiguration() {
  if (!bootstrapPromise) bootstrapPromise = (async () => {
    for (const module of DEFAULT_PLATFORM_MODULES) {
      await PlatformModule.updateOne(
        { key: module.key, scope: module.scope },
        { $setOnInsert: module },
        { upsert: true },
      );
      if (module.scope === 'app' && (module.metadata?.adminWorkspaceManaged || module.metadata?.rbacManaged)) {
        await PlatformModule.updateOne(
          { key: module.key, scope: module.scope },
          { $set: { label: module.label, description: module.description || '', path: module.path, icon: module.icon, kind: module.kind, section: module.section, sectionOrder: module.sectionOrder ?? 0, sortOrder: module.sortOrder ?? 0, mobilePrimary: Boolean(module.mobilePrimary), roles: module.roles || [], modes: module.modes || [], accessRules: module.accessRules || [], featureFlag: module.featureFlag, badge: module.badge, metadata: module.metadata } },
        );
      }
      if (module.scope === 'app') {
        await PlatformModule.updateOne(
          { key: module.key, scope: module.scope, accessRules: { $exists: false } },
          { $set: { accessRules: module.accessRules } },
        );
        // Existing installations may already have a PlatformModule document
        // created before a new capability access rule was introduced. Append
        // only missing default rules so landlord/surveyor additions become
        // available without overwriting administrator customisation.
        const currentModule = await PlatformModule.findOne({ key: module.key, scope: module.scope }).select('accessRules').lean();
        const existingRules = Array.isArray(currentModule?.accessRules) ? currentModule.accessRules : [];
        const missingRules = (module.accessRules || []).filter((rule) => !existingRules.some((candidate) => JSON.stringify(candidate) === JSON.stringify(rule)));
        if (missingRules.length) await PlatformModule.updateOne({ key: module.key, scope: module.scope }, { $push: { accessRules: { $each: missingRules } } });
      }
      await PlatformModule.updateOne(
        { key: module.key, scope: module.scope, sectionOrder: { $exists: false } },
        { $set: { sectionOrder: module.sectionOrder ?? 0 } },
      );
    }
    await Promise.all(DEFAULT_CONTENT_PAGES.map((page) => ContentPage.updateOne(
      { path: page.path },
      { $setOnInsert: page },
      { upsert: true },
    )));
    await Promise.all(DEFAULT_HOME_SECTIONS.map((section) => HomeSection.updateOne(
      { key: section.key },
      { $setOnInsert: section },
      { upsert: true },
    )));
    await HomeSection.updateOne(
      { key: 'cta', 'content.primaryLabel': 'Create account', 'content.primaryUrl': '/login' },
      { $set: { 'content.primaryUrl': '/login?mode=register' } },
    );
    // Older installations can still have standalone navigation documents for
    // these resources. Their CRUD now belongs only to the selected property's
    // details page, so disable the legacy records during bootstrap.
    await PlatformModule.updateMany(
      { scope: 'app', key: { $in: PROPERTY_DETAIL_ONLY_MODULE_KEYS } },
      { $set: { enabled: false, 'metadata.sidebarVisible': false } },
    );
    // The hired-project workspace is now the only surveyor field, report,
    // visit, equipment and invoice surface. Disable old navigation records on
    // existing installations so stale catalogs cannot expose duplicate pages.
    await PlatformModule.updateMany(
      { scope: 'app', key: { $in: RETIRED_SURVEYOR_MODULE_KEYS } },
      { $set: { enabled: false, 'metadata.sidebarVisible': false } },
    );
    // Existing installations may have landlord rules persisted in the same
    // module records used by Surveyors. Remove only landlord access so the
    // public-directory hiring flow is the landlord entry point.
    const legacyLandlordSurveyModules = await PlatformModule.find({ scope: 'app', key: { $in: [...LANDLORD_RETIRED_SURVEY_MODULE_KEYS] } }).select('_id roles accessRules').lean();
    await Promise.all(legacyLandlordSurveyModules.map((module) => {
      const accessRules = (module.accessRules || []).filter((rule) => {
        const roles = (rule.roles || []).map((role) => String(role).toLowerCase());
        const modes = (rule.modes || []).map((mode) => String(mode).toLowerCase());
        return !roles.includes('landlord') && !(roles.includes('tenant') && modes.includes('landlord'));
      });
      const roles = (module.roles || []).filter((role) => String(role).toLowerCase() !== 'landlord');
      return PlatformModule.updateOne({ _id: module._id }, { $set: { roles, accessRules } });
    }));
    await Promise.all(ROLE_KEYS.map((role) => RolePermission.updateOne(
      { role },
      { $setOnInsert: { role, entries: defaultPermissionEntriesForRole(role) } },
      { upsert: true },
    )));
    // Keep permission maps forward-compatible. Older installations may have
    // a managed RolePermission document created before a newly subscribed
    // workspace module existed. Append only missing defaults so administrator
    // changes are preserved while new landlord/surveyor dashboard permissions
    // become available immediately after deployment.
    await Promise.all(ROLE_KEYS.map(async (role) => {
      const defaults = defaultPermissionEntriesForRole(role);
      const existing = await RolePermission.findOne({ role }).select('entries').lean();
      if (!existing) return;
      const present = new Set((existing.entries || []).map((entry) => String(entry.key).toLowerCase()));
      const missing = defaults.filter((entry) => !present.has(entry.key));
      if (missing.length) await RolePermission.updateOne({ role }, { $push: { entries: { $each: missing } } });
    }));
    const integrations = [
      ['mongodb', 'MongoDB', 'other', ['MONGODB_URI']],
      ['s3', 'Amazon S3 / S3-compatible storage', 'storage', ['S3_BUCKET', 'S3_REGION']],
      ['smtp', 'SMTP email', 'email', ['SMTP_HOST', 'SMTP_FROM']],
      ['fast2sms', 'Fast2SMS', 'sms', []],
      ['maps', 'Map provider', 'maps', []],
      ['payments', 'Payment gateway', 'payment', []],
    ];
    await Promise.all(integrations.map(([key, provider, category, envRequirements]) => IntegrationSetting.updateOne(
      { key }, { $setOnInsert: { key, provider, category, envRequirements, enabled: false, status: 'unconfigured' } }, { upsert: true },
    )));
    await IntegrationSetting.updateOne(
      { key: 'fast2sms' },
      { $setOnInsert: { publicConfig: {
        endpoint: 'https://www.fast2sms.com/dev/bulkV2', route: 'dlt', senderId: 'SECAST', messageId: '204251', variablesTemplate: '{otp}', scheduleTime: '',
        whatsappEnabled: false, whatsappEndpoint: 'https://www.fast2sms.com/dev/whatsapp', whatsappPhoneNumberId: '1202480702956271',
      } } },
      { upsert: true },
    );
    await Promise.all([
      IntegrationSetting.updateOne({ key: 'fast2sms', 'publicConfig.whatsappEndpoint': { $exists: false } }, { $set: { 'publicConfig.whatsappEndpoint': 'https://www.fast2sms.com/dev/whatsapp' } }),
      IntegrationSetting.updateOne({ key: 'fast2sms', 'publicConfig.whatsappPhoneNumberId': { $exists: false } }, { $set: { 'publicConfig.whatsappPhoneNumberId': '1202480702956271' } }),
      IntegrationSetting.updateOne({ key: 'fast2sms', 'publicConfig.whatsappEnabled': { $exists: false } }, { $set: { 'publicConfig.whatsappEnabled': false } }),
    ]);
    await SiteSetting.updateOne(
      { key: 'default', 'authentication.otpSubtitle': 'Use a secure one-time password sent to your verified email.' },
      { $set: { 'authentication.otpSubtitle': 'Use a secure one-time password sent to your registered mobile.' } },
    );
    await SiteSetting.updateOne(
      { key: 'default', 'authentication.forgotSubtitle': 'We will send a time-limited reset link to your email.' },
      { $set: { 'authentication.forgotSubtitle': 'Enter your registered email or mobile number. The reset OTP is sent to your registered mobile.' } },
    );
    await SiteSetting.updateOne(
      { key: 'default', footer: { $exists: false } },
      { $set: { footer: DEFAULT_SITE_FOOTER } },
    );
    await SiteSetting.updateOne(
      { key: 'default', design: { $exists: false } },
      { $set: { design: DEFAULT_DESIGN_SYSTEM } },
    );
    // Older installations already have a design document. Add only the new
    // bounded token groups so a deployment never overwrites an administrator's
    // existing palette, layout or radius choices.
    await SiteSetting.updateOne(
      { key: 'default', 'design.buttons': { $exists: false } },
      { $set: {
        'design.branding': DEFAULT_DESIGN_SYSTEM.branding,
        'design.buttons': DEFAULT_DESIGN_SYSTEM.buttons,
        'design.bottomAppBar': DEFAULT_DESIGN_SYSTEM.bottomAppBar,
        'design.iconLibrary': DEFAULT_DESIGN_SYSTEM.iconLibrary,
        'design.iconAssets': DEFAULT_DESIGN_SYSTEM.iconAssets,
        'design.navigation': DEFAULT_DESIGN_SYSTEM.navigation,
        'design.pageDesigns': DEFAULT_DESIGN_SYSTEM.pageDesigns,
        'design.componentLibrary': DEFAULT_DESIGN_SYSTEM.componentLibrary,
        'design.profiles': DEFAULT_DESIGN_SYSTEM.profiles,
        'design.motion': DEFAULT_DESIGN_SYSTEM.motion,
        'design.canvas': DEFAULT_DESIGN_SYSTEM.canvas,
      } },
    );
    await SiteSetting.updateOne(
      { key: 'default', 'design.iconAssets': { $exists: false } },
      { $set: { 'design.iconAssets': DEFAULT_DESIGN_SYSTEM.iconAssets } },
    );
  })().catch((error) => { bootstrapPromise = null; throw error; });
  return bootstrapPromise;
}

export async function getPublicNavigation() {
  await ensurePlatformConfiguration();
  return PlatformModule.find({ scope: 'public', enabled: true }).sort({ sectionOrder: 1, section: 1, sortOrder: 1, label: 1 }).lean();
}

export async function getApplicationNavigation(user) {
  await ensurePlatformConfiguration();
  const modules = await PlatformModule.find({ scope: 'app', enabled: true })
    .sort({ sectionOrder: 1, section: 1, sortOrder: 1, label: 1 }).lean();
  const visible = [];
  const effectiveRole = getEffectiveRole(user);
  for (const module of modules) {
    if (PROPERTY_DETAIL_ONLY_MODULE_KEYS.includes(module.key)) continue;
    // The self-service plan pages belong only to tenant accounts. Admins keep
    // their separate plan/catalog/approval tools, while legacy landlord and
    // surveyor roles must not receive a checkout route from the app catalog.
    if (TENANT_ONLY_ACTIVATION_MODULE_KEYS.has(module.key) && String(user?.role || '').toLowerCase() !== 'tenant') continue;
    if (module.metadata?.sidebarVisible === false) continue;
    const normalizedLabel = String(module.label || '').trim().toLowerCase();
    if (effectiveRole === 'surveyor' && !SURVEYOR_WORKFLOW_MODULE_KEYS.has(module.key)) continue;
    if (String(user?.role || '').toLowerCase() === 'landlord' && !LANDLORD_SIDEBAR_KEYS.has(module.key)) continue;
    const landlordWorkspace = effectiveRole === 'landlord' || (String(user?.role || '').toLowerCase() === 'tenant' && (user?.landlordEnabled || String(user?.activeMode || '').toLowerCase() === 'landlord'));
    if (landlordWorkspace && LANDLORD_RETIRED_SURVEY_MODULE_KEYS.has(module.key)) continue;
    if (effectiveRole === 'admin' && (ADMIN_HIDDEN_SIDEBAR_KEYS.has(module.key) || ['landlords', 'manage landlords'].includes(normalizedLabel))) continue;
    if (module.featureFlag && !user.customPermissions?.includes(module.featureFlag) && effectiveRole !== 'admin') continue;
    if (await canAccessPlatformModule(module, user)) visible.push(module);
  }
  // Document Vault is an admin platform surface, not an optional menu item.
  // Recover it from the release defaults when an older/custom catalog has
  // disabled or omitted its record so admins never lose the secure drive link.
  if (effectiveRole === 'admin' && !visible.some((module) => module.key === 'documents')) {
    const fallback = DEFAULT_PLATFORM_MODULES.find((module) => module.scope === 'app' && module.key === 'documents');
    if (fallback) visible.unshift({
      ...fallback,
      enabled: true,
      roles: ['admin'],
      modes: ['regular'],
      accessRules: [{ roles: ['admin'], modes: ['regular'] }],
      metadata: { ...(fallback.metadata || {}), sidebarVisible: true, adminWorkspaceManaged: true },
    });
  }
  return visible;
}

export async function getApplicationAccessSummary(user) {
  const entitlements = user?.role === 'tenant' ? await syncTenantEntitlements(user._id) : null;
  const accessUser = entitlements ? {
    ...plainUser(user),
    landlordEnabled: entitlements.landlord.enabled,
    landlordSubscriptionExpiresAt: entitlements.landlord.expiresAt,
    landlordPlan: entitlements.landlord.plan,
    surveyorEnabled: entitlements.surveyor.enabled,
    surveyorSubscriptionExpiresAt: entitlements.surveyor.expiresAt,
    surveyorPlan: entitlements.surveyor.plan,
  } : user;
  const modules = await getApplicationNavigation(accessUser);
  const subscription = await subscriptionContextForUser(accessUser);
  const resourcePermissions = await permissionPayloadForResources(accessUser);
  return {
    modules,
    permissions: permissionPayloadForModules(modules, accessUser),
    resourcePermissions,
    effectiveRole: getEffectiveRole(accessUser),
    effectiveMode: getEffectiveMode(accessUser),
    subscription,
  };
}

export async function getContentPage(path, authenticated = false) {
  await ensurePlatformConfiguration();
  return ContentPage.findOne({ path, active: true, ...(authenticated ? {} : { visibility: 'public' }) }).lean();
}
