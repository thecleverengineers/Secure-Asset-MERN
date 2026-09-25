import { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Divider, FormControlLabel, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloudUploadRounded from '@mui/icons-material/CloudUploadRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import QrCode2Rounded from '@mui/icons-material/QrCode2Rounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import { buyLandlordSubscription, buySurveyorSubscription, cancelSubscriptionRazorpayPayment, createSubscriptionRazorpayOrder, getSubscriptionPaymentConfig, getSubscriptionPlans, getSurveyorPlans, renewLandlordSubscription, uploadSubscriptionPaymentProof, verifySubscriptionRazorpayPayment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type PaymentMethod = 'razorpay' | 'upi';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if ((window as any).Razorpay) { resolve(); return; }
    const existing = document.querySelector<HTMLScriptElement>('script[data-secureasset-razorpay]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Razorpay checkout could not load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.secureassetRazorpay = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay checkout could not load'));
    document.body.appendChild(script);
  });
}

export default function SubscriptionPaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const kind = searchParams.get('type') === 'surveyor' ? 'surveyor' : 'landlord';
  const planKey = searchParams.get('plan') || '';
  const cycle = searchParams.get('cycle') === 'yearly' ? 'yearly' : 'monthly';
  const renewalId = searchParams.get('renewal') || '';
  const [autoRenew, setAutoRenew] = useState(searchParams.get('autoRenew') !== 'false');
  const isSurveyor = kind === 'surveyor';
  const isRenewal = Boolean(!isSurveyor && renewalId);
  const subscriptionLabel = isSurveyor ? 'Surveyor subscription' : isRenewal ? 'Landlord subscription renewal' : 'Landlord subscription';
  const returnPath = isSurveyor ? '/app/surveyor-subscription' : '/app/subscription';

  const [plan, setPlan] = useState<any>(null);
  const [config, setConfig] = useState<any>({});
  const [method, setMethod] = useState<PaymentMethod>('razorpay');
  const [transactionId, setTransactionId] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([isSurveyor ? getSurveyorPlans() : getSubscriptionPlans(), getSubscriptionPaymentConfig()])
      .then(([plansResponse, configResponse]) => {
        if (!active) return;
        setPlan((plansResponse.data || []).find((item: any) => item.key === planKey) || null);
        setConfig(configResponse.data || {});
      })
      .catch((e) => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isSurveyor, planKey]);

  useEffect(() => () => { if (proofPreview) URL.revokeObjectURL(proofPreview); }, [proofPreview]);

  const price = Number(plan?.prices?.[cycle] || 0);
  const razorpayReady = Boolean(config.configured && config.keyId);

  function chooseProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Payment proof must be a PNG, JPG, JPEG, or WebP image.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Payment screenshot must be 8 MB or smaller.'); return; }
    setError(''); setProofFile(file); setProofPreview(URL.createObjectURL(file));
  }

  async function openRazorpay(paymentId: string) {
    const order = await createSubscriptionRazorpayOrder(paymentId);
    await loadRazorpay();
    await new Promise<void>((resolve, reject) => {
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) { reject(new Error('Razorpay checkout is unavailable')); return; }
      let finished = false;
      const finish = (callback: () => void) => { if (finished) return; finished = true; callback(); };
      const checkout = new Razorpay({
        key: order.data.keyId,
        amount: Number(order.data.amount) * 100,
        currency: order.data.currency || 'INR',
        order_id: order.data.order,
        name: 'SecureAsset',
        description: `${subscriptionLabel} — ${plan?.name || planKey}`,
        theme: { color: '#0B5270' },
        handler: async (response: any) => {
          try {
            await verifySubscriptionRazorpayPayment({ orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature });
            finish(resolve);
          } catch (e) { finish(() => reject(e)); }
        },
        modal: {
          confirm_close: true,
          ondismiss: async () => {
            if (finished) return;
            finished = true;
            try {
              await cancelSubscriptionRazorpayPayment({ paymentId, orderId: String(order.data.order || '') });
            } catch {
              // Webhook reconciliation remains authoritative for any payment
              // attempt that already reached Razorpay. A dismissal before an
              // attempt has no Razorpay webhook, so this endpoint is best-effort.
            }
            reject(new Error('Razorpay checkout was cancelled. Subscription was not activated.'));
          },
        },
      });
      checkout.open();
    });
  }

  async function submitPayment() {
    if (!plan) return;
    setError('');
    if (method === 'razorpay' && !razorpayReady) { setError('Razorpay is not configured by the administrator yet.'); return; }
    if (method === 'upi') {
      if (!config.upiId) { setError('Manual UPI payments are not configured by the administrator yet.'); return; }
      if (!transactionId.trim()) { setError('Enter the UPI transaction/reference ID.'); return; }
      if (!proofFile) { setError('Upload the payment screenshot before submitting.'); return; }
    }
    setBusy(true);
    try {
      let proofUrl = '';
      if (method === 'upi' && proofFile) {
        const uploaded = await uploadSubscriptionPaymentProof(proofFile, {
          name: `subscription-payment-proof-${Date.now()}`,
          type: 'subscription_payment_proof',
          category: 'image',
          description: `${isSurveyor ? 'Surveyor' : 'Landlord'} subscription payment proof`,
          visibility: 'private',
        });
        proofUrl = String((uploaded.data as any)?.url || '');
        if (!proofUrl) throw new Error('Payment screenshot upload did not return a secure file reference');
      }

      const result = isSurveyor
        ? await buySurveyorSubscription({ plan: plan.key, billingCycle: cycle, autoRenew, method, transactionId: method === 'upi' ? transactionId.trim() : undefined, proofUrl: proofUrl || undefined })
        : renewalId
          ? await renewLandlordSubscription(renewalId, { plan: plan.key, billingCycle: cycle, method, transactionId: method === 'upi' ? transactionId.trim() : undefined, proofUrl: proofUrl || undefined })
          : await buyLandlordSubscription({ plan: plan.key, billingCycle: cycle, method, transactionId: method === 'upi' ? transactionId.trim() : undefined, proofUrl: proofUrl || undefined });
      const paymentId = result.data?.payment?._id;
      if (!paymentId) throw new Error('The subscription payment order could not be created');

      if (method === 'razorpay') {
        await openRazorpay(paymentId);
        await refreshUser();
        navigate(`${returnPath}?payment=success`, { replace: true });
      } else {
        setSubmitted(true);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  if (loading) return <Box sx={{ p: 8, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (submitted) return <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, sm: 3 }, py: 5 }}><Card sx={{ borderRadius: 5, border: '1px solid', borderColor: 'success.light' }}><CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}><CheckCircleRounded color="success" sx={{ fontSize: 64 }} /><Typography variant="h4" sx={{ mt: 2, fontWeight: 950 }}>{isRenewal ? 'Renewal payment submitted' : 'Payment submitted'}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Your UPI transaction and payment screenshot were securely submitted. An administrator must verify them before your {isSurveyor ? 'Surveyor' : 'Landlord'} {isRenewal ? 'renewal is activated' : 'Mode becomes active'}.</Typography><Button variant="contained" sx={{ mt: 3 }} onClick={() => navigate(returnPath, { replace: true })}>Return to subscription</Button></CardContent></Card></Box>;
  if (!plan) return <Box sx={{ maxWidth: 720, mx: 'auto', px: 3, py: 5 }}><Alert severity="error">The selected subscription plan is unavailable.</Alert><Button startIcon={<ArrowBackRounded />} onClick={() => navigate(returnPath)} sx={{ mt: 2 }}>Back to plans</Button></Box>;

  return <Box sx={{ maxWidth: 1040, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, pb: 7 }}>
    <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(returnPath)} sx={{ mb: 2 }}>Back to plans</Button>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="stretch">
      <Card sx={{ flex: 1, borderRadius: 5, background: 'linear-gradient(145deg, #0B5270 0%, #116f8d 100%)', color: 'white' }}><CardContent sx={{ p: { xs: 3, sm: 4 } }}><Stack direction="row" spacing={1} alignItems="center"><LockRounded /><Typography variant="overline" sx={{ letterSpacing: '.12em' }}>Secure checkout</Typography></Stack><Typography variant="h4" sx={{ mt: 2, fontWeight: 950 }}>{isRenewal ? 'Renew subscription' : subscriptionLabel}</Typography><Typography sx={{ opacity: .85, mt: 1 }}>{isRenewal ? 'Continue the same plan after payment verification.' : 'Complete your payment securely. Your access is activated only after verified payment.'}</Typography><Divider sx={{ borderColor: 'rgba(255,255,255,.25)', my: 3 }} /><Stack spacing={1.2}><Stack direction="row" justifyContent="space-between"><Typography sx={{ opacity: .8 }}>Plan</Typography><Typography fontWeight={850}>{plan.name}</Typography></Stack><Stack direction="row" justifyContent="space-between"><Typography sx={{ opacity: .8 }}>Billing</Typography><Typography fontWeight={850}>{cycle === 'monthly' ? 'Monthly' : 'Yearly'}</Typography></Stack><Stack direction="row" justifyContent="space-between"><Typography sx={{ opacity: .8 }}>Payable</Typography><Typography fontWeight={950} fontSize={24}>{money(price)}</Typography></Stack></Stack><Stack direction="row" spacing={1} sx={{ mt: 4, opacity: .9 }}><SecurityRounded fontSize="small" /><Typography variant="caption">Encrypted payment flow · Admin-audited activation</Typography></Stack></CardContent></Card>
      <Card sx={{ flex: 1.2, borderRadius: 5 }}><CardContent sx={{ p: { xs: 3, sm: 4 } }}><Stack direction="row" spacing={1} alignItems="center"><PaymentsRounded color="primary" /><Typography variant="h5" fontWeight={950}>Choose payment method</Typography></Stack><ToggleButtonGroup exclusive fullWidth value={method} onChange={(_, value) => value && setMethod(value)} sx={{ mt: 3 }}><ToggleButton value="razorpay" disabled={!razorpayReady}>Razorpay</ToggleButton><ToggleButton value="upi" disabled={!config.upiId}>Manual UPI</ToggleButton></ToggleButtonGroup>{!razorpayReady && <Alert severity="warning" sx={{ mt: 2 }}>Razorpay is currently unavailable because the administrator has not completed payment configuration.</Alert>}
        {method === 'razorpay' && <Alert severity="info" sx={{ mt: 2 }}>You will be redirected to Razorpay Checkout. Subscription activation occurs only after the server verifies the Razorpay signature.</Alert>}
        {isSurveyor && <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={autoRenew} onChange={(event) => setAutoRenew(event.target.checked)} />} label="Enable automatic renewal" />}
        {method === 'upi' && <Stack spacing={2} sx={{ mt: 2 }}><Alert severity="info" icon={<QrCode2Rounded />}>Transfer exactly <strong>{money(price)}</strong> to <strong>{config.upiId}</strong>{config.upiName ? ` (${config.upiName})` : ''}. Then submit the transaction ID and screenshot for admin approval.</Alert>{config.upiQrUrl && <Box component="img" src={config.upiQrUrl} alt="SecureAsset UPI QR code" sx={{ width: 180, height: 180, objectFit: 'contain', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, alignSelf: 'center' }} />}<TextField label="UPI transaction/reference ID" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required fullWidth placeholder="Enter the reference shown by your UPI app" /><Box><Button component="label" variant="outlined" startIcon={<CloudUploadRounded />} fullWidth>{proofFile ? proofFile.name : 'Upload payment screenshot'}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseProof} /></Button>{proofPreview && <Box component="img" src={proofPreview} alt="Selected payment proof preview" sx={{ display: 'block', mt: 1.5, width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />}<Typography variant="caption" color="text.secondary">PNG, JPG, JPEG, or WebP · maximum 8 MB</Typography></Box></Stack>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}<Button fullWidth size="large" variant="contained" onClick={submitPayment} disabled={busy || (method === 'razorpay' && !razorpayReady) || (method === 'upi' && !config.upiId)} startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <ReceiptLongRounded />} sx={{ mt: 3, py: 1.4 }}>{busy ? 'Processing securely…' : method === 'razorpay' ? `Pay ${money(price)} with Razorpay` : 'Submit UPI payment for approval'}</Button>
      </CardContent></Card>
    </Stack>
  </Box>;
}
