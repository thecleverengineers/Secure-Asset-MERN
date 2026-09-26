import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert, Box, Button, ButtonBase, Chip, CircularProgress, DialogActions, DialogContent, Divider, MenuItem, Paper, Select, Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';
import { useActionDialog } from '../../components/shared/useActionDialog';
import {
  createAgreementTemplate, deleteAgreementTemplate, getAgreementTemplates, updateAgreementTemplate,
} from '../../services/api';
import type { AgreementType } from '../../services/api';

const agreementTypes: AgreementType[] = ['rent', 'lease', 'sale'];
const labels: Record<AgreementType, string> = { rent: 'Rent', lease: 'Lease', sale: 'Sale' };
const placeholderHelp = '{{agreement_date}}, {{landlord_name}}, {{tenant_name}}, {{property_title}}, {{property_address}}, {{space_name}}, {{amount}}, {{security_deposit}}, {{agreement_type}}';

type TemplateForm = {
  agreementType: AgreementType;
  name: string;
  title: string;
  body: string;
  stampPaper: { enabled: boolean; format: 'e_stamp'; state: string; denomination: string; series: string; certificateSpaceMm: string; paperSize: 'A4' };
};

const emptyForm = (): TemplateForm => ({
  agreementType: 'rent', name: '', title: '', body: '',
  stampPaper: { enabled: true, format: 'e_stamp', state: '', denomination: '0', series: '', certificateSpaceMm: '70', paperSize: 'A4' },
});

function formFrom(template: any): TemplateForm {
  return {
    agreementType: template.agreementType,
    name: template.name || '',
    title: template.title || '',
    body: template.body || '',
    stampPaper: {
      enabled: template.stampPaper?.enabled !== false,
      format: 'e_stamp',
      state: template.stampPaper?.state || '',
      denomination: String(template.stampPaper?.denomination || 0),
      series: template.stampPaper?.series || '',
      certificateSpaceMm: String(template.stampPaper?.certificateSpaceMm || 70),
      paperSize: 'A4',
    },
  };
}

export default function AgreementTemplatesPage() {
  const actions = useActionDialog();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [previewing, setPreviewing] = useState<any | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);

  async function load() {
    setLoading(true);
    try {
      const result = await getAgreementTemplates();
      setTemplates(result.data || []);
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Could not load agreement templates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function openEditor(template?: any) {
    setEditing(template || {});
    setForm(template ? formFrom(template) : emptyForm());
  }

  function closeEditor() {
    if (!busy) { setEditing(null); setForm(emptyForm()); }
  }

  function openPreview(template: any) {
    setPreviewing(template);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy('save');
    try {
      const payload = {
        agreementType: form.agreementType, name: form.name, title: form.title, body: form.body,
        stampPaper: { ...form.stampPaper, format: 'e_stamp', paperSize: 'A4', denomination: Number(form.stampPaper.denomination || 0), certificateSpaceMm: Number(form.stampPaper.certificateSpaceMm || 70) },
      };
      if (editing?._id) await updateAgreementTemplate(editing._id, payload);
      else await createAgreementTemplate(payload);
      closeEditor();
      setNotice(editing?._id ? 'Agreement paper updated' : 'Agreement paper added');
      await load();
    } catch (err) {
      setError((err as Error).message || 'Could not save agreement paper');
    } finally {
      setBusy('');
    }
  }

  async function remove(template: any) {
    if (!await actions.askConfirmation('Delete this agreement paper? Existing signed agreements keep their saved paper, but a paper used by an active agreement cannot be deleted.', { title: 'Delete agreement paper', danger: true })) return;
    setBusy('delete-' + template._id);
    try {
      await deleteAgreementTemplate(template._id);
      setNotice('Agreement paper deleted');
      await load();
    } catch (err) {
      setError((err as Error).message || 'Could not delete agreement paper');
    } finally {
      setBusy('');
    }
  }

  const setStamp = (key: string, value: string | boolean) => setForm((current) => ({ ...current, stampPaper: { ...current.stampPaper, [key]: value } }));

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }} data-secureasset-agreement-templates="landlord-agreement-papers-v228" data-secureasset-agreement-template-preview="modern-estamp-a4-v1">
    <CompactPageToolbar
      marker="agreement-templates-toolbar-v153"
      title="Agreement Papers"
      description="Create and update modern A4 e-Stamp agreement papers for the Secure Asset two-party signature workflow."
      actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => openEditor()}>Add Agreement Paper</Button>}
    />
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    <Alert severity="info" sx={{ mb: 2 }}>Agreement papers are private to your landlord account. Secure Asset uses a modern A4 e-Stamp layout: the top certificate zone remains blank for the SHCIL/state-issued e-Stamp print, while the legal agreement begins below it. Property, tenant, landlord, room, rent and deposit details are filled automatically when the paper is used.</Alert>
    {loading ? <Box sx={{ py: 10, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.7 }}>
      {agreementTypes.map((type) => {
        const records = templates.filter((template) => template.agreementType === type);
        return <Paper key={type} elevation={0} className="sa-surface-card" sx={{ p: 2.1, borderRadius: 3 }}>
          <Stack spacing={1.25}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontWeight: 900 }}>{labels[type]} papers</Typography>
              <Chip size="small" variant="outlined" label={records.length + (records.length === 1 ? ' paper' : ' papers')} />
            </Stack>
            <Divider />
            {records.length ? records.map((template) => <Box key={template._id} sx={{ py: .75, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
              <ButtonBase
                onClick={() => openPreview(template)}
                aria-label={`Preview ${labels[type]} agreement paper ${template.name}`}
                sx={{ display: 'block', width: '100%', p: 1, mx: -1, textAlign: 'left', borderRadius: 2, '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.name}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.title} · v{template.version || 1} · Private to your landlord account</Typography>
                  </Box>
                  <VisibilityRounded fontSize="small" color="action" />
                </Stack>
              </ButtonBase>
              <Stack direction="row" spacing={.5} sx={{ mt: .25, pl: 1 }}>
                <Button size="small" startIcon={<VisibilityRounded />} onClick={() => openPreview(template)}>Preview</Button>
                <Button size="small" startIcon={<EditRounded />} onClick={() => openEditor(template)}>Edit</Button>
                <Button size="small" color="error" startIcon={<DeleteOutlineRounded />} disabled={busy === 'delete-' + template._id} onClick={() => void remove(template)}>Delete</Button>
              </Stack>
            </Box>) : <Typography variant="body2" color="text.secondary">No {labels[type].toLowerCase()} agreement paper yet.</Typography>}
          </Stack>
        </Paper>;
      })}
    </Box>}

    <ProfessionalDialog
      open={Boolean(previewing)}
      onClose={() => setPreviewing(null)}
      fullWidth
      maxWidth="md"
      professionalTitle={previewing ? `${labels[previewing.agreementType as AgreementType] || 'Agreement'} paper preview` : 'Agreement paper preview'}
      professionalSubtitle="Review the modern A4 e-Stamp layout before using it for an accepted application."
      enableMinimize={false}
    >
      <DialogContent dividers>
        {previewing && <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: 18, sm: 21 } }}>{previewing.name}</Typography>
              <Typography variant="body2" color="text.secondary">Version {previewing.version || 1} · {labels[previewing.agreementType as AgreementType] || 'Agreement'} paper</Typography>
            </Box>
            <Chip size="small" variant="outlined" label={previewing.active === false ? 'Inactive' : 'Active'} color={previewing.active === false ? 'default' : 'success'} />
          </Stack>
          <Box sx={{ overflowX: 'auto', p: { xs: 1, sm: 2 }, bgcolor: '#f4f6f8', borderRadius: 2.5 }}>
            <Paper
              elevation={0}
              data-secureasset-estamp-paper="a4-modern-estamp-v1"
              sx={{
                width: '210mm',
                minHeight: '297mm',
                mx: 'auto',
                bgcolor: '#fff',
                color: '#111',
                border: '1px solid #e5e7eb',
                borderRadius: 0,
                boxShadow: '0 18px 55px rgba(15, 23, 42, 0.12)',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <Box
                aria-hidden
                data-secureasset-estamp-reserved-space="certificate-zone"
                sx={{ height: `${Math.min(95, Math.max(55, Number(previewing.stampPaper?.certificateSpaceMm || 70)))}mm` }}
              />
              <Box sx={{ mx: '31.75mm', pb: '31.75mm', fontFamily: '"Times New Roman", Times, serif' }}>
                <Typography align="center" sx={{ fontFamily: 'inherit', fontWeight: 700, letterSpacing: '.18em', fontSize: 10, color: '#334155' }}>SECURE ASSET</Typography>
                <Typography align="center" sx={{ mt: .7, fontFamily: 'inherit', fontWeight: 700, fontSize: 21, lineHeight: 1.25, color: '#111827' }}>{previewing.title}</Typography>
                <Divider sx={{ my: 2, borderColor: '#cbd5e1' }} />
                <Typography sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.5, fontSize: 14, textAlign: 'justify', color: '#111827' }}>{previewing.body}</Typography>
              </Box>
            </Paper>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={.8} flexWrap="wrap" useFlexGap>
            <Chip size="small" variant="outlined" label="Modern e-Stamp · A4 (210 × 297 mm)" />
            <Chip size="small" variant="outlined" label={`Reserved e-Stamp certificate space: ${Math.min(95, Math.max(55, Number(previewing.stampPaper?.certificateSpaceMm || 70)))} mm`} />
            {previewing.stampPaper?.state && <Chip size="small" variant="outlined" label={`State: ${previewing.stampPaper.state}`} />}
            {Number(previewing.stampPaper?.denomination || 0) > 0 && <Chip size="small" variant="outlined" label={`Denomination: INR ${Number(previewing.stampPaper.denomination).toLocaleString('en-IN')}`} />}
            {previewing.stampPaper?.series && <Chip size="small" variant="outlined" label={`Series: ${previewing.stampPaper.series}`} />}
          </Stack>
          <Alert severity="info">The PDF keeps the top e-Stamp certificate area completely blank and pure white. The legal body uses Times New Roman-style typography, justified alignment, 1.5 line spacing and 1.25-inch working margins.</Alert>
        </Stack>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" color="inherit" onClick={() => setPreviewing(null)}>Close</Button>
        <Button variant="contained" startIcon={<EditRounded />} onClick={() => { const template = previewing; setPreviewing(null); if (template) openEditor(template); }}>Update Agreement Paper</Button>
      </DialogActions>
    </ProfessionalDialog>

    <ProfessionalDialog open={Boolean(editing)} onClose={closeEditor} fullWidth maxWidth="md" professionalTitle={editing?._id ? 'Update Agreement Paper' : 'Add Agreement Paper'} professionalSubtitle="This private landlord paper is rendered as a modern A4 e-Stamp agreement for each accepted application." enableMinimize={false}>
      <Box component="form" onSubmit={save}>
        <DialogContent dividers>
          <Stack spacing={1.7}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.3}>
              <TextField select fullWidth label="Agreement type" value={form.agreementType} onChange={(event) => setForm((current) => ({ ...current, agreementType: event.target.value as AgreementType }))} disabled={Boolean(editing?._id)}>
                {agreementTypes.map((type) => <MenuItem key={type} value={type}>{labels[type]}</MenuItem>)}
              </TextField>
              <TextField required fullWidth label="Agreement paper name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Stack>
            <TextField required label="Document title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            <TextField required label="Agreement paper content" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} multiline minRows={12} helperText={'Supported placeholders: ' + placeholderHelp} />
            <Typography sx={{ fontSize: 12, fontWeight: 850 }}>Modern e-Stamp settings</Typography>
            <Alert severity="info" sx={{ py: .35 }}>Secure Asset uses standard A4 only. The e-Stamp certificate/header itself is not generated by Secure Asset; the reserved top area stays blank for the official SHCIL/state-portal certificate print.</Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.3}>
              <TextField fullWidth label="State" value={form.stampPaper.state} onChange={(event) => setStamp('state', event.target.value)} />
              <TextField fullWidth type="number" inputProps={{ min: 0 }} label="Denomination (INR)" value={form.stampPaper.denomination} onChange={(event) => setStamp('denomination', event.target.value)} />
              <TextField fullWidth label="Certificate / series reference" value={form.stampPaper.series} onChange={(event) => setStamp('series', event.target.value)} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.3}>
              <TextField fullWidth disabled label="e-Stamp format" value="Modern e-Stamp" />
              <TextField fullWidth disabled label="Paper standard" value="A4 · 210 × 297 mm" />
              <TextField fullWidth type="number" inputProps={{ min: 55, max: 95, step: 1 }} label="Reserved certificate space (mm)" value={form.stampPaper.certificateSpaceMm} onChange={(event) => setStamp('certificateSpaceMm', event.target.value)} helperText="Top blank zone; recommended default 70 mm." />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="outlined" color="inherit" onClick={closeEditor} disabled={Boolean(busy)}>Cancel</Button>
          <Button variant="contained" type="submit" startIcon={<SaveRounded />} disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : editing?._id ? 'Update Agreement Paper' : 'Add Agreement Paper'}</Button>
        </DialogActions>
      </Box>
    </ProfessionalDialog>
    {actions.dialogs}
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
  </Box>;
}
