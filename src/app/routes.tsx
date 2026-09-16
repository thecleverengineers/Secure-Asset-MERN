import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router';
import { Alert, Box, Button, Typography } from '@mui/material';
import FrontLayout from './components/FrontLayout';
import PageDesignScope from './components/PageDesignScope';
import ProtectedRoute from './components/shared/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import RouteErrorPage from './components/shared/RouteErrorPage';
import { lazyWithRetry } from './utils/lazyWithRetry';

const Home = lazyWithRetry(() => import('./pages/PublicPages').then((module) => ({ default: module.Home })));
const Pricing = lazyWithRetry(() => import('./pages/PublicPages').then((module) => ({ default: module.Pricing })));
const About = lazyWithRetry(() => import('./pages/PublicPages').then((module) => ({ default: module.About })));
const Contact = lazyWithRetry(() => import('./pages/PublicPages').then((module) => ({ default: module.Contact })));
const DynamicContentPage = lazyWithRetry(() => import('./pages/PublicPages').then((module) => ({ default: module.DynamicContentPage })));
const MarketplacePage = lazyWithRetry(() => import('./pages/MarketplacePage'));
const PublicSearchPage = lazyWithRetry(() => import('./pages/PublicSearchPage'));
const WishlistPage = lazyWithRetry(() => import('./pages/WishlistPage'));
const PropertyDetailPage = lazyWithRetry(() => import('./pages/PropertyDetailPage'));
const RentalRoomDetailsPage = lazyWithRetry(() => import('./pages/RentalRoomDetailsPage'));
const SurveyorMarketplacePage = lazyWithRetry(() => import('./pages/SurveyorMarketplacePage'));
const SurveyorPublicProfilePage = lazyWithRetry(() => import('./pages/SurveyorPublicProfilePage'));
const SurveyorPrivateProfilePage = lazyWithRetry(() => import('./pages/SurveyorPrivateProfilePage'));
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const ResetPasswordPage = lazyWithRetry(() => import('./pages/ResetPasswordPage'));
const PublicDrivePage = lazyWithRetry(() => import('./pages/PublicDrivePage'));
const RoleDashboardPage = lazyWithRetry(() => import('./pages/app/RoleDashboardPage'));
const ModulePage = lazyWithRetry(() => import('./pages/app/ModulePage'));
const SubscriptionPaymentPage = lazyWithRetry(() => import('./pages/app/SubscriptionPaymentPage'));
const ApplyPropertyPage = lazyWithRetry(() => import('./pages/app/ApplyPropertyPage'));
const ScheduleVisitPage = lazyWithRetry(() => import('./pages/app/ScheduleVisitPage'));
const PropertyDetailsPage = lazyWithRetry(() => import('./pages/app/PropertyDetailsPage'));
const MyRentCyclePage = lazyWithRetry(() => import('./pages/app/MyRentCyclePage'));
const SurveyProjectsWorkflowPage = lazyWithRetry(() => import('./pages/app/SurveyProjectsWorkflowPage'));
const ManageRentalUnitsPage = lazyWithRetry(() => import('./pages/app/ManageRentalUnitsPage'));
const ViewRoomPage = lazyWithRetry(() => import('./pages/app/ViewRoomPage'));
const RentalManagementAdminPage = lazyWithRetry(() => import('./pages/app/RentalManagementAdminPage'));
const SurveyorProfileAdminPage = lazyWithRetry(() => import('./pages/app/SurveyorProfileAdminPage'));

function AccessDenied() {
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}><Box sx={{ textAlign: 'center', maxWidth: 480 }}><Alert severity="error" sx={{ mb: 2 }}>Access denied</Alert><Typography variant="h4" sx={{ fontWeight: 900 }}>You do not have access to this module.</Typography><Button href="/app/dashboard" variant="contained" sx={{ mt: 3 }}>Return to dashboard</Button></Box></Box>;
}

function LegacyPropertyActionRedirect({ target }: { target: 'apply_property' | 'schedule_visit' }) {
  const { propertyId } = useParams();
  const location = useLocation();
  return <Navigate replace to={`/app/${target}/${propertyId || ''}${location.search}`} />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: FrontLayout,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, Component: Home },
      { path: 'marketplace', Component: MarketplacePage },
      { path: 'search', Component: PublicSearchPage },
      { path: 'wishlist', Component: WishlistPage },
      { path: 'room-details/:id', Component: RentalRoomDetailsPage },
      { path: 'room_details/:id', Component: RentalRoomDetailsPage },
      { path: 'marketplace/property_overview/:slug', Component: PropertyDetailPage },
      { path: 'marketplace/:id', Component: PropertyDetailPage },
      { path: 'surveyors', Component: SurveyorMarketplacePage },
      { path: 'surveyors/:id', Component: SurveyorPublicProfilePage },
      { path: 'surveyor-private/:id', Component: SurveyorPrivateProfilePage },
      { path: 'pricing', Component: Pricing },
      { path: 'about', Component: About },
      { path: 'contact', Component: Contact },
      { path: 'login', Component: LoginPage },
      { path: 'reset-password', Component: ResetPasswordPage },
      { path: ':slug', Component: DynamicContentPage },
    ],
  },
  { path: '/public-drive/:type/:token', element: <PageDesignScope><PublicDrivePage /></PageDesignScope>, errorElement: <RouteErrorPage /> },
  {
    path: '/app',
    Component: ProtectedRoute,
    errorElement: <RouteErrorPage />,
    children: [{
      Component: AppShell,
      children: [
        { index: true, element: <Navigate to="dashboard" replace /> },
        { path: 'dashboard', Component: RoleDashboardPage },
        { path: 'subscription-payment', Component: SubscriptionPaymentPage },
        { path: 'apply_property/:propertyId', Component: ApplyPropertyPage },
        { path: 'apply-property/:propertyId', element: <LegacyPropertyActionRedirect target="apply_property" /> },
        { path: 'schedule_visit/:propertyId', Component: ScheduleVisitPage },
        { path: 'schedule-visit/:propertyId', element: <LegacyPropertyActionRedirect target="schedule_visit" /> },
        { path: 'property-details/:propertyId', Component: PropertyDetailsPage },
        { path: 'my-property/:tenancyId/rent-cycle', Component: MyRentCyclePage },
        { path: 'survey-projects/:projectId', Component: SurveyProjectsWorkflowPage },
        { path: 'my-listings/:propertyId/rooms', Component: ManageRentalUnitsPage },
        { path: 'my-listings/:propertyId/tenancy', Component: ManageRentalUnitsPage },
        { path: 'my-listings/:propertyId/rooms/view_room/:unitId', Component: ViewRoomPage },
        { path: 'view_room/:unitId', Component: ViewRoomPage },
        { path: 'rental-management', Component: RentalManagementAdminPage },
        { path: 'surveyor-profiles/:id', Component: SurveyorProfileAdminPage },
        { path: 'notification', element: <Navigate to="/app/notifications" replace /> },
        { path: ':module', Component: ModulePage },
      ],
    }],
  },
  { path: '/dashboard', element: <Navigate to="/app/dashboard" replace /> },
  { path: '/access-denied', Component: AccessDenied },
  { path: '*', element: <Navigate to="/" replace /> },
]);
