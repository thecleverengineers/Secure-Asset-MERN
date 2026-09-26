import { Fragment, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import {
  AppBar, Avatar, Badge, Box, BottomNavigation, BottomNavigationAction, Button, DialogContent, Divider, Drawer,
  IconButton, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Toolbar, Tooltip, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import ProfessionalDialog from '../shared/ProfessionalDialog';
import WorkspaceSearch from './WorkspaceSearch';
import DashboardRounded from '@mui/icons-material/DashboardRounded';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import PeopleRounded from '@mui/icons-material/PeopleRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import AssignmentRounded from '@mui/icons-material/AssignmentRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import BuildRounded from '@mui/icons-material/BuildRounded';
import ApprovalRounded from '@mui/icons-material/ApprovalRounded';
import NotificationsRounded from '@mui/icons-material/NotificationsRounded';
import MessageRounded from '@mui/icons-material/MessageRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import AssessmentRounded from '@mui/icons-material/AssessmentRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import WorkHistoryRounded from '@mui/icons-material/WorkHistoryRounded';
import ExploreRounded from '@mui/icons-material/ExploreRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import EngineeringRounded from '@mui/icons-material/EngineeringRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import StraightenRounded from '@mui/icons-material/StraightenRounded';
import AnalyticsRounded from '@mui/icons-material/AnalyticsRounded';
import GroupWorkRounded from '@mui/icons-material/GroupWorkRounded';
import BusinessCenterRounded from '@mui/icons-material/BusinessCenterRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import WebRounded from '@mui/icons-material/WebRounded';
import CollectionsRounded from '@mui/icons-material/CollectionsRounded';
import BadgeRounded from '@mui/icons-material/BadgeRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import ElectricMeterRounded from '@mui/icons-material/ElectricMeterRounded';
import CampaignRounded from '@mui/icons-material/CampaignRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRounded from '@mui/icons-material/KeyboardArrowUpRounded';
import PaletteRounded from '@mui/icons-material/PaletteRounded';
import HomeRounded from '@mui/icons-material/HomeRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import AdminPanelSettingsRounded from '@mui/icons-material/AdminPanelSettingsRounded';
import { LogoMark } from '../premium/LogoMark';
import { useAuth } from '../../context/AuthContext';
import { useColorMode } from '../../context/ColorModeContext';
import { getAppConfiguration, getMySubscription, getMySurveyorSubscription, getUnreadNotificationCount } from '../../services/api';
import type { UserRole } from '../../services/types';
import { useSite } from '../../context/SiteContext';
import { useRealtime } from '../../context/RealtimeContext';
import { normaliseDesignSystem, OPEN_SANS_FONT_FAMILY } from '../../designSystem';
import { resolveIconComponent } from '../../iconResolver';
import { safeRecordArray } from '../../utils/runtimeData';
import '../../../styles/bottom-appbar-premium.css';
import '../../../styles/role-workspace-premium.css';

type MenuDef = { key: string; label: string; icon: any; path?: string; mobilePrimary?: boolean; section?: string; sectionOrder?: number; sortOrder?: number; badge?: string; placement?: 'sidebar' | 'header' | 'bottom' | 'both' };
const PROPERTY_DETAIL_ONLY_MENU_KEYS = new Set(['property-spaces', 'property-media', 'property-promotions']);
const HIDDEN_MENU_KEYS = new Set(['audit-logs', 'subscription-payment-approvals']);
// Plan activation is a tenant-owned capability workflow. Legacy landlord and
// surveyor roles may still use their existing operational workspaces, but they
// must never receive the tenant checkout/renewal destinations.
const TENANT_ONLY_ACTIVATION_KEYS = new Set(['subscription', 'surveyor-subscription']);
const ADMIN_DOCUMENT_VAULT: MenuDef = { key: 'documents', label: 'Document Vault', icon: FolderRounded, path: '/app/documents', section: 'workspace', sectionOrder: 1, sortOrder: 20, mobilePrimary: true };
const ADMIN_APPROVAL_CENTER: MenuDef = { key: 'approvals', label: 'Approval Center', icon: ApprovalRounded, path: '/app/approvals', section: 'workspace', sectionOrder: 1, sortOrder: 10.0005 };
const SURVEYOR_WORKFLOW_LABELS: Record<string, string> = {
  'surveyor-dashboard': 'Surveyor Workspace',
  'survey-job-marketplace': 'Quote Requests',
  'survey-quotations': 'My Proposals',
  'survey-projects': 'Active Projects',
};

const items: Record<string, MenuDef> = {
  dashboard: { key: 'dashboard', label: 'Dashboard', icon: DashboardRounded },
  users: { key: 'users', label: 'Users', icon: PeopleRounded },
  properties: { key: 'properties', label: 'My Properties', icon: ApartmentRounded },
  'my-listings': { key: 'my-listings', label: 'My Listings', icon: ApartmentRounded },
  subscription: { key: 'subscription', label: 'Landlord Subscription', icon: WorkspacePremiumRounded },
  units: { key: 'units', label: 'Units', icon: MeetingRoomRounded },
  'tenancy-history': { key: 'tenancy-history', label: 'Tenancy History', icon: HistoryRounded },
  tenants: { key: 'tenants', label: 'Tenants', icon: PeopleRounded },
  leases: { key: 'leases', label: 'Lease Management', icon: DescriptionRounded },
  surveys: { key: 'surveys', label: 'Surveys', icon: AssignmentRounded },
  applications: { key: 'applications', label: 'Applications', icon: FactCheckRounded },
  'my-applications': { key: 'my-applications', label: 'My Applications', icon: FactCheckRounded },
  payments: { key: 'payments', label: 'Payments & Invoices', icon: PaymentsRounded },
  transactions: { key: 'transactions', label: 'Transactions', icon: ReceiptLongRounded, path: '/app/transactions' },
  complaints: { key: 'complaints', label: 'Complaints & Maintenance', icon: BuildRounded },
  approvals: { key: 'approvals', label: 'Approval Center', icon: ApprovalRounded },
  notifications: { key: 'notifications', label: 'Notifications', icon: NotificationsRounded },
  messages: { key: 'messages', label: 'Messages', icon: MessageRounded },
  documents: { key: 'documents', label: 'Document Vault', icon: FolderRounded },
  attendance: { key: 'attendance', label: 'Attendance', icon: WorkHistoryRounded },
  'drive-admin': { key: 'drive-admin', label: 'Drive Administration', icon: FolderRounded },
  reports: { key: 'reports', label: 'Reports & Analytics', icon: AssessmentRounded },
  settings: { key: 'settings', label: 'System Settings', icon: SettingsRounded },
  'site-admin': { key: 'site-admin', label: 'Site, Design & Homepage', icon: WebRounded },
  'design-studio': { key: 'design-studio', label: 'Design Studio', icon: PaletteRounded },
  'role-permissions': { key: 'role-permissions', label: 'Role & Permissions', icon: AdminPanelSettingsRounded },
  'property-management': { key: 'property-management', label: 'Property Structure', icon: ApartmentRounded },
  'agreement-templates': { key: 'agreement-templates', label: 'Agreement Papers', icon: DescriptionRounded },
  'tenant-profiles': { key: 'tenant-profiles', label: 'Tenant Profiles', icon: PersonRounded },
  'tenant-kyc': { key: 'tenant-kyc', label: 'Tenant KYC', icon: BadgeRounded },
  occupants: { key: 'occupants', label: 'Family & Occupants', icon: PeopleRounded },
  'tenant-interviews': { key: 'tenant-interviews', label: 'Tenant Interviews', icon: CalendarMonthRounded },
  'property-visits': { key: 'property-visits', label: 'Property Site Visits', icon: CalendarMonthRounded },
  tenancies: { key: 'tenancies', label: 'Active Tenancies', icon: HomeWorkRounded },
  'rental-invoices': { key: 'rental-invoices', label: 'Rent & Bills', icon: ReceiptLongRounded },
  'utility-readings': { key: 'utility-readings', label: 'Meter Readings', icon: ElectricMeterRounded },
  'reminder-rules': { key: 'reminder-rules', label: 'Payment Reminders', icon: NotificationsRounded },
  'site-enquiries': { key: 'site-enquiries', label: 'Website Enquiries', icon: MessageRounded },
  'platform-modules': { key: 'platform-modules', label: 'Navigation & Modules', icon: SettingsRounded },
  'content-pages': { key: 'content-pages', label: 'Content Pages', icon: DescriptionRounded },
  'integration-settings': { key: 'integration-settings', label: 'Integrations', icon: SettingsRounded },
  'notification-preferences': { key: 'notification-preferences', label: 'Notification Preferences', icon: NotificationsRounded },

  profile: { key: 'profile', label: 'Profile', icon: PersonRounded },
  marketplace: { key: 'marketplace', label: 'Browse Properties', icon: ExploreRounded, path: '/marketplace' },
  'rent-properties': { key: 'rent-properties', label: 'Rent Properties', icon: ApartmentRounded, path: '/marketplace?listingType=rent', section: 'discovery' },
  'lease-properties': { key: 'lease-properties', label: 'Lease Properties', icon: ApartmentRounded, path: '/marketplace?listingType=lease', section: 'discovery' },
  'sale-properties': { key: 'sale-properties', label: 'Sales Properties', icon: StorefrontRounded, path: '/marketplace?listingType=sale', section: 'discovery' },
  'saved-properties': { key: 'saved-properties', label: 'Saved Properties', icon: FolderRounded, path: '/app/saved-properties', section: 'discovery' },
  'my-property': { key: 'my-property', label: 'My Property', icon: HomeWorkRounded },
  facilities: { key: 'facilities', label: 'Facilities', icon: AccountBalanceRounded },
  'facility-bookings': { key: 'facility-bookings', label: 'Facility Bookings', icon: CalendarMonthRounded },
  'surveyor-plans': { key: 'surveyor-plans', label: 'Surveyor Plans', icon: WorkspacePremiumRounded },
  'surveyor-verifications': { key: 'surveyor-verifications', label: 'Surveyor Verifications', icon: VerifiedUserRounded },
  'surveyor-profiles': { key: 'surveyor-profiles', label: 'Surveyor Profiles', icon: PersonRounded },
  'surveyor-dashboard': { key: 'surveyor-dashboard', label: 'Surveyor Workspace', icon: EngineeringRounded },
  'surveyor-subscription': { key: 'surveyor-subscription', label: 'Surveyor Subscription', icon: WorkspacePremiumRounded },
  'surveyor-verification': { key: 'surveyor-verification', label: 'Verification', icon: VerifiedUserRounded },
  'surveyor-profile': { key: 'surveyor-profile', label: 'Professional Profile', icon: PersonRounded },
  'survey-services': { key: 'survey-services', label: 'My Survey Services', icon: StorefrontRounded },
  'survey-job-marketplace': { key: 'survey-job-marketplace', label: 'Quote Requests', icon: RequestQuoteRounded },
  'survey-jobs': { key: 'survey-jobs', label: 'My Survey Quotes', icon: RequestQuoteRounded },
  'survey-quotations': { key: 'survey-quotations', label: 'My Proposals', icon: RequestQuoteRounded },
  'survey-projects': { key: 'survey-projects', label: 'Active Projects', icon: BusinessCenterRounded },
  'active-projects': { key: 'active-projects', label: 'Active Projects', icon: BusinessCenterRounded, path: '/app/survey-projects' },
  'site-visits': { key: 'site-visits', label: 'Site Visits', icon: CalendarMonthRounded },
  'field-data': { key: 'field-data', label: 'Field Data', icon: StraightenRounded },
  'survey-reports': { key: 'survey-reports', label: 'Survey Reports', icon: DescriptionRounded },
  'survey-equipment': { key: 'survey-equipment', label: 'Equipment', icon: EngineeringRounded },
  'survey-team': { key: 'survey-team', label: 'Team', icon: GroupWorkRounded },
  'survey-clients': { key: 'survey-clients', label: 'Clients', icon: PeopleRounded },
  'survey-reviews': { key: 'survey-reviews', label: 'Reviews', icon: AssessmentRounded },
  'survey-disputes': { key: 'survey-disputes', label: 'Disputes', icon: BuildRounded },
  'survey-promotions': { key: 'survey-promotions', label: 'Promotions', icon: AnalyticsRounded },
};


const iconByName: Record<string, any> = {
  dashboard: DashboardRounded, apartment: ApartmentRounded, meetingroom: MeetingRoomRounded, people: PeopleRounded,
  description: DescriptionRounded, assignment: AssignmentRounded, payments: PaymentsRounded, build: BuildRounded,
  approval: ApprovalRounded, notifications: NotificationsRounded, message: MessageRounded, folder: FolderRounded,
  history: HistoryRounded, assessment: AssessmentRounded, settings: SettingsRounded, search: SearchRounded,
  person: PersonRounded, workhistory: WorkHistoryRounded, explore: ExploreRounded, factcheck: FactCheckRounded,
  accountbalance: AccountBalanceRounded, homework: HomeWorkRounded, workspacepremium: WorkspacePremiumRounded,
  engineering: EngineeringRounded, storefront: StorefrontRounded, requestquote: RequestQuoteRounded,
  calendarmonth: CalendarMonthRounded, straighten: StraightenRounded, analytics: AnalyticsRounded,
  groupwork: GroupWorkRounded, businesscenter: BusinessCenterRounded, verifieduser: VerifiedUserRounded,
  web: WebRounded, collections: CollectionsRounded, badge: BadgeRounded, receiptlong: ReceiptLongRounded,
  electricmeter: ElectricMeterRounded, campaign: CampaignRounded,
};
function normalizeIconName(value = '') { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function tenantCapabilityEnabled(user: any, capability: 'landlord' | 'surveyor') {
  if (user?.role !== 'tenant' || !user?.[`${capability}Enabled`]) return false;
  const expiry = user?.[`${capability}SubscriptionExpiresAt`];
  return !expiry || new Date(expiry).getTime() > Date.now();
}

const roleMenus: Record<UserRole, string[]> = {
  admin: ['dashboard', 'approvals', 'design-studio', 'role-permissions', 'site-admin', 'site-enquiries', 'users', 'properties', 'tenant-profiles', 'occupants', 'tenant-interviews', 'property-visits', 'tenancies', 'rental-invoices', 'utility-readings', 'reminder-rules', 'leases', 'surveys', 'applications', 'payments', 'complaints', 'surveyor-plans', 'surveyor-profiles', 'survey-services', 'survey-jobs', 'survey-quotations', 'survey-projects', 'survey-reports', 'survey-disputes', 'survey-promotions', 'facilities', 'facility-bookings', 'documents', 'drive-admin', 'notifications', 'messages', 'reports', 'audit-logs', 'settings'],
  manager: ['dashboard', 'properties', 'tenant-profiles', 'tenant-kyc', 'occupants', 'applications', 'tenant-interviews', 'property-visits', 'tenancies', 'rental-invoices', 'utility-readings', 'leases', 'surveys', 'payments', 'complaints', 'attendance', 'facilities', 'facility-bookings', 'documents', 'messages', 'notifications', 'reports'],
  landlord: ['dashboard', 'my-listings', 'survey-jobs', 'applications', 'tenants', 'tenancies', 'tenancy-history', 'property-visits', 'rental-invoices', 'utility-readings', 'leases', 'payments', 'transactions', 'agreement-templates', 'survey-projects', 'active-projects', 'documents'],
  tenant: ['dashboard', 'marketplace', 'rent-properties', 'lease-properties', 'sale-properties', 'saved-properties', 'tenant-profiles', 'tenant-kyc', 'occupants', 'my-applications', 'property-visits', 'tenancies', 'subscription', 'surveyor-subscription', 'my-property', 'leases', 'complaints', 'documents', 'facilities', 'facility-bookings', 'messages', 'notifications', 'profile'],
  user: ['dashboard', 'marketplace', 'rent-properties', 'lease-properties', 'sale-properties', 'saved-properties', 'applications', 'payments', 'complaints', 'facilities', 'facility-bookings', 'documents', 'messages', 'notifications', 'profile'],
  surveyor: ['surveyor-dashboard', 'survey-job-marketplace', 'survey-quotations', 'survey-projects', 'surveyor-profile', 'surveyor-verification'],
};

// Regular tenants get a deliberately calm personal workspace. Subscription
// controls live in the profile menu, so the sidebar is reserved for the
// tenant's dashboard, private documents and property information.
const regularTenantWorkspaceMenu: MenuDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: DashboardRounded, path: '/app/dashboard', section: 'tenant-workspace', sectionOrder: 1, sortOrder: 10, mobilePrimary: true },
  { key: 'documents', label: 'Document Vault', icon: FolderRounded, path: '/app/documents', section: 'tenant-workspace', sectionOrder: 1, sortOrder: 20, mobilePrimary: true },
  { key: 'my-applications', label: 'My Applications', icon: FactCheckRounded, path: '/app/my-applications', section: 'tenant-workspace', sectionOrder: 1, sortOrder: 30, mobilePrimary: true },
];

const regularTenantFinanceMenu: MenuDef[] = [];

const regularTenantPropertyMenu: MenuDef[] = [
  { key: 'my-property', label: 'My Property', icon: HomeWorkRounded, path: '/app/my-property', section: 'tenant-property', sectionOrder: 5, sortOrder: 5, mobilePrimary: true },
];

const regularTenantMenu: MenuDef[] = [...regularTenantWorkspaceMenu, ...regularTenantPropertyMenu, ...regularTenantFinanceMenu];

const LANDLORD_FEATURE_MENU_KEYS = ['my-listings', 'survey-jobs', 'applications', 'tenants', 'tenancies', 'tenancy-history', 'property-visits', 'rental-invoices', 'utility-readings', 'leases', 'payments', 'transactions', 'agreement-templates', 'survey-projects', 'active-projects'] as const;
const LANDLORD_SUBSCRIBER_WORKSPACE: Array<Pick<MenuDef, 'key' | 'label' | 'path' | 'icon' | 'section' | 'sectionOrder' | 'sortOrder'>> = [
  { key: 'dashboard', label: 'Dashboard', path: '/app/dashboard', icon: DashboardRounded, section: 'general', sectionOrder: 10, sortOrder: 10 },
  { key: 'my-listings', label: 'My Listings', path: '/app/my-listings', icon: ApartmentRounded, section: 'general', sectionOrder: 10, sortOrder: 20 },
  { key: 'survey-jobs', label: 'My Survey Quotes', path: '/app/survey-jobs', icon: RequestQuoteRounded, section: 'general', sectionOrder: 10, sortOrder: 25 },
  { key: 'documents', label: 'Documents', path: '/app/documents', icon: FolderRounded, section: 'general', sectionOrder: 10, sortOrder: 30 },
  { key: 'agreement-templates', label: 'Agreement Papers', path: '/app/agreement-templates', icon: DescriptionRounded, section: 'general', sectionOrder: 10, sortOrder: 40 },
  { key: 'applications', label: 'Tenant Applications', path: '/app/applications', icon: FactCheckRounded, section: 'tenancy', sectionOrder: 30, sortOrder: 10 },
  { key: 'tenants', label: 'Manage Tenants', path: '/app/tenants', icon: PeopleRounded, section: 'tenancy', sectionOrder: 30, sortOrder: 20 },
  { key: 'tenancies', label: 'Tenancies', path: '/app/tenancies', icon: HomeWorkRounded, section: 'tenancy', sectionOrder: 30, sortOrder: 30 },
  { key: 'tenancy-history', label: 'Tenancy History', path: '/app/tenancy-history', icon: HistoryRounded, section: 'tenancy', sectionOrder: 30, sortOrder: 40 },
  { key: 'transactions', label: 'Transactions', path: '/app/transactions', icon: ReceiptLongRounded, section: 'finance', sectionOrder: 40, sortOrder: 10 },
];
const LANDLORD_FEATURE_LABELS: Record<string, string> = {
  'my-listings': 'My Listings',
  'survey-jobs': 'My Survey Quotes',
  applications: 'Tenant Applications',
  tenants: 'Manage Tenants',
  'tenancy-history': 'Tenancy History',
  tenancies: 'Active Tenancy',
  'property-visits': 'Manage Site Visit',
  'rental-invoices': 'Rent Management',
  'utility-readings': 'Meter Readings',
  leases: 'Lease Management',
  payments: 'Track Payments',
  transactions: 'Transactions',
  'agreement-templates': 'Agreement Papers',
  'survey-projects': 'Manage Hired Surveyors',
  'active-projects': 'Active Projects',
};
const landlordFeatureKeys = new Set<string>(LANDLORD_FEATURE_MENU_KEYS);
const landlordMenu = ['dashboard', ...LANDLORD_FEATURE_MENU_KEYS, 'documents'];
// Surveyors receive direct quote requests from landlords instead of browsing
// a public job board. Accepted requests move into Active Projects.
const surveyorMenu = ['surveyor-dashboard', 'survey-job-marketplace', 'survey-quotations', 'survey-projects', 'surveyor-profile', 'surveyor-verification'];
const tenantBaseKeys = new Set(regularTenantMenu.map((item) => item.key));
const tenantProfileOnlyKeys = new Set(['subscription', 'surveyor-subscription', 'profile']);
const surveyorFeatureKeys = new Set(surveyorMenu.filter((key) => !tenantBaseKeys.has(key) && !tenantProfileOnlyKeys.has(key)));

function placeDocumentVaultAfterDashboard(menu: MenuDef[]) {
  const documentIndex = menu.findIndex((item) => item.key === 'documents');
  const dashboard = menu.find((item) => item.key === 'dashboard' || item.key === 'surveyor-dashboard');
  if (documentIndex < 0 || !dashboard) return menu;

  const reordered = menu.filter((item) => item.key !== 'documents');
  const dashboardIndex = reordered.findIndex((item) => item.key === dashboard.key);
  if (dashboardIndex < 0) return menu;

  const document = menu[documentIndex];
  reordered.splice(dashboardIndex + 1, 0, {
    ...document,
    section: dashboard.section || 'workspace',
    sectionOrder: dashboard.sectionOrder ?? document.sectionOrder,
    sortOrder: Number(dashboard.sortOrder ?? 0) + 0.001,
  });
  return reordered;
}

function placeAdminApprovalCenterAfterDashboard(menu: MenuDef[], user: any) {
  if (String(user?.role || '').toLowerCase() !== 'admin') return menu;
  const dashboard = menu.find((item) => item.key === 'dashboard');
  const approval = menu.find((item) => item.key === 'approvals') || ADMIN_APPROVAL_CENTER;
  if (!dashboard) return menu;
  const reordered = menu.filter((item) => item.key !== 'approvals');
  const dashboardIndex = reordered.findIndex((item) => item.key === 'dashboard');
  reordered.splice(dashboardIndex + 1, 0, {
    ...approval,
    label: 'Approval Center',
    path: '/app/approvals',
    section: dashboard.section || 'workspace',
    sectionOrder: dashboard.sectionOrder ?? 1,
    sortOrder: Number(dashboard.sortOrder ?? 10) + 0.0005,
  });
  return reordered;
}

function enforceRoleNavigation(menu: MenuDef[], user: any) {
  const role = String(user?.role || '').toLowerCase();
  const roleSafe = role === 'tenant' ? menu : menu.filter((item) => !TENANT_ONLY_ACTIVATION_KEYS.has(item.key));
  if (role !== 'admin') return roleSafe;
  let adminSafe = [...roleSafe];
  if (!adminSafe.some((item) => item.key === 'approvals')) adminSafe = [ADMIN_APPROVAL_CENTER, ...adminSafe];
  if (!adminSafe.some((item) => item.key === 'documents')) adminSafe = [ADMIN_DOCUMENT_VAULT, ...adminSafe];
  return adminSafe;
}

function menuKeysFor(user: any) {
  if (!user) return roleMenus.tenant;
  if (user.role !== 'tenant') return roleMenus[user.role as UserRole] || roleMenus.tenant;
  return [...regularTenantMenu.map((item) => item.key), ...(user.landlordEnabled ? landlordMenu : []), ...(user.surveyorEnabled ? surveyorMenu : [])];
}

export const moduleLabel = (key: string) => items[key]?.label || key.replaceAll('-', ' ').replace(/\b\w/g, (m) => m.toUpperCase());

function configuredModuleLabel(module: Record<string, any>) {
  const baseLabel = module.key === 'agreement-templates' ? 'Agreement Papers' : module.label;
  return SURVEYOR_WORKFLOW_LABELS[module.key] || baseLabel;
}

function landlordFeatureLabel(key: string, fallback: string) {
  return LANDLORD_FEATURE_LABELS[key] || fallback;
}

function configuredBottomIcon(design: any, key: string, fallback: ReactNode) {
  const assets = design?.iconAssets?.bottomAppBar || {};
  const source = String(assets[key] || assets[key.replace(/^mobile-/, '')] || '').trim();
  return source ? <Box component="img" src={source} alt="" aria-hidden="true" sx={{ width: design.bottomAppBar.iconSize, height: design.bottomAppBar.iconSize, objectFit: 'contain' }} /> : fallback;
}

export default function AppShell() {
  const { user, logout, refreshUser } = useAuth();
  const { mode, toggle } = useColorMode();
  const { data: { settings } } = useSite();
  const design = useMemo(() => normaliseDesignSystem(settings?.design), [settings?.design]);
  const drawerWidth = design.layout.sidebarWidth;
  const collapsedWidth = design.layout.collapsedSidebarWidth;
  const realtime = useRealtime();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [unread, setUnread] = useState(0);
  const [globalQuery, setGlobalQuery] = useState('');
  const [appModules, setAppModules] = useState<Record<string, any>[]>([]);
  const [moduleError, setModuleError] = useState('');
  const [tenantSubscription, setTenantSubscription] = useState({ checked: false, landlord: false, surveyor: false });
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const [sidebarScroll, setSidebarScroll] = useState({ canScrollUp: false, canScrollDown: false });
  const userLandlordFeatures = tenantCapabilityEnabled(user, 'landlord');
  const userSurveyorFeatures = tenantCapabilityEnabled(user, 'surveyor');
  const hasLandlordSubscription = Boolean(user?.role === 'tenant' && (tenantSubscription.checked ? tenantSubscription.landlord : userLandlordFeatures));
  const hasSurveyorSubscription = Boolean(user?.role === 'tenant' && (tenantSubscription.checked ? tenantSubscription.surveyor : userSurveyorFeatures));
  const hasTenantSubscription = Boolean(user?.role === 'tenant' && (hasLandlordSubscription || hasSurveyorSubscription));
  const isRegularTenant = user?.role === 'tenant' && !hasTenantSubscription;
  async function loadModules() {
    try {
      const response = await getAppConfiguration();
      const modules = safeRecordArray(response?.data?.modules).filter((module) => typeof module.key === 'string' && module.key.trim());
      setAppModules(modules);
      setModuleError('');
    } catch (error) { setModuleError((error as Error).message || 'Workspace navigation is using the secure role menu.'); }
  }
  const fallbackMenu = useMemo(() => {
    const keys = user?.role === 'tenant'
      ? [...regularTenantMenu.map((item) => item.key), ...(userLandlordFeatures ? landlordMenu : []), ...(userSurveyorFeatures ? surveyorMenu : [])]
      : menuKeysFor(user);
    const landlordWorkspace = user?.role === 'landlord' || (user?.role === 'tenant' && userLandlordFeatures);
    return [...new Set(keys)].filter((key) => !HIDDEN_MENU_KEYS.has(key)).map((key) => {
      const item = items[key];
      return item && landlordWorkspace && landlordFeatureKeys.has(key) ? { ...item, label: landlordFeatureLabel(key, item.label) } : item;
    }).filter((item): item is MenuDef => Boolean(item));
  }, [user?.role, user?.activeMode, user?.landlordEnabled, user?.landlordSubscriptionExpiresAt, user?.surveyorEnabled, user?.surveyorSubscriptionExpiresAt, userLandlordFeatures]);
  const configuredMenu = useMemo(() => appModules.length ? appModules.filter((module) =>
    !PROPERTY_DETAIL_ONLY_MENU_KEYS.has(module.key)
    && !HIDDEN_MENU_KEYS.has(module.key)
    && !(TENANT_ONLY_ACTIVATION_KEYS.has(module.key) && user?.role !== 'tenant')
    && !(user?.role === 'tenant' && tenantProfileOnlyKeys.has(module.key))
    && !(user?.role === 'admin' && ['tenant-kyc', 'surveyor-verifications', 'subscription-payment-approvals'].includes(module.key)),
  ).map((module) => ({
    key: module.key, label: user?.role === 'landlord' && landlordFeatureKeys.has(module.key) ? landlordFeatureLabel(module.key, configuredModuleLabel(module)) : configuredModuleLabel(module), path: module.key === 'agreement-templates' ? '/app/agreement-templates' : module.path || `/app/${module.key}`, section: user?.role === 'tenant' && landlordFeatureKeys.has(module.key) ? 'landlord_features' : user?.role === 'tenant' && surveyorFeatureKeys.has(module.key) ? 'surveyor_features' : module.section, sectionOrder: Number(module.sectionOrder ?? 999), sortOrder: Number(module.sortOrder ?? 0), mobilePrimary: Boolean(module.mobilePrimary), badge: module.badge, placement: 'sidebar' as const,
    icon: resolveIconComponent(module.icon) || iconByName[normalizeIconName(module.icon)] || items[module.key]?.icon || SettingsRounded,
  })) : fallbackMenu, [appModules, fallbackMenu, user?.role]);
  // Subscription-enabled tenants use the same tenant sidebar. The backend
  // supplies only entitled modules; the regular finance menu is used only
  // when the account has no active capability subscription.
  const designedMenu = useMemo(() => {
    if (isRegularTenant || !design.navigation.length) return configuredMenu;
    const allowedKeys = new Set([...configuredMenu.map((item) => item.key), ...fallbackMenu.map((item) => item.key)]);
    const overrides = new Map(design.navigation.map((entry) => [entry.key, entry]));
    const base = configuredMenu
      .map((item) => {
        const entry = overrides.get(item.key);
        if (entry?.enabled === false) return null;
        return entry ? { ...item, label: item.key === 'agreement-templates' ? 'Agreement Papers' : entry.label || item.label, path: entry.path || item.path, section: entry.section || item.section, sortOrder: entry.order, mobilePrimary: entry.mobilePrimary, badge: entry.badge, placement: (entry.placement || 'sidebar') as MenuDef['placement'], icon: resolveIconComponent(entry.icon) } : item;
      })
      .filter((item): item is MenuDef => Boolean(item));
    const custom = design.navigation.filter((entry) => entry.enabled && !base.some((item) => item.key === entry.key) && allowedKeys.has(entry.key)).map((entry) => ({ key: entry.key, label: entry.key === 'agreement-templates' ? 'Agreement Papers' : entry.label, path: entry.path, section: entry.section, sortOrder: entry.order, mobilePrimary: entry.mobilePrimary, badge: entry.badge, placement: (entry.placement || 'sidebar') as MenuDef['placement'], icon: resolveIconComponent(entry.icon) }));
    return [...base, ...custom].sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0));
  }, [configuredMenu, design.navigation, fallbackMenu, isRegularTenant]);
  const tenantCapabilityMenu = useMemo(() => {
    if (user?.role !== 'tenant' || !hasTenantSubscription) return designedMenu;
    // Never rebuild a subscribed tenant's feature menu from the local route
    // catalogue. The API configuration is the authoritative, role-filtered
    // list; using `items[key]` here previously displayed routes that the
    // server correctly rejected with "Access denied".
    const source = new Map(designedMenu.map((item) => [item.key, item.key === 'agreement-templates' ? { ...item, label: 'Agreement Papers', path: '/app/agreement-templates' } : item]));
    if (!hasLandlordSubscription) [...LANDLORD_FEATURE_MENU_KEYS].forEach((key) => source.delete(key));
    // Keep only the requested landlord features available during the short
    // interval in which an older PlatformModule cache has not yet refreshed.
    // The server remains authoritative for every API action and ownership check.
    if (hasLandlordSubscription) {
      [...LANDLORD_FEATURE_MENU_KEYS].forEach((key) => {
        const fallback = fallbackMenu.find((item) => item.key === key) || items[key];
        const canonical = key === 'agreement-templates' ? items['agreement-templates'] : fallback;
        if (canonical && !source.has(key)) source.set(key, canonical);
      });
    }
    if (hasLandlordSubscription) {
      ['notifications', 'profile'].forEach((key) => {
        if (!source.has(key) && items[key]) source.set(key, items[key]);
      });
      const landlordWorkspace = LANDLORD_SUBSCRIBER_WORKSPACE.reduce<MenuDef[]>((workspace, entry, index) => {
        const configured = source.get(entry.key);
        if (configured) workspace.push({
          ...configured,
          ...entry,
          section: entry.section || 'general',
          sectionOrder: entry.sectionOrder ?? 10,
          sortOrder: entry.sortOrder ?? index * 10,
          mobilePrimary: index < 5,
          placement: 'sidebar' as const,
        });
        return workspace;
      }, []);
      if (hasSurveyorSubscription) {
        const seen = new Set(landlordWorkspace.map((item) => item.key));
        surveyorFeatureKeys.forEach((key, index) => {
          const item = source.get(key);
          if (item && !seen.has(key)) landlordWorkspace.push({ ...item, section: 'surveyor_features', sectionOrder: 20, sortOrder: index * 10 });
        });
      }
      return landlordWorkspace;
    }
    const result: MenuDef[] = regularTenantMenu.map((item) => source.get(item.key) || item);
    const seen = new Set(result.map((item) => item.key));
    const addSection = (keys: string[], section: 'landlord_features' | 'surveyor_features', sectionOrder: number) => {
      keys.forEach((key, index) => {
        if (seen.has(key)) return;
        const item = source.get(key);
        if (!item) return;
        result.push({ ...item, label: section === 'landlord_features' ? landlordFeatureLabel(key, item.label) : item.label, section, sectionOrder, sortOrder: index * 10 });
        seen.add(key);
      });
    };
    if (hasSurveyorSubscription) addSection([...surveyorFeatureKeys], 'surveyor_features', 20);
    if (hasLandlordSubscription) addSection([...landlordFeatureKeys], 'landlord_features', 30);
    return result;
  }, [appModules.length, designedMenu, hasLandlordSubscription, hasSurveyorSubscription, hasTenantSubscription, tenantSubscription.landlord, tenantSubscription.surveyor, user?.role]);
  const menu = useMemo(() => {
    const source = user?.role === 'tenant' && hasTenantSubscription
      ? placeDocumentVaultAfterDashboard(tenantCapabilityMenu)
      : isRegularTenant ? regularTenantMenu : placeDocumentVaultAfterDashboard(designedMenu);
    const scoped = hasLandlordSubscription || user?.role === 'landlord' ? source.filter((item) => !['notifications', 'profile'].includes(item.key)) : source;
    return placeAdminApprovalCenterAfterDashboard(placeDocumentVaultAfterDashboard(enforceRoleNavigation(scoped, user)), user);
  }, [designedMenu, hasLandlordSubscription, hasTenantSubscription, isRegularTenant, tenantCapabilityMenu, user]);
  const showTenantUpgrade = user?.role === 'tenant' && tenantSubscription.checked && !hasTenantSubscription;
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentKey = pathParts[1] === 'property_tenancy_history' ? 'tenancy-history' : pathParts[1] === 'property-details' ? 'my-listings' : pathParts[1] === 'survey-projects' ? 'survey-projects' : pathParts[1] === 'tenancy_details' ? 'tenancies' : pathParts.at(-1) || 'dashboard';
  const menuGroups = useMemo(() => {
    const groups = new Map<string, MenuDef[]>();
    for (const item of menu) {
      const section = item.section || 'workspace';
      groups.set(section, [...(groups.get(section) || []), item]);
    }
    const sectionPriority: Record<string, number> = {
      // General is the canonical first sidebar section for every workspace.
      general: 0,
      workspace: 0,
      'tenant-workspace': 0,
      landlord_workspace: 0,
      surveyor_features: 20,
      tenancy: 30,
      landlord_features: 30,
    };
    return [...groups.entries()]
      .map(([section, sectionItems]) => [section, [...sectionItems].sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))] as [string, MenuDef[]])
      .sort(([leftSection, left], [rightSection, right]) => {
        const leftOrder = sectionPriority[leftSection] ?? Number(left[0]?.sectionOrder ?? 999);
        const rightOrder = sectionPriority[rightSection] ?? Number(right[0]?.sectionOrder ?? 999);
        return leftOrder - rightOrder;
      });
  }, [menu]);
  const sectionLabel = (value: string) => ['general', 'workspace', 'tenant-workspace', 'landlord_workspace'].includes(value) ? 'General' : value === 'tenancy' ? 'Tenancy' : value === 'discovery' ? 'Discovery' : value === 'tenant-finance' ? 'Your payments' : value === 'landlord_features' ? 'Tenancy' : value === 'surveyor_features' ? 'Surveyor features' : value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  function sectionIcon(section: string) {
    if (section === 'discovery') return ExploreRounded;
    if (section === 'tenant-finance') return PaymentsRounded;
    return null;
  }
  function isItemActive(item: MenuDef) {
    const [targetPath, targetSearch = ''] = String(item.path || `/app/${item.key}`).split('?');
    const currentPath = location.pathname === '/app' ? '/app/dashboard' : location.pathname;
    const normalizedTarget = targetPath === '/app' ? '/app/dashboard' : targetPath;
    if (normalizedTarget !== currentPath
      && !(item.key === 'my-listings' && location.pathname.startsWith('/app/property-details/'))
      && !(item.key === 'tenancy-history' && location.pathname.startsWith('/app/property_tenancy_history/'))
      && !(item.key === 'tenancies' && location.pathname.startsWith('/app/tenancy_details/'))
      && !(item.key === 'survey-projects' && location.pathname.startsWith('/app/survey-projects/'))) return false;
    if (!targetSearch) return true;
    const requiredParams = new URLSearchParams(targetSearch);
    const activeParams = new URLSearchParams(location.search);
    return [...requiredParams.entries()].every(([key, value]) => activeParams.get(key) === value);
  }

  useEffect(() => { void loadModules(); }, [user?._id, user?.role, user?.activeMode, user?.landlordEnabled, user?.surveyorEnabled]);
  useEffect(() => {
    const refreshModules = () => void loadModules();
    window.addEventListener('secureasset:site-changed', refreshModules);
    return () => window.removeEventListener('secureasset:site-changed', refreshModules);
  }, [user?._id, user?.activeMode]);
  useEffect(() => { getUnreadNotificationCount().then((r) => setUnread(r.data.count)).catch(() => {}); }, [location.pathname]);
  useEffect(() => {
    let mounted = true;
    if (user?.role !== 'tenant') {
      setTenantSubscription({ checked: true, landlord: false, surveyor: false });
      return () => { mounted = false; };
    }
    setTenantSubscription((current) => ({ ...current, checked: false }));
    const activeLandlordStatuses = new Set(['active']);
    const activeSurveyorStatuses = new Set(['trial', 'active', 'expiring_soon', 'grace_period']);
    Promise.allSettled([getMySubscription(), getMySurveyorSubscription()]).then(([landlordResult, surveyorResult]) => {
      if (!mounted) return;
      const landlordData = landlordResult.status === 'fulfilled' ? landlordResult.value.data : null;
      const surveyorData = surveyorResult.status === 'fulfilled' ? surveyorResult.value.data : null;
      const landlordSubscription = landlordData?.subscription;
      const surveyorSubscription = surveyorData?.subscription;
      const validUntil = (value: any) => !value?.expiresAt || new Date(value.expiresAt).getTime() > Date.now();
      const landlordActive = landlordResult.status === 'fulfilled'
        ? Boolean(landlordSubscription && activeLandlordStatuses.has(String(landlordSubscription.status)) && validUntil(landlordSubscription))
        : tenantCapabilityEnabled(user, 'landlord');
      const surveyorActive = surveyorResult.status === 'fulfilled'
        ? Boolean((surveyorData?.enabled || (surveyorSubscription && activeSurveyorStatuses.has(String(surveyorSubscription.status)))) && validUntil(surveyorSubscription))
        : tenantCapabilityEnabled(user, 'surveyor');
      setTenantSubscription({ checked: true, landlord: landlordActive, surveyor: surveyorActive });
      if (landlordActive || surveyorActive) void refreshUser().catch(() => {});
    });
    return () => { mounted = false; };
  }, [refreshUser, user?._id, user?.role, user?.landlordEnabled, user?.surveyorEnabled, user?.activeMode]);
  useEffect(() => {
    const root = document.documentElement;
    const values: Record<string, string> = {
      '--sa-page-background': design.colors.appBackground,
      '--sa-page-surface': design.colors.paper,
      '--sa-page-max-width': `${design.layout.contentMaxWidth}px`,
      '--sa-page-padding': `${design.layout.pagePadding}px`,
      '--sa-page-card-radius': `${design.borders.cardRadius}px`,
      '--sa-page-button-radius': `${design.borders.buttonRadius}px`,
      '--sa-page-mobile-padding': `${design.layout.mobilePagePadding}px`,
      '--sa-page-tablet-padding': `${Math.max(design.layout.mobilePagePadding + 6, 20)}px`,
      '--sa-page-desktop-padding': `${design.layout.pagePadding}px`,
      '--sa-editor-grid-spacing': `${design.motion.gridSpacing}px`,
    };
    Object.entries(values).forEach(([key, value]) => root.style.setProperty(key, value));
    return () => { Object.keys(values).forEach((key) => root.style.removeProperty(key)); };
  }, [design]);
  useEffect(() => realtime.subscribe('notification:new', () => setUnread((count) => count + 1)), [realtime.subscribe]);
  useEffect(() => {
    const wantsDashboard = location.pathname === '/app' || location.pathname === '/app/dashboard';
    const kycComplete = ['submitted', 'under_review', 'verified'].includes(String(user?.kycStatus || ''));
    if (isRegularTenant && wantsDashboard && !kycComplete) navigate('/app/tenant-kyc?required=dashboard', { replace: true });
  }, [isRegularTenant, location.pathname, navigate, user?.kycStatus]);

  useEffect(() => {
    const element = sidebarScrollRef.current;
    if (!element) return undefined;
    const update = () => {
      const next = {
        canScrollUp: element.scrollTop > 4,
        canScrollDown: element.scrollTop + element.clientHeight < element.scrollHeight - 4,
      };
      setSidebarScroll((current) => current.canScrollUp === next.canScrollUp && current.canScrollDown === next.canScrollDown ? current : next);
    };
    const frame = window.requestAnimationFrame(update);
    const timer = window.setTimeout(update, 280);
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    resizeObserver?.observe(element);
    if (element.firstElementChild) resizeObserver?.observe(element.firstElementChild);
    element.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      resizeObserver?.disconnect();
      element.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [collapsed, isMobile, menuGroups]);

  function go(item: MenuDef) {
    navigate(item.path || `/app/${item.key}`);
    setMobileOpen(false);
  }
  async function handleLogout() { await logout(); navigate('/login'); }
  function scrollSidebar(direction: 'up' | 'down') {
    const element = sidebarScrollRef.current;
    if (!element) return;
    const amount = Math.max(180, Math.round(element.clientHeight * .72));
    element.scrollBy({ top: direction === 'up' ? -amount : amount, behavior: 'smooth' });
  }

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', backgroundImage: 'linear-gradient(180deg, rgba(10,96,122,.045), transparent 230px)' }}>
      <Box sx={{ px: collapsed && !isMobile ? 1.2 : 2, pt: 2, pb: collapsed && !isMobile ? 1.4 : 1.6 }}>
        <Stack direction="row" alignItems="center" justifyContent={collapsed && !isMobile ? 'center' : 'space-between'} sx={{ minHeight: 42 }}>
          <Box sx={{ overflow: 'hidden', minWidth: collapsed && !isMobile ? 42 : 182 }}><LogoMark /></Box>
          {!isMobile && !collapsed && <Tooltip title="Collapse navigation"><IconButton size="small" onClick={() => setCollapsed(true)} sx={{ bgcolor: 'action.hover' }}><ChevronLeftRounded fontSize="small" /></IconButton></Tooltip>}
        </Stack>
        {(!collapsed || isMobile) && <Box sx={{ mt: 2, p: 1.35, borderRadius: design.borders.navigationRadius, background: 'linear-gradient(135deg, rgba(10,96,122,.085), rgba(32,132,99,.065))', border: `${design.borders.width}px ${design.borders.style}`, borderColor: 'rgba(10,96,122,.13)' }}>
          <Stack direction="row" spacing={1.1} alignItems="center">
            <Avatar src={user?.avatar} sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 13, fontWeight: 800 }}>{user?.name?.[0]}</Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 850 }}>{user?.name || 'SecureAsset user'}</Typography>
              <Typography noWrap sx={{ fontSize: 10.5, color: 'text.secondary' }}>{user?.role === 'tenant' ? `Tenant${hasLandlordSubscription ? ' · Landlord features' : ''}${hasSurveyorSubscription ? ' · Surveyor features' : ''}` : `${user?.role || 'member'} workspace`}</Typography>
            </Box>
            <Box sx={{ width: 7, height: 7, borderRadius: 99, bgcolor: 'success.main', boxShadow: '0 0 0 3px rgba(35,128,98,.12)' }} />
          </Stack>
        </Box>}
      </Box>
      <Divider />
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Box ref={sidebarScrollRef} className="sa-sidebar-scroll" sx={{ height: '100%', px: collapsed && !isMobile ? 1.1 : 1.2, py: 1.25, pr: 0.7, overflowY: 'auto', scrollBehavior: 'smooth' }}>
        <List disablePadding>
          {menuGroups.map(([section, sectionItems], groupIndex) => {
            const activeGroup = sectionItems.some((item) => isItemActive(item));
            const SectionIcon = sectionIcon(section) || (section === 'finance' ? PaymentsRounded : section === 'communication' ? MessageRounded : section === 'reports' ? AssessmentRounded : DashboardRounded);
            const renderItem = (item: MenuDef) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              return <Tooltip key={item.key} title={collapsed && !isMobile ? item.label : ''} placement="right">
                <ListItemButton
                  onClick={() => go(item)}
                  sx={{
                    minHeight: 44, borderRadius: design.borders.navigationRadius, mb: .4, px: collapsed && !isMobile ? 1.1 : 1.15,
                    justifyContent: collapsed && !isMobile ? 'center' : 'flex-start', position: 'relative',
                    background: active ? 'linear-gradient(115deg, var(--sa-navigation), var(--sa-primary))' : 'transparent', color: active ? 'primary.contrastText' : 'text.secondary',
                    boxShadow: active ? '0 8px 20px rgba(7,63,86,.18)' : 'none',
                    '&::before': active ? { content: '""', position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, bgcolor: 'secondary.light', boxShadow: '0 0 0 3px rgba(255,255,255,.10)' } : undefined,
                    '&:hover': { bgcolor: active ? 'primary.dark' : 'action.hover', background: active ? 'linear-gradient(115deg, var(--sa-navigation), var(--sa-primary))' : undefined, color: active ? 'primary.contrastText' : 'text.primary', transform: 'translateX(2px)' },
                    transition: 'transform .18s ease, background-color .18s ease, box-shadow .18s ease',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: collapsed && !isMobile ? 0 : 40, color: 'inherit', justifyContent: 'center' }}>
                    <Box sx={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: '10px', bgcolor: active ? 'rgba(255,255,255,.16)' : 'rgba(10,96,122,.075)', color: 'inherit', transition: 'background-color .18s ease' }}>
                      <Icon sx={{ fontSize: design.icons.navSize }} />
                    </Box>
                  </ListItemIcon>
                  {(!collapsed || isMobile) && <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 12.8, fontWeight: active ? 790 : 650, noWrap: true }} />}
                  {(!collapsed || isMobile) && item.badge && <Box component="span" sx={{ px: .75, py: .2, borderRadius: 99, bgcolor: active ? 'rgba(255,255,255,.18)' : 'action.selected', fontSize: 9.5, fontWeight: 850 }}>{item.badge}</Box>}
                </ListItemButton>
              </Tooltip>;
            };
            if (collapsed && !isMobile) return <Fragment key={section}><Divider sx={{ my: groupIndex ? 1.05 : 0, opacity: groupIndex ? 1 : 0 }} />{sectionItems.map((item) => renderItem(item))}</Fragment>;
            return <Box key={section} sx={{ mb: 1.35 }}>
              <Stack direction="row" alignItems="center" spacing={.85} sx={{ px: .65, pt: .45, pb: .85, color: activeGroup ? 'primary.main' : 'text.secondary' }}>
                <Box sx={{ width: 25, height: 25, display: 'grid', placeItems: 'center', borderRadius: '8px', bgcolor: activeGroup ? 'rgba(10,96,122,.10)' : 'rgba(10,96,122,.055)' }}>
                  <SectionIcon sx={{ fontSize: 15 }} />
                </Box>
                <Typography component="span" sx={{ flex: 1, fontSize: 10.2, fontWeight: 850, letterSpacing: '.06em', textTransform: 'uppercase', color: activeGroup ? 'text.primary' : 'text.secondary' }}>{sectionLabel(section)}</Typography>
                <Typography component="span" sx={{ fontSize: 9.5, color: 'text.disabled', fontWeight: 750 }}>{sectionItems.length}</Typography>
              </Stack>
              <List disablePadding>{sectionItems.map((item) => renderItem(item))}</List>
            </Box>;
          })}
        </List>
        </Box>
        {sidebarScroll.canScrollUp && <Tooltip title="Scroll navigation up" placement="right"><IconButton aria-label="Scroll navigation up" onClick={() => scrollSidebar('up')} size="small" sx={{ position: 'absolute', zIndex: 2, top: 6, left: '50%', transform: 'translateX(-50%)', borderRadius: design.borders.navigationRadius, border: `${design.borders.width}px ${design.borders.style}`, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 8px 18px rgba(15,35,40,.12)', '&:hover': { bgcolor: 'action.hover' } }}><KeyboardArrowUpRounded sx={{ fontSize: design.icons.navSize }} /></IconButton></Tooltip>}
        {sidebarScroll.canScrollDown && <Tooltip title="Scroll navigation down" placement="right"><IconButton aria-label="Scroll navigation down" onClick={() => scrollSidebar('down')} size="small" sx={{ position: 'absolute', zIndex: 2, bottom: 6, left: '50%', transform: 'translateX(-50%)', borderRadius: design.borders.navigationRadius, border: `${design.borders.width}px ${design.borders.style}`, borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 -8px 18px rgba(15,35,40,.10)', '&:hover': { bgcolor: 'action.hover' } }}><KeyboardArrowDownRounded sx={{ fontSize: design.icons.navSize }} /></IconButton></Tooltip>}
      </Box>
    </Box>
  );

  const width = collapsed ? collapsedWidth : drawerWidth;
  const mobilePropertyPath = menu.some((item) => item.key === 'properties') ? '/app/properties' : menu.some((item) => item.key === 'my-property') ? '/app/my-property' : menu.some((item) => item.key === 'marketplace') ? '/marketplace' : '/app/dashboard';
  const mobileBottomItems = user?.role === 'tenant' && hasLandlordSubscription
    ? [
      { key: 'mobile-home', label: 'Home', path: '/app/dashboard', icon: HomeRounded },
      { key: 'mobile-listings', label: 'Listings', path: '/app/my-listings', icon: ApartmentRounded },
      { key: 'mobile-applications', label: 'Applications', path: '/app/applications', icon: FactCheckRounded },
      { key: 'mobile-tenancies', label: 'Tenancies', path: '/app/tenancies', icon: HomeWorkRounded },
      { key: 'mobile-profile', label: 'Account', path: '/app/profile', icon: PersonRounded },
    ]
    : user?.role === 'tenant'
    ? [
      { key: 'mobile-home', label: 'Home', path: '/app/dashboard', icon: HomeRounded },
      { key: 'mobile-explore', label: 'Explore', path: '/marketplace', icon: ExploreRounded },
      { key: 'mobile-vault', label: 'Vault', path: '/app/documents', icon: FolderRounded },
      { key: 'mobile-wishlist', label: 'Wishlist', path: '/app/wishlist', icon: FavoriteRounded },
      { key: 'mobile-profile', label: 'Profile', path: '/app/profile', icon: PersonRounded },
    ]
    : [
      { key: 'mobile-home', label: 'Home', path: '/app/dashboard', icon: HomeRounded },
      { key: 'mobile-vault', label: 'Vault', path: '/app/documents', icon: FolderRounded },
      { key: 'mobile-property', label: 'Property', path: mobilePropertyPath, icon: ApartmentRounded },
      { key: 'mobile-account', label: 'Account', path: '/app/profile', icon: PersonRounded },
    ];
  const mobileBottomValue = user?.role === 'tenant' && hasLandlordSubscription
    ? location.pathname.startsWith('/app/my-listings') || location.pathname.startsWith('/app/property-details') ? 'mobile-listings' : location.pathname.startsWith('/app/applications') ? 'mobile-applications' : location.pathname.startsWith('/app/tenancies') || location.pathname.startsWith('/app/tenancy_details') ? 'mobile-tenancies' : location.pathname.startsWith('/app/profile') || location.pathname.startsWith('/app/documents') || location.pathname.startsWith('/app/notifications') || location.pathname.startsWith('/app/security') ? 'mobile-profile' : 'mobile-home'
    : user?.role === 'tenant'
    ? location.pathname.startsWith('/app/documents') ? 'mobile-vault' : location.pathname.startsWith('/app/wishlist') ? 'mobile-wishlist' : location.pathname.startsWith('/marketplace') ? 'mobile-explore' : location.pathname.startsWith('/app/profile') ? 'mobile-profile' : 'mobile-home'
    : location.pathname.startsWith('/app/documents') ? 'mobile-vault' : location.pathname.startsWith('/app/property') || location.pathname.startsWith('/app/my-property') || location.pathname.startsWith('/marketplace') ? 'mobile-property' : location.pathname.startsWith('/app/profile') ? 'mobile-account' : 'mobile-home';
  const currentModule = menu.find((item) => isItemActive(item)) || menu.find((item) => item.key === currentKey);
  const pageTitle = currentModule?.label || moduleLabel(currentKey);
  const canAddProperty = ['admin', 'manager', 'landlord'].includes(String(user?.role)) || hasLandlordSubscription;
  const showAddProperty = canAddProperty && ['dashboard', 'properties', 'my-listings', 'property-management'].includes(currentKey);
  const submitGlobalSearch = () => {
    const query = globalQuery.trim();
    if (query.length >= 2) navigate(`/app/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <Box className="sa-app-main">
      <Box component="a" href="#sa-main-content" sx={{ position: 'fixed', zIndex: theme.zIndex.tooltip + 1, left: 16, top: -80, px: 2, py: 1.1, borderRadius: 2, bgcolor: 'background.paper', color: 'primary.main', fontWeight: 800, boxShadow: '0 12px 30px rgba(7,46,59,.18)', '&:focus': { top: 12 } }}>Skip to main content</Box>
      <AppBar data-secureasset-app-header-theme="design-navigation-v160" position="fixed" elevation={0} sx={{ zIndex: theme.zIndex.drawer + 1, ml: { md: `${width}px` }, width: { md: `calc(100% - ${width}px)` }, bgcolor: design.colors.navigation, backgroundImage: 'linear-gradient(110deg, var(--sa-navigation) 0%, var(--sa-primary) 72%, #167567 145%)', color: design.colors.navigationText, borderBottom: `${design.borders.width}px ${design.borders.style}`, borderColor: 'rgba(255,255,255,.16)', boxShadow: '0 8px 30px rgba(7,46,59,.16)', backdropFilter: design.effects.enableGlassNavigation ? 'blur(20px)' : 'none', transition: 'all .2s', '& .MuiIconButton-root': { color: design.colors.navigationText, bgcolor: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.10)', '&:hover': { bgcolor: 'rgba(255,255,255,.18)', borderColor: 'rgba(255,255,255,.22)' } }, '& .MuiButton-outlined': { color: design.colors.navigationText, borderColor: 'rgba(255,255,255,.42)', '&:hover': { bgcolor: 'rgba(255,255,255,.12)', borderColor: design.colors.navigationText } } }}>
        <Toolbar sx={{ minHeight: `${design.layout.appBarHeight}px !important`, px: { xs: 1.5, sm: 2.5, lg: 3.5 }, gap: { xs: .5, sm: 1.25 } }}>
          {isMobile ? <IconButton onClick={() => setMobileOpen(true)} aria-label="Open app navigation" sx={{ bgcolor: 'action.hover' }}><MenuRounded /></IconButton> : collapsed ? <Tooltip title="Expand navigation"><IconButton onClick={() => setCollapsed(false)} sx={{ bgcolor: 'action.hover' }}><MenuRounded /></IconButton></Tooltip> : null}
          <Box sx={{ display: { xs: 'flex', lg: 'none' }, maxWidth: { xs: 128, sm: 170 }, minWidth: 0, overflow: 'hidden', flexShrink: 1 }}><LogoMark light /></Box>
          {isMobile && <Box data-secureasset-mobile-app-header="page-title-hidden-v158" aria-hidden="true" sx={{ minWidth: 0, flex: 1 }} />}
          <Box sx={{ display: { xs: 'none', lg: 'block' }, minWidth: 138, maxWidth: 185 }}><Typography noWrap sx={{ fontSize: 13.5, fontWeight: 860 }}>{pageTitle}</Typography><Typography noWrap sx={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)' }}>SecureAsset workspace</Typography></Box>
          <WorkspaceSearch value={globalQuery} onChange={setGlobalQuery} onSubmit={submitGlobalSearch} enableShortcut={!isMobile} />
          {!isMobile && <Box sx={{ flex: 1 }} />}
          {isMobile && <Tooltip title="Search workspace"><IconButton onClick={() => setMobileSearchOpen(true)} sx={{ bgcolor: 'action.hover' }}><SearchRounded /></IconButton></Tooltip>}
          {showAddProperty && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/app/add_property')} sx={{ display: { xs: 'none', lg: 'inline-flex' }, whiteSpace: 'nowrap' }}>Add property</Button>}
          <Tooltip title={mode === 'dark' ? 'Use light mode' : 'Use dark mode'}><IconButton onClick={toggle} sx={{ display: { xs: 'none', sm: 'inline-flex' }, bgcolor: 'action.hover' }}>{mode === 'dark' ? <LightModeRounded fontSize="small" /> : <DarkModeRounded fontSize="small" />}</IconButton></Tooltip>
          <Tooltip title="Notifications"><IconButton onClick={() => navigate('/app/notifications')} sx={{ bgcolor: 'action.hover' }}><Badge badgeContent={unread} color="error" max={99}><NotificationsRounded fontSize="small" /></Badge></IconButton></Tooltip>
          <Tooltip title="Messages"><IconButton onClick={() => navigate('/app/messages')} sx={{ display: { xs: 'none', sm: 'inline-flex' }, bgcolor: 'action.hover' }}><MessageRounded fontSize="small" /></IconButton></Tooltip>
          <IconButton aria-label="Open account menu" onClick={(e) => setAnchor(e.currentTarget)} sx={{ ml: .15, p: .25, border: '2px solid', borderColor: 'background.paper', boxShadow: '0 0 0 1px', color: 'divider' }}><Avatar src={user?.avatar} sx={{ width: 35, height: 35, bgcolor: 'primary.main', fontSize: 14, fontWeight: 800 }}>{user?.name?.[0]}</Avatar></IconButton>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} PaperProps={{ sx: { mt: 1, minWidth: 228, p: .5 } }}>
            <Box sx={{ px: 1.5, py: 1.15 }}><Typography sx={{ fontWeight: 850, fontSize: 13.2 }}>{user?.name}</Typography><Typography noWrap sx={{ color: 'text.secondary', fontSize: 11.3 }}>{user?.email}</Typography></Box>
            <Divider />
            <MenuItem onClick={() => { setAnchor(null); navigate('/app/profile'); }}><PersonRounded fontSize="small" sx={{ mr: 1.2 }} />{hasLandlordSubscription ? 'Profile & Settings' : 'Profile'}</MenuItem>
            <MenuItem onClick={() => { setAnchor(null); navigate('/app/security'); }}><SecurityRounded fontSize="small" sx={{ mr: 1.2 }} />Security</MenuItem>
            {['tenant', 'surveyor'].includes(String(user?.role || '')) && <>
              <Divider sx={{ my: .4 }} />
              {user?.role === 'tenant' && <MenuItem onClick={() => { setAnchor(null); navigate('/app/subscription'); }} data-secureasset-profile-subscription="my-subscription-v84"><WorkspacePremiumRounded fontSize="small" sx={{ mr: 1.2 }} />My subscription</MenuItem>}
              {userSurveyorFeatures && <MenuItem onClick={() => { setAnchor(null); navigate('/app/surveyor-subscription'); }}><WorkspacePremiumRounded fontSize="small" sx={{ mr: 1.2 }} />Surveyor subscription</MenuItem>}
              {showTenantUpgrade && <MenuItem onClick={() => { setAnchor(null); navigate('/app/subscription'); }} sx={{ color: 'primary.main', fontWeight: 800 }}><WorkspacePremiumRounded fontSize="small" sx={{ mr: 1.2 }} />Upgrade account</MenuItem>}
            </>}
            <MenuItem onClick={handleLogout}><LogoutRounded fontSize="small" sx={{ mr: 1.2 }} />Log out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <ProfessionalDialog open={mobileSearchOpen} onClose={() => setMobileSearchOpen(false)} fullScreen professionalTitle="Search your workspace" professionalSubtitle="Find properties, people, surveys, documents and operational records." enableMinimize={false}>
        <DialogContent sx={{ p: 2, pt: 2 }}>
          <WorkspaceSearch
            variant="dialog"
            autoFocus
            value={globalQuery}
            onChange={setGlobalQuery}
            onSubmit={() => { setMobileSearchOpen(false); submitGlobalSearch(); }}
            placeholder="Search properties, people or records…"
          />
        </DialogContent>
      </ProfessionalDialog>

      <Drawer variant={isMobile ? 'temporary' : 'permanent'} open={isMobile ? mobileOpen : true} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { fontFamily: OPEN_SANS_FONT_FAMILY, '& .MuiTypography-root, & .MuiButtonBase-root, & .MuiChip-label, & .MuiListItemText-primary, & .MuiListItemText-secondary': { fontFamily: `${OPEN_SANS_FONT_FAMILY} !important` }, width: isMobile ? drawerWidth : width, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', transition: 'width .2s', overflowX: 'hidden', boxShadow: isMobile ? '16px 0 48px rgba(7,46,59,.18)' : '6px 0 24px rgba(7,46,59,.045)' } }}>{drawerContent}</Drawer>

      <Box
        component="main"
        id="sa-main-content"
        className={[
          'sa-reference-content',
          'sa-premium-role-workspace',
          `sa-role-${String(user?.role || 'user').toLowerCase()}`,
          user?.role === 'tenant' && hasLandlordSubscription ? 'sa-capability-landlord' : '',
          user?.role === 'tenant' && hasSurveyorSubscription ? 'sa-capability-surveyor' : '',
        ].filter(Boolean).join(' ')}
        data-workspace-role={String(user?.role || 'user').toLowerCase()}
        data-landlord-capability={user?.role === 'tenant' && hasLandlordSubscription ? 'active' : 'inactive'}
        data-surveyor-capability={user?.role === 'tenant' && hasSurveyorSubscription ? 'active' : 'inactive'}
        tabIndex={-1}
        sx={{ ml: { md: `${width}px` }, pt: `${design.layout.appBarHeight}px`, pb: { xs: 13, md: 6 }, minHeight: '100vh', transition: 'margin .2s', outline: 'none' }}
      >
        <Box className="sa-app-content sa-premium-role-content" sx={{ pt: { xs: 2, md: 3 } }}>
          <Suspense fallback={null}><Outlet /></Suspense>
        </Box>
      </Box>

      <BottomNavigation
        component="nav"
        aria-label="Mobile app navigation"
        className="sa-app-bottom-navigation sa-global-mobile-bottom-navigation sa-premium-bottom-appbar"
        value={mobileBottomValue}
        onChange={(_e, value) => {
          const item = mobileBottomItems.find((candidate) => candidate.key === value);
          if (item) { navigate(item.path); setMobileOpen(false); }
        }}
        showLabels
        sx={{
          position: 'fixed',
          left: { xs: 12, sm: 18 },
          right: { xs: 12, sm: 18 },
          bottom: { xs: 'max(10px, env(safe-area-inset-bottom))', sm: 12 },
          zIndex: theme.zIndex.appBar,
          height: { xs: 68, sm: 72 },
          minHeight: 0,
          border: '1px solid rgba(188, 211, 229, .78)',
          borderRadius: '22px !important',
          overflow: 'visible',
          bgcolor: 'rgba(255,255,255,.94)',
          opacity: 1,
          p: { xs: '6px 5px', sm: '7px 8px' },
          backdropFilter: 'blur(22px) saturate(165%)',
          WebkitBackdropFilter: 'blur(22px) saturate(165%)',
          boxShadow: '0 14px 36px rgba(16,49,83,.14), 0 2px 8px rgba(0,159,144,.06), inset 0 1px 0 rgba(255,255,255,.92)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '0 12%',
            top: -1,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(0,159,144,.48), transparent)',
          },
          '& .MuiBottomNavigationAction-root': {
            color: '#7185A5 !important',
            minWidth: 0,
            maxWidth: 'none',
            px: { xs: .35, sm: .75 },
            py: .35,
            mx: { xs: .1, sm: .25 },
            my: 0,
            borderRadius: '15px !important',
            position: 'relative',
            transition: 'color .18s ease, background-color .18s ease, transform .18s ease',
          },
          '& .MuiBottomNavigationAction-root:hover': {
            color: '#0B2057 !important',
            bgcolor: 'rgba(238,245,253,.84)',
          },
          '& .MuiBottomNavigationAction-root.Mui-selected': {
            color: '#087F76 !important',
            bgcolor: 'rgba(238,248,248,.94)',
            transform: 'translateY(-1px)',
          },
          '& .MuiBottomNavigationAction-root.Mui-selected::before': {
            content: '""',
            position: 'absolute',
            left: '24%',
            right: '24%',
            top: -7,
            height: 3,
            borderRadius: '0 0 999px 999px',
            background: 'linear-gradient(90deg,#00B391,#007C8A)',
            boxShadow: '0 2px 8px rgba(0,159,144,.25)',
          },
          '& .MuiBottomNavigationAction-root .MuiSvgIcon-root': {
            fontSize: { xs: 21, sm: 22 },
            transition: 'transform .18s ease, filter .18s ease',
          },
          '& .MuiBottomNavigationAction-root.Mui-selected .MuiSvgIcon-root': {
            transform: 'scale(1.08)',
            filter: 'drop-shadow(0 3px 6px rgba(0,159,144,.14))',
          },
          '& .MuiBottomNavigationAction-root > img': {
            width: { xs: 21, sm: 22 },
            height: { xs: 21, sm: 22 },
            objectFit: 'contain',
          },
          '& .MuiBottomNavigationAction-label': {
            display: 'block !important',
            visibility: 'visible !important',
            opacity: '1 !important',
            transform: 'none !important',
            color: 'inherit !important',
            fontSize: { xs: '9.25px !important', sm: '9.75px !important' },
            fontWeight: '500 !important',
            lineHeight: 1.15,
            mt: .35,
            letterSpacing: '-.01em',
            whiteSpace: 'nowrap',
          },
          '& .MuiBottomNavigationAction-root.Mui-selected .MuiBottomNavigationAction-label': {
            color: '#0B2057 !important',
            fontWeight: '600 !important',
          },
        }}
      >
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          return <BottomNavigationAction
            key={item.key}
            value={item.key}
            label={item.label}
            aria-label={item.label}
            onClick={() => { navigate(item.path); setMobileOpen(false); }}
            icon={configuredBottomIcon(design, item.key, <Icon />)}
          />;
        })}
      </BottomNavigation>

      <Tooltip title={moduleError || 'Help & support'}><IconButton aria-label="Open help and support" onClick={() => navigate('/contact')} sx={{ position: 'fixed', right: { xs: 20, md: 26 }, bottom: { xs: 94, md: 26 }, bgcolor: 'primary.main', color: 'primary.contrastText', border: '1px solid rgba(255,255,255,.30)', boxShadow: '0 12px 28px rgba(7,46,59,.20)', '&:hover': { bgcolor: 'primary.dark' } }}><HelpOutlineRounded fontSize="small" /></IconButton></Tooltip>
    </Box>
  );
}
