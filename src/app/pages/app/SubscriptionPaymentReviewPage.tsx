import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { approveSubscriptionPayment, fetchSubscriptionPaymentProof, getPendingSubscriptionPayments, rejectSubscriptionPayment } from '../../services/api';
import { useActionDialog } from '../../components/shared/useActionDialog';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const manualMethods = new Set(['upi', 'offline', 'bank_transfer']);

export default function SubscriptionPaymentReviewPage() {
  const actions = useActionDialog();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [proofBusy, setProofBusy] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = await getPendingSubscriptionPayments();
      setRows(result.data || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    setBusy(id);
    try {
      await approveSubscriptionPayment(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function reject(id: string) {
    const reason = await actions.askText('Explain why this manual UPI payment is being rejected. The reason will be recorded in the audit trail.', { title: 'Reject manual payment', label: 'Rejection reason' });
    if (!reason?.trim()) return;
    setBusy(id);
    try {
      await rejectSubscriptionPayment(id, reason.trim());
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  async function openProof(id: string) {
    const tab = window.open('', '_blank');
    setProofBusy(id);
    try {
      const blob = await fetchSubscriptionPaymentProof(id);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      tab?.close();
      setError((e as Error).message);
    } finally {
      setProofBusy('');
    }
  }

  if (loading) return <Box sx={{ p: 8, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
    <Typography variant="h4" fontWeight={950}>Subscription payment approvals</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>Review manual payment submissions before enabling the subscribed Landlord or Surveyor features inside the tenant workspace.</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    <Stack spacing={1.5}>
      {rows.map((row) => {
        const isManual = manualMethods.has(String(row.method || 'offline'));
        return <Card key={row._id} variant="outlined">
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
              <Box>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                  <Typography fontWeight={900}>{row.type === 'landlord_subscription' ? 'Landlord' : 'Surveyor'} subscription</Typography>
                  <Chip size="small" label={row.method || 'manual'} />
                  <Chip size="small" color={row.status === 'pending' ? 'warning' : 'default'} label={row.status} />
                </Stack>
                <Typography fontSize={13} sx={{ mt: .7 }}>{row.payer?.name || 'User'} · {row.payer?.email || row.payer?.phone || '—'}</Typography>
                <Typography color="text.secondary" fontSize={12}>{row.invoiceNumber} · {money(row.amount)} · UPI reference: {row.transactionId || 'not provided'}</Typography>
                {isManual && row.proofUrl ? <Button size="small" onClick={() => openProof(row._id)} disabled={proofBusy === row._id}>{proofBusy === row._id ? 'Opening…' : 'View payment screenshot'}</Button> : isManual ? <Typography color="error" fontSize={12}>Screenshot missing</Typography> : <Typography color="text.secondary" fontSize={12}>Razorpay payment is completed by server signature verification.</Typography>}
              </Box>
              {isManual ? <Stack direction="row" gap={1} alignItems="center"><Button color="error" onClick={() => reject(row._id)} disabled={busy === row._id}>Reject</Button><Button variant="contained" onClick={() => approve(row._id)} disabled={busy === row._id}>{busy === row._id ? 'Working…' : 'Approve & activate'}</Button></Stack> : <Chip color="info" label="Awaiting Razorpay verification" />}
            </Stack>
          </CardContent>
        </Card>;
      })}
      {!rows.length && <Alert severity="success">No pending subscription payments.</Alert>}
    </Stack>
    {actions.dialogs}
  </Box>;
}
