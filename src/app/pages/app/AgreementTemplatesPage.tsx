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
  stampPaper: { enabled: boolean; state: string; denomination: string; series: string; paperSize: 'A4' | 'A3' | 'Letter' };
};

const emptyForm = (): TemplateForm => ({
  agreementType: 'rent', name: '', title: '', body: '',
  stampPaper: { enabled: true, state: '', denomination: '0', series: '', paperSize: 'A4' },
});

function formFrom(template: any): TemplateForm {
  return {
    agreementType: template.agreementType,
    name: template.name || '',
    title: template.title || '',
    body: template.body || '',
    stampPaper: {
      enabled: template.stampPaper?.enabled !== false,
      state: template.stampPaper?.state || '',
      denomination: String(template.stampPaper?.denomination || 0),
      series: template.stampPaper?.series || '',
      paperSize: template.stampPaper?.paperSize || 'A4',
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
        stampPaper: { ...form.stampPaper, denomination: Number(form.stampPaper.denomination || 0) },
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

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }} data-secureasset-agreement-templates="landlord-agreement-papers-v226" data-secureasset-agreement-template-preview="clickable-preview-v77">
    <CompactPageToolbar
      marker="agreement-templates-toolbar-v153"
      title="Agreement Papers"
      description="Create and update your own rent, lease and sale agreement papers for the two-party signature workflow."
      actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => openEditor()}>Add Agreement Paper</Button>}
    />
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    <Alert severity="info" sx={{ mb: 2 }}>Agreement papers are private to your landlord account. Property, tenant, landlord, room, rent and deposit details are filled automatically when the paper is used. Updating a paper creates a new version without changing already-rendered agreements.</Alert>
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
      professionalSubtitle="Review your agreement paper and stamp-paper settings before using it for an accepted application."
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
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 4 }, border: '1px solid', borderColor: 'divider', bgcolor: '#fffdf8', borderRadius: 2.5 }}>
            <Typography align="center" sx={{ fontWeight: 900, letterSpacing: '.08em', fontSize: 11, color: 'text.secondary' }}>STAMP PAPER AGREEMENT</Typography>
            <Typography align="center" sx={{ mt: .7, fontWeight: 900, fontSize: { xs: 17, sm: 22 }, color: 'text.primary' }}>{previewing.title}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.85, fontSize: { xs: 13, sm: 14 } }}>{previewing.body}</Typography>
            <Box sx={{ mt: 3, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 850, fontSize: 12 }}>Stamp-paper settings</Typography>
              <Typography variant="caption" color="text.secondary">
                {previewing.stampPaper?.enabled === false ? 'Stamp paper not specified' : 'Stamp paper enabled'}
                {previewing.stampPaper?.state ? ` · State: ${previewing.stampPaper.state}` : ''}
                {Number(previewing.stampPaper?.denomination || 0) > 0 ? ` · Denomination: INR ${Number(previewing.stampPaper.denomination).toLocaleString('en-IN')}` : ''}
                {previewing.stampPaper?.series ? ` · Series: ${previewing.stampPaper.series}` : ''}
                {previewing.stampPaper?.paperSize ? ` · ${previewing.stampPaper.paperSize}` : ''}
              </Typography>
            </Box>
          </Paper>
          <Alert severity="info">Placeholders such as tenant, landlord, property, room and amount are filled automatically when this agreement paper is selected for an accepted application.</Alert>
        </Stack>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" color="inherit" onClick={() => setPreviewing(null)}>Close</Button>
        <Button variant="contained" startIcon={<EditRounded />} onClick={() => { const template = previewing; setPreviewing(null); if (template) openEditor(template); }}>Update Agreement Paper</Button>
      </DialogActions>
    </ProfessionalDialog>

    <ProfessionalDialog open={Boolean(editing)} onClose={closeEditor} fullWidth maxWidth="md" professionalTitle={editing?._id ? 'Update Agreement Paper' : 'Add Agreement Paper'} professionalSubtitle="This paper belongs to your landlord account and is rendered separately for each accepted application." enableMinimize={false}>
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
            <Typography sx={{ fontSize: 12, fontWeight: 850 }}>Stamp-paper settings</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.3}>
              <TextField fullWidth label="State" value={form.stampPaper.state} onChange={(event) => setStamp('state', event.target.value)} />
              <TextField fullWidth type="number" inputProps={{ min: 0 }} label="Denomination (INR)" value={form.stampPaper.denomination} onChange={(event) => setStamp('denomination', event.target.value)} />
              <TextField fullWidth label="Series" value={form.stampPaper.series} onChange={(event) => setStamp('series', event.target.value)} />
              <TextField select fullWidth label="Paper size" value={form.stampPaper.paperSize} onChange={(event) => setStamp('paperSize', event.target.value)}>{['A4', 'A3', 'Letter'].map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}</TextField>
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
