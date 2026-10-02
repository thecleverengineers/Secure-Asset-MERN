import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import EmailRounded from '@mui/icons-material/EmailRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { LogoMark } from '../components/premium/LogoMark';
import { forgotPassword, resetPassword } from '../services/api';
import '../../styles/login-premium.css';

export default function ResetPasswordPage({ intent = 'reset' }: { intent?: 'forgot' | 'reset' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const recoveryState = (location.state || {}) as { identifier?: string; sent?: boolean; message?: string };
  const [identifier, setIdentifier] = useState(() => String(recoveryState.identifier || '')); const [otp, setOtp] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [sent, setSent] = useState(() => Boolean(recoveryState.sent)); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(() => String(recoveryState.message || '')); const [done, setDone] = useState(false); const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!done) return undefined;
    const timer = window.setTimeout(() => navigate('/auth/login?reset=success', { replace: true }), 1800);
    return () => window.clearTimeout(timer);
  }, [done, navigate]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(''); setMessage(''); setLoading(true);
    try {
      if (!sent) {
        const result = await forgotPassword(identifier);
        const nextMessage = result.developmentOtp ? `Development OTP: ${result.developmentOtp}` : result.message || 'A reset OTP has been sent to your registered mobile number.';
        if (intent === 'forgot') {
          navigate('/auth/reset-password', { replace: true, state: { identifier, sent: true, message: nextMessage } });
          return;
        }
        setSent(true); setMessage(nextMessage);
        return;
      }
      if (password !== confirm) throw new Error('Passwords do not match');
      await resetPassword(identifier, otp, password); setDone(true); setMessage('');
    } catch (exception) { setError((exception as Error).message); } finally { setLoading(false); }
  }

  const passwordField = (label: string, value: string, onChange: (value: string) => void) => (
    <TextField
      className="sa-login-field"
      label={label}
      placeholder={label === 'New password' ? 'Create a new password' : 'Re-enter your new password'}
      type={showPassword ? 'text' : 'password'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      helperText={label === 'New password' ? 'At least 8 characters with uppercase, lowercase and a number.' : '\u00a0'}
      required
      InputProps={{
        startAdornment: <InputAdornment position="start"><LockRounded fontSize="small" /></InputAdornment>,
        endAdornment: <InputAdornment position="end"><IconButton type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((current) => !current)}>{showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}</IconButton></InputAdornment>,
      }}
    />
  );

  const title = intent === 'forgot' ? 'Forgot your password?' : 'Reset your password';
  const subtitle = intent === 'forgot'
    ? 'Tell us where to find your account and we will send a secure reset code to its verified mobile number.'
    : 'Enter your email or mobile number, then use the secure reset code sent to the verified mobile number attached to that account.';

  return (
      <Box className={`sa-login-panel sa-reset-panel sa-reset-panel-${intent}`}>
        <Stack className="sa-login-brand-row" direction="row" justifyContent="space-between" alignItems="center" gap={2}>
          <LogoMark />
          <Chip className="sa-login-access-chip" label={intent === 'forgot' ? 'Recovery' : 'Secure reset'} size="small" variant="outlined" />
        </Stack>
        <Typography className="sa-login-title" data-secureasset-reset-password-page="verified-otp-redirect-v160">{title}</Typography>
        <Typography className="sa-login-subtitle">{subtitle}</Typography>
        <Box className="sa-auth-feedback-slot" aria-live="polite">{error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}</Box>

        {done ? (
          <Stack spacing={2}>
            <Alert severity="success">Password reset successfully. Redirecting you to secure sign in…</Alert>
            <Button className="sa-submit-button" component={Link} to="/auth/login?reset=success" variant="contained" size="large">Continue to sign in</Button>
          </Stack>
        ) : (
          <Box component="form" className="sa-login-form sa-reset-form" noValidate onSubmit={submit}>
            <Stack spacing={1.7}>
              <TextField
                className="sa-login-field"
                label="Registered email or mobile"
                placeholder="Enter registered email or mobile"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                disabled={sent}
                required
                helperText={'\u00a0'}
                InputProps={{ startAdornment: <InputAdornment position="start"><EmailRounded fontSize="small" /></InputAdornment> }}
              />
              {sent && <>
                <TextField className="sa-login-field sa-reset-otp" label="6-digit reset OTP" placeholder="Enter 6-digit reset OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required helperText={'\u00a0'} inputProps={{ inputMode: 'numeric', maxLength: 6 }} />
                {passwordField('New password', password, setPassword)}
                {passwordField('Confirm new password', confirm, setConfirm)}
              </>}
              <Button type="submit" className="sa-submit-button" variant="contained" size="large" disabled={loading} sx={{ py: 1.35 }}>
                <Box component="span" sx={{ opacity: loading ? 0 : 1, pointerEvents: 'none' }}>{sent ? 'Reset password' : 'Send reset OTP'}</Box>{loading && <CircularProgress size={22} color="inherit" sx={{ position: 'absolute', left: '50%', top: '50%', ml: '-11px', mt: '-11px' }} />}
              </Button>
              {sent && <Button className="sa-reset-secondary-action sa-auth-secondary-button" type="button" onClick={() => { setSent(false); setOtp(''); setMessage(''); }}>Use another account</Button>}
              <Button className="sa-reset-back-action" type="button" component={Link} to="/auth/login" startIcon={<ArrowBackRounded />}>Return to sign in</Button>
            </Stack>
          </Box>
        )}
      </Box>
  );
}
