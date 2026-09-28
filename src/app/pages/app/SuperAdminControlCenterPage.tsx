import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Grid, Stack,
  TextField, Typography,
} from '@mui/material';
import AdminPanelSettingsRounded from '@mui/icons-material/AdminPanelSettingsRounded';
import ApprovalRounded from '@mui/icons-material/ApprovalRounded';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import BackupRounded from '@mui/icons-material/BackupRounded';
import CampaignRounded from '@mui/icons-material/CampaignRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import HealthAndSafetyRounded from '@mui/icons-material/HealthAndSafetyRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import SettingsSuggestRounded from '@mui/icons-material/SettingsSuggestRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import { useNavigate } from 'react-router';
import PageHeader from '../../components/layout/PageHeader';
import { useAuth } from '../../context/AuthContext';
import {
  demoteSuperAdmin,
  getSuperAdminOverview,
  getSuperAdmins,
  promoteSuperAdmin,
} from '../../services/api';

type AnyRecord = Record<string, any>;

const money = (value: any) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const formatDate = (value: any) => value ? new Date(value).toLocaleString() : '—';

export default function SuperAdminControlCenterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AnyRecord | null>(null);
  const [admins, setAdmins] = useState<AnyRecord[]>([]);
  const [candidateId, setCandidateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (user?.role !== 'super_admin') return;
    setError('');
    try {
      const [overviewResponse, adminsResponse] = await Promise.all([getSuperAdminOverview(), getSuperAdmins()]);
      setOverview(overviewResponse.data || {});
      setAdmins(Array.isArray(adminsResponse.data) ? adminsResponse.data : []);
    } catch (cause) {
      setError((cause as Error).message || 'Could not load the Super Admin control center');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { void load(); }, [load]);

  const paymentTotal = useMemo(() => {
    const payments = overview?.payments || {};
    return Object.values(payments).reduce((sum: number, item: any) => sum + Number(item?.paid || 0), 0);
  }, [overview]);

  async function promote() {
    const id = candidateId.trim();
    if (!id) return;
    setBusy('promote'); setError(''); setNotice('');
    try {
      const response = await promoteSuperAdmin(id);
      setNotice(response.message || 'Super Admin access granted');
      setCandidateId('');
      await load();
    } catch (cause) {
      setError((cause as Error).message || 'Could not promote this user');
    } finally {
      setBusy('');
    }
  }

  async function demote(id: string) {
    if (!window.confirm('Remove Super Admin access from this account? The user will remain an Admin.')) return;
    setBusy(id); setError(''); setNotice('');
    try {
      const response = await demoteSuperAdmin(id);
      setNotice(response.message || 'Super Admin access removed');
      await load();
    } catch (cause) {
      setError((cause as Error).message || 'Could not demote this Super Admin');
    } finally {
      setBusy('');
    }
  }

  if (user?.role !== 'super_admin') {
    return <Box sx={{ p: { xs: 2, md: 4 } }}><Alert severity="error">Super Admin access is required for this workspace.</Alert></Box>;
  }
  if (loading) return <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  const metrics = [
    { label: 'Total users', value: overview?.users?.total || 0, note: `${overview?.users?.active || 0} active`, icon: GroupsRounded },
    { label: 'Properties', value: overview?.property?.total || 0, note: `${overview?.property?.pendingApproval || 0} awaiting approval`, icon: ApartmentRounded },
    { label: 'Active tenancies', value: overview?.operations?.activeTenancies || 0, note: `${overview?.operations?.openComplaints || 0} open complaints`, icon: VerifiedUserRounded },
    { label: 'Processed payments', value: money(paymentTotal), note: 'Paid amount across tracked transactions', icon: PaymentsRounded },
    { label: 'Approval queue', value: overview?.operations?.pendingApprovals || 0, note: 'Pending / escalated / returned', icon: ApprovalRounded },
    { label: 'Active subscriptions', value: overview?.subscriptions?.active || 0, note: `${overview?.subscriptions?.total || 0} total subscriptions`, icon: AdminPanelSettingsRounded },
    { label: 'Delivery failures', value: overview?.communications?.failedNotifications || 0, note: 'WhatsApp / SMS / email / push', icon: CampaignRounded },
    { label: 'Security events', value: overview?.security?.recentEvents24h || 0, note: 'Sensitive events in the last 24 hours', icon: SecurityRounded },
  ];

  const workspaces = [
    { label: 'Approval Center', copy: 'KYC, Surveyors, public listings and subscriptions', path: '/app/approvals', icon: ApprovalRounded },
    { label: 'Users & Permissions', copy: 'Users, roles, capability access and permission policies', path: '/app/users', icon: GroupsRounded },
    { label: 'Finance Center', copy: 'Payments, invoices, subscriptions and reconciliation', path: '/app/payments', icon: PaymentsRounded },
    { label: 'Security Center', copy: 'Sessions, audit events and account security controls', path: '/app/security', icon: HealthAndSafetyRounded },
    { label: 'Backup & Recovery', copy: 'Encrypted backups, restore controls and disaster recovery', path: '/app/backup-recovery', icon: BackupRounded },
    { label: 'System Settings', copy: 'Platform, integrations, communications and application settings', path: '/app/settings', icon: SettingsSuggestRounded },
  ];

  return <Box sx={{ px: { xs: 1.5, sm: 3, lg: 4 }, pb: 6 }}>
    <PageHeader
      variant="plain"
      eyebrow="Platform control plane"
      title="Super Admin"
      description="Global operational control for Secure Asset. Super Admin inherits the complete Admin workspace and adds protected platform-level authority, security oversight and account governance."
      meta={<Stack direction="row" gap={.75} flexWrap="wrap"><Chip size="small" color="success" label="Global scope" /><Chip size="small" variant="outlined" label={overview?.security?.database === 'operational' ? 'Database operational' : 'Database degraded'} /></Stack>}
      actions={<Button size="small" variant="outlined" onClick={() => void load()}>Refresh</Button>}
    />

    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

    <Grid container spacing={1.5}>
      {metrics.map(({ label, value, note, icon: Icon }) => <Grid key={label} size={{ xs: 6, md: 3 }}>
        <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" gap={1}>
              <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h5" sx={{ mt: .4, fontWeight: 600 }}>{value}</Typography></Box>
              <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}><Icon fontSize="small" /></Box>
            </Stack>
            <Typography variant="caption" color="text.secondary">{note}</Typography>
          </CardContent>
        </Card>
      </Grid>)}
    </Grid>

    <Grid container spacing={2} sx={{ mt: .5 }}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Control workspaces</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Use the existing Secure Asset operational modules with unrestricted global scope.</Typography>
            <Grid container spacing={1.2}>
              {workspaces.map(({ label, copy, path, icon: Icon }) => <Grid key={label} size={{ xs: 12, sm: 6 }}>
                <Button onClick={() => navigate(path)} fullWidth variant="outlined" sx={{ justifyContent: 'flex-start', p: 1.5, minHeight: 78, textAlign: 'left' }}>
                  <Stack direction="row" gap={1.2} alignItems="center"><Icon /><Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>{label}</Typography><Typography variant="caption" color="text.secondary">{copy}</Typography></Box></Stack>
                </Button>
              </Grid>)}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Runtime health</Typography>
            <Stack spacing={1.1} mt={2}>
              <Stack direction="row" justifyContent="space-between"><Typography variant="body2">Database</Typography><Chip size="small" color={overview?.security?.database === 'operational' ? 'success' : 'warning'} label={overview?.security?.database || 'unknown'} /></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography variant="body2">Node runtime</Typography><Typography variant="body2">{overview?.runtime?.node || '—'}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography variant="body2">Uptime</Typography><Typography variant="body2">{Math.floor(Number(overview?.runtime?.uptimeSeconds || 0) / 60)} min</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography variant="body2">Generated</Typography><Typography variant="caption">{formatDate(overview?.generatedAt)}</Typography></Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>

    <Card elevation={0} sx={{ mt: 2, border: '1px solid', borderColor: 'divider' }}>
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Super Admin governance</Typography>
            <Typography variant="body2" color="text.secondary">Promotion is intentionally restricted to existing Super Admins. Demotion preserves the account as a normal Admin, blocks self-demotion, and guarantees at least one active Super Admin remains.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ minWidth: { md: 420 } }}>
            <TextField size="small" fullWidth label="Existing user ID" value={candidateId} onChange={(event) => setCandidateId(event.target.value)} />
            <Button variant="contained" onClick={() => void promote()} disabled={!candidateId.trim() || busy === 'promote'}>{busy === 'promote' ? 'Granting…' : 'Grant access'}</Button>
          </Stack>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1}>
          {admins.map((admin) => <Stack key={admin._id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>{admin.name}</Typography><Typography variant="caption" color="text.secondary">{admin.email} · Last login {formatDate(admin.lastLogin)}</Typography></Box>
            <Stack direction="row" gap={1} alignItems="center"><Chip size="small" color="success" label="Super Admin" /><Button size="small" color="error" variant="outlined" onClick={() => void demote(String(admin._id))} disabled={String(admin._id) === String(user?._id) || busy === String(admin._id)}>Demote</Button></Stack>
          </Stack>)}
          {!admins.length && <Alert severity="warning">No Super Admin account is active. Bootstrap one with the protected server command before using this workspace.</Alert>}
        </Stack>
      </CardContent>
    </Card>
  </Box>;
}
