import { Suspense, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { getAppConfiguration } from '../../services/api';
import { safeRecordArray } from '../../utils/runtimeData';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

// Keep the application shell small. Heavy workspaces are fetched only after
// the server has confirmed that the current user can open them.
const ResourcePage = lazyWithRetry(() => import('./ResourcePage'));
const UtilityPage = lazyWithRetry(() => import('./UtilityPage'));
const SubscriptionPage = lazyWithRetry(() => import('./SubscriptionPage'));
const SurveyorSubscriptionPage = lazyWithRetry(() => import('./SurveyorSubscriptionPage'));
const SurveyorDashboardPage = lazyWithRetry(() => import('./SurveyorDashboardPage'));
const SurveyorVerificationPage = lazyWithRetry(() => import('./SurveyorVerificationPage'));
const SurveyorProfilePage = lazyWithRetry(() => import('./SurveyorProfilePage'));
const SurveyJobMarketplacePage = lazyWithRetry(() => import('./SurveyJobMarketplacePage'));
const SurveyJobsWorkspacePage = lazyWithRetry(() => import('./SurveyJobsWorkspacePage'));
const SurveyProposalsPage = lazyWithRetry(() => import('./SurveyProposalsPage'));
const SurveyProjectsWorkflowPage = lazyWithRetry(() => import('./SurveyProjectsWorkflowPage'));
const DocumentVaultPage = lazyWithRetry(() => import('./DocumentVaultPage'));
const DriveAdministrationPage = lazyWithRetry(() => import('./DriveAdministrationPage'));
const BackupRecoveryPage = lazyWithRetry(() => import('./BackupRecoveryPage'));
const PropertyManagementPage = lazyWithRetry(() => import('./PropertyManagementPage'));
const TenantKycPage = lazyWithRetry(() => import('./TenantKycPage'));
const TenantKycAdminPage = lazyWithRetry(() => import('./TenantKycAdminPage'));
const LandlordTenantsPage = lazyWithRetry(() => import('./LandlordTenantsPage'));
const SearchPage = lazyWithRetry(() => import('./SearchPage'));
const MessagingPage = lazyWithRetry(() => import('./MessagingPage'));
const NotificationCenterPage = lazyWithRetry(() => import('./NotificationCenterPage'));
const SecurityPage = lazyWithRetry(() => import('./SecurityPage'));
const NavigationManagementPage = lazyWithRetry(() => import('./NavigationManagementPage'));
const AddPropertyPage = lazyWithRetry(() => import('./AddPropertyPage'));
const DesignStudioPage = lazyWithRetry(() => import('./DesignStudioPage'));
const MyPropertyPage = lazyWithRetry(() => import('./MyPropertyPage'));
const RolePermissionsPage = lazyWithRetry(() => import('./RolePermissionsPage'));
const SubscriptionPaymentReviewPage = lazyWithRetry(() => import('./SubscriptionPaymentReviewPage'));
const AgreementTemplatesPage = lazyWithRetry(() => import('./AgreementTemplatesPage'));
const PropertyVisitsPage = lazyWithRetry(() => import('./PropertyVisitsPage'));
const SiteAdministrationPage = lazyWithRetry(() => import('./SiteAdministrationPage'));
const RentalManagementAdminPage = lazyWithRetry(() => import('./RentalManagementAdminPage'));
const WishlistPage = lazyWithRetry(() => import('../WishlistPage'));

const TenancyHistoryPage = lazyWithRetry(() => import('./TenancyHistoryPage'));

const LANDLORD_PROPERTY_MODULES = new Set([
  'properties', 'my-listings', 'property-management', 'add_property', 'add-property', 'add-my-property',
  'public-my-properties', 'private-my-properties', 'draft-my-properties', 'pending-my-properties',
]);
const LANDLORD_FEATURE_MODULES = new Set([...LANDLORD_PROPERTY_MODULES, 'agreement-templates', 'tenants', 'tenancy-history']);
const PROPERTY_DETAIL_ONLY_MODULES = new Set(['property-spaces', 'property-media', 'property-promotions']);
const RETIRED_SURVEYOR_MODULES = new Set([
  'surveys', 'assigned-properties', 'pending-surveys', 'in-progress-surveys', 'completed-surveys', 'correction-required',
  'survey-services', 'site-visits', 'assigned-visits', 'field-data', 'location-verification', 'specification-verification',
  'room-verification', 'facility-verification', 'survey-reports', 'submitted-reports', 'approved-reports', 'rejected-reports',
  'survey-equipment', 'survey-team', 'survey-clients', 'survey-reviews', 'survey-disputes', 'survey-promotions',
]);
const HIDDEN_MODULES = new Set(['audit-logs']);
const TENANT_ONLY_ACTIVATION_MODULES = new Set(['subscription', 'surveyor-subscription']);

export default function ModulePage() {
  const { module = '' } = useParams();
  const { user } = useAuth();
  const configurationQuery = useQuery({
    queryKey: ['app-configuration', user?._id, user?.role, user?.activeMode, user?.landlordEnabled, user?.surveyorEnabled],
    queryFn: getAppConfiguration,
    enabled: Boolean(user?._id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
  const response = configurationQuery.data;
  const allowedModules = useMemo(() => safeRecordArray(response?.data?.modules).filter((item) => typeof item.key === 'string' && item.key.trim()), [response]);
  const accessError = configurationQuery.error instanceof Error ? configurationQuery.error.message : configurationQuery.error ? 'Could not verify module access' : '';
  const serverLandlordFeatures = allowedModules.some((item) => {
    const metadata = item?.metadata || {};
    return LANDLORD_FEATURE_MODULES.has(String(item?.key || ''))
      && ['landlord', 'tenant'].includes(String(metadata.capability || metadata.subscription || metadata.role || '').toLowerCase());
  });
  const hasLandlordFeatures = Boolean(user?.role === 'landlord' || (user?.role === 'tenant' && user.landlordEnabled) || serverLandlordFeatures);
  const hasSurveyorFeatures = Boolean(user?.role === 'surveyor' || (user?.role === 'tenant' && user.surveyorEnabled));
  const landlordPropertyRouteAllowed = hasLandlordFeatures && LANDLORD_FEATURE_MODULES.has(module);
  const accessAllowed = useMemo(() => {
    if (!module) return true;
    const alwaysAllowed = ['profile', 'security', 'search', 'messages', 'notifications'];
    if (alwaysAllowed.includes(module)) return Boolean(user);
    if (module === 'wishlist' || module === 'saved-properties') return user?.role === 'tenant';
    // These pages create or renew tenant-owned capabilities. A legacy
    // landlord/surveyor role must not activate a plan through a direct URL.
    if (TENANT_ONLY_ACTIVATION_MODULES.has(module)) return user?.role === 'tenant';
    if (module === 'my-applications') return user?.role === 'tenant';
    if (module === 'surveyor-subscription' && hasSurveyorFeatures) return true;
    const adminOnly = ['drive-admin', 'backup-recovery', 'site-admin', 'settings', 'integration-settings', 'platform-modules', 'design-studio', 'role-permissions', 'subscription-payment-approvals'];
    if (adminOnly.includes(module)) return user?.role === 'admin';
    // Keep the workspace usable while the catalog is refreshed. Every
    // resource endpoint still enforces the current user's permissions.
    if (configurationQuery.isPending) return Boolean(user);
    // KYC is a shared compliance workspace: tenants submit their own record,
    // while administrators and managers review the records in their scope.
    // Keep this route reachable even when a stale cached module catalog has not
    // yet received the latest navigation entry; the API remains authoritative.
    if (module === 'tenant-kyc') return ['admin', 'manager', 'tenant'].includes(String(user?.role || ''));
    // A tenant keeps the tenant account role. An active landlord capability
    // grants these owner-scoped property routes without requiring a mode
    // switch or a role mutation. The API still enforces ownership and plan
    // limits for every read/write action.
    if (landlordPropertyRouteAllowed) return true;
    if (!allowedModules.length) return false;
    const aliases: Record<string, string[]> = { add_property: ['add-property', 'add-my-property'], 'add-property': ['add-property', 'add-my-property'] };
    return allowedModules.some((item) => {
      const path = String(item.path || `/app/${item.key}`);
      const base = path.split('?')[0].replace(/^\/app\//, '');
      return item.key === module || base === module || (aliases[module] || []).includes(item.key);
    });
  }, [allowedModules, configurationQuery.isPending, hasSurveyorFeatures, landlordPropertyRouteAllowed, module, user?.role]);
  const configuredModule = allowedModules.some((item) => {
    const path = String(item.path || `/app/${item.key}`);
    const base = path.split('?')[0].replace(/^\/app\//, '');
    return item.key === module || base === module;
  });
  // Lazy route chunks load inside the existing shell without replacing it
  // with a full-page loading screen.
  const renderLazy = (element: ReactNode) => <Suspense fallback={null}>{element}</Suspense>;
  if (HIDDEN_MODULES.has(module)) return <Navigate replace to="/app/dashboard" />;
  if (PROPERTY_DETAIL_ONLY_MODULES.has(module)) return <Box sx={{ maxWidth: 760, mx: 'auto', mt: 8 }}><Alert severity="info" sx={{ borderRadius: 3 }}><Stack spacing={1}><Typography fontWeight={800}>Manage this inside a property</Typography><Typography variant="body2">Open a property from My Listings to manage its rooms, gallery, and promotions.</Typography><Button variant="contained" href="/app/my-listings" sx={{ alignSelf: 'flex-start', borderRadius: 999 }}>Open My Listings</Button></Stack></Alert></Box>;
  if (hasSurveyorFeatures && RETIRED_SURVEYOR_MODULES.has(module)) return <Box sx={{ maxWidth: 760, mx: 'auto', mt: 8 }}><Alert severity="info" sx={{ borderRadius: 3 }}><Stack spacing={1}><Typography fontWeight={800}>This work now belongs to a survey project</Typography><Typography variant="body2">Open Active Projects for navigation, check-in, field data, evidence, reports, audit, and payment.</Typography><Button variant="contained" href="/app/survey-projects" sx={{ alignSelf: 'flex-start', borderRadius: 999 }}>Open Active Projects</Button></Stack></Alert></Box>;
  if (!accessAllowed) return <Box sx={{ maxWidth: 760, mx: 'auto', mt: 8 }}><Alert severity="error" sx={{ borderRadius: 3 }}><Stack spacing={1}><Typography fontWeight={800}>Access denied</Typography><Typography variant="body2">This module is not available for your current role, mode, or subscription plan.</Typography><Button variant="contained" href="/app/dashboard" sx={{ alignSelf: 'flex-start', borderRadius: 999 }}>Go to dashboard</Button>{accessError && <Typography variant="caption">{accessError}</Typography>}</Stack></Alert></Box>;
  // Profile is a system workspace, not a generic resource collection. It is
  // present in the tenant module catalog so it can be navigated to, but must
  // resolve here before `configuredModule` can send it to ResourcePage.
  if (module === 'profile') return renderLazy(<UtilityPage />);
  if (module === 'subscription') return renderLazy(<SubscriptionPage />);
  if (module === 'surveyor-subscription') return renderLazy(<SurveyorSubscriptionPage />);
  if (module === 'surveyor-dashboard') return renderLazy(<SurveyorDashboardPage />);
  if (module === 'surveyor-verification') return renderLazy(<SurveyorVerificationPage />);
  if (module === 'surveyor-profile') return renderLazy(<SurveyorProfilePage />);
  if (module === 'survey-job-marketplace') return renderLazy(<SurveyJobMarketplacePage />);
  if (module === 'survey-jobs' && hasLandlordFeatures) return renderLazy(<SurveyJobsWorkspacePage />);
  if (module === 'survey-jobs' && hasSurveyorFeatures) return renderLazy(<SurveyJobMarketplacePage />);
  if (module === 'survey-quotations' && hasSurveyorFeatures) return renderLazy(<SurveyProposalsPage />);
  if (module === 'survey-projects' && (user?.role === 'admin' || hasLandlordFeatures || hasSurveyorFeatures)) return renderLazy(<SurveyProjectsWorkflowPage />);
  if (module === 'active-projects' && (user?.role === 'admin' || hasLandlordFeatures)) return renderLazy(<SurveyProjectsWorkflowPage />);
  if (module === 'documents') return renderLazy(<DocumentVaultPage />);
  if (module === 'agreement-templates' && hasLandlordFeatures) return renderLazy(<AgreementTemplatesPage />);
  if (module === 'property-visits' && user?.role === 'tenant') return renderLazy(<PropertyVisitsPage />);
  if (module === 'drive-admin' && user?.role === 'admin') return renderLazy(<DriveAdministrationPage />);
  if (module === 'backup-recovery' && user?.role === 'admin') return renderLazy(<BackupRecoveryPage />);
  if (module === 'design-studio' && user?.role === 'admin') return renderLazy(<DesignStudioPage />);
  if (module === 'role-permissions' && user?.role === 'admin') return renderLazy(<RolePermissionsPage />);
  if (module === 'subscription-payment-approvals' && user?.role === 'admin') return renderLazy(<SubscriptionPaymentReviewPage />);
  if ((module === 'site-admin' || module === 'settings' || module === 'integration-settings') && user?.role === 'admin') return renderLazy(<SiteAdministrationPage />);
  if (module === 'platform-modules' && user?.role === 'admin') return renderLazy(<NavigationManagementPage />);
  if (module === 'add_property' || module === 'add-property') return renderLazy(<AddPropertyPage />);
  if (module === 'my-listings' && hasLandlordFeatures) return renderLazy(<ResourcePage resourceOverride="properties" />);
  if (module === 'tenancy-history' && hasLandlordFeatures) return renderLazy(<TenancyHistoryPage />);
  if (module === 'tenants' && hasLandlordFeatures) return renderLazy(<LandlordTenantsPage />);
  if (module === 'my-applications' && user?.role === 'tenant') return renderLazy(<ResourcePage resourceOverride="applications" tenantApplicationView />);
  if (module === 'property-management' && (user?.role === 'admin' || user?.role === 'manager' || hasLandlordFeatures)) return renderLazy(<PropertyManagementPage />);
  if (module === 'rental-management' && user?.role === 'admin') return renderLazy(<RentalManagementAdminPage />);
  if (module === 'tenant-kyc' && ['admin', 'manager'].includes(String(user?.role || ''))) return renderLazy(<TenantKycAdminPage />);
  if (module === 'tenant-kyc' && user?.role === 'tenant') return renderLazy(<TenantKycPage />);
  if (module === 'my-property' && user?.role === 'tenant') return renderLazy(<MyPropertyPage />);
  if (module === 'search') return renderLazy(<SearchPage />);
  if (module === 'messages') return renderLazy(<MessagingPage />);
  if (module === 'notifications') return renderLazy(<NotificationCenterPage />);
  if (module === 'security') return renderLazy(<SecurityPage />);
  if (module === 'wishlist' || module === 'saved-properties') return renderLazy(<WishlistPage />);
  if (configuredModule) return renderLazy(<ResourcePage />);
  if (configurationQuery.isPending) return renderLazy(<ResourcePage />);
  return renderLazy(<UtilityPage />);
}
