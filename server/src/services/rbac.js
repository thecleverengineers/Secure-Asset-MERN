export const ACTIONS = Object.freeze(['view', 'create', 'edit', 'delete', 'approve', 'export', 'download', 'notify']);
export const PERMISSION_SCOPES = Object.freeze(['all', 'own', 'assigned', 'public']);
const MUTATION_ACTIONS = new Set(['create', 'edit', 'delete', 'approve', 'notify']);
const ADMIN_ACTIONS = [...ACTIONS];
const VIEW_ONLY = ['view'];
const TENANT_ACTIONS = ['view', 'create', 'edit', 'delete', 'download'];
const LANDLORD_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'download', 'notify'];
const SURVEYOR_ACTIONS = ['view', 'create', 'edit', 'download'];

export const ROLE_KEYS = Object.freeze(['admin', 'landlord', 'tenant', 'surveyor']);
export const LEGACY_ROLE_KEYS = Object.freeze(['manager', 'user']);

const rolePermissionCache = new Map();
const subscriptionContextCache = new Map();
const SUBSCRIPTION_CONTEXT_CACHE_MS = 5_000;
const ROLE_ALIASES = Object.freeze({ manager: 'admin', user: 'tenant' });

// req.user is normally a hydrated Mongoose document. Spreading that document
// does not reliably copy schema paths such as role, _id, or capability flags.
// Convert it before creating a mode-specific capability view.
export function plainUser(user) {
  if (!user) return user;
  if (typeof user.toObject === 'function') return user.toObject({ depopulate: true });
  return { ...user };
}

export function normalizePermissionRole(role = 'tenant') {
  const normalized = String(role || 'tenant').trim().toLowerCase();
  return ROLE_ALIASES[normalized] || (ROLE_KEYS.includes(normalized) ? normalized : 'tenant');
}

export function clearRolePermissionCache(role) {
  if (role) rolePermissionCache.delete(normalizePermissionRole(role));
  else rolePermissionCache.clear();
}

export function getEffectiveRole(user = {}) {
  const role = String(user.role || 'tenant').toLowerCase();
  const mode = String(user.activeMode || 'regular').toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'landlord') return 'landlord';
  if (role === 'surveyor') return 'surveyor';
  if (role === 'manager') return 'admin';
  if (mode === 'landlord' && user.landlordEnabled) return 'landlord';
  if (mode === 'surveyor' && user.surveyorEnabled) return 'surveyor';
  return 'tenant';
}

export function getEffectiveMode(user = {}) {
  const effectiveRole = getEffectiveRole(user);
  if (effectiveRole === 'landlord') return 'landlord';
  if (effectiveRole === 'surveyor') return 'surveyor';
  return 'regular';
}

// A tenant keeps the tenant account role permanently. Active subscriptions
// add capabilities; they do not replace the account role or require a mode
// switch. The order also keeps the normal tenant permission set available.
export function capabilityRolesForUser(user = {}) {
  const accountRole = String(user.role || '').toLowerCase();
  const roles = [accountRole === 'tenant' ? 'tenant' : getEffectiveRole(user)];
  if (accountRole === 'tenant') {
    const landlordActive = Boolean(user.landlordEnabled) && (!user.landlordSubscriptionExpiresAt || notExpired(user.landlordSubscriptionExpiresAt));
    const surveyorActive = Boolean(user.surveyorEnabled) && (!user.surveyorSubscriptionExpiresAt || notExpired(user.surveyorSubscriptionExpiresAt));
    if (landlordActive) roles.push('landlord');
    if (surveyorActive) roles.push('surveyor');
  }
  return [...new Set(roles)];
}

export function roleMatchesRule(user, rule = {}) {
  const role = String(user?.role || 'tenant').toLowerCase();
  const effectiveRole = getEffectiveRole(user);
  const mode = getEffectiveMode(user);
  const roles = Array.isArray(rule.roles) ? rule.roles.map((item) => String(item).toLowerCase()) : [];
  const modes = Array.isArray(rule.modes) ? rule.modes.map((item) => String(item).toLowerCase()) : [];
  const roleAllowed = !roles.length || roles.includes(role) || roles.includes(effectiveRole) || (effectiveRole === 'admin' && roles.includes('manager'));
  const modeAllowed = !modes.length || modes.includes(mode) || modes.includes(String(user?.activeMode || 'regular').toLowerCase());
  return roleAllowed && modeAllowed;
}

function sectionOrder(section) {
  return ({
    dashboard: 10, user_management: 20, property_management: 30, rent_management: 40, lease_management: 50,
    sales_management: 60, payments: 70, subscriptions: 80, landlord_management: 90, tenant_management: 100,
    surveyor_management: 110, site_visits: 120, applications: 130, active_tenancy: 140, complaints: 150,
    communications: 160, reports: 170, settings: 180, discovery: 190, account: 200, survey: 210,
    documents: 220, profile: 230,
  })[section] ?? 999;
}

function access(role, actions) { return { [role]: actions }; }
function accessRulesFor(role) {
  if (role === 'admin') return [{ roles: ['admin', 'manager'], modes: ['regular'] }];
  if (role === 'landlord') return [{ roles: ['landlord'], modes: [] }, { roles: ['tenant'], modes: ['landlord'] }];
  if (role === 'surveyor') return [{ roles: ['surveyor'], modes: [] }, { roles: ['tenant'], modes: ['surveyor'] }];
  return [{ roles: ['tenant', 'user'], modes: ['regular'] }];
}
function module(key, label, section, role, options = {}) {
  const path = options.path || `/app/${options.resource || key}`;
  const permissionActions = options.actions || (role === 'admin' ? ADMIN_ACTIONS : role === 'landlord' ? LANDLORD_ACTIONS : role === 'surveyor' ? SURVEYOR_ACTIONS : TENANT_ACTIONS);
  const rules = accessRulesFor(role);
  return {
    key, label, path,
    icon: options.icon || 'dashboard', scope: 'app', kind: options.kind || (path.startsWith('/app/') ? 'resource' : 'external'),
    section, sectionOrder: sectionOrder(section), sortOrder: options.sortOrder || 0,
    roles: [...new Set(rules.flatMap((rule) => rule.roles))], modes: [...new Set(rules.flatMap((rule) => rule.modes))], accessRules: rules,
    enabled: true, mobilePrimary: Boolean(options.mobilePrimary),
    description: options.description || `${label} workspace access`,
    featureFlag: options.featureFlag,
    metadata: {
      rbacManaged: true,
      role,
      ...(role === 'landlord' ? { capability: 'landlord' } : role === 'surveyor' ? { capability: 'surveyor' } : {}),
      resource: options.resource || key,
      sidebarVisible: options.sidebarVisible !== false,
      permissions: { [role]: permissionActions },
      minTier: options.minTier || 'basic',
      subscription: options.subscription || (role === 'landlord' ? 'landlord' : role === 'surveyor' ? 'surveyor' : undefined),
      viewOnlyWhenExpired: options.viewOnlyWhenExpired !== false,
      filter: options.filter || {},
    },
  };
}

const adminModules = [
  ['dashboard','Dashboard','dashboard','dashboard', '/app/dashboard'],
  // Canonical guard keys used by the API routes. Keep these in the admin
  // matrix even when the visual sidebar uses a more specific child module.
  ['property-management','Property Structure','property_management','apartment','/app/property-management'],
  ['utility-readings','Meter Readings','rent_management','electricmeter','/app/utility-readings'],
  ['occupants','Family & Occupants','tenant_management','people','/app/occupants'],
  ['reminder-rules','Payment Reminders','rent_management','notifications','/app/reminder-rules'],
  ['facilities','Facilities','operations','accountbalance','/app/facilities'],
  ['facility-bookings','Facility Bookings','operations','calendarmonth','/app/facility-bookings'],
  ['surveys','Assigned Surveys','survey','assignment','/app/surveys'],
  ['approvals','Approvals','operations','approval','/app/approvals'],
  ['notification-deliveries','Notification Delivery Logs','communications','notifications','/app/notification-deliveries'],
  ['design-studio','Design Studio','settings','palette','/app/design-studio'],
  ['subscription-payment-approvals','Subscription Payment Approvals','payments','verifieduser','/app/subscription-payment-approvals'],
  ['subscription','Subscription Payments','subscriptions','workspacepremium','/app/subscriptions'],
  ['surveyor-subscription','Surveyor Subscription Payments','subscriptions','workspacepremium','/app/surveyor-subscription'],
  ['users','User Management','user_management','people','/app/users'], ['all-users','All Users','user_management','people','/app/users'], ['admin-users','Admin Users','user_management','people','/app/users?role=admin'], ['role-permissions','Role & Permissions','user_management','verifieduser','/app/role-permissions'],
  ['landlords','Landlords','landlord_management','businesscenter','/app/users?role=landlord'], ['tenants','Tenants','tenant_management','people','/app/users?role=tenant'], ['surveyors','Surveyors','surveyor_management','engineering','/app/users?role=surveyor'],
  ['properties','Property Management','property_management','apartment','/app/properties'], ['add-property','Add Property','property_management','apartment','/app/add_property'], ['pending-properties','Pending Properties','property_management','approval','/app/properties?status=pending_approval'], ['approved-properties','Approved Properties','property_management','verifieduser','/app/properties?status=available'], ['rejected-properties','Rejected Properties','property_management','approval','/app/properties?status=archived'], ['public-properties','Public Properties','property_management','web','/app/properties?visibility=public'], ['private-properties','Private Properties','property_management','folder','/app/properties?visibility=private'], ['property-spaces','Room Management','property_management','meetingroom','/app/property-spaces'], ['property-media','Property Gallery','property_management','collections','/app/property-media'], ['property-verification','Property Verification','property_management','factcheck','/app/surveys'],
  ['rental-invoices','Rent Management','rent_management','receiptlong','/app/rental-invoices'], ['active-rents','Active Rents','rent_management','receiptlong','/app/rental-invoices?status=pending,partially_paid,overdue'], ['due-rents','Due Rents','rent_management','notifications','/app/rental-invoices?status=overdue'], ['paid-rents','Paid Rents','rent_management','payments','/app/rental-invoices?status=paid'], ['unpaid-rents','Unpaid Rents','rent_management','payments','/app/rental-invoices?status=pending'], ['rent-invoices','Rent Invoices','rent_management','receiptlong','/app/rental-invoices'], ['rent-agreements','Rent Agreements','rent_management','description','/app/documents?type=rent_agreement'], ['rent-reports','Rent Reports','rent_management','assessment','/app/reports?resource=rental-invoices'],
  ['leases','Lease Management','lease_management','description','/app/leases'], ['active-lease','Active Lease','lease_management','description','/app/leases?status=active'], ['due-lease','Due Lease','lease_management','notifications','/app/leases?status=expiring'], ['paid-lease','Paid Lease','lease_management','payments','/app/payments?type=lease&status=paid'], ['unpaid-lease','Unpaid Lease','lease_management','payments','/app/payments?type=lease&status=pending'], ['lease-invoices','Lease Invoices','lease_management','receiptlong','/app/payments?type=lease'], ['lease-agreements','Lease Agreements','lease_management','description','/app/documents?type=lease_agreement'], ['lease-reports','Lease Reports','lease_management','assessment','/app/reports?resource=leases'],
  ['property-sales','Property Sales Management','sales_management','storefront','/app/payments?type=sale'], ['active-sales','Active Sales','sales_management','storefront','/app/payments?type=sale&status=pending'], ['completed-sales','Completed Sales','sales_management','verifieduser','/app/payments?type=sale&status=paid'], ['pending-sales','Pending Sales','sales_management','approval','/app/payments?type=sale&status=pending'], ['sale-invoices','Sale Invoices','sales_management','receiptlong','/app/payments?type=sale'], ['sale-agreements','Sale Agreements','sales_management','description','/app/documents?type=sale_agreement'], ['sales-reports','Sales Reports','sales_management','assessment','/app/reports?resource=payments&type=sale'],
  ['payments','Payment Management','payments','payments','/app/payments'], ['rent-payments','Rent Payments','payments','payments','/app/payments?type=rent'], ['lease-payments','Lease Payments','payments','payments','/app/payments?type=lease'], ['sales-payments','Sales Payments','payments','payments','/app/payments?type=sale'], ['subscription-payments','Subscription Payments','payments','workspacepremium','/app/payments?type=landlord_subscription,surveyor_subscription'], ['pending-payments','Pending Payments','payments','payments','/app/payments?status=pending'], ['failed-payments','Failed Payments','payments','payments','/app/payments?status=failed'], ['payment-reports','Payment Reports','payments','assessment','/app/reports?resource=payments'],
  ['subscriptions','Subscription Management','subscriptions','workspacepremium','/app/subscriptions'], ['landlord-plans','Subscription Plans','subscriptions','workspacepremium','/app/landlord-plans'], ['surveyor-plans','Surveyor Subscription Plans','subscriptions','workspacepremium','/app/surveyor-plans'], ['active-subscriptions','Active Subscriptions','subscriptions','verifieduser','/app/subscriptions?status=active'], ['expired-subscriptions','Expired Subscriptions','subscriptions','approval','/app/subscriptions?status=expired'], ['subscription-reports','Subscription Reports','subscriptions','assessment','/app/reports?resource=subscriptions'],
  ['documents','Document Vault','documents','folder','/app/documents'], ['notifications','Notifications','communications','notifications','/app/notifications'],
  ['landlord-documents','Landlord Documents','landlord_management','folder','/app/documents?type=landlord'], ['landlord-subscriptions','Landlord Subscriptions','landlord_management','workspacepremium','/app/subscriptions'],
  ['tenant-profiles','Tenant Profiles','tenant_management','person','/app/tenant-profiles'], ['add-tenant','Add Tenant','tenant_management','people','/app/tenants?new=1'], ['tenant-kyc','Tenant KYC','tenant_management','badge','/app/tenant-kyc'], ['tenant-interviews','Tenant Interviews','tenant_management','calendarmonth','/app/tenant-interviews'], ['tenant-documents','Tenant Documents','tenant_management','folder','/app/documents?type=tenant'],
  ['surveyor-profiles','All Surveyors','surveyor_management','person','/app/surveyor-profiles'], ['add-surveyor','Add Surveyor','surveyor_management','engineering','/app/users?new=1&role=surveyor'], ['surveyor-verifications','Pending Verification','surveyor_management','verifieduser','/app/surveyor-verifications'], ['assigned-surveys','Assigned Surveys','surveyor_management','assignment','/app/surveys'], ['survey-reports','Survey Reports','surveyor_management','assessment','/app/survey-reports'],
  ['property-visits','Site Visit Management','site_visits','calendarmonth','/app/property-visits'], ['pending-visits','Pending Visits','site_visits','calendarmonth','/app/property-visits?status=requested'], ['approved-visits','Approved Visits','site_visits','verifieduser','/app/property-visits?status=confirmed,approved'], ['completed-visits','Completed Visits','site_visits','factcheck','/app/property-visits?status=completed'], ['cancelled-visits','Cancelled Visits','site_visits','approval','/app/property-visits?status=cancelled'],
  ['applications','Tenant Applications','applications','factcheck','/app/applications'], ['rent-applications','Rent Applications','applications','factcheck','/app/applications?type=rent'], ['lease-applications','Lease Applications','applications','factcheck','/app/applications?type=lease'], ['purchase-applications','Purchase Applications','applications','factcheck','/app/applications?type=sale'], ['approved-applications','Approved Applications','applications','verifieduser','/app/applications?status=approved'], ['rejected-applications','Rejected Applications','applications','approval','/app/applications?status=rejected'],
  ['tenancies','Active Tenancy','active_tenancy','homework','/app/tenancies'], ['rent-tenancy','Rent Tenancy','active_tenancy','homework','/app/tenancies?type=rent'], ['lease-tenancy','Lease Tenancy','active_tenancy','homework','/app/tenancies?type=lease'], ['sale-tenancy','Sale Tenancy','active_tenancy','homework','/app/tenancies?type=sale'], ['renewal-requests','Renewal Requests','active_tenancy','notifications','/app/tenancies?status=renewal_requested'], ['move-out-requests','Move-out Requests','active_tenancy','notifications','/app/tenancies?status=move_out'],
  ['complaints','Complaint & Maintenance','complaints','build','/app/complaints'], ['pending-complaints','Pending Complaints','complaints','build','/app/complaints?status=open,assigned'], ['complaints-in-progress','In Progress','complaints','build','/app/complaints?status=in_progress'], ['resolved-complaints','Resolved Complaints','complaints','verifieduser','/app/complaints?status=resolved,closed'], ['maintenance-requests','Maintenance Requests','complaints','build','/app/complaints?category=maintenance'],
  ['messages','Messages','communications','message','/app/messages'], ['site-enquiries','Website Inquiries','communications','message','/app/site-enquiries'], ['property-inquiries','Property Inquiries','communications','message','/app/site-enquiries?type=property'], ['booking-inquiries','Booking Inquiries','communications','message','/app/site-enquiries?type=booking'], ['contact-form','Contact Form','communications','message','/app/site-enquiries?type=contact'],
  ['reports','Reports','reports','assessment','/app/reports'], ['income-reports','Income Reports','reports','assessment','/app/reports?type=income'], ['tax-reports','Tax Reports','reports','assessment','/app/reports?type=tax'],
  ['settings','Settings','settings','settings','/app/settings'], ['drive-admin','Drive Administration','settings','folder','/app/drive-admin'], ['backup-recovery','Backup & Recovery','settings','backup','/app/backup-recovery'], ['security','Security & Session','settings','verifieduser','/app/security'], ['site-admin','Site, SEO & Home Page','settings','web','/app/site-admin'], ['platform-modules','Navigation & Modules','settings','settings','/app/platform-modules'], ['content-pages','Content Pages','settings','description','/app/content-pages'], ['integration-settings','Integrations','settings','settings','/app/integration-settings'], ['site-settings','Site Identity','settings','web','/app/site-settings'], ['notification-preferences','WhatsApp Notification','settings','notifications','/app/notification-preferences'], ['seo-pages','SEO Pages','settings','web','/app/seo-pages'], ['home-carousel','Home Page Carousel','settings','collections','/app/home-carousel'], ['home-sections','Home Page Sections','settings','collections','/app/home-sections'], ['property-type-configs','Property Type','settings','apartment','/app/property-type-configs'], ['area-units','Area Units','settings','straighten','/app/area-units'],
].filter((row) => !['property-spaces', 'property-media', 'property-promotions'].includes(row[0])).map((row, index) => module(row[0], row[1], row[2], 'admin', {
  icon: row[3], path: row[4], sortOrder: (index + 1) * 10,
  sidebarVisible: !['all-users', 'admin-users', 'landlords', 'manage-landlords', 'landlord-documents'].includes(row[0]),
}));

const landlordModules = [
  ['tenancy-history','Tenancy History','active_tenancy','history','/app/tenancy-history','basic'],
  ['dashboard','Dashboard','dashboard','dashboard','/app/dashboard','basic'], ['subscription','Landlord Subscription','subscriptions','workspacepremium','/app/subscription','basic'], ['property-management','Property Structure','property_management','apartment','/app/property-management','basic'], ['properties','My Properties','property_management','apartment','/app/properties','basic'], ['my-listings','My Listings','property_management','apartment','/app/my-listings','basic'], ['add-my-property','Add Property','property_management','apartment','/app/add_property','basic'], ['public-my-properties','Public Properties','property_management','web','/app/properties?visibility=public','basic'], ['private-my-properties','Private Properties','property_management','folder','/app/properties?visibility=private','basic'], ['draft-my-properties','Draft Properties','property_management','description','/app/properties?publicationStatus=draft','basic'], ['pending-my-properties','Pending Approval','property_management','approval','/app/properties?status=pending_approval','basic'], ['property-spaces','Room Management','property_management','meetingroom','/app/property-spaces','standard'], ['property-media','Gallery','property_management','collections','/app/property-media','basic'], ['documents','Property Documents','documents','folder','/app/documents','basic'], ['tenancies','Active Tenancies','active_tenancy','homework','/app/tenancies','basic'], ['occupants','Family & Occupants','tenant_management','people','/app/occupants','basic'],
  ['survey-jobs','My Survey Quotes','survey','requestquote','/app/survey-jobs','basic'],
  ['survey-projects','Manage Hired Surveyors','survey','assignment','/app/survey-projects','standard'], ['active-projects','Active Projects','survey','assignment','/app/survey-projects','standard'],
  ['tenants','Manage Tenants','tenant_management','people','/app/tenants','basic'], ['tenant-kyc','KYC Pending Tenants','tenant_management','badge','/app/tenant-kyc?status=submitted,under_review','basic'], ['tenant-profiles','KYC Verified Tenants','tenant_management','person','/app/tenant-profiles','basic'], ['tenant-interviews','Tenant Interviews','tenant_management','calendarmonth','/app/tenant-interviews','standard'],
  ['rental-invoices','Rent Management','rent_management','receiptlong','/app/rental-invoices','standard'], ['active-rent','Active Rent','rent_management','receiptlong','/app/rental-invoices?status=pending,partially_paid','standard'], ['due-rent','Due Rent','rent_management','notifications','/app/rental-invoices?status=overdue','standard'], ['paid-rent','Paid Rent','rent_management','payments','/app/rental-invoices?status=paid','standard'], ['unpaid-rent','Unpaid Rent','rent_management','payments','/app/rental-invoices?status=pending','standard'], ['rent-agreements','Rent Agreements','rent_management','description','/app/documents?type=rent_agreement','premium'], ['rent-invoices','Rent Invoices','rent_management','receiptlong','/app/rental-invoices','standard'], ['utility-readings','Meter Readings','rent_management','electricmeter','/app/utility-readings','standard'], ['reminder-rules','Payment Reminders','rent_management','notifications','/app/reminder-rules','standard'],
  ['leases','Lease Management','lease_management','description','/app/leases','standard'], ['active-lease','Active Lease','lease_management','description','/app/leases?status=active','standard'], ['due-lease','Due Lease','lease_management','notifications','/app/leases?status=expiring','standard'], ['paid-lease','Paid Lease','lease_management','payments','/app/payments?type=lease&status=paid','standard'], ['unpaid-lease','Unpaid Lease','lease_management','payments','/app/payments?type=lease&status=pending','standard'], ['lease-agreements','Lease Agreements','lease_management','description','/app/documents?type=lease_agreement','premium'], ['lease-invoices','Lease Invoices','lease_management','receiptlong','/app/payments?type=lease','standard'],
  ['property-sales','Sales Management','sales_management','storefront','/app/payments?type=sale','premium'], ['active-sales','Active Sales','sales_management','storefront','/app/payments?type=sale&status=pending','premium'], ['completed-sales','Completed Sales','sales_management','verifieduser','/app/payments?type=sale&status=paid','premium'], ['pending-sales','Pending Sales','sales_management','approval','/app/payments?type=sale&status=pending','premium'], ['sale-agreements','Sale Agreements','sales_management','description','/app/documents?type=sale_agreement','premium'], ['sale-invoices','Sale Invoices','sales_management','receiptlong','/app/payments?type=sale','premium'],
  ['applications','Booking & Applications','applications','factcheck','/app/applications','standard'], ['booking-requests','Booking Requests','applications','calendarmonth','/app/property-visits','standard'], ['rent-applications','Rent Applications','applications','factcheck','/app/applications?type=rent','standard'], ['lease-applications','Lease Applications','applications','factcheck','/app/applications?type=lease','standard'], ['purchase-applications','Purchase Applications','applications','factcheck','/app/applications?type=sale','premium'], ['approved-applications','Approved Applications','applications','verifieduser','/app/applications?status=approved','standard'], ['rejected-applications','Rejected Applications','applications','approval','/app/applications?status=rejected','standard'],
  ['property-visits','Site Visits','site_visits','calendarmonth','/app/property-visits','standard'], ['pending-visits','Pending Visits','site_visits','calendarmonth','/app/property-visits?status=requested','standard'], ['approved-visits','Approved Visits','site_visits','verifieduser','/app/property-visits?status=confirmed,approved','standard'], ['completed-visits','Completed Visits','site_visits','factcheck','/app/property-visits?status=completed','standard'], ['cancelled-visits','Cancelled Visits','site_visits','approval','/app/property-visits?status=cancelled','standard'],
  ['payments','Payments','payments','payments','/app/payments','standard'], ['rent-payments','Rent Payments','payments','payments','/app/payments?type=rent','standard'], ['lease-payments','Lease Payments','payments','payments','/app/payments?type=lease','standard'], ['sales-payments','Sales Payments','payments','payments','/app/payments?type=sale','premium'], ['pending-payments','Pending Payments','payments','payments','/app/payments?status=pending','standard'], ['paid-payments','Paid Payments','payments','payments','/app/payments?status=paid','standard'],
  ['reports','Reports','reports','assessment','/app/reports','standard'], ['monthly-income-reports','Monthly Income Reports','reports','assessment','/app/reports?type=monthly-income','standard'], ['profit-loss','Profit & Loss','reports','assessment','/app/reports?type=profit-loss','premium'], ['tax-reports','Tax Reports','reports','assessment','/app/reports?type=tax','premium'],
  ['agreement-templates','Manage Templates','documents','description','/app/agreement-templates','basic'], ['legal-toolkit','Legal Toolkit','documents','description','/app/documents?type=legal','premium'], ['notice-templates','Notice Templates','documents','description','/app/documents?type=notice_template','premium'], ['tenant-verification-form','Tenant Verification Form','documents','badge','/app/documents?type=tenant_verification','premium'], ['handover-form','Handover Form','documents','description','/app/documents?type=handover','premium'],
  ['complaints','Complaints & Maintenance','complaints','build','/app/complaints','standard'], ['pending-complaints','Pending Complaints','complaints','build','/app/complaints?status=open,assigned','standard'], ['complaints-in-progress','In Progress','complaints','build','/app/complaints?status=in_progress','standard'], ['resolved-complaints','Resolved','complaints','verifieduser','/app/complaints?status=resolved,closed','standard'], ['property-promotions','Property Promotions','marketing','campaign','/app/property-promotions','standard'], ['facilities','Facilities','operations','accountbalance','/app/facilities','standard'], ['facility-bookings','Facility Bookings','operations','calendarmonth','/app/facility-bookings','standard'],
  ['subscription','Subscription','subscriptions','workspacepremium','/app/subscription','basic'], ['upgrade-plan','Upgrade Plan','subscriptions','workspacepremium','/app/subscription?upgrade=1','basic'], ['subscription-history','Payment History','subscriptions','payments','/app/payments?type=landlord_subscription','basic'], ['security','Security & Session','settings','verifieduser','/app/security','basic'], ['profile','Profile & Verification','profile','person','/app/profile','basic'], ['messages','Messages','communications','message','/app/messages','basic'], ['notifications','Notifications','communications','notifications','/app/notifications','basic'],
].filter((row) => !['property-spaces', 'property-media', 'property-promotions'].includes(row[0])).map((row, index) => module(row[0], row[1], row[2], 'landlord', { icon: row[3], path: row[4], ...(row[0] === 'tenancy-history' ? { actions: ['view'] } : {}), minTier: row[5], sortOrder: (index + 1) * 10, subscription: 'landlord', mobilePrimary: ['dashboard','properties','applications','messages','documents'].includes(row[0]) }));

const tenantModules = [
  ['dashboard','Dashboard','dashboard','dashboard','/app/dashboard'], ['profile','My Profile','profile','person','/app/profile'], ['tenant-profiles','Personal Details','profile','person','/app/tenant-profiles'], ['tenant-kyc','KYC & Documents','profile','badge','/app/tenant-kyc'], ['occupants','Family & Occupation','profile','people','/app/occupants'],
  ['marketplace','Property Search','discovery','explore','/marketplace'], ['rent-properties','Rent Properties','discovery','apartment','/marketplace?listingType=rent'], ['lease-properties','Lease Properties','discovery','apartment','/marketplace?listingType=lease'], ['sale-properties','Sales Properties','discovery','storefront','/marketplace?listingType=sale'], ['saved-properties','Saved Properties','discovery','folder','/app/saved-properties'],
  // Keep the canonical applications permission for the submit endpoint, while
  // the tenant-facing navigation uses My Applications and the private /mine
  // query so a landlord-enabled tenant never sees a mixed inbox by accident.
  ['my-applications','My Applications','applications','factcheck','/app/my-applications'], ['applications','Application access','applications','factcheck','/app/my-applications'], ['rent-applications','Rent Applications','applications','factcheck','/app/my-applications?type=rent'], ['lease-applications','Lease Applications','applications','factcheck','/app/my-applications?type=lease'], ['purchase-applications','Purchase Applications','applications','factcheck','/app/my-applications?type=sale'], ['approved-applications','Approved Applications','applications','verifieduser','/app/my-applications?status=approved'], ['rejected-applications','Rejected Applications','applications','approval','/app/my-applications?status=rejected'],
  ['property-visits','Site Visits','site_visits','calendarmonth','/app/property-visits'], ['book-visit','Book Visit','site_visits','calendarmonth','/marketplace'], ['pending-visits','Pending Visits','site_visits','calendarmonth','/app/property-visits?status=requested'], ['completed-visits','Completed Visits','site_visits','factcheck','/app/property-visits?status=completed'], ['cancelled-visits','Cancelled Visits','site_visits','approval','/app/property-visits?status=cancelled'],
  ['tenancies','My Tenancy','active_tenancy','homework','/app/tenancies'], ['rent-tenancy','Rent Tenancy','active_tenancy','homework','/app/tenancies?type=rent'], ['lease-tenancy','Lease Tenancy','active_tenancy','homework','/app/tenancies?type=lease'], ['purchased-property','Purchased Property','active_tenancy','storefront','/app/tenancies?type=sale'], ['my-property','My Property','active_tenancy','homework','/app/my-property'], ['renewal-request','Renewal Request','active_tenancy','notifications','/app/tenancies?status=renewal_requested'], ['move-out-request','Move-out Request','active_tenancy','notifications','/app/tenancies?status=move_out'],
  ['documents','Document Vault','documents','folder','/app/documents'], ['agreements','Agreements','documents','description','/app/documents?type=agreement'], ['rent-agreement','Rent Agreement','documents','description','/app/documents?type=rent_agreement'], ['lease-agreement','Lease Agreement','documents','description','/app/documents?type=lease_agreement'], ['sale-agreement','Sale Agreement','documents','description','/app/documents?type=sale_agreement'],
  ['complaints','Complaints & Maintenance','complaints','build','/app/complaints'], ['raise-complaint','Raise Complaint','complaints','build','/app/complaints?new=1'], ['maintenance-requests','Maintenance Requests','complaints','build','/app/complaints?category=maintenance'], ['resolved-complaints','Resolved Complaints','complaints','verifieduser','/app/complaints?status=resolved,closed'],
  ['messages','Messages','communications','message','/app/messages'], ['notifications','Notifications','communications','notifications','/app/notifications'], ['subscription','My Subscription','subscriptions','workspacepremium','/app/subscription'], ['surveyor-subscription','Surveyor Subscription','subscriptions','workspacepremium','/app/surveyor-subscription'],
].map((row, index) => module(row[0], row[1], row[2], 'tenant', { icon: row[3], path: row[4], sortOrder: (index + 1) * 10, mobilePrimary: ['dashboard','marketplace','applications','messages'].includes(row[0]) }));

const surveyorModules = [
  ['dashboard','Dashboard','dashboard','dashboard','/app/dashboard','basic'],
  ['profile','Profile','profile','person','/app/profile','basic'], ['security','Security & Session','settings','verifieduser','/app/security','basic'],
  ['surveyor-dashboard','Dashboard','dashboard','engineering','/app/surveyor-dashboard','basic'], ['assigned-properties','Assigned Properties','property_management','apartment','/app/properties','basic'], ['pending-surveys','Pending Surveys','survey','assignment','/app/surveys?status=assigned','basic'], ['in-progress-surveys','In Progress Surveys','survey','assignment','/app/surveys?status=in_progress','basic'], ['completed-surveys','Completed Surveys','survey','verifieduser','/app/surveys?status=approved,completed','basic'], ['correction-required','Correction Required','survey','approval','/app/surveys?status=returned','basic'],
  ['surveys','Property Survey','survey','assignment','/app/surveys','basic'], ['survey-job-marketplace','Survey Job Marketplace','survey','explore','/app/survey-job-marketplace','basic'], ['survey-services','My Survey Services','survey','storefront','/app/survey-services','basic'], ['survey-jobs','Client Job Requests','survey','businesscenter','/app/survey-jobs','basic'], ['survey-quotations','Quotations','survey','requestquote','/app/survey-quotations','basic'], ['survey-projects','Survey Projects','survey','assignment','/app/survey-projects','basic'], ['location-verification','Location Verification','survey','straighten','/app/field-data?type=location','basic'], ['specification-verification','Specification Verification','survey','factcheck','/app/field-data?type=specification','basic'], ['room-verification','Room Verification','survey','meetingroom','/app/field-data?type=room','basic'], ['facility-verification','Facility Verification','survey','accountbalance','/app/field-data?type=facility','basic'], ['field-data','Survey Photos & Notes','survey','straighten','/app/field-data','basic'],
  ['survey-reports','Survey Reports','reports','assessment','/app/survey-reports','basic'], ['submitted-reports','Submitted Reports','reports','description','/app/survey-reports?status=client_preview,final','basic'], ['approved-reports','Approved Reports','reports','verifieduser','/app/survey-reports?status=locked,final','basic'], ['rejected-reports','Rejected Reports','reports','approval','/app/survey-reports?status=revision_requested','basic'], ['site-visits','Site Visits','site_visits','calendarmonth','/app/site-visits','basic'], ['assigned-visits','Assigned Visits','site_visits','calendarmonth','/app/site-visits'],
  ['documents','Documents','documents','folder','/app/documents','basic'], ['surveyor-subscription','Subscription','subscriptions','workspacepremium','/app/surveyor-subscription','basic'], ['surveyor-profile','Profile & Verification','profile','person','/app/surveyor-profile','basic'], ['surveyor-verification','KYC Verification','profile','verifieduser','/app/surveyor-verification','basic'], ['survey-equipment','Equipment','operations','build','/app/survey-equipment','basic'], ['survey-team','Team','operations','groupwork','/app/survey-team','basic'], ['survey-clients','Clients','operations','people','/app/survey-clients','basic'], ['payments','Payment History','payments','payments','/app/payments','standard'], ['survey-reviews','Reviews','operations','factcheck','/app/survey-reviews','basic'], ['survey-disputes','Disputes','operations','approval','/app/survey-disputes','basic'], ['survey-promotions','Promotions','operations','campaign','/app/survey-promotions','basic'], ['messages','Messages','communications','message','/app/messages','basic'], ['notifications','Notifications','communications','notifications','/app/notifications','basic'],
].map((row, index) => module(row[0], row[1], row[2], 'surveyor', { icon: row[3], path: row[4], minTier: row[5] || 'basic', sortOrder: (index + 1) * 10, subscription: 'surveyor', mobilePrimary: ['surveyor-dashboard','surveys','field-data','survey-reports','documents'].includes(row[0]) }));

export const RBAC_PLATFORM_MODULES = Object.freeze([...adminModules, ...landlordModules, ...tenantModules, ...surveyorModules]);

const tierWeight = { none: 0, basic: 1, starter: 1, free: 1, standard: 2, professional: 2, premium: 3, business: 3, agency: 3, enterprise: 4 };
function tierForLandlordPlan(plan) {
  if (!plan) return 'none';
  if (plan === 'starter') return 'basic';
  if (plan === 'professional') return 'standard';
  if (['business', 'enterprise'].includes(plan)) return 'premium';
  return plan;
}
function tierForSurveyorPlan(plan) {
  if (!plan) return 'none';
  if (plan === 'basic') return 'basic';
  if (plan === 'professional') return 'standard';
  if (['premium', 'agency', 'enterprise'].includes(plan)) return 'premium';
  return plan;
}
function notExpired(date) {
  if (!date) return false;
  const timestamp = new Date(date).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function enabledFlagIsActive(enabled, expiresAt) {
  return Boolean(enabled) && (!expiresAt || notExpired(expiresAt));
}

function subscriptionRecordIsActive(subscription = {}) {
  const status = String(subscription.status || '').trim().toLowerCase();
  if (!['active', 'trial', 'expiring_soon', 'grace_period'].includes(status)) return false;
  const expiry = subscription.expiresAt || subscription.graceEndsAt;
  if (!expiry) return status !== 'grace_period';
  const timestamp = new Date(expiry).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}
export async function subscriptionContextForUser(user = {}) {
  const effectiveRole = getEffectiveRole(user);
  const cacheKey = [
    String(user?._id || 'anonymous'),
    effectiveRole,
    String(user?.activeMode || 'regular'),
    Boolean(user?.landlordEnabled),
    String(user?.landlordSubscriptionExpiresAt || ''),
    String(user?.landlordPlan || ''),
    Boolean(user?.surveyorEnabled),
    String(user?.surveyorSubscriptionExpiresAt || ''),
    String(user?.surveyorPlan || ''),
  ].join(':');
  const cached = subscriptionContextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const remember = (value) => {
    subscriptionContextCache.set(cacheKey, { value, expiresAt: Date.now() + SUBSCRIPTION_CONTEXT_CACHE_MS });
    if (subscriptionContextCache.size > 500) {
      for (const [key, entry] of subscriptionContextCache.entries()) {
        if (entry.expiresAt <= Date.now()) subscriptionContextCache.delete(key);
      }
    }
    return value;
  };

  if (effectiveRole === 'landlord') {
    let active = enabledFlagIsActive(user.landlordEnabled, user.landlordSubscriptionExpiresAt);
    let plan = user.landlordPlan || 'starter';
    try {
      const { Subscription } = await import('../models/index.js');
      if (Subscription?.db?.readyState) {
        const subscriptions = await Subscription.find({ user: user._id, status: 'active' }).sort('-expiresAt').lean();
        const sub = subscriptions.find((candidate) => subscriptionRecordIsActive(candidate));
        if (sub) { active = true; plan = sub.plan || plan; }
      }
    } catch { /* navigation still works without DB during static tests */ }
    return remember({ effectiveRole, subscriptionType: 'landlord', active, plan, tier: active ? tierForLandlordPlan(plan) : 'none' });
  }
  if (effectiveRole === 'surveyor') {
    let active = user.role === 'surveyor' || enabledFlagIsActive(user.surveyorEnabled, user.surveyorSubscriptionExpiresAt);
    let plan = user.surveyorPlan || 'basic';
    try {
      const { SurveyorSubscription } = await import('../models/index.js');
      if (SurveyorSubscription?.db?.readyState) {
        const subscriptions = await SurveyorSubscription.find({ user: user._id, status: { $in: ['trial', 'active', 'expiring_soon', 'grace_period'] } }).sort('-expiresAt').populate('plan').lean();
        const sub = subscriptions.find((candidate) => subscriptionRecordIsActive(candidate));
        if (sub) { active = true; plan = sub.planSnapshot?.key || sub.plan?.key || plan; }
      }
    } catch { /* ignore */ }
    return remember({ effectiveRole, subscriptionType: 'surveyor', active, plan, tier: active ? tierForSurveyorPlan(plan) : 'none' });
  }
  return remember({ effectiveRole, subscriptionType: undefined, active: true, plan: 'regular', tier: 'premium' });
}

export function moduleAllowedByTier(moduleDef = {}, context = {}) {
  const meta = moduleDef.metadata || {};
  if (!meta.subscription) return true;
  if (!context.active) return Boolean(meta.viewOnlyWhenExpired) && ['dashboard', 'subscription', 'surveyor-subscription', 'profile', 'surveyor-profile', 'surveyor-verification', 'messages', 'notifications', 'properties', 'surveys', 'documents'].includes(moduleDef.key);
  return (tierWeight[context.tier] || 0) >= (tierWeight[meta.minTier || 'basic'] || 1);
}

export async function canAccessPlatformModule(moduleDef = {}, user = {}) {
  if (!moduleDef || moduleDef.enabled === false) return false;
  const roles = capabilityRolesForUser(user);
  for (const capabilityRole of roles) {
    if (capabilityRole === 'admin' && moduleDef.key === 'documents') return true;
    if (capabilityRole === 'admin' && moduleDef.key === 'role-permissions') return true;
    const permission = await rolePermissionDecision(capabilityRole, `module:${moduleDef.key}`, 'view');
    if ((permission.managed || permission.entry) && !permission.allowed) continue;
    const rules = Array.isArray(moduleDef.accessRules) && moduleDef.accessRules.length ? moduleDef.accessRules : [{ roles: moduleDef.roles || [], modes: moduleDef.modes || [] }];
    const capabilityUser = capabilityRole === 'landlord' || capabilityRole === 'surveyor' ? { ...plainUser(user), activeMode: capabilityRole } : user;
    const requiredCapability = String(moduleDef.metadata?.capability || moduleDef.metadata?.subscription || '').trim().toLowerCase();
    const featureEnabled = ['landlord', 'surveyor'].includes(requiredCapability) && capabilityRole === requiredCapability;
    if (!featureEnabled && !rules.some((rule) => roleMatchesRule(capabilityUser, rule))) continue;
    const role = moduleDef.metadata?.role;
    if (role && role !== capabilityRole && !(capabilityRole === 'admin' && role === 'admin')) continue;
    const context = await subscriptionContextForUser(capabilityUser);
    if (moduleAllowedByTier(moduleDef, context)) return true;
  }
  return false;
}

const RESOURCE_ACCESS = Object.freeze({
  users: { admin: ADMIN_ACTIONS },
  properties: { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, surveyor: VIEW_ONLY },
  units: { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS },
  tenants: { admin: ADMIN_ACTIONS, landlord: ['view', 'create', 'edit', 'download'], tenant: ['view', 'edit'] },
  leases: { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, tenant: ['view', 'download'] },
  surveys: { admin: ADMIN_ACTIONS, surveyor: ['view', 'edit', 'download'], landlord: VIEW_ONLY },
  applications: { admin: ADMIN_ACTIONS, landlord: ['view', 'edit', 'approve', 'download'], tenant: ['view', 'create', 'edit', 'delete'] },
  payments: { admin: ADMIN_ACTIONS, landlord: ['view', 'create', 'edit', 'export', 'download'], tenant: ['view', 'create', 'download'], surveyor: ['view', 'download'] },
  complaints: { admin: ADMIN_ACTIONS, landlord: ['view', 'edit', 'approve', 'download'], tenant: ['view', 'create', 'edit', 'delete'], surveyor: VIEW_ONLY },
  approvals: { admin: ADMIN_ACTIONS, landlord: ['view', 'create'], tenant: ['view', 'create'], surveyor: ['view', 'create'] },
  notifications: { admin: ADMIN_ACTIONS, landlord: TENANT_ACTIONS, tenant: TENANT_ACTIONS, surveyor: TENANT_ACTIONS },
  messages: { admin: ADMIN_ACTIONS, landlord: TENANT_ACTIONS, tenant: TENANT_ACTIONS, surveyor: TENANT_ACTIONS },
  documents: { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, tenant: TENANT_ACTIONS, surveyor: SURVEYOR_ACTIONS },
  subscriptions: { admin: ADMIN_ACTIONS, landlord: VIEW_ONLY },
  attendance: { admin: ADMIN_ACTIONS, surveyor: ['view', 'create', 'edit'] },
  'audit-logs': { admin: VIEW_ONLY },
  'landlord-plans': { admin: ADMIN_ACTIONS }, 'surveyor-plans': { admin: ADMIN_ACTIONS },
  'surveyor-subscriptions': { admin: ADMIN_ACTIONS, surveyor: VIEW_ONLY, tenant: VIEW_ONLY },
  'surveyor-verifications': { admin: ADMIN_ACTIONS, surveyor: ['view', 'create', 'edit'], tenant: ['view', 'create', 'edit'] },
  'surveyor-profiles': { admin: ADMIN_ACTIONS, surveyor: ['view', 'create', 'edit', 'delete'], tenant: ['view', 'create', 'edit', 'delete'] },
  'survey-services': { admin: ADMIN_ACTIONS, surveyor: SURVEYOR_ACTIONS, tenant: SURVEYOR_ACTIONS },
  // Landlords use survey-jobs as the private My Survey Quotes workspace.
  // The direct quote endpoints enforce client ownership server-side.
  'survey-jobs': { admin: ADMIN_ACTIONS, landlord: VIEW_ONLY, surveyor: SURVEYOR_ACTIONS },
  'survey-quotations': { admin: ADMIN_ACTIONS, surveyor: SURVEYOR_ACTIONS },
  'survey-projects': { admin: ADMIN_ACTIONS, landlord: ['view', 'edit', 'approve', 'download'], surveyor: SURVEYOR_ACTIONS, tenant: VIEW_ONLY },
  'site-visits': { admin: ADMIN_ACTIONS, surveyor: SURVEYOR_ACTIONS, tenant: TENANT_ACTIONS },
  'field-data': { admin: ADMIN_ACTIONS, surveyor: SURVEYOR_ACTIONS },
  'survey-equipment': { admin: ADMIN_ACTIONS, surveyor: SURVEYOR_ACTIONS },
  'survey-reports': { admin: ADMIN_ACTIONS, surveyor: SURVEYOR_ACTIONS, tenant: VIEW_ONLY },
  'survey-team': { admin: ADMIN_ACTIONS, surveyor: SURVEYOR_ACTIONS },
  'survey-clients': { admin: ADMIN_ACTIONS, surveyor: SURVEYOR_ACTIONS },
  'survey-reviews': { admin: ADMIN_ACTIONS, surveyor: ['view', 'edit'], tenant: ['view', 'create', 'edit'] },
  'survey-disputes': { admin: ADMIN_ACTIONS, surveyor: ['view', 'create', 'edit'], tenant: ['view', 'create', 'edit'] },
  'survey-promotions': { admin: ADMIN_ACTIONS, surveyor: SURVEYOR_ACTIONS },
  'site-settings': { admin: ADMIN_ACTIONS }, 'seo-pages': { admin: ADMIN_ACTIONS }, 'home-carousel': { admin: ADMIN_ACTIONS }, 'home-sections': { admin: ADMIN_ACTIONS },
  'property-type-configs': { admin: ADMIN_ACTIONS }, 'area-units': { admin: ADMIN_ACTIONS },
  'property-spaces': { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, surveyor: VIEW_ONLY },
  'property-media': { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, tenant: VIEW_ONLY, surveyor: VIEW_ONLY },
  'tenant-profiles': { admin: ADMIN_ACTIONS, landlord: ['view'], tenant: ['view', 'create', 'edit'] },
  'tenant-kyc': { admin: ADMIN_ACTIONS, landlord: ['view'], tenant: ['view', 'create', 'edit'] },
  occupants: { admin: ADMIN_ACTIONS, landlord: ['view'], tenant: ['view', 'create', 'edit', 'delete'] },
  'tenant-interviews': { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, tenant: ['view', 'edit'] },
  'property-visits': { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, tenant: ['view', 'create', 'edit', 'delete'], surveyor: ['view', 'edit'] },
  tenancies: { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, tenant: ['view', 'edit', 'download'] },
  'rental-invoices': { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, tenant: ['view', 'download'] },
  'utility-readings': { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, tenant: VIEW_ONLY },
  'reminder-rules': { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS },
  'property-promotions': { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS },
  'site-enquiries': { admin: ADMIN_ACTIONS },
  facilities: { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, tenant: VIEW_ONLY },
  'facility-bookings': { admin: ADMIN_ACTIONS, landlord: LANDLORD_ACTIONS, tenant: ['view', 'create', 'edit', 'delete'] },
  'platform-modules': { admin: ADMIN_ACTIONS }, 'content-pages': { admin: ADMIN_ACTIONS }, 'notification-preferences': { admin: ADMIN_ACTIONS, landlord: TENANT_ACTIONS, tenant: TENANT_ACTIONS, surveyor: TENANT_ACTIONS }, 'integration-settings': { admin: ADMIN_ACTIONS },
});

function permissionEntry(key, label, kind, category, actions, role) {
  return {
    key: String(key).toLowerCase(), label: String(label || key), kind, category: category || 'general', enabled: true,
    actions: [...new Set(actions || [])], scope: normalizePermissionRole(role) === 'admin' ? 'all' : 'own',
  };
}

export function defaultPermissionEntriesForRole(role = 'tenant') {
  const normalizedRole = normalizePermissionRole(role);
  const modules = RBAC_PLATFORM_MODULES
    .filter((item) => item.scope === 'app' && item.metadata?.role === normalizedRole)
    .map((item) => permissionEntry(`module:${item.key}`, item.label, 'module', item.section, item.metadata?.permissions?.[normalizedRole] || VIEW_ONLY, normalizedRole));
  const resources = Object.entries(RESOURCE_ACCESS)
    .filter(([, accessMap]) => Array.isArray(accessMap?.[normalizedRole]))
    .map(([key, accessMap]) => permissionEntry(`resource:${key}`, key.replaceAll('-', ' '), 'resource', 'resources', accessMap[normalizedRole], normalizedRole));
  const entries = [...modules, ...resources];
  return [...new Map(entries.map((entry) => [entry.key, entry])).values()]
    .sort((left, right) => left.category.localeCompare(right.category) || left.label.localeCompare(right.label));
}

export function permissionCatalog() {
  const allEntries = ROLE_KEYS.flatMap((role) => defaultPermissionEntriesForRole(role));
  return [...new Map(allEntries.map((entry) => [entry.key, { key: entry.key, label: entry.label, kind: entry.kind, category: entry.category, actions: ACTIONS, scopeOptions: PERMISSION_SCOPES }])).values()]
    .sort((left, right) => left.category.localeCompare(right.category) || left.label.localeCompare(right.label));
}

async function storedRolePermission(role) {
  const normalizedRole = normalizePermissionRole(role);
  const cached = rolePermissionCache.get(normalizedRole);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    // Cache the in-flight lookup itself so concurrent module/resource checks
    // share one MongoDB query instead of stampeding the same role document.
    const pending = (async () => {
      const { RolePermission } = await import('../models/index.js');
      if (!RolePermission?.db?.readyState) return null;
      const document = await RolePermission.findOne({ role: normalizedRole }).lean();
      return document ? { entries: Array.isArray(document.entries) ? document.entries : [] } : null;
    })();
    rolePermissionCache.set(normalizedRole, { value: pending, expiresAt: Date.now() + 5000 });
    const value = await pending;
    rolePermissionCache.set(normalizedRole, { value, expiresAt: Date.now() + 5000 });
    return value;
  } catch {
    rolePermissionCache.delete(normalizedRole);
    return null;
  }
}

export async function rolePermissionDecision(role, key, action = 'view') {
  const normalizedRole = normalizePermissionRole(role);
  const stored = await storedRolePermission(normalizedRole);
  const fallback = defaultPermissionEntriesForRole(normalizedRole).find((entry) => entry.key === String(key).toLowerCase());
  // A managed permission document can predate a newly added module. Treat a
  // missing entry as the bounded default, while an explicit disabled entry
  // remains authoritative. This prevents older tenants from being locked
  // out of Dashboard after a deployment adds capability modules.
  const entry = stored ? (stored.entries.find((item) => item.key === String(key).toLowerCase()) || fallback) : fallback;
  return { managed: Boolean(stored), entry, allowed: Boolean(entry?.enabled !== false && entry?.actions?.includes(action)) };
}

export async function featureAllowed(key, user, action = 'view') {
  if (String(key || '').toLowerCase() === 'module:documents' && String(user?.role || '').toLowerCase() === 'admin') return true;
  for (const capabilityRole of capabilityRolesForUser(user)) {
    if (capabilityRole === 'admin' && ['module:role-permissions', 'resource:role-permissions'].includes(String(key).toLowerCase())) return true;
    if ((await rolePermissionDecision(capabilityRole, key, action)).allowed) return true;
  }
  return false;
}

export async function permissionPayloadForResources(user = {}) {
  const roles = capabilityRolesForUser(user);
  const entries = await Promise.all(Object.keys(RESOURCE_ACCESS).map(async (key) => {
    const actions = new Set();
    for (const role of roles) {
      const modulePermission = await rolePermissionDecision(role, `module:${key}`, 'view');
      const permission = await rolePermissionDecision(role, `resource:${key}`, 'view');
      const resourceActions = permission.entry?.actions || RESOURCE_ACCESS[key]?.[role] || [];
      const allowed = modulePermission.entry ? resourceActions.filter((item) => modulePermission.entry.actions.includes(item)) : modulePermission.managed ? [] : resourceActions;
      allowed.forEach((item) => actions.add(item));
    }
    return [key, [...actions]];
  }));
  return Object.fromEntries(entries);
}

export async function canResourceAction(resource, user, action = 'view', config = null) {
  for (const effectiveRole of capabilityRolesForUser(user)) {
    if (effectiveRole === 'admin' && resource === 'documents') return true;
    const modulePermission = await rolePermissionDecision(effectiveRole, `module:${resource}`, action);
    if ((modulePermission.managed || modulePermission.entry) && !modulePermission.allowed) continue;
    const permission = await rolePermissionDecision(effectiveRole, `resource:${resource}`, action);
    if (permission.managed && !permission.allowed) continue;
    if (!permission.managed && permission.entry && !permission.allowed) continue;
    if (effectiveRole === 'admin' && !permission.entry) return true;
    const roleActions = permission.entry?.actions || RESOURCE_ACCESS[resource]?.[effectiveRole] || [];
    const allowed = roleActions.includes(action) || (action === 'edit' && roleActions.includes('update')) || (action === 'view' && config?.readRoles?.includes(user?.role));
    if (!allowed) continue;
    const context = await subscriptionContextForUser(effectiveRole === 'landlord' || effectiveRole === 'surveyor' ? { ...plainUser(user), activeMode: effectiveRole } : user);
    if (['landlord', 'surveyor'].includes(effectiveRole) && !context.active && MUTATION_ACTIONS.has(action)) continue;
    return true;
  }
  return false;
}

export async function assertResourceAction(resource, user, action, config, ApiErrorClass) {
  if (!await canResourceAction(resource, user, action, config)) {
    const effectiveRole = getEffectiveRole(user);
    const context = await subscriptionContextForUser(user);
    if (['landlord', 'surveyor'].includes(effectiveRole) && !context.active && MUTATION_ACTIONS.has(action)) {
      throw new ApiErrorClass(403, `Your ${effectiveRole} subscription is inactive or expired. Renew to ${action} records.`);
    }
    throw new ApiErrorClass(403, `Your role cannot ${action} this module`);
  }
}

export function permissionPayloadForModules(modules = [], user = {}) {
  const roles = capabilityRolesForUser(user);
  return Object.fromEntries(modules.map((item) => {
    const actions = new Set();
    for (const role of roles) {
      const configured = item.metadata?.permissions?.[role];
      if (Array.isArray(configured)) configured.forEach((action) => actions.add(action));
      const roleActions = item.metadata?.role === role ? item.metadata?.permissions?.[item.metadata.role] : null;
      if (Array.isArray(roleActions)) roleActions.forEach((action) => actions.add(action));
    }
    return [item.key, actions.size ? [...actions] : VIEW_ONLY];
  }));
}

export { RESOURCE_ACCESS };
