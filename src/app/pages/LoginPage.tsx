import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, InputAdornment, Link as MuiLink, Stack,
  TextField, Typography,
} from '@mui/material';
import EmailRounded from '@mui/icons-material/EmailRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import PhoneAndroidRounded from '@mui/icons-material/PhoneAndroidRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import { LogoMark } from '../components/premium/LogoMark';
import AuthExperience from '../components/auth/AuthExperience';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { acceptTenantInvitation, lookupTenantInvitation, resendRegistrationOtp, sendOtp } from '../services/api';
import '../../styles/login-premium.css';

const demoAccounts = [
  ['Admin', 'admin@secureasset.in'], ['Manager', 'manager@secureasset.in'], ['Tenant / Landlord', 'tenant@secureasset.in'], ['Surveyor', 'surveyor@secureasset.in'],
];
type Mode = 'login' | 'register' | 'otp' | 'two-factor';

export default function LoginPage() {
  const navigate = useNavigate(); const location = useLocation(); const auth = useAuth(); const { data } = useSite();
  const settings = data.settings || {}; const content = settings.authentication || {};
  const appHeaderColor = settings.design?.colors?.navigation || '#0B5270';
  const showDemoAccounts = Boolean(content.showDemoAccounts) && (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === 'true');
  const modes = useMemo(() => [content.allowPasswordLogin !== false && 'login', content.allowRegistration !== false && 'register', content.allowOtpLogin !== false && 'otp'].filter(Boolean) as Mode[], [content]);
  const searchParams = new URLSearchParams(location.search);
  const invitationToken = new URLSearchParams(location.hash.replace(/^#/, '')).get('tenantInvite') || '';
  const requestedMode = searchParams.get('mode');
  const requestedAuthMode = requestedMode === 'register' && modes.includes('register')
    ? 'register'
    : modes.includes(requestedMode as Mode) ? requestedMode as Mode : null;
  const [mode, setMode] = useState<Mode>(() => requestedAuthMode || modes[0] || 'login');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState(showDemoAccounts ? 'admin@secureasset.in' : '');
  const [password, setPassword] = useState(showDemoAccounts ? 'Demo@123' : '');
  const [otp, setOtp] = useState(''); const [otpSent, setOtpSent] = useState(false);
  const [challengeToken, setChallengeToken] = useState(''); const [showPassword, setShowPassword] = useState(false); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [tenantInvite, setTenantInvite] = useState<Record<string, any> | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const authNavigationModes = modes;
  const modeLabels: Record<Mode, string> = { login: 'Login', register: 'Register', otp: 'OTP login', 'two-factor': 'Two-factor verification' };
  const titles: Record<Mode,string> = { login: content.loginTitle || 'Welcome back', register: content.registerTitle || 'Create your account', otp: content.otpTitle || 'Mobile OTP login', 'two-factor': 'Two-factor verification' };
  const subtitles: Record<Mode,string> = {
    login: content.loginSubtitle || 'Sign in using your email address or mobile number.',
    register: content.registerSubtitle || 'Create an account and verify your mobile number.',
    otp: content.otpSubtitle || 'Receive a secure OTP on your registered mobile.',
    'two-factor': 'Enter an authenticator code or one of your backup codes.',
  };

  useEffect(() => {
    if (requestedMode === 'forgot') navigate('/reset-password', { replace: true });
  }, [navigate, requestedMode]);

  useEffect(() => {
    if (searchParams.get('reset') === 'success') {
      setError('');
      setMessage('Password reset successfully. Sign in with your new password.');
    }
  }, [location.search]);

  useEffect(() => {
    if (!invitationToken) { setTenantInvite(null); return; }
    let current = true;
    setMode('register'); setOtpSent(false); setOtp(''); setError(''); setInviteLoading(true);
    lookupTenantInvitation(invitationToken)
      .then((result) => {
        if (!current) return;
        const invite = result.data || null;
        setTenantInvite(invite);
        setName(String(invite?.name || ''));
        setEmail(String(invite?.email || ''));
        setPhone(String(invite?.phone || ''));
        setIdentifier(String(invite?.email || ''));
        setMessage('Create a password, verify your mobile number with OTP, then complete tenant KYC.');
      })
      .catch((exception) => { if (current) { setTenantInvite(null); setError((exception as Error).message); } })
      .finally(() => { if (current) setInviteLoading(false); });
    return () => { current = false; };
  }, [invitationToken]);

  useEffect(() => {
    if (mode === 'two-factor') return;
    const nextMode = invitationToken ? (modes.includes(mode) ? mode : 'register') : requestedAuthMode || (modes.includes(mode) ? mode : modes[0] || 'login');
    if (nextMode !== mode) {
      setMode(nextMode); setOtpSent(false); setOtp(''); setError(''); setMessage(''); setChallengeToken('');
    }
  }, [invitationToken, mode, modes, requestedAuthMode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError(''); setMessage('');
    try {
      if (mode === 'two-factor') {
        const signedIn = await auth.completeTwoFactor(challengeToken, otp);
        if (invitationToken) { await acceptTenantInvitation(invitationToken); navigate(signedIn.kycStatus === 'verified' ? '/app/dashboard' : '/app/tenant-kyc?required=complete', { replace: true }); }
        else navigate('/app/dashboard', { replace: true });
        return;
      }
      if (mode === 'login') {
        const result = await auth.login(identifier, password);
        if (result.challenge) { setChallengeToken(result.challenge.challengeToken); setMode('two-factor'); setOtp(''); return; }
        if (invitationToken) { await acceptTenantInvitation(invitationToken); navigate(result.user?.kycStatus === 'verified' ? '/app/dashboard' : '/app/tenant-kyc?required=complete', { replace: true }); return; }
        navigate('/app/dashboard', { replace: true }); return;
      }
      if (mode === 'register') {
        if (!otpSent) {
          const challenge = await auth.register({ name, email, phone, password, invitationToken: invitationToken || undefined });
          setPhone(challenge.identifier); setOtpSent(true);
          setMessage(challenge.developmentOtp ? `Development OTP: ${challenge.developmentOtp}` : challenge.message || `OTP sent to ${challenge.maskedMobile}.`); return;
        }
        await auth.verifyRegistration(phone, otp); navigate(invitationToken ? '/app/tenant-kyc?required=complete' : '/app/dashboard', { replace: true }); return;
      }
      if (mode === 'otp') {
        if (!otpSent) {
          const result = await sendOtp({ identifier }); setOtpSent(true);
          setMessage(result.developmentOtp ? `Development OTP: ${result.developmentOtp}` : result.message || 'OTP sent to the registered mobile.'); return;
        }
        const result = await auth.verifyOtp({ identifier, otp });
        if (result.challenge) { setChallengeToken(result.challenge.challengeToken); setMode('two-factor'); setOtp(''); return; }
        if (invitationToken) { await acceptTenantInvitation(invitationToken); navigate(result.user?.kycStatus === 'verified' ? '/app/dashboard' : '/app/tenant-kyc?required=complete', { replace: true }); return; }
        navigate('/app/dashboard', { replace: true });
      }
    } catch (exception) { setError((exception as Error).message); }
    finally { setLoading(false); }
  }

  function changeMode(next: Mode) {
    navigate({ pathname: '/login', search: '?mode=' + next, hash: location.hash }, { replace: true });
    setMode(next); setOtpSent(false); setChallengeToken(''); setOtp(''); setError(''); setMessage('');
  }
  function selectDemo(account: string) { changeMode('login'); setIdentifier(account); setPassword('Demo@123'); }
  async function resendRegistration() {
    setLoading(true); setError('');
    try { const result = await resendRegistrationOtp(phone); setMessage(result.developmentOtp ? `Development OTP: ${result.developmentOtp}` : result.message || 'OTP resent.'); }
    catch (exception) { setError((exception as Error).message); }
    finally { setLoading(false); }
  }

  const identifierField = <TextField className="sa-login-field" label="Email or mobile number" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required InputProps={{ startAdornment: <InputAdornment position="start"><EmailRounded fontSize="small" /></InputAdornment> }} />;
  const passwordField = (label = 'Password') => <TextField className="sa-login-field" label={label} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required helperText={mode === 'register' ? 'At least 8 characters with uppercase, lowercase and a number.' : undefined} InputProps={{ startAdornment: <InputAdornment position="start"><LockRounded fontSize="small" /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}</IconButton></InputAdornment> }} />;

  let actionLabel = 'Continue';
  if (mode === 'login') actionLabel = 'Sign in';
  if (mode === 'register') actionLabel = otpSent ? 'Verify mobile and create account' : 'Send verification OTP';
  if (mode === 'otp') actionLabel = otpSent ? 'Verify OTP' : 'Send OTP';
  if (mode === 'two-factor') actionLabel = 'Verify and sign in';

  return <AuthExperience
    eyebrow={content.badge || 'Secure property access'}
    title={content.headline || 'Every property workflow. One trusted space.'}
    description={content.description || settings.description || 'Bring properties, tenancy, payments, surveys and important records together in one professionally managed place.'}
  >
      <Box className="sa-login-panel">
        <Stack className="sa-login-brand-row" direction="row" justifyContent="space-between" alignItems="center" gap={2}>
          <LogoMark />
          <Chip className="sa-login-access-chip" label={mode === 'register' ? 'New account' : 'Secure access'} size="small" variant="outlined" />
        </Stack>
        <Typography className="sa-login-title">{titles[mode]}</Typography><Typography className="sa-login-subtitle">{subtitles[mode]}</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        <Box component="form" className="sa-login-form" onSubmit={submit}><Stack spacing={1.7}>
          {mode === 'login' && identifierField}
          {mode === 'login' && passwordField()}
          {mode === 'login' && <Stack direction="row" justifyContent="flex-end" sx={{ mt: -.65 }}><MuiLink className="sa-login-forgot" data-secureasset-forgot-password-link="dedicated-reset-v160" href="/reset-password" underline="hover">Forgot password?</MuiLink></Stack>}

          {mode === 'register' && !otpSent && <><TextField className="sa-login-field" label="Full name" value={name} onChange={(event) => setName(event.target.value)} required InputProps={{ readOnly: Boolean(invitationToken) }} /><TextField className="sa-login-field" label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required InputProps={{ readOnly: Boolean(invitationToken), startAdornment: <InputAdornment position="start"><EmailRounded fontSize="small" /></InputAdornment> }} /><TextField className="sa-login-field" label="Mobile number" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 12))} required helperText="Indian mobile number used for OTP verification." InputProps={{ readOnly: Boolean(invitationToken), startAdornment: <InputAdornment position="start"><PhoneAndroidRounded fontSize="small" /></InputAdornment> }} />{passwordField()}</>}
          {mode === 'register' && otpSent && <><Alert severity="info">Enter the six-digit OTP sent to your mobile. Your account remains inactive until verification succeeds.</Alert><TextField className="sa-login-field" label="6-digit mobile OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required inputProps={{ inputMode: 'numeric', maxLength: 6 }} /><Button type="button" onClick={resendRegistration} disabled={loading}>Resend OTP</Button></>}

          {mode === 'otp' && identifierField}
          {mode === 'otp' && otpSent && <TextField className="sa-login-field" label="6-digit OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required inputProps={{ inputMode: 'numeric', maxLength: 6 }} />}

          {mode === 'two-factor' && <TextField className="sa-login-field" label="Authenticator or backup code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\s/g, '').slice(0, 16))} InputProps={{ startAdornment: <InputAdornment position="start"><SecurityRounded /></InputAdornment> }} required />}
          <Button
            type="submit"
            className="sa-submit-button"
            variant="contained"
            size="large"
            disabled={loading || inviteLoading || Boolean(invitationToken && !tenantInvite)}
            disableElevation
            sx={{
              py: 1.45,
              fontWeight: 800,
              bgcolor: appHeaderColor,
              color: '#FFFFFF',
              '&:hover': { bgcolor: appHeaderColor, filter: 'brightness(.9)' },
              '&:active': { filter: 'brightness(.82)' },
              '&:focus-visible': { outline: '3px solid rgba(11,82,112,.28)', outlineOffset: 2 },
              '&.Mui-disabled': { bgcolor: 'rgba(11,82,112,.48)', color: 'rgba(255,255,255,.92)' },
            }}
          >
            {loading ? <CircularProgress size={22} color="inherit" /> : actionLabel}
          </Button>
          {mode === 'two-factor' && <Button type="button" size="small" onClick={() => changeMode('login')}>Return to sign in</Button>}
        </Stack></Box>
        {invitationToken && inviteLoading && <Alert severity="info" sx={{ mb: 2 }}>Checking your tenant invitation…</Alert>}
        {invitationToken && tenantInvite && <Alert severity="info" sx={{ mb: 2 }}>Your landlord has invited you to SecureAsset. Create your password, verify your mobile number, then complete tenant KYC.</Alert>}
        {invitationToken && !inviteLoading && !tenantInvite && <Alert severity="warning" sx={{ mb: 2 }}>This invitation is invalid or expired. Ask the landlord for a new link.</Alert>}
        {invitationToken && mode !== 'two-factor' && <Button type="button" size="small" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setOtpSent(false); setOtp(''); setError(''); setMessage(''); }}>{mode === 'register' ? 'Already have an account? Sign in to accept' : 'Create a tenant account from this invitation'}</Button>}
        {mode !== 'two-factor' && !invitationToken && <Box component="nav" aria-label="Authentication options" className="sa-auth-mode-nav sa-login-mode-nav">
          <Typography className="sa-login-mode-label">Account access</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: .7 }}>
            {authNavigationModes.map((item) => {
              const selected = mode === item;
              const href = item === 'login' ? '/login' : `/login?mode=${item}`;
              return <MuiLink
                key={item}
                href={href}
                underline="none"
                aria-current={selected ? 'page' : undefined}
                onClick={(event) => { event.preventDefault(); changeMode(item); }}
                className={selected ? 'sa-login-mode-link is-active' : 'sa-login-mode-link'}
                sx={{
                  color: selected ? '#0B6E96' : '#18282D',
                  '&:hover': { color: '#0B6E96' },
                }}
              >{modeLabels[item]}</MuiLink>;
            })}
          </Stack>
        </Box>}
        {showDemoAccounts && mode !== 'two-factor' && <><Divider sx={{ my: 3 }}>Demo workspaces</Divider><Typography color="text.secondary" sx={{ fontSize: 11.5, mb: 1.5 }}>All demo accounts use <b>Demo@123</b>.</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{demoAccounts.map(([label, account]) => <Chip key={account} clickable label={label} onClick={() => selectDemo(account)} variant="outlined" />)}</Stack></>}
      </Box>
  </AuthExperience>;
}
