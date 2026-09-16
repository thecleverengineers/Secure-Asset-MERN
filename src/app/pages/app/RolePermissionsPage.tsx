import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Divider, FormControlLabel,
  MenuItem, Paper, Select, Stack, Switch, TextField, Typography,
} from '@mui/material';
import AdminPanelSettingsRounded from '@mui/icons-material/AdminPanelSettingsRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import RestoreRounded from '@mui/icons-material/RestoreRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import { getRolePermissionCatalog, getRolePermissions, resetRolePermissions, updateRolePermissions, type RolePermissionEntry } from '../../services/api';

const ACTION_LABELS: Record<string, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve', export: 'Export', download: 'Download', notify: 'Notify',
};
const ROLE_LABELS: Record<string, string> = { admin: 'Administrator', landlord: 'Landlord', tenant: 'Tenant', surveyor: 'Surveyor' };
const labelFor = (value = '') => value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function RolePermissionsPage() {
  const [role, setRole] = useState('tenant');
  const [roles, setRoles] = useState<string[]>(['admin', 'landlord', 'tenant', 'surveyor']);
  const [actions, setActions] = useState<string[]>(Object.keys(ACTION_LABELS));
  const [entries, setEntries] = useState<RolePermissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load(nextRole = role) {
    setLoading(true); setError('');
    try {
      const [catalogResponse, permissionsResponse] = await Promise.all([getRolePermissionCatalog(), getRolePermissions(nextRole)]);
      setRoles(catalogResponse.data.roles || roles);
      setActions(catalogResponse.data.actions || actions);
      setEntries(permissionsResponse.data.entries || []);
    } catch (caught) { setError((caught as Error).message || 'Could not load role permissions'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [role]);

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => !query || `${entry.label} ${entry.key} ${entry.category}`.toLowerCase().includes(query));
  }, [entries, search]);
  const groups = useMemo(() => {
    const grouped = new Map<string, RolePermissionEntry[]>();
    for (const entry of visibleEntries) grouped.set(entry.category || 'general', [...(grouped.get(entry.category || 'general') || []), entry]);
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [visibleEntries]);

  function patchEntry(key: string, patch: Partial<RolePermissionEntry>) {
    setEntries((current) => current.map((entry) => entry.key === key ? { ...entry, ...patch } : entry));
    setMessage('');
  }

  function toggleAction(entry: RolePermissionEntry, action: string, checked: boolean) {
    const next = checked ? [...new Set([...entry.actions, action])] : entry.actions.filter((item) => item !== action);
    patchEntry(entry.key, { actions: checked && action !== 'view' ? [...new Set(['view', ...next])] : next });
  }

  async function save() {
    setSaving(true); setError(''); setMessage('');
    try {
      await updateRolePermissions(role, entries);
      setMessage(`${ROLE_LABELS[role] || labelFor(role)} permissions saved. New access rules are enforced by the server.`);
      window.dispatchEvent(new Event('secureasset:site-changed'));
    } catch (caught) { setError((caught as Error).message || 'Could not save permissions'); }
    finally { setSaving(false); }
  }

  async function reset() {
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await resetRolePermissions(role);
      setEntries(response.data.entries || []);
      setMessage(`${ROLE_LABELS[role] || labelFor(role)} restored to the secure default map.`);
    } catch (caught) { setError((caught as Error).message || 'Could not restore defaults'); }
    finally { setSaving(false); }
  }

  if (loading && !entries.length) return <Box sx={{ py: 14, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 8 }}>
    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2} mb={3}>
      <Box>
        <Stack direction="row" spacing={1.2} alignItems="center"><AdminPanelSettingsRounded color="primary" /><Typography variant="h4" fontWeight={950}>Role &amp; Permissions</Typography></Stack>
        <Typography color="text.secondary" sx={{ mt: .7, maxWidth: 840 }}>Map each role to the features and actions it may use. The sidebar, direct routes and backend APIs all use this same permission map.</Typography>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
        <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => void load()} disabled={saving}>Refresh</Button>
        <Button variant="outlined" color="warning" startIcon={<RestoreRounded />} onClick={() => void reset()} disabled={saving}>Reset role</Button>
        <Button variant="contained" startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveRounded />} onClick={() => void save()} disabled={saving}>Save permissions</Button>
      </Stack>
    </Stack>

    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}

    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mb: 3, borderRadius: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {roles.map((item) => <Button key={item} variant={item === role ? 'contained' : 'outlined'} onClick={() => setRole(item)} sx={{ borderRadius: 2 }}>{ROLE_LABELS[item] || labelFor(item)}</Button>)}
        </Stack>
        <TextField size="small" label="Search features" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ minWidth: { md: 260 } }} />
      </Stack>
    </Paper>

    <Alert icon={<SecurityRounded />} severity="info" sx={{ mb: 3 }}>Removing <strong>View</strong> hides the feature and blocks its direct URL/API. Action permissions never grant access without View. For mapped resources, the feature and resource action must both be enabled.</Alert>

    <Stack spacing={3}>
      {groups.map(([category, group]) => <Paper key={category} variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3 }}>
        <Box sx={{ px: { xs: 2, md: 3 }, py: 1.8, bgcolor: 'action.hover' }}><Typography fontWeight={900}>{labelFor(category)}</Typography><Typography variant="caption" color="text.secondary">{group.length} mapped feature{group.length === 1 ? '' : 's'}</Typography></Box>
        <Divider />
        <Stack divider={<Divider />}>{group.map((entry) => <Card key={entry.key} elevation={0} sx={{ borderRadius: 0 }}>
          <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
            <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xl: 'center' }}>
              <Box sx={{ minWidth: { xl: 250 } }}><Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={900}>{entry.label}</Typography><Chip size="small" variant="outlined" label={entry.kind} /></Stack><Typography variant="caption" color="text.secondary">{entry.key}</Typography></Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: .5, md: 1 }} alignItems={{ md: 'center' }} flexWrap="wrap" useFlexGap>
                <FormControlLabel control={<Switch checked={entry.enabled} onChange={(_, checked) => patchEntry(entry.key, { enabled: checked })} />} label="Enabled" />
                <TextField select size="small" label="Data scope" value={entry.scope} onChange={(event) => patchEntry(entry.key, { scope: event.target.value as RolePermissionEntry['scope'] })} sx={{ minWidth: 132 }}>
                  {['all', 'own', 'assigned', 'public'].map((scope) => <MenuItem key={scope} value={scope}>{labelFor(scope)}</MenuItem>)}
                </TextField>
                <Stack direction="row" spacing={.2} flexWrap="wrap" useFlexGap>
                  {actions.map((action) => <FormControlLabel key={action} sx={{ mr: .5 }} control={<Checkbox size="small" checked={entry.actions.includes(action)} onChange={(event) => toggleAction(entry, action, event.target.checked)} />} label={<Typography variant="caption">{ACTION_LABELS[action] || labelFor(action)}</Typography>} />)}
                </Stack>
              </Stack>
            </Stack>
          </CardContent>
        </Card>)}</Stack>
      </Paper>)}
      {!groups.length && <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}><Typography color="text.secondary">No features match this search.</Typography></Paper>}
    </Stack>
  </Box>;
}
