import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, IconButton, LinearProgress, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import { fetchAgreementPreviewBlob, getMyPropertyRentCycle, submitRentalInvoicePayment, uploadRentalPaymentProof } from '../../services/api';
import { safeRecord, safeRecordArray } from '../../utils/runtimeData';

const DAY = 86_400_000;

function dateText(value: unknown, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', options);
}

function money(value: unknown) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.max(0, Number(value || 0)));
}

function sentence(value: unknown) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || '—';
}

function monthText(value: unknown) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(value || 'Rent cycle');
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function rentPaymentLabel(invoice: Record<string, any>) {
  const payment = safeRecord(invoice.payment);
  const verification = String(payment.verificationStatus || 'awaiting_tenant');
  if (String(invoice.status || '') === 'paid' || verification === 'approved') return 'Paid';
  if (verification === 'submitted') return 'Awaiting landlord approval';
  if (verification === 'rejected') return 'Payment rejected';
  if (String(invoice.status || '') === 'overdue') return 'Overdue';
  return 'Payment due';
}

function rentPaymentColor(invoice: Record<string, any>): 'success' | 'info' | 'warning' | 'error' | 'default' {
  const payment = safeRecord(invoice.payment);
  const verification = String(payment.verificationStatus || 'awaiting_tenant');
  if (String(invoice.status || '') === 'paid' || verification === 'approved') return 'success';
  if (verification === 'submitted') return 'info';
  if (verification === 'rejected' || String(invoice.status || '') === 'overdue') return 'error';
  return 'warning';
}

type Countdown = { total: number; days: number; hours: number; minutes: number; seconds: number; expired: boolean };

function countdownFor(endsAt: unknown, now = Date.now()): Countdown {
  const end = endsAt ? new Date(String(endsAt)).getTime() : Number.NaN;
  if (!Number.isFinite(end) || end <= now) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  let remainder = end - now;
  const days = Math.floor(remainder / DAY);
  remainder -= days * DAY;
  const hours = Math.floor(remainder / 3_600_000);
  remainder -= hours * 3_600_000;
  const minutes = Math.floor(remainder / 60_000);
  remainder -= minutes * 60_000;
  return { total: end - now, days, hours, minutes, seconds: Math.floor(remainder / 1000), expired: false };
}

function useCountdown(endsAt: unknown) {
  const [countdown, setCountdown] = useState(() => countdownFor(endsAt));
  useEffect(() => {
    const update = () => setCountdown(countdownFor(endsAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  return countdown;
}

function Detail({ icon: Icon, label, value }: { icon: typeof CalendarMonthRounded; label: string; value: unknown }) {
  return <Stack direction="row" spacing={1.1} alignItems="flex-start"><Box sx={{ width: 30, height: 30, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.50', color: 'primary.main', flexShrink: 0 }}><Icon sx={{ fontSize: 17 }} /></Box><Box sx={{ minWidth: 0 }}><Typography sx={{ color: 'text.secondary', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</Typography><Typography sx={{ mt: .15, fontSize: 13.2, fontWeight: 750, wordBreak: 'break-word' }}>{value ? String(value) : '—'}</Typography></Box></Stack>;
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return <Box sx={{ minWidth: 0, py: 1.15, px: .5, textAlign: 'center', borderRadius: 2, bgcolor: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)' }}><Typography sx={{ fontSize: { xs: 20, sm: 25 }, color: '#fff', fontVariantNumeric: 'tabular-nums', fontWeight: 850, lineHeight: 1 }}>{String(value).padStart(2, '0')}</Typography><Typography sx={{ mt: .45, color: 'rgba(255,255,255,.74)', fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</Typography></Box>;
}

export default function MyRentCyclePage() {
  const { tenancyId = '' } = useParams();
  const navigate = useNavigate();
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [transactionId, setTransactionId] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const query = useQuery({
    queryKey: ['my-property-rent-cycle', tenancyId],
    queryFn: () => getMyPropertyRentCycle(tenancyId),
    enabled: Boolean(tenancyId),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
  const data = safeRecord(query.data?.data);
  const property = safeRecord(data.property);
  const cycle = safeRecord(data.cycle);
  const agreement = safeRecord(data.agreement);
  const tenancy = safeRecord(data.tenancy);
  const invoice = safeRecord(data.currentInvoice);
  const invoices = safeRecordArray(data.invoices);
  const countdown = useCountdown(cycle.endsAt);
  const progress = useMemo(() => {
    const start = new Date(String(cycle.startsAt || '')).getTime();
    const end = new Date(String(cycle.endsAt || '')).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    return Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
  }, [countdown.total, cycle.endsAt, cycle.startsAt, query.dataUpdatedAt]);

  const openAgreement = async () => {
    if (!agreement.id) return;
    setPreviewing(true);
    setPreviewError('');
    try {
      const blob = await fetchAgreementPreviewBlob(String(agreement.id));
      const url = URL.createObjectURL(blob);
      const tab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!tab) {
        const link = document.createElement('a');
        link.href = url;
        link.download = 'secureasset-rent-agreement.pdf';
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Could not open the agreement');
    } finally {
      setPreviewing(false);
    }
  };

  const submitRentPayment = async () => {
    if (!invoice.id) return;
    const needsReference = paymentMethod !== 'cash';
    if (needsReference && !transactionId.trim()) {
      setPaymentError('Enter the transaction/reference ID for this rent payment.');
      return;
    }
    if (paymentProof && paymentProof.size > 8 * 1024 * 1024) {
      setPaymentError('Payment proof must be 8 MB or smaller.');
      return;
    }

    setPaymentBusy(true);
    setPaymentError('');
    setPaymentNotice('');
    try {
      let proofUrl = '';
      if (paymentProof) {
        const uploaded = await uploadRentalPaymentProof(paymentProof, String(invoice.id));
        proofUrl = String((uploaded.data as any)?.url || '');
      }

      const response = await submitRentalInvoicePayment(String(invoice.id), {
        method: paymentMethod as 'upi' | 'card' | 'bank_transfer' | 'cash' | 'cheque' | 'gateway' | 'offline',
        transactionId: transactionId.trim() || undefined,
        proofUrl: proofUrl || undefined,
        notes: paymentNote.trim() || undefined,
      });
      setPaymentNotice(response.message || 'Rent payment submitted for landlord approval.');
      setPaymentOpen(false);
      setTransactionId('');
      setPaymentNote('');
      setPaymentProof(null);
      await query.refetch();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Could not submit the rent payment.');
    } finally {
      setPaymentBusy(false);
    }
  };

  if (query.isPending) return <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (query.isError || !data) return <Box sx={{ maxWidth: 760, mx: 'auto', p: { xs: 2, md: 3 } }}><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>Retry</Button>}>{query.error instanceof Error ? query.error.message : 'Could not load this rent cycle.'}</Alert></Box>;

  const title = String(property.title || 'My property');
  const location = [property.address?.locality, property.address?.city, property.address?.state].filter(Boolean).join(', ') || 'Address protected in your agreement';
  const reminderDue = cycle.reminder && dateText(cycle.reminder.dueAt, { dateStyle: 'long' });
  const reminderState = String(cycle.reminder?.status || 'not_scheduled');
  const paid = String(invoice.status || '') === 'paid' || Number(invoice.balanceAmount || 0) <= 0;
  const currentPayment = safeRecord(invoice.payment);
  const paymentStage = String(currentPayment.verificationStatus || 'awaiting_tenant');
  const paymentRejected = paymentStage === 'rejected';
  const paymentSubmitted = paymentStage === 'submitted';
  const canPayRent = Boolean(invoice.id) && !paid && ['awaiting_tenant', 'rejected', ''].includes(paymentStage);

  return <Box data-secureasset-my-rent-cycle="tenant-rent-payment-proof-v222" sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 1.5, sm: 2.5, lg: 0 }, pb: 6 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.3 }}>
      <Button size="small" startIcon={<ArrowBackRounded />} onClick={() => navigate('/app/my-property')} sx={{ borderRadius: 2.5, textTransform: 'none' }}>My Property</Button>
      <IconButton size="small" aria-label="Refresh rent cycle" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshRounded fontSize="small" /></IconButton>
    </Stack>

    <Card elevation={0} sx={{ overflow: 'hidden', borderRadius: { xs: 3, md: 4 }, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ px: { xs: 1.7, sm: 2.5 }, py: { xs: 1.8, sm: 2.45 }, color: '#fff', bgcolor: '#143E4D', background: 'linear-gradient(135deg, #143E4D, #0B6278)' }}>
        <Stack direction="row" spacing={{ xs: 1.2, sm: 1.6 }} alignItems="center">
          <Box aria-hidden="true" sx={{ width: { xs: 48, sm: 56 }, height: { xs: 48, sm: 56 }, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 3, bgcolor: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)' }}><HomeWorkRounded sx={{ fontSize: { xs: 24, sm: 28 } }} /></Box>
          <Box sx={{ minWidth: 0 }}>
            <Chip icon={<HomeWorkRounded />} label={`${sentence(cycle.type)} · monthly cycle`} size="small" sx={{ mb: .8, bgcolor: 'rgba(255,255,255,.92)', color: '#163D4D', '& .MuiChip-icon': { color: 'inherit' } }} />
            <Typography component="h1" noWrap sx={{ fontSize: { xs: 20, sm: 28 }, fontWeight: 850, lineHeight: 1.2 }}>{title}</Typography>
            <Typography noWrap sx={{ mt: .4, fontSize: { xs: 11.5, sm: 13 }, color: 'rgba(255,255,255,.78)' }}>{location}</Typography>
          </Box>
        </Stack>
      </Box>
      <CardContent sx={{ p: { xs: 1.7, sm: 2.5 } }}>
        <Grid container spacing={{ xs: 1.4, sm: 2 }}>
          <Grid size={{ xs: 6, sm: 3 }}><Detail icon={PaymentsRounded} label="Monthly rent" value={money(tenancy.monthlyRent)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><Detail icon={CalendarMonthRounded} label="Cycle start" value={dateText(cycle.startsAt)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><Detail icon={EventAvailableRounded} label="Cycle end" value={dateText(cycle.endsAt)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><Detail icon={ScheduleRounded} label="Next invoice due" value={dateText(cycle.nextInvoiceDueAt)} /></Grid>
        </Grid>
      </CardContent>
    </Card>

    <Paper elevation={0} sx={{ mt: 2, p: { xs: 1.5, sm: 2.25 }, color: '#fff', borderRadius: { xs: 3, md: 4 }, bgcolor: '#143E4D', overflow: 'hidden', position: 'relative' }}>
      <Box sx={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', right: -75, top: -92, bgcolor: 'rgba(123,207,190,.12)' }} />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.4} sx={{ position: 'relative' }}>
        <Box><Stack direction="row" spacing={.75} alignItems="center"><ScheduleRounded sx={{ fontSize: 19, color: '#9BE0D1' }} /><Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,.76)' }}>Time left in this monthly rent cycle</Typography></Stack><Typography sx={{ mt: .55, fontSize: { xs: 19, sm: 23 }, fontWeight: 850 }}>{countdown.expired ? 'This monthly cycle has ended' : `${cycle.timeLeft?.label || `${countdown.days} days remaining`}`}</Typography></Box>
        {!countdown.expired && <Grid container columns={4} spacing={.65} sx={{ width: { xs: '100%', sm: 310 }, flexShrink: 0 }}><Grid size={1}><CountdownUnit value={countdown.days} label="Days" /></Grid><Grid size={1}><CountdownUnit value={countdown.hours} label="Hours" /></Grid><Grid size={1}><CountdownUnit value={countdown.minutes} label="Mins" /></Grid><Grid size={1}><CountdownUnit value={countdown.seconds} label="Secs" /></Grid></Grid>}
      </Stack>
      <LinearProgress variant="determinate" value={progress} sx={{ mt: 1.6, height: 5, borderRadius: 5, bgcolor: 'rgba(255,255,255,.14)', '& .MuiLinearProgress-bar': { bgcolor: '#9BE0D1' } }} />
    </Paper>

    <Paper elevation={0} data-secureasset-rent-payment="tenant-pay-and-status-v221" sx={{ mt: 2, p: { xs: 1.7, sm: 2.25 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.2}>
        <Box>
          <Stack direction="row" spacing={.8} alignItems="center">
            <PaymentsRounded sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography sx={{ fontSize: 16, fontWeight: 850 }}>Monthly rent payment</Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: .35, fontSize: 12 }}>
            {invoice.id ? `${monthText(invoice.billingMonth)} · ${invoice.invoiceNumber || 'Rent invoice'}` : 'The current monthly invoice will appear here when issued.'}
          </Typography>
        </Box>
        {invoice.id && <Chip size="small" label={rentPaymentLabel(invoice)} color={rentPaymentColor(invoice)} sx={{ fontWeight: 800 }} />}
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      {invoice.id ? <Grid container spacing={1.25} alignItems="center">
        <Grid size={{ xs: 6, sm: 3 }}><Typography color="text.secondary" sx={{ fontSize: 10.5 }}>Rent due</Typography><Typography sx={{ mt: .2, fontSize: 16, fontWeight: 850 }}>{money(invoice.balanceAmount)}</Typography></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><Typography color="text.secondary" sx={{ fontSize: 10.5 }}>Due date</Typography><Typography sx={{ mt: .2, fontSize: 13, fontWeight: 800 }}>{dateText(invoice.dueDate)}</Typography></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><Typography color="text.secondary" sx={{ fontSize: 10.5 }}>Paid</Typography><Typography sx={{ mt: .2, fontSize: 13, fontWeight: 800 }}>{money(invoice.paidAmount)}</Typography></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><Typography color="text.secondary" sx={{ fontSize: 10.5 }}>Payment status</Typography><Typography sx={{ mt: .2, fontSize: 13, fontWeight: 800 }}>{rentPaymentLabel(invoice)}</Typography></Grid>
      </Grid> : <Alert severity="info">No payable rent invoice is available for this monthly cycle yet.</Alert>}

      {paymentNotice && <Alert severity="success" sx={{ mt: 1.4 }}>{paymentNotice}</Alert>}
      {paymentError && <Alert severity="error" sx={{ mt: 1.4 }}>{paymentError}</Alert>}

      {paymentSubmitted && <Alert severity="info" sx={{ mt: 1.4 }}>
        Your payment{currentPayment.transactionId ? <> with transaction ID <strong>{currentPayment.transactionId}</strong></> : null} is waiting for landlord approval. The rent record will update automatically after verification.
      </Alert>}
      {paymentRejected && <Alert severity="error" sx={{ mt: 1.4 }}>
        The previous rent payment was rejected{currentPayment.rejectionReason ? <>: <strong>{currentPayment.rejectionReason}</strong></> : '.'} You can correct the details and resubmit.
      </Alert>}
      {paid && invoice.id && <Alert severity="success" sx={{ mt: 1.4 }}>
        Rent paid{currentPayment.paidAt ? <> on {dateText(currentPayment.paidAt)}</> : null}{currentPayment.transactionId ? <> · Transaction {currentPayment.transactionId}</> : null}.
      </Alert>}

      {canPayRent && <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" sx={{ mt: 1.5 }}>
        <Button variant="contained" startIcon={<PaymentsRounded />} onClick={() => { setPaymentError(''); setPaymentOpen(true); }} sx={{ borderRadius: 2.5 }}>
          {paymentRejected ? 'Resubmit Rent Payment' : 'Pay Rent'}
        </Button>
      </Stack>}
    </Paper>

    <Grid container spacing={2} sx={{ mt: .1 }}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Paper elevation={0} sx={{ height: '100%', mt: 2, p: { xs: 1.7, sm: 2.25 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Box><Typography sx={{ fontSize: 16, fontWeight: 850 }}>Agreement information</Typography><Typography color="text.secondary" sx={{ mt: .3, fontSize: 12 }}>Private signed agreement details for this tenancy.</Typography></Box><Chip size="small" icon={<VerifiedRounded />} label={agreement.status ? sentence(agreement.status) : 'Linked tenancy'} color={agreement.status === 'approved' ? 'success' : 'default'} /></Stack>
          <Divider sx={{ my: 1.8 }} />
          {agreement.id ? <><Grid container spacing={1.6}><Grid size={{ xs: 12, sm: 6 }}><Detail icon={DescriptionRounded} label="Agreement" value={agreement.title} /></Grid><Grid size={{ xs: 6, sm: 3 }}><Detail icon={CalendarMonthRounded} label="Approved" value={dateText(agreement.firstPartyApprovalAt)} /></Grid><Grid size={{ xs: 6, sm: 3 }}><Detail icon={EventAvailableRounded} label="Renewal" value={agreement.renewalRequestedAt ? 'Requested' : 'Not requested'} /></Grid></Grid><Button variant="outlined" size="small" startIcon={previewing ? <CircularProgress size={14} /> : <DownloadRounded />} onClick={() => void openAgreement()} disabled={previewing} sx={{ mt: 2, borderRadius: 2.5 }}>{previewing ? 'Opening…' : 'Preview agreement'}</Button></> : <Alert severity="info" icon={<DescriptionRounded />}>Your tenancy is active. The linked agreement summary will appear here after it is available.</Alert>}
          {previewError && <Alert severity="error" sx={{ mt: 1.5 }}>{previewError}</Alert>}
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Paper elevation={0} sx={{ height: '100%', mt: 2, p: { xs: 1.7, sm: 2.25 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={.9} alignItems="center"><WarningAmberRounded sx={{ color: reminderState === 'queued' ? 'success.main' : 'warning.main', fontSize: 19 }} /><Typography sx={{ fontSize: 16, fontWeight: 850 }}>Rent reminder</Typography></Stack>
          <Typography color="text.secondary" sx={{ mt: .8, fontSize: 12.3, lineHeight: 1.55 }}>SecureAsset queues the approved WhatsApp reminder when 7 calendar days remain. The payment date in the message is 3 days before this cycle ends.</Typography>
          <Box sx={{ mt: 1.5, p: 1.3, borderRadius: 2.5, bgcolor: 'action.hover' }}><Typography color="text.secondary" sx={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Template due date</Typography><Typography sx={{ mt: .35, fontSize: 15, fontWeight: 800 }}>{reminderDue || '—'}</Typography></Box>
          <Chip size="small" label={reminderState === 'queued' ? 'WhatsApp reminder queued' : reminderState === 'failed' ? 'Reminder will retry safely' : 'Scheduled automatically'} color={reminderState === 'queued' ? 'success' : reminderState === 'failed' ? 'warning' : 'default'} sx={{ mt: 1.5 }} />
        </Paper>
      </Grid>
    </Grid>

    <Paper elevation={0} sx={{ mt: 2, p: { xs: 1.7, sm: 2.25 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Box><Typography sx={{ fontSize: 16, fontWeight: 850 }}>Rent invoices</Typography><Typography color="text.secondary" sx={{ mt: .25, fontSize: 12 }}>Your latest private rent-cycle payment records.</Typography></Box>{invoice.id && <Chip size="small" label={paid ? 'No balance due' : `${money(invoice.balanceAmount)} due`} color={paid ? 'success' : 'primary'} />}</Stack>
      <Divider sx={{ my: 1.7 }} />
      {invoices.length ? <Stack spacing={1}>
        {invoices.slice(0, 12).map((item: any) => {
          const itemPayment = safeRecord(item.payment);
          const status = rentPaymentLabel(item);
          return <Paper key={String(item.id || item.invoiceNumber)} variant="outlined" sx={{ p: 1.25, borderRadius: 2.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={.7} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 850 }}>{monthText(item.billingMonth)}</Typography>
                  <Chip size="small" label={status} color={rentPaymentColor(item)} sx={{ height: 22, fontSize: 9.5, fontWeight: 800 }} />
                </Stack>
                <Typography color="text.secondary" sx={{ fontSize: 10.8, mt: .25 }}>{item.invoiceNumber || 'Rent invoice'} · Due {dateText(item.dueDate)}</Typography>
                {itemPayment.transactionId && <Typography color="text.secondary" sx={{ fontSize: 10.8, mt: .2 }}>Transaction: {itemPayment.transactionId}</Typography>}
                {itemPayment.rejectionReason && <Typography color="error.main" sx={{ fontSize: 10.8, mt: .2 }}>Reason: {itemPayment.rejectionReason}</Typography>}
              </Box>
              <Stack direction="row" spacing={{ xs: 2.2, sm: 3 }} sx={{ flexShrink: 0 }}>
                <Box><Typography color="text.secondary" sx={{ fontSize: 9.8 }}>Total</Typography><Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>{money(item.totalAmount)}</Typography></Box>
                <Box><Typography color="text.secondary" sx={{ fontSize: 9.8 }}>Paid</Typography><Typography sx={{ fontSize: 12.5, fontWeight: 800, color: Number(item.paidAmount || 0) > 0 ? 'success.main' : 'text.primary' }}>{money(item.paidAmount)}</Typography></Box>
                <Box><Typography color="text.secondary" sx={{ fontSize: 9.8 }}>Balance</Typography><Typography sx={{ fontSize: 12.5, fontWeight: 850 }}>{money(item.balanceAmount)}</Typography></Box>
              </Stack>
            </Stack>
          </Paper>;
        })}
      </Stack> : <Alert severity="info">No rent invoices have been issued for this tenancy yet.</Alert>}
    </Paper>

    <Dialog open={paymentOpen} onClose={() => !paymentBusy && setPaymentOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: .8 }}>
        <Typography component="div" sx={{ fontSize: 18, fontWeight: 850 }}>{paymentRejected ? 'Resubmit rent payment' : 'Pay monthly rent'}</Typography>
        <Typography color="text.secondary" sx={{ mt: .25, fontSize: 11.5 }}>{monthText(invoice.billingMonth)} · {money(invoice.balanceAmount)} due</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.35} sx={{ pt: .6 }}>
          <TextField select size="small" fullWidth label="Payment method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            <MenuItem value="upi">UPI</MenuItem>
            <MenuItem value="bank_transfer">Bank Transfer / NEFT / IMPS</MenuItem>
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="cheque">Cheque</MenuItem>
            <MenuItem value="offline">Other Offline Payment</MenuItem>
          </TextField>
          <TextField
            size="small"
            fullWidth
            required={paymentMethod !== 'cash'}
            label={paymentMethod === 'cash' ? 'Reference / receipt number (optional)' : 'Transaction / reference ID'}
            placeholder={paymentMethod === 'upi' ? 'Enter UTR / UPI transaction ID' : 'Enter payment reference'}
            value={transactionId}
            onChange={(event) => setTransactionId(event.target.value)}
            inputProps={{ maxLength: 120 }}
          />
          <Paper variant="outlined" sx={{ p: 1.15, borderRadius: 2.4 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={.8}>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 800 }}>Payment proof</Typography>
                <Typography color="text.secondary" sx={{ mt: .15, fontSize: 10.5 }}>Optional screenshot or PDF · maximum 8 MB</Typography>
                {paymentProof && <Typography color="primary.main" sx={{ mt: .35, fontSize: 10.5, fontWeight: 700 }}>{paymentProof.name}</Typography>}
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={.65}>
                {paymentProof && <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    const url = URL.createObjectURL(paymentProof);
                    const tab = window.open(url, '_blank', 'noopener,noreferrer');
                    if (!tab) setPaymentError('Allow pop-ups to preview the selected payment proof.');
                    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
                  }}
                >Preview selected proof</Button>}
                <Button component="label" variant="outlined" size="small" startIcon={<UploadFileRounded />}>
                {paymentProof ? 'Replace proof' : 'Upload proof'}
                <input hidden type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  event.currentTarget.value = '';
                  if (file && file.size > 8 * 1024 * 1024) { setPaymentError('Payment proof must be 8 MB or smaller.'); return; }
                  setPaymentProof(file);
                  setPaymentError('');
                }} />
                </Button>
              </Stack>
            </Stack>
          </Paper>
          <TextField size="small" fullWidth multiline minRows={2} label="Payment note (optional)" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} inputProps={{ maxLength: 2000 }} />
          {paymentError && <Alert severity="error">{paymentError}</Alert>}
          <Alert severity="info" sx={{ py: .25 }}>Submitting payment does not mark the rent paid immediately. The receiving landlord must verify it first.</Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.2 }}>
        <Button onClick={() => setPaymentOpen(false)} disabled={paymentBusy}>Cancel</Button>
        <Button variant="contained" startIcon={paymentBusy ? <CircularProgress size={14} color="inherit" /> : <PaymentsRounded />} disabled={paymentBusy || (paymentMethod !== 'cash' && !transactionId.trim())} onClick={() => void submitRentPayment()}>
          {paymentBusy ? 'Submitting…' : 'Submit Rent Payment'}
        </Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
