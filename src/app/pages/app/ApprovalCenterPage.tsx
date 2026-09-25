import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, Stack, Tab, Tabs, Typography } from '@mui/material';
import ApprovalRounded from '@mui/icons-material/ApprovalRounded';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import BadgeRounded from '@mui/icons-material/BadgeRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import PageHeader from '../../components/layout/PageHeader';
import TenantKycAdminPage from './TenantKycAdminPage';
import SubscriptionPaymentReviewPage from './SubscriptionPaymentReviewPage';
import { getPendingSubscriptionPayments, getResource, reviewPropertyPublicListing, reviewSurveyorVerification } from '../../services/api';
import { useActionDialog } from '../../components/shared/useActionDialog';
import '../../../styles/approval-center-premium.css';

type ApprovalRecord = Record<string, any>;
const pendingKyc = new Set(['submitted', 'under_review', 'changes_required']);
const fmt = (value: any) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};
const label = (value: any) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase());
const surveyorName = (record: ApprovalRecord) => String(record.legalName || record.user?.name || record.email || 'Surveyor account');
const propertyAddress = (record: ApprovalRecord) => [record.address?.line1, record.address?.locality, record.address?.city, record.address?.state].filter(Boolean).join(', ') || 'Address not provided';

export default function ApprovalCenterPage() {
  const actions = useActionDialog();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [surveyorFilter, setSurveyorFilter] = useState('pending');
  const [listingFilter, setListingFilter] = useState('pending');
  const [surveyors, setSurveyors] = useState<ApprovalRecord[]>([]);
  const [properties, setProperties] = useState<ApprovalRecord[]>([]);
  const [counts, setCounts] = useState({ tenantKyc: 0, surveyorKyc: 0, listings: 0, subscriptions: 0 });

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    setError('');
    try {
      const [tenantKyc, surveyorKyc, listingApprovals, subscriptionApprovals] = await Promise.all([
        getResource('tenant-kyc', { status: 'submitted,under_review,changes_required', limit: 1, sort: '-submittedAt' }),
        getResource('surveyor-verifications', { limit: 100, sort: '-submittedAt,-createdAt' }),
        getResource('properties', { publicApprovalStatus: 'pending,approved,rejected', limit: 100, sort: '-updatedAt' }),
        getPendingSubscriptionPayments(),
      ]);
      const surveyorRows = Array.isArray(surveyorKyc.data) ? surveyorKyc.data : [];
      const propertyRows = Array.isArray(listingApprovals.data) ? listingApprovals.data : [];
      setSurveyors(surveyorRows);
      setProperties(propertyRows);
      setCounts({
        tenantKyc: Number(tenantKyc.pagination?.total || 0),
        surveyorKyc: surveyorRows.filter((row) => pendingKyc.has(String(row.status || ''))).length,
        listings: propertyRows.filter((row) => String(row.publicListingApproval?.status || '') === 'pending').length,
        subscriptions: Array.isArray(subscriptionApprovals.data) ? subscriptionApprovals.data.length : 0,
      });
    } catch (cause) {
      setError((cause as Error).message || 'Could not load the approval queues');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleSurveyors = useMemo(() => {
    if (surveyorFilter === 'all') return surveyors;
    if (surveyorFilter === 'pending') return surveyors.filter((row) => pendingKyc.has(String(row.status || '')));
    return surveyors.filter((row) => String(row.status || '') === surveyorFilter);
  }, [surveyorFilter, surveyors]);

  const visibleProperties = useMemo(() => listingFilter === 'all'
    ? properties
    : properties.filter((row) => String(row.publicListingApproval?.status || '') === listingFilter),
  [listingFilter, properties]);

  async function decideSurveyor(record: ApprovalRecord, status: 'verified' | 'rejected') {
    let reason = '';
    if (status === 'rejected') {
      reason = String(await actions.askText('Explain why this Surveyor verification is being rejected. The reason will remain in the audit trail.', { title: 'Reject Surveyor verification', label: 'Rejection reason' }) || '').trim();
      if (!reason) return;
    }
    const id = String(record._id || '');
    if (!id) return;
    setBusy(id); setError(''); setNotice('');
    try {
      await reviewSurveyorVerification(id, status === 'verified'
        ? { status, notes: 'Approved in Admin Approval Center' }
        : { status, notes: reason, rejectionReason: reason });
      setNotice(status === 'verified' ? `${surveyorName(record)} verification approved.` : `${surveyorName(record)} verification rejected.`);
      await load();
    } catch (cause) {
      setError((cause as Error).message || 'Could not update Surveyor verification');
    } finally {
      setBusy('');
    }
  }

  async function decideProperty(record: ApprovalRecord, status: 'approved' | 'rejected') {
    let reason = '';
    if (status === 'rejected') {
      reason = String(await actions.askText('Explain why this property cannot be published publicly yet. The landlord will receive this reason.', { title: 'Reject public listing', label: 'Rejection reason' }) || '').trim();
      if (!reason) return;
    }
    const id = String(record._id || '');
    if (!id) return;
    setBusy(id); setError(''); setNotice('');
    try {
      await reviewPropertyPublicListing(id, { status, reason });
      setNotice(status === 'approved' ? `${record.title || 'Property'} approved and published.` : `${record.title || 'Property'} returned to private draft.`);
      await load();
    } catch (cause) {
      setError((cause as Error).message || 'Could not update public listing approval');
    } finally {
      setBusy('');
    }
  }

  const queueCards = [
    { title: 'Tenant KYC', count: counts.tenantKyc, copy: 'Identity documents awaiting review', icon: BadgeRounded, tab: 0 },
    { title: 'Surveyor KYC', count: counts.surveyorKyc, copy: 'Professional verification awaiting review', icon: FactCheckRounded, tab: 1 },
    { title: 'Public listings', count: counts.listings, copy: 'Landlord requests awaiting publication', icon: ApartmentRounded, tab: 2 },
    { title: 'Plan subscriptions', count: counts.subscriptions, copy: 'Landlord + Surveyor payments awaiting approval', icon: WorkspacePremiumRounded, tab: 3 },
  ];

  if (loading) return <Box className="sa-approval-center sa-approval-loading"><CircularProgress /></Box>;

  return <Box className="sa-approval-center" sx={{ px: { xs: 1.5, sm: 3, lg: 4 }, pb: 6 }}>
    <PageHeader
      variant="plain"
      eyebrow="Administrative control"
      title="Approval Center"
      description="Review identity verification, Surveyor compliance, public property publication and Landlord or Surveyor plan activation from one secure workspace."
      meta={<Chip size="small" color={Object.values(counts).some(Boolean) ? 'warning' : 'success'} label={Object.values(counts).reduce((sum, value) => sum + value, 0) ? `${Object.values(counts).reduce((sum, value) => sum + value, 0)} pending approvals` : 'All queues clear'} />}
      actions={<Button className="sa-approval-refresh" size="small" startIcon={<RefreshRounded />} onClick={() => void load(true)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</Button>}
    />

    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

    <Grid container spacing={1.5} className="sa-approval-summary">
      {queueCards.map((item) => {
        const Icon = item.icon;
        return <Grid key={item.title} size={{ xs: 6, lg: 3 }}>
          <Card className={tab === item.tab ? 'sa-approval-summary-card is-active' : 'sa-approval-summary-card'} elevation={0} onClick={() => setTab(item.tab)}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                <Box><Typography className="sa-approval-summary-label">{item.title}</Typography><Typography className="sa-approval-summary-count">{item.count}</Typography></Box>
                <Box className="sa-approval-summary-icon"><Icon /></Box>
              </Stack>
              <Typography className="sa-approval-summary-copy">{item.copy}</Typography>
            </CardContent>
          </Card>
        </Grid>;
      })}
    </Grid>

    <Card className="sa-approval-workspace" elevation={0}>
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable" scrollButtons="auto" className="sa-approval-tabs">
        <Tab icon={<BadgeRounded />} iconPosition="start" label="Tenant KYC" />
        <Tab icon={<FactCheckRounded />} iconPosition="start" label="Surveyor KYC" />
        <Tab icon={<ApartmentRounded />} iconPosition="start" label="Public listings" />
        <Tab icon={<WorkspacePremiumRounded />} iconPosition="start" label="Plan subscriptions" />
      </Tabs>

      <Box className="sa-approval-panel">
        {tab === 0 && <TenantKycAdminPage embedded onChanged={() => void load()} />}

        {tab === 1 && <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.2} alignItems={{ sm: 'center' }}>
            <Box><Typography className="sa-approval-section-title">Surveyor professional verification</Typography><Typography className="sa-approval-section-copy">Review professional identity, licence, registration, insurance and bank-verification information before enabling verified Surveyor publishing.</Typography></Box>
            <Stack direction="row" gap={.7} flexWrap="wrap" useFlexGap>
              {['pending', 'verified', 'rejected', 'all'].map((value) => <Button key={value} size="small" variant={surveyorFilter === value ? 'contained' : 'outlined'} onClick={() => setSurveyorFilter(value)}>{label(value)}</Button>)}
            </Stack>
          </Stack>
          {!visibleSurveyors.length && <Alert severity="success">No Surveyor verification records in this view.</Alert>}
          <Grid container spacing={1.5}>
            {visibleSurveyors.map((record) => {
              const status = String(record.status || 'not_submitted');
              const reviewable = pendingKyc.has(status);
              return <Grid key={String(record._id)} size={{ xs: 12, lg: 6 }}>
                <Card className="sa-approval-record" variant="outlined"><CardContent>
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Box sx={{ minWidth: 0 }}><Typography className="sa-approval-record-title" noWrap>{surveyorName(record)}</Typography><Typography className="sa-approval-record-subtitle" noWrap>{record.email || record.user?.email || record.phone || 'Professional verification'}</Typography></Box>
                    <Chip size="small" color={status === 'verified' ? 'success' : status === 'rejected' ? 'error' : 'warning'} label={label(status)} />
                  </Stack>
                  <Grid container spacing={1} className="sa-approval-meta-grid">
                    <Grid size={{ xs: 6 }}><Typography>Licence</Typography><strong>{record.licenceNumber || '—'}</strong></Grid>
                    <Grid size={{ xs: 6 }}><Typography>Registration</Typography><strong>{record.registrationNumber || '—'}</strong></Grid>
                    <Grid size={{ xs: 6 }}><Typography>Experience</Typography><strong>{record.yearsExperience ? `${record.yearsExperience} years` : '—'}</strong></Grid>
                    <Grid size={{ xs: 6 }}><Typography>Submitted</Typography><strong>{fmt(record.submittedAt)}</strong></Grid>
                  </Grid>
                  {(record.reviewerNotes || record.rejectionReason) && <Alert severity={status === 'rejected' ? 'error' : 'info'} sx={{ mt: 1.3 }}>{record.rejectionReason || record.reviewerNotes}</Alert>}
                  {reviewable && <Stack direction="row" justifyContent="flex-end" gap={1} mt={1.5}>
                    <Button size="small" color="error" variant="outlined" startIcon={<CloseRounded />} onClick={() => void decideSurveyor(record, 'rejected')} disabled={busy === String(record._id)}>Reject</Button>
                    <Button size="small" color="success" variant="contained" startIcon={<CheckCircleRounded />} onClick={() => void decideSurveyor(record, 'verified')} disabled={busy === String(record._id)}>{busy === String(record._id) ? 'Working…' : 'Approve'}</Button>
                  </Stack>}
                </CardContent></Card>
              </Grid>;
            })}
          </Grid>
        </Stack>}

        {tab === 2 && <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.2} alignItems={{ sm: 'center' }}>
            <Box><Typography className="sa-approval-section-title">Public property publication</Typography><Typography className="sa-approval-section-copy">Any Landlord property created as public—or changed from private to public—stays unpublished until an administrator approves it here.</Typography></Box>
            <Stack direction="row" gap={.7} flexWrap="wrap" useFlexGap>
              {['pending', 'approved', 'rejected', 'all'].map((value) => <Button key={value} size="small" variant={listingFilter === value ? 'contained' : 'outlined'} onClick={() => setListingFilter(value)}>{label(value)}</Button>)}
            </Stack>
          </Stack>
          {!visibleProperties.length && <Alert severity="success">No public-listing approval records in this view.</Alert>}
          <Grid container spacing={1.5}>
            {visibleProperties.map((record) => {
              const approvalStatus = String(record.publicListingApproval?.status || 'not_required');
              const pending = approvalStatus === 'pending';
              return <Grid key={String(record._id)} size={{ xs: 12, lg: 6 }}>
                <Card className="sa-approval-record" variant="outlined"><CardContent>
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Box sx={{ minWidth: 0 }}><Typography className="sa-approval-record-title" noWrap>{record.title || 'Untitled property'}</Typography><Typography className="sa-approval-record-subtitle" noWrap>{propertyAddress(record)}</Typography></Box>
                    <Chip size="small" color={approvalStatus === 'approved' ? 'success' : approvalStatus === 'rejected' ? 'error' : 'warning'} label={label(approvalStatus)} />
                  </Stack>
                  <Grid container spacing={1} className="sa-approval-meta-grid">
                    <Grid size={{ xs: 6 }}><Typography>Landlord</Typography><strong>{record.owner?.name || record.owner?.email || '—'}</strong></Grid>
                    <Grid size={{ xs: 6 }}><Typography>Listing type</Typography><strong>{label(record.purpose || record.listingType || 'rent')}</strong></Grid>
                    <Grid size={{ xs: 6 }}><Typography>Requested</Typography><strong>{fmt(record.publicListingApproval?.requestedAt)}</strong></Grid>
                    <Grid size={{ xs: 6 }}><Typography>Survey status</Typography><strong>{label(record.surveyVerificationStatus || 'unverified')}</strong></Grid>
                  </Grid>
                  {record.publicListingApproval?.reason && <Alert severity={approvalStatus === 'rejected' ? 'error' : 'info'} sx={{ mt: 1.3 }}>{record.publicListingApproval.reason}</Alert>}
                  <Stack direction="row" justifyContent="flex-end" gap={1} mt={1.5} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="outlined" startIcon={<VisibilityRounded />} href={`/app/property-details/${record._id}`}>Review property</Button>
                    {pending && <><Button size="small" color="error" variant="outlined" startIcon={<CloseRounded />} onClick={() => void decideProperty(record, 'rejected')} disabled={busy === String(record._id)}>Reject</Button><Button size="small" color="success" variant="contained" startIcon={<ApprovalRounded />} onClick={() => void decideProperty(record, 'approved')} disabled={busy === String(record._id)}>{busy === String(record._id) ? 'Publishing…' : 'Approve & publish'}</Button></>}
                  </Stack>
                </CardContent></Card>
              </Grid>;
            })}
          </Grid>
        </Stack>}

        {tab === 3 && <SubscriptionPaymentReviewPage embedded onChanged={() => void load()} />}
      </Box>
    </Card>
    {actions.dialogs}
  </Box>;
}
