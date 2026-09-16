import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, DialogActions, DialogContent, DialogTitle,
  Grid, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import {
  AddLocationAltRounded, CalculateRounded, CloudDoneRounded, CloudOffRounded, MyLocationRounded, SaveRounded,
  SyncRounded, UploadFileRounded,
} from '@mui/icons-material';
import { calculateSurveyFieldData, createResource, getResource, syncSurveyFieldData, uploadDocument } from '../../services/api';
import { addSurveyDraft, clearSurveyDrafts, countSurveyDrafts, listSurveyDrafts } from '../../services/offlineSurveyStore';
import PageHeader from '../../components/layout/PageHeader';
type OfflineMedia = { name: string; type: string; data: string };
const blank = { project: '', weather: '', observation: '', latitude: '', longitude: '', accuracy: '', measurementType: 'distance', measurementValue: '', measurementUnit: 'metre', clientSignature: '', surveyorSignature: '' };

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
}
function dataUrlToFile(item: OfflineMedia) {
  const [head, payload] = item.data.split(','); const mime = head.match(/data:(.*?);/)?.[1] || item.type || 'application/octet-stream';
  const bytes = atob(payload); const buffer = new Uint8Array(bytes.length); for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i);
  return new File([buffer], item.name, { type: mime });
}

export default function SurveyorFieldPage() {
  const [rows, setRows] = useState<any[]>([]); const [projects, setProjects] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [online, setOnline] = useState(navigator.onLine); const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<any>(blank); const [calc, setCalc] = useState<any>(null); const [calcRequest, setCalcRequest] = useState<any>(null);
  const [calcType, setCalcType] = useState('plot_area'); const [calcInput, setCalcInput] = useState('{"length":20,"width":10}');
  const [notice, setNotice] = useState(''); const [mediaFiles, setMediaFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [local, setLocal] = useState(0);

  async function load() { setLoading(true); try { const [a, b, draftCount] = await Promise.all([getResource('field-data', { limit: 100 }), getResource('survey-projects', { limit: 100 }), countSurveyDrafts()]); setRows(a.data); setProjects(b.data); setLocal(draftCount); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  useEffect(() => { load(); const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);

  function gps() { navigator.geolocation?.getCurrentPosition((p) => setForm((f: any) => ({ ...f, latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy })), (e) => setError(e.message), { enableHighAccuracy: true }); }
  function payload(media: string[] = []) { return { project: form.project, observedAt: new Date(), weather: form.weather, observations: { notes: form.observation }, gpsCoordinates: form.latitude ? [{ label: 'Site', latitude: Number(form.latitude), longitude: Number(form.longitude), accuracy: Number(form.accuracy), capturedAt: new Date() }] : [], measurements: form.measurementValue ? [{ type: form.measurementType, label: form.measurementType, value: Number(form.measurementValue), unit: form.measurementUnit }] : [], media, clientSignature: form.clientSignature, surveyorSignature: form.surveyorSignature }; }
  async function uploadMedia(files: File[]) { const urls: string[] = []; for (const file of files) { const uploaded = await uploadDocument(file, { context: 'survey-field', type: file.type.startsWith('image/') ? 'survey_photo' : file.type.startsWith('video/') ? 'survey_video' : 'survey_voice_note', visibility: 'private' }); urls.push(uploaded.data.url); } return urls; }

  async function draft() {
    if (!form.project) { setError('Select a survey project'); return; }
    setBusy(true); try {
      const total = mediaFiles.reduce((sum, file) => sum + file.size, 0); if (total > 2 * 1024 * 1024) throw new Error('Offline media drafts are limited to 2 MB. Save larger media while online.');
      const offlineMedia: OfflineMedia[] = []; for (const file of mediaFiles) offlineMedia.push({ name: file.name, type: file.type, data: await fileToDataUrl(file) });
      await addSurveyDraft({ offlineId: crypto.randomUUID(), ...payload(), observedAt: new Date().toISOString(), offlineMedia, syncStatus: 'pending' });
      setLocal(await countSurveyDrafts()); setDialog(false); setForm(blank); setMediaFiles([]); setNotice('Encrypted offline field draft saved securely on this device.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function submit() {
    if (!online) { await draft(); return; } if (!form.project) { setError('Select a survey project'); return; }
    setBusy(true); try { const media = await uploadMedia(mediaFiles); await createResource('field-data', payload(media)); setDialog(false); setForm(blank); setMediaFiles([]); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function sync() {
    const drafts = await listSurveyDrafts(); if (!drafts.length) { setNotice('There are no offline drafts to sync.'); return; }
    setBusy(true); try {
      const prepared = []; for (const item of drafts) { const media = item.offlineMedia?.length ? await uploadMedia(item.offlineMedia.map(dataUrlToFile)) : []; const { offlineMedia, ...record } = item; prepared.push({ ...record, media: [...(record.media || []), ...media] }); }
      await syncSurveyFieldData(prepared); await clearSurveyDrafts(); setLocal(0); setNotice('Offline field data and media synced successfully.'); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function calculate(row: any) { setCalcRequest(row); setCalcType('plot_area'); setCalcInput('{"length":20,"width":10}'); }
  async function runCalculation() {
    if (!calcRequest) return;
    setBusy(true);
    try {
      const input = JSON.parse(calcInput);
      const result = await calculateSurveyFieldData(calcRequest._id, calcType, input);
      setCalcRequest(null); setCalc(result.data); await load();
    } catch (e) { setError((e as Error).message.includes('JSON') ? 'Calculation inputs must be valid JSON.' : (e as Error).message); }
    finally { setBusy(false); }
  }
  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
    <PageHeader eyebrow="Field operations" title="Field data" description="Capture measurements, GPS points, site observations and media—with encrypted offline drafts when connectivity drops." meta={<Stack direction="row" spacing={.7}><Chip size="small" icon={online ? <CloudDoneRounded /> : <CloudOffRounded />} color={online ? 'success' : 'warning'} label={online ? 'Online' : 'Offline mode'} /><Chip size="small" label={`${local} local drafts`} /></Stack>} actions={<><Button variant="outlined" startIcon={<SyncRounded />} onClick={sync} disabled={!online || !local || busy}>Sync drafts</Button><Button variant="contained" startIcon={<AddLocationAltRounded />} onClick={() => setDialog(true)}>New field entry</Button></>} />
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
    {loading ? <Box sx={{ p: 10, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : <Grid container spacing={1.7}>{rows.map((row) => <Grid size={{ xs: 12, md: 6, lg: 4 }} key={row._id}><Card className="sa-surface-card" elevation={0}><CardContent><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontWeight: 900 }}>{row.project?.projectNumber || 'Field entry'}</Typography><Chip size="small" label={row.syncStatus || 'synced'} /></Stack><Typography color="text.secondary" sx={{ fontSize: 12, mt: 1 }}>{row.observedAt ? new Date(row.observedAt).toLocaleString('en-IN') : '—'} · {row.weather || 'Weather not recorded'}</Typography><Typography sx={{ fontSize: 13, mt: 2 }}>{row.observations?.notes || `${row.measurements?.length || 0} measurements · ${row.gpsCoordinates?.length || 0} GPS points`}</Typography><Typography color="text.secondary" sx={{ fontSize: 11, mt: 1 }}>{row.media?.length || 0} media files · {row.calculations?.length || 0} calculations</Typography><Button size="small" startIcon={<CalculateRounded />} onClick={() => calculate(row)} sx={{ mt: 1 }}>Calculate</Button></CardContent></Card></Grid>)}</Grid>}

    <ProfessionalDialog open={dialog} onClose={() => !busy && setDialog(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4 } }}><DialogTitle sx={{ fontWeight: 900 }}>Collect field data</DialogTitle><DialogContent dividers><Stack spacing={2}><TextField select required label="Project" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}>{projects.map((p) => <MenuItem key={p._id} value={p._id}>{p.projectNumber} · {p.surveyCategory}</MenuItem>)}</TextField><TextField label="Weather conditions" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} /><TextField multiline rows={3} label="Site observations" value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} /><Button variant="outlined" startIcon={<MyLocationRounded />} onClick={gps}>Capture live GPS</Button><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField fullWidth label="Latitude" value={form.latitude} InputProps={{ readOnly: true }} /><TextField fullWidth label="Longitude" value={form.longitude} InputProps={{ readOnly: true }} /><TextField fullWidth label="Accuracy (m)" value={form.accuracy} InputProps={{ readOnly: true }} /></Stack><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField select fullWidth label="Measurement" value={form.measurementType} onChange={(e) => setForm({ ...form, measurementType: e.target.value })}>{['distance', 'area', 'elevation', 'angle', 'level', 'perimeter'].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField><TextField fullWidth type="number" label="Value" value={form.measurementValue} onChange={(e) => setForm({ ...form, measurementValue: e.target.value })} /><TextField fullWidth label="Unit" value={form.measurementUnit} onChange={(e) => setForm({ ...form, measurementUnit: e.target.value })} /></Stack><Button component="label" variant="outlined" startIcon={<UploadFileRounded />}>{mediaFiles.length ? `${mediaFiles.length} field media selected` : 'Capture/upload photos, video or voice note'}<input hidden multiple type="file" accept="image/*,video/*,audio/*" capture="environment" onChange={(e) => setMediaFiles(Array.from(e.target.files || []))} /></Button><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField fullWidth label="Client signature / name" value={form.clientSignature} onChange={(e) => setForm({ ...form, clientSignature: e.target.value })} /><TextField fullWidth label="Surveyor signature / name" value={form.surveyorSignature} onChange={(e) => setForm({ ...form, surveyorSignature: e.target.value })} /></Stack></Stack></DialogContent><DialogActions><Button onClick={() => setDialog(false)} disabled={busy}>Cancel</Button><Button variant="outlined" startIcon={<SaveRounded />} onClick={draft} disabled={busy}>Save offline</Button><Button variant="contained" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save entry'}</Button></DialogActions></ProfessionalDialog>


    <ProfessionalDialog open={Boolean(calcRequest)} onClose={() => !busy && setCalcRequest(null)} fullWidth maxWidth="sm"><DialogTitle>Run survey calculation</DialogTitle><DialogContent dividers><Stack spacing={2} sx={{ mt: .5 }}><TextField select label="Calculation type" value={calcType} onChange={(e) => setCalcType(e.target.value)}>{['plot_area','perimeter','distance','elevation_difference','slope','volume','built_up_area','carpet_area','land_valuation','quantity_estimate','unit_conversion'].map((item) => <MenuItem key={item} value={item}>{item.replaceAll('_',' ')}</MenuItem>)}</TextField><TextField multiline minRows={5} label="Input values (JSON)" value={calcInput} onChange={(e) => setCalcInput(e.target.value)} helperText='Example: {"length":20,"width":10}' /></Stack></DialogContent><DialogActions><Button onClick={() => setCalcRequest(null)} disabled={busy}>Cancel</Button><Button variant="contained" onClick={runCalculation} disabled={busy}>{busy ? 'Calculating…' : 'Calculate'}</Button></DialogActions></ProfessionalDialog>

    <ProfessionalDialog open={Boolean(calc)} onClose={() => setCalc(null)}><DialogTitle>Calculation result</DialogTitle><DialogContent><Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 3 }}><Typography sx={{ fontWeight: 900, fontSize: 28 }}>{calc?.output} {calc?.unit}</Typography><Typography color="text.secondary">Formula: {calc?.formula}</Typography></Paper></DialogContent><DialogActions><Button onClick={() => setCalc(null)}>Close</Button></DialogActions></ProfessionalDialog>
  </Box>;
}
