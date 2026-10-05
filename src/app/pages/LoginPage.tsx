import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControlLabel, IconButton, InputAdornment, Link as MuiLink, Stack,
  TextField, Typography,
} from '@mui/material';
import EmailRounded from '@mui/icons-material/EmailRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import PhoneAndroidRounded from '@mui/icons-material/PhoneAndroidRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import { LogoMark } from '../components/premium/LogoMark';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { acceptTenantInvitation, lookupTenantInvitation, resendRegistrationOtp, sendOtp } from '../services/api';
import '../../styles/login-premium.css';

const demoAccounts = [
  ['Admin', 'admin@secureasset.in'], ['Manager', 'manager@secureasset.in'], ['Tenant / Landlord', 'tenant@secureasset.in'], ['Surveyor', 'surveyor@secureasset.in'],
];
type PublicMode = 'login' | 'register' | 'otp';
type Mode = PublicMode | 'two-factor';

export default function LoginPage({ pageMode = 'login' }: { pageMode?: PublicMode }) {
  const navigate = useNavigate(); const location = useLocation(); const auth = useAuth(); const { data } = useSite();
  const settings = data.settings || {}; const content = settings.authentication || {};
  const showDemoAccounts = Boolean(content.showDemoAccounts) && (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === 'true');
  const modes = useMemo(() => [content.allowPasswordLogin !== false && 'login', content.allowRegistration !== false && 'register', content.allowOtpLogin !== false && 'otp'].filter(Boolean) as PublicMode[], [content]);
  const searchParams = new URLSearchParams(location.search);
  const invitationToken = new URLSearchParams(location.hash.replace(/^#/, '')).get('tenantInvite') || '';
  const requestedAuthMode: PublicMode = modes.includes(pageMode) ? pageMode : (modes[0] || 'login');
  const [mode, setMode] = useState<Mode>(() => requestedAuthMode);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState(showDemoAccounts ? 'admin@secureasset.in' : '');
  const [password, setPassword] = useState(showDemoAccounts ? 'Demo@123' : '');
  const [otp, setOtp] = useState(''); const [otpSent, setOtpSent] = useState(false); const [otpDispatching, setOtpDispatching] = useState(false);
  const [challengeToken, setChallengeToken] = useState(''); const [showPassword, setShowPassword] = useState(false); const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [tenantInvite, setTenantInvite] = useState<Record<string, any> | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loginStep, setLoginStep] = useState<'identifier' | 'password'>('identifier');
  const titles: Record<Mode,string> = { login: content.loginTitle || 'Welcome back', register: content.registerTitle || 'Create your account', otp: content.otpTitle || 'Mobile OTP login', 'two-factor': 'Two-factor verification' };
  const subtitles: Record<Mode,string> = {
    login: content.loginSubtitle || 'Sign in using your email address or mobile number.',
    register: content.registerSubtitle || 'Create an account and verify your mobile number.',
    otp: content.otpSubtitle || 'Receive a secure OTP on your registered mobile.',
    'two-factor': 'Enter an authenticator code or one of your backup codes.',
  };

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
    if (invitationToken) return;
    const nextMode = modes.includes(requestedAuthMode) ? requestedAuthMode : (modes[0] || 'login');
    setMode((current) => current === 'two-factor' ? current : nextMode);
    setOtpSent(false); setOtp(''); setError(''); setMessage(''); setChallengeToken('');
    setLoginStep('identifier');
  }, [invitationToken, modes, requestedAuthMode]);

  function continueToPassword() {
    if (mode !== 'login' || loginStep !== 'identifier') return;
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError('Enter your email address or mobile number to continue.');
      return;
    }
    if (cleanIdentifier !== identifier) setIdentifier(cleanIdentifier);
    setError('');
    setMessage('');
    setLoginStep('password');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(''); setMessage('');
    if (mode === 'login' && loginStep === 'identifier') return;
    setLoading(true);
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
        if (!otpSent && !acceptedTerms) {
          setError('Please agree to the Terms of Service and Privacy Policy to continue.');
          return;
        }
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

  function selectDemo(account: string) { setIdentifier(account); setPassword('Demo@123'); }
  function switchToOtpLogin() {
    if (loading || otpDispatching) return;
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError('Enter your email address or mobile number first.');
      setLoginStep('identifier');
      return;
    }

    if (cleanIdentifier !== identifier) setIdentifier(cleanIdentifier);
    setError('');
    setMessage('Sending OTP…');
    setOtp('');
    setOtpSent(false);
    setMode('otp');
    setOtpDispatching(true);

    void sendOtp({ identifier: cleanIdentifier })
      .then((result) => {
        setOtpSent(true);
        setMessage(result.developmentOtp ? `Development OTP: ${result.developmentOtp}` : result.message || 'OTP sent to the registered mobile.');
      })
      .catch((exception) => {
        setOtpSent(false);
        setMessage('');
        setError((exception as Error).message);
      })
      .finally(() => {
        setOtpDispatching(false);
      });
  }

  function switchToPasswordLogin() {
    setMode('login'); setOtpSent(false); setOtpDispatching(false); setOtp(''); setError(''); setMessage('');
    setLoginStep(identifier.trim() ? 'password' : 'identifier');
  }

  async function resendRegistration() {
    setLoading(true); setError('');
    try { const result = await resendRegistrationOtp(phone); setMessage(result.developmentOtp ? `Development OTP: ${result.developmentOtp}` : result.message || 'OTP resent.'); }
    catch (exception) { setError((exception as Error).message); }
    finally { setLoading(false); }
  }

  const identifierField = <TextField className="sa-login-field" label="Email or mobile number" placeholder="Enter email or mobile number" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required helperText={'\u00a0'} InputProps={{ startAdornment: <InputAdornment position="start"><EmailRounded fontSize="small" /></InputAdornment> }} />;
  const passwordField = (label = 'Password') => <TextField className="sa-login-field" label={label} placeholder={mode === 'register' ? 'Create a strong password' : 'Enter your password'} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required helperText={mode === 'register' ? 'At least 8 characters with uppercase, lowercase and a number.' : '\u00a0'} InputProps={{ startAdornment: <InputAdornment position="start"><LockRounded fontSize="small" /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}</IconButton></InputAdornment> }} />;

  let actionLabel = 'Continue';
  if (mode === 'login') actionLabel = loginStep === 'identifier' ? 'Continue' : 'Sign in';
  if (mode === 'register') actionLabel = otpSent ? 'Verify mobile and create account' : 'Continue';
  if (mode === 'otp') actionLabel = otpDispatching ? 'Sending OTP…' : otpSent ? 'Verify OTP' : 'Continue';
  if (mode === 'two-factor') actionLabel = 'Verify and sign in';

  return <Box className={`sa-login-panel sa-login-panel-${mode}`}>
        <Box className="sa-auth-form-stage">
          <Stack className="sa-login-brand-row" direction="row" justifyContent="space-between" alignItems="center" gap={2}>
            <LogoMark />
            <Chip className="sa-login-access-chip" label={mode === 'register' ? 'New account' : 'Secure access'} size="small" variant="outlined" />
          </Stack>
          <Typography className="sa-login-title">{titles[mode]}</Typography><Typography className="sa-login-subtitle">{mode === 'login' && loginStep === 'password' ? 'Enter your password to securely access your account.' : mode === 'otp' && otpSent ? 'Enter the six-digit OTP sent to your registered mobile.' : subtitles[mode]}</Typography>
          <Box className="sa-auth-feedback-slot" aria-live="polite">{error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}</Box>
          <Box component="form" className="sa-login-form" noValidate onSubmit={submit}><Stack spacing={1.7}>
          {mode === 'login' && <>
            <Box className="sa-login-step-panel" hidden={loginStep !== 'identifier'} aria-hidden={loginStep !== 'identifier'}>
              {identifierField}
            </Box>
            <Box className="sa-login-step-panel" hidden={loginStep !== 'password'} aria-hidden={loginStep !== 'password'}>
              <Box className="sa-login-identity-summary"><Box><Typography className="sa-login-identity-label">Signing in as</Typography><Typography className="sa-login-identity-value">{identifier}</Typography></Box><Button type="button" className="sa-login-change-identity" onClick={() => { setLoginStep('identifier'); setPassword(''); setError(''); setMessage(''); }}>Change</Button></Box>
              {passwordField()}
              <Stack direction="row" justifyContent="flex-end" sx={{ mt: -.65 }}><MuiLink component={RouterLink} className="sa-login-forgot" data-secureasset-forgot-password-link="dedicated-reset-v160" to="/auth/forgot-password" underline="none">Forgot password?</MuiLink></Stack>
            </Box>
          </>}

          {mode === 'register' && !otpSent && <><TextField className="sa-login-field" label="Full name" placeholder="Enter your full name" value={name} onChange={(event) => setName(event.target.value)} required helperText={'\u00a0'} InputProps={{ readOnly: Boolean(invitationToken), startAdornment: <InputAdornment position="start"><PersonRounded fontSize="small" /></InputAdornment> }} /><TextField className="sa-login-field" label="Email address" placeholder="Enter your email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required helperText={'\u00a0'} InputProps={{ readOnly: Boolean(invitationToken), startAdornment: <InputAdornment position="start"><EmailRounded fontSize="small" /></InputAdornment> }} /><TextField className="sa-login-field" label="Mobile number" placeholder="Enter your registered mobile number" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 12))} required helperText="Indian mobile number used for OTP verification." InputProps={{ readOnly: Boolean(invitationToken), startAdornment: <InputAdornment position="start"><PhoneAndroidRounded fontSize="small" /></InputAdornment> }} />{passwordField()}<FormControlLabel className="sa-register-consent" control={<Checkbox checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} size="small" />} label={<Typography component="span">I agree to the <MuiLink href="https://www.ahibi.in/terms" target="_blank" rel="noopener noreferrer" underline="hover">Terms of Service</MuiLink> and <MuiLink href="https://www.ahibi.in/privacy" target="_blank" rel="noopener noreferrer" underline="hover">Privacy Policy</MuiLink></Typography>} /></>}
          {mode === 'register' && otpSent && <><Alert severity="info">Enter the six-digit OTP sent to your mobile. Your account remains inactive until verification succeeds.</Alert><TextField className="sa-login-field" label="6-digit mobile OTP" placeholder="Enter 6-digit OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required helperText={'\u00a0'} inputProps={{ inputMode: 'numeric', maxLength: 6 }} /><Button className="sa-auth-secondary-button" type="button" onClick={resendRegistration} disabled={loading}>Resend OTP</Button></>}

          {mode === 'otp' && !otpSent && !otpDispatching && identifierField}
          {mode === 'otp' && (otpSent || otpDispatching) && <Box className="sa-login-identity-summary"><Box><Typography className="sa-login-identity-label">{otpDispatching ? 'Sending OTP for' : 'OTP sent for'}</Typography><Typography className="sa-login-identity-value">{identifier}</Typography></Box><Button type="button" className="sa-login-change-identity" disabled={otpDispatching} onClick={() => { setOtpSent(false); setOtpDispatching(false); setOtp(''); setError(''); setMessage(''); }}>Change</Button></Box>}
          {mode === 'otp' && (otpSent || otpDispatching) && <TextField className="sa-login-field" label="6-digit OTP" placeholder={otpDispatching ? "Waiting for OTP…" : "Enter 6-digit OTP"} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required disabled={otpDispatching} helperText={'\u00a0'} inputProps={{ inputMode: 'numeric', maxLength: 6 }} />}

          {mode === 'two-factor' && <TextField className="sa-login-field" label="Authenticator or backup code" placeholder="Enter authenticator or backup code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\s/g, '').slice(0, 16))} helperText={'\u00a0'} InputProps={{ startAdornment: <InputAdornment position="start"><SecurityRounded /></InputAdornment> }} required />}
          <Button
            type={mode === 'login' && loginStep === 'identifier' ? 'button' : 'submit'}
            onClick={mode === 'login' && loginStep === 'identifier' ? continueToPassword : undefined}
            className="sa-submit-button"
            variant="contained"
            size="large"
            disabled={loading || otpDispatching || inviteLoading || Boolean(invitationToken && !tenantInvite) || (mode === 'register' && !otpSent && !acceptedTerms) || (mode === 'login' && loginStep === 'identifier' && !identifier.trim()) || (mode === 'otp' && !otpSent && !identifier.trim())}
            disableElevation
          >
            <Box component="span" sx={{ opacity: loading ? 0 : 1, pointerEvents: 'none' }}>{actionLabel}</Box>{loading && <CircularProgress size={22} color="inherit" sx={{ position: 'absolute', left: '50%', top: '50%', ml: '-11px', mt: '-11px' }} />}
          </Button>
          {mode === 'login' && loginStep === 'password' && content.allowOtpLogin !== false && <Button className="sa-auth-switch-method" type="button" onClick={switchToOtpLogin} disabled={loading || otpDispatching}>Login with OTP instead</Button>}
          {mode === 'otp' && <Button className="sa-auth-switch-method" type="button" onClick={switchToPasswordLogin} disabled={loading}>Use password instead</Button>}
          {mode === 'two-factor' && <Button className="sa-auth-secondary-button" type="button" size="small" onClick={() => { setMode('login'); setOtp(''); setError(''); setLoginStep('password'); }}>Return to sign in</Button>}
          </Stack></Box>
          {invitationToken && inviteLoading && <Alert severity="info" sx={{ mb: 2 }}>Checking your tenant invitation…</Alert>}
          {invitationToken && tenantInvite && <Alert severity="info" sx={{ mb: 2 }}>Your landlord has invited you to SecureAsset. Create your password, verify your mobile number, then complete tenant KYC.</Alert>}
          {invitationToken && !inviteLoading && !tenantInvite && <Alert severity="warning" sx={{ mb: 2 }}>This invitation is invalid or expired. Ask the landlord for a new link.</Alert>}
          {invitationToken && mode !== 'two-factor' && <Button className="sa-auth-secondary-button" type="button" size="small" onClick={() => navigate(mode === 'register' ? '/auth/login' : '/auth/register')}>{mode === 'register' ? 'Already have an account? Sign in to accept' : 'Create a tenant account from this invitation'}</Button>}
        </Box>
        {showDemoAccounts && mode !== 'two-factor' && <><Divider sx={{ my: 3 }}>Demo workspaces</Divider><Typography color="text.secondary" sx={{ fontSize: 11.5, mb: 1.5 }}>All demo accounts use <b>Demo@123</b>.</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{demoAccounts.map(([label, account]) => <Chip key={account} clickable label={label} onClick={() => selectDemo(account)} variant="outlined" />)}</Stack></>}
      </Box>
  ;
}
