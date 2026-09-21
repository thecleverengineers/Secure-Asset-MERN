import { Suspense, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid, LinearProgress, Paper, Stack, Typography,
} from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import PeopleRounded from '@mui/icons-material/PeopleRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import AssignmentRounded from '@mui/icons-material/AssignmentRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import BuildRounded from '@mui/icons-material/BuildRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import ApprovalRounded from '@mui/icons-material/ApprovalRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import RouteRounded from '@mui/icons-material/RouteRounded';
import CloudSyncRounded from '@mui/icons-material/CloudSyncRounded';
import BusinessRounded from '@mui/icons-material/BusinessRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import ExploreRounded from '@mui/icons-material/ExploreRounded';
import EngineeringRounded from '@mui/icons-material/EngineeringRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import { useAuth } from '../../context/AuthContext';
import {
  getDashboardOverview, getLandlordOverview, getMySubscription, getMySurveyorSubscription,
  getSurveyorDashboard,
} from '../../services/api';
import type { DashboardOverview } from '../../services/types';
import { useRealtime } from '../../context/RealtimeContext';
import PageHeader from '../../components/layout/PageHeader';
import { safeRecord, safeRecordArray } from '../../utils/runtimeData';
import { ChartSkeleton, DashboardSkeleton } from '../../components/shared/PremiumSkeleton';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

const DashboardCharts = lazyWithRetry(() => import('../../components/dashboard/DashboardCharts'));
const SurveyorDashboardPage = lazyWithRetry(() => import('./SurveyorDashboardPage'));

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const sentence = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const baseCards = [
  ['totalProperties', 'Properties', ApartmentRounded], ['totalUnits', 'Total units', MeetingRoomRounded],
  ['occupiedUnits', 'Occupied units', HomeWorkRounded], ['vacantUnits', 'Vacant units', MeetingRoomRounded],
  ['totalTenants', 'Active tenants', PeopleRounded], ['activeUsers', 'Platform users', PeopleRounded],
  ['pendingApplications', 'Pending applications', FactCheckRounded], ['pendingSurveys', 'Pending surveys', AssignmentRounded],
  ['monthlyRentCollection', 'This month collected', PaymentsRounded], ['outstandingDues', 'Outstanding dues', AccountBalanceWalletRounded],
  ['openComplaints', 'Open maintenance', BuildRounded], ['expiringLeases', 'Leases expiring', DescriptionRounded],
  ['pendingApprovals', 'Awaiting approval', ApprovalRounded],
] as const;

const cardsByRole: Record<string, string[]> = {
  admin: ['totalProperties', 'totalUnits', 'occupiedUnits', 'vacantUnits', 'totalTenants', 'activeUsers', 'pendingApplications', 'pendingSurveys', 'monthlyRentCollection', 'outstandingDues', 'openComplaints', 'expiringLeases'],
  manager: ['totalProperties', 'occupiedUnits', 'vacantUnits', 'pendingApplications', 'pendingSurveys', 'monthlyRentCollection', 'outstandingDues', 'openComplaints', 'expiringLeases', 'pendingApprovals'],
  tenant: ['monthlyRentCollection', 'outstandingDues', 'openComplaints', 'expiringLeases'],
  user: ['pendingApplications', 'outstandingDues', 'openComplaints'],
  surveyor: ['pendingSurveys'],
};

type DashboardQuickLink = readonly [label: string, description: string, path: string, icon: any];

const finiteNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function normaliseDashboardOverview(value: unknown): DashboardOverview {
  const source = safeRecord(value);
  const kpis = safeRecord(source.kpis);
  return {
    kpis: kpis as DashboardOverview['kpis'],
    occupancyRate: finiteNumber(source.occupancyRate),
    revenueTrend: safeRecordArray(source.revenueTrend).map((item) => ({ month: String(item.month || ''), amount: finiteNumber(item.amount) })),
    surveyStatus: safeRecordArray(source.surveyStatus).map((item) => ({ name: String(item.name || 'Unknown'), value: finiteNumber(item.value) })),
    complaintStatus: safeRecordArray(source.complaintStatus).map((item) => ({ name: String(item.name || 'Unknown'), value: finiteNumber(item.value) })),
    recentActivities: safeRecordArray(source.recentActivities),
    todayAssignments: finiteNumber(source.todayAssignments),
    completedSurveys: finiteNumber(source.completedSurveys),
    nextPayment: safeRecord(source.nextPayment) as DashboardOverview['nextPayment'],
    activeLease: safeRecord(source.activeLease),
    latestApplication: safeRecord(source.latestApplication),
  };
}

function MetricCard({ label, value, Icon, detail, tone = 'primary' }: { label: string; value: string | number; Icon: any; detail?: string; tone?: 'primary' | 'success' | 'secondary' | 'warning' }) {
  const toneMap: Record<string, { surface: string; color: string }> = {
    primary: { surface: 'rgba(7,63,86,.10)', color: 'primary.main' },
    success: { surface: 'rgba(35,128,98,.12)', color: 'success.main' },
    secondary: { surface: 'rgba(228,111,79,.12)', color: 'secondary.main' },
    warning: { surface: 'rgba(183,121,31,.12)', color: 'warning.main' },
  };
  const colors = toneMap[tone];
  return <Card className="sa-surface-card sa-interactive-card" elevation={0} sx={{ height: '100%', position: 'relative', overflow: 'hidden', transition: 'border-color .18s ease' }}>
    <Box sx={{ position: 'absolute', width: 122, height: 122, right: -46, top: -50, borderRadius: '50%', bgcolor: colors.surface }} />
    <Box sx={{ position: 'absolute', left: 0, top: 18, bottom: 18, width: 3, borderRadius: '0 99px 99px 0', bgcolor: colors.color }} />
    <CardContent sx={{ p: { xs: 1.8, md: 2.15 }, pl: { xs: 2, md: 2.35 }, '&:last-child': { pb: { xs: 1.8, md: 2.15 } }, position: 'relative' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.25}>
        <Box sx={{ minWidth: 0 }}>
          <Typography color="text.secondary" sx={{ fontSize: 11.3, fontWeight: 780, letterSpacing: '.035em', textTransform: 'uppercase' }}>{label}</Typography>
          <Typography sx={{ mt: .7, fontSize: { xs: 23, lg: 27 }, lineHeight: 1, fontWeight: 900, letterSpacing: '-.055em', whiteSpace: 'nowrap' }}>{value}</Typography>
          {detail && <Typography color="text.secondary" sx={{ mt: .65, fontSize: 11.2 }}>{detail}</Typography>}
        </Box>
        <Box sx={{ width: 42, height: 42, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: colors.surface, color: colors.color, flexShrink: 0, border: '1px solid', borderColor: 'rgba(255,255,255,.62)' }}><Icon fontSize="small" /></Box>
      </Stack>
    </CardContent>
  </Card>;
}

function QuickLinkCard({ label, description, icon: Icon, onClick, tone = 0 }: { label: string; description: string; icon: any; onClick: () => void; tone?: number }) {
  const palettes = [
    { surface: 'rgba(7, 82, 112, .12)', color: '#0B5270' }, { surface: 'rgba(35, 128, 98, .14)', color: '#237A5B' },
    { surface: 'rgba(228, 111, 79, .14)', color: '#C95A3A' }, { surface: 'rgba(183, 121, 31, .14)', color: '#A76B12' },
  ];
  const palette = palettes[tone % palettes.length];
  return <Button
    className="sa-interactive-card"
    variant="outlined"
    fullWidth
    onClick={onClick}
    sx={{
      minHeight: { xs: 148, md: 164 }, p: { xs: 1.55, md: 1.9 }, alignItems: 'stretch', justifyContent: 'flex-start', textAlign: 'center', borderRadius: 3,
      borderColor: 'divider', color: 'text.primary', bgcolor: 'background.paper', position: 'relative', overflow: 'hidden',
      '&:hover': { borderColor: 'primary.main', bgcolor: 'background.paper', transform: 'translateY(-3px)', boxShadow: '0 16px 34px rgba(18,50,57,.10)' },
    }}
  >
    <ArrowOutwardRounded sx={{ position: 'absolute', top: 13, right: 13, fontSize: 17, color: 'text.disabled' }} />
    <Stack alignItems="center" spacing={.8} sx={{ width: '100%', minWidth: 0 }}>
      <Box sx={{ width: { xs: 42, md: 46 }, height: { xs: 42, md: 46 }, display: 'grid', placeItems: 'center', borderRadius: 2.5, bgcolor: palette.surface, color: palette.color }}><Icon sx={{ fontSize: { xs: 23, md: 25 } }} /></Box>
      <Typography sx={{ pr: 1.5, fontSize: { xs: 12.2, md: 13.4 }, fontWeight: 820, lineHeight: 1.25 }}>{label}</Typography>
      <Typography color="text.secondary" sx={{ fontSize: { xs: 10.1, md: 10.8 }, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{description}</Typography>
    </Stack>
  </Button>;
}

function DashboardQuickLinks({ links, navigate }: { links: readonly DashboardQuickLink[]; navigate: (path: string) => void }) {
  return <Paper className="sa-surface-card" elevation={0} sx={{ mt: 2.3, p: { xs: 2, md: 2.5 } }}>
    <Stack alignItems="center" textAlign="center" sx={{ mb: 1.8 }}>
      <Typography className="sa-page-kicker">Quick links</Typography>
      <Typography variant="h6" sx={{ mt: .45 }}>Your workspace shortcuts</Typography>
      <Typography color="text.secondary" sx={{ mt: .3, fontSize: 12.2 }}>Open the task you need in one click.</Typography>
    </Stack>
    <Grid container spacing={{ xs: 1.15, md: 1.7 }}>{links.map(([label, description, path, Icon], index) => <Grid size={{ xs: 6, md: 3 }} key={path}><QuickLinkCard label={label} description={description} icon={Icon} tone={index} onClick={() => navigate(path)} /></Grid>)}</Grid>
  </Paper>;
}

function SurveyorAnalyticsSection({ data, navigate }: { data: any; navigate: (path: string) => void }) {
  const sum = (values: Record<string, number> = {}) => Object.values(values).reduce((total, value) => total + Number(value || 0), 0);
  const projectCount = sum(data?.projects || {});
  const quotationCount = sum(data?.quotations || {});
  const cards = [
    ['Available jobs', data?.jobInvitations || 0, ExploreRounded],
    ['My proposals', quotationCount, RequestQuoteRounded],
    ['Active projects', projectCount, EngineeringRounded],
    ['Completed surveys', Number(data?.projects?.completed || 0), CloudSyncRounded],
  ] as const;
  const links = [
    ['Find survey jobs', 'Discover verified survey opportunities.', '/app/survey-job-marketplace', ExploreRounded],
    ['My proposals', 'Track quotations and client responses.', '/app/survey-quotations', RequestQuoteRounded],
    ['Active projects', 'Continue assigned survey work.', '/app/survey-projects', EngineeringRounded],
    ['Professional profile', 'Keep your public credentials current.', '/app/surveyor-profile', PeopleRounded],
  ] as const;

  return <Box sx={{ mt: 3 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-end' }} gap={1} sx={{ mb: 1.25 }}>
      <Box><Typography className="sa-page-kicker">Surveyor workflow</Typography><Typography variant="h5" sx={{ mt: .35, fontWeight: 900, letterSpacing: '-.035em' }}>Professional survey workspace</Typography><Typography color="text.secondary" sx={{ mt: .3, fontSize: 12.5 }}>Find jobs, submit proposals, then complete navigation, check-in, evidence, reporting, approval and payment inside the hired project.</Typography></Box>
      <Chip size="small" color="success" label={`${data?.subscription?.plan?.name || data?.subscription?.planKey || 'Active plan'} · ${String(data?.subscription?.status || 'active').replaceAll('_', ' ')}`} />
    </Stack>
    <Grid container spacing={1.7}>
      {cards.map(([label, value, Icon], index) => <Grid size={{ xs: 6, md: 3 }} key={label}><MetricCard label={label} value={value} Icon={Icon} tone={index % 4 === 1 ? 'success' : index % 4 === 2 ? 'secondary' : index % 4 === 3 ? 'warning' : 'primary'} /></Grid>)}
    </Grid>
    <DashboardQuickLinks links={links} navigate={navigate} />
    <Paper className="sa-surface-card" elevation={0} sx={{ mt: 2, p: { xs: 2, md: 2.5 } }}><Typography variant="h6">Survey delivery pulse</Typography><Typography color="text.secondary" sx={{ mt: .35, fontSize: 12.5 }}>Keep client work moving through each stage.</Typography><Stack spacing={1.25} sx={{ mt: 2 }}>{Object.entries(data?.projects || {}).slice(0, 4).map(([status, count]: any) => <Stack key={status} direction="row" alignItems="center" gap={1}><Typography sx={{ width: 145, fontSize: 12 }}>{sentence(status)}</Typography><LinearProgress variant="determinate" value={Math.min(100, Number(count || 0) * 14)} sx={{ flex: 1, height: 7, borderRadius: 99 }} /><Typography sx={{ fontWeight: 850, minWidth: 22, textAlign: 'right' }}>{count}</Typography></Stack>)}{!Object.keys(data?.projects || {}).length && <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>No survey projects yet.</Typography>}</Stack><Button fullWidth variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/app/survey-projects')}>Open project pipeline</Button></Paper>
  </Box>;
}

function TenantEssentials({ navigate }: { navigate: (path: string) => void }) {
  const links = [
    ['My property', 'Rented, leased and purchased property in one view.', '/app/my-property', HomeWorkRounded],
    ['My subscription', 'Review subscription history and renew when expiry is near.', '/app/subscription', BusinessRounded],
    ['My applications', 'Track property applications and decisions.', '/app/my-applications', FactCheckRounded],
    ['Security centre', 'Manage your account protection and trusted devices.', '/app/security', FactCheckRounded],
  ] as const;
  return <Paper className="sa-surface-card" elevation={0} sx={{ mt: 2, p: { xs: 2, md: 2.4 } }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.1} sx={{ mb: 1.6 }}><Box><Typography className="sa-page-kicker">Tenant essentials</Typography><Typography variant="h6" sx={{ mt: .45 }}>Keep your personal workspace close</Typography><Typography color="text.secondary" sx={{ mt: .25, fontSize: 12.2 }}>Your property, subscription, applications and secure records stay available alongside subscribed professional tools.</Typography></Box><Chip size="small" label="Tenant tools" variant="outlined" /></Stack>
    <Grid container spacing={1.15}>{links.map(([label, description, path, Icon]) => <Grid size={{ xs: 6, md: 3 }} key={path}><QuickLinkCard label={label} description={description} icon={Icon} onClick={() => navigate(path)} /></Grid>)}</Grid>
  </Paper>;
}

export default function RoleDashboardPage() {
  const { user } = useAuth();
  const realtime = useRealtime();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', user?._id, user?.activeMode, user?.landlordEnabled, user?.surveyorEnabled],
    enabled: Boolean(user?._id),
    staleTime: 30_000,
    queryFn: async () => {
      let landlordEnabled = user?.role === 'landlord' || Boolean(user?.role === 'tenant' && user?.landlordEnabled);
      let surveyorEnabled = user?.role === 'surveyor' || Boolean(user?.role === 'tenant' && user?.surveyorEnabled);
      if (user?.role === 'tenant') {
        const [landlordSubscription, surveyorSubscription] = await Promise.allSettled([getMySubscription(), getMySurveyorSubscription()]);
        const validUntil = (subscription: any) => !subscription?.expiresAt || new Date(subscription.expiresAt).getTime() > Date.now();
        landlordEnabled = landlordSubscription.status === 'fulfilled'
          ? Boolean(landlordSubscription.value.data?.subscription?.status === 'active' && validUntil(landlordSubscription.value.data?.subscription))
          : landlordEnabled;
        const surveyorData = surveyorSubscription.status === 'fulfilled' ? surveyorSubscription.value.data : null;
        const surveyorRecord = surveyorData?.subscription;
        const surveyorStatuses = new Set(['trial', 'active', 'expiring_soon', 'grace_period']);
        surveyorEnabled = surveyorSubscription.status === 'fulfilled'
          ? Boolean((surveyorData?.enabled || surveyorStatuses.has(String(surveyorRecord?.status || ''))) && validUntil(surveyorRecord))
          : surveyorEnabled;
      }
      const [overviewResult, landlordResult, surveyorResult] = await Promise.allSettled([
        getDashboardOverview(),
        landlordEnabled ? getLandlordOverview() : Promise.resolve(null),
        surveyorEnabled ? getSurveyorDashboard() : Promise.resolve(null),
      ]);
      if (overviewResult.status === 'rejected') throw overviewResult.reason;
      const capabilityErrors = [
        landlordEnabled && landlordResult.status === 'rejected' ? 'Landlord analytics could not be loaded.' : '',
        surveyorEnabled && surveyorResult.status === 'rejected' ? 'Surveyor analytics could not be loaded.' : '',
      ].filter(Boolean);
      return {
        data: normaliseDashboardOverview(overviewResult.value.data),
        landlord: landlordResult.status === 'fulfilled' ? safeRecord(landlordResult.value?.data) : null,
        surveyor: surveyorResult.status === 'fulfilled' ? safeRecord(surveyorResult.value?.data) : null,
        tenantCapabilities: { landlord: landlordEnabled, surveyor: surveyorEnabled },
        error: capabilityErrors.join(' '),
      };
    },
  });
  useEffect(() => realtime.subscribe('dashboard:invalidate', () => { void queryClient.invalidateQueries({ queryKey: ['dashboard', user?._id] }); }), [queryClient, realtime.subscribe, user?._id]);

  const data = dashboardQuery.data?.data || null;
  const landlord = dashboardQuery.data?.landlord || null;
  const surveyor = dashboardQuery.data?.surveyor || null;
  const tenantCapabilities = dashboardQuery.data?.tenantCapabilities || { landlord: false, surveyor: false };
  const error = dashboardQuery.error instanceof Error ? dashboardQuery.error.message : dashboardQuery.error ? 'Dashboard data could not be loaded.' : (dashboardQuery.data?.error || '');

  const visible = useMemo(() => baseCards.filter(([key]) => cardsByRole[user?.role || 'user'].includes(key)), [user?.role]);
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const isLandlord = Boolean(user?.role === 'landlord' || (user?.role === 'tenant' && tenantCapabilities.landlord));
  const isSurveyor = Boolean(user?.role === 'surveyor' || (user?.role === 'tenant' && tenantCapabilities.surveyor));
  const isDirectSurveyor = user?.role === 'surveyor';
  const isRegularTenant = user?.role === 'tenant' && !tenantCapabilities.landlord && !tenantCapabilities.surveyor;

  if (!data && !error) return <DashboardSkeleton />;

  if (isDirectSurveyor) return <Suspense fallback={<DashboardSkeleton />}><SurveyorDashboardPage /></Suspense>;

  if (isLandlord && landlord) {
    const usageCards = [
      ['buildings', 'Buildings', BusinessRounded], ['apartments', 'Apartments', ApartmentRounded], ['rooms', 'Rooms', MeetingRoomRounded], ['beds', 'Beds', BedRounded],
    ] as const;
    const businessCards = [
      ['occupiedRooms', 'Occupied', HomeWorkRounded], ['vacantRooms', 'Vacant', MeetingRoomRounded], ['reservedRooms', 'Reserved', ApartmentRounded], ['pendingApplications', 'Applications', FactCheckRounded],
      ['scheduledInterviews', 'Interviews', PeopleRounded], ['scheduledSiteVisits', 'Site visits', CalendarMonthRounded], ['monthlyRentExpected', 'Rent expected', ReceiptLongRounded], ['rentCollected', 'Rent collected', PaymentsRounded], ['pendingRent', 'Pending rent', AccountBalanceWalletRounded], ['overdueRent', 'Overdue rent', BuildRounded],
    ] as const;
    const landlordQuickLinks = [
      ['Property structure', 'Manage buildings, units and rooms.', '/app/property-management', ApartmentRounded],
      ['Applications', 'Review applicant activity and decisions.', '/app/applications', FactCheckRounded],
      ['Site visits', 'Plan and review property visits.', '/app/property-visits', CalendarMonthRounded],
      ['Tenancies', 'Manage active tenancy records.', '/app/tenancies', HomeWorkRounded],
    ] as const;
    const expected = Number(landlord.kpis?.monthlyRentExpected || 0);
    const collected = Number(landlord.kpis?.rentCollected || 0);
    const collectionPercent = expected ? Math.min(100, (collected / expected) * 100) : 0;

    return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
      <PageHeader
        variant="plain"
        eyebrow={isSurveyor ? 'Tenant workspace · Landlord + Surveyor' : 'Landlord workspace'}
        title={`${greeting}, ${user?.name?.split(' ')[0] || 'there'}`}
        description={isSurveyor ? 'Landlord operations and survey delivery are combined here while your account remains a tenant account.' : 'A calm, complete view of your portfolio, tenant journey and collection health.'}
        meta={<Stack direction="row" gap={.7} flexWrap="wrap" useFlexGap><Chip size="small" color="success" label="Landlord plan active" />{isSurveyor && <Chip size="small" color="secondary" label="Surveyor plan active" />}</Stack>}
        actions={<>{user?.role === 'tenant' && <Button variant="outlined" onClick={() => navigate('/app/subscription')}>Landlord plan</Button>}{user?.role === 'tenant' && isSurveyor && <Button variant="outlined" onClick={() => navigate('/app/surveyor-subscription')}>Surveyor plan</Button>}<Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/app/add_property')}>Add property</Button></>}
      />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Typography className="sa-page-kicker" sx={{ mb: 1 }}>Subscription capacity</Typography>
      <Grid container spacing={1.7} mb={3}>
        {usageCards.map(([key, label, Icon], index) => {
          const used = Number(landlord.usage?.[key] || 0);
          const limit = Number(landlord.limits?.[key] || 0);
          const unlimited = limit >= 999999;
          return <Grid size={{ xs: 6, md: 3 }} key={key}><Card className="sa-surface-card" elevation={0} sx={{ height: '100%' }}><CardContent sx={{ p: 2.1, '&:last-child': { pb: 2.1 } }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box><Typography color="text.secondary" sx={{ fontSize: 11.2, fontWeight: 780, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</Typography><Typography sx={{ fontSize: 26, lineHeight: 1.1, fontWeight: 900, letterSpacing: '-.05em', mt: .5 }}>{used}<Typography component="span" color="text.secondary" sx={{ fontSize: 12, fontWeight: 650 }}> / {unlimited ? '∞' : limit}</Typography></Typography></Box><Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 2.5, bgcolor: index % 2 ? 'rgba(35,128,98,.10)' : 'rgba(7,63,86,.10)', color: index % 2 ? 'success.main' : 'primary.main' }}><Icon fontSize="small" /></Box></Stack>{!unlimited && <LinearProgress variant="determinate" value={limit ? Math.min(100, (used / limit) * 100) : 0} sx={{ mt: 1.55, height: 6 }} />}<Typography color="text.secondary" sx={{ mt: 1, fontSize: 11 }}>{unlimited ? 'No plan limit' : `${Math.max(Number(landlord.remaining?.[key] || 0), 0)} remaining`}</Typography></CardContent></Card></Grid>;
        })}
      </Grid>
      <Typography className="sa-page-kicker" sx={{ mb: 1 }}>Business pulse</Typography>
      <Grid container spacing={1.7}>
        {businessCards.map(([key, label, Icon], index) => {
          const raw = landlord.kpis?.[key] || 0;
          const value = ['monthlyRentExpected', 'rentCollected', 'pendingRent', 'overdueRent'].includes(key) ? money(Number(raw)) : raw;
          return <Grid size={{ xs: 6, md: 3 }} key={key}><MetricCard label={label} value={value} Icon={Icon} tone={index % 4 === 1 ? 'success' : index % 4 === 2 ? 'secondary' : index % 4 === 3 ? 'warning' : 'primary'} /></Grid>;
        })}
      </Grid>
      <DashboardQuickLinks links={landlordQuickLinks} navigate={navigate} />
      <Paper className="sa-surface-card" elevation={0} sx={{ mt: 2, p: { xs: 2, md: 2.5 } }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box><Typography variant="h6">Collection health</Typography><Typography color="text.secondary" sx={{ mt: .35, fontSize: 12.5 }}>This month’s payment progress</Typography></Box><TrendingUpRounded color="success" /></Stack><Typography sx={{ mt: 2.5, fontSize: 28, fontWeight: 900, letterSpacing: '-.05em' }}>{money(collected)}</Typography><Typography color="text.secondary" sx={{ fontSize: 12 }}>{money(Math.max(expected - collected, 0))} still to collect</Typography><LinearProgress variant="determinate" value={collectionPercent} sx={{ mt: 1.6, height: 9 }} /><Stack direction="row" justifyContent="space-between" sx={{ mt: .8 }}><Typography color="text.secondary" sx={{ fontSize: 11.5 }}>{Math.round(collectionPercent)}% collected</Typography><Typography sx={{ fontSize: 11.5, fontWeight: 800 }}>{money(expected)} expected</Typography></Stack></Paper>
      {user?.role === 'tenant' && <TenantEssentials navigate={navigate} />}
      {isSurveyor && surveyor && <SurveyorAnalyticsSection data={surveyor} navigate={navigate} />}
    </Box>;
  }

  if (user?.role === 'tenant' && isSurveyor && surveyor) {
    return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
      <PageHeader
        variant="plain"
        eyebrow="Tenant workspace · Surveyor"
        title={`${greeting}, ${user?.name?.split(' ')[0] || 'there'}`}
        description="Your surveyor subscription adds professional fieldwork, quotation, reporting and earnings tools to the same tenant workspace."
        meta={<Stack direction="row" gap={.7} flexWrap="wrap" useFlexGap><Chip size="small" color="secondary" label="Surveyor plan active" /><Chip size="small" color="success" label="Tenant account retained" /></Stack>}
        actions={<><Button variant="outlined" onClick={() => navigate('/app/surveyor-subscription')}>Manage surveyor plan</Button><Button variant="contained" startIcon={<ExploreRounded />} onClick={() => navigate('/app/survey-job-marketplace')}>Find jobs</Button></>}
      />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <SurveyorAnalyticsSection data={surveyor} navigate={navigate} />
      <TenantEssentials navigate={navigate} />
    </Box>;
  }

  const tenantQuickLinks: readonly DashboardQuickLink[] = [
    ['My subscription', 'Review subscription history and renew when expiry is near.', '/app/subscription', BusinessRounded],
    ['My applications', 'Track every property application and its current status.', '/app/my-applications', FactCheckRounded],
    ['My property', 'Open your private rented, leased and purchased records.', '/app/my-property', HomeWorkRounded],
    ['Security centre', 'Manage account protection and trusted devices.', '/app/security', FactCheckRounded],
  ] as const;
  const quickLinks: readonly DashboardQuickLink[] = isDirectSurveyor
    ? [['Find survey jobs', 'Discover verified survey opportunities.', '/app/survey-job-marketplace', ExploreRounded], ['My proposals', 'Track every quotation you have submitted.', '/app/survey-quotations', RequestQuoteRounded], ['Active projects', 'Continue your assigned survey work.', '/app/survey-projects', EngineeringRounded], ['Professional profile', 'Update your public surveyor profile.', '/app/surveyor-profile', PeopleRounded]]
    : user?.role === 'tenant'
      ? [['Browse properties', 'Find a home, room or workspace.', '/marketplace', ExploreRounded], ['My applications', 'Track property application decisions.', '/app/my-applications', FactCheckRounded], ['My subscription', 'Review and renew your plan.', '/app/subscription', BusinessRounded], ['My property', 'Open your private property records.', '/app/my-property', HomeWorkRounded]]
      : user?.role === 'user'
        ? [['Browse properties', 'Explore verified public listings.', '/marketplace', ExploreRounded], ['My applications', 'Track submitted applications.', '/app/my-applications', FactCheckRounded], ['My subscription', 'Review subscription details.', '/app/subscription', BusinessRounded], ['Help centre', 'Open support and account guidance.', '/app/security', FactCheckRounded]]
      : [['Manage properties', 'Open your property operations.', '/app/properties', ApartmentRounded], ['Review applications', 'Review applicant activity.', '/app/applications', FactCheckRounded], ['View payments', 'Open payment operations.', '/app/payments', PaymentsRounded], ['Analytics', 'Review operational performance.', '/app/reports', TrendingUpRounded]];

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5.5 }}>
    <PageHeader
      variant="plain"
      eyebrow={isDirectSurveyor ? 'Field operations' : isRegularTenant ? 'Tenant workspace' : user?.role === 'tenant' ? 'Your home workspace' : 'Operations overview'}
      title={`${greeting}, ${user?.name?.split(' ')[0] || 'there'}`}
      description={isRegularTenant ? 'A clear view of your property, subscription, applications and secure records.' : user?.role === 'tenant' ? 'Everything related to your home, subscription, applications and support in one focused place.' : 'Here is the clearest view of what needs your attention today.'}
      meta={<Stack direction="row" gap={.7} flexWrap="wrap" useFlexGap><Chip size="small" label={user?.role === 'tenant' ? `Tenant${tenantCapabilities.landlord ? ' · Landlord features' : ''}${tenantCapabilities.surveyor ? ' · Surveyor features' : ''}` : `${user?.role || 'member'} workspace`} variant="outlined" /><Chip size="small" color="success" label="Live updates on" /></Stack>}
      actions={isRegularTenant ? <Button variant="contained" startIcon={<BusinessRounded />} onClick={() => navigate('/app/subscription')}>My subscription</Button> : user?.role === 'tenant' || user?.role === 'user' ? <Button variant="contained" startIcon={<ExploreRounded />} onClick={() => navigate('/marketplace')}>Browse properties</Button> : <Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/app/add_property')}>Add property</Button>}
    />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Grid container spacing={1.7}>
      {visible.map(([key, label, Icon], index) => {
        const raw = data?.kpis[key as keyof DashboardOverview['kpis']] || 0;
        const value = ['monthlyRentCollection', 'outstandingDues'].includes(key) ? money(Number(raw)) : raw;
        const tone = index % 4 === 1 ? 'success' : index % 4 === 2 ? 'secondary' : index % 4 === 3 ? 'warning' : 'primary';
        return <Grid size={{ xs: 6, md: 3 }} key={key}><MetricCard label={label} value={value} Icon={Icon} tone={tone} /></Grid>;
      })}
      {isDirectSurveyor && <><Grid size={{ xs: 6, md: 3 }}><MetricCard label="Today’s assignments" value={data?.todayAssignments || 0} Icon={RouteRounded} tone="success" /></Grid><Grid size={{ xs: 6, md: 3 }}><MetricCard label="Approved surveys" value={data?.completedSurveys || 0} Icon={CloudSyncRounded} tone="secondary" /></Grid></>}
    </Grid>
    <DashboardQuickLinks links={isRegularTenant ? tenantQuickLinks : quickLinks} navigate={navigate} />
    {data && <Suspense fallback={<ChartSkeleton />}><DashboardCharts data={data} /></Suspense>}
    <Paper className="sa-surface-card" elevation={0} sx={{ mt: 2, p: { xs: 2, md: 2.5 } }}><Typography variant="h6">Recent activity</Typography><Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />} sx={{ mt: 1.1 }}>{(data?.recentActivities || []).slice(0, 4).map((activity: any) => <Stack key={activity._id} direction="row" justifyContent="space-between" gap={1.5} sx={{ py: 1.1 }}><Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontSize: 12.5, fontWeight: 760 }}>{sentence(activity.action || 'Activity')} · {sentence(activity.module || 'system')}</Typography><Typography color="text.secondary" sx={{ mt: .2, fontSize: 10.8 }}>{activity.user?.name || user?.name}</Typography></Box><Typography color="text.secondary" sx={{ flexShrink: 0, fontSize: 10.4 }}>{new Date(activity.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Typography></Stack>)}</Stack>{!data?.recentActivities?.length && <Typography color="text.secondary" sx={{ py: 2, fontSize: 12.5 }}>No recent activity yet.</Typography>}</Paper>
  </Box>;
}
