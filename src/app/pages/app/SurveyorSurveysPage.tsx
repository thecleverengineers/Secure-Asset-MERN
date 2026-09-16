import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, DialogActions, DialogContent, DialogTitle, Grid, LinearProgress,
  Stack, Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import { CameraAltRounded, GpsFixedRounded, PlayArrowRounded, SaveRounded, SendRounded } from '@mui/icons-material';
import { changeResourceStatus, getResource, updateResource, uploadDocument } from '../../services/api';
import { addSurveyDraft, deleteSurveyDraft, getSurveyDraft, listSurveyDrafts } from '../../services/offlineSurveyStore';
import PageHeader from '../../components/layout/PageHeader';

const steps = ['Property condition', 'Occupancy & utilities', 'GPS & photographs', 'Review & submit'];

export default function SurveyorSurveysPage() {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<any>({ conditionRating: 3, occupancy: 'occupied', electricityMeter: '', waterSupply: 'available', notes: '', photos: [], gps: null });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);

  async function load() { try { setSurveys((await getResource('surveys', { limit: 100, sort: 'deadline' })).data); } catch (e) { setError((e as Error).message); } }
  async function syncQueuedDrafts() {
    if (!navigator.onLine) return;
    const drafts = (await listSurveyDrafts()).filter((item: any) => item.kind === 'legacy-survey-submit');
    for (const draft of drafts) {
      try {
        const photos = [];
        for (const photo of draft.form.photos || []) {
          if (!photo.offlineDataUrl) { photos.push(photo); continue; }
          const response = await fetch(photo.offlineDataUrl); const blob = await response.blob();
          const file = new File([blob], photo.name || 'survey-photo.jpg', { type: photo.mimeType || blob.type || 'image/jpeg' });
          const uploaded = await uploadDocument(file, { type: 'photo', visibility: 'property', property: String(draft.property || '') });
          photos.push({ url: uploaded.data.url, caption: photo.name, capturedAt: photo.capturedAt, ...(draft.form.gps || {}) });
        }
        await updateResource('surveys', draft.surveyId, { responses: { conditionRating: Number(draft.form.conditionRating), occupancy: draft.form.occupancy, electricityMeter: draft.form.electricityMeter, waterSupply: draft.form.waterSupply }, gps: draft.form.gps, photos, notes: draft.form.notes, syncStatus: 'synced', offlineId: draft.offlineId });
        await changeResourceStatus('surveys', draft.surveyId, 'submitted', 'Offline field survey synchronized');
        await deleteSurveyDraft(draft.offlineId);
      } catch (error) { setError(`Offline sync failed: ${(error as Error).message}`); break; }
    }
    if (drafts.length) { setNotice(`${drafts.length} offline survey(s) synchronized`); await load(); }
  }
  useEffect(() => { load(); const on = () => { setOnline(navigator.onLine); if (navigator.onLine) void syncQueuedDrafts(); }; addEventListener('online', on); addEventListener('offline', on); if (navigator.onLine) void syncQueuedDrafts(); return () => { removeEventListener('online', on); removeEventListener('offline', on); }; }, []);

  async function open(survey: any) {
    const draft = await getSurveyDraft(`survey-${survey._id}`);
    setSelected(survey); setStep(0); setForm(draft?.form || { conditionRating: 3, occupancy: 'occupied', electricityMeter: '', waterSupply: 'available', notes: '', photos: survey.photos || [], gps: survey.gps || null });
  }
  async function saveDraft() { if (!selected) return; await addSurveyDraft({ offlineId: `survey-${selected._id}`, kind: 'legacy-survey-draft', surveyId: selected._id, property: selected.property?._id || selected.property, form, updatedAt: new Date().toISOString() }); setNotice('Encrypted draft saved on this device'); }
  function captureGps() { navigator.geolocation.getCurrentPosition((p) => setForm((f: any) => ({ ...f, gps: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, capturedAt: new Date().toISOString(), verified: p.coords.accuracy <= 50 } })), (e) => setError(e.message), { enableHighAccuracy: true, timeout: 10000 }); }
  async function addPhoto(file?: File) {
    if (!file || !selected) return;
    try {
      if (!navigator.onLine) {
        const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
        setForm((current: any) => ({ ...current, photos: [...current.photos, { offlineDataUrl: dataUrl, name: file.name, mimeType: file.type, capturedAt: new Date().toISOString(), ...(current.gps || {}) }] }));
        setNotice('Photograph encrypted in the offline draft queue');
      } else {
        const result = await uploadDocument(file, { type: 'photo', visibility: 'property', property: selected.property?._id || selected.property });
        setForm((current: any) => ({ ...current, photos: [...current.photos, { url: result.data.url, caption: file.name, capturedAt: new Date().toISOString(), ...(current.gps || {}) }] }));
      }
    } catch (e) { setError((e as Error).message); }
  }
  async function startSurvey(survey: any) { try { await changeResourceStatus('surveys', survey._id, 'in_progress'); open({ ...survey, status: 'in_progress' }); await load(); } catch (e) { setError((e as Error).message); } }
  async function submit() {
    if (!selected) return;
    try {
      if (!form.gps) throw new Error('Capture GPS before submitting');
      if (!form.photos.length) throw new Error('Add at least one photograph');
      if (!online) {
        const offlineId = `survey-submit-${selected._id}-${Date.now()}`;
        await addSurveyDraft({ offlineId, kind: 'legacy-survey-submit', surveyId: selected._id, property: selected.property?._id || selected.property, form, queuedAt: new Date().toISOString() });
        await deleteSurveyDraft(`survey-${selected._id}`);
        setSelected(null); setNotice('Survey encrypted and queued for automatic synchronization'); return;
      }
      const uploadedPhotos = [];
      for (const photo of form.photos) {
        if (!photo.offlineDataUrl) { uploadedPhotos.push(photo); continue; }
        const response = await fetch(photo.offlineDataUrl); const blob = await response.blob(); const file = new File([blob], photo.name || 'survey-photo.jpg', { type: photo.mimeType || blob.type });
        const result = await uploadDocument(file, { type: 'photo', visibility: 'property', property: selected.property?._id || selected.property }); uploadedPhotos.push({ url: result.data.url, caption: photo.name, capturedAt: photo.capturedAt, ...(form.gps || {}) });
      }
      await updateResource('surveys', selected._id, { responses: { conditionRating: Number(form.conditionRating), occupancy: form.occupancy, electricityMeter: form.electricityMeter, waterSupply: form.waterSupply }, gps: form.gps, photos: uploadedPhotos, notes: form.notes, syncStatus: 'synced' });
      await changeResourceStatus('surveys', selected._id, 'submitted', 'Field survey completed');
      await deleteSurveyDraft(`survey-${selected._id}`); setSelected(null); setNotice('Survey submitted successfully'); await load();
    } catch (e) { setError((e as Error).message); }
  }

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }}>
    <PageHeader eyebrow="Field operations" title="Field surveys" description={`${surveys.length} assignments ready to review, capture and submit.`} meta={<Chip label={online ? 'Online and synced' : 'Offline mode'} color={online ? 'success' : 'warning'} size="small" />} />
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}{notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
    <Grid container spacing={1.7}>{surveys.map((survey) => <Grid size={{ xs: 12, md: 6, lg: 4 }} key={survey._id}><Card className="sa-surface-card" elevation={0} sx={{ height: '100%', transition: 'transform .18s ease', '&:hover': { transform: 'translateY(-3px)' } }}><CardContent><Stack direction="row" justifyContent="space-between"><Chip size="small" label={survey.priority} color={survey.priority === 'urgent' ? 'error' : survey.priority === 'high' ? 'warning' : 'default'} /><Chip size="small" label={survey.status.replaceAll('_', ' ')} variant="outlined" /></Stack><Typography sx={{ mt: 2, fontSize: 18, fontWeight: 850 }}>{survey.title}</Typography><Typography color="text.secondary" sx={{ fontSize: 12, mt: .5 }}>{survey.property?.title}</Typography><Typography sx={{ mt: 1.5, fontSize: 12 }}>Deadline: {survey.deadline ? new Date(survey.deadline).toLocaleString('en-IN') : 'Not set'}</Typography><Stack direction="row" spacing={1} sx={{ mt: 2 }}>{['assigned', 'returned'].includes(survey.status) ? <Button fullWidth variant="contained" startIcon={<PlayArrowRounded />} onClick={() => startSurvey(survey)}>Start survey</Button> : survey.status === 'in_progress' ? <Button fullWidth variant="contained" onClick={() => open(survey)}>Continue</Button> : <Button fullWidth variant="outlined" onClick={() => open(survey)}>View</Button>}</Stack></CardContent></Card></Grid>)}</Grid>

    <ProfessionalDialog open={Boolean(selected)} onClose={() => setSelected(null)} fullScreen={matchMedia('(max-width: 700px)').matches} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 900 }}>{selected?.title}</DialogTitle><DialogContent dividers><Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>{steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper><LinearProgress variant="determinate" value={((step + 1) / steps.length) * 100} sx={{ mb: 3, height: 7, borderRadius: 4 }} />
        {step === 0 && <Stack spacing={2}><TextField select SelectProps={{ native: true }} label="Condition rating" value={form.conditionRating} onChange={(e) => setForm({ ...form, conditionRating: e.target.value })}><option value="1">1 — Poor</option><option value="2">2 — Fair</option><option value="3">3 — Good</option><option value="4">4 — Very good</option><option value="5">5 — Excellent</option></TextField><TextField label="Condition notes" multiline rows={5} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Stack>}
        {step === 1 && <Stack spacing={2}><TextField select SelectProps={{ native: true }} label="Occupancy" value={form.occupancy} onChange={(e) => setForm({ ...form, occupancy: e.target.value })}><option value="occupied">Occupied</option><option value="vacant">Vacant</option><option value="partially_occupied">Partially occupied</option></TextField><TextField label="Electricity meter number" value={form.electricityMeter} onChange={(e) => setForm({ ...form, electricityMeter: e.target.value })} /><TextField select SelectProps={{ native: true }} label="Water supply" value={form.waterSupply} onChange={(e) => setForm({ ...form, waterSupply: e.target.value })}><option value="available">Available</option><option value="intermittent">Intermittent</option><option value="unavailable">Unavailable</option></TextField></Stack>}
        {step === 2 && <Stack spacing={2}><Button variant="outlined" startIcon={<GpsFixedRounded />} onClick={captureGps}>{form.gps ? `GPS captured · ±${Math.round(form.gps.accuracy)}m` : 'Capture live GPS'}</Button><Button component="label" variant="outlined" startIcon={<CameraAltRounded />}>Capture / upload photograph<input hidden accept="image/*" capture="environment" type="file" onChange={(e) => addPhoto(e.target.files?.[0])} /></Button><Typography color="text.secondary" sx={{ fontSize: 12 }}>{form.photos.length} photograph(s) attached</Typography></Stack>}
        {step === 3 && <Stack spacing={1.2}><Typography sx={{ fontWeight: 850 }}>Submission checklist</Typography><Typography>Condition rating: {form.conditionRating}/5</Typography><Typography>Occupancy: {form.occupancy}</Typography><Typography>GPS: {form.gps ? `Captured (±${Math.round(form.gps.accuracy)}m)` : 'Missing'}</Typography><Typography>Photographs: {form.photos.length}</Typography><Alert severity={online ? 'success' : 'warning'}>{online ? 'Submission will sync immediately.' : 'The draft will remain on this device until connectivity returns.'}</Alert></Stack>}
      </DialogContent><DialogActions sx={{ p: 2 }}><Button startIcon={<SaveRounded />} onClick={saveDraft}>Save draft</Button><Box sx={{ flex: 1 }} />{step > 0 && <Button onClick={() => setStep((s) => s - 1)}>Back</Button>}{step < steps.length - 1 ? <Button variant="contained" onClick={() => setStep((s) => s + 1)}>Next</Button> : <Button variant="contained" startIcon={<SendRounded />} onClick={submit}>Submit survey</Button>}</DialogActions>
    </ProfessionalDialog>
  </Box>;
}
