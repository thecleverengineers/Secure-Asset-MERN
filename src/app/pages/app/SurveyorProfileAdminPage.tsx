import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Grid, MenuItem, Paper, Rating, Stack, TextField, Typography } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import AssignmentTurnedInRounded from '@mui/icons-material/AssignmentTurnedInRounded';
import BusinessRounded from '@mui/icons-material/BusinessRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import LanguageRounded from '@mui/icons-material/LanguageRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import ManageAccountsRounded from '@mui/icons-material/ManageAccountsRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useActionDialog } from '../../components/shared/useActionDialog';
import { changeResourceStatus, deleteResource, getResource, getResourceById, reviewSurveyorVerification, updateResource } from '../../services/api';

const PUBLICATION_STATUSES = ['draft', 'pending_moderation', 'published', 'paused', 'archived'];
const VERIFICATION_STATUSES = ['under_review', 'changes_required', 'verified', 'rejected', 'suspended', 'expired'];

function idOf(value: any) {
  return value && typeof value === 'object' ? String(value._id || '') : String(value || '');
}

function csv(value: any) {
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value || '');
}

function jsonText(value: any) {
  return value && typeof value === 'object' ? JSON.stringify(value, null, 2) : '';
}

function statusLabel(value: any) {
  return String(value || '—').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(value: any) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function dateLabel(value: any) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function makeDraft(profile: any) {
  const office = profile?.officeAddress || {};
  const contact = profile?.publicContact || {};
  return {
    profileType: profile?.profileType || 'individual',
    name: profile?.name || '',
    professionalTitle: profile?.professionalTitle || '',
    profilePhoto: profile?.profilePhoto || '',
    agencyLogo: profile?.agencyLogo || '',
    description: profile?.description || '',
    yearsExperience: profile?.yearsExperience ?? '',
    registrationNumber: profile?.registrationNumber || '',
    licenceNumber: profile?.licenceNumber || '',
    qualifications: csv(profile?.qualifications),
    certifications: csv(profile?.certifications),
    specialisations: csv(profile?.specialisations),
    languages: csv(profile?.languages),
    serviceLocations: (profile?.serviceLocations || []).map((item: any) => [item.city, item.state, item.radiusKm ? `${item.radiusKm} km` : ''].filter(Boolean).join(', ')).join('; '),
    officeLine1: office.line1 || '',
    officeCity: office.city || '',
    officeState: office.state || '',
    officeCountry: office.country || 'India',
    officePostalCode: office.postalCode || '',
    publicPhone: contact.phone || '',
    publicEmail: contact.email || '',
    publicWebsite: contact.website || '',
    workingHours: jsonText(profile?.workingHours),
    emergencyAvailable: Boolean(profile?.emergencyAvailable),
    portfolio: jsonText(profile?.portfolio),
    achievements: csv(profile?.achievements),
    equipmentSummary: csv(profile?.equipmentSummary),
    teamSize: profile?.teamSize ?? '',
    availability: profile?.availability || 'available',
    startingPrice: profile?.startingPrice ?? '',
    averageCompletionDays: profile?.averageCompletionDays ?? '',
    terms: profile?.terms || '',
    visibility: profile?.visibility || 'private',
    publicSlug: profile?.publicSlug || '',
    exactCoordinatesPublic: Boolean(profile?.exactCoordinatesPublic),
    isFeatured: Boolean(profile?.isFeatured),
    isRecommended: Boolean(profile?.isRecommended),
  };
}

function parseJson(value: string, label: string) {
  const input = String(value || '').trim();
  if (!input) return undefined;
  try { return JSON.parse(input); } catch { throw new Error(`${label} must contain valid JSON`); }
}

function profilePayload(draft: Record<string, any>) {
  return {
    profileType: draft.profileType,
    name: String(draft.name || '').trim(),
    professionalTitle: draft.professionalTitle,
    profilePhoto: draft.profilePhoto,
    agencyLogo: draft.agencyLogo,
    description: draft.description,
    yearsExperience: Number(draft.yearsExperience || 0),
    registrationNumber: draft.registrationNumber,
    licenceNumber: draft.licenceNumber,
    qualifications: String(draft.qualifications || '').split(',').map((item) => item.trim()).filter(Boolean),
    certifications: String(draft.certifications || '').split(',').map((item) => item.trim()).filter(Boolean),
    specialisations: String(draft.specialisations || '').split(',').map((item) => item.trim()).filter(Boolean),
    languages: String(draft.languages || '').split(',').map((item) => item.trim()).filter(Boolean),
    serviceLocations: String(draft.serviceLocations || '').split(';').map((item) => item.trim()).filter(Boolean).map((item) => {
      const parts = item.split(',').map((part) => part.trim()).filter(Boolean);
      const radiusPart = parts.find((part) => /\d+\s*km/i.test(part));
      return { city: parts[0] || '', state: parts[1] || '', radiusKm: radiusPart ? Number(radiusPart.replace(/[^\d.]/g, '')) : 50 };
    }),
    officeAddress: { line1: draft.officeLine1, city: draft.officeCity, state: draft.officeState, country: draft.officeCountry || 'India', postalCode: draft.officePostalCode },
    publicContact: { phone: draft.publicPhone, email: draft.publicEmail, website: draft.publicWebsite },
    workingHours: parseJson(draft.workingHours, 'Working hours'),
    emergencyAvailable: Boolean(draft.emergencyAvailable),
    portfolio: parseJson(draft.portfolio, 'Portfolio') || [],
    achievements: String(draft.achievements || '').split(',').map((item) => item.trim()).filter(Boolean),
    equipmentSummary: String(draft.equipmentSummary || '').split(',').map((item) => item.trim()).filter(Boolean),
    teamSize: Number(draft.teamSize || 0),
    availability: draft.availability,
    startingPrice: Number(draft.startingPrice || 0),
    averageCompletionDays: Number(draft.averageCompletionDays || 0),
    terms: draft.terms,
    visibility: draft.visibility,
    publicSlug: draft.publicSlug,
    exactCoordinatesPublic: Boolean(draft.exactCoordinatesPublic),
    isFeatured: Boolean(draft.isFeatured),
    isRecommended: Boolean(draft.isRecommended),
  };
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, height: '100%' }}><CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}><Box><Typography color="text.secondary" sx={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</Typography><Typography sx={{ mt: .5, fontSize: 22, fontWeight: 950 }}>{value}</Typography></Box><Box sx={{ color: 'primary.main' }}>{icon}</Box></Stack></CardContent></Card>;
}

export default function SurveyorProfileAdminPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const actions = useActionDialog();
  const [profile, setProfile] = useState<any>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [related, setRelated] = useState({ verifications: [] as any[], subscriptions: [] as any[], services: [] as any[], projects: [] as any[] });
  const [reviewStatus, setReviewStatus] = useState('under_review');
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(showLoading = true) {
    if (!id || user?.role !== 'admin') return;
    if (showLoading) setLoading(true);
    setError('');
    try {
      const response = await getResourceById('surveyor-profiles', id);
      const next = response.data;
      setProfile(next);
      setDraft(makeDraft(next));
      const userId = idOf(next.user);
      const empty = Promise.resolve({ data: [] as any[] });
      const results = await Promise.all([
        userId ? getResource('surveyor-verifications', { user: userId, limit: 20, sort: '-updatedAt' }) : empty,
        userId ? getResource('surveyor-subscriptions', { user: userId, limit: 20, sort: '-updatedAt' }) : empty,
        userId ? getResource('survey-services', { surveyor: userId, limit: 100, sort: '-updatedAt' }) : empty,
        userId ? getResource('survey-projects', { surveyor: userId, limit: 100, sort: '-updatedAt' }) : empty,
      ]);
      const nextRelated = { verifications: results[0].data || [], subscriptions: results[1].data || [], services: results[2].data || [], projects: results[3].data || [] };
      setRelated(nextRelated);
      const verification = nextRelated.verifications[0];
      setReviewStatus(verification?.status && VERIFICATION_STATUSES.includes(verification.status) ? verification.status : 'under_review');
      setReviewNotes(verification?.reviewerNotes || '');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not load this surveyor profile');
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id, user?.role]);

  const userRecord = profile?.user && typeof profile.user === 'object' ? profile.user : null;
  const verification = related.verifications[0];
  const subscription = related.subscriptions.find((item) => ['active', 'trial', 'grace_period', 'expiring_soon'].includes(String(item.status))) || related.subscriptions[0];
  const metricValues = useMemo(() => [
    { label: 'Profile views', value: String(profile?.metrics?.views || 0), icon: <PublicRounded /> },
    { label: 'Enquiries', value: String(profile?.metrics?.enquiries || 0), icon: <ManageAccountsRounded /> },
    { label: 'Conversions', value: String(profile?.metrics?.conversions || 0), icon: <AssignmentTurnedInRounded /> },
    { label: 'Completed projects', value: String(profile?.completedProjects || related.projects.filter((item) => item.status === 'completed').length || 0), icon: <WorkspacePremiumRounded /> },
  ], [profile, related.projects]);

  function setField(name: string, value: any) { setDraft((current) => ({ ...current, [name]: value })); }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setBusy('save'); setError(''); setNotice('');
    try {
      const response = await updateResource('surveyor-profiles', id, profilePayload(draft));
      setProfile(response.data); setDraft(makeDraft(response.data)); setNotice('Surveyor profile updated successfully.');
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not save the surveyor profile'); }
    finally { setBusy(''); }
  }

  async function changePublicationStatus(status: string) {
    if (!id || !PUBLICATION_STATUSES.includes(status)) return;
    setBusy(`status:${status}`); setError(''); setNotice('');
    try {
      const response = await changeResourceStatus('surveyor-profiles', id, status);
      setProfile(response.data); setDraft(makeDraft(response.data)); setNotice(`Publication status changed to ${statusLabel(status)}.`);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not change publication status'); }
    finally { setBusy(''); }
  }

  async function reviewVerification() {
    if (!verification?._id) { setError('No verification record exists for this surveyor yet.'); return; }
    setBusy('verification'); setError(''); setNotice('');
    try {
      await reviewSurveyorVerification(verification._id, { status: reviewStatus, notes: reviewNotes, ...(reviewStatus === 'rejected' ? { rejectionReason: reviewNotes } : {}), ...(reviewStatus === 'suspended' ? { suspensionReason: reviewNotes } : {}) });
      setNotice(`Verification marked ${statusLabel(reviewStatus)}.`);
      await load(false);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not update verification'); }
    finally { setBusy(''); }
  }

  async function removeProfile() {
    if (!id || !await actions.askConfirmation('Delete this Surveyor profile? This removes the profile record and cannot be undone.', { title: 'Delete Surveyor profile', danger: true })) return;
    setBusy('delete'); setError('');
    try { await deleteResource('surveyor-profiles', id); navigate('/app/surveyor-profiles', { replace: true }); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not delete the surveyor profile'); setBusy(''); }
  }

  if (user?.role !== 'admin') return <Box sx={{ maxWidth: 760, mx: 'auto', mt: 8, px: 2 }}><Alert severity="error"><Typography fontWeight={850}>Admin access required</Typography><Typography variant="body2" sx={{ mt: .5 }}>Only administrators can monitor and manage Surveyor profiles.</Typography><Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate('/app/dashboard')}>Return to dashboard</Button></Alert></Box>;
  if (loading) return <Box sx={{ minHeight: '65vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (!profile) return <Box sx={{ maxWidth: 760, mx: 'auto', mt: 8, px: 2 }}><Alert severity="error">Surveyor profile not found.</Alert><Button startIcon={<ArrowBackRounded />} sx={{ mt: 2 }} onClick={() => navigate('/app/surveyor-profiles')}>Back to Surveyor profiles</Button></Box>;

  const isBusy = Boolean(busy);
  const profileName = profile.name || userRecord?.name || 'Surveyor profile';
  const profileImage = profile.profilePhoto || profile.agencyLogo || userRecord?.avatar;
  const textFields: Array<[string, string, string?]> = [
    ['name', 'Surveyor or agency name'], ['professionalTitle', 'Professional title'], ['profilePhoto', 'Profile photograph URL'], ['agencyLogo', 'Agency logo URL'],
    ['yearsExperience', 'Years of experience', 'number'], ['registrationNumber', 'Registration number'], ['licenceNumber', 'Licence number'], ['teamSize', 'Team size', 'number'],
    ['startingPrice', 'Starting service price', 'number'], ['averageCompletionDays', 'Average completion time (days)', 'number'], ['publicSlug', 'Public profile slug'],
    ['publicPhone', 'Public phone'], ['publicEmail', 'Public email'], ['publicWebsite', 'Public website'], ['officeLine1', 'Office address'], ['officeCity', 'Office city'],
    ['officeState', 'Office state'], ['officeCountry', 'Office country'], ['officePostalCode', 'Office postal code'],
  ];

  return <Box data-secureasset-surveyor-admin-profile="live-detail-v210" data-secureasset-surveyor-admin-profile-edit="inline-v210" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 2.5 }}>
      <Box><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/app/surveyor-profiles')} sx={{ mb: .7, px: 0 }}>All Surveyor profiles</Button><Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: '-.04em' }}>Surveyor profile</Typography><Typography color="text.secondary">Monitor the live account, verification, subscription and marketplace publication state.</Typography></Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Chip color={profile.verificationStatus === 'verified' ? 'success' : 'warning'} icon={<VerifiedRounded />} label={`Verification · ${statusLabel(profile.verificationStatus)}`} /><Chip color={profile.publicationStatus === 'published' ? 'success' : 'default'} label={`Publication · ${statusLabel(profile.publicationStatus)}`} /></Stack>
    </Stack>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}

    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, mb: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 5 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Avatar src={profileImage} sx={{ width: 92, height: 92, bgcolor: 'primary.main', fontSize: 34 }}>{profileName[0]}</Avatar>
          <Box><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h5" sx={{ fontWeight: 950 }}>{profileName}</Typography><VerifiedRounded color="primary" /></Stack><Typography color="text.secondary">{profile.professionalTitle || statusLabel(profile.profileType)}</Typography><Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 1 }}><Rating readOnly size="small" precision={.1} value={Number(profile.rating?.average || 0)} /><Typography sx={{ fontSize: 12 }}>{Number(profile.rating?.average || 0).toFixed(1)} / 5 · {profile.rating?.count || 0} reviews</Typography></Stack><Typography color="text.secondary" sx={{ mt: 1, fontSize: 12 }}>{userRecord?.email || 'Account email unavailable'}{userRecord?.phone ? ` · ${userRecord.phone}` : ''}</Typography></Box>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row', md: 'column' }} spacing={1} alignItems={{ md: 'flex-end' }}><Button variant="outlined" startIcon={<VisibilityOffRounded />} disabled={isBusy} onClick={() => void changePublicationStatus('paused')}>Pause listing</Button><Button color="error" variant="outlined" startIcon={<DeleteOutlineRounded />} disabled={isBusy} onClick={() => void removeProfile()}>Delete profile</Button></Stack>
      </Stack>
    </Paper>

    <Grid container spacing={1.5} sx={{ mb: 2.5 }}>{metricValues.map((item) => <Grid key={item.label} size={{ xs: 6, md: 3 }}><Metric {...item} /></Grid>)}</Grid>

    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Paper component="form" onSubmit={save} elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid', borderColor: 'divider', borderRadius: 5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 2 }}><Box><Typography variant="h6" sx={{ fontWeight: 950 }}>Edit full profile</Typography><Typography color="text.secondary" sx={{ fontSize: 12 }}>Changes are saved through the live admin resource API and reflected immediately.</Typography></Box><EditRounded color="primary" /></Stack>
          <Grid container spacing={1.7}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField select fullWidth size="small" label="Profile type" value={draft.profileType || 'individual'} onChange={(event) => setField('profileType', event.target.value)}><MenuItem value="individual">Independent surveyor</MenuItem><MenuItem value="agency">Survey agency</MenuItem></TextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField select fullWidth size="small" label="Availability" value={draft.availability || 'available'} onChange={(event) => setField('availability', event.target.value)}>{['available', 'busy', 'limited', 'unavailable'].map((item) => <MenuItem key={item} value={item}>{statusLabel(item)}</MenuItem>)}</TextField></Grid>
            {textFields.map(([name, label, type]) => <Grid size={{ xs: 12, sm: 6 }} key={name}><TextField fullWidth size="small" type={type || 'text'} label={label} value={draft[name] ?? ''} onChange={(event) => setField(name, type === 'number' ? event.target.value : event.target.value)} /></Grid>)}
            <Grid size={12}><TextField fullWidth multiline minRows={4} size="small" label="Professional description" value={draft.description || ''} onChange={(event) => setField('description', event.target.value)} /></Grid>
            {([['qualifications', 'Qualifications (comma separated)'], ['certifications', 'Certifications (comma separated)'], ['specialisations', 'Specialisations (comma separated)'], ['languages', 'Languages (comma separated)'], ['achievements', 'Achievements (comma separated)'], ['equipmentSummary', 'Equipment summary (comma separated)']] as Array<[string, string]>).map(([name, label]) => <Grid size={{ xs: 12, sm: 6 }} key={name}><TextField fullWidth size="small" label={label} value={draft[name] || ''} onChange={(event) => setField(name, event.target.value)} /></Grid>)}
            <Grid size={12}><TextField fullWidth size="small" label="Service locations (City, State, radius km; City, State)" value={draft.serviceLocations || ''} onChange={(event) => setField('serviceLocations', event.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth multiline minRows={4} size="small" label="Working hours JSON" value={draft.workingHours || ''} onChange={(event) => setField('workingHours', event.target.value)} placeholder={'{\n  "monday": "09:00-18:00"\n}'} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth multiline minRows={4} size="small" label="Portfolio JSON" value={draft.portfolio || ''} onChange={(event) => setField('portfolio', event.target.value)} placeholder={'[{ "title": "Boundary survey", "description": "…", "images": [] }]'}/></Grid>
            <Grid size={12}><TextField fullWidth multiline minRows={3} size="small" label="Terms and conditions" value={draft.terms || ''} onChange={(event) => setField('terms', event.target.value)} /></Grid>
            <Grid size={12}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap><TextField select size="small" label="Profile visibility" value={draft.visibility || 'private'} onChange={(event) => setField('visibility', event.target.value)} sx={{ minWidth: 170 }}><MenuItem value="private">Private</MenuItem><MenuItem value="public">Public</MenuItem></TextField>{[['emergencyAvailable', 'Emergency available'], ['exactCoordinatesPublic', 'Exact coordinates public'], ['isFeatured', 'Featured'], ['isRecommended', 'Recommended']].map(([name, label]) => <Button key={name} variant={draft[name] ? 'contained' : 'outlined'} onClick={() => setField(name, !draft[name])}>{label}: {draft[name] ? 'Yes' : 'No'}</Button>)}</Stack></Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2.5 }}><Button type="submit" variant="contained" startIcon={<SaveRounded />} disabled={isBusy}>{busy === 'save' ? 'Saving…' : 'Save profile changes'}</Button></Stack>
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <Stack spacing={2.5}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 5 }}>
            <Stack direction="row" spacing={1} alignItems="center"><BusinessRounded color="primary" /><Typography variant="h6" sx={{ fontWeight: 950 }}>Publication control</Typography></Stack>
            <Typography color="text.secondary" sx={{ fontSize: 12, mt: .6 }}>Only an administrator can publish this profile to the public Surveyor directory.</Typography>
            <TextField select fullWidth size="small" label="Publication status" value={profile.publicationStatus || 'draft'} onChange={(event) => void changePublicationStatus(event.target.value)} disabled={isBusy} sx={{ mt: 2 }}>{PUBLICATION_STATUSES.map((item) => <MenuItem key={item} value={item}>{statusLabel(item)}</MenuItem>)}</TextField>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}><Chip size="small" label={`Visibility · ${statusLabel(profile.visibility)}`} /><Chip size="small" label={`Slug · ${profile.publicSlug || 'not set'}`} /></Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 5 }}>
            <Stack direction="row" spacing={1} alignItems="center"><VerifiedRounded color="primary" /><Typography variant="h6" sx={{ fontWeight: 950 }}>Verification review</Typography></Stack>
            <Stack spacing={1.3} sx={{ mt: 1.7 }}><Chip sx={{ alignSelf: 'flex-start' }} color={verification?.status === 'verified' ? 'success' : 'warning'} label={statusLabel(verification?.status || profile.verificationStatus)} /><Typography color="text.secondary" sx={{ fontSize: 12 }}>Submitted {dateLabel(verification?.submittedAt || profile.createdAt)}</Typography><TextField select fullWidth size="small" label="Review status" value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)} disabled={!verification || isBusy}>{VERIFICATION_STATUSES.map((item) => <MenuItem key={item} value={item}>{statusLabel(item)}</MenuItem>)}</TextField><TextField fullWidth multiline minRows={3} size="small" label="Reviewer notes" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} disabled={!verification || isBusy} /><Button variant="contained" startIcon={<AssignmentTurnedInRounded />} onClick={() => void reviewVerification()} disabled={!verification || isBusy}>{busy === 'verification' ? 'Updating…' : 'Save verification review'}</Button></Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 5 }}>
            <Stack direction="row" spacing={1} alignItems="center"><WorkspacePremiumRounded color="primary" /><Typography variant="h6" sx={{ fontWeight: 950 }}>Subscription monitor</Typography></Stack>
            {subscription ? <Stack spacing={1.1} sx={{ mt: 1.7 }}><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 12 }}>Plan</Typography><Typography sx={{ fontWeight: 800 }}>{subscription.plan?.name || subscription.planKey || 'Surveyor plan'}</Typography></Stack><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 12 }}>Status</Typography><Chip size="small" color={subscription.status === 'active' ? 'success' : 'warning'} label={statusLabel(subscription.status)} /></Stack><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 12 }}>Expires</Typography><Typography sx={{ fontSize: 12 }}>{dateLabel(subscription.expiresAt)}</Typography></Stack></Stack> : <Typography color="text.secondary" sx={{ mt: 1.5, fontSize: 13 }}>No subscription record found for this account.</Typography>}
          </Paper>
        </Stack>
      </Grid>
    </Grid>

    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, mt: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 5 }}>
      <Typography variant="h6" sx={{ fontWeight: 950 }}>Profile monitor</Typography>
      <Typography color="text.secondary" sx={{ fontSize: 12, mt: .5 }}>Live linked records for this Surveyor account. The list is refreshed after every profile or verification change.</Typography>
      <Grid container spacing={2} sx={{ mt: .4 }}>
        <Grid size={{ xs: 12, md: 4 }}><Stack direction="row" spacing={1.2}><LocationOnRounded color="primary" /><Box><Typography sx={{ fontWeight: 850, fontSize: 13 }}>Service locations</Typography><Typography color="text.secondary" sx={{ fontSize: 12 }}>{(profile.serviceLocations || []).map((item: any) => [item.city, item.state].filter(Boolean).join(', ')).filter(Boolean).join(' · ') || 'Not specified'}</Typography></Box></Stack></Grid>
        <Grid size={{ xs: 12, md: 4 }}><Stack direction="row" spacing={1.2}><LanguageRounded color="primary" /><Box><Typography sx={{ fontWeight: 850, fontSize: 13 }}>Languages</Typography><Typography color="text.secondary" sx={{ fontSize: 12 }}>{(profile.languages || []).join(', ') || 'Not specified'}</Typography></Box></Stack></Grid>
        <Grid size={{ xs: 12, md: 4 }}><Stack direction="row" spacing={1.2}><ScheduleRounded color="primary" /><Box><Typography sx={{ fontWeight: 850, fontSize: 13 }}>Response time</Typography><Typography color="text.secondary" sx={{ fontSize: 12 }}>{profile.metrics?.responseMinutes ? `${profile.metrics.responseMinutes} minutes` : 'Not measured yet'}</Typography></Box></Stack></Grid>
      </Grid>
      <Divider sx={{ my: 2 }} />
      <Grid container spacing={1.5}><Grid size={{ xs: 6, md: 3 }}><Metric label="Services" value={String(related.services.length)} icon={<StarRounded />} /></Grid><Grid size={{ xs: 6, md: 3 }}><Metric label="Projects" value={String(related.projects.length)} icon={<AssignmentTurnedInRounded />} /></Grid><Grid size={{ xs: 6, md: 3 }}><Metric label="Account created" value={dateLabel(profile.createdAt)} icon={<ScheduleRounded />} /></Grid><Grid size={{ xs: 6, md: 3 }}><Metric label="Last updated" value={dateLabel(profile.updatedAt)} icon={<EditRounded />} /></Grid></Grid>
      {(related.services.length > 0 || related.projects.length > 0) && <Box sx={{ mt: 2 }}><Typography sx={{ fontWeight: 850, fontSize: 13, mb: 1 }}>Recent linked activity</Typography><Stack spacing={.8}>{[...related.services.slice(0, 3).map((item) => ({ label: item.title || 'Survey service', status: item.status, date: item.updatedAt })), ...related.projects.slice(0, 3).map((item) => ({ label: item.projectNumber || item.title || 'Survey project', status: item.status, date: item.updatedAt }))].map((item, index) => <Stack key={`${item.label}-${index}`} direction="row" justifyContent="space-between" spacing={1} sx={{ p: 1.1, borderRadius: 2, bgcolor: 'action.hover' }}><Typography sx={{ fontSize: 12, fontWeight: 700 }}>{item.label}</Typography><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={statusLabel(item.status)} /><Typography color="text.secondary" sx={{ fontSize: 11 }}>{dateLabel(item.date)}</Typography></Stack></Stack>)}</Stack></Box>}
    </Paper>
    {actions.dialogs}
  </Box>;
}
