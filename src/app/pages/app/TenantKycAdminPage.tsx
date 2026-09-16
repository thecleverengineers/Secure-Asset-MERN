import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, DialogActions, DialogContent, DialogTitle,
  FormControl, Grid, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import { getResource, reviewTenantKyc } from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import TenantKycDocumentPreview from '../../components/kyc/TenantKycDocumentPreview';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';

type KycRecord = Record<string, any>;
type Decision = { record: KycRecord; status: 'verified' | 'rejected'; reason: string } | null;

const REVIEWABLE_STATUSES = new Set(['submitted', 'under_review', 'changes_required']);
const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  submitted: 'warning', under_review: 'info', changes_required: 'warning', verified: 'success', rejected: 'error', expired: 'error', suspended: 'error',
};

function userLabel(record: KycRecord) {
  const user = record.user || {};
  return String(user.name || user.email || user.mobile || 'Tenant account');
}
function formatDate(value: any) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}
function documentId(value: any) { return String(value?._id || value?.id || value || ''); }

function DocumentMeta({ label, value }: { label: string; value: any }) {
  const id = documentId(value);
  return <Stack spacing={.2} sx={{ minWidth: 0 }}><Typography fontSize={11} color="text.secondary" fontWeight={800}>{label}</Typography><Typography fontSize={12} fontWeight={700} noWrap title={id}>{id || 'Not uploaded'}</Typography></Stack>;
}

export default function TenantKycAdminPage() {
  const [records, setRecords] = useState<KycRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<KycRecord | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [savingId, setSavingId] = useState('');

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    setError('');
    try {
      const params = { limit: 100, sort: '-submittedAt,-createdAt' };
      const first = await getResource('tenant-kyc', params);
      const totalPages = Math.max(Number(first.pagination?.totalPages || 1), 1);
      const remaining = totalPages > 1
        ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => getResource('tenant-kyc', { ...params, page: index + 2 })))
        : [];
      setRecords([...(Array.isArray(first.data) ? first.data : []), ...remaining.flatMap((result) => Array.isArray(result.data) ? result.data : [])]);
    } catch (cause) {
      setError((cause as Error).message || 'Could not load tenant KYC submissions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  const visibleRecords = useMemo(() => filter === 'all' ? records : records.filter((record) => String(record.status || '') === filter), [filter, records]);
  const pendingCount = records.filter((record) => REVIEWABLE_STATUSES.has(String(record.status || ''))).length;

  async function saveDecision() {
    if (!decision) return;
    const reason = decision.reason.trim();
    if (decision.status === 'rejected' && !reason) {
      setError('Add a rejection reason before rejecting this KYC submission.');
      return;
    }
    const id = String(decision.record._id || '');
    if (!id) return;
    setSavingId(id); setError(''); setNotice('');
    try {
      const result = await reviewTenantKyc(id, { status: decision.status, reason: reason || 'KYC approved by administrator' });
      const updated = result.data || { ...decision.record, status: decision.status, reason };
      setRecords((current) => current.map((record) => String(record._id) === id ? { ...record, ...updated, user: record.user } : record));
      setSelected((current) => current && String(current._id) === id ? { ...current, ...updated, user: current.user } : current);
      setDecision(null);
      setNotice(decision.status === 'verified' ? `${userLabel(decision.record)} KYC approved and verified.` : `${userLabel(decision.record)} KYC rejected.`);
    } catch (cause) {
      setError((cause as Error).message || 'Could not update KYC status');
    } finally {
      setSavingId('');
    }
  }

  if (loading) return <Box sx={{ minHeight: 420, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6, maxWidth: 1320 }}>
    <PageHeader eyebrow="Compliance workspace" title="Tenant KYC management" description="Review submitted tenant identity documents securely, verify complete records, and return clear decisions with an audit trail." meta={<Chip size="small" color={pendingCount ? 'warning' : 'success'} label={`${pendingCount} awaiting review`} />} />
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

    <Card elevation={0} className="sa-surface-card" sx={{ mb: 2 }}><CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Typography fontWeight={950}>Submitted KYC records</Typography>
          <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Status</InputLabel><Select value={filter} label="Status" onChange={(event) => setFilter(event.target.value)}><MenuItem value="all">All records</MenuItem><MenuItem value="submitted">Submitted</MenuItem><MenuItem value="under_review">Under review</MenuItem><MenuItem value="changes_required">Changes required</MenuItem><MenuItem value="verified">Verified</MenuItem><MenuItem value="rejected">Rejected</MenuItem></Select></FormControl>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => void load()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</Button>
      </Stack>
    </CardContent></Card>

    {!visibleRecords.length && <Card elevation={0} className="sa-surface-card"><CardContent><Typography fontWeight={850}>No KYC submissions found</Typography><Typography color="text.secondary" fontSize={13}>Submitted tenant records will appear here with secure document previews.</Typography></CardContent></Card>}
    <Grid container spacing={2}>
      {visibleRecords.map((record) => {
        const status = String(record.status || 'not_started');
        const reviewable = REVIEWABLE_STATUSES.has(status);
        return <Grid key={String(record._id)} size={{ xs: 12, md: 6, xl: 4 }}>
          <Card elevation={0} className="sa-surface-card" sx={{ height: '100%', borderTop: '4px solid', borderColor: reviewable ? 'warning.main' : status === 'verified' ? 'success.main' : 'primary.main' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1.5 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                <Box sx={{ minWidth: 0 }}><Typography fontWeight={950} noWrap>{userLabel(record)}</Typography><Typography color="text.secondary" fontSize={12} noWrap>{record.user?.email || record.user?.mobile || 'Tenant identity record'}</Typography></Box>
                <Chip size="small" color={STATUS_COLORS[status] || 'default'} label={status.replaceAll('_', ' ')} />
              </Stack>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap><DocumentMeta label="Submitted" value={formatDate(record.submittedAt)} /><DocumentMeta label="Reviewed" value={formatDate(record.reviewedAt)} /></Stack>
              <Typography color="text.secondary" fontSize={12} sx={{ minHeight: 34 }}>{record.reason || 'All uploaded documents are available for secure review.'}</Typography>
              <Stack direction="row" spacing={1} mt="auto" flexWrap="wrap" useFlexGap>
                <Button size="small" variant="outlined" startIcon={<VisibilityRounded />} onClick={() => setSelected(record)}>View documents</Button>
                {reviewable && <><Button size="small" color="success" variant="contained" startIcon={<CheckCircleRounded />} onClick={() => setDecision({ record, status: 'verified', reason: '' })} disabled={Boolean(savingId)}>Approve</Button><Button size="small" color="error" variant="outlined" startIcon={<CloseRounded />} onClick={() => setDecision({ record, status: 'rejected', reason: '' })} disabled={Boolean(savingId)}>Reject</Button></>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>;
      })}
    </Grid>

    <ProfessionalDialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="lg" scroll="paper" professionalTitle="Tenant KYC document review" professionalSubtitle={selected ? userLabel(selected) : undefined}>
      <DialogTitle sx={{ bgcolor: '#0B5270', color: 'white' }}><Stack direction="row" alignItems="center" spacing={1}><VerifiedUserRounded /><Box><Typography fontWeight={950}>Tenant KYC document review</Typography><Typography fontSize={12} sx={{ opacity: .8 }}>{selected ? userLabel(selected) : ''}</Typography></Box></Stack></DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
        {selected && <Stack spacing={2}>
          <Card elevation={0} className="sa-surface-card"><CardContent><Grid container spacing={1.5}><Grid size={{ xs: 12, sm: 6 }}><DocumentMeta label="Government identity type" value={selected.governmentIdentity?.documentType} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DocumentMeta label="Government identity number" value={selected.governmentIdentity?.documentId} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DocumentMeta label="Address proof type" value={selected.addressProofDetails?.documentType} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DocumentMeta label="Address proof number" value={selected.addressProofDetails?.documentId} /></Grid></Grid></CardContent></Card>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}><TenantKycDocumentPreview label="Government identity — front" value={selected.governmentIdentity?.frontFile || selected.governmentId} height={180} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}><TenantKycDocumentPreview label="Government identity — back" value={selected.governmentIdentity?.backFile} height={180} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}><TenantKycDocumentPreview label="Passport photograph" value={selected.passportPhoto?.file || selected.profilePhoto} height={180} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}><TenantKycDocumentPreview label="Address proof — front" value={selected.addressProofDetails?.frontFile || selected.addressProof} height={180} /></Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}><TenantKycDocumentPreview label="Address proof — back" value={selected.addressProofDetails?.backFile} height={180} /></Grid>
          </Grid>
        </Stack>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}><Button onClick={() => setSelected(null)}>Close</Button>{selected && REVIEWABLE_STATUSES.has(String(selected.status || '')) && <><Button color="error" variant="outlined" startIcon={<CloseRounded />} onClick={() => setDecision({ record: selected, status: 'rejected', reason: '' })}>Reject</Button><Button color="success" variant="contained" startIcon={<CheckCircleRounded />} onClick={() => setDecision({ record: selected, status: 'verified', reason: '' })}>Approve</Button></>}</DialogActions>
    </ProfessionalDialog>

    <ProfessionalDialog open={Boolean(decision)} onClose={() => !savingId && setDecision(null)} fullWidth maxWidth="sm">
      <DialogTitle sx={{ bgcolor: '#0B5270', color: 'white' }}>{decision?.status === 'verified' ? 'Approve tenant KYC' : 'Reject tenant KYC'}</DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}><Typography color="text.secondary" fontSize={13} mb={2}>{decision?.status === 'verified' ? 'This marks the tenant KYC as verified and enables verified tenant workflows.' : 'Provide a clear reason so the tenant knows what must be corrected.'}</Typography><TextField fullWidth multiline minRows={3} label={decision?.status === 'verified' ? 'Approval note (optional)' : 'Rejection reason'} required={decision?.status === 'rejected'} value={decision?.reason || ''} onChange={(event) => setDecision((current) => current ? { ...current, reason: event.target.value } : current)} /></DialogContent>
      <DialogActions sx={{ p: 2 }}><Button onClick={() => setDecision(null)} disabled={Boolean(savingId)}>Cancel</Button><Button variant="contained" color={decision?.status === 'verified' ? 'success' : 'error'} onClick={() => void saveDecision()} disabled={Boolean(savingId)}>{savingId ? 'Saving…' : decision?.status === 'verified' ? 'Approve KYC' : 'Reject KYC'}</Button></DialogActions>
    </ProfessionalDialog>
  </Box>;
}
