import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Box, Button, Chip, CircularProgress, Divider, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import AdminPanelSettingsRounded from '@mui/icons-material/AdminPanelSettingsRounded';
import ApprovalRounded from '@mui/icons-material/ApprovalRounded';
import BackupRounded from '@mui/icons-material/BackupRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import StorageRounded from '@mui/icons-material/StorageRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import SyncRounded from '@mui/icons-material/SyncRounded';
import {
  getResource, getSuperAdminFinance, getSuperAdminOverview, getSuperAdminSecurityEvents,
  getSuperAdminSystemHealth, runSuperAdminUserAction, type SuperAdminOverview,
} from '../../services/api';
import type { User } from '../../services/types';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-IN');

const quickLinks = [
  ['Approval Center', 'Review KYC, properties, surveyors and escalations.', '/app/approvals', ApprovalRounded],
  ['User Management', 'Inspect accounts, roles, status and access.', '/app/users', GroupsRounded],
  ['Role & Permissions', 'Control administrator and operational RBAC.', '/app/role-permissions', VerifiedUserRounded],
  ['Finance Center', 'Payments, invoices, refunds and reconciliation.', '/app/payments', PaymentsRounded],
  ['Security Center', 'Sessions, login controls and security operations.', '/app/security', SecurityRounded],
  ['Backup & Recovery', 'Encrypted backups and disaster recovery.', '/app/backup-recovery', BackupRounded],
  ['Integrations', 'WhatsApp, SMS, storage, maps and external services.', '/app/integration-settings', SettingsRounded],
  ['System Settings', 'Platform configuration and operational controls.', '/app/settings', StorageRounded],
] as const;

const actionOptions = [
  ['logout_all', 'Log out all sessions'],
  ['suspend', 'Suspend account'],
  ['activate', 'Restore / activate'],
  ['lock', 'Lock account'],
  ['set_role', 'Change role'],
] as const;

const roleOptions = ['super_admin', 'admin', 'manager', 'landlord', 'tenant', 'surveyor'] as const;

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return <Paper variant="outlined" sx={{ p: 2.2, borderRadius: 2.5, minHeight: 118, bgcolor: 'background.paper' }}>
    <Typography sx={{ fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', color: 'text.secondary' }}>{label}</Typography>
    <Typography sx={{ mt: .8, fontSize: { xs: 24, md: 28 }, fontWeight: 650, letterSpacing: '-.03em' }}>{value}</Typography>
    {helper && <Typography sx={{ mt: .5, fontSize: 12, color: 'text.secondary' }}>{helper}</Typography>}
  </Paper>;
}

function statusColor(status: string) {
  if (status === 'operational' || status === 'active') return 'success' as const;
  if (status === 'degraded' || status === 'locked' || status === 'suspended') return 'warning' as const;
  return 'default' as const;
}

export default function SuperAdminCommandCenterPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<SuperAdminOverview | null>(null);
  const [finance, setFinance] = useState<Record<string, any>>({});
  const [security, setSecurity] = useState<Record<string, any>>({});
  const [health, setHealth] = useState<Record<string, any>>({});
  const [admins, setAdmins] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [action, setAction] = useState('logout_all');
  const [targetRole, setTargetRole] = useState('admin');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewResponse, financeResponse, securityResponse, healthResponse, usersResponse] = await Promise.all([
        getSuperAdminOverview(),
        getSuperAdminFinance(),
        getSuperAdminSecurityEvents(20),
        getSuperAdminSystemHealth(),
        getResource<User>('users', { role: 'super_admin,admin,manager', limit: 100 }),
      ]);
      setOverview(overviewResponse.data);
      setFinance(financeResponse.data || {});
      setSecurity(securityResponse.data || {});
      setHealth(healthResponse.data || {});
      setAdmins(usersResponse.data || []);
      setSelectedUser((current) => current || usersResponse.data?.[0]?._id || '');
    } catch (caught) {
      setError((caught as Error).message || 'Could not load the Super Admin Command Center.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedAccount = useMemo(() => admins.find((item) => item._id === selectedUser), [admins, selectedUser]);
  const services = Array.isArray(health?.services) ? health.services : [];
  const events = Array.isArray(security?.events) ? security.events : [];
  const recentAudit = Array.isArray(overview?.recentAudit) ? overview.recentAudit : [];

  async function executeAction() {
    if (!selectedUser) { setError('Select an administrator account first.'); return; }
    if (reason.trim().length < 5) { setError('Enter a clear audit reason of at least 5 characters.'); return; }
    setExecuting(true); setError(''); setMessage('');
    try {
      await runSuperAdminUserAction(selectedUser, {
        action,
        reason: reason.trim(),
        ...(action === 'set_role' ? { role: targetRole } : {}),
        ...(action === 'set_role' && (targetRole === 'super_admin' || selectedAccount?.role === 'super_admin') ? { confirmation } : {}),
      });
      setMessage('Privileged account action completed. Sessions and the audit trail were updated where required.');
      setReason('');
      setConfirmation('');
      await load();
    } catch (caught) {
      setError((caught as Error).message || 'The privileged account action could not be completed.');
    } finally {
      setExecuting(false);
    }
  }

  if (loading && !overview) return <Box sx={{ minHeight: 420, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  const kpi = overview?.kpis || {};
  const approval = overview?.approvals || {};
  const securityKpi = overview?.security || {};

  return <Box sx={{ px: { xs: 1.5, sm: 2.5, lg: 3.5 }, pb: 8, maxWidth: 1600, mx: 'auto' }}>
    <Paper elevation={0} sx={{ mb: 2.5, p: { xs: 2, md: 2.8 }, border: '1px solid', borderColor: 'divider', borderRadius: 3, background: 'linear-gradient(135deg, rgba(9,30,66,.06), rgba(8,122,92,.05))' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ width: 44, height: 44, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText' }}><AdminPanelSettingsRounded /></Box>
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', letterSpacing: '.09em', textTransform: 'uppercase' }}>Secure Asset Control Plane</Typography>
            <Typography variant="h4" sx={{ mt: .3, fontWeight: 650, letterSpacing: '-.035em' }}>Super Admin Command Center</Typography>
            <Typography color="text.secondary" sx={{ mt: .5, maxWidth: 820, fontSize: 13.5 }}>Global operations, approvals, security, finance, administrator access, platform health, integrations and recovery controls in one protected workspace.</Typography>
          </Box>
        </Stack>
        <Button variant="outlined" startIcon={<SyncRounded />} onClick={() => void load()} disabled={loading}>Refresh live data</Button>
      </Stack>
    </Paper>

    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 1.4, mb: 2.5 }}>
      <MetricCard label="Active users" value={number.format(Number(kpi.activeUsers || 0))} helper={number.format(Number(kpi.totalUsers || 0)) + ' total accounts'} />
      <MetricCard label="Properties" value={number.format(Number(kpi.totalProperties || 0))} helper={number.format(Number(kpi.activeTenancies || 0)) + ' active tenancies'} />
      <MetricCard label="Monthly collected" value={currency.format(Number(kpi.monthlyRevenue || 0))} helper={number.format(Number(overview?.finance?.monthlyTransactions || 0)) + ' paid transactions'} />
      <MetricCard label="Outstanding rent" value={currency.format(Number(kpi.outstandingRent || 0))} helper={number.format(Number(overview?.finance?.outstandingInvoices || 0)) + ' open invoices'} />
      <MetricCard label="Approval queue" value={number.format(Number(kpi.pendingApprovals || 0))} helper={number.format(Number(approval.tenantKyc || 0)) + ' KYC • ' + number.format(Number(approval.surveyors || 0)) + ' surveyors'} />
      <MetricCard label="Applications" value={number.format(Number(kpi.pendingApplications || 0))} helper="Open rental decisions" />
      <MetricCard label="Security signals" value={number.format(Number(securityKpi.privilegedChanges24h || 0))} helper={number.format(Number(securityKpi.lockedUsers || 0)) + ' locked • ' + number.format(Number(securityKpi.activeSessions || 0)) + ' sessions'} />
      <MetricCard label="Active subscriptions" value={number.format(Number(kpi.activeSubscriptions || 0))} helper={number.format(Number(kpi.openComplaints || 0)) + ' open service issues'} />
    </Box>

    <Typography sx={{ mb: 1.2, fontWeight: 650, fontSize: 18 }}>Control modules</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,minmax(0,1fr))' }, gap: 1.2, mb: 3 }}>
      {quickLinks.map(([label, description, path, Icon]) => <Paper key={path} component="button" onClick={() => navigate(path)} variant="outlined" sx={{ textAlign: 'left', p: 1.8, borderRadius: 2.5, cursor: 'pointer', bgcolor: 'background.paper', color: 'text.primary', font: 'inherit', '&:hover': { borderColor: 'primary.main' } }}>
        <Stack direction="row" spacing={1.2} alignItems="flex-start"><Icon fontSize="small" color="primary" /><Box><Typography sx={{ fontWeight: 650, fontSize: 13.5 }}>{label}</Typography><Typography color="text.secondary" sx={{ mt: .35, fontSize: 11.5, lineHeight: 1.45 }}>{description}</Typography></Box></Stack>
      </Paper>)}
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.05fr .95fr' }, gap: 2.2, mb: 2.5 }}>
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ px: 2.2, py: 1.8 }}><Typography sx={{ fontWeight: 650 }}>Administrator control</Typography><Typography variant="caption" color="text.secondary">Sensitive actions require a written reason and are written to the audit trail.</Typography></Box>
        <Divider />
        <Stack spacing={1.4} sx={{ p: 2.2 }}>
          <TextField select size="small" label="Administrator account" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
            {admins.map((account) => <MenuItem key={account._id} value={account._id}>{account.name + ' — ' + account.email + ' (' + String(account.role).replaceAll('_', ' ') + ')'}</MenuItem>)}
          </TextField>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
            <TextField select fullWidth size="small" label="Action" value={action} onChange={(event) => setAction(event.target.value)}>
              {actionOptions.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
            {action === 'set_role' && <TextField select fullWidth size="small" label="New role" value={targetRole} onChange={(event) => setTargetRole(event.target.value)}>
              {roleOptions.map((item) => <MenuItem key={item} value={item}>{item.replaceAll('_', ' ')}</MenuItem>)}
            </TextField>}
          </Stack>
          <TextField size="small" label="Audit reason" value={reason} onChange={(event) => setReason(event.target.value)} multiline minRows={2} placeholder="Why is this privileged action required?" />
          {action === 'set_role' && (targetRole === 'super_admin' || selectedAccount?.role === 'super_admin') && <TextField size="small" label="Root-role confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} helperText="Type SUPER_ADMIN to confirm a root-role change." />}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Chip size="small" color={selectedAccount?.status ? statusColor(selectedAccount.status) : 'default'} label={selectedAccount ? String(selectedAccount.role).replaceAll('_', ' ') + ' • ' + selectedAccount.status : 'No account selected'} />
            <Button variant="contained" color={action === 'suspend' || action === 'lock' ? 'warning' : 'primary'} disabled={executing || !selectedUser} onClick={() => void executeAction()}>{executing ? 'Applying…' : 'Execute action'}</Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ px: 2.2, py: 1.8 }}><Typography sx={{ fontWeight: 650 }}>System health</Typography><Typography variant="caption" color="text.secondary">Live API, database, session, notification and security telemetry.</Typography></Box>
        <Divider />
        <Stack divider={<Divider />}>
          {services.map((service: any) => <Stack key={service.key} direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.2, py: 1.35 }}>
            <Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>{service.label}</Typography><Typography variant="caption" color="text.secondary">{service.detail || 'Live monitor'}</Typography></Box>
            <Chip size="small" color={statusColor(service.status)} label={service.status} />
          </Stack>)}
          {!services.length && <Typography color="text.secondary" sx={{ p: 2.2, fontSize: 13 }}>No system telemetry available.</Typography>}
        </Stack>
      </Paper>
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3,minmax(0,1fr))' }, gap: 2.2 }}>
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.2 }}>
        <Typography sx={{ fontWeight: 650 }}>Approval pulse</Typography>
        <Stack spacing={1.1} sx={{ mt: 1.5 }}>
          {[['Tenant KYC', approval.tenantKyc], ['Surveyors', approval.surveyors], ['Public properties', approval.publicProperties], ['Applications', approval.applications], ['Other approvals', approval.generic]].map(([label, value]) => <Stack key={String(label)} direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 13 }}>{label}</Typography><Typography sx={{ fontWeight: 650 }}>{number.format(Number(value || 0))}</Typography></Stack>)}
        </Stack>
        <Button onClick={() => navigate('/app/approvals')} size="small" sx={{ mt: 1.5 }}>Open Approval Center</Button>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.2 }}>
        <Typography sx={{ fontWeight: 650 }}>Financial pulse</Typography>
        <Stack spacing={1.1} sx={{ mt: 1.5 }}>
          <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 13 }}>Collected this month</Typography><Typography sx={{ fontWeight: 650 }}>{currency.format(Number(finance?.monthly?.amount || 0))}</Typography></Stack>
          <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 13 }}>Collected YTD</Typography><Typography sx={{ fontWeight: 650 }}>{currency.format(Number(finance?.yearly?.amount || 0))}</Typography></Stack>
          <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 13 }}>Outstanding</Typography><Typography sx={{ fontWeight: 650 }}>{currency.format(Number(finance?.outstanding?.amount || 0))}</Typography></Stack>
          <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 13 }}>Failed this month</Typography><Typography sx={{ fontWeight: 650 }}>{number.format(Number(finance?.failedThisMonth || 0))}</Typography></Stack>
        </Stack>
        <Button onClick={() => navigate('/app/payments')} size="small" sx={{ mt: 1.5 }}>Open Finance</Button>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.2 }}>
        <Typography sx={{ fontWeight: 650 }}>Security pulse</Typography>
        <Stack spacing={1.1} sx={{ mt: 1.5 }}>
          <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 13 }}>Locked accounts</Typography><Typography sx={{ fontWeight: 650 }}>{number.format(Number(security?.lockedAccounts?.length || 0))}</Typography></Stack>
          <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 13 }}>Tracked sessions</Typography><Typography sx={{ fontWeight: 650 }}>{number.format(Number(security?.sessions?.length || 0))}</Typography></Stack>
          <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" sx={{ fontSize: 13 }}>Recent security events</Typography><Typography sx={{ fontWeight: 650 }}>{number.format(Number(events.length))}</Typography></Stack>
        </Stack>
        <Button onClick={() => navigate('/app/security')} size="small" sx={{ mt: 1.5 }}>Open Security Center</Button>
      </Paper>
    </Box>

    <Paper variant="outlined" sx={{ mt: 2.5, borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ px: 2.2, py: 1.8 }}><Typography sx={{ fontWeight: 650 }}>Recent privileged activity</Typography><Typography variant="caption" color="text.secondary">Latest platform audit records visible to the Super Admin.</Typography></Box>
      <Divider />
      <Stack divider={<Divider />}>
        {recentAudit.slice(0, 10).map((entry: any) => <Stack key={entry._id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={.7} sx={{ px: 2.2, py: 1.25 }}>
          <Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>{String(entry.action || 'activity').replaceAll('-', ' ')}</Typography><Typography variant="caption" color="text.secondary">{(entry.module || 'platform') + ' • ' + (entry.user?.name || entry.role || 'system')}</Typography></Box>
          <Stack direction="row" spacing={1} alignItems="center"><Chip size="small" variant="outlined" label={entry.severity || 'info'} /><Typography variant="caption" color="text.secondary">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</Typography></Stack>
        </Stack>)}
        {!recentAudit.length && <Typography color="text.secondary" sx={{ p: 2.2, fontSize: 13 }}>No recent audit events.</Typography>}
      </Stack>
    </Paper>
  </Box>;
}
