import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, FormControlLabel, Grid,
  IconButton, MenuItem, Paper, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import ViewListRounded from '@mui/icons-material/ViewListRounded';
import { getResource, updateResource } from '../../services/api';

const DEFAULT_SECTIONS = [
  'general', 'discovery', 'property', 'tenancy', 'finance', 'operations', 'survey', 'records',
  'reports', 'marketing', 'communication', 'subscriptions', 'account', 'administration', 'system',
];

const labelFor = (value = '') => value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

type ModuleRecord = {
  _id: string;
  key: string;
  label: string;
  description?: string;
  path?: string;
  icon?: string;
  scope: 'public' | 'app';
  section?: string;
  sectionOrder?: number;
  sortOrder?: number;
  enabled?: boolean;
  mobilePrimary?: boolean;
};

function orderModules(rows: ModuleRecord[]) {
  return [...rows].sort((a, b) =>
    Number(a.sectionOrder ?? 999) - Number(b.sectionOrder ?? 999)
    || String(a.section || 'general').localeCompare(String(b.section || 'general'))
    || Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
    || a.label.localeCompare(b.label));
}

export default function NavigationManagementPage() {
  const [rows, setRows] = useState<ModuleRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<ModuleRecord>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await getResource('platform-modules', { limit: 250 });
      const modules = orderModules(((response.data || []) as ModuleRecord[]).filter((row) => row.scope === 'app'));
      setRows(modules);
      setDrafts(Object.fromEntries(modules.map((row) => [row._id, {
        section: row.section || 'general',
        sectionOrder: Number(row.sectionOrder ?? 999),
        sortOrder: Number(row.sortOrder ?? 0),
        enabled: row.enabled !== false,
        mobilePrimary: Boolean(row.mobilePrimary),
      }])));
    } catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sectionOptions = useMemo(() => Array.from(new Set([
    ...DEFAULT_SECTIONS,
    ...rows.map((row) => row.section || 'general'),
    ...Object.values(drafts).map((draft) => String(draft.section || 'general')),
  ])).sort(), [rows, drafts]);

  const effectiveRows = useMemo(() => orderModules(rows.map((row) => ({ ...row, ...drafts[row._id] }))), [rows, drafts]);
  const groups = useMemo(() => {
    const map = new Map<string, ModuleRecord[]>();
    for (const row of effectiveRows) {
      const section = row.section || 'general';
      map.set(section, [...(map.get(section) || []), row]);
    }
    return [...map.entries()].sort(([, a], [, b]) => Number(a[0]?.sectionOrder ?? 999) - Number(b[0]?.sectionOrder ?? 999));
  }, [effectiveRows]);

  function patch(id: string, changes: Partial<ModuleRecord>) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] || {}), ...changes } }));
    setMessage('');
  }

  async function saveRow(row: ModuleRecord) {
    setSaving(row._id); setError(''); setMessage('');
    try {
      const draft = drafts[row._id] || {};
      await updateResource('platform-modules', row._id, {
        section: String(draft.section || row.section || 'general').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        sectionOrder: Number(draft.sectionOrder ?? row.sectionOrder ?? 999),
        sortOrder: Number(draft.sortOrder ?? row.sortOrder ?? 0),
        enabled: draft.enabled !== false,
        mobilePrimary: Boolean(draft.mobilePrimary),
      });
      setMessage(`${row.label} navigation settings saved.`);
      window.dispatchEvent(new Event('secureasset:site-changed'));
      await load();
    } catch (caught) { setError((caught as Error).message); }
    finally { setSaving(''); }
  }

  async function move(row: ModuleRecord, direction: -1 | 1) {
    const peers = effectiveRows.filter((candidate) => (candidate.section || 'general') === (row.section || 'general'));
    const index = peers.findIndex((candidate) => candidate._id === row._id);
    const target = peers[index + direction];
    if (!target) return;
    setSaving(row._id); setError(''); setMessage('');
    try {
      const currentOrder = Number(row.sortOrder ?? index * 10);
      const targetOrder = Number(target.sortOrder ?? (index + direction) * 10);
      await Promise.all([
        updateResource('platform-modules', row._id, { sortOrder: targetOrder }),
        updateResource('platform-modules', target._id, { sortOrder: currentOrder }),
      ]);
      window.dispatchEvent(new Event('secureasset:site-changed'));
      await load();
    } catch (caught) { setError((caught as Error).message); }
    finally { setSaving(''); }
  }

  if (loading) return <Box sx={{ py: 14, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 7 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} mb={3}>
      <Box>
        <Stack direction="row" spacing={1.2} alignItems="center"><ViewListRounded color="primary" /><Typography variant="h4" fontWeight={950}>Sidebar Navigation</Typography></Stack>
        <Typography color="text.secondary" sx={{ mt: .6 }}>Organize application menu sections, section priority, item order and mobile navigation visibility.</Typography>
      </Box>
      <Button startIcon={<RefreshRounded />} onClick={load}>Refresh modules</Button>
    </Stack>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}

    <Stack spacing={3}>
      {groups.map(([section, modules]) => <Paper key={section} variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ px: { xs: 2, md: 3 }, py: 2, bgcolor: 'action.hover' }}>
          <Box><Typography fontWeight={950}>{labelFor(section)}</Typography><Typography variant="caption" color="text.secondary">{modules.length} menu item{modules.length === 1 ? '' : 's'}</Typography></Box>
          <Chip size="small" label={`Section order ${Number(modules[0]?.sectionOrder ?? 999)}`} />
        </Stack>
        <Divider />
        <Grid container spacing={0}>
          {modules.map((row, index) => {
            const draft = drafts[row._id] || {};
            const busy = saving === row._id;
            return <Grid size={{ xs: 12 }} key={row._id}>
              <Card elevation={0} square sx={{ borderBottom: index < modules.length - 1 ? '1px solid' : 0, borderColor: 'divider' }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 3.1 }}>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <DragIndicatorRounded color="disabled" />
                        <Box sx={{ minWidth: 0 }}><Typography fontWeight={900} noWrap>{row.label}</Typography><Typography variant="caption" color="text.secondary" noWrap>{row.path || `/app/${row.key}`}</Typography></Box>
                      </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 5, md: 2.3 }}><TextField select fullWidth size="small" label="Section" value={draft.section ?? row.section ?? 'general'} onChange={(event) => patch(row._id, { section: event.target.value })}>{sectionOptions.map((option) => <MenuItem key={option} value={option}>{labelFor(option)}</MenuItem>)}</TextField></Grid>
                    <Grid size={{ xs: 6, sm: 3, md: 1.5 }}><TextField fullWidth size="small" type="number" label="Section order" value={draft.sectionOrder ?? row.sectionOrder ?? 999} onChange={(event) => patch(row._id, { sectionOrder: Number(event.target.value) })} /></Grid>
                    <Grid size={{ xs: 6, sm: 3, md: 1.3 }}><TextField fullWidth size="small" type="number" label="Item order" value={draft.sortOrder ?? row.sortOrder ?? 0} onChange={(event) => patch(row._id, { sortOrder: Number(event.target.value) })} /></Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2.2 }}><Stack direction="row" spacing={1} flexWrap="wrap"><FormControlLabel control={<Switch size="small" checked={draft.enabled !== false} onChange={(_, checked) => patch(row._id, { enabled: checked })} />} label="Enabled" /><FormControlLabel control={<Switch size="small" checked={Boolean(draft.mobilePrimary)} onChange={(_, checked) => patch(row._id, { mobilePrimary: checked })} />} label="Mobile" /></Stack></Grid>
                    <Grid size={{ xs: 12, md: 1.6 }}><Stack direction="row" justifyContent={{ xs: 'flex-end', md: 'center' }}>
                      <Tooltip title="Move up"><span><IconButton disabled={busy || index === 0} onClick={() => move(row, -1)}><ArrowUpwardRounded /></IconButton></span></Tooltip>
                      <Tooltip title="Move down"><span><IconButton disabled={busy || index === modules.length - 1} onClick={() => move(row, 1)}><ArrowDownwardRounded /></IconButton></span></Tooltip>
                      <Tooltip title="Save"><span><IconButton color="primary" disabled={busy} onClick={() => saveRow(row)}>{busy ? <CircularProgress size={20} /> : <SaveRounded />}</IconButton></span></Tooltip>
                    </Stack></Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>;
          })}
        </Grid>
      </Paper>)}
    </Stack>
  </Box>;
}
