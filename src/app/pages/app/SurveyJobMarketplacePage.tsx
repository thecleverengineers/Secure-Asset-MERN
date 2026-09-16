import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, DialogActions, DialogContent, Divider, Grid,
  InputAdornment, MenuItem, Pagination, Stack, TextField, Typography,
} from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CancelRounded from '@mui/icons-material/CancelRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import StraightenRounded from '@mui/icons-material/StraightenRounded';
import TimerRounded from '@mui/icons-material/TimerRounded';
import { useNavigate } from 'react-router';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';
import { createResource, getSurveyJobMarketplace, respondSurveyorQuoteRequest } from '../../services/api';

const money = (value: unknown) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const label = (value: unknown) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const initialQuote = { scope: '', methodology: '', totalAmount: '', advanceAmount: '', estimatedStartDate: '', estimatedCompletionDate: '', validUntil: '', terms: '' };

export default function SurveyJobMarketplacePage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ search: '', location: '', category: '', urgency: '' });
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [quote, setQuote] = useState(initialQuote);
  const [requestResponse, setRequestResponse] = useState<any>(null);
  const [responseReason, setResponseReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(next = page, origin = position) {
    setLoading(true); setError('');
    try {
      const response = await getSurveyJobMarketplace({ ...filters, ...(origin || {}), page: next, limit: 12 });
      setJobs(response.data || []); setTotalPages(response.totalPages || 1); setPage(next);
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!navigator.geolocation) { void load(1, null); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { const origin = { latitude: coords.latitude, longitude: coords.longitude }; setPosition(origin); void load(1, origin); },
      () => void load(1, null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError('');
    try {
      await createResource('survey-quotations', {
        job: selected._id, scope: quote.scope.trim(), methodology: quote.methodology.trim(), totalAmount: Number(quote.totalAmount),
        advanceAmount: Number(quote.advanceAmount || 0), estimatedStartDate: quote.estimatedStartDate || undefined,
        estimatedCompletionDate: quote.estimatedCompletionDate || undefined, validUntil: quote.validUntil || undefined,
        terms: quote.terms.trim(), distanceKm: Number.isFinite(selected.distanceKm) ? selected.distanceKm : undefined, status: 'submitted',
      });
      setSelected(null); setQuote(initialQuote); setNotice('Your formal proposal was submitted to the landlord.'); await load(page);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function respondToRequest(event: FormEvent) {
    event.preventDefault(); if (!requestResponse) return;
    setBusy(true); setError('');
    try {
      const decision = requestResponse.decision as 'accept' | 'reject';
      const response = await respondSurveyorQuoteRequest(requestResponse._id, { decision, reason: responseReason.trim() || undefined });
      setRequestResponse(null); setResponseReason(''); setNotice(response.message || (decision === 'accept' ? 'Request accepted and project created.' : 'Request rejected.'));
      await load(page);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 7 }}>
    <CompactPageToolbar marker="survey-job-marketplace-toolbar-v153" title="Find Survey Jobs" description="Review requirements, distance, budget, visit date, and deadline before applying." actions={<Button variant="outlined" onClick={() => navigate('/app/survey-quotations')}>My proposals</Button>} />
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}><TextField fullWidth size="small" placeholder="Search survey jobs" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> }} /><TextField size="small" label="Location" value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })} /><TextField size="small" label="Survey type" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} /><TextField select size="small" label="Urgency" value={filters.urgency} onChange={(event) => setFilters({ ...filters, urgency: event.target.value })} sx={{ minWidth: 150 }}><MenuItem value="">All</MenuItem>{['normal', 'priority', 'urgent', 'emergency'].map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}</TextField><Button variant="contained" onClick={() => load(1)}>Search</Button></Stack>
    {position && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>Distance is estimated from your current location; exact property coordinates remain protected until hire.</Typography>}
    {loading ? <Box sx={{ py: 10, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : !jobs.length ? <Alert severity="info">No open survey jobs match these filters.</Alert> : <Grid container spacing={2}>{jobs.map((job) => <Grid size={{ xs: 12, md: 6, lg: 4 }} key={job._id}><Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 4 }}><CardContent sx={{ p: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1}><Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 900, fontSize: 17 }}>{job.title}</Typography><Typography color="primary" sx={{ fontSize: 12, fontWeight: 800, mt: .5 }}>{label(job.surveyType)}</Typography></Box><Chip size="small" color={job.urgency === 'emergency' ? 'error' : job.urgency === 'urgent' ? 'warning' : 'default'} label={label(job.urgency)} /></Stack>
      <Typography color="text.secondary" sx={{ fontSize: 13, mt: 1.5, minHeight: 58 }}>{job.description || 'Formal property survey requested by the landlord.'}</Typography>
      <Stack spacing={1} sx={{ my: 2 }}><Stack direction="row" spacing={1}><LocationOnRounded sx={{ fontSize: 18, color: 'text.secondary' }} /><Typography sx={{ fontSize: 12 }}>{job.addressApproximate || 'Approximate location protected'}{Number.isFinite(job.distanceKm) ? ` · ${job.distanceKm} km away` : ''}</Typography></Stack><Stack direction="row" spacing={1}><StraightenRounded sx={{ fontSize: 18, color: 'text.secondary' }} /><Typography sx={{ fontSize: 12 }}>{job.landArea || '—'} {job.measurementUnit || ''} · {job.propertyType || 'Property'}</Typography></Stack><Stack direction="row" spacing={1}><TimerRounded sx={{ fontSize: 18, color: 'text.secondary' }} /><Typography sx={{ fontSize: 12 }}>Visit {job.preferredVisitDate ? new Date(job.preferredVisitDate).toLocaleDateString('en-IN') : 'flexible'} · due {job.preferredCompletionDate ? new Date(job.preferredCompletionDate).toLocaleDateString('en-IN') : 'flexible'}</Typography></Stack></Stack>
      {!!job.requirements?.length && <Box sx={{ mb: 1.5 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>KEY REQUIREMENTS</Typography><Typography variant="body2">{job.requirements.slice(0, 2).join(' · ')}</Typography></Box>}
      <Divider sx={{ my: 1.5 }} /><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography color="text.secondary" sx={{ fontSize: 10 }}>{job.hiringPath === 'direct_surveyor' ? 'DIRECT QUOTE REQUEST' : 'LANDLORD BUDGET'}</Typography><Typography sx={{ fontWeight: 900 }}>{job.hiringPath === 'direct_surveyor' ? 'Requested directly from you' : `${money(job.budget?.min)} – ${money(job.budget?.max)}`}</Typography></Box>{job.hiringPath === 'direct_surveyor' && job.requestStatus === 'pending' ? <Stack direction="row" spacing={.7}><Button color="success" variant="contained" size="small" startIcon={<CheckCircleRounded />} onClick={() => setRequestResponse({ ...job, decision: 'accept' })}>Accept</Button><Button color="error" variant="outlined" size="small" startIcon={<CancelRounded />} onClick={() => setRequestResponse({ ...job, decision: 'reject' })}>Reject</Button></Stack> : job.myProposal ? <Button variant="outlined" size="small" startIcon={<CheckCircleRounded />} onClick={() => navigate('/app/survey-quotations')}>{label(job.myProposal.status)}</Button> : <Button variant="contained" size="small" startIcon={<RequestQuoteRounded />} onClick={() => setSelected(job)}>Apply & propose</Button>}</Stack>
      <Typography color="text.secondary" sx={{ fontSize: 11, mt: 1.5 }}>{job.quotationCount || 0} proposal{Number(job.quotationCount || 0) === 1 ? '' : 's'} received</Typography>
    </CardContent></Card></Grid>)}</Grid>}
    {!loading && totalPages > 1 && <Stack alignItems="center" sx={{ mt: 3 }}><Pagination count={totalPages} page={page} onChange={(_event, next) => load(next)} /></Stack>}

    <ProfessionalDialog open={Boolean(requestResponse)} onClose={() => !busy && setRequestResponse(null)} maxWidth="sm" fullWidth professionalTitle={requestResponse?.decision === 'accept' ? 'Accept direct quote request' : 'Reject direct quote request'} professionalSubtitle={requestResponse?.decision === 'accept' ? 'This creates the hired project where you and the landlord can chat and agree the two milestones.' : 'The landlord will be notified that you are unavailable for this request.'}><Box component="form" onSubmit={respondToRequest}><DialogContent dividers><Alert severity={requestResponse?.decision === 'accept' ? 'info' : 'warning'}>{requestResponse?.title || 'Direct survey request'}</Alert><TextField fullWidth multiline minRows={3} sx={{ mt: 2 }} label={requestResponse?.decision === 'accept' ? 'Note for the landlord (optional)' : 'Reason (optional)'} value={responseReason} onChange={(event) => setResponseReason(event.target.value)} inputProps={{ maxLength: 1200 }} /></DialogContent><DialogActions><Button onClick={() => setRequestResponse(null)} disabled={busy}>Cancel</Button><Button type="submit" color={requestResponse?.decision === 'accept' ? 'success' : 'error'} variant="contained" disabled={busy}>{busy ? 'Saving…' : requestResponse?.decision === 'accept' ? 'Accept & create project' : 'Reject request'}</Button></DialogActions></Box></ProfessionalDialog>
    <ProfessionalDialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth professionalTitle={`Apply & propose · ${selected?.title || ''}`} professionalSubtitle="Submit your scope, method, price, and delivery commitment."><Box component="form" onSubmit={submit}><DialogContent dividers><Grid container spacing={2}><Grid size={12}><Alert severity="info">{selected?.addressApproximate || 'Approximate location protected'}{Number.isFinite(selected?.distanceKm) ? ` · approximately ${selected.distanceKm} km away` : ''}</Alert></Grid><Grid size={12}><TextField required fullWidth multiline minRows={3} label="Scope of work" value={quote.scope} onChange={(event) => setQuote({ ...quote, scope: event.target.value })} /></Grid><Grid size={12}><TextField required fullWidth multiline minRows={3} label="Survey methodology" value={quote.methodology} onChange={(event) => setQuote({ ...quote, methodology: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField required fullWidth type="number" label="Proposed total amount" value={quote.totalAmount} onChange={(event) => setQuote({ ...quote, totalAmount: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="number" label="Advance amount" value={quote.advanceAmount} onChange={(event) => setQuote({ ...quote, advanceAmount: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 4 }}><TextField required fullWidth type="date" label="Estimated start" InputLabelProps={{ shrink: true }} value={quote.estimatedStartDate} onChange={(event) => setQuote({ ...quote, estimatedStartDate: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 4 }}><TextField required fullWidth type="date" label="Completion date" InputLabelProps={{ shrink: true }} value={quote.estimatedCompletionDate} onChange={(event) => setQuote({ ...quote, estimatedCompletionDate: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth type="date" label="Proposal valid until" InputLabelProps={{ shrink: true }} value={quote.validUntil} onChange={(event) => setQuote({ ...quote, validUntil: event.target.value })} /></Grid><Grid size={12}><TextField fullWidth multiline minRows={2} label="Terms and exclusions" value={quote.terms} onChange={(event) => setQuote({ ...quote, terms: event.target.value })} /></Grid></Grid></DialogContent><DialogActions><Button onClick={() => setSelected(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy || !quote.scope.trim() || !quote.methodology.trim() || !Number(quote.totalAmount)}>{busy ? 'Submitting…' : 'Submit formal proposal'}</Button></DialogActions></Box></ProfessionalDialog>
  </Box>;
}
