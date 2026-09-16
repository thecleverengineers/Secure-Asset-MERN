import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Grid, LinearProgress, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import AutorenewRounded from '@mui/icons-material/AutorenewRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import BusinessRounded from '@mui/icons-material/BusinessRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import StorageRounded from '@mui/icons-material/StorageRounded';
import { cancelLandlordSubscription, getMySubscription, getMySubscriptionHistory, getSubscriptionPlans } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useActionDialog } from '../../components/shared/useActionDialog';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const sentence = (value: string) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value: string | Date | undefined) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const isRenewalDue = (subscription: any) => ['expired', 'expiring_soon'].includes(String(subscription?.renewalState || subscription?.status || '').toLowerCase());

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const actions = useActionDialog();
  const [plans, setPlans] = useState<any[]>([]);
  const [state, setState] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [plansResponse, subscriptionResponse, historyResponse] = await Promise.all([getSubscriptionPlans(), getMySubscription(), getMySubscriptionHistory()]);
      setPlans(plansResponse.data || []); setState(subscriptionResponse.data); setHistory(historyResponse.data || []);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const subscription = state?.subscription || state;
  const choosePlan = (plan: string) => {
    const params = new URLSearchParams({ type: 'landlord', plan, cycle });
    navigate(`/app/subscription-payment?${params.toString()}`);
  };

  const renew = (record: any) => {
    if (!record?._id) return;
    const params = new URLSearchParams({
      type: 'landlord', plan: String(record.plan || ''), cycle: record.billingCycle === 'yearly' ? 'yearly' : 'monthly', renewal: String(record._id),
    });
    navigate(`/app/subscription-payment?${params.toString()}`);
  };

  async function cancel() {
    if (!subscription?._id) return;
    if (!await actions.askConfirmation('Cancel the subscription? Existing property data will remain saved, but public listings will be paused after expiry.', { title: 'Cancel landlord subscription', danger: true })) return;
    try { await cancelLandlordSubscription(subscription._id); await refreshUser(); await load(); }
    catch (e) { setError((e as Error).message); }
  }

  const usageEntries = useMemo(() => [
    ['buildings', 'Buildings', BusinessRounded], ['apartments', 'Apartments', ApartmentRounded], ['rooms', 'Rooms', MeetingRoomRounded],
    ['beds', 'Beds', BedRounded], ['publicListings', 'Public listings', CheckCircleRounded], ['storageMB', 'Storage MB', StorageRounded],
  ] as const, []);

  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', p: 8 }}><CircularProgress /></Box>;

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
    <CompactPageToolbar
      marker="subscription-toolbar-v153"
      title="My subscription"
      description="Your tenant-owned Landlord subscription, renewal status and full payment history."
      actions={<ToggleButtonGroup exclusive size="small" value={cycle} onChange={(_, value) => value && setCycle(value)}><ToggleButton value="monthly">Monthly</ToggleButton><ToggleButton value="yearly">Yearly</ToggleButton></ToggleButtonGroup>}
    />
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    {subscription && <Card variant="outlined" sx={{ borderRadius: 4, mb: 3 }}><CardContent><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}><Box><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="h6" fontWeight={900}>{sentence(subscription.plan)} plan</Typography><Chip color={subscription.renewalState === 'expired' ? 'error' : subscription.renewalState === 'expiring_soon' ? 'warning' : subscription.status === 'active' ? 'success' : 'default'} label={sentence(subscription.renewalState || subscription.status)} /></Stack><Typography color="text.secondary" fontSize={13} mt={.5}>{subscription.expiresAt ? `${subscription.renewalState === 'expired' ? 'Expired' : 'Valid'} until ${formatDate(subscription.expiresAt)}` : 'Activation pending'}</Typography>{Number.isFinite(Number(subscription.daysRemaining)) && subscription.renewalState !== 'expired' && <Typography color={subscription.renewalState === 'expiring_soon' ? 'warning.main' : 'text.secondary'} fontSize={12} mt={.35}>{subscription.daysRemaining} day{subscription.daysRemaining === 1 ? '' : 's'} remaining</Typography>}</Box><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>{isRenewalDue(subscription) && <Button variant="contained" startIcon={<AutorenewRounded />} onClick={() => renew(subscription)}>{subscription.renewalState === 'expired' ? 'Renew subscription' : 'Renew before expiry'}</Button>}{subscription.status === 'active' && <Button color="error" variant="outlined" onClick={cancel}>Cancel renewal</Button>}</Stack></Stack>
      <Grid container spacing={1.5} mt={2}>{usageEntries.map(([key, label, Icon]) => { const used = Number(state?.usage?.[key] || 0); const limit = Number(state?.limits?.[key] || subscription?.limits?.[key] || 0); const unlimited = limit >= 999999; return <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={key}><Box sx={{ p: 1.7, bgcolor: 'action.hover', borderRadius: 3 }}><Stack direction="row" justifyContent="space-between"><Stack direction="row" gap={1}><Icon fontSize="small" color="primary" /><Typography fontWeight={750} fontSize={13}>{label}</Typography></Stack><Typography fontWeight={850} fontSize={13}>{used} / {unlimited ? '∞' : limit}</Typography></Stack>{!unlimited && <LinearProgress variant="determinate" value={limit ? Math.min(100, used / limit * 100) : 0} sx={{ mt: 1, height: 6, borderRadius: 9 }} />}</Box></Grid>; })}</Grid></CardContent></Card>}
    <Card variant="outlined" sx={{ borderRadius: 4, mb: 3 }} data-secureasset-subscription-history="tenant-subscription-history-v84"><CardContent sx={{ p: { xs: 2, sm: 2.5 } }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}><Stack direction="row" spacing={1} alignItems="center"><HistoryRounded color="primary" /><Box><Typography fontWeight={900}>Subscription history</Typography><Typography variant="body2" color="text.secondary">Only your own subscription records and renewal payments are shown here.</Typography></Box></Stack><Chip size="small" label={`${history.length} record${history.length === 1 ? '' : 's'}`} variant="outlined" /></Stack><Divider sx={{ my: 2 }} />{history.length ? <Stack spacing={1.15}>{history.map((record) => { const renewals = Array.isArray(record.renewalHistory) && record.renewalHistory.length ? record.renewalHistory : [{ planKey: record.plan, startsAt: record.startsAt || record.createdAt, expiresAt: record.expiresAt, amount: record.amount, renewedAt: record.payment?.paidAt || record.createdAt }]; return <Box key={record._id} sx={{ p: 1.4, borderRadius: 2.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Box><Stack direction="row" spacing={.8} alignItems="center" flexWrap="wrap"><Typography sx={{ fontSize: 13, fontWeight: 850 }}>{sentence(record.plan)} plan</Typography><Chip size="small" label={sentence(record.renewalState || record.status)} color={record.renewalState === 'expired' ? 'error' : record.renewalState === 'expiring_soon' ? 'warning' : record.status === 'active' ? 'success' : 'default'} /></Stack><Typography color="text.secondary" sx={{ mt: .35, fontSize: 11.5 }}>Started {formatDate(record.startsAt || record.createdAt)} · {record.expiresAt ? `Expires ${formatDate(record.expiresAt)}` : 'Awaiting activation'}</Typography></Box>{isRenewalDue(record) && <Button size="small" variant="outlined" startIcon={<AutorenewRounded />} onClick={() => renew(record)}>Renew</Button>}</Stack><Stack spacing={.45} sx={{ mt: 1.1 }}>{renewals.map((entry: any, index: number) => <Stack key={`${record._id}-${entry.paymentId || index}`} direction="row" justifyContent="space-between" gap={1}><Typography color="text.secondary" sx={{ fontSize: 11.5 }}>{index ? 'Renewal' : 'Subscription'} · {sentence(entry.planKey || record.plan)}</Typography><Typography sx={{ fontSize: 11.5, fontWeight: 800 }}>{money(Number(entry.amount || record.amount || 0))} · {formatDate(entry.renewedAt || entry.startsAt)}</Typography></Stack>)}</Stack></Box>; })}</Stack> : <Alert severity="info">You do not have any subscription history yet. Choose a plan below when you are ready to enable Landlord features.</Alert>}</CardContent></Card>
    <Grid container spacing={2}>{plans.map((plan) => { const current = subscription?.status === 'active' && subscription.plan === plan.key; const price = Number(plan.prices?.[cycle] || 0); return <Grid size={{ xs: 12, md: 6, xl: 3 }} key={plan.key}><Card variant="outlined" sx={{ height: '100%', borderRadius: 4, borderColor: current ? 'primary.main' : 'divider', position: 'relative' }}>{plan.featured && <Chip label="Recommended" color="primary" sx={{ position: 'absolute', top: 14, right: 14 }} />}<CardContent sx={{ p: 3 }}><Typography variant="h6" fontWeight={950}>{plan.name}</Typography><Typography color="text.secondary" fontSize={13} minHeight={44}>{plan.description}</Typography><Typography fontSize={31} fontWeight={950} my={2}>{price ? money(price) : 'Custom'}{price > 0 && <Typography component="span" color="text.secondary" fontSize={12}>/{cycle === 'monthly' ? 'mo' : 'yr'}</Typography>}</Typography><Stack spacing={1.1} mb={3}>{[['Buildings', plan.limits?.buildings], ['Apartments', plan.limits?.apartments], ['Rooms', plan.limits?.rooms], ['Beds', plan.limits?.beds], ['Public listings', plan.limits?.publicListings], ['Active tenants', plan.limits?.activeTenants], ['Team members', plan.limits?.teamMembers], ['Storage', `${Math.round(Number(plan.limits?.storageMB || 0) / 1024)} GB`]].map(([label, value]) => <Stack key={String(label)} direction="row" justifyContent="space-between"><Typography color="text.secondary" fontSize={12}>{label}</Typography><Typography fontWeight={800} fontSize={12}>{Number(value) >= 999999 ? 'Unlimited' : value}</Typography></Stack>)}</Stack><Stack direction="row" gap={.7} flexWrap="wrap" mb={3}>{Object.entries(plan.features || {}).filter(([, enabled]) => enabled).map(([feature]) => <Chip key={feature} size="small" label={sentence(feature)} variant="outlined" />)}</Stack><Button fullWidth variant={current ? 'outlined' : 'contained'} disabled={current || plan.key === 'enterprise'} onClick={() => choosePlan(plan.key)}>{current ? 'Current plan' : plan.key === 'enterprise' ? 'Contact sales' : 'Choose plan and pay'}</Button></CardContent></Card></Grid>; })}</Grid>
    {actions.dialogs}<Alert severity="info" sx={{ mt: 3 }}>Your selected plan is not activated until Razorpay verification succeeds or an administrator approves the submitted UPI transaction and screenshot.</Alert>
  </Box>;
}
