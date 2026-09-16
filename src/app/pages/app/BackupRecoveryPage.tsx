import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, IconButton, Paper, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import BackupRounded from '@mui/icons-material/BackupRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import DatasetRounded from '@mui/icons-material/DatasetRounded';
import LaptopMacRounded from '@mui/icons-material/LaptopMacRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import RestoreRounded from '@mui/icons-material/RestoreRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import StorageRounded from '@mui/icons-material/StorageRounded';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import { toast } from 'sonner';
import { createSystemBackup, getBackupRecoveryOverview, getSystemBackups, requestSystemRestore } from '../../services/api';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';

type Backup = Record<string, any>;
type RestoreComponent = 'database' | 'vault' | 'source';

function formatBytes(bytes = 0) {
  const number = Number(bytes || 0);
  if (!number) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(number) / Math.log(1024)), units.length - 1);
  return `${(number / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}
function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}
function statusColor(status = ''): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'running' || status === 'in_progress') return 'info';
  if (status === 'queued' || status === 'requested') return 'warning';
  return 'default';
}

export default function BackupRecoveryPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Record<string, any>>({});
  const [backups, setBackups] = useState<Backup[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [components, setComponents] = useState<RestoreComponent[]>(['database', 'vault', 'source']);
  const [confirmation, setConfirmation] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [restoreCommand, setRestoreCommand] = useState('');
  const [restoreExpiresAt, setRestoreExpiresAt] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [status, rows] = await Promise.all([getBackupRecoveryOverview(), getSystemBackups()]);
      setOverview(status.data || {});
      setBackups(Array.isArray(rows.data) ? rows.data : []);
    } catch (error) {
      toast.error((error as Error).message || 'Could not load backup recovery data');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const latest = overview.latest as Backup | null;
  const toolsReady = useMemo(() => Object.values(overview.tooling || {}).every(Boolean), [overview.tooling]);
  const cards = [
    { label: 'Latest protected backup', value: latest?.backupNumber || 'No backup yet', detail: latest?.completedAt ? formatDate(latest.completedAt) : 'Create the first encrypted recovery point', Icon: BackupRounded },
    { label: 'Retention', value: `${overview.retentionDays || 90} days`, detail: 'Expired managed artifacts are purged with an audit event', Icon: ScheduleRounded },
    { label: 'Protected components', value: '3 layers', detail: 'MongoDB, vault/data, application source', Icon: DatasetRounded },
    { label: 'Recovery controls', value: '2FA + root', detail: 'One-time authorization, integrity checks and audit logs', Icon: LockRounded },
  ];

  async function createBackup() {
    setWorking(true);
    try {
      await createSystemBackup(reason.trim());
      toast.success('Encrypted backup queued. The activity log will update when it completes.');
      setCreateOpen(false); setReason(''); await load();
    } catch (error) { toast.error((error as Error).message); }
    finally { setWorking(false); }
  }
  function openRestore(backup: Backup) {
    setSelectedBackup(backup); setComponents(['database', 'vault', 'source']); setConfirmation(''); setCurrentPassword(''); setTwoFactorCode(''); setRestoreCommand(''); setRestoreExpiresAt('');
  }
  async function authorizeRestore() {
    if (!selectedBackup?._id) return;
    setWorking(true);
    try {
      const result = await requestSystemRestore(selectedBackup._id, { confirmation, currentPassword, twoFactorCode, components });
      setRestoreCommand(result.data.command);
      setRestoreExpiresAt(result.data.expiresAt);
      toast.success('Restore authorised. Run the displayed root-side command before it expires.');
      await load();
    } catch (error) { toast.error((error as Error).message); }
    finally { setWorking(false); }
  }
  async function copyRestoreCommand() {
    try { await navigator.clipboard.writeText(restoreCommand); toast.success('Recovery command copied'); }
    catch { toast.error('Could not copy the recovery command'); }
  }
  function toggleComponent(component: RestoreComponent) {
    setComponents((current) => current.includes(component) ? current.filter((item) => item !== component) : [...current, component]);
  }

  if (loading) return <Box sx={{ minHeight: 480, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5, maxWidth: 1440, mx: 'auto' }}>
    <Stack direction={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 3 }}>
      <Box><Stack direction="row" spacing={1} alignItems="center"><BackupRounded color="primary" /><Typography variant="h4">Backup &amp; Recovery Center</Typography></Stack><Typography color="text.secondary" sx={{ mt: .5 }}>Encrypted, retained recovery points for the database, uploaded data, and application source.</Typography></Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><Button variant="outlined" startIcon={<StorageRounded />} onClick={() => void load()}>Refresh status</Button><Button variant="contained" startIcon={<BackupRounded />} onClick={() => setCreateOpen(true)}>Create backup</Button></Stack>
    </Stack>

    {!toolsReady && <Alert severity="error" icon={<WarningAmberRounded />} sx={{ mb: 2 }}>MongoDB Database Tools, tar, gzip, and rsync must be available before a recovery point can be created. Use the deployment package to install and validate them.</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: 1.5, mb: 2 }}>
      {cards.map(({ label, value, detail, Icon }) => <Paper key={label} elevation={0} sx={{ p: 2, borderRadius: 4, border: '1px solid', borderColor: 'divider', background: 'linear-gradient(145deg, rgba(16,101,165,.06), transparent 64%)' }}><Icon color="primary" /><Typography sx={{ mt: 1 }}>{value}</Typography><Typography variant="body2">{label}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .75 }}>{detail}</Typography></Paper>)}
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.35fr .65fr' }, gap: 2 }}>
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Box><Typography variant="h6">Managed backup history</Typography><Typography variant="body2" color="text.secondary">Every creation, expiration, authorization, and restore result is written to the system audit log.</Typography></Box><Chip label={`${overview.queue?.completed || 0} retained`} color="success" size="small" /></Stack>
        <Divider sx={{ my: 2 }} />
        {backups.length === 0 ? <Alert severity="info">No managed backup exists yet. Create one now; the automatic daily schedule will continue from then on.</Alert> : <Stack spacing={1.1}>{backups.map((backup) => <Paper key={backup._id} variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}><Stack direction={{ xs: 'column', sm: 'row' }} gap={1.2} justifyContent="space-between"><Box sx={{ minWidth: 0 }}><Stack direction="row" gap={.75} alignItems="center" flexWrap="wrap"><Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>{backup.backupNumber}</Typography><Chip size="small" color={statusColor(backup.status)} label={backup.status} /></Stack><Typography variant="body2" sx={{ mt: .65 }}>{backup.label || (backup.trigger === 'scheduled' ? 'Scheduled encrypted backup' : 'Encrypted recovery point')}</Typography><Typography variant="caption" color="text.secondary">{formatDate(backup.completedAt || backup.createdAt)} · {formatBytes(backup.artifact?.sizeBytes)} · expires {formatDate(backup.retentionUntil)}</Typography>{backup.error && <Typography variant="caption" color="error" sx={{ display: 'block', mt: .4 }}>{backup.error}</Typography>}</Box><Stack alignItems={{ sm: 'flex-end' }} spacing={.6}><Chip size="small" variant="outlined" label={backup.trigger} /><Button size="small" color="warning" variant="outlined" startIcon={<RestoreRounded />} disabled={backup.status !== 'completed'} onClick={() => openRestore(backup)}>Controlled restore</Button></Stack></Stack><Divider sx={{ my: 1 }} /><Stack direction="row" flexWrap="wrap" gap={.75}><Chip size="small" icon={<DatasetRounded />} label={`MongoDB ${formatBytes(backup.artifact?.components?.databaseBytes)}`} /><Chip size="small" icon={<StorageRounded />} label={`Vault/data ${formatBytes(backup.artifact?.components?.vaultDataBytes)}`} /><Chip size="small" icon={<BackupRounded />} label={`Source ${formatBytes(backup.artifact?.components?.sourceBytes)}`} /><Chip size="small" icon={<CheckCircleRounded />} label={`Restore: ${backup.restore?.status || 'not requested'}`} /></Stack></Paper>)}</Stack>}
      </Paper>
      <Stack spacing={2}>
        <Paper elevation={0} sx={{ p: 2.25, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}><Stack direction="row" spacing={1} alignItems="center"><ScheduleRounded color="primary" /><Box><Typography variant="h6">Automatic protection</Typography><Typography variant="body2" color="text.secondary">{overview.schedule?.label || 'Every day at 5:00 PM'} · {overview.schedule?.timeZone || 'Asia/Kolkata'}</Typography></Box></Stack><Alert severity="success" sx={{ mt: 1.5 }}>A daily key prevents duplicate backups if PM2 restarts. Existing deployment archives remain untouched.</Alert><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{overview.existingBackupData?.message}</Typography></Paper>
        <Paper elevation={0} sx={{ p: 2.25, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}><Stack direction="row" spacing={1} alignItems="center"><LaptopMacRounded color="primary" /><Box><Typography variant="h6">Laptop recovery copy</Typography><Typography variant="body2" color="text.secondary">Encrypted pull-only replica for an offline-friendly laptop.</Typography></Box></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>Install the supplied laptop timer once. It makes an outbound SFTP pull after 5 PM and catches up from the encrypted index next time the laptop is online. The laptop never receives the encryption key.</Typography><Alert severity="info" sx={{ mt: 1.5 }}>The restricted SFTP account has no shell, no password login, no forwarding, and uses a pinned server host key.</Alert></Paper>
        <Paper elevation={0} sx={{ p: 2.25, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}><Stack direction="row" spacing={1} alignItems="center"><LockRounded color="primary" /><Typography variant="h6">Restore safeguards</Typography></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>A restore needs the exact backup phrase, the administrator’s current password, authenticator 2FA or a recovery code, and a short-lived one-time root command. A new encrypted safety snapshot is taken before production data is changed.</Typography></Paper>
      </Stack>
    </Box>

    <ProfessionalDialog open={createOpen} onClose={() => !working && setCreateOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Create encrypted recovery point</DialogTitle><DialogContent dividers><Stack spacing={2}><Alert severity="info">This runs asynchronously and includes MongoDB, uploaded vault/data, and the full application source. The artifact is AES-256-GCM encrypted before it is retained.</Alert><TextField autoFocus label="Reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} inputProps={{ maxLength: 240 }} helperText="Recorded in the audit log." /></Stack></DialogContent><DialogActions><Button onClick={() => setCreateOpen(false)} disabled={working}>Cancel</Button><Button variant="contained" onClick={() => void createBackup()} disabled={working}>{working ? 'Queueing…' : 'Create backup'}</Button></DialogActions></ProfessionalDialog>

    <ProfessionalDialog open={Boolean(selectedBackup)} onClose={() => !working && setSelectedBackup(null)} fullWidth maxWidth="md"><DialogTitle>Controlled restore</DialogTitle><DialogContent dividers><Stack spacing={2}>{restoreCommand ? <><Alert severity="warning">This authorization is one time and expires at {formatDate(restoreExpiresAt)}. Run it only in a root shell on the production server. A new encrypted pre-restore safety snapshot will be created first.</Alert><TextField multiline minRows={4} value={restoreCommand} InputProps={{ readOnly: true, endAdornment: <Tooltip title="Copy command"><IconButton onClick={() => void copyRestoreCommand()}><ContentCopyRounded /></IconButton></Tooltip> }} /><Typography variant="caption" color="text.secondary">The command is intentionally not executed from this browser. It validates integrity, stops only SecureAsset processes, restores the selected components, and restarts through the guarded PM2 port-owner handoff.</Typography></> : <><Alert severity="error">Restoring can overwrite live production data. Select only the components you intend to recover and verify this backup independently before continuing.</Alert><Typography variant="body2">Backup: <Box component="span" sx={{ fontFamily: 'monospace' }}>{selectedBackup?.backupNumber}</Box></Typography><Stack direction={{ xs: 'column', sm: 'row' }}><FormControlLabel control={<Checkbox checked={components.includes('database')} onChange={() => toggleComponent('database')} />} label="MongoDB database" /><FormControlLabel control={<Checkbox checked={components.includes('vault')} onChange={() => toggleComponent('vault')} />} label="Uploaded vault/data" /><FormControlLabel control={<Checkbox checked={components.includes('source')} onChange={() => toggleComponent('source')} />} label="Application source" /></Stack><TextField label={`Type exactly: RESTORE ${selectedBackup?.backupNumber || ''}`} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /><TextField label="Current administrator password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" /><TextField label="Authenticator or backup code" value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} autoComplete="one-time-code" inputProps={{ maxLength: 32 }} helperText="Authenticator 2FA is mandatory for a production restore." /></>}</Stack></DialogContent><DialogActions><Button onClick={() => setSelectedBackup(null)} disabled={working}>{restoreCommand ? 'Close' : 'Cancel'}</Button>{!restoreCommand && <Button color="warning" variant="contained" startIcon={<RestoreRounded />} onClick={() => void authorizeRestore()} disabled={working || !components.length || confirmation !== `RESTORE ${selectedBackup?.backupNumber || ''}` || currentPassword.length < 8 || twoFactorCode.length < 6}>{working ? 'Authorising…' : 'Authorise one-time restore'}</Button>}</DialogActions></ProfessionalDialog>
  </Box>;
}
