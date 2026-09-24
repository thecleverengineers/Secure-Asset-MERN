import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Grid, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import BusinessRounded from '@mui/icons-material/BusinessRounded';
import CallRounded from '@mui/icons-material/CallRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import EmailRounded from '@mui/icons-material/EmailRounded';
import EventRounded from '@mui/icons-material/EventRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import { useAuth } from '../../context/AuthContext';
import ApplicationAgreementPanel from '../../components/application/ApplicationAgreementPanel';
import { useActionDialog } from '../../components/shared/useActionDialog';
import {
  API_BASE, decideRentalApplication, fetchApplicationDocumentBlob, fetchPropertyImageBlob, getApplicationDetails,
  reviewApplicationDocument, updateApplicationPrivateNotes,
} from '../../services/api';

type DetailTab = 'overview' | 'documents' | 'activity';

function idOf(value: any) { return String(value?._id || value || ''); }
function nice(value: any) { return String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function money(value: any) {
  const amount = Number(value || 0);
  return amount > 0 ? `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';
}
function dateText(value: any, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
}
function propertyAddress(value: any) {
  if (!value) return 'Address not provided';
  if (typeof value === 'string') return value;
  return [value.unit, value.line1, value.line2, value.locality, value.area, value.district, value.city, value.state, value.postalCode, value.country].filter(Boolean).join(', ') || 'Address not provided';
}
function detailsFrom(value: any) {
  if (!value || typeof value !== 'object') return [] as [string, string][];
  return Object.entries(value).filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item) && String(item).trim()).map(([key, item]) => [nice(key), String(item)] as [string, string]);
}

function PropertyImage({ property }: { property: any }) {
  const propertyId = idOf(property);
  const raw = property?.galleryCover || property?.coverImage || property?.mainImage || property?.primaryImage || property?.images?.[0] || '';
  const source = typeof raw === 'object' ? raw.url || raw.thumbnailUrl || raw.secureSource || raw.path || raw.mediaId || raw.fileId || '' : String(raw || '');
  const mediaId = typeof raw === 'object' ? String(raw.mediaId || raw.propertyMediaId || '') : source.match(/\/property-media\/([a-f\d]{24})/i)?.[1] || '';
  const [image, setImage] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setImage('');
    if (!source) return () => { active = false; };
    if (/^(https?:|data:|blob:)/i.test(source) && !/\/property-media\/|\/drive\/files\//i.test(source)) {
      setImage(source);
      return () => { active = false; };
    }
    const secureSource = mediaId ? `${API_BASE}/property-management/property-media/${encodeURIComponent(mediaId)}/content` : source;
    fetchPropertyImageBlob(secureSource, propertyId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setImage(objectUrl);
    }).catch(() => { if (active && /^(https?:|data:|blob:)/i.test(source)) setImage(source); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [mediaId, propertyId, source]);
  return <Box sx={{ height: { xs: 180, sm: 210 }, overflow: 'hidden', borderRadius: 2.5, bgcolor: '#EAF1F3', position: 'relative' }}>
    {image ? <Box component="img" src={image} alt={`${property?.title || 'Property'} cover`} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <Stack alignItems="center" justifyContent="center" sx={{ width: '100%', height: '100%', color: 'text.secondary' }}><HomeWorkRounded /><Typography variant="caption" sx={{ mt: .5 }}>Property image unavailable</Typography></Stack>}
  </Box>;
}

function InfoLine({ label, value }: { label: string; value: any }) {
  return <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.2} sx={{ py: .75, borderBottom: '1px solid', borderColor: 'rgba(24,50,56,.07)', '&:last-child': { borderBottom: 0 } }}>
    <Typography color="text.secondary" sx={{ fontSize: 11.5, fontWeight: 700, flex: '0 0 39%' }}>{label}</Typography>
    <Typography sx={{ fontSize: 12, fontWeight: 780, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{value || '—'}</Typography>
  </Stack>;
}

function Section({ title, subtitle, icon: Icon, children, action }: { title: string; subtitle?: string; icon?: any; children: any; action?: any }) {
  return <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, boxShadow: '0 8px 28px rgba(15,47,57,.035)' }}>
    <CardContent sx={{ p: { xs: 1.65, sm: 2.15 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mb: 1.35 }}>
        <Stack direction="row" alignItems="center" spacing={.9}>
          {Icon && <Box sx={{ width: 31, height: 31, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: 'rgba(11,82,112,.08)', borderRadius: 1.5 }}><Icon sx={{ fontSize: 17 }} /></Box>}
          <Box><Typography sx={{ fontSize: 13.5, fontWeight: 900 }}>{title}</Typography>{subtitle && <Typography color="text.secondary" sx={{ fontSize: 10.8, mt: .15 }}>{subtitle}</Typography>}</Box>
        </Stack>
        {action}
      </Stack>
      {children}
    </CardContent>
  </Card>;
}

export default function ApplicationDetailsPage() {
  const { applicationId = '' } = useParams();
  const { user } = useAuth();
  const actions = useActionDialog();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [notes, setNotes] = useState('');
  const [reviewValues, setReviewValues] = useState<Record<string, { status: string; note: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const result = await getApplicationDetails(applicationId);
      const next = result.data || {};
      setData(next);
      setNotes(String(next.application?.landlordNotes || ''));
      setReviewValues(Object.fromEntries((next.application?.documents || []).map((doc: any) => [idOf(doc), { status: doc.reviewStatus || 'pending', note: doc.reviewNote || '' }])));
      setError('');
    } catch (cause) {
      setError((cause as Error).message || 'Could not open this application');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  const application = data?.application || {};
  const property = application.property || {};
  const applicant = application.applicant || {};
  const targetSpace = application.rentalUnit || application.targetSpace || application.unit || {};
  const pricing = targetSpace.pricing || {};
  const permissions = data?.permissions || {};
  const status = String(application.status || 'submitted').toLowerCase();
  const statusColor = ['approved', 'agreement_pending', 'completed'].includes(status) ? 'success' : status === 'rejected' ? 'error' : ['additional_documents_requested', 'documents_pending'].includes(status) ? 'warning' : 'primary';
  const unitName = targetSpace.name || targetSpace.roomNumber || targetSpace.flatNumber || targetSpace.apartmentNumber || targetSpace.unitNumber || 'Entire property';
  const floor = targetSpace.floor?.name || targetSpace.floor?.floorName || targetSpace.floorName || targetSpace.floorNumber;

  async function saveNotes() {
    setBusy('notes');
    try {
      await updateApplicationPrivateNotes(applicationId, notes);
      setNotice('Private landlord notes saved. The applicant cannot see these notes.');
      await load();
    } catch (cause) { setError((cause as Error).message || 'Could not save landlord notes'); }
    finally { setBusy(''); }
  }

  async function requestInformation() {
    const message = await actions.askText('Write the information or documents the applicant should provide.', { title: 'Request information', label: 'Message to applicant' });
    if (!String(message || '').trim()) return;
    setBusy('request');
    try {
      await decideRentalApplication(applicationId, { status: 'additional_documents_requested', remarks: String(message).trim() });
      setNotice('Information request sent to the applicant.');
      await load();
    } catch (cause) { setError((cause as Error).message || 'Could not request information'); }
    finally { setBusy(''); }
  }

  async function decide(next: 'approved' | 'rejected') {
    const reason = next === 'rejected'
      ? await actions.askText('Add the reason that will be shared with the applicant.', { title: 'Rejection reason', label: 'Reason' })
      : '';
    if (next === 'rejected' && !String(reason || '').trim()) return;
    setBusy(next);
    try {
      await decideRentalApplication(applicationId, { status: next, ...(next === 'rejected' && { remarks: String(reason).trim() }) });
      setNotice(next === 'approved' ? 'Application accepted. Agreement workflow is ready.' : 'Application rejected with a reason.');
      await load();
    } catch (cause) { setError((cause as Error).message || `Could not ${next} this application`); }
    finally { setBusy(''); }
  }

  async function saveDocumentReview(documentId: string) {
    const review = reviewValues[documentId] || { status: 'pending', note: '' };
    setBusy(`review-${documentId}`);
    try {
      await reviewApplicationDocument(applicationId, documentId, review);
      setNotice('Supporting document review saved.');
      await load();
    } catch (cause) { setError((cause as Error).message || 'Could not save document review'); }
    finally { setBusy(''); }
  }

  async function openDocument(document: any, download = false) {
    const documentId = idOf(document);
    setBusy(`${download ? 'download' : 'preview'}-${documentId}`);
    try {
      const blob = await fetchApplicationDocumentBlob(applicationId, documentId, download);
      const url = URL.createObjectURL(blob);
      if (download) {
        const anchor = window.document.createElement('a');
        anchor.href = url;
        anchor.download = document.name || 'application-document';
        anchor.click();
      } else {
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (!opened) setError('Allow pop-ups to preview this secure document.');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) { setError((cause as Error).message || 'Could not open the secure document'); }
    finally { setBusy(''); }
  }

  if (loading && !data) return <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><Stack alignItems="center" spacing={1.2}><CircularProgress size={26} /><Typography color="text.secondary" sx={{ fontSize: 13 }}>Opening application details…</Typography></Stack></Box>;
  if (error && !data) return <Box sx={{ maxWidth: 760, mx: 'auto', px: 2 }}><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Retry</Button>}>{error}</Alert><Button component={Link} to="/app/applications" startIcon={<ArrowBackRounded />} sx={{ mt: 1.5 }}>Back to applications</Button></Box>;
  if (!data) return null;

  return <Box data-secureasset-application-details="application-detail-page-v1" sx={{ px: { xs: 1.5, sm: 2.5, lg: 3.5 }, pb: 5, maxWidth: 1500, mx: 'auto' }}>
    <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" gap={1.2} sx={{ mb: 2 }}>
      <Box>
        <Button component={Link} to="/app/applications" startIcon={<ArrowBackRounded />} size="small" sx={{ pl: 0, mb: .35 }}>Application list</Button>
        <Typography variant="h4" sx={{ fontSize: { xs: 23, md: 29 }, fontWeight: 950, letterSpacing: '-.035em', lineHeight: 1.15 }}>Application details</Typography>
        <Typography color="text.secondary" sx={{ mt: .5, fontSize: 12.5 }}>{application.applicationNumber || `APP-${idOf(application).slice(-8).toUpperCase()}`} · Submitted {dateText(application.submittedAt || application.createdAt)}</Typography>
      </Box>
      <Stack direction="row" gap={.7} flexWrap="wrap" alignItems="center">
        <Chip color={statusColor as any} label={nice(status)} sx={{ fontWeight: 820, borderRadius: 1.7 }} />
        {permissions.canContactApplicant && applicant.email && <Button size="small" variant="outlined" startIcon={<EmailRounded />} component="a" href={`mailto:${applicant.email}`}>Email applicant</Button>}
        {permissions.canContactApplicant && applicant.phone && <Button size="small" variant="outlined" startIcon={<CallRounded />} component="a" href={`tel:${applicant.phone}`}>Call applicant</Button>}
        {permissions.canRequestInformation && ['submitted', 'under_review', 'shortlisted', 'interview_requested', 'interview_scheduled', 'site_visit_scheduled', 'additional_documents_requested', 'documents_pending'].includes(status) && <Button size="small" variant="contained" startIcon={<SendRounded />} disabled={Boolean(busy)} onClick={() => void requestInformation()}>Request information</Button>}
      </Stack>
    </Stack>

    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1.4 }}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 1.4 }} icon={<CheckCircleRounded />}>{notice}</Alert>}

    <Paper variant="outlined" sx={{ borderRadius: 2.5, mb: 1.6, px: { xs: .4, sm: 1 }, borderColor: 'divider', overflow: 'auto' }}>
      <Tabs value={tab} variant="scrollable" scrollButtons="auto" onChange={(_event, value: DetailTab) => setTab(value)} aria-label="Application detail sections" sx={{ minHeight: 48, '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontSize: 12, fontWeight: 790, px: { xs: 1.2, sm: 2 } }, '& .MuiTabs-indicator': { height: 3, borderRadius: 3 } }}>
        <Tab value="overview" icon={<BusinessRounded sx={{ fontSize: 17 }} />} iconPosition="start" label="Overview" />
        <Tab value="documents" icon={<DescriptionRounded sx={{ fontSize: 17 }} />} iconPosition="start" label={`Supporting documents (${application.documents?.length || 0})`} />
        <Tab value="activity" icon={<HistoryRounded sx={{ fontSize: 17 }} />} iconPosition="start" label="Activity history" />
      </Tabs>
    </Paper>

    {tab === 'overview' && <Grid container spacing={1.5}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Section title="Property & unit" subtitle="The listing and unit included in this application" icon={HomeWorkRounded}>
          <Grid container spacing={1.4}>
            <Grid size={{ xs: 12, sm: 5 }}><PropertyImage property={property} /></Grid>
            <Grid size={{ xs: 12, sm: 7 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 900, lineHeight: 1.3 }}>{property.title || property.name || 'Property'}</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 11.5, mt: .5, mb: .9 }}>{propertyAddress(property.address)}</Typography>
              <InfoLine label="Room / unit" value={unitName} />
              <InfoLine label="Floor" value={floor || '—'} />
              <InfoLine label="Monthly rent" value={money(pricing.monthlyRent || property.pricing?.monthlyRent || application.rentalBudget || property.price)} />
              <InfoLine label="Security deposit" value={money(pricing.securityDeposit || property.pricing?.securityDeposit)} />
              <InfoLine label="Maintenance / other charges" value={[money(pricing.maintenanceCharge || property.pricing?.maintenanceCharge), money(pricing.bookingAmount)].filter((item) => item !== '—').join(' · ') || 'No listed charges'} />
            </Grid>
          </Grid>
        </Section>
        <Grid container spacing={1.5} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, md: 6 }}><Section title="Rental request" subtitle="The applicant’s requested move-in and stay" icon={EventRounded}>
            <InfoLine label="Requested move-in" value={dateText(application.moveInDate)} />
            <InfoLine label="Intended rental period" value={application.expectedStayMonths ? `${application.expectedStayMonths} months` : 'Not specified'} />
            <InfoLine label="Monthly budget" value={money(application.rentalBudget)} />
            <InfoLine label="Monthly income" value={money(application.monthlyIncome)} />
            <Divider sx={{ my: 1 }} />
            <Typography color="text.secondary" sx={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>Message to landlord</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.65, mt: .45 }}>{application.messageToLandlord || 'No message provided.'}</Typography>
          </Section></Grid>
          <Grid size={{ xs: 12, md: 6 }}><Section title="Applicant profile" subtitle="Contact and application details" icon={PersonRounded}>
            <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 1.15 }}>
              <Avatar src={applicant.avatar || undefined} sx={{ width: 43, height: 43, bgcolor: 'primary.main', fontWeight: 850 }}>{(applicant.name || 'A').slice(0, 1).toUpperCase()}</Avatar>
              <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 900, fontSize: 13 }}>{applicant.name || application.personal?.name || 'Applicant'}</Typography><Typography color="text.secondary" sx={{ fontSize: 10.8 }}>{application.occupantSummary?.total || 1} occupant{Number(application.occupantSummary?.total || 1) === 1 ? '' : 's'} · {application.occupantSummary?.adults || 0} adult(s) · {application.occupantSummary?.children || 0} child(ren)</Typography></Box>
            </Stack>
            <InfoLine label="Email" value={applicant.email || application.personal?.email || '—'} />
            <InfoLine label="Phone" value={applicant.phone || application.personal?.phone || '—'} />
            <InfoLine label="Application submitted" value={dateText(application.submittedAt || application.createdAt)} />
            {application.occupantIds?.length > 0 && <><Divider sx={{ my: 1 }} /><Typography sx={{ fontSize: 11, fontWeight: 850, mb: .4 }}>Named occupants</Typography>{application.occupantIds.map((person: any, index: number) => <InfoLine key={idOf(person) || index} label={person.fullName || person.name || `Occupant ${index + 1}`} value={[person.relationship, person.age ? `${person.age} years` : '', person.occupation].filter(Boolean).join(' · ')} />)}</>}
            <Stack direction="row" flexWrap="wrap" gap={.65} sx={{ mt: 1.05 }}>
              {(applicant.phone || application.personal?.phone) && <Button size="small" variant="outlined" startIcon={<CallRounded />} component="a" href={`tel:${applicant.phone || application.personal?.phone}`}>Call</Button>}
              {(applicant.email || application.personal?.email) && <Button size="small" variant="outlined" startIcon={<EmailRounded />} component="a" href={`mailto:${applicant.email || application.personal?.email}`}>Email</Button>}
            </Stack>
            {detailsFrom(application.employment).length > 0 && <><Divider sx={{ my: 1 }} /><Typography sx={{ fontSize: 11, fontWeight: 850, mb: .4 }}>Employment details</Typography>{detailsFrom(application.employment).map(([label, value]) => <InfoLine key={label} label={label} value={value} />)}</>}
            {detailsFrom(application.personal).filter(([label]) => !['Name', 'Email', 'Phone'].includes(label)).length > 0 && <><Divider sx={{ my: 1 }} /><Typography sx={{ fontSize: 11, fontWeight: 850, mb: .4 }}>Other submitted details</Typography>{detailsFrom(application.personal).filter(([label]) => !['Name', 'Email', 'Phone'].includes(label)).map(([label, value]) => <InfoLine key={label} label={label} value={value} />)}</>}
            {detailsFrom(application.identity).filter(([label]) => !/number|document|photo|url/i.test(label)).length > 0 && <><Divider sx={{ my: 1 }} /><Typography sx={{ fontSize: 11, fontWeight: 850, mb: .4 }}>Identity details</Typography>{detailsFrom(application.identity).filter(([label]) => !/number|document|photo|url/i.test(label)).map(([label, value]) => <InfoLine key={label} label={label} value={value} />)}</>}
            {(application.vehicles?.length > 0 || application.pets?.length > 0 || application.references?.length > 0) && <><Divider sx={{ my: 1 }} />{application.vehicles?.length > 0 && <InfoLine label="Vehicles" value={application.vehicles.map((item: any) => [item.type, item.registration].filter(Boolean).join(' ')).join(', ')} />}{application.pets?.length > 0 && <InfoLine label="Pets" value={application.pets.map((item: any) => `${item.type || 'Pet'}${Number(item.count || 0) > 1 ? ` ×${item.count}` : ''}`).join(', ')} />}{application.references?.length > 0 && <InfoLine label="References" value={application.references.map((item: any) => [item.name, item.relation, item.phone].filter(Boolean).join(' · ')).join(' | ')} />}</>}
          </Section></Grid>
        </Grid>
        {permissions.canEditNotes && <Section title="Landlord notes" subtitle="Private notes visible only to authorized property managers" icon={DescriptionRounded}>
          <TextField fullWidth multiline minRows={3} maxRows={8} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Keep private review notes for your team…" inputProps={{ maxLength: 5000 }} />
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}><Button size="small" variant="outlined" disabled={busy === 'notes'} onClick={() => void saveNotes()}>{busy === 'notes' ? 'Saving…' : 'Save private notes'}</Button></Stack>
        </Section>}
        <Section title="Application actions" subtitle="Review the request and continue to agreement preparation" icon={CheckCircleRounded}>
          {permissions.canDecide && <Alert severity="info" sx={{ mb: 1.2 }}>Accepting starts the agreement workflow. The room stays available until the agreement has both signatures and landlord verification.</Alert>}
          <ApplicationAgreementPanel
            application={application}
            user={user}
            landlordCanManage={Boolean(permissions.isLandlord)}
            onDecision={decide}
            onNotice={(message) => { setNotice(message); void load(); }}
            onError={setError}
          />
        </Section>
      </Grid>
      <Grid size={{ xs: 12, lg: 5 }}>
        <Section title="Decision snapshot" subtitle="Current status and key dates" icon={EventRounded}>
          <InfoLine label="Reference number" value={application.applicationNumber || idOf(application)} />
          <InfoLine label="Submitted" value={dateText(application.submittedAt || application.createdAt, true)} />
          <InfoLine label="Status" value={nice(status)} />
          <InfoLine label="Applicant requested move-in" value={dateText(application.moveInDate)} />
          {application.acceptedAt && <InfoLine label="Accepted" value={dateText(application.acceptedAt)} />}
          {application.rejectedAt && <InfoLine label="Rejected" value={dateText(application.rejectedAt)} />}
          {application.rejectionReason && <><Divider sx={{ my: 1 }} /><Typography sx={{ fontSize: 11, fontWeight: 850 }}>Rejection reason</Typography><Typography color="text.secondary" sx={{ fontSize: 12, mt: .35 }}>{application.rejectionReason}</Typography></>}
        </Section>
      </Grid>
    </Grid>}

    {tab === 'documents' && <Section title="Supporting documents" subtitle="Private applicant files with a review state" icon={DescriptionRounded}>
      {(application.documents || []).length ? <Stack spacing={.9}>{application.documents.map((doc: any) => {
        const review = reviewValues[idOf(doc)] || { status: doc.reviewStatus || 'pending', note: '' };
        return <Paper key={idOf(doc)} variant="outlined" sx={{ p: 1.2, borderRadius: 2.2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1}>
            <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 850, fontSize: 12.5 }}>{doc.name}</Typography><Typography color="text.secondary" sx={{ fontSize: 10.8 }}>{nice(doc.type)}{doc.sizeBytes ? ` · ${(Number(doc.sizeBytes) / 1024).toFixed(0)} KB` : ''} · Review: {nice(review.status)}</Typography></Box>
            <Stack direction="row" gap={.55} flexWrap="wrap">
              <Button size="small" startIcon={<VisibilityRounded />} disabled={busy === `preview-${idOf(doc)}`} onClick={() => void openDocument(doc)}>Preview</Button>
              <Button size="small" startIcon={<DownloadRounded />} disabled={busy === `download-${idOf(doc)}`} onClick={() => void openDocument(doc, true)}>Download</Button>
            </Stack>
          </Stack>
          {permissions.canReviewDocuments && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={.7} sx={{ mt: 1 }}>
            <TextField select size="small" label="Review status" value={review.status} onChange={(event) => setReviewValues((current) => ({ ...current, [idOf(doc)]: { ...review, status: event.target.value } }))} sx={{ minWidth: 180 }}>
              {['pending', 'approved', 'changes_requested', 'rejected'].map((value) => <MenuItem value={value} key={value}>{nice(value)}</MenuItem>)}
            </TextField>
            <TextField size="small" fullWidth label="Review note" value={review.note} onChange={(event) => setReviewValues((current) => ({ ...current, [idOf(doc)]: { ...review, note: event.target.value } }))} />
            <Button size="small" variant="contained" disabled={busy === `review-${idOf(doc)}`} onClick={() => void saveDocumentReview(idOf(doc))}>Save review</Button>
          </Stack>}
          {!permissions.canReviewDocuments && doc.reviewNote && <Typography color="text.secondary" sx={{ fontSize: 11, mt: .8 }}>{doc.reviewNote}</Typography>}
        </Paper>;
      })}</Stack> : <Alert severity="info">No supporting files were attached to this application.</Alert>}
    </Section>}

    {tab === 'activity' && <Section title="Activity history" subtitle="Submission, information requests, document reviews, decisions and agreement events" icon={HistoryRounded}>
      {(application.activity || []).length ? <Stack spacing={0} sx={{ ml: .35 }}>{application.activity.map((event: any, index: number) => <Stack key={`${event.kind}-${index}`} direction="row" spacing={1.25} sx={{ minHeight: 68 }}>
        <Stack alignItems="center" sx={{ width: 16, flex: '0 0 auto' }}><Box sx={{ width: 10, height: 10, mt: .45, borderRadius: '50%', bgcolor: index === 0 ? 'primary.main' : 'rgba(11,82,112,.27)', boxShadow: index === 0 ? '0 0 0 4px rgba(11,82,112,.09)' : 'none' }} />{index < application.activity.length - 1 && <Box sx={{ flex: 1, width: 1, bgcolor: 'divider', minHeight: 43 }} />}</Stack>
        <Box sx={{ pb: 1.7 }}><Typography sx={{ fontSize: 12.4, fontWeight: 850 }}>{event.title}</Typography>{event.detail && <Typography color="text.secondary" sx={{ fontSize: 11.2, mt: .15, whiteSpace: 'pre-wrap' }}>{event.detail}</Typography>}<Typography color="text.secondary" sx={{ fontSize: 10.5, mt: .35 }}>{dateText(event.at, true)}</Typography></Box>
      </Stack>)}</Stack> : <Alert severity="info">Application activity will appear here as the review progresses.</Alert>}
    </Section>}
    {actions.dialogs}
  </Box>;
}
