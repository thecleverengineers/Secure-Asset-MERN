import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import EmailRounded from '@mui/icons-material/EmailRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import AuthExperience from '../components/auth/AuthExperience';
import { LogoMark } from '../components/premium/LogoMark';
import { forgotPassword, resetPassword } from '../services/api';
import { useSite } from '../context/SiteContext';

export default function ResetPasswordPage() {
  const { data } = useSite();
  const navigate = useNavigate();
  const settings = data.settings || {}; const content = settings.authentication || {};
  const [identifier, setIdentifier] = useState(''); const [otp, setOtp] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [done, setDone] = useState(false); const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!done) return undefined;
    const timer = window.setTimeout(() => navigate('/login?reset=success', { replace: true }), 1800);
    return () => window.clearTimeout(timer);
  }, [done, navigate]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(''); setMessage(''); setLoading(true);
    try {
      if (!sent) {
        const result = await forgotPassword(identifier); setSent(true);
        setMessage(result.developmentOtp ? `Development OTP: ${result.developmentOtp}` : result.message || 'A reset OTP has been sent to your registered mobile number.');
        return;
      }
      if (password !== confirm) throw new Error('Passwords do not match');
      await resetPassword(identifier, otp, password); setDone(true); setMessage('');
    } catch (exception) { setError((exception as Error).message); } finally { setLoading(false); }
  }

  const passwordField = (label: string, value: string, onChange: (value: string) => void) => (
    <TextField
      label={label}
      type={showPassword ? 'text' : 'password'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      helperText={label === 'New password' ? 'At least 8 characters with uppercase, lowercase and a number.' : undefined}
      required
      InputProps={{
        startAdornment: <InputAdornment position="start"><LockRounded fontSize="small" /></InputAdornment>,
        endAdornment: <InputAdornment position="end"><IconButton type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((current) => !current)}>{showPassword ? <VisibilityOffRounded /> : <VisibilityRounded />}</IconButton></InputAdornment>,
      }}
    />
  );

  return (
    <AuthExperience
      eyebrow={content.badge || 'Account recovery'}
      title={content.forgotTitle || 'Regain access with confidence.'}
      description={content.forgotSubtitle || 'Use the verified mobile number on your account to reset your password. Your property information, documents and payment records remain protected.'}
    >
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} sx={{ mb: 3 }}>
          <LogoMark />
          <Chip label="Secure reset" size="small" variant="outlined" sx={{ borderColor: 'rgba(11,82,112,.25)', color: '#0B5270' }} />
        </Stack>
        <Typography data-secureasset-reset-password-page="verified-otp-redirect-v160" sx={{ fontSize: { xs: 25, sm: 29 }, fontWeight: 900, letterSpacing: '-.045em' }}>Reset your password</Typography>
        <Typography color="text.secondary" sx={{ mt: .8, mb: 3, fontSize: 13.5, lineHeight: 1.7 }}>
          Enter your email or mobile number. We will send the OTP only to the verified mobile number attached to that account.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

        {done ? (
          <Stack spacing={2}>
            <Alert severity="success">Password reset successfully. Redirecting you to secure sign in…</Alert>
            <Button component={Link} to="/login?reset=success" variant="contained" size="large">Continue to sign in</Button>
          </Stack>
        ) : (
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2}>
              <TextField
                label="Registered email or mobile"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                disabled={sent}
                required
                InputProps={{ startAdornment: <InputAdornment position="start"><EmailRounded fontSize="small" /></InputAdornment> }}
              />
              {sent && <>
                <TextField label="6-digit reset OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required inputProps={{ inputMode: 'numeric', maxLength: 6 }} />
                {passwordField('New password', password, setPassword)}
                {passwordField('Confirm new password', confirm, setConfirm)}
              </>}
              <Button type="submit" className="sa-submit-button" variant="contained" size="large" disabled={loading} sx={{ py: 1.35 }}>
                {loading ? <CircularProgress size={22} color="inherit" /> : sent ? 'Reset password' : 'Send reset OTP'}
              </Button>
              {sent && <Button type="button" onClick={() => { setSent(false); setOtp(''); setMessage(''); }} sx={{ alignSelf: 'flex-start' }}>Use another account</Button>}
              <Button type="button" component={Link} to="/login" startIcon={<ArrowBackRounded />} sx={{ alignSelf: 'flex-start', color: '#0B5270' }}>Return to sign in</Button>
            </Stack>
          </Box>
        )}
      </Box>
    </AuthExperience>
  );
}
