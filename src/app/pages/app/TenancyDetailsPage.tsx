import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, DialogActions, DialogContent,
  DialogTitle, Divider, Grid, IconButton, MenuItem, Paper, Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CallRounded from '@mui/icons-material/CallRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import EmailRounded from '@mui/icons-material/EmailRounded';
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import { useAuth } from '../../context/AuthContext';
import { downloadXlsx } from '../../utils/excel';
import { useActionDialog } from '../../components/shared/useActionDialog';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import {
  API_BASE, acceptRentalPayment, cancelAgreementCycle, changeResourceStatus, downloadDriveFile, fetchAgreementPreviewBlob,
  fetchPropertyImageBlob, fetchRentalPaymentProofBlob, getAppConfiguration, getTenancyDetails, recordTenancyPayment,
  rejectRentalPayment, renewAgreementCycle, sendTenancyRentReminder, submitRentalInvoicePayment, transitionRentalTenancy,
} from '../../services/api';

const TAB_KEYS = ['overview', 'rent', 'documents', 'activity'] as const;
type TabKey = typeof TAB_KEYS[number];
type PropsData = Record<string, any>;

function idOf(value: any) { return String(value?._id || value || ''); }
function money(value: unknown) { return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }
function nice(value: unknown) { return String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function dateText(value: unknown, withTime = false) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
}
function fullAddress(value: any) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return [value.unit, value.locality, value.area, value.district, value.city, value.state, value.postalCode, value.country].filter(Boolean).join(', ');
}
function fileId(file: any) { return idOf(file?.driveFile || file?.file || file); }
function invoiceBalance(invoice: any) { return Math.max(0, Number(invoice?.balanceAmount ?? (Number(invoice?.totalAmount || 0) - Number(invoice?.paidAmount || 0)))); }
function openInvoice(invoice: any) { return invoiceBalance(invoice) > 0 && !['paid', 'waived', 'refunded'].includes(String(invoice?.status || '').toLowerCase()); }
function nextDueDate(dayValue: any, timeValue: any) {
  const now = new Date();
  const day = Math.max(1, Math.min(31, Number(dayValue || 1)));
  const [hours, minutes] = String(timeValue || '09:00').split(':').map(Number);
  let due = new Date(now.getFullYear(), now.getMonth(), Math.min(day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()), hours || 9, minutes || 0);
  if (due.getTime() <= now.getTime()) {
    const month = now.getMonth() + 1;
    due = new Date(now.getFullYear(), month, Math.min(day, new Date(now.getFullYear(), month + 1, 0).getDate()), hours || 9, minutes || 0);
  }
  return due;
}

function PropertyCover({ property }: { property: any }) {
  const propertyId = idOf(property);
  const raw = property?.galleryCover || property?.coverImage || property?.mainImage || property?.primaryImage || property?.images?.[0] || '';
  const source = typeof raw === 'object' ? raw.url || raw.thumbnailUrl || raw.secureSource || raw.path || raw.mediaId || raw.fileId || '' : String(raw || '');
  const mediaId = typeof raw === 'object' ? String(raw.mediaId || raw.propertyMediaId || '') : source.match(/\/property-media\/([a-f\d]{24})/i)?.[1] || '';
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSrc('');
    if (!source) return () => { active = false; };
    if (/^(https?:|data:|blob:)/i.test(source) && !/\/property-media\/|\/drive\/files\//i.test(source)) {
      setSrc(source);
      return () => { active = false; };
    }
    const secureSource = mediaId ? `${API_BASE}/property-management/property-media/${encodeURIComponent(mediaId)}/content` : source;
    fetchPropertyImageBlob(secureSource, propertyId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(() => { if (active && /^(https?:|data:|blob:)/i.test(source)) setSrc(source); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [mediaId, propertyId, source]);
  return <Box sx={{ position: 'relative', minHeight: { xs: 190, md: 270 }, height: '100%', overflow: 'hidden', bgcolor: '#EAF1F3', borderRadius: 3 }}>
    {src ? <Box component="img" src={src} alt={property?.title ? `${property.title} property` : 'Property'} sx={{ width: '100%', height: '100%', minHeight: { xs: 190, md: 270 }, objectFit: 'cover', display: 'block' }} /> : <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', minHeight: { xs: 190, md: 270 }, color: 'text.secondary' }}><HomeWorkRounded /><Typography variant="caption" sx={{ mt: .5 }}>Property photo unavailable</Typography></Stack>}
    <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(8,39,49,.62), transparent 64%)' }} />
    <Box sx={{ position: 'absolute', left: 18, right: 18, bottom: 16, color: 'white' }}>
      <Typography variant="overline" sx={{ letterSpacing: '.12em', opacity: .86 }}>PROPERTY</Typography>
      <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.15 }}>{property?.title || property?.name || property?.code || 'Tenancy property'}</Typography>
      <Typography sx={{ mt: .5, fontSize: 12.5, opacity: .9 }}>{fullAddress(property?.address) || property?.map?.locality || 'Address not provided'}</Typography>
    </Box>
  </Box>;
}

function Metric({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: any }) {
  return <Paper variant="outlined" sx={{ height: '100%', p: { xs: 1.35, md: 1.6 }, borderRadius: 2.5, borderColor: 'rgba(11,82,112,.12)', background: 'linear-gradient(145deg,#fff,#F8FBFC)' }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}><Typography color="text.secondary" sx={{ fontSize: 11.5, fontWeight: 750 }}>{label}</Typography><Box sx={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 1.5, bgcolor: 'rgba(11,82,112,.08)', color: 'primary.main', flex: '0 0 auto' }}><Icon sx={{ fontSize: 17 }} /></Box></Stack>
    <Typography sx={{ mt: 1, fontSize: { xs: 17, md: 20 }, fontWeight: 900, color: 'text.primary', lineHeight: 1.2 }}>{value}</Typography>
    {hint && <Typography color="text.secondary" sx={{ mt: .45, fontSize: 10.5 }}>{hint}</Typography>}
  </Paper>;
}

function SectionCard({ title, subtitle, icon: Icon, children, action }: { title: string; subtitle?: string; icon?: any; children: any; action?: any }) {
  return <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, height: '100%', boxShadow: '0 8px 28px rgba(15,47,57,.035)' }}>
    <CardContent sx={{ p: { xs: 1.8, sm: 2.2, md: 2.5 }, '&:last-child': { pb: { xs: 1.8, sm: 2.2, md: 2.5 } } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
          {Icon && <Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', flex: '0 0 auto', color: 'primary.main', bgcolor: 'rgba(11,82,112,.075)', borderRadius: 1.7 }}><Icon sx={{ fontSize: 19 }} /></Box>}
          <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 880, fontSize: 15 }}>{title}</Typography>{subtitle && <Typography color="text.secondary" sx={{ fontSize: 11.5, mt: .15 }}>{subtitle}</Typography>}</Box>
        </Stack>
        {action}
      </Stack>
      {children}
    </CardContent>
  </Card>;
}

function InfoLine({ label, value }: { label: string; value: any }) {
  return <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} sx={{ py: .8, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0, pb: 0 } }}>
    <Typography color="text.secondary" sx={{ fontSize: 11.5, flex: '0 0 42%' }}>{label}</Typography>
    <Typography sx={{ fontSize: 12, fontWeight: 720, textAlign: 'right', overflowWrap: 'anywhere' }}>{value || '—'}</Typography>
  </Stack>;
}

export default function TenancyDetailsPage() {
  const { tenancyId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const actions = useActionDialog();
  const [data, setData] = useState<PropsData | null>(null);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'bank_transfer', transactionId: '', paidAt: new Date().toISOString().slice(0, 10), proofUrl: '', notes: '' });

  const load = useCallback(async () => {
    if (!tenancyId) return;
    setLoading(true); setError('');
    try { setData((await getTenancyDetails(tenancyId)).data); }
    catch (cause) { setError((cause as Error).message || 'Could not load this tenancy'); }
    finally { setLoading(false); }
  }, [tenancyId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    getAppConfiguration().then((result) => { if (active) { const granted = result.data.resourcePermissions?.tenancies; setPermissions(Array.isArray(granted) ? granted : null); } }).catch(() => { if (active) setPermissions(null); });
    return () => { active = false; };
  }, [user?._id, user?.role, user?.activeMode]);

  const tabFromUrl = searchParams.get('tab') as TabKey | null;
  const tab: TabKey = TAB_KEYS.includes(tabFromUrl as TabKey) ? tabFromUrl as TabKey : 'overview';
  const tenancy = data?.tenancy || {};
  const priorAgreements = (data?.agreementHistory || []).filter((agreement: any) => idOf(agreement) !== idOf(data?.agreement));
  const invoices = useMemo(() => [...(data?.invoices || [])].sort((a: any, b: any) => new Date(b.dueDate || b.createdAt || 0).getTime() - new Date(a.dueDate || a.createdAt || 0).getTime()), [data?.invoices]);
  const outstanding = invoices.filter(openInvoice).reduce((total: number, invoice: any) => total + invoiceBalance(invoice), 0);
  const overdueBalance = invoices.filter((invoice: any) => openInvoice(invoice) && (String(invoice.status || '').toLowerCase() === 'overdue' || new Date(invoice.dueDate).getTime() < Date.now())).reduce((total: number, invoice: any) => total + invoiceBalance(invoice), 0);
  const nextOpenInvoice = [...invoices].filter(openInvoice).sort((a: any, b: any) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())[0];
  const dueDate = nextOpenInvoice?.dueDate || data?.agreement?.nextDueAt || nextDueDate(tenancy.dueDay, tenancy.dueTime);
  const daysToDue = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  const rawStatus = String(tenancy.status || 'reserved').toLowerCase();
  const ended = ['closed', 'completed', 'cancelled'].includes(rawStatus);
  const endingSoon = !ended && (['notice', 'notice_period', 'vacating', 'move_out', 'move_out_inspection', 'final_calculation', 'landlord_review', 'final_payment', 'deposit_settlement'].includes(rawStatus) || (tenancy.endDate && (new Date(tenancy.endDate).getTime() - Date.now()) < 30 * 86400000));
  const overviewStatus = ended ? 'Ended' : overdueBalance > 0 ? 'Overdue' : outstanding > 0 ? 'Payment due' : endingSoon ? 'Ending soon' : rawStatus === 'active' ? 'Active' : nice(rawStatus);
  const tenant = tenancy.tenant || {};
  const landlord = tenancy.landlord || {};
  const viewerId = idOf(user);
  const landlordSide = data?.permissions?.participant === 'landlord' || data?.permissions?.participant === 'manager' || user?.role === 'admin';
  const contactPerson = landlordSide ? tenant : landlord;
  const contactLabel = landlordSide ? 'Tenant' : 'Landlord';
  const canManage = Boolean(data?.permissions?.canManage && landlordSide && (permissions === null || permissions.includes('edit')));
  const canReviewRentPayments = Boolean(data?.permissions?.participant === 'landlord' && viewerId === idOf(landlord));
  const canViewContacts = Boolean(data?.permissions?.canViewContacts && (viewerId === idOf(tenant) || viewerId === idOf(landlord) || ['admin', 'manager'].includes(String(user?.role || ''))));
  const targetSpace = tenancy.space || tenancy.rentalUnit || {};
  const property = tenancy.property || {};
  const openInvoices = invoices.filter(openInvoice);
  const linkedDocuments = useMemo(() => [
    ...(tenancy.lease?.documents || []).map((file: any, index: number) => ({ file, title: `Tenancy document ${index + 1}`, note: 'Lease attachment' })),
    ...(tenancy.evidence || []).map((entry: any, index: number) => ({ file: entry.file, title: entry.caption || `Tenancy evidence ${index + 1}`, note: nice(entry.category || 'Tenancy file') })),
    ...(tenancy.moveInInspection?.evidence || []).map((file: any, index: number) => ({ file, title: `Move-in inspection evidence ${index + 1}`, note: 'Move-in inspection' })),
    ...(tenancy.moveOutInspection?.evidence || []).map((file: any, index: number) => ({ file, title: `Move-out inspection evidence ${index + 1}`, note: 'Move-out inspection' })),
    ...(tenancy.notices || []).filter((entry: any) => entry.file).map((entry: any) => ({ file: entry.file, title: entry.title || 'Tenancy notice', note: dateText(entry.servedAt) })),
    ...(tenancy.moveOutSettlement?.settlementDocument ? [{ file: tenancy.moveOutSettlement.settlementDocument, title: 'Move-out settlement', note: 'Final deposit and balance record' }] : []),
    ...(tenancy.lease?.legalAgreement?.document ? [{ file: tenancy.lease.legalAgreement.document, title: `${tenancy.lease.leaseNumber || 'Lease'} agreement`, note: 'Signed lease document' }] : []),
    ...invoices.flatMap((invoice: any) => {
      const items: any[] = [];
      if (invoice.receiptFile) items.push({ file: invoice.receiptFile, title: `${invoice.invoiceNumber || invoice.billingMonth} receipt`, note: `Payment receipt · ${dateText(invoice.dueDate)}` });
      if (invoice.legalAgreement) items.push({ file: invoice.legalAgreement, title: `${invoice.invoiceNumber || invoice.billingMonth} invoice document`, note: 'Rent invoice attachment' });
      return items;
    }),
  ].filter((item: any) => fileId(item.file)), [invoices, tenancy]);
  const activeAgreement = data?.agreement && String(data.agreement.status || '').toLowerCase() === 'approved';
  const canRenew = Boolean(activeAgreement && !ended && ['landlord', 'tenant'].includes(String(data?.permissions?.participant || '')) && (data?.permissions?.participant === 'tenant' || canManage));
  const canEnd = Boolean(canManage && !ended && (idOf(tenancy.rentalUnit) || !data?.agreement || data?.permissions?.participant === 'landlord'));

  async function actionCall(work: () => Promise<any>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { const result = await work(); setNotice(result?.message || success); await load(); }
    catch (cause) { setError((cause as Error).message || 'That action could not be completed'); }
    finally { setBusy(false); }
  }

  async function sendReminder(invoice: any) {
    if (!invoice || !canManage) return;
    const accepted = await actions.askConfirmation(`Send ${tenant.name || 'the tenant'} a reminder for ${invoice.invoiceNumber || 'this rent cycle'}? Outstanding balance: ${money(invoiceBalance(invoice))}.`, { title: 'Send rent reminder' });
    if (accepted) await actionCall(() => sendTenancyRentReminder(tenancyId, idOf(invoice)), 'Rent reminder sent.');
  }

  function startPayment(invoice: any) {
    setPaymentInvoice(invoice);
    setPaymentForm((current) => ({ ...current, amount: String(invoiceBalance(invoice)), method: data?.permissions?.participant === 'tenant' ? 'upi' : 'bank_transfer', transactionId: '', paidAt: new Date().toISOString().slice(0, 10), proofUrl: '', notes: '' }));
    setError('');
  }

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    if (!paymentInvoice) return;
    setBusy(true); setError('');
    try {
      const tenantSide = data?.permissions?.participant === 'tenant';
      const result = tenantSide
        ? await submitRentalInvoicePayment(idOf(paymentInvoice), {
          method: paymentForm.method as 'upi' | 'card' | 'bank_transfer' | 'cash' | 'cheque' | 'gateway' | 'offline',
          transactionId: paymentForm.transactionId || undefined,
          proofUrl: paymentForm.proofUrl || undefined,
          notes: paymentForm.notes || undefined,
        })
        : await recordTenancyPayment(tenancyId, {
          invoiceId: idOf(paymentInvoice), amount: Number(paymentForm.amount), method: paymentForm.method,
          transactionId: paymentForm.transactionId || undefined, paidAt: paymentForm.paidAt,
          notes: paymentForm.notes || undefined,
        });
      setPaymentInvoice(null); setNotice(result.message || (tenantSide ? 'Payment submitted for landlord approval.' : 'Payment recorded.'));
      await load();
    } catch (cause) { setError((cause as Error).message || 'Payment could not be recorded'); }
    finally { setBusy(false); }
  }

  async function previewRentPaymentProof(payment: any) {
    const paymentId = idOf(payment);
    if (!paymentId) return;
    setBusy(true); setError('');
    const previewWindow = window.open('', '_blank');
    try {
      const blob = await fetchRentalPaymentProofBlob(paymentId);
      const url = URL.createObjectURL(blob);
      if (previewWindow) previewWindow.location.href = url; else window.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      previewWindow?.close();
      setError((cause as Error).message || 'Payment proof could not be opened');
    } finally { setBusy(false); }
  }

  async function approveRentPayment(payment: any) {
    if (!canReviewRentPayments) return;
    const accepted = await actions.askConfirmation(
      `Approve ${money(payment.amount || payment.paidAmount)} rent payment${payment.transactionId ? ` with transaction ID ${payment.transactionId}` : ''}? The linked monthly invoice will be updated to paid.`,
      { title: 'Approve rent payment' },
    );
    if (accepted) await actionCall(() => acceptRentalPayment(idOf(payment)), 'Rent payment approved and invoice updated.');
  }

  async function rejectRentPaymentReview(payment: any) {
    if (!canReviewRentPayments) return;
    const reason = await actions.askText(
      'Explain why this payment cannot be approved. The tenant will be able to correct and resubmit it.',
      { title: 'Reject rent payment', label: 'Rejection reason' },
    );
    if (!String(reason || '').trim()) return;
    await actionCall(() => rejectRentalPayment(idOf(payment), String(reason).trim()), 'Rent payment rejected.');
  }

  async function exportRentHistoryExcel() {
    const rows: Array<Array<string | number>> = [[
      'Billing Month','Invoice Number','Due Date','Invoice Total','Invoice Paid','Invoice Balance','Invoice Status',
      'Payment Amount','Payment Method','Transaction ID','Verification Status','Payment Status','Submitted At',
      'Approved/Paid At','Rejection Reason','Tenant','Property','Room / Unit',
    ]];
    invoices.forEach((invoice: any) => {
      const invoicePayments = invoice.payments || [];
      if (!invoicePayments.length) {
        rows.push([String(invoice.billingMonth || ''),String(invoice.invoiceNumber || ''),dateText(invoice.dueDate),Number(invoice.totalAmount || 0),Number(invoice.paidAmount || 0),invoiceBalance(invoice),nice(invoice.status),0,'','','Awaiting Tenant','','','','',String(tenant.name || ''),String(property.title || property.name || ''),String(targetSpace.name || targetSpace.roomNumber || targetSpace.code || '')]);
        return;
      }
      invoicePayments.forEach((entry: any) => {
        const payment = entry.payment || entry;
        rows.push([String(invoice.billingMonth || ''),String(invoice.invoiceNumber || ''),dateText(invoice.dueDate),Number(invoice.totalAmount || 0),Number(invoice.paidAmount || 0),invoiceBalance(invoice),nice(invoice.status),Number(entry.amount || payment.amount || payment.paidAmount || 0),nice(entry.method || payment.method),String(payment.transactionId || entry.transactionId || ''),nice(payment.paymentVerification?.status || entry.status || ''),nice(payment.status || entry.status || ''),dateText(payment.paymentVerification?.submittedAt || entry.submittedAt, true),dateText(payment.paymentVerification?.approvedAt || payment.paidAt || entry.acceptedAt, true),String(payment.paymentVerification?.rejectionReason || ''),String(tenant.name || ''),String(property.title || property.name || ''),String(targetSpace.name || targetSpace.roomNumber || targetSpace.code || '')]);
      });
    });
    await downloadXlsx(`rent-payment-history-${String(tenancy.tenancyNumber || tenancyId).replace(/[^a-z0-9_-]+/gi, '-')}.xlsx`, 'Rent Payment History', rows);
  }

  async function renew() {
    const agreementId = idOf(data?.agreement);
    if (!agreementId) return;
    const firstParty = canManage;
    if (firstParty) {
      const applicationId = idOf(tenancy.application);
      if (!applicationId) {
        setError('This tenancy has no linked application to start a new renewal agreement.');
        return;
      }
      navigate(`/app/application_details/${encodeURIComponent(applicationId)}?renew=1`);
      return;
    }
    const accepted = await actions.askConfirmation('Request a new renewal agreement from the landlord?', { title: 'Request renewal' });
    if (accepted) await actionCall(() => renewAgreementCycle(agreementId), 'Renewal request sent.');
  }

  async function endTenancy() {
    if (!canManage || ended) return;
    const roomTenancy = Boolean(idOf(tenancy.rentalUnit));
    const hasAgreement = Boolean(idOf(data?.agreement));
    const isFinalStep = rawStatus === 'deposit_settlement';
    const prompt = isFinalStep
      ? 'Close this tenancy after its inspection, final payment and deposit settlement are complete? This releases the room and records the tenancy as ended.'
      : roomTenancy
        ? 'Start the notice period for this tenancy? This begins the move-out process; the tenancy stays active through its inspection and final settlement steps.'
        : hasAgreement
          ? 'End this active rent or lease cycle now? The agreement and its linked tenancy will be marked as ended.'
          : 'Start the tenancy end process by marking it as notice. Confirm before continuing.';
    if (!await actions.askConfirmation(prompt, { title: isFinalStep ? 'Close tenancy' : roomTenancy ? 'Start notice period' : 'End tenancy', danger: true })) return;
    const work = async () => {
      if (roomTenancy && rawStatus === 'active') return transitionRentalTenancy(tenancyId, { action: 'serve_notice', reason: 'Notice period started from tenancy details.' });
      if (roomTenancy && rawStatus === 'notice_period') return transitionRentalTenancy(tenancyId, { action: 'start_vacating', reason: 'Move-out started from tenancy details.' });
      if (roomTenancy && isFinalStep) return transitionRentalTenancy(tenancyId, { action: 'close_tenancy', reason: 'Final payment and deposit settlement completed.' });
      if (!roomTenancy && hasAgreement) return cancelAgreementCycle(idOf(data?.agreement));
      return changeResourceStatus('tenancies', tenancyId, 'notice', 'Notice period started from tenancy details.');
    };
    await actionCall(work, roomTenancy && !isFinalStep ? 'Move-out process started.' : 'Tenancy ended.');
  }

  async function openAgreement(download = false, agreement: any = data?.agreement) {
    const agreementId = idOf(agreement);
    if (!agreementId) return;
    setBusy(true); setError('');
    const previewWindow = download ? null : window.open('', '_blank');
    try {
      const blob = await fetchAgreementPreviewBlob(agreementId);
      const url = URL.createObjectURL(blob);
      if (download) {
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${String(agreement?.renderedTitle || 'tenancy-agreement').replace(/[^a-z0-9_-]+/gi, '-')}.pdf`; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      } else {
        if (previewWindow) previewWindow.location.href = url;
        else window.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (cause) { previewWindow?.close(); setError((cause as Error).message || 'Agreement could not be opened'); }
    finally { setBusy(false); }
  }

  const activity = useMemo(() => {
    const events: Array<{ at: any; title: string; detail?: string; tone?: string; key: string }> = [];
    if (tenancy.createdAt) events.push({ at: tenancy.createdAt, title: 'Tenancy record created', detail: tenancy.tenancyNumber || `Tenancy ${idOf(tenancy).slice(-8)}`, key: `created-${idOf(tenancy)}` });
    (tenancy.statusHistory || []).forEach((entry: any, index: number) => events.push({ at: entry.changedAt, title: `Status changed to ${nice(entry.to)}`, detail: entry.reason || (entry.from ? `From ${nice(entry.from)}` : ''), key: `status-${index}` }));
    (tenancy.notices || []).forEach((entry: any, index: number) => events.push({ at: entry.servedAt, title: entry.title || 'Tenancy notice sent', detail: entry.effectiveAt ? `Effective ${dateText(entry.effectiveAt)}` : entry.message, key: `notice-${index}` }));
    (data?.agreement?.renewalHistory || []).forEach((entry: any, index: number) => events.push({ at: entry.approvedAt || entry.requestedAt, title: 'Tenancy renewed', detail: entry.cycleEndsAt ? `New end date ${dateText(entry.cycleEndsAt)}` : '', key: `renewal-${index}` }));
    if (data?.agreement?.signedAt || data?.agreement?.secondPartySignedAt || data?.agreement?.firstPartyApprovalAt) events.push({ at: data.agreement.firstPartyApprovalAt || data.agreement.signedAt || data.agreement.secondPartySignedAt, title: 'Agreement signed and approved', detail: data.agreement.renderedTitle || `${nice(data.agreement.agreementType)} agreement`, key: 'agreement-signed' });
    (data?.agreementHistory || []).forEach((entry: any) => {
      if (entry._id === idOf(data?.agreement)) return;
      events.push({ at: entry.firstPartyApprovalAt || entry.signedAt || entry.createdAt, title: entry.renewalOf ? 'Renewal agreement completed' : 'Prior agreement retained', detail: `${entry.renderedTitle || `${nice(entry.agreementType)} agreement`} · ${Number(entry.durationMonths || entry.cycleTermMonths || 0) || 'Term'} month(s) · ${dateText(entry.startDate || entry.cycleStartedAt)} – ${dateText(entry.endDate || entry.cycleEndsAt)}`, key: `agreement-history-${idOf(entry)}` });
    });
    invoices.forEach((invoice: any) => {
      if (invoice.lastReminderAt) events.push({ at: invoice.lastReminderAt, title: 'Rent reminder sent', detail: invoice.invoiceNumber, key: `reminder-${idOf(invoice)}` });
      (invoice.payments || []).forEach((entry: any, index: number) => {
        const payment = entry.payment || entry;
        const paidAt = payment.paidAt || entry.paidAt || entry.acceptedAt;
        if (paidAt || ['approved', 'paid'].includes(String(payment.status || entry.status || '').toLowerCase())) events.push({ at: paidAt || entry.acceptedAt, title: 'Rent payment recorded', detail: `${money(entry.amount || payment.paidAmount || payment.amount)} · ${nice(entry.method || payment.method)} · ${invoice.invoiceNumber}`, key: `payment-${idOf(invoice)}-${index}` });
      });
    });
    return events.filter((event) => event.at).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [data?.agreement, invoices, tenancy]);

  const downloadFile = async (file: any, name: string) => {
    const id = fileId(file);
    if (!id) return;
    setBusy(true); setError('');
    try { await downloadDriveFile(id, name); }
    catch (cause) { setError((cause as Error).message || 'The file could not be downloaded'); }
    finally { setBusy(false); }
  };

  if (loading && !data) return <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><Stack alignItems="center" spacing={1.2}><CircularProgress size={26} /><Typography color="text.secondary" sx={{ fontSize: 13 }}>Opening tenancy details…</Typography></Stack></Box>;
  if (error && !data) return <Box sx={{ maxWidth: 760, mx: 'auto', px: 2 }}><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>}>{error}</Alert><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/app/tenancies')} sx={{ mt: 1.5 }}>Back to tenancies</Button></Box>;
  if (!data) return null;

  const dueLabel = daysToDue < 0 ? `${Math.abs(daysToDue)} day${daysToDue === -1 ? '' : 's'} overdue` : daysToDue === 0 ? 'Due today' : `${daysToDue} day${daysToDue === 1 ? '' : 's'} remaining`;
  const unitName = targetSpace.roomNumber || targetSpace.flatNumber || targetSpace.apartmentNumber || targetSpace.name || targetSpace.roomName || targetSpace.code || 'Whole property';
  const floorName = targetSpace.floor?.floorName || targetSpace.floor?.name || targetSpace.floorName || targetSpace.floorNumber || '';
  const keyDetails = [targetSpace.specifications?.roomType, targetSpace.specifications?.furnishingStatus, targetSpace.specifications?.bedroomCount ? `${targetSpace.specifications.bedroomCount} bed` : '', targetSpace.specifications?.bathroomCount ? `${targetSpace.specifications.bathroomCount} bath` : ''].filter(Boolean).map(nice).join(' · ');
  const statusColor = overviewStatus === 'Active' ? 'success' : ['Payment due', 'Ending soon'].includes(overviewStatus) ? 'warning' : overviewStatus === 'Overdue' ? 'error' : 'default';

  return <Box data-secureasset-tenancy-details="tabbed-tenancy-details-v1" sx={{ px: { xs: 1.5, sm: 2.5, lg: 3.5 }, pb: 5, maxWidth: 1600, mx: 'auto' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1.3} sx={{ mb: 2 }}>
      <Box><Button component={Link} to="/app/tenancies" startIcon={<ArrowBackRounded />} size="small" sx={{ pl: 0, mb: .35 }}>All tenancies</Button><Typography variant="h4" sx={{ fontSize: { xs: 23, md: 29 }, fontWeight: 950, letterSpacing: '-.035em', lineHeight: 1.15 }}>Tenancy overview</Typography><Typography color="text.secondary" sx={{ mt: .5, fontSize: 12.5 }}>{tenancy.tenancyNumber || `Agreement ${idOf(tenancy).slice(-8)}`} · {tenant.name || 'Tenant'} · {property.title || property.name || 'Property'}</Typography></Box>
      <Stack direction="row" gap={.8} flexWrap="wrap" alignItems="center">
        <Chip color={statusColor as any} label={overviewStatus} sx={{ fontWeight: 820, borderRadius: 1.7 }} />
        {tenancy.agreement?.agreementNumber && <Chip variant="outlined" icon={<ShieldRounded />} label={`Agreement ${tenancy.agreement.agreementNumber}`} sx={{ borderRadius: 1.7 }} />}
        <Tooltip title="Refresh tenancy details"><IconButton aria-label="Refresh tenancy details" size="small" onClick={() => void load()}><ReplayRounded fontSize="small" /></IconButton></Tooltip>
      </Stack>
    </Stack>

    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1.5 }}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 1.5 }}>{notice}</Alert>}

    <Grid container spacing={{ xs: 1, md: 1.5 }} sx={{ mb: 1.8 }}>
      <Grid size={{ xs: 6, md: 3 }}><Metric label="Monthly rent" value={money(tenancy.monthlyRent)} hint={`Due on day ${tenancy.dueDay || '—'} · ${tenancy.dueTime || '—'}`} icon={PaymentsRounded} /></Grid>
      <Grid size={{ xs: 6, md: 3 }}><Metric label="Security deposit" value={money(tenancy.securityDeposit)} hint="Held against the tenancy" icon={ShieldRounded} /></Grid>
      <Grid size={{ xs: 6, md: 3 }}><Metric label="Next due date" value={dateText(dueDate)} hint={dueLabel} icon={CalendarMonthRounded} /></Grid>
      <Grid size={{ xs: 6, md: 3 }}><Metric label="Overdue balance" value={money(overdueBalance)} hint={outstanding > overdueBalance ? `${money(outstanding)} total outstanding` : 'Across unpaid rent cycles'} icon={ReceiptLongRounded} /></Grid>
    </Grid>

    <Paper variant="outlined" sx={{ borderRadius: 2.5, mb: 1.8, px: { xs: .5, sm: 1.2 }, borderColor: 'divider', overflow: 'auto' }}>
      <Tabs value={tab} variant="scrollable" scrollButtons="auto" onChange={(_event, value: TabKey) => { const query = new URLSearchParams(searchParams); query.set('tab', value); setSearchParams(query, { replace: true }); }} aria-label="Tenancy detail sections" sx={{ minHeight: 48, '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontSize: 12, fontWeight: 790, px: { xs: 1.3, sm: 2 } }, '& .MuiTabs-indicator': { height: 3, borderRadius: 3 } }}>
        <Tab value="overview" icon={<HomeWorkRounded sx={{ fontSize: 17 }} />} iconPosition="start" label="Overview" />
        <Tab value="rent" icon={<PaymentsRounded sx={{ fontSize: 17 }} />} iconPosition="start" label="Rent & Payments" />
        <Tab value="documents" icon={<DescriptionRounded sx={{ fontSize: 17 }} />} iconPosition="start" label="Agreement & Documents" />
        <Tab value="activity" icon={<HistoryRounded sx={{ fontSize: 17 }} />} iconPosition="start" label="Activity" />
      </Tabs>
    </Paper>

    {tab === 'overview' && <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, lg: 7 }}><SectionCard title="Property & room" subtitle="The home and unit covered by this tenancy" icon={HomeWorkRounded}><Grid container spacing={1.5}><Grid size={{ xs: 12, sm: 6 }}><PropertyCover property={property} /></Grid><Grid size={{ xs: 12, sm: 6 }}><Stack spacing={0}><InfoLine label="Property" value={property.title || property.name || property.code} /><InfoLine label="Address" value={fullAddress(property.address) || property.map?.locality} /><InfoLine label="Room / unit" value={unitName} /><InfoLine label="Floor" value={floorName} /><InfoLine label="Key details" value={keyDetails} /><InfoLine label="Monthly rent" value={money(tenancy.monthlyRent)} /><InfoLine label="Deposit" value={money(tenancy.securityDeposit)} /></Stack></Grid></Grid></SectionCard></Grid>
      <Grid size={{ xs: 12, lg: 5 }}><SectionCard title="Tenant" subtitle="Tenant details attached to this agreement" icon={PersonRounded}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.5 }}><Avatar src={tenant.avatar || undefined} sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontWeight: 850 }}>{(tenant.name || 'T').slice(0, 1).toUpperCase()}</Avatar><Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 880 }}>{tenant.name || 'Tenant details'}</Typography><Typography color="text.secondary" sx={{ fontSize: 11.5 }}>{nice(tenancy.status)} · {tenancy.application?.expectedStayMonths ? `${tenancy.application.expectedStayMonths} month expected stay` : 'Agreement participant'}</Typography></Box></Stack>
        {canViewContacts ? <><InfoLine label="Tenant email" value={tenant.email ? <a href={`mailto:${tenant.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{tenant.email}</a> : 'Not provided'} /><InfoLine label="Tenant phone" value={tenant.phone ? <a href={`tel:${tenant.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{tenant.phone}</a> : 'Not provided'} /><InfoLine label="Move-in date" value={dateText(tenancy.application?.moveInDate || tenancy.startDate)} />{landlordSide && <Stack direction="row" gap={.7} sx={{ mt: 1.4 }}>{tenant.phone && <Button component="a" href={`tel:${tenant.phone}`} size="small" variant="outlined" startIcon={<CallRounded />}>Call tenant</Button>}{tenant.email && <Button component="a" href={`mailto:${tenant.email}`} size="small" variant="outlined" startIcon={<EmailRounded />}>Email tenant</Button>}</Stack>}</> : <Alert severity="info" sx={{ fontSize: 12 }}>Tenant contact information is hidden by your tenancy permissions.</Alert>}
        {!landlordSide && canViewContacts && <Box sx={{ mt: 1.5, p: 1.2, borderRadius: 2, bgcolor: 'rgba(11,82,112,.04)', border: '1px solid', borderColor: 'divider' }}><Typography sx={{ fontSize: 11.5, fontWeight: 850 }}>Contact {contactLabel.toLowerCase()}</Typography><Typography sx={{ mt: .25, fontWeight: 760, fontSize: 12 }}>{contactPerson.name || 'Property contact'}</Typography><Stack direction="row" gap={.6} sx={{ mt: .65 }}>{contactPerson.phone && <Button component="a" href={`tel:${contactPerson.phone}`} size="small" startIcon={<CallRounded />}>Call</Button>}{contactPerson.email && <Button component="a" href={`mailto:${contactPerson.email}`} size="small" startIcon={<EmailRounded />}>Email</Button>}</Stack></Box>}
        {(tenancy.occupants || []).length > 0 && <Box sx={{ mt: 2 }}><Typography sx={{ fontSize: 11.5, fontWeight: 800, mb: .6 }}>Additional occupants</Typography>{tenancy.occupants.map((occupant: any) => <Chip key={idOf(occupant)} size="small" variant="outlined" label={`${occupant.fullName || occupant.name || 'Occupant'}${occupant.relationship ? ` · ${nice(occupant.relationship)}` : ''}`} sx={{ mr: .5, mb: .5 }} />)}</Box>}
      </SectionCard></Grid>
      <Grid size={{ xs: 12, lg: 7 }}><SectionCard title="Tenancy terms" subtitle="Agreement duration, dates and monthly billing schedule" icon={EventAvailableRounded}><Grid container spacing={1.2}><Grid size={{ xs: 6, md: 3 }}><Typography variant="caption" color="text.secondary">Start date</Typography><Typography sx={{ mt: .25, fontWeight: 820, fontSize: 12.5 }}>{dateText(tenancy.startDate)}</Typography></Grid><Grid size={{ xs: 6, md: 3 }}><Typography variant="caption" color="text.secondary">End date</Typography><Typography sx={{ mt: .25, fontWeight: 820, fontSize: 12.5 }}>{dateText(tenancy.endDate)}</Typography></Grid><Grid size={{ xs: 6, md: 3 }}><Typography variant="caption" color="text.secondary">Agreement duration</Typography><Typography sx={{ mt: .25, fontWeight: 820, fontSize: 12.5 }}>{Number(tenancy.durationMonths || data.agreement?.durationMonths || data.agreement?.cycleTermMonths || 0) ? `${tenancy.durationMonths || data.agreement?.durationMonths || data.agreement?.cycleTermMonths} months` : data.agreement?.agreementType === 'lease' ? '12 months' : '—'}</Typography></Grid><Grid size={{ xs: 6, md: 3 }}><Typography variant="caption" color="text.secondary">Rent due day</Typography><Typography sx={{ mt: .25, fontWeight: 820, fontSize: 12.5 }}>Day {tenancy.dueDay || '—'} · {tenancy.dueTime || '—'}</Typography></Grid><Grid size={{ xs: 6, md: 3 }}><Typography variant="caption" color="text.secondary">Next due</Typography><Typography sx={{ mt: .25, fontWeight: 820, fontSize: 12.5 }}>{dateText(dueDate)}</Typography><Typography color="text.secondary" sx={{ fontSize: 10.5 }}>{dueLabel}</Typography></Grid></Grid><Typography color="text.secondary" sx={{ mt: 1, fontSize: 10.8 }}>Rent invoices and due dates continue monthly for the full agreement term.</Typography></SectionCard></Grid>
      <Grid size={{ xs: 12, lg: 5 }}><SectionCard title="Quick actions" subtitle="Actions shown for your tenancy permissions" icon={CheckCircleRounded}>
        <Stack direction="row" flexWrap="wrap" gap={.8}>
          {canManage && openInvoices.length > 0 && <Button disabled={busy} size="small" variant="contained" startIcon={<SendRounded />} onClick={() => void sendReminder(openInvoices[0])}>Send rent reminder</Button>}
          {openInvoices.length > 0 && (canManage || data?.permissions?.participant === 'tenant') && <Button disabled={busy} size="small" variant={canManage ? 'outlined' : 'contained'} startIcon={<PaymentsRounded />} onClick={() => startPayment(openInvoices[0])}>Record payment</Button>}
          {data?.agreement && <Button disabled={busy} size="small" variant="outlined" startIcon={<DescriptionRounded />} onClick={() => void openAgreement()}>View agreement</Button>}
          {canRenew && <Button disabled={busy} size="small" variant="outlined" startIcon={<ReplayRounded />} onClick={() => void renew()}>{canManage ? 'Prepare renewal agreement' : 'Request renewal'}</Button>}
          {canEnd && ['active', 'notice_period', 'deposit_settlement'].includes(rawStatus) && <Button disabled={busy} size="small" variant="outlined" color="error" onClick={() => void endTenancy()}>{rawStatus === 'notice_period' ? 'Start move-out' : rawStatus === 'deposit_settlement' ? 'Close tenancy' : 'End tenancy'}</Button>}
          {!openInvoices.length && ended && <Chip size="small" variant="outlined" label="Tenancy completed" />}
        </Stack>
        {rawStatus === 'move_out_inspection' && canManage && <Alert severity="info" sx={{ mt: 1.3, fontSize: 11.5 }}>Complete the final balance and deposit settlement before closing this tenancy.</Alert>}
      </SectionCard></Grid>
    </Grid>}

    {tab === 'rent' && <Stack spacing={1.5}>
      {overdueBalance > 0 && <Alert severity="error" sx={{ borderRadius: 2.5 }}><strong>{money(overdueBalance)} overdue.</strong> Open cycles below show the due date and remaining amount.</Alert>}
      <SectionCard title="Rent and payment history" subtitle="Monthly invoices, tenant payment submissions, landlord review and receipts" icon={ReceiptLongRounded} action={<Stack direction="row" spacing={.7} alignItems="center">{canReviewRentPayments && <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => void exportRentHistoryExcel()}>Export Excel</Button>}<Chip size="small" variant="outlined" label={`${invoices.length} cycle${invoices.length === 1 ? '' : 's'}`} /></Stack>}>
        {invoices.length ? <Stack spacing={1}>
          {invoices.map((invoice: any) => {
            const balance = invoiceBalance(invoice);
            const payments = invoice.payments || [];
            const receipt = invoice.receiptFile;
            return <Paper key={idOf(invoice)} variant="outlined" sx={{ p: { xs: 1.25, sm: 1.7 }, borderRadius: 2.4, borderColor: 'rgba(11,82,112,.13)' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.1}>
                <Box sx={{ minWidth: 0 }}><Stack direction="row" spacing={.8} flexWrap="wrap" alignItems="center"><Typography sx={{ fontSize: 13, fontWeight: 900 }}>{invoice.billingMonth || dateText(invoice.dueDate)}</Typography><Chip size="small" label={nice(invoice.status)} color={invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'error' : invoice.status === 'partially_paid' ? 'warning' : 'default'} sx={{ height: 22, fontWeight: 760 }} /></Stack><Typography color="text.secondary" sx={{ mt: .4, fontSize: 11.3 }}>Invoice {invoice.invoiceNumber || idOf(invoice).slice(-8)} · Due {dateText(invoice.dueDate)}</Typography></Box>
                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ color: 'text.secondary' }}><Box><Typography sx={{ fontSize: 10.5 }}>Amount due</Typography><Typography sx={{ fontSize: 12, fontWeight: 850, color: 'text.primary' }}>{money(invoice.totalAmount)}</Typography></Box><Box><Typography sx={{ fontSize: 10.5 }}>Paid</Typography><Typography sx={{ fontSize: 12, fontWeight: 850, color: 'text.primary' }}>{money(invoice.paidAmount)}</Typography></Box><Box><Typography sx={{ fontSize: 10.5 }}>Balance</Typography><Typography sx={{ fontSize: 12, fontWeight: 900, color: balance > 0 ? 'error.main' : 'success.main' }}>{money(balance)}</Typography></Box></Stack>
              </Stack>
              {payments.length > 0 && <Stack spacing={.8} sx={{ mt: 1.2 }}>
                {payments.map((entry: any, index: number) => {
                  const payment = entry.payment || entry;
                  const verification = String(payment.paymentVerification?.status || entry.status || payment.status || 'pending').toLowerCase();
                  const submitted = verification === 'submitted';
                  const approved = verification === 'approved' || String(payment.status || '').toLowerCase() === 'paid';
                  const rejected = verification === 'rejected';
                  const proofAvailable = Boolean(payment.proofUrl || payment.proofFile);
                  return <Paper key={`${idOf(payment) || index}`} variant="outlined" sx={{ p: 1.1, borderRadius: 2, bgcolor: submitted ? 'rgba(2,136,209,.035)' : approved ? 'rgba(12,145,98,.035)' : rejected ? 'rgba(211,47,47,.03)' : '#fff' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={.7}>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={.65} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography sx={{ fontSize: 12, fontWeight: 850 }}>{money(entry.amount || payment.amount || payment.paidAmount)}</Typography>
                          <Chip size="small" label={approved ? 'Paid' : submitted ? 'Awaiting landlord approval' : rejected ? 'Rejected' : nice(verification)} color={approved ? 'success' : submitted ? 'info' : rejected ? 'error' : 'default'} sx={{ height: 22, fontSize: 9.5, fontWeight: 800 }} />
                        </Stack>
                        <Typography color="text.secondary" sx={{ mt: .3, fontSize: 10.8 }}>{nice(entry.method || payment.method)}{payment.transactionId ? ` · Transaction ${payment.transactionId}` : ''}</Typography>
                        <Typography color="text.secondary" sx={{ mt: .15, fontSize: 10.5 }}>Submitted {dateText(payment.paymentVerification?.submittedAt || entry.submittedAt || payment.createdAt, true)}{approved ? ` · Approved ${dateText(payment.paymentVerification?.approvedAt || payment.paidAt || entry.acceptedAt, true)}` : ''}</Typography>
                        {rejected && payment.paymentVerification?.rejectionReason && <Typography color="error.main" sx={{ mt: .35, fontSize: 10.8, fontWeight: 700 }}>Reason: {payment.paymentVerification.rejectionReason}</Typography>}
                        {payment.notes && <Typography color="text.secondary" sx={{ mt: .3, fontSize: 10.6 }}>Note: {payment.notes}</Typography>}
                      </Box>
                      <Stack direction="row" flexWrap="wrap" gap={.55} alignItems="center">
                        {proofAvailable && <Button size="small" variant="outlined" startIcon={<DescriptionRounded />} disabled={busy} onClick={() => void previewRentPaymentProof(payment)}>Review proof</Button>}
                        {canReviewRentPayments && submitted && <>
                          <Button size="small" variant="contained" color="success" startIcon={<CheckCircleRounded />} disabled={busy} onClick={() => void approveRentPayment(payment)}>Approve payment</Button>
                          <Button size="small" variant="outlined" color="error" disabled={busy} onClick={() => void rejectRentPaymentReview(payment)}>Reject</Button>
                        </>}
                      </Stack>
                    </Stack>
                  </Paper>;
                })}
              </Stack>}
              <Stack direction="row" flexWrap="wrap" gap={.6} sx={{ mt: 1.1 }}>
                {balance > 0 && (canManage || data.permissions?.participant === 'tenant') && <Button size="small" variant="outlined" startIcon={<PaymentsRounded />} onClick={() => startPayment(invoice)}>Record payment</Button>}
                {canManage && balance > 0 && <Button size="small" startIcon={<SendRounded />} onClick={() => void sendReminder(invoice)}>Send reminder</Button>}
                {receipt && <Button size="small" startIcon={<DownloadRounded />} onClick={() => void downloadFile(receipt, `${invoice.invoiceNumber || 'rent'}-receipt`)}>Download receipt</Button>}
                {invoice.legalAgreement && <Button size="small" startIcon={<DownloadRounded />} onClick={() => void downloadFile(invoice.legalAgreement, `${invoice.invoiceNumber || 'rent'}-document`)}>Invoice document</Button>}
                {invoice.lastReminderAt && <Typography color="text.secondary" sx={{ alignSelf: 'center', ml: .5, fontSize: 10.5 }}>Reminder sent {dateText(invoice.lastReminderAt, true)}</Typography>}
              </Stack>
            </Paper>;
          })}
        </Stack> : <Alert severity="info">No rent invoices are linked to this tenancy yet. New rent cycles appear here after billing is started.</Alert>}
      </SectionCard>
    </Stack>}

    {tab === 'documents' && <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, lg: 7 }}><SectionCard title="Agreement" subtitle="Signature, term and agreement status" icon={DescriptionRounded} action={data.agreement && <Button size="small" startIcon={<DownloadRounded />} onClick={() => void openAgreement(true)}>Download</Button>}>
        {data.agreement || tenancy.lease ? <>
          <Stack spacing={0}>
            <InfoLine label="Agreement" value={data.agreement?.renderedTitle || (data.agreement?.agreementType && `${nice(data.agreement.agreementType)} agreement`) || tenancy.lease?.leaseNumber || 'Tenancy agreement'} />
            <InfoLine label="Status" value={nice(data.agreement?.status || tenancy.lease?.status)} />
            <InfoLine label="Duration" value={Number(data.agreement?.durationMonths || data.agreement?.cycleTermMonths || tenancy.durationMonths || 0) ? `${data.agreement?.durationMonths || data.agreement?.cycleTermMonths || tenancy.durationMonths} months` : data.agreement?.agreementType === 'lease' ? '12 months' : '—'} />
            <InfoLine label="Agreement dates" value={`${dateText(data.agreement?.startDate || data.agreement?.cycleStartedAt || tenancy.lease?.startDate || tenancy.startDate)} – ${dateText(data.agreement?.endDate || data.agreement?.cycleEndsAt || tenancy.lease?.endDate || tenancy.endDate)}`} />
            <InfoLine label="Signed on" value={dateText(data.agreement?.signedAt || data.agreement?.secondPartySignedAt || tenancy.lease?.legalAgreement?.signedAt)} />
            <InfoLine label="Approved by landlord" value={data.agreement?.firstPartyApprovalAt ? dateText(data.agreement.firstPartyApprovalAt) : tenancy.lease?.legalAgreement?.status === 'signed' ? 'Signed' : data.agreement ? 'Awaiting approval' : '—'} />
          </Stack>
          <Grid container spacing={1} sx={{ mt: 1.5 }}>
            <Grid size={{ xs: 6 }}><Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Landlord signature</Typography><Typography sx={{ mt: .25, fontWeight: 800, fontSize: 12 }}>{data.agreement?.firstPartySignedAt || data.agreement?.firstPartyMark?.file || tenancy.lease?.signature?.managerSignedAt ? 'Signed' : 'Pending'}</Typography></Paper></Grid>
            <Grid size={{ xs: 6 }}><Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Tenant signature</Typography><Typography sx={{ mt: .25, fontWeight: 800, fontSize: 12 }}>{data.agreement?.secondPartySignedAt || data.agreement?.secondPartySignature?.file || tenancy.lease?.signature?.tenantSignedAt ? 'Signed' : 'Pending'}</Typography></Paper></Grid>
          </Grid>
          <Stack direction="row" gap={.8} sx={{ mt: 1.5 }}>
            {data.agreement && <><Button size="small" variant="contained" startIcon={<DescriptionRounded />} onClick={() => void openAgreement()}>View agreement</Button><Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => void openAgreement(true)}>Download PDF</Button></>}
            {tenancy.lease?.legalAgreement?.document && <Button size="small" variant="outlined" startIcon={<DownloadRounded />} onClick={() => void downloadFile(tenancy.lease.legalAgreement.document, `${tenancy.lease.leaseNumber || 'lease'}-agreement`)}>Lease file</Button>}
          </Stack>
        </> : <Alert severity="info">No agreement has been linked to this tenancy.</Alert>}
      </SectionCard></Grid>
      <Grid size={{ xs: 12, lg: 5 }}><SectionCard title="Tenancy documents" subtitle="Receipts and files attached to rent cycles" icon={ShieldRounded}>
        <Stack spacing={.8}>
          {linkedDocuments.map((item: any, index: number) => <Paper key={`${fileId(item.file)}-${index}`} variant="outlined" sx={{ p: 1.1, borderRadius: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}><Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: 'rgba(11,82,112,.08)', borderRadius: 1.5 }}><ReceiptLongRounded fontSize="small" /></Box><Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontWeight: 800, fontSize: 11.8 }}>{item.title}</Typography><Typography color="text.secondary" sx={{ fontSize: 10.5 }}>{item.note}</Typography></Box></Stack><IconButton aria-label={`Download ${item.title}`} size="small" onClick={() => void downloadFile(item.file, item.title)}><DownloadRounded fontSize="small" /></IconButton></Stack></Paper>)}
          {!linkedDocuments.length && <Alert severity="info">Related receipts and tenancy files will appear here once attached.</Alert>}
        </Stack>
      </SectionCard></Grid>
      {priorAgreements.length > 0 && <Grid size={{ xs: 12 }}><SectionCard title="Agreement history" subtitle="Renewals create a new agreement and keep every signed copy available" icon={HistoryRounded}>
        <Stack spacing={.8}>{priorAgreements.map((entry: any) => <Paper key={idOf(entry)} variant="outlined" sx={{ p: 1.15, borderRadius: 2.1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
            <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 850, fontSize: 12.5 }}>{entry.renderedTitle || `${nice(entry.agreementType)} agreement`}{entry.renewalOf ? ' · Renewal' : ''}</Typography><Typography color="text.secondary" sx={{ fontSize: 10.8 }}>{Number(entry.durationMonths || entry.cycleTermMonths || 0) ? `${entry.durationMonths || entry.cycleTermMonths} months · ` : ''}{dateText(entry.startDate || entry.cycleStartedAt)} – {dateText(entry.endDate || entry.cycleEndsAt)} · {nice(entry.status)}</Typography></Box>
            <Stack direction="row" gap={.5}><Button size="small" startIcon={<DescriptionRounded />} onClick={() => void openAgreement(false, entry)}>View</Button><Button size="small" startIcon={<DownloadRounded />} onClick={() => void openAgreement(true, entry)}>Download</Button></Stack>
          </Stack>
        </Paper>)}</Stack>
      </SectionCard></Grid>}
    </Grid>}

    {tab === 'activity' && <SectionCard title="Activity history" subtitle="Agreement, payment, reminders and tenancy status events" icon={HistoryRounded}>
      {activity.length ? <Stack spacing={0} sx={{ ml: .35 }}>{activity.map((event, index) => <Stack key={event.key} direction="row" spacing={1.3} sx={{ minHeight: 70 }}><Stack alignItems="center" sx={{ width: 16, flex: '0 0 auto' }}><Box sx={{ width: 11, height: 11, mt: .35, borderRadius: '50%', bgcolor: index === 0 ? 'primary.main' : 'rgba(11,82,112,.28)', boxShadow: index === 0 ? '0 0 0 4px rgba(11,82,112,.10)' : 'none' }} />{index < activity.length - 1 && <Box sx={{ flex: 1, width: 1, bgcolor: 'divider', minHeight: 45 }} />}</Stack><Box sx={{ pb: 1.8 }}><Typography sx={{ fontSize: 12.5, fontWeight: 850 }}>{event.title}</Typography><Typography color="text.secondary" sx={{ fontSize: 11.2, mt: .15 }}>{event.detail}</Typography><Typography color="text.secondary" sx={{ fontSize: 10.5, mt: .4 }}>{dateText(event.at, true)}</Typography></Box></Stack>)}</Stack> : <Alert severity="info">No activity has been recorded yet.</Alert>}
    </SectionCard>}

    {actions.dialogs}

    <ProfessionalDialog open={Boolean(paymentInvoice)} onClose={() => !busy && setPaymentInvoice(null)} fullWidth maxWidth="sm" professionalTitle={data.permissions?.participant === 'tenant' ? 'Submit rent payment' : 'Record received payment'} professionalSubtitle="Update this monthly rent cycle" enableMinimize={false}>
      <form onSubmit={submitPayment}><DialogTitle sx={{ fontWeight: 900 }}>{data.permissions?.participant === 'tenant' ? 'Submit rent payment' : 'Record received payment'}</DialogTitle><DialogContent>
        <Alert severity={data.permissions?.participant === 'tenant' ? 'info' : 'success'} sx={{ mb: 1.5, mt: .2, borderRadius: 2 }}>Invoice {paymentInvoice?.invoiceNumber || '—'} · Outstanding balance {money(invoiceBalance(paymentInvoice))}{data.permissions?.participant === 'tenant' ? '. Your landlord will review the payment.' : '. Record a payment already received outside SecureAsset.'}</Alert>
        <Stack spacing={1.3}>
          {data.permissions?.participant !== 'tenant' && <TextField required type="number" label="Amount received" value={paymentForm.amount} inputProps={{ min: .01, max: invoiceBalance(paymentInvoice), step: .01 }} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />}
          <TextField select label="Payment method" value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))}>{(data.permissions?.participant === 'tenant' ? ['upi', 'card', 'bank_transfer', 'cash', 'cheque', 'gateway', 'offline'] : ['upi', 'bank_transfer', 'cash', 'cheque', 'offline']).map((method) => <MenuItem key={method} value={method}>{nice(method)}</MenuItem>)}</TextField>
          {data.permissions?.participant !== 'tenant' && <TextField type="date" label="Payment date" InputLabelProps={{ shrink: true }} value={paymentForm.paidAt} onChange={(event) => setPaymentForm((current) => ({ ...current, paidAt: event.target.value }))} />}
          <TextField label="Transaction reference" value={paymentForm.transactionId} onChange={(event) => setPaymentForm((current) => ({ ...current, transactionId: event.target.value }))} />
          {data.permissions?.participant === 'tenant' && <TextField label="Payment proof URL (optional)" value={paymentForm.proofUrl} onChange={(event) => setPaymentForm((current) => ({ ...current, proofUrl: event.target.value }))} />}
          <TextField label="Notes" multiline minRows={2} value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} />
        </Stack>
      </DialogContent><DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setPaymentInvoice(null)} disabled={busy}>Cancel</Button><Button type="submit" variant="contained" disabled={busy} startIcon={busy ? <CircularProgress size={15} /> : <PaymentsRounded />}>{data.permissions?.participant === 'tenant' ? 'Submit payment' : 'Record payment'}</Button></DialogActions></form>
    </ProfessionalDialog>
  </Box>;
}
