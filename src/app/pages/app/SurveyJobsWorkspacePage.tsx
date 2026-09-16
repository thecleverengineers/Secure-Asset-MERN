import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, DialogActions, DialogContent, Divider, Grid,
  MenuItem, Rating, Stack, TextField, Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ChatRounded from '@mui/icons-material/ChatRounded';
import GavelRounded from '@mui/icons-material/GavelRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import { useNavigate } from 'react-router';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';
import {
  createConversation, createResource, getLandlordSurveyJobs, getMyListings, getSurveyJobBids, hireSurveyorFromQuotation,
} from '../../services/api';

const money = (value: unknown) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const label = (value: unknown) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const initialJob = { property: '', title: '', surveyType: 'land_measurement', landArea: '', measurementUnit: 'sq_ft', purpose: '', preferredVisitDate: '', preferredCompletionDate: '', budgetMin: '', budgetMax: '', requirements: '', deliverables: '', description: '', urgency: 'normal' };
const splitLines = (value: string) => value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);

export default function SurveyJobsWorkspacePage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [hireTarget, setHireTarget] = useState<any>(null);
  const [job, setJob] = useState<Record<string, string>>(initialJob);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selectedProperty = useMemo(() => properties.find((item) => item._id === job.property), [job.property, properties]);

  async function load() {
    setLoading(true); setError('');
    try {
      const [jobResponse, propertyResponse] = await Promise.all([getLandlordSurveyJobs({ limit: 50 }), getMyListings({ limit: 100 })]);
      setJobs(jobResponse.data || []); setProperties(propertyResponse.data || []);
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function openBids(item: any) {
    setSelectedJob(item); setError(''); setBids([]);
    try { const response = await getSurveyJobBids(item._id); setBids(response.data?.bids || []); }
    catch (reason) { setError((reason as Error).message); }
  }

  async function submitJob(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await createResource('survey-jobs', {
        property: job.property, title: job.title.trim(), surveyType: job.surveyType, landArea: Number(job.landArea || 0), measurementUnit: job.measurementUnit,
        purpose: job.purpose.trim(), preferredVisitDate: job.preferredVisitDate || undefined, preferredCompletionDate: job.preferredCompletionDate || undefined,
        budget: { min: Number(job.budgetMin || 0), max: Number(job.budgetMax || 0), currency: 'INR' }, requirements: splitLines(job.requirements),
        deliverables: splitLines(job.deliverables), description: job.description.trim(), urgency: job.urgency, visibility: 'public', status: 'open', bookingType: 'quotation',
      });
      setCreateOpen(false); setJob(initialJob); setNotice('Survey job posted. Verified Surveyors can now submit proposals.'); await load();
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function hire() {
    if (!hireTarget) return;
    setBusy(true); setError('');
    try {
      const response = await hireSurveyorFromQuotation(hireTarget._id);
      const projectId = response.data?.project?._id;
      setHireTarget(null); setSelectedJob(null); setNotice(`${hireTarget.surveyor?.name || 'Surveyor'} was hired. Payment and delivery tracking are secured in the new project.`); await load();
      if (projectId) navigate(`/app/survey-projects/${projectId}`);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function chatWith(bid: any) {
    setBusy(true); setError('');
    try {
      const response = await createConversation({ participants: [bid.surveyor?._id || bid.surveyor], type: 'survey', title: `Survey job · ${selectedJob?.title || 'Discussion'}`, reference: { model: 'SurveyQuotation', id: bid._id, label: selectedJob?.title || 'Survey proposal' } });
      navigate(`/app/messages?conversation=${response.data?._id || ''}`);
    } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 7 }}>
    <CompactPageToolbar marker="survey-jobs-toolbar-v153" title="Survey Jobs" description="Post a job, compare verified Surveyors, chat, and hire one proposal." actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}>Post survey job</Button>} />
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {loading ? <Box sx={{ py: 10, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : !jobs.length ? <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4 }}><CardContent sx={{ p: 4, textAlign: 'center' }}><GavelRounded color="primary" sx={{ fontSize: 44 }} /><Typography sx={{ fontWeight: 900, mt: 1 }}>No survey jobs yet</Typography><Typography color="text.secondary" sx={{ mb: 2 }}>Choose an owned property and publish its survey requirements.</Typography><Button variant="contained" onClick={() => setCreateOpen(true)} disabled={!properties.length}>Create your first job</Button>{!properties.length && <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>Add a property before posting a survey job.</Typography>}</CardContent></Card> : <Grid container spacing={2}>{jobs.map((item) => <Grid size={{ xs: 12, md: 6 }} key={item._id}><Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 4 }}><CardContent sx={{ p: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1}><Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 900, fontSize: 17 }} noWrap>{item.title}</Typography><Typography color="primary" sx={{ mt: .5, fontSize: 12, fontWeight: 800 }}>{label(item.surveyType)}</Typography></Box><Chip size="small" label={label(item.workflowStage || item.status)} color={item.workflowStage === 'completed' ? 'success' : item.status === 'open' || item.status === 'quotation_review' ? 'primary' : 'default'} /></Stack>
      <Stack spacing={.9} sx={{ my: 2 }}><Stack direction="row" spacing={1} alignItems="center"><LocationOnRounded sx={{ fontSize: 18 }} color="action" /><Typography variant="body2" color="text.secondary">{item.addressApproximate || 'Property location protected'}</Typography></Stack><Typography variant="body2" color="text.secondary">Budget · {money(item.budget?.min)} – {money(item.budget?.max)}</Typography><Typography variant="body2" color="text.secondary">Visit · {item.preferredVisitDate ? new Date(item.preferredVisitDate).toLocaleDateString('en-IN') : 'Flexible'} · Deadline · {item.preferredCompletionDate ? new Date(item.preferredCompletionDate).toLocaleDateString('en-IN') : 'Flexible'}</Typography><Typography variant="body2" color="text.secondary">{item.quotationCount || 0} proposal{Number(item.quotationCount || 0) === 1 ? '' : 's'} received</Typography></Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap><Button size="small" variant="outlined" startIcon={<VisibilityRounded />} onClick={() => openBids(item)}>Review proposals</Button>{item.hiredSurveyor && <Button size="small" variant="contained" endIcon={<OpenInNewRounded />} onClick={() => navigate('/app/survey-projects')}>Open project</Button>}</Stack>
    </CardContent></Card></Grid>)}</Grid>}

    <ProfessionalDialog open={Boolean(selectedJob)} onClose={() => setSelectedJob(null)} maxWidth="md" fullWidth professionalTitle={`Proposals · ${selectedJob?.title || ''}`} professionalSubtitle="Compare experience, rating, portfolio, distance, price, and dates before hiring."><DialogContent dividers><Stack spacing={1.5}>{!bids.length ? <Alert severity="info">No submitted proposals are available for this job yet.</Alert> : bids.map((bid) => { const profile = bid.professionalProfile || {}; return <Card key={bid._id} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}><CardContent sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Box><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap><Typography sx={{ fontWeight: 900, fontSize: 17 }}>{bid.surveyor?.name || 'Surveyor'}</Typography>{profile.verificationStatus === 'verified' && <Chip size="small" color="success" label="Verified" />}</Stack><Typography color="text.secondary" variant="body2">{profile.professionalTitle || 'Professional Surveyor'} · {Number(profile.yearsExperience || 0)} years experience</Typography><Stack direction="row" spacing={.8} alignItems="center" sx={{ mt: .5 }}><Rating size="small" readOnly precision={.1} value={Number(profile.rating?.average || 0)} /><Typography variant="caption" color="text.secondary">{Number(profile.rating?.average || 0).toFixed(1)} ({profile.rating?.count || 0}) · {profile.completedProjects || 0} completed · {profile.portfolio?.length || 0} portfolio items</Typography></Stack></Box><Chip label={label(bid.status)} size="small" color={bid.status === 'accepted' ? 'success' : 'primary'} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }} /></Stack>
      {!!profile.specialisations?.length && <Stack direction="row" spacing={.6} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>{profile.specialisations.slice(0, 4).map((item: string) => <Chip key={item} size="small" variant="outlined" label={item} />)}</Stack>}
      {!!profile.qualifications?.length && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Qualifications · {profile.qualifications.slice(0, 3).join(' · ')}</Typography>}
      {!!profile.portfolio?.length && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .5 }}>Previous work · {profile.portfolio.slice(0, 3).map((item: any) => item.title).filter(Boolean).join(' · ') || `${profile.portfolio.length} portfolio records`}</Typography>}
      <Typography variant="body2" sx={{ mt: 1.5 }}>{bid.scope || 'Scope details shared in proposal.'}</Typography>{bid.methodology && <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{bid.methodology}</Typography>}
      <Divider sx={{ my: 1.5 }} /><Grid container spacing={1.5}><Grid size={{ xs: 6, sm: 3 }}><Typography variant="caption" color="text.secondary">PRICE</Typography><Typography sx={{ fontWeight: 900 }}>{money(bid.totalAmount)}</Typography></Grid><Grid size={{ xs: 6, sm: 3 }}><Typography variant="caption" color="text.secondary">DISTANCE</Typography><Typography sx={{ fontWeight: 900 }}>{Number.isFinite(bid.distanceKm) ? `${bid.distanceKm} km` : '—'}</Typography></Grid><Grid size={{ xs: 6, sm: 3 }}><Typography variant="caption" color="text.secondary">START</Typography><Typography sx={{ fontWeight: 800 }}>{bid.estimatedStartDate ? new Date(bid.estimatedStartDate).toLocaleDateString('en-IN') : 'Flexible'}</Typography></Grid><Grid size={{ xs: 6, sm: 3 }}><Typography variant="caption" color="text.secondary">COMPLETE</Typography><Typography sx={{ fontWeight: 800 }}>{bid.estimatedCompletionDate ? new Date(bid.estimatedCompletionDate).toLocaleDateString('en-IN') : 'Flexible'}</Typography></Grid></Grid>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}><Button size="small" variant="outlined" startIcon={<ChatRounded />} onClick={() => chatWith(bid)} disabled={busy}>Chat / negotiate</Button>{['submitted', 'viewed', 'under_negotiation', 'revised'].includes(bid.status) && !selectedJob?.hiredSurveyor && <Button size="small" variant="contained" startIcon={<GavelRounded />} onClick={() => setHireTarget(bid)}>Hire Surveyor</Button>}</Stack>
    </CardContent></Card>; })}</Stack></DialogContent></ProfessionalDialog>

    <ProfessionalDialog open={Boolean(hireTarget)} onClose={() => setHireTarget(null)} maxWidth="sm" fullWidth professionalTitle="Hire this Surveyor" professionalSubtitle="This locks the selected proposal and creates the secure project and payment record."><DialogContent dividers><Alert severity="warning">Hire {hireTarget?.surveyor?.name || 'this Surveyor'} for {money(hireTarget?.totalAmount)}? All other proposals for this job will be rejected.</Alert></DialogContent><DialogActions><Button onClick={() => setHireTarget(null)}>Cancel</Button><Button variant="contained" startIcon={<GavelRounded />} onClick={hire} disabled={busy}>{busy ? 'Hiring…' : 'Confirm hire'}</Button></DialogActions></ProfessionalDialog>

    <ProfessionalDialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth professionalTitle="Post a survey job" professionalSubtitle="The property must belong to your landlord-enabled account."><Box component="form" onSubmit={submitJob}><DialogContent dividers><Grid container spacing={2}>
      <Grid size={12}><TextField required select fullWidth label="Property" value={job.property} onChange={(event) => setJob({ ...job, property: event.target.value })}>{properties.map((property) => <MenuItem key={property._id} value={property._id}>{property.title || property.name || property.referenceNumber || property.code || property._id}</MenuItem>)}</TextField>{selectedProperty && <Typography variant="caption" color="text.secondary">{selectedProperty.address?.fullAddress || [selectedProperty.address?.line1, selectedProperty.address?.locality, selectedProperty.address?.city, selectedProperty.address?.state].filter(Boolean).join(', ')}</Typography>}</Grid>
      <Grid size={{ xs: 12, sm: 7 }}><TextField required fullWidth label="Job title" value={job.title} onChange={(event) => setJob({ ...job, title: event.target.value })} placeholder="Boundary and built-up area survey" /></Grid><Grid size={{ xs: 12, sm: 5 }}><TextField required select fullWidth label="Survey type" value={job.surveyType} onChange={(event) => setJob({ ...job, surveyType: event.target.value })}>{['land_measurement', 'boundary_survey', 'building_survey', 'valuation', 'topographic', 'condition_survey', 'legal_verification', 'other'].map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}</TextField></Grid>
      <Grid size={{ xs: 12, sm: 6 }}><TextField required type="number" fullWidth label="Approximate size" value={job.landArea} onChange={(event) => setJob({ ...job, landArea: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField required select fullWidth label="Measurement unit" value={job.measurementUnit} onChange={(event) => setJob({ ...job, measurementUnit: event.target.value })}>{['sq_ft', 'sq_metre', 'acre', 'bigha', 'hectare'].map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}</TextField></Grid>
      <Grid size={12}><TextField required fullWidth label="Purpose" value={job.purpose} onChange={(event) => setJob({ ...job, purpose: event.target.value })} placeholder="Sale verification, construction, boundary confirmation…" /></Grid>
      <Grid size={{ xs: 12, sm: 6 }}><TextField required type="date" fullWidth label="Preferred visit date" InputLabelProps={{ shrink: true }} value={job.preferredVisitDate} onChange={(event) => setJob({ ...job, preferredVisitDate: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField required type="date" fullWidth label="Report deadline" InputLabelProps={{ shrink: true }} value={job.preferredCompletionDate} onChange={(event) => setJob({ ...job, preferredCompletionDate: event.target.value })} /></Grid>
      <Grid size={{ xs: 12, sm: 4 }}><TextField required type="number" fullWidth label="Minimum budget" value={job.budgetMin} onChange={(event) => setJob({ ...job, budgetMin: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 4 }}><TextField required type="number" fullWidth label="Maximum budget" value={job.budgetMax} onChange={(event) => setJob({ ...job, budgetMax: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 4 }}><TextField select fullWidth label="Urgency" value={job.urgency} onChange={(event) => setJob({ ...job, urgency: event.target.value })}>{['normal', 'priority', 'urgent', 'emergency'].map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}</TextField></Grid>
      <Grid size={{ xs: 12, md: 6 }}><TextField required fullWidth multiline minRows={3} label="Requirements (one per line)" value={job.requirements} onChange={(event) => setJob({ ...job, requirements: event.target.value })} /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField required fullWidth multiline minRows={3} label="Expected deliverables (one per line)" value={job.deliverables} onChange={(event) => setJob({ ...job, deliverables: event.target.value })} /></Grid><Grid size={12}><TextField fullWidth multiline minRows={3} label="Additional description and site access notes" value={job.description} onChange={(event) => setJob({ ...job, description: event.target.value })} /></Grid>
    </Grid></DialogContent><DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy || !job.property || !job.title.trim() || !job.purpose.trim() || !Number(job.landArea) || !Number(job.budgetMax) || Number(job.budgetMax) < Number(job.budgetMin) || !splitLines(job.requirements).length || !splitLines(job.deliverables).length}>{busy ? 'Publishing…' : 'Publish survey job'}</Button></DialogActions></Box></ProfessionalDialog>
  </Box>;
}
