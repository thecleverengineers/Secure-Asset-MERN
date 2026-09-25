import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Grid, LinearProgress, Snackbar, Stack,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import AutorenewRounded from '@mui/icons-material/AutorenewRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import BusinessRounded from '@mui/icons-material/BusinessRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import EngineeringRounded from '@mui/icons-material/EngineeringRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import StorageRounded from '@mui/icons-material/StorageRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import {
  cancelLandlordSubscription, cancelSurveyorSubscription, changeSurveyorPlan, getMySubscription,
  getMySubscriptionHistory, getMySurveyorSubscription, getSubscriptionPlans, getSurveyorPlans,
  renewSurveyorSubscription,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useActionDialog } from '../../components/shared/useActionDialog';
import PageHeader from '../../components/layout/PageHeader';
import '../../../styles/subscription-premium.css';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const sentence = (value: string) => String(value || '').split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const formatDate = (value: string | Date | undefined) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const landlordRenewalDue = (subscription: any) => ['expired', 'expiring_soon'].includes(String(subscription?.renewalState || subscription?.status || '').toLowerCase());
const surveyorActiveStatuses = ['trial', 'active', 'expiring_soon', 'grace_period'];

type Workspace = 'landlord' | 'surveyor';

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const actions = useActionDialog();
  const [workspace, setWorkspace] = useState<Workspace>('landlord');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [landlordPlans, setLandlordPlans] = useState<any[]>([]);
  const [landlordState, setLandlordState] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [surveyorPlans, setSurveyorPlans] = useState<any[]>([]);
  const [surveyorState, setSurveyorState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const responses = await Promise.all([
        getSubscriptionPlans(),
        getMySubscription(),
        getMySubscriptionHistory(),
        getSurveyorPlans(),
        getMySurveyorSubscription(),
      ]);
      setLandlordPlans(responses[0].data || []);
      setLandlordState(responses[1].data);
      setHistory(responses[2].data || []);
      setSurveyorPlans(responses[3].data || []);
      setSurveyorState(responses[4].data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const landlordSubscription = landlordState?.subscription ?? (landlordState?._id ? landlordState : null);
  const surveyorSubscription = surveyorState?.subscription || null;
  const surveyorEnabled = Boolean(surveyorState?.enabled);
  const surveyorActive = Boolean(surveyorSubscription && surveyorActiveStatuses.includes(String(surveyorSubscription.status || '').toLowerCase()));

  const landlordUsageEntries = useMemo(() => [
    ['buildings', 'Buildings', BusinessRounded],
    ['apartments', 'Apartments', ApartmentRounded],
    ['rooms', 'Rooms', MeetingRoomRounded],
    ['beds', 'Beds', BedRounded],
    ['publicListings', 'Public listings', CheckCircleRounded],
    ['storageMB', 'Storage MB', StorageRounded],
  ] as const, []);

  function chooseLandlordPlan(plan: string) {
    const params = new URLSearchParams({ type: 'landlord', plan, cycle });
    navigate('/app/subscription-payment?' + params.toString());
  }

  function renewLandlord(record: any) {
    if (!record?._id) return;
    const params = new URLSearchParams({
      type: 'landlord',
      plan: String(record.plan || ''),
      cycle: record.billingCycle === 'yearly' ? 'yearly' : 'monthly',
      renewal: String(record._id),
    });
    navigate('/app/subscription-payment?' + params.toString());
  }

  function chooseSurveyorPlan(plan: any) {
    const params = new URLSearchParams({ type: 'surveyor', plan: String(plan.key || ''), cycle, autoRenew: 'true' });
    navigate('/app/subscription-payment?' + params.toString());
  }

  async function cancelLandlord() {
    if (!landlordSubscription?._id) return;
    const confirmed = await actions.askConfirmation(
      'Cancel the subscription? Existing property data will remain saved, but public listings will be paused after expiry.',
      { title: 'Cancel landlord subscription', danger: true },
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await cancelLandlordSubscription(landlordSubscription._id);
      await refreshUser();
      await load();
      setNotice('Landlord subscription updated.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changeSurveyor(plan: any) {
    setBusy(true);
    try {
      const result = await changeSurveyorPlan(plan.key);
      setNotice(result.message || 'Surveyor plan change requested.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function renewSurveyor() {
    setBusy(true);
    try {
      const result = await renewSurveyorSubscription({ autoRenew: true });
      await refreshUser();
      setNotice(result.message || 'Surveyor renewal payment submitted for verification.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelSurveyor(immediate = false) {
    if (!surveyorSubscription?._id) return;
    const confirmed = await actions.askConfirmation(
      immediate ? 'Cancel immediately and pause public Surveyor listings?' : 'Turn off renewal at the end of this billing period?',
      { title: immediate ? 'Cancel surveyor subscription' : 'Stop automatic renewal', danger: immediate },
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await cancelSurveyorSubscription(surveyorSubscription._id, immediate);
      await refreshUser();
      await load();
      setNotice('Surveyor subscription updated.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Box className="sa-subscription-premium sa-subscription-loading"><CircularProgress /></Box>;

  return <Box className="sa-subscription-premium" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
    <PageHeader
      variant="plain"
      eyebrow="SecureAsset membership"
      title="Subscription"
      description="Manage Landlord and Surveyor plans from one secure subscription workspace."
      meta={<Stack direction="row" gap={.7} flexWrap="wrap" useFlexGap>
        <Chip size="small" variant="outlined" label={landlordSubscription?.status === 'active' ? 'Landlord active' : 'Landlord plans'} />
        <Chip size="small" variant="outlined" label={surveyorEnabled ? 'Surveyor active' : 'Surveyor plans'} />
      </Stack>}
      actions={<ToggleButtonGroup className="sa-subscription-cycle" exclusive size="small" value={cycle} onChange={(_, value) => value && setCycle(value)}>
        <ToggleButton value="monthly">Monthly</ToggleButton>
        <ToggleButton value="yearly">Yearly</ToggleButton>
      </ToggleButtonGroup>}
    />

    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

    <Box className="sa-subscription-workspace-switch" role="tablist" aria-label="Subscription plan type">
      <Button role="tab" aria-selected={workspace === 'landlord'} className="sa-subscription-workspace-card" onClick={() => setWorkspace('landlord')}>
        <Box className="sa-subscription-workspace-icon"><ApartmentRounded /></Box>
        <Box className="sa-subscription-workspace-copy">
          <Typography className="sa-subscription-workspace-title">Landlord Plans</Typography>
          <Typography className="sa-subscription-workspace-caption">Property, tenant, rent and agreement management.</Typography>
        </Box>
        <Chip size="small" className="sa-subscription-workspace-status" label={landlordSubscription?.status === 'active' ? 'Active' : 'View plans'} color={landlordSubscription?.status === 'active' ? 'success' : 'default'} />
      </Button>
      <Button role="tab" aria-selected={workspace === 'surveyor'} className="sa-subscription-workspace-card" onClick={() => setWorkspace('surveyor')}>
        <Box className="sa-subscription-workspace-icon surveyor"><EngineeringRounded /></Box>
        <Box className="sa-subscription-workspace-copy">
          <Typography className="sa-subscription-workspace-title">Surveyor Plans</Typography>
          <Typography className="sa-subscription-workspace-caption">Survey jobs, proposals, reports and professional tools.</Typography>
        </Box>
        <Chip size="small" className="sa-subscription-workspace-status" label={surveyorEnabled ? 'Active' : 'View plans'} color={surveyorEnabled ? 'success' : 'default'} />
      </Button>
    </Box>

    {workspace === 'landlord' ? <>
      {landlordSubscription && <Card className="sa-subscription-current-card" elevation={0}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
            <Box>
              <Typography className="sa-subscription-section-kicker">Current landlord subscription</Typography>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ mt: .5 }}>
                <Typography className="sa-subscription-current-title">{sentence(landlordSubscription.plan)} plan</Typography>
                <Chip size="small" color={landlordSubscription.renewalState === 'expired' ? 'error' : landlordSubscription.renewalState === 'expiring_soon' ? 'warning' : landlordSubscription.status === 'active' ? 'success' : 'default'} label={sentence(landlordSubscription.renewalState || landlordSubscription.status)} />
              </Stack>
              <Typography className="sa-subscription-current-meta">
                {landlordSubscription.expiresAt ? (landlordSubscription.renewalState === 'expired' ? 'Expired' : 'Valid') + ' until ' + formatDate(landlordSubscription.expiresAt) : 'Activation pending'}
              </Typography>
              {Number.isFinite(Number(landlordSubscription.daysRemaining)) && landlordSubscription.renewalState !== 'expired' && <Typography className="sa-subscription-days">
                {String(landlordSubscription.daysRemaining) + ' day' + (landlordSubscription.daysRemaining === 1 ? '' : 's') + ' remaining'}
              </Typography>}
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {landlordRenewalDue(landlordSubscription) && <Button variant="contained" startIcon={<AutorenewRounded />} disabled={busy} onClick={() => renewLandlord(landlordSubscription)}>
                {landlordSubscription.renewalState === 'expired' ? 'Renew subscription' : 'Renew before expiry'}
              </Button>}
              {landlordSubscription.status === 'active' && <Button color="error" variant="outlined" disabled={busy} onClick={cancelLandlord}>Cancel renewal</Button>}
            </Stack>
          </Stack>
          <Grid container spacing={1.2} sx={{ mt: 1.4 }}>
            {landlordUsageEntries.map(([key, label, Icon]) => {
              const used = Number(landlordState?.usage?.[key] || 0);
              const limit = Number(landlordState?.limits?.[key] || landlordSubscription?.limits?.[key] || 0);
              const unlimited = limit >= 999999;
              return <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={key}>
                <Box className="sa-subscription-usage">
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Stack direction="row" gap={.8} alignItems="center"><Icon fontSize="small" /><Typography>{label}</Typography></Stack>
                    <Typography>{String(used) + ' / ' + (unlimited ? '∞' : String(limit))}</Typography>
                  </Stack>
                  {!unlimited && <LinearProgress variant="determinate" value={limit ? Math.min(100, used / limit * 100) : 0} />}
                </Box>
              </Grid>;
            })}
          </Grid>
        </CardContent>
      </Card>}

      <Box className="sa-subscription-section-heading">
        <Box>
          <Typography>Landlord plans</Typography>
          <Typography>Choose a plan for your property portfolio, tenant workflows and rental operations.</Typography>
        </Box>
        <Chip size="small" label={cycle === 'monthly' ? 'Monthly billing' : 'Yearly billing'} variant="outlined" />
      </Box>

      <Grid container spacing={1.6} className="sa-subscription-plan-grid">
        {landlordPlans.map((plan) => {
          const currentPlan = landlordSubscription?.status === 'active' && landlordSubscription.plan === plan.key;
          const price = Number(plan.prices?.[cycle] || 0);
          const landlordLimits = [
            ['Buildings', plan.limits?.buildings],
            ['Apartments', plan.limits?.apartments],
            ['Rooms', plan.limits?.rooms],
            ['Beds', plan.limits?.beds],
            ['Public listings', plan.limits?.publicListings],
            ['Active tenants', plan.limits?.activeTenants],
            ['Team members', plan.limits?.teamMembers],
            ['Storage', String(Math.round(Number(plan.limits?.storageMB || 0) / 1024)) + ' GB'],
          ];
          return <Grid size={{ xs: 12, md: 6, xl: 3 }} key={plan.key}>
            <Card className="sa-subscription-plan-card" data-current={currentPlan ? 'true' : 'false'} elevation={0}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box>
                    <Typography className="sa-subscription-plan-name">{plan.name}</Typography>
                    <Typography className="sa-subscription-plan-description">{plan.description}</Typography>
                  </Box>
                  {plan.featured && <Chip size="small" label="Recommended" color="primary" />}
                </Stack>
                <Box className="sa-subscription-price">
                  <Typography>{price ? money(price) : 'Custom'}</Typography>
                  {price > 0 && <Typography component="span">{cycle === 'monthly' ? '/mo' : '/yr'}</Typography>}
                </Box>
                <Divider />
                <Stack className="sa-subscription-feature-list">
                  {landlordLimits.map(([label, value]) => <Stack key={String(label)} direction="row" justifyContent="space-between" gap={1}>
                    <Typography>{label}</Typography>
                    <Typography>{Number(value) >= 999999 ? 'Unlimited' : value}</Typography>
                  </Stack>)}
                </Stack>
                <Stack direction="row" gap={.55} flexWrap="wrap" useFlexGap className="sa-subscription-feature-chips">
                  {Object.entries(plan.features || {}).filter(([, enabled]) => enabled).map(([feature]) => <Chip key={feature} size="small" label={sentence(feature)} variant="outlined" />)}
                </Stack>
                <Button fullWidth variant={currentPlan ? 'outlined' : 'contained'} disabled={currentPlan || plan.key === 'enterprise'} onClick={() => chooseLandlordPlan(plan.key)}>
                  {currentPlan ? 'Current plan' : plan.key === 'enterprise' ? 'Contact sales' : 'Choose plan and pay'}
                </Button>
              </CardContent>
            </Card>
          </Grid>;
        })}
      </Grid>

      <Card className="sa-subscription-history-card" elevation={0} data-secureasset-subscription-history="tenant-subscription-history-v84">
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box className="sa-subscription-history-icon"><HistoryRounded /></Box>
              <Box>
                <Typography className="sa-subscription-history-title">Landlord subscription history</Typography>
                <Typography className="sa-subscription-history-caption">Your subscription records and renewal payments.</Typography>
              </Box>
            </Stack>
            <Chip size="small" label={String(history.length) + ' record' + (history.length === 1 ? '' : 's')} variant="outlined" />
          </Stack>
          <Divider sx={{ my: 1.6 }} />
          {history.length ? <Stack spacing={.9}>
            {history.map((record) => <Box key={record._id} className="sa-subscription-history-record">
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                <Box>
                  <Stack direction="row" spacing={.7} alignItems="center" flexWrap="wrap">
                    <Typography>{sentence(record.plan)} plan</Typography>
                    <Chip size="small" label={sentence(record.renewalState || record.status)} color={record.renewalState === 'expired' ? 'error' : record.renewalState === 'expiring_soon' ? 'warning' : record.status === 'active' ? 'success' : 'default'} />
                  </Stack>
                  <Typography>{'Started ' + formatDate(record.startsAt || record.createdAt) + ' · ' + (record.expiresAt ? 'Expires ' + formatDate(record.expiresAt) : 'Awaiting activation')}</Typography>
                </Box>
                {landlordRenewalDue(record) && <Button size="small" variant="outlined" startIcon={<AutorenewRounded />} onClick={() => renewLandlord(record)}>Renew</Button>}
              </Stack>
            </Box>)}
          </Stack> : <Alert severity="info">You do not have any Landlord subscription history yet.</Alert>}
        </CardContent>
      </Card>
    </> : <>
      {surveyorSubscription && <Card className="sa-subscription-current-card surveyor" elevation={0}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
            <Box>
              <Typography className="sa-subscription-section-kicker">Current surveyor subscription</Typography>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ mt: .5 }}>
                <Typography className="sa-subscription-current-title">{surveyorSubscription.plan?.name || sentence(surveyorSubscription.planKey)}</Typography>
                <Chip size="small" label={sentence(surveyorSubscription.status)} color={surveyorActive ? 'success' : 'warning'} />
              </Stack>
              <Typography className="sa-subscription-current-meta">
                {'Valid until ' + formatDate(surveyorSubscription.expiresAt) + ' · ' + sentence(surveyorSubscription.billingCycle) + ' billing'}
              </Typography>
              <Typography className="sa-subscription-days">{'Auto-renewal: ' + (surveyorSubscription.autoRenew ? 'On' : 'Off')}</Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
              {surveyorEnabled && <Button variant="contained" startIcon={<WorkspacePremiumRounded />} onClick={() => navigate('/app/surveyor-dashboard')}>Open Surveyor features</Button>}
              <Button variant="outlined" disabled={busy} onClick={renewSurveyor}>Renew</Button>
              <Button variant="outlined" color="warning" disabled={busy} onClick={() => cancelSurveyor(false)}>Stop renewal</Button>
              <Button variant="text" color="error" disabled={busy} onClick={() => cancelSurveyor(true)}>Cancel now</Button>
            </Stack>
          </Stack>
          {surveyorState?.usage && <Grid container spacing={1.2} sx={{ mt: 1.4 }}>
            {Object.entries(surveyorState.usage.limits || {}).map(([key, rawLimit]: any) => {
              const usageKey = key === 'jobsPerMonth' ? 'jobs' : key === 'quotationsPerMonth' ? 'quotations' : key === 'reportsPerMonth' ? 'reports' : key === 'storageMb' ? 'storageBytes' : key;
              const limit = key === 'storageMb' ? Number(rawLimit || 0) * 1024 * 1024 : Number(rawLimit || 0);
              const used = Number(surveyorState.usage.used?.[usageKey] || 0);
              const percent = limit < 0 ? 0 : Math.min(100, limit ? used / limit * 100 : 100);
              const shownUsed = key === 'storageMb' ? String(Math.round(used / 1024 / 1024)) + ' MB' : String(used);
              const shownLimit = key === 'storageMb' ? String(rawLimit) + ' MB' : limit < 0 ? 'Unlimited' : String(limit);
              return <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={key}>
                <Box className="sa-subscription-usage">
                  <Stack direction="row" justifyContent="space-between" gap={1}><Typography>{sentence(key)}</Typography><Typography>{shownUsed + ' / ' + shownLimit}</Typography></Stack>
                  <LinearProgress variant="determinate" value={percent} />
                </Box>
              </Grid>;
            })}
          </Grid>}
        </CardContent>
      </Card>}

      <Box className="sa-subscription-section-heading">
        <Box>
          <Typography>Surveyor plans</Typography>
          <Typography>Professional tools for survey jobs, quotations, reports, mapping and client work.</Typography>
        </Box>
        <Chip size="small" label={cycle === 'monthly' ? 'Monthly billing' : 'Yearly billing'} variant="outlined" />
      </Box>

      <Grid container spacing={1.6} className="sa-subscription-plan-grid">
        {surveyorPlans.map((plan) => {
          const currentPlan = surveyorActive && surveyorSubscription?.planKey === plan.key;
          const price = Number(plan.prices?.[cycle] || 0);
          const features = [
            String(plan.limits?.publicServices ?? 0) + ' public services',
            String(plan.limits?.jobsPerMonth ?? 0) + ' jobs/month',
            String(plan.limits?.quotationsPerMonth ?? 0) + ' quotations/month',
            String(plan.limits?.teamMembers ?? 0) + ' team members',
            String(plan.limits?.reportsPerMonth ?? 0) + ' reports/month',
            String(plan.limits?.storageMb ?? 0) + ' MB storage',
            plan.features?.advancedMapping ? 'Advanced mapping & GIS' : 'Standard mapping',
            plan.features?.analytics ? 'Professional analytics' : 'Basic analytics',
            sentence(plan.supportLevel) + ' support',
          ];
          return <Grid size={{ xs: 12, md: 6, lg: 4 }} key={plan.key}>
            <Card className="sa-subscription-plan-card surveyor" data-current={currentPlan ? 'true' : 'false'} elevation={0}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box>
                    <Typography className="sa-subscription-plan-name">{plan.name}</Typography>
                    <Typography className="sa-subscription-plan-description">{plan.description}</Typography>
                  </Box>
                  {currentPlan && <Chip size="small" label="Current plan" color="primary" />}
                </Stack>
                <Box className="sa-subscription-price">
                  <Typography>{money(price)}</Typography>
                  <Typography component="span">{cycle === 'monthly' ? '/mo' : '/yr'}</Typography>
                </Box>
                <Divider />
                <Stack className="sa-subscription-check-list">
                  {features.map((line) => <Stack direction="row" spacing={.8} key={line}><CheckCircleRounded /><Typography>{line}</Typography></Stack>)}
                </Stack>
                <Button fullWidth variant={currentPlan ? 'outlined' : 'contained'} disabled={busy || currentPlan} onClick={() => surveyorActive ? changeSurveyor(plan) : chooseSurveyorPlan(plan)}>
                  {currentPlan ? 'Current plan' : surveyorActive ? 'Change plan' : 'Choose plan and pay'}
                </Button>
              </CardContent>
            </Card>
          </Grid>;
        })}
      </Grid>
    </>}

    <Alert severity="info" className="sa-subscription-payment-note">
      A selected plan becomes active only after Razorpay verification succeeds or an administrator approves the submitted UPI transaction and payment proof.
    </Alert>
    {actions.dialogs}
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
  </Box>;
}
