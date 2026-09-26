import { RBAC_PLATFORM_MODULES } from './rbac.js';
const SECTION_ORDER = Object.freeze({
  main: 10, general: 10,
  user_management: 20, property_management: 30, rent_management: 40, lease_management: 50, sales_management: 60,
  payments: 70, subscriptions: 80, surveyors: 90, landlords: 100, communications: 110, complaints: 120, tenant_management: 130,
  operations: 140, applications: 150, tenancy: 160, settings: 170,
  discovery: 180, property: 190, finance: 200, survey: 210, records: 220, reports: 230, marketing: 240, communication: 250, account: 260, administration: 270, system: 280,
});
const sectionOrderFor = (section) => SECTION_ORDER[section] ?? 999;
const publicModule = (key, label, path, icon, sortOrder) => ({ key, label, path, icon, scope: 'public', kind: 'page', section: 'main', sectionOrder: sectionOrderFor('main'), roles: [], modes: [], enabled: true, mobilePrimary: false, sortOrder });
const appModule = (key, label, icon, roles, modes, sortOrder, options = {}) => {
  const section = options.section || 'operations';
  return {
    key, label, icon, path: options.path || `/app/${key}`, scope: 'app', kind: options.kind || 'resource', section, sectionOrder: options.sectionOrder ?? sectionOrderFor(section),
    roles, modes, enabled: true, mobilePrimary: Boolean(options.mobilePrimary), sortOrder, ...(options.description && { description: options.description }),
  };
};

const admin = ['admin'];
const manager = ['manager'];
const adminManager = ['admin', 'manager'];
const tenant = ['tenant'];
const staff = ['admin', 'manager'];
const regular = ['regular'];
const landlord = ['landlord'];
const surveyor = ['surveyor'];
const RETIRED_SURVEYOR_MODULE_KEYS = new Set([
  'assigned-properties', 'pending-surveys', 'in-progress-surveys', 'completed-surveys', 'correction-required',
  'survey-services', 'location-verification', 'specification-verification', 'room-verification', 'facility-verification',
  'field-data', 'survey-reports', 'submitted-reports', 'approved-reports', 'rejected-reports', 'site-visits', 'assigned-visits',
  'survey-equipment', 'survey-team', 'survey-clients', 'survey-reviews', 'survey-disputes', 'survey-promotions',
]);


const ADMIN_WORKSPACE_OVERRIDES = Object.freeze({
  documents: { label: 'Document Vault', section: 'general', sectionOrder: sectionOrderFor('general'), sortOrder: 15, icon: 'folder', description: 'Secure property, tenancy, survey, payment and identity records.' },
  users: { label: 'User Management', section: 'user_management', sectionOrder: sectionOrderFor('user_management'), sortOrder: 10, icon: 'people', description: 'Manage users, roles and access.' },
  properties: { label: 'Property Management', section: 'property_management', sectionOrder: sectionOrderFor('property_management'), sortOrder: 20, icon: 'apartment', description: 'Add, edit, delete and view properties, specifications, rooms, galleries and exact map locations.' },
  'rental-invoices': { label: 'Rent Management', section: 'rent_management', sectionOrder: sectionOrderFor('rent_management'), sortOrder: 50, icon: 'receiptlong', description: 'Manage rents, due cycles, WhatsApp reminders, payment status, invoices and monthly rent reports.' },
  'rental-management': { key: 'rental-management', path: '/app/rental-management', scope: 'app', kind: 'system', roles: admin, modes: regular, enabled: true, mobilePrimary: false, label: 'Rental Management', section: 'rent_management', sectionOrder: sectionOrderFor('rent_management'), sortOrder: 45, icon: 'meetingroom', description: 'Track rental properties, floors, rooms, current and previous tenants, agreements, monthly cycles and occupancy.' },
  leases: { label: 'Lease Management', section: 'lease_management', sectionOrder: sectionOrderFor('lease_management'), sortOrder: 60, icon: 'description', description: 'Manage leases, payment cycles, due reminders, legal agreements, reports and active lease records.' },
  payments: { label: 'Track All Payments', section: 'payments', sectionOrder: sectionOrderFor('payments'), sortOrder: 70, icon: 'payments', description: 'Track rent, lease, sale, deposit, subscription and other payments.' },
  'subscription-payment-approvals': { key: 'subscription-payment-approvals', path: '/app/subscription-payment-approvals', scope: 'app', kind: 'system', roles: admin, modes: regular, enabled: true, mobilePrimary: false, label: 'Subscription Payment Approvals', section: 'payments', sectionOrder: sectionOrderFor('payments'), sortOrder: 75, icon: 'verifieduser', description: 'Approve or reject manual UPI subscription payments.' },
  'property-sales': { key: 'property-sales', label: 'Property Sales Management', path: '/app/payments?type=sale', icon: 'storefront', scope: 'app', kind: 'external', section: 'sales_management', sectionOrder: sectionOrderFor('sales_management'), roles: adminManager, modes: regular, enabled: true, mobilePrimary: false, sortOrder: 80, description: 'Manage property sales status, sale payments, invoices, monthly sales reports and sale agreements.' },
  subscriptions: { key: 'subscriptions', label: 'Manage Subscriptions', path: '/app/subscriptions', icon: 'workspacepremium', scope: 'app', kind: 'resource', section: 'subscriptions', sectionOrder: sectionOrderFor('subscriptions'), roles: adminManager, modes: regular, enabled: true, mobilePrimary: false, sortOrder: 90, description: 'Manage landlord and surveyor subscriptions.' },
  'landlord-plans': { key: 'landlord-plans', path: '/app/landlord-plans', scope: 'app', kind: 'resource', roles: adminManager, modes: regular, enabled: true, mobilePrimary: false, label: 'Landlord Subscription Plans', section: 'subscriptions', sectionOrder: sectionOrderFor('subscriptions'), sortOrder: 100, icon: 'workspacepremium' },
  'surveyor-plans': { key: 'surveyor-plans', path: '/app/surveyor-plans', scope: 'app', kind: 'resource', roles: adminManager, modes: regular, enabled: true, mobilePrimary: false, label: 'Surveyor Subscription Plans', section: 'subscriptions', sectionOrder: sectionOrderFor('subscriptions'), sortOrder: 110, icon: 'workspacepremium' },
  'surveyor-profiles': { key: 'surveyor-profiles', path: '/app/surveyor-profiles', scope: 'app', kind: 'resource', roles: adminManager, modes: regular, enabled: true, mobilePrimary: false, label: 'Manage Surveyors', section: 'surveyors', sectionOrder: sectionOrderFor('surveyors'), sortOrder: 120, icon: 'engineering' },
  'surveyor-verifications': { key: 'surveyor-verifications', path: '/app/surveyor-verifications', scope: 'app', kind: 'resource', roles: adminManager, modes: regular, enabled: true, mobilePrimary: false, label: 'Surveyor Verifications', section: 'surveyors', sectionOrder: sectionOrderFor('surveyors'), sortOrder: 130, icon: 'verifieduser' },
  landlords: { key: 'landlords', label: 'Manage Landlords', path: '/app/users?role=landlord', icon: 'businesscenter', scope: 'app', kind: 'external', section: 'landlords', sectionOrder: sectionOrderFor('landlords'), roles: adminManager, modes: regular, enabled: true, mobilePrimary: false, sortOrder: 140, description: 'Open user management filtered for landlord-capable accounts.' },
  messages: { label: 'Messages', section: 'communications', sectionOrder: sectionOrderFor('communications'), sortOrder: 150, icon: 'message' },
  'site-enquiries': { label: 'Website Inquiries', section: 'communications', sectionOrder: sectionOrderFor('communications'), sortOrder: 160, icon: 'message' },
  complaints: { label: 'Complaint & Maintenance', section: 'complaints', sectionOrder: sectionOrderFor('complaints'), sortOrder: 170, icon: 'build' },
  tenants: { label: 'Manage Tenants', section: 'tenant_management', sectionOrder: sectionOrderFor('tenant_management'), sortOrder: 180, icon: 'people' },
  'tenant-profiles': { label: 'Tenant Profiles', section: 'tenant_management', sectionOrder: sectionOrderFor('tenant_management'), sortOrder: 190, icon: 'person' },
  'tenant-kyc': { label: 'Tenant KYC', section: 'tenant_management', sectionOrder: sectionOrderFor('tenant_management'), sortOrder: 200, icon: 'badge' },
  occupants: { label: 'Family & Occupation', section: 'tenant_management', sectionOrder: sectionOrderFor('tenant_management'), sortOrder: 210, icon: 'people' },
  'tenant-interviews': { label: 'Tenant Interviews', section: 'tenant_management', sectionOrder: sectionOrderFor('tenant_management'), sortOrder: 220, icon: 'calendarmonth' },
  'property-visits': { label: 'Manage Site Visits', section: 'operations', sectionOrder: sectionOrderFor('operations'), sortOrder: 230, icon: 'calendarmonth' },
  applications: { label: 'Tenant Applications', section: 'applications', sectionOrder: sectionOrderFor('applications'), sortOrder: 240, icon: 'factcheck' },
  tenancies: { label: 'Active Tenancy', section: 'tenancy', sectionOrder: sectionOrderFor('tenancy'), sortOrder: 250, icon: 'homework' },
  'drive-admin': { label: 'Drive Administration', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 300, icon: 'folder' },
  'backup-recovery': { key: 'backup-recovery', path: '/app/backup-recovery', scope: 'app', kind: 'system', roles: admin, modes: regular, enabled: true, mobilePrimary: false, label: 'Backup & Recovery', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 305, icon: 'backup', description: 'Encrypted MongoDB, uploaded-data and source backups with controlled recovery.' },
  security: { label: 'Security & Session', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 310, icon: 'security' },
  'site-admin': { label: 'Site, Design & Home Page', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 320, icon: 'web' },
  'platform-modules': { label: 'Navigation & Modules', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 330, icon: 'settings' },
  'content-pages': { label: 'Content Pages', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 340, icon: 'description' },
  'integration-settings': { label: 'Integrations', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 350, icon: 'settings' },
  'site-settings': { key: 'site-settings', path: '/app/site-settings', scope: 'app', kind: 'resource', roles: admin, modes: regular, enabled: true, mobilePrimary: false, label: 'Site Identity', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 360, icon: 'web' },
  'notification-preferences': { key: 'notification-preferences', path: '/app/notification-preferences', scope: 'app', kind: 'resource', roles: admin, modes: regular, enabled: true, mobilePrimary: false, label: 'WhatsApp Notification', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 370, icon: 'notifications' },
  'seo-pages': { key: 'seo-pages', path: '/app/seo-pages', scope: 'app', kind: 'resource', roles: admin, modes: regular, enabled: true, mobilePrimary: false, label: 'SEO Pages', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 380, icon: 'web' },
  'home-carousel': { key: 'home-carousel', path: '/app/home-carousel', scope: 'app', kind: 'resource', roles: admin, modes: regular, enabled: true, mobilePrimary: false, label: 'Home Page Carousel', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 390, icon: 'collections' },
  'home-sections': { key: 'home-sections', path: '/app/home-sections', scope: 'app', kind: 'resource', roles: admin, modes: regular, enabled: true, mobilePrimary: false, label: 'Home Page Sections', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 400, icon: 'web' },
  'property-type-configs': { key: 'property-type-configs', path: '/app/property-type-configs', scope: 'app', kind: 'resource', roles: admin, modes: regular, enabled: true, mobilePrimary: false, label: 'Property Type', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 410, icon: 'apartment' },
  'area-units': { key: 'area-units', path: '/app/area-units', scope: 'app', kind: 'resource', roles: admin, modes: regular, enabled: true, mobilePrimary: false, label: 'Area Units', section: 'settings', sectionOrder: sectionOrderFor('settings'), sortOrder: 420, icon: 'straighten' },
});

function applyAdminWorkspace(module) {
  if (module.scope !== 'app') return module;
  const override = ADMIN_WORKSPACE_OVERRIDES[module.key];
  if (!override) return module;
  return { ...module, ...override, key: module.key, scope: 'app', enabled: module.enabled, roles: module.roles, modes: module.modes, accessRules: module.accessRules, metadata: { ...(module.metadata || {}), adminWorkspaceManaged: true } };
}

const RAW_PLATFORM_MODULES = [
  publicModule('properties', 'Properties', '/marketplace', 'storefront', 10),
  publicModule('surveyors', 'Surveyors', '/surveyors', 'engineering', 20),
  publicModule('pricing', 'Pricing', '/pricing', 'sell', 30),
  publicModule('about', 'About', '/about', 'info', 40),
  publicModule('contact', 'Contact', '/contact', 'mail', 50),

  appModule('dashboard', 'Dashboard', 'dashboard', ['admin','manager','tenant','user','surveyor'], ['regular','landlord'], 10, { section: 'general', kind: 'system', mobilePrimary: true }),
  appModule('users', 'Users', 'people', admin, regular, 20, { section: 'administration' }),
  appModule('properties', 'Properties', 'apartment', adminManager, regular, 30, { section: 'property' }),
  appModule('property-management', 'Property Structure', 'apartment', adminManager, regular, 40, { section: 'property', kind: 'system' }),
  appModule('rental-management', 'Rental Management', 'meetingroom', admin, regular, 45, { section: 'property', kind: 'system' }),
  appModule('tenants', 'Tenants', 'people', adminManager, regular, 70, { section: 'tenancy' }),
  appModule('tenant-profiles', 'Tenant Profiles', 'person', adminManager, regular, 80, { section: 'tenancy' }),
  appModule('tenant-kyc', 'Tenant KYC', 'badge', adminManager, regular, 90, { section: 'tenancy' }),
  appModule('occupants', 'Family & Occupants', 'people', adminManager, regular, 100, { section: 'tenancy' }),
  appModule('applications', 'Applications', 'factcheck', adminManager, regular, 110, { section: 'tenancy' }),
  appModule('tenant-interviews', 'Tenant Interviews', 'calendarmonth', adminManager, regular, 120, { section: 'tenancy' }),
  appModule('property-visits', 'Property Site Visits', 'calendarmonth', adminManager, regular, 130, { section: 'tenancy' }),
  appModule('tenancies', 'Active Tenancies', 'homework', adminManager, regular, 140, { section: 'tenancy' }),
  appModule('leases', 'Lease Management', 'description', adminManager, regular, 150, { section: 'tenancy' }),
  appModule('rental-invoices', 'Rent & Bills', 'receiptlong', adminManager, regular, 160, { section: 'finance' }),
  appModule('utility-readings', 'Meter Readings', 'electricmeter', adminManager, regular, 170, { section: 'finance' }),
  appModule('reminder-rules', 'Payment Reminders', 'notifications', admin, regular, 180, { section: 'finance' }),
  appModule('payments', 'Payments & Invoices', 'payments', adminManager, regular, 190, { section: 'finance' }),
  appModule('complaints', 'Complaints & Maintenance', 'build', adminManager, regular, 200, { section: 'operations' }),
  appModule('facilities', 'Facilities', 'accountbalance', adminManager, regular, 210, { section: 'operations' }),
  appModule('facility-bookings', 'Facility Bookings', 'calendarmonth', adminManager, regular, 220, { section: 'operations' }),
  appModule('surveys', 'Assigned Surveys', 'assignment', adminManager, regular, 230, { section: 'survey' }),
  appModule('approvals', 'Approvals', 'approval', adminManager, regular, 240, { section: 'operations' }),
  appModule('documents', 'Document Vault', 'folder', ['admin','manager'], regular, 250, { section: 'records', kind: 'system' }),
  appModule('drive-admin', 'Drive Administration', 'folder', admin, regular, 260, { section: 'administration', kind: 'system' }),
  appModule('backup-recovery', 'Backup & Recovery', 'backup', admin, regular, 265, { section: 'administration', kind: 'system', description: 'Encrypted MongoDB, uploaded-data and source backups with controlled recovery.' }),
  appModule('reports', 'Reports & Analytics', 'assessment', adminManager, regular, 270, { section: 'reports', kind: 'system' }),
  appModule('notifications', 'Notifications', 'notifications', ['admin','manager'], regular, 280, { section: 'communication', kind: 'system', mobilePrimary: true }),
  appModule('notification-deliveries', 'Notification Delivery Logs', 'notifications', admin, regular, 285, { section: 'communication' }),
  appModule('messages', 'Messages', 'message', ['admin','manager'], regular, 290, { section: 'communication', kind: 'system', mobilePrimary: true }),
  appModule('attendance', 'Attendance', 'workhistory', manager, regular, 300, { section: 'operations' }),
  appModule('site-admin', 'Site, Design & Homepage', 'web', admin, regular, 320, { section: 'administration', kind: 'system' }),
  appModule('design-studio', 'Design Studio', 'palette', admin, regular, 315, { section: 'administration', kind: 'system', description: 'Live page redesign editor with bounded visual design tokens.' }),
  appModule('platform-modules', 'Navigation & Modules', 'settings', admin, regular, 330, { section: 'administration' }),
  appModule('content-pages', 'Content Pages', 'description', admin, regular, 340, { section: 'administration' }),
  appModule('integration-settings', 'Integrations', 'settings', admin, regular, 350, { section: 'administration' }),
  appModule('site-enquiries', 'Website Enquiries', 'message', adminManager, regular, 360, { section: 'communication' }),
  appModule('settings', 'System Settings', 'settings', admin, regular, 370, { section: 'administration', kind: 'system' }),
  appModule('security', 'Security & Sessions', 'security', ['admin','manager','tenant','user','surveyor'], ['regular','landlord','surveyor'], 380, { section: 'account', kind: 'system' }),

  appModule('dashboard', 'Landlord Dashboard', 'dashboard', tenant, landlord, 10, { section: 'general', kind: 'system', mobilePrimary: true }),
  appModule('subscription', 'Landlord Subscription', 'workspacepremium', tenant, ['regular','landlord'], 20, { section: 'subscriptions', kind: 'system' }),
  appModule('property-management', 'Manage Rental Units', 'apartment', tenant, landlord, 30, { section: 'property', kind: 'system', mobilePrimary: true }),
  appModule('properties', 'My Properties', 'apartment', tenant, landlord, 40, { section: 'property', mobilePrimary: true }),
  appModule('applications', 'Tenant Applications', 'factcheck', tenant, landlord, 70, { section: 'tenancy' }),
  appModule('tenant-interviews', 'Tenant Interviews', 'calendarmonth', tenant, landlord, 80, { section: 'tenancy' }),
  appModule('property-visits', 'Property Site Visits', 'calendarmonth', tenant, landlord, 90, { section: 'tenancy' }),
  appModule('tenancies', 'Active Tenancies', 'homework', tenant, landlord, 100, { section: 'tenancy' }),
  appModule('tenant-profiles', 'Tenant Profiles', 'person', tenant, landlord, 110, { section: 'tenancy' }),
  appModule('occupants', 'Family & Occupants', 'people', tenant, landlord, 120, { section: 'tenancy' }),
  appModule('leases', 'Lease Management', 'description', tenant, landlord, 130, { section: 'tenancy' }),
  appModule('rental-invoices', 'Rent & Bills', 'receiptlong', tenant, landlord, 140, { section: 'finance' }),
  appModule('utility-readings', 'Meter Readings', 'electricmeter', tenant, landlord, 150, { section: 'finance' }),
  appModule('reminder-rules', 'Payment Reminders', 'notifications', tenant, landlord, 160, { section: 'finance' }),
  appModule('payments', 'Payments', 'payments', tenant, landlord, 180, { section: 'finance' }),
  appModule('transactions', 'Transactions', 'receiptlong', tenant, landlord, 185, { section: 'finance', path: '/app/transactions', kind: 'system' }),
  appModule('complaints', 'Complaints & Maintenance', 'build', tenant, landlord, 190, { section: 'operations' }),
  appModule('facilities', 'Facilities', 'accountbalance', tenant, landlord, 200, { section: 'operations' }),
  appModule('facility-bookings', 'Facility Bookings', 'calendarmonth', tenant, landlord, 210, { section: 'operations' }),
  appModule('documents', 'Document Vault', 'folder', tenant, landlord, 220, { section: 'records', kind: 'system', mobilePrimary: true }),
  appModule('messages', 'Messages', 'message', tenant, landlord, 230, { section: 'communication', kind: 'system', mobilePrimary: true }),
  appModule('notifications', 'Notifications', 'notifications', tenant, landlord, 240, { section: 'communication', kind: 'system' }),
  appModule('profile', 'Profile', 'person', tenant, landlord, 250, { section: 'account', kind: 'system' }),
  appModule('survey-jobs', 'My Survey Quotes', 'requestquote', tenant, landlord, 270, { section: 'general', path: '/app/survey-jobs', kind: 'system' }),
  appModule('survey-projects', 'Manage Hired Surveyors', 'assignment', tenant, landlord, 280, { section: 'projects', path: '/app/survey-projects', mobilePrimary: true }),
  appModule('active-projects', 'Active Projects', 'assignment', tenant, landlord, 290, { section: 'projects', path: '/app/survey-projects' }),

  appModule('dashboard', 'Tenant Dashboard', 'dashboard', tenant, regular, 10, { section: 'general', kind: 'system', mobilePrimary: true }),
  appModule('marketplace', 'Browse Properties', 'explore', tenant, regular, 20, { section: 'discovery', path: '/marketplace', kind: 'external', mobilePrimary: true }),
  appModule('tenant-profiles', 'Tenant Profile', 'person', tenant, regular, 30, { section: 'account' }),
  appModule('tenant-kyc', 'Tenant KYC', 'badge', tenant, regular, 40, { section: 'account', mobilePrimary: true }),
  appModule('occupants', 'Family & Occupants', 'people', tenant, regular, 50, { section: 'account' }),
  appModule('my-applications', 'My Applications', 'factcheck', tenant, regular, 60, { section: 'tenancy', path: '/app/my-applications', mobilePrimary: true }),
  appModule('property-visits', 'Property Visits', 'calendarmonth', tenant, regular, 70, { section: 'tenancy' }),
  appModule('my-property', 'My Property', 'homework', tenant, regular, 80, { section: 'tenancy', kind: 'system' }),
  appModule('tenancies', 'Tenancy Records', 'homework', tenant, regular, 90, { section: 'tenancy' }),
  appModule('complaints', 'Maintenance & Complaints', 'build', tenant, regular, 100, { section: 'operations' }),
  appModule('facilities', 'Facilities', 'accountbalance', tenant, regular, 110, { section: 'operations' }),
  appModule('facility-bookings', 'Facility Bookings', 'calendarmonth', tenant, regular, 120, { section: 'operations' }),
  appModule('documents', 'Document Vault', 'folder', tenant, regular, 130, { section: 'records', kind: 'system', mobilePrimary: true }),
  appModule('messages', 'Messages', 'message', tenant, regular, 140, { section: 'communication', kind: 'system', mobilePrimary: true }),
  appModule('notifications', 'Notifications', 'notifications', tenant, regular, 150, { section: 'communication', kind: 'system' }),
  appModule('subscription', 'My Subscription', 'workspacepremium', tenant, regular, 160, { section: 'subscriptions', kind: 'system' }),
  appModule('surveyor-subscription', 'Surveyor Subscription', 'workspacepremium', tenant, regular, 170, { section: 'subscriptions', kind: 'system' }),
  appModule('profile', 'Profile', 'person', tenant, regular, 180, { section: 'account', kind: 'system' }),

  appModule('surveyor-dashboard', 'Surveyor Dashboard', 'engineering', ['tenant','surveyor'], surveyor, 10, { section: 'general', kind: 'system', mobilePrimary: true }),
  appModule('surveyor-subscription', 'Surveyor Subscription', 'workspacepremium', tenant, surveyor, 20, { section: 'subscriptions', kind: 'system' }),
  appModule('surveyor-verification', 'Verification', 'verifieduser', ['tenant','surveyor'], surveyor, 30, { section: 'account', kind: 'system' }),
  appModule('surveyor-profile', 'Professional Profile', 'person', ['tenant','surveyor'], surveyor, 40, { section: 'account', kind: 'system' }),
  appModule('survey-services', 'Service Listings', 'storefront', ['tenant','surveyor'], surveyor, 50, { section: 'marketplace', mobilePrimary: true }),
  appModule('survey-job-marketplace', 'Job Marketplace', 'explore', ['tenant','surveyor'], surveyor, 60, { section: 'marketplace', kind: 'system', mobilePrimary: true }),
  appModule('survey-jobs', 'Survey Jobs', 'businesscenter', ['tenant','surveyor'], surveyor, 70, { section: 'projects' }),
  appModule('survey-quotations', 'Quotations', 'requestquote', ['tenant','surveyor'], surveyor, 80, { section: 'projects' }),
  appModule('survey-projects', 'Projects', 'assignment', ['tenant','surveyor'], surveyor, 90, { section: 'projects', mobilePrimary: true }),
  appModule('site-visits', 'Site Visits', 'calendarmonth', ['tenant','surveyor'], surveyor, 100, { section: 'field' }),
  appModule('survey-reports', 'Reports', 'assessment', ['tenant','surveyor'], surveyor, 120, { section: 'projects' }),
  appModule('survey-equipment', 'Equipment', 'build', ['tenant','surveyor'], surveyor, 130, { section: 'operations' }),
  appModule('survey-team', 'Team', 'groupwork', ['tenant','surveyor'], surveyor, 140, { section: 'operations' }),
  appModule('survey-clients', 'Clients', 'people', ['tenant','surveyor'], surveyor, 150, { section: 'operations' }),
  appModule('payments', 'Invoices & Payments', 'payments', ['tenant','surveyor'], surveyor, 160, { section: 'finance' }),
  appModule('survey-reviews', 'Reviews', 'factcheck', ['tenant','surveyor'], surveyor, 170, { section: 'reputation' }),
  appModule('survey-disputes', 'Disputes', 'approval', ['tenant','surveyor'], surveyor, 180, { section: 'operations' }),
  appModule('survey-promotions', 'Promotions', 'campaign', ['tenant','surveyor'], surveyor, 190, { section: 'marketing' }),
  appModule('documents', 'Document Vault', 'folder', ['tenant','surveyor'], surveyor, 200, { section: 'records', kind: 'system', mobilePrimary: true }),
  appModule('messages', 'Messages', 'message', ['tenant','surveyor'], surveyor, 210, { section: 'communication', kind: 'system' }),
  appModule('notifications', 'Notifications', 'notifications', ['tenant','surveyor'], surveyor, 220, { section: 'communication', kind: 'system' }),
  appModule('profile', 'Profile', 'person', ['tenant','surveyor'], surveyor, 230, { section: 'account', kind: 'system' }),
];


function mergePlatformModules(modules) {
  const merged = new Map();
  for (const module of modules) {
    const id = `${module.scope}:${module.key}`;
    if (!merged.has(id)) {
      merged.set(id, {
        ...module,
        roles: [...new Set(module.roles || [])],
        modes: [...new Set(module.modes || [])],
        accessRules: module.scope === 'app' ? [{ roles: [...new Set(module.roles || [])], modes: [...new Set(module.modes || [])] }] : [],
      });
      continue;
    }
    const current = merged.get(id);
    const rule = { roles: [...new Set(module.roles || [])], modes: [...new Set(module.modes || [])] };
    const exists = current.accessRules.some((candidate) =>
      JSON.stringify(candidate.roles) === JSON.stringify(rule.roles) && JSON.stringify(candidate.modes) === JSON.stringify(rule.modes));
    if (!exists) current.accessRules.push(rule);
    current.roles = [...new Set([...current.roles, ...(module.roles || [])])];
    current.modes = [...new Set([...current.modes, ...(module.modes || [])])];
    current.mobilePrimary = current.mobilePrimary || Boolean(module.mobilePrimary);
    current.sortOrder = Math.min(current.sortOrder, module.sortOrder);
  }
  return [...merged.values()];
}

const ADMIN_WORKSPACE_MODULES = Object.values(ADMIN_WORKSPACE_OVERRIDES)
  .filter((module) => module.key)
  .map((module) => ({
    ...module,
    metadata: { ...(module.metadata || {}), adminWorkspaceManaged: true },
    accessRules: Array.isArray(module.accessRules) && module.accessRules.length
      ? module.accessRules
      : [{ roles: module.roles || [], modes: module.modes || [] }],
  }));

export const DEFAULT_PLATFORM_MODULES = mergePlatformModules([
  ...RAW_PLATFORM_MODULES.filter((module) => !RETIRED_SURVEYOR_MODULE_KEYS.has(module.key)),
  ...RBAC_PLATFORM_MODULES.filter((module) => !RETIRED_SURVEYOR_MODULE_KEYS.has(module.key)),
  ...ADMIN_WORKSPACE_MODULES,
]).filter((module) => !(module.scope === 'app' && ['property-spaces', 'property-media', 'property-promotions'].includes(module.key))).map(applyAdminWorkspace);

// This is intentionally a small, validated token set rather than arbitrary CSS.
// It lets administrators tune the complete product visual system without allowing
// untrusted styles or scripts to reach the browser.
export const DEFAULT_DESIGN_SYSTEM = {
  preset: 'secureasset',
  colors: {
    appBackground: '#F7F7F5', paper: '#FFFFFF', textPrimary: '#152225', textSecondary: '#68777A', border: '#E6E9E6',
    navigation: '#0B5270', navigationText: '#FFFFFF', primary: '#0B5270', secondary: '#E46F4F', success: '#238062',
    submit: '#66752D', edit: '#D97706', danger: '#C74343', icon: '#0B5270',
  },
  typography: { fontFamily: 'Open Sans', baseSize: 14, headingWeight: 850, lineHeight: 1.5 },
  layout: { density: 'comfortable', contentMaxWidth: 1580, appBarHeight: 76, sidebarWidth: 286, collapsedSidebarWidth: 86, pagePadding: 32, mobilePagePadding: 16 },
  borders: { width: 1, style: 'solid', cardRadius: 18, buttonRadius: 12, inputRadius: 13, navigationRadius: 12, modalRadius: 0, modalBorderWidth: 0 },
  shadows: { card: 'soft', modal: 'floating', navigation: 'none', button: 'subtle' },
  icons: { size: 20, navSize: 18, color: '#0B5270', rounded: true },
  effects: { enableHoverLift: true, enableGlassNavigation: true, cardPadding: 24, buttonHeight: 40 },
  branding: { primary: '#0B5270', secondary: '#0F172A', accent: '#238062', logoUrl: '', logoLightUrl: '', faviconUrl: '', fontFamily: 'Open Sans' },
  buttons: {
    primary: { background: '#0B5270', text: '#FFFFFF', border: '#0B5270', hoverBackground: '#083C51', hoverText: '#FFFFFF', activeBackground: '#062F40', disabledBackground: '#B9C7C9', disabledText: '#6C7B7E', focusRing: '#0B5270', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 780, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    secondary: { background: '#E46F4F', text: '#FFFFFF', border: '#E46F4F', hoverBackground: '#B84F36', hoverText: '#FFFFFF', activeBackground: '#963D2B', disabledBackground: '#D8B4AA', disabledText: '#81594F', focusRing: '#E46F4F', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 780, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    submit: { background: '#66752D', text: '#FFFFFF', border: '#66752D', hoverBackground: '#4F5B22', hoverText: '#FFFFFF', activeBackground: '#3C451A', disabledBackground: '#C8CDB1', disabledText: '#687044', focusRing: '#66752D', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 800, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    edit: { background: '#D97706', text: '#FFFFFF', border: '#D97706', hoverBackground: '#B45309', hoverText: '#FFFFFF', activeBackground: '#92400E', disabledBackground: '#E6C39A', disabledText: '#8A6A43', focusRing: '#D97706', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 800, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    accept: { background: '#238062', text: '#FFFFFF', border: '#238062', hoverBackground: '#15614A', hoverText: '#FFFFFF', activeBackground: '#104A39', disabledBackground: '#B4CEC5', disabledText: '#5F796F', focusRing: '#238062', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 800, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    danger: { background: '#C74343', text: '#FFFFFF', border: '#C74343', hoverBackground: '#A12D2D', hoverText: '#FFFFFF', activeBackground: '#7E2222', disabledBackground: '#E1B6B6', disabledText: '#875F5F', focusRing: '#C74343', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 800, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    outlined: { background: '#FFFFFF', text: '#0B5270', border: '#0B5270', hoverBackground: '#EAF2F4', hoverText: '#083C51', activeBackground: '#D6E6EB', disabledBackground: '#F0F3F3', disabledText: '#8A999C', focusRing: '#0B5270', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 780, shadow: 'none', iconPosition: 'start', animation: 'none' },
  },
  bottomAppBar: { enabled: true, background: '#FFFFFF', textColor: '#68777A', activeColor: '#0B5270', inactiveColor: '#68777A', indicatorColor: '#0B5270', activeIndicator: 'line', height: 66, iconSize: 22, labelSize: 10.5, itemGap: 2, radius: 0, shadow: 'soft', blur: 12, opacity: 0.96, position: 'fixed', safeArea: 12, desktopVisible: false, mobileVisible: true },
  iconLibrary: { style: 'rounded', tone: 'monochrome', defaultColor: '#0B5270', size: 20, strokeWidth: 1.8, opacity: 1, favorites: [], recent: [] },
  iconAssets: { globalShare: '', bottomAppBar: {}, quickAccess: {} },
  navigation: [], pageDesigns: [],
  componentLibrary: Object.fromEntries(['button', 'card', 'input', 'modal', 'alert', 'table', 'header', 'sidebar', 'bottom-app-bar', 'tabs', 'dropdown', 'badge', 'profile', 'empty-state', 'loading'].map((key) => [key, { enabled: true, radius: 12, height: 40, padding: 16, shadow: 'subtle', variants: [] }])),
  profiles: { public: 'secureasset', authentication: 'secureasset', dashboard: 'secureasset', admin: 'secureasset', theme: 'light' },
  motion: { duration: 160, easing: 'standard', reducedMotion: false, gridSpacing: 8, zIndexBase: 1000 },
  canvas: { snapToGrid: true, rulers: true, guides: true, gridSize: 8, zoom: 1, layers: [] },
};

export const DEFAULT_SITE_FOOTER = {
  description: 'A premium property operating system for rentals, tenancy, surveys and secure records.',
  navigation: [
    { heading: 'Platform', links: [{ label: 'Marketplace', path: '/marketplace' }, { label: 'Pricing', path: '/pricing' }, { label: 'About SecureAsset', path: '/about' }] },
    { heading: 'Operations', links: [{ label: 'Rent automation', path: '/pricing' }, { label: 'Document vault', path: '/login' }, { label: 'Surveyor marketplace', path: '/surveyors' }] },
    { heading: 'Access', links: [{ label: 'Secure login', path: '/login' }, { label: 'Create account', path: '/login?mode=register' }, { label: 'Contact support', path: '/contact' }] },
  ],
  legalLinks: [
    { label: 'Terms and Conditions', path: '/terms-and-conditions' },
    { label: 'Privacy Policy', path: '/privacy-policy' },
    { label: 'Shipping Policy', path: '/shipping-policy' },
    { label: 'Contact Us', path: '/contact' },
    { label: 'Cancellation and Refunds', path: '/cancellation-and-refunds' },
  ],
};

export const DEFAULT_CONTENT_PAGES = [
  {
    path: '/about', slug: 'about', title: 'About SecureAsset', subtitle: 'One account with connected property, tenancy, survey and document workflows.',
    hero: { eyebrow: 'About the platform', title: 'One account. Multiple professional capabilities.', subtitle: 'SecureAsset connects public discovery with private operations, verified identities, financial workflows and auditable records.', align: 'left' },
    sections: [
      { key: 'mission', type: 'rich_text', title: 'Built for the complete property lifecycle', subtitle: 'From discovery through long-term management.', content: { paragraphs: ['Every registered account begins with tenant capabilities. The same account can unlock Landlord features, Surveyor features, or both through configurable subscriptions without changing the account role.', 'Administrators manage plans, public content, permissions, verification and operational policies directly from MongoDB-backed controls.'] }, sortOrder: 10, active: true },
      { key: 'capabilities', type: 'feature_list', title: 'Connected professional capabilities', content: { items: ['Property and room marketplace', 'Tenant KYC, applications and interviews', 'Rent, utilities and payment automation', 'Surveyor marketplace and field operations', 'Universal legal document vault'] }, sortOrder: 20, active: true },
    ],
  },
  {
    path: '/contact', slug: 'contact', title: 'Contact SecureAsset', subtitle: 'Ask about subscriptions, onboarding, enterprise deployment or platform support.',
    hero: { eyebrow: 'Contact', title: 'Talk to our team', subtitle: 'Send an enquiry and the appropriate team can review, assign and track it from the administration workspace.', align: 'left' },
    sections: [{ key: 'contact-form', type: 'contact_form', title: 'Send a message', content: { enquiryType: 'contact' }, sortOrder: 10, active: true }],
    footer: { enabled: true, label: 'Contact Us', sortOrder: 40 },
  },
  {
    path: '/privacy-policy', slug: 'privacy-policy', title: 'Privacy Policy', subtitle: 'How SecureAsset collects, uses and protects information provided through this website.',
    footer: { enabled: true, label: 'Privacy Policy', sortOrder: 20 },
    hero: { eyebrow: 'Privacy', title: 'Privacy, explained clearly.', subtitle: 'This page is published from the administration workspace and can be updated whenever your privacy practices change.', align: 'left' },
    sections: [
      { key: 'privacy-introduction', type: 'rich_text', title: 'Your information and our responsibility', subtitle: 'Review this policy before using the platform.', content: { paragraphs: ['SecureAsset collects information that is necessary to provide property, tenancy, survey, document and support services. This can include account, contact, verification, property and transaction information that you choose to provide.', 'We use that information to operate the platform, respond to requests, protect accounts, meet legal obligations and improve the services. Access is limited by role-based permissions and operational controls.', 'Administrators should keep this page accurate for their organisation and obtain appropriate professional advice before publishing legal terms.'] }, sortOrder: 10, active: true },
    ],
  },
  {
    path: '/terms-and-conditions', slug: 'terms-and-conditions', title: 'Terms and Conditions', subtitle: 'The operating terms and conditions for use of the SecureAsset website and platform.',
    hero: { eyebrow: 'Terms', title: 'Terms and Conditions', subtitle: 'Review the conditions that apply when accessing SecureAsset services and platform features.', align: 'left' },
    sections: [
      { key: 'terms-introduction', type: 'rich_text', title: 'Using SecureAsset responsibly', subtitle: 'Please review these terms before creating an account or using the service.', content: { paragraphs: ['Use SecureAsset only for lawful property, tenancy, survey and document activities, and keep the information you provide accurate and up to date.', 'Account holders are responsible for maintaining the confidentiality of their credentials and for activity performed through their authorised accounts.', 'Administrators can update these terms from the Content Pages workspace whenever business policies or service conditions change.'] }, sortOrder: 10, active: true },
    ],
    footer: { enabled: true, label: 'Terms and Conditions', sortOrder: 10 },
  },
  {
    path: '/shipping-policy', slug: 'shipping-policy', title: 'Shipping Policy', subtitle: 'Information about delivery and fulfilment for SecureAsset services and any applicable physical items.',
    hero: { eyebrow: 'Shipping', title: 'Shipping Policy', subtitle: 'Understand how delivery or fulfilment is handled when a SecureAsset service includes a physical item or shipment.', align: 'left' },
    sections: [
      { key: 'shipping-policy', type: 'rich_text', title: 'Delivery and fulfilment', content: { paragraphs: ['SecureAsset primarily provides digital property, tenancy, survey and document-management services. Where a purchase includes a physical item or document shipment, the applicable delivery method, charges and expected fulfilment details should be disclosed at the time of purchase.', 'Administrators can update this policy from the Content Pages workspace to reflect current delivery partners, service areas, timelines and exceptions.'] }, sortOrder: 10, active: true },
    ],
    footer: { enabled: true, label: 'Shipping Policy', sortOrder: 30 },
  },
  {
    path: '/cancellation-and-refunds', slug: 'cancellation-and-refunds', title: 'Cancellation and Refunds', subtitle: 'How cancellation requests and eligible refunds are handled for SecureAsset services.',
    hero: { eyebrow: 'Cancellations and refunds', title: 'Cancellation and Refunds', subtitle: 'Review the applicable cancellation process and refund conditions for SecureAsset services.', align: 'left' },
    sections: [
      { key: 'cancellation-refunds', type: 'rich_text', title: 'Cancellation and refund requests', content: { paragraphs: ['Cancellation and refund eligibility can depend on the service purchased, payment status, work already performed, subscription period and any applicable agreement.', 'Users should submit a cancellation or refund request through the available support channel with the relevant account, payment and service details. Administrators can maintain the current rules, timelines and exceptions from the Content Pages workspace.'] }, sortOrder: 10, active: true },
    ],
    footer: { enabled: true, label: 'Cancellation and Refunds', sortOrder: 50 },
  },
  {
    path: '/callback', slug: 'callback', title: 'Request a callback', subtitle: 'Leave your details and preferred time, and the team can follow up from the Website Enquiries workspace.',
    hero: { eyebrow: 'Speak with us', title: 'Request a callback.', subtitle: 'Tell us how and when to reach you. Your request is routed directly to the administration enquiry queue.', align: 'left' },
    sections: [{ key: 'callback-request', type: 'callback_form', title: 'Choose a convenient time', subtitle: 'A phone number is required so our team can return your call.', content: { buttonLabel: 'Request a callback', successMessage: 'Your callback request has been submitted.' }, sortOrder: 10, active: true }],
  },
];

export const DEFAULT_HOME_SECTIONS = [
  { key: 'stats', type: 'stats', title: 'A connected operating platform', subtitle: 'Live values and operational capabilities managed from MongoDB.', sortOrder: 10, active: true, content: { items: [
    { value: 'One account', label: 'Tenant, Landlord and Surveyor modes' },
    { value: 'Private first', label: 'Documents and legal records' },
    { value: 'Real-time', label: 'Notifications, messaging and operations' },
    { value: 'Auditable', label: 'Permissions, payments and activity' },
  ] } },
  { key: 'features', type: 'features', title: 'Core features', subtitle: '', sortOrder: 20, active: true, content: { items: [
    { icon: 'verified_user', title: 'Verified tenant journeys', description: 'KYC, applications, interviews, agreements and tenancy records in one workflow.' },
    { icon: 'apartment', title: 'Flexible property hierarchy', description: 'Manage buildings, floors, apartments, rooms, beds, commercial units and land.' },
    { icon: 'payments', title: 'Rent and utility automation', description: 'Generate invoices, calculate meter-based bills, issue receipts and send reminders.' },
    { icon: 'folder', title: 'Document Vault', description: 'Private storage for property, survey, legal, payment and identity records.' },
    { icon: 'engineering', title: 'Surveyor marketplace', description: 'Find verified professionals, request quotations and manage projects and reports.' },
    { icon: 'smartphone', title: 'Mobile field operations', description: 'Manage visits, field data, photos, approvals and payments on any device.' },
  ] } },
  { key: 'featured-properties', type: 'featured_properties', title: 'Featured properties', subtitle: 'Verified and promoted listings available now.', sortOrder: 30, active: true, content: { limit: 6 } },
  { key: 'featured-surveyors', type: 'featured_surveyors', title: 'Verified survey professionals', subtitle: 'Discover public surveyor profiles and specialist services.', sortOrder: 40, active: true, content: { limit: 6 } },
  { key: 'cta', type: 'cta', title: 'Manage everything from one account', subtitle: 'Create your tenant account, then activate professional capabilities as your work grows.', sortOrder: 50, active: true, content: { primaryLabel: 'Create account', primaryUrl: '/login?mode=register', secondaryLabel: 'Explore properties', secondaryUrl: '/marketplace' } },
];
