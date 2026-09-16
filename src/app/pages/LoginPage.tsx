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
import { resendRegistrationOtp, sendOtp } from '../services/api';

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
    const nextMode = requestedAuthMode || (modes.includes(mode) ? mode : modes[0] || 'login');
    if (nextMode !== mode) {
      setMode(nextMode); setOtpSent(false); setOtp(''); setError(''); setMessage(''); setChallengeToken('');
    }
  }, [mode, modes, requestedAuthMode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError(''); setMessage('');
    try {
      if (mode === 'two-factor') { await auth.completeTwoFactor(challengeToken, otp); navigate('/app/dashboard', { replace: true }); return; }
      if (mode === 'login') {
        const result = await auth.login(identifier, password);
        if (result.challenge) { setChallengeToken(result.challenge.challengeToken); setMode('two-factor'); setOtp(''); return; }
        navigate('/app/dashboard', { replace: true }); return;
      }
      if (mode === 'register') {
        if (!otpSent) {
          const challenge = await auth.register({ name, email, phone, password });
          setPhone(challenge.identifier); setOtpSent(true);
          setMessage(challenge.developmentOtp ? `Development OTP: ${challenge.developmentOtp}` : challenge.message || `OTP sent to ${challenge.maskedMobile}.`); return;
        }
        await auth.verifyRegistration(phone, otp); navigate('/app/dashboard', { replace: true }); return;
      }
      if (mode === 'otp') {
        if (!otpSent) {
          const result = await sendOtp({ identifier }); setOtpSent(true);
          setMessage(result.developmentOtp ? `Development OTP: ${result.developmentOtp}` : result.message || 'OTP sent to the registered mobile.'); return;
        }
        const result = await auth.verifyOtp({ identifier, otp });
        if (result.challenge) { setChallengeToken(result.challenge.challengeToken); setMode('two-factor'); setOtp(''); return; }
        navigate('/app/dashboard', { replace: true });
      }
    } catch (exception) { setError((exception as Error).message); }
    finally { setLoading(false); }
  }

  function changeMode(next: Mode) {
    if (location.search) navigate('/login', { replace: true });
    setMode(next); setOtpSent(false); setChallengeToken(''); setOtp(''); setError(''); setMessage('');
  }
  function selectDemo(account: string) { changeMode('login'); setIdentifier(account); setPassword('Demo@123'); }
  async function resendRegistration() {
    setLoading(true); setError('');
    try { const result = await resendRegistrationOtp(phone); setMessage(result.developmentOtp ? `Development OTP: ${result.developmentOtp}` : result.message || 'OTP resent.'); }
    catch (exception) { setError((exception as Error).message); }
    finally { setLoading(false); }
  }

  const identifierField = <TextField label="Email or mobile number" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required InputProps={{ startAdornment: <InputAdornment position="start"><EmailRounded fontSize="small" /></InputAdornment> }} />;
  const passwordField = (label = 'Password') => <TextField label={label} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required helperText={mode === 'register' ? 'At least 8 characters with uppercase, lowercase and a number.' : undefined} InputProps={{ startAdornment: <InputAdornment position="start"><LockRounded fontSize="small" /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}</IconButton></InputAdornment> }} />;

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
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} sx={{ mb: 3 }}>
          <LogoMark />
          <Chip label={mode === 'register' ? 'New account' : 'Secure access'} size="small" variant="outlined" sx={{ borderColor: 'rgba(11,82,112,.25)', color: '#0B5270' }} />
        </Stack>
        <Typography sx={{ fontSize: { xs: 25, sm: 29 }, fontWeight: 900, letterSpacing: '-.045em' }}>{titles[mode]}</Typography><Typography color="text.secondary" sx={{ mt: .8, mb: 3, fontSize: 13.5, lineHeight: 1.7 }}>{subtitles[mode]}</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        <Box component="form" onSubmit={submit}><Stack spacing={2}>
          {mode === 'login' && identifierField}
          {mode === 'login' && passwordField()}
          {mode === 'login' && <Stack direction="row" justifyContent="flex-end" sx={{ mt: -.85 }}><MuiLink data-secureasset-forgot-password-link="dedicated-reset-v160" href="/reset-password" underline="hover" sx={{ color: '#0B6E96', fontSize: 12.2, fontWeight: 750 }}>Forgot password?</MuiLink></Stack>}

          {mode === 'register' && !otpSent && <><TextField label="Full name" value={name} onChange={(event) => setName(event.target.value)} required /><TextField label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required InputProps={{ startAdornment: <InputAdornment position="start"><EmailRounded fontSize="small" /></InputAdornment> }} /><TextField label="Mobile number" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 12))} required helperText="Indian mobile number used for OTP verification." InputProps={{ startAdornment: <InputAdornment position="start"><PhoneAndroidRounded fontSize="small" /></InputAdornment> }} />{passwordField()}</>}
          {mode === 'register' && otpSent && <><Alert severity="info">Enter the six-digit OTP sent to your mobile. Your account remains inactive until verification succeeds.</Alert><TextField label="6-digit mobile OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required inputProps={{ inputMode: 'numeric', maxLength: 6 }} /><Button type="button" onClick={resendRegistration} disabled={loading}>Resend OTP</Button></>}

          {mode === 'otp' && identifierField}
          {mode === 'otp' && otpSent && <TextField label="6-digit OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required inputProps={{ inputMode: 'numeric', maxLength: 6 }} />}

          {mode === 'two-factor' && <TextField label="Authenticator or backup code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\s/g, '').slice(0, 16))} InputProps={{ startAdornment: <InputAdornment position="start"><SecurityRounded /></InputAdornment> }} required />}
          <Button
            type="submit"
            className="sa-submit-button"
            variant="contained"
            size="large"
            disabled={loading}
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
        {mode !== 'two-factor' && <Box component="nav" aria-label="Authentication options" className="sa-auth-mode-nav" sx={{ mt: 3.25, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ mb: 1.1, color: 'text.secondary', fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>Account access</Typography>
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
                sx={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 30,
                  px: .25,
                  color: selected ? '#0B6E96' : '#18282D',
                  fontSize: 13,
                  fontWeight: selected ? 850 : 700,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'color .18s ease',
                  '&:hover': { color: '#0B6E96' },
                  '&:focus-visible': { outline: '2px solid rgba(11,110,150,.3)', outlineOffset: 4, borderRadius: 2 },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    left: 2,
                    right: 2,
                    bottom: 1,
                    height: 2,
                    borderRadius: 2,
                    bgcolor: '#0B6E96',
                    transform: selected ? 'scaleX(1)' : 'scaleX(0)',
                    transformOrigin: 'left center',
                    transition: 'transform .18s ease',
                  },
                }}
              >{modeLabels[item]}</MuiLink>;
            })}
          </Stack>
        </Box>}
        {showDemoAccounts && mode !== 'two-factor' && <><Divider sx={{ my: 3 }}>Demo workspaces</Divider><Typography color="text.secondary" sx={{ fontSize: 11.5, mb: 1.5 }}>All demo accounts use <b>Demo@123</b>.</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{demoAccounts.map(([label, account]) => <Chip key={account} clickable label={label} onClick={() => selectDemo(account)} variant="outlined" />)}</Stack></>}
      </Box>
  </AuthExperience>;
}
