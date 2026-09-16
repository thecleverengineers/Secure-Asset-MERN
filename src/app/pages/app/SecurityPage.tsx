import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, DialogActions, DialogContent, DialogTitle,
  Divider, Grid, IconButton, List, ListItem, ListItemText, Paper, Stack, TextField, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EmailRounded from '@mui/icons-material/EmailRounded';
import FingerprintRounded from '@mui/icons-material/FingerprintRounded';
import KeyRounded from '@mui/icons-material/KeyRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import PasswordRounded from '@mui/icons-material/PasswordRounded';
import PhoneIphoneRounded from '@mui/icons-material/PhoneIphoneRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import VpnKeyRounded from '@mui/icons-material/VpnKeyRounded';
import {
  beginDeviceUnlockAuthentication, beginDeviceUnlockSetup, beginTwoFactorSetup, changePassword,
  completeDeviceUnlockAuthentication, completeDeviceUnlockSetup, disableTwoFactor, enableTwoFactor,
  getAdminSessions, getSecurityOverview, regenerateBackupCodes, requestContactChange, resetDeviceUnlock, revokeAdminSession,
  revokeAdminUserSessions, revokeOtherSessions, revokeSession, verifyContactChange,
} from '../../services/api';
import type { AdminSession, SecurityOverview } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  authenticationOptionsForBrowser, deviceUnlockSupported, registrationOptionsForBrowser,
  serializePublicKeyCredential,
} from '../../services/deviceUnlock';

type ContactType = 'email' | 'phone';
type Session = SecurityOverview['sessions'][number];

function friendlyDeviceError(error: unknown) {
  const value = error as { name?: string; message?: string };
  if (value?.name === 'NotAllowedError') return 'The device verification was cancelled or timed out. Try again and complete the phone prompt.';
  if (value?.name === 'InvalidStateError') return 'This device is already registered. Use Reset device unlock first if you need to enroll it again.';
  return value?.message || 'The device could not complete secure verification.';
}

export default function SecurityPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const theme = useTheme();
  const mobileOrTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const [data, setData] = useState<SecurityOverview>({ twoFactorEnabled: false, deviceUnlockEnabled: false, sessions: [] });
  const [adminSessions, setAdminSessions] = useState<AdminSession[]>([]);
  const [adminSessionsLoading, setAdminSessionsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deviceDialog, setDeviceDialog] = useState<'setup' | 'reset' | null>(null);
  const [devicePassword, setDevicePassword] = useState('');
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [contactType, setContactType] = useState<ContactType | null>(null);
  const [contactValue, setContactValue] = useState('');
  const [contactPassword, setContactPassword] = useState('');
  const [contactOtp, setContactOtp] = useState('');
  const [contactStep, setContactStep] = useState<'details' | 'otp'>('details');
  const [contactBusy, setContactBusy] = useState(false);

  async function load() {
    setLoading(true);
    try { setData((await getSecurityOverview()).data); } catch (caught) { setError((caught as Error).message); } finally { setLoading(false); }
  }

  async function loadAdminSessions() {
    if (user?.role !== 'admin') return;
    setAdminSessionsLoading(true);
    try { setAdminSessions((await getAdminSessions()).data); } catch (caught) { setError((caught as Error).message); } finally { setAdminSessionsLoading(false); }
  }

  useEffect(() => { void load(); void loadAdminSessions(); }, [user?.role]);

  async function run(action: () => Promise<any>, success: string) {
    setError(''); setMessage('');
    try { await action(); setMessage(success); await load(); await loadAdminSessions(); } catch (caught) { setError((caught as Error).message); }
  }

  async function copy(text: string) {
    await navigator.clipboard?.writeText(text);
    setMessage('Copied to clipboard');
  }

  async function startSetup() {
    setError('');
    try { setSetup((await beginTwoFactorSetup()).data); setCode(''); setPassword(''); setBackupCodes([]); }
    catch (caught) { setError((caught as Error).message); }
  }

  async function enable() {
    setError('');
    try {
      const result = await enableTwoFactor(password, code);
      setBackupCodes(result.data.backupCodes); setSetup(null); setCode(''); setPassword('');
      setMessage('Two-factor authentication enabled. Save the backup codes now.'); await load();
    } catch (caught) { setError((caught as Error).message); }
  }

  async function completeDeviceAction() {
    if (!deviceDialog) return;
    setDeviceBusy(true); setError(''); setMessage('');
    try {
      if (deviceDialog === 'reset') {
        await resetDeviceUnlock(devicePassword);
        setMessage('Device unlock reset. You can enroll a new trusted phone or tablet.');
      } else {
        if (!mobileOrTablet) throw new Error('Open Security on the phone or tablet you want to protect.');
        if (!deviceUnlockSupported()) throw new Error('Secure device unlock requires HTTPS and a phone or tablet with screen lock, fingerprint or face unlock enabled.');
        const options = (await beginDeviceUnlockSetup(devicePassword)).data;
        const credential = await navigator.credentials.create({ publicKey: registrationOptionsForBrowser(options) });
        await completeDeviceUnlockSetup(serializePublicKeyCredential(credential));
        setMessage('Mobile Document Vault protection is enabled. Your biometric data stays on the device.');
      }
      setDeviceDialog(null); setDevicePassword(''); await load(); await refreshUser();
    } catch (caught) {
      setError(friendlyDeviceError(caught));
    } finally { setDeviceBusy(false); }
  }

  async function unlockPreview() {
    setError(''); setMessage('');
    try {
      if (!mobileOrTablet) throw new Error('Open Security on a phone or tablet to test mobile vault unlock.');
      if (!deviceUnlockSupported()) throw new Error('This browser cannot use secure device unlock. Use HTTPS and enable a phone screen lock, fingerprint or face unlock.');
      const options = (await beginDeviceUnlockAuthentication()).data;
      const credential = await navigator.credentials.get({ publicKey: authenticationOptionsForBrowser(options) });
      await completeDeviceUnlockAuthentication(serializePublicKeyCredential(credential));
      setMessage('Device verification succeeded. Document Vault can now be unlocked with this device.');
    } catch (caught) { setError(friendlyDeviceError(caught)); }
  }

  function openContact(type: ContactType) {
    setContactType(type); setContactValue(''); setContactPassword(''); setContactOtp(''); setContactStep('details');
  }

  async function requestContactOtp() {
    if (!contactType) return;
    setContactBusy(true); setError(''); setMessage('');
    try {
      const result = await requestContactChange(contactType, contactValue, contactPassword);
      setContactStep('otp');
      setContactOtp(result.developmentOtp || '');
      setMessage(`Verification OTP sent to ${result.data.maskedMobile}${result.developmentOtp ? ` · Development OTP: ${result.developmentOtp}` : ''}`);
    } catch (caught) { setError((caught as Error).message); } finally { setContactBusy(false); }
  }

  async function confirmContactChange() {
    if (!contactType) return;
    setContactBusy(true); setError(''); setMessage('');
    try {
      await verifyContactChange(contactType, contactOtp);
      setContactType(null); setContactStep('details'); setContactOtp('');
      setMessage(`${contactType === 'email' ? 'Email' : 'Mobile number'} updated. Other sessions were signed out.`);
      await refreshUser(); await load();
    } catch (caught) { setError((caught as Error).message); } finally { setContactBusy(false); }
  }

  if (loading) return <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
    <CompactPageToolbar marker="security-toolbar-v153" title="Security centre" description="Control how your account and private Document Vault are accessed." actions={<Button size="small" startIcon={<RefreshRounded />} onClick={load}>Refresh</Button>} />
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
    {backupCodes.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}><Typography fontWeight={900}>Store these one-time backup codes securely.</Typography><Stack direction="row" flexWrap="wrap" gap={1} mt={1}>{backupCodes.map((item) => <Chip key={item} label={item} onDelete={() => void copy(item)} deleteIcon={<ContentCopyRounded />} />)}</Stack></Alert>}

    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Card elevation={0} sx={{ height: '100%', borderRadius: { xs: 4, md: 5 }, color: 'primary.contrastText', background: 'linear-gradient(135deg,#0B5270 0%,#0c6b83 56%,#167e86 100%)', overflow: 'hidden', position: 'relative' }}>
          <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', right: -74, top: -92, bgcolor: 'rgba(255,255,255,.10)' }} />
          <CardContent sx={{ p: { xs: 2.5, md: 3.5 }, position: 'relative' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}><Box><Chip size="small" icon={<ShieldRounded />} label="Private vault protection" sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,.14)', '& .MuiChip-icon': { color: 'inherit' } }} /><Typography variant="h5" fontWeight={950} sx={{ mt: 1.5 }}>Unlock Document Vault with your device</Typography><Typography sx={{ mt: 1, color: 'rgba(255,255,255,.78)', maxWidth: 560 }}>On a phone or tablet, SecureAsset can ask for the device security already trusted by you: fingerprint, Face ID/face unlock, or the screen lock. SecureAsset never receives biometric images or your PIN.</Typography></Box><SecurityRounded sx={{ fontSize: 46, opacity: .9 }} /></Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.2} sx={{ mt: 2.5 }}><Chip icon={<LockRounded />} label={data.deviceUnlockEnabled ? 'Device unlock enabled' : 'Not configured'} color={data.deviceUnlockEnabled ? 'success' : 'default'} sx={{ bgcolor: data.deviceUnlockEnabled ? 'rgba(218,255,233,.92)' : 'rgba(255,255,255,.16)', color: data.deviceUnlockEnabled ? 'success.dark' : 'inherit', '& .MuiChip-icon': { color: 'inherit' } }} />{data.deviceUnlockEnabled && <Button variant="outlined" onClick={unlockPreview} sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,.5)' }} startIcon={<FingerprintRounded />}>Test device unlock</Button>}</Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.2} sx={{ mt: 2 }}><Button className="sa-light-button" variant="contained" onClick={() => { setDeviceDialog('setup'); setDevicePassword(''); }} disabled={!mobileOrTablet} startIcon={<KeyRounded />} sx={{ bgcolor: 'white', color: '#0B5270', '&:hover': { bgcolor: '#e8f7fa' } }}>{data.deviceUnlockEnabled ? 'Enroll another device' : 'Set up mobile unlock'}</Button>{data.deviceUnlockEnabled && <Button variant="outlined" color="inherit" onClick={() => { setDeviceDialog('reset'); setDevicePassword(''); }} startIcon={<LogoutRounded />} sx={{ borderColor: 'rgba(255,255,255,.5)' }}>Reset device unlock</Button>}</Stack>
            {!mobileOrTablet && <Typography sx={{ mt: 1.5, fontSize: 12, color: 'rgba(255,255,255,.7)' }}>Open this page on the phone or tablet that should unlock the vault.</Typography>}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Card variant="outlined" sx={{ height: '100%', borderRadius: { xs: 4, md: 5 } }}><CardContent sx={{ p: { xs: 2.5, md: 3 } }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" fontWeight={900}>Account access</Typography><Typography color="text.secondary" fontSize={13}>Password, OTP and authenticator controls.</Typography></Box><VpnKeyRounded color="primary" /></Stack><Divider sx={{ my: 2 }} /><Stack spacing={1.2}><Button variant="outlined" startIcon={<PasswordRounded />} onClick={() => navigate('/reset-password')}>Reset password with OTP</Button><Button variant="outlined" startIcon={<PasswordRounded />} onClick={() => setPasswordDialog(true)}>Change password</Button>{data.twoFactorEnabled ? <Chip color="success" icon={<VerifiedUserIcon />} label="Authenticator 2FA enabled" /> : <Button variant="contained" startIcon={<SecurityRounded />} onClick={startSetup}>Set up authenticator 2FA</Button>}</Stack></CardContent></Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card variant="outlined" sx={{ borderRadius: { xs: 4, md: 5 } }}><CardContent sx={{ p: { xs: 2.5, md: 3 } }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}><Box><Typography variant="h6" fontWeight={900}>Verified contact details</Typography><Typography color="text.secondary" fontSize={13}>Changing a contact requires your current password and a one-time mobile OTP.</Typography></Box><ShieldRounded color="primary" /></Stack><Grid container spacing={1.5} sx={{ mt: 1 }}><Grid size={{ xs: 12, md: 6 }}><Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack direction="row" justifyContent="space-between" gap={1}><Stack direction="row" spacing={1.2} alignItems="center"><EmailRounded color="primary" /><Box><Typography fontSize={11} color="text.secondary">EMAIL</Typography><Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>{dataContact('email')}</Typography></Box></Stack><Button size="small" onClick={() => openContact('email')}>Change</Button></Stack></Paper></Grid><Grid size={{ xs: 12, md: 6 }}><Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack direction="row" justifyContent="space-between" gap={1}><Stack direction="row" spacing={1.2} alignItems="center"><PhoneIphoneRounded color="primary" /><Box><Typography fontSize={11} color="text.secondary">MOBILE</Typography><Typography fontWeight={800}>{dataContact('phone')}</Typography></Box></Stack><Button size="small" onClick={() => openContact('phone')}>Change</Button></Stack></Paper></Grid></Grid></CardContent></Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Card variant="outlined" sx={{ borderRadius: { xs: 4, md: 5 }, height: '100%' }}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" fontWeight={900}>Authenticator 2FA</Typography><Typography color="text.secondary" fontSize={13}>Use an authenticator app as an additional account factor.</Typography></Box><SecurityRounded color={data.twoFactorEnabled ? 'success' : 'disabled'} /></Stack><Divider sx={{ my: 2 }} />{data.twoFactorEnabled ? <Stack spacing={1.3}><Chip color="success" label="Enabled" /><TextField label="Current password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /><TextField label="Authenticator or backup code" value={code} onChange={(event) => setCode(event.target.value)} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button color="error" variant="outlined" onClick={() => run(() => disableTwoFactor(password, code), 'Authenticator 2FA disabled')}>Disable 2FA</Button><Button variant="outlined" onClick={async () => { try { const result = await regenerateBackupCodes(password, code); setBackupCodes(result.data.backupCodes); setMessage('Backup codes regenerated.'); } catch (caught) { setError((caught as Error).message); } }}>New backup codes</Button></Stack></Stack> : setup ? <Stack spacing={1.3}><Alert severity="info">Add this account to your authenticator app, then enter the current six-digit code.</Alert><Paper variant="outlined" sx={{ p: 2, borderRadius: 3, wordBreak: 'break-all' }}><Typography fontSize={12} color="text.secondary">Secret</Typography><Typography fontFamily="inherit" fontWeight={800}>{setup.secret}</Typography><Button size="small" startIcon={<ContentCopyRounded />} onClick={() => void copy(setup.otpauthUri)}>Copy authenticator URI</Button></Paper><TextField label="Current password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /><TextField label="6-digit authenticator code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required /><Button variant="contained" onClick={enable}>Enable authenticator 2FA</Button><Button onClick={() => setSetup(null)}>Cancel setup</Button></Stack> : <Button variant="contained" onClick={startSetup}>Set up authenticator 2FA</Button>}</CardContent></Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <Card variant="outlined" sx={{ borderRadius: { xs: 4, md: 5 } }}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" fontWeight={900}>Active sessions</Typography><Typography color="text.secondary" fontSize={13}>Revoke access from devices you no longer recognise.</Typography></Box><Chip label={`${data.sessions.length} sessions`} /></Stack><List>{data.sessions.map((session: Session, index) => <Box key={session.id}>{index > 0 && <Divider />}<ListItem secondaryAction={!session.current ? <IconButton color="error" onClick={() => run(() => revokeSession(session.id), 'Session revoked')}><DeleteOutlineRounded /></IconButton> : <Chip size="small" color="success" label="Current" />}><ListItemText primary={session.device || 'Unknown device'} secondary={`${session.ip || 'Unknown IP'} · Last used ${session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString() : 'Unknown'}`} /></ListItem></Box>)}</List><Divider sx={{ my: 2 }} /><TextField fullWidth size="small" label="Password to revoke all other sessions" type="password" value={password} onChange={(event) => setPassword(event.target.value)} sx={{ mb: 1.5 }} /><Button color="warning" variant="outlined" onClick={() => run(() => revokeOtherSessions(password), 'Other sessions revoked')}>Sign out all other devices</Button></CardContent></Card>
      </Grid>

      {user?.role === 'admin' && <Grid size={{ xs: 12 }}>
        <Card variant="outlined" sx={{ borderRadius: { xs: 4, md: 5 } }}><CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
            <Box><Typography variant="h6" fontWeight={900}>Administrator session control</Typography><Typography color="text.secondary" fontSize={13}>Review persistent devices across the platform and revoke compromised access centrally.</Typography></Box>
            <Button size="small" startIcon={<RefreshRounded />} onClick={() => void loadAdminSessions()} disabled={adminSessionsLoading}>Refresh devices</Button>
          </Stack>
          {adminSessionsLoading ? <Box sx={{ py: 3, display: 'grid', placeItems: 'center' }}><CircularProgress size={24} /></Box> : <List>{adminSessions.map((session, index) => <Box key={session.id}>{index > 0 && <Divider />}<ListItem secondaryAction={<IconButton color="error" aria-label="Revoke session" onClick={() => run(() => revokeAdminSession(session.id), 'Administrator revoked the session')}><DeleteOutlineRounded /></IconButton>}><ListItemText primary={`${session.user?.name || 'Unknown user'} · ${session.user?.email || 'No email'}`} secondary={`${session.device || 'Unknown device'} · ${session.ip || 'Unknown IP'} · Last used ${session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString() : 'Unknown'}`} /></ListItem></Box>)}</List>}
          {!adminSessionsLoading && !adminSessions.length && <Typography color="text.secondary" sx={{ py: 2 }}>No active persistent sessions are currently registered.</Typography>}
          {adminSessions.some((session) => session.user?._id) && <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
            {[...new Map(adminSessions.filter((session) => session.user?._id).map((session) => [session.user!._id, session.user])).values()].map((target) => <Button key={target?._id} size="small" color="warning" variant="outlined" onClick={() => target?._id && run(() => revokeAdminUserSessions(target._id), `All sessions for ${target.name || target.email || 'user'} revoked`)}>Revoke {target?.name || target?.email || 'user'} devices</Button>)}
          </Stack>}
        </CardContent></Card>
      </Grid>}
    </Grid>

    <ProfessionalDialog open={passwordDialog} onClose={() => setPasswordDialog(false)} fullWidth maxWidth="sm"><DialogTitle>Change password</DialogTitle><DialogContent dividers><Stack spacing={2}><TextField label="Current password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /><TextField label="New password" type="password" helperText="At least 8 characters with uppercase, lowercase and a number" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></Stack></DialogContent><DialogActions><Button onClick={() => setPasswordDialog(false)}>Cancel</Button><Button variant="contained" onClick={async () => { await run(() => changePassword(currentPassword, newPassword), 'Password changed and other sessions signed out'); setPasswordDialog(false); setCurrentPassword(''); setNewPassword(''); }}>Change password</Button></DialogActions></ProfessionalDialog>

    <ProfessionalDialog open={Boolean(deviceDialog)} onClose={() => !deviceBusy && setDeviceDialog(null)} fullWidth maxWidth="sm"><DialogTitle>{deviceDialog === 'reset' ? 'Reset mobile device unlock' : 'Set up mobile device unlock'}</DialogTitle><DialogContent dividers><Stack spacing={2}><Alert severity={deviceDialog === 'reset' ? 'warning' : 'info'}>{deviceDialog === 'reset' ? 'This removes registered device credentials from SecureAsset. Your phone fingerprint, face or screen lock itself is not changed.' : 'The next step opens your phone or tablet security prompt. Choose the device option offered by Android or iOS. SecureAsset stores only a public key.'}</Alert><TextField autoFocus label="Current password" type="password" value={devicePassword} onChange={(event) => setDevicePassword(event.target.value)} helperText="Required to change vault unlock settings" /></Stack></DialogContent><DialogActions><Button onClick={() => setDeviceDialog(null)} disabled={deviceBusy}>Cancel</Button><Button variant="contained" color={deviceDialog === 'reset' ? 'error' : 'primary'} onClick={() => void completeDeviceAction()} disabled={deviceBusy || devicePassword.length < 8}>{deviceBusy ? 'Verifying…' : deviceDialog === 'reset' ? 'Reset device unlock' : 'Continue to device prompt'}</Button></DialogActions></ProfessionalDialog>

    <ProfessionalDialog open={Boolean(contactType)} onClose={() => !contactBusy && setContactType(null)} fullWidth maxWidth="sm"><DialogTitle>{contactStep === 'otp' ? 'Verify contact change' : `Change ${contactType === 'email' ? 'email' : 'mobile number'}`}</DialogTitle><DialogContent dividers><Stack spacing={2}>{contactStep === 'details' ? <><Alert severity="info">{contactType === 'phone' ? 'The OTP will be sent to the new mobile number.' : 'The OTP will be sent to your current registered mobile number.'}</Alert><TextField autoFocus label={contactType === 'email' ? 'New email address' : 'New 10-digit mobile number'} type={contactType === 'email' ? 'email' : 'tel'} value={contactValue} onChange={(event) => setContactValue(event.target.value)} /><TextField label="Current password" type="password" value={contactPassword} onChange={(event) => setContactPassword(event.target.value)} /></> : <><Alert severity="info">Enter the six-digit OTP sent to the verified mobile number.</Alert><TextField autoFocus label="Verification OTP" value={contactOtp} onChange={(event) => setContactOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputProps={{ inputMode: 'numeric', maxLength: 6 }} /></>}</Stack></DialogContent><DialogActions><Button onClick={() => setContactType(null)} disabled={contactBusy}>Cancel</Button>{contactStep === 'details' ? <Button variant="contained" onClick={() => void requestContactOtp()} disabled={contactBusy || !contactValue || contactPassword.length < 8}>{contactBusy ? 'Sending…' : 'Send OTP'}</Button> : <Button variant="contained" onClick={() => void confirmContactChange()} disabled={contactBusy || contactOtp.length !== 6}>{contactBusy ? 'Verifying…' : 'Verify and update'}</Button>}</DialogActions></ProfessionalDialog>
  </Box>;

  function dataContact(type: ContactType) {
    return type === 'email' ? user?.email || 'Unavailable' : user?.phone || 'Not added';
  }
}

function VerifiedUserIcon() {
  return <ShieldRounded fontSize="small" />;
}
