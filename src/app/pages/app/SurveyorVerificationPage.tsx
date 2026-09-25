import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert, Avatar, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControlLabel,
  Grid, MenuItem, Paper, Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import BadgeRounded from '@mui/icons-material/BadgeRounded';
import WorkRounded from '@mui/icons-material/WorkRounded';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import ContactPhoneRounded from '@mui/icons-material/ContactPhoneRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import {
  getSurveyorVerification, requestSurveyorVerificationOtp, saveSurveyorVerification,
  submitSurveyorVerification, uploadSurveyorVerificationAsset, uploadSurveyorVerificationDocument,
  verifySurveyorVerificationOtp,
} from '../../services/api';
import { useActionDialog } from '../../components/shared/useActionDialog';
import LocationFields from '../../components/shared/LocationFields';

const ID_TYPES = [
  ['aadhaar', 'Aadhaar'],
  ['pan', 'PAN'],
  ['voter_id', 'Voter ID'],
  ['driving_licence', 'Driving Licence'],
] as const;

const BANKS = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Punjab National Bank',
  'Bank of Baroda', 'Canara Bank', 'Union Bank of India', 'Bank of India', 'Indian Bank',
  'Central Bank of India', 'Indian Overseas Bank', 'UCO Bank', 'Bank of Maharashtra',
  'IDBI Bank', 'Kotak Mahindra Bank', 'IndusInd Bank', 'Yes Bank', 'Federal Bank',
  'IDFC FIRST Bank', 'Bandhan Bank', 'AU Small Finance Bank', 'Other',
];

const EXPERIENCE_OPTIONS = [0,1,2,3,4,5,6,7,8,9,10,12,15,20,25,30,35,40];

const initialForm = {
  legalName: '',
  profilePhoto: '',
  dateOfBirth: '',
  gender: '',
  address: { line1: '', city: '', state: '', country: 'India', postalCode: '' },
  phone: '',
  email: '',
  identityVerification: { idType: '', idNumber: '', frontFile: '', frontUrl: '', backFile: '', backUrl: '' },
  occupation: '',
  yearsExperience: '',
  serviceArea: '',
  professionalDescription: '',
  bankDetails: { bankName: '', ifsc: '', accountNumber: '', passbookFile: '', passbookUrl: '' },
  declaration: { accepted: false },
};

function SectionTitle({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  const Icon = icon;
  return <Stack direction="row" spacing={1.2} alignItems="flex-start">
    <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,143,131,.08)', color: '#087f76', flexShrink: 0 }}>
      <Icon sx={{ fontSize: 19 }} />
    </Box>
    <Box>
      <Typography sx={{ color: '#16385b', fontSize: 14, fontWeight: 600 }}>{title}</Typography>
      <Typography sx={{ color: '#7287a4', fontSize: 10.5, mt: .25 }}>{subtitle}</Typography>
    </Box>
  </Stack>;
}

function UploadField({
  label, file, existing, onChange, required = false,
  disabled = false,
}: { label: string; file: File | null; existing?: string; onChange: (file: File | null) => void; required?: boolean; disabled?: boolean }) {
  return <Box>
    <Typography sx={{ fontSize: 10, color: '#607793', mb: .7 }}>{label}{required ? ' *' : ''}</Typography>
    <Button component="label" variant="outlined" size="small" disabled={disabled} sx={{ borderRadius: 2, textTransform: 'none', fontSize: 10, minHeight: 38 }}>
      {file ? file.name : existing ? 'Replace uploaded image' : 'Choose image'}
      <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onChange(event.target.files?.[0] || null)} />
    </Button>
    {(file || existing) && <Typography sx={{ mt: .6, fontSize: 9.5, color: '#7487a2' }}>{file ? file.name : 'Uploaded securely'}</Typography>}
  </Box>;
}

export default function SurveyorVerificationPage() {
  const actions = useActionDialog();
  const [form, setForm] = useState<any>(initialForm);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [identityFront, setIdentityFront] = useState<File | null>(null);
  const [identityBack, setIdentityBack] = useState<File | null>(null);
  const [passbookFile, setPassbookFile] = useState<File | null>(null);
  const [otp, setOtp] = useState('');
  const [mobileVerified, setMobileVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const locked = ['submitted', 'under_review', 'verified'].includes(String(form.status || ''));
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await getSurveyorVerification();
      const value = response.data || {};
      setForm({
        ...initialForm,
        ...value,
        dateOfBirth: value.dateOfBirth ? String(value.dateOfBirth).slice(0, 10) : '',
        address: { ...initialForm.address, ...(value.address || {}) },
        identityVerification: { ...initialForm.identityVerification, ...(value.identityVerification || {}) },
        bankDetails: { ...initialForm.bankDetails, ...(value.bankDetails || {}) },
        declaration: { ...initialForm.declaration, ...(value.declaration || {}) },
      });
      setMobileVerified(Boolean(value.mobileVerified));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function update(path: string, value: any) {
    setForm((current: any) => {
      const next = structuredClone(current);
      const keys = path.split('.');
      let cursor = next;
      keys.slice(0, -1).forEach((key) => { cursor[key] ||= {}; cursor = cursor[key]; });
      cursor[keys.at(-1)!] = value;
      return next;
    });
  }

  function payload() {
    return {
      legalName: String(form.legalName || '').trim(),
      profilePhoto: form.profilePhoto || '',
      dateOfBirth: form.dateOfBirth || '',
      gender: form.gender || '',
      address: {
        line1: String(form.address?.line1 || '').trim(),
        city: String(form.address?.city || '').trim(),
        state: String(form.address?.state || '').trim(),
        country: String(form.address?.country || 'India').trim(),
        postalCode: String(form.address?.postalCode || '').replace(/\D/g, '').slice(0, 6),
      },
      phone: String(form.phone || '').replace(/\D/g, '').slice(-10),
      email: String(form.email || '').trim().toLowerCase(),
      identityVerification: {
        idType: form.identityVerification?.idType || '',
        idNumber: String(form.identityVerification?.idNumber || '').trim(),
        frontFile: form.identityVerification?.frontFile || undefined,
        frontUrl: form.identityVerification?.frontUrl || undefined,
        backFile: form.identityVerification?.backFile || undefined,
        backUrl: form.identityVerification?.backUrl || undefined,
      },
      occupation: String(form.occupation || '').trim(),
      yearsExperience: form.yearsExperience === '' ? undefined : Number(form.yearsExperience),
      serviceArea: String(form.serviceArea || '').trim(),
      professionalDescription: String(form.professionalDescription || '').trim(),
      bankDetails: {
        bankName: String(form.bankDetails?.bankName || '').trim(),
        ifsc: String(form.bankDetails?.ifsc || '').trim().toUpperCase(),
        accountNumber: String(form.bankDetails?.accountNumber || '').replace(/\D/g, ''),
        passbookFile: form.bankDetails?.passbookFile || undefined,
        passbookUrl: form.bankDetails?.passbookUrl || undefined,
      },
      declaration: { accepted: Boolean(form.declaration?.accepted) },
    };
  }

  async function preparePayload() {
    const data: any = payload();
    if (avatarFile) {
      const uploaded = await uploadSurveyorVerificationAsset(avatarFile);
      data.profilePhoto = uploaded.data.url;
    }
    if (identityFront) {
      const uploaded = await uploadSurveyorVerificationDocument(identityFront, 'identity_front');
      data.identityVerification.frontFile = uploaded.data.driveFile;
      data.identityVerification.frontUrl = uploaded.data.url;
    }
    if (identityBack) {
      const uploaded = await uploadSurveyorVerificationDocument(identityBack, 'identity_back');
      data.identityVerification.backFile = uploaded.data.driveFile;
      data.identityVerification.backUrl = uploaded.data.url;
    }
    if (passbookFile) {
      const uploaded = await uploadSurveyorVerificationDocument(passbookFile, 'bank_passbook');
      data.bankDetails.passbookFile = uploaded.data.driveFile;
      data.bankDetails.passbookUrl = uploaded.data.url;
    }
    return data;
  }

  function clearPendingFiles() {
    setAvatarFile(null);
    setIdentityFront(null);
    setIdentityBack(null);
    setPassbookFile(null);
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (locked) return;
    setBusy(true); setError('');
    try {
      const data = await preparePayload();
      await saveSurveyorVerification(data);
      clearPendingFiles();
      setNotice('Verification draft saved securely');
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function requestOtp() {
    const mobile = String(form.phone || '').replace(/\D/g, '').slice(-10);
    if (mobile.length !== 10) { setError('Enter a valid 10-digit mobile number'); return; }
    setOtpBusy(true); setError('');
    try {
      await requestSurveyorVerificationOtp(mobile);
      setOtpSent(true);
      setMobileVerified(false);
      setNotice('OTP sent to your mobile number');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyOtp() {
    const mobile = String(form.phone || '').replace(/\D/g, '').slice(-10);
    if (!/^\d{6}$/.test(otp)) { setError('Enter the six-digit OTP'); return; }
    setOtpBusy(true); setError('');
    try {
      await verifySurveyorVerificationOtp(mobile, otp);
      setMobileVerified(true);
      setOtp('');
      setNotice('Mobile number verified');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setOtpBusy(false);
    }
  }

  async function submit() {
    if (!form.declaration?.accepted) {
      setError('Accept the declaration before submitting for review');
      return;
    }
    if (!await actions.askConfirmation('Submit this profile verification for administrator review?', { title: 'Submit verification' })) return;
    setBusy(true); setError('');
    try {
      const data = await preparePayload();
      await saveSurveyorVerification(data);
      clearPendingFiles();
      await submitSurveyorVerification();
      setNotice('Verification submitted for review');
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Box sx={{ p: 10, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  const sectionSx = {
    p: { xs: 2, md: 2.5 },
    border: '1px solid #e1ebf4',
    borderRadius: 3,
    boxShadow: '0 6px 18px rgba(17,58,93,.04)',
    bgcolor: '#fff',
  };

  return <Box sx={{ px: { xs: 1.5, sm: 3, lg: 4 }, pb: 7, fontFamily: "'Open Sans', sans-serif" }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2.5 }}>
      <Box>
        <Typography component="h1" sx={{ color: '#102f52', fontSize: { xs: 25, md: 31 }, fontWeight: 600, letterSpacing: '-.04em' }}>Surveyor Profile Verification</Typography>
        <Typography sx={{ color: '#7186a2', fontSize: 11, mt: .5 }}>Complete your identity and professional information, verify your mobile number, and submit it for administrator review.</Typography>
      </Box>
      <Chip
        icon={<FactCheckRounded />}
        label={String(form.status || 'not submitted').replaceAll('_', ' ')}
        color={form.status === 'verified' ? 'success' : form.status === 'rejected' ? 'error' : 'warning'}
        sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, textTransform: 'capitalize', fontSize: 10 }}
      />
    </Stack>

    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {form.reviewerNotes && <Alert severity="info" sx={{ mb: 2 }}>Reviewer note: {form.reviewerNotes}</Alert>}
    {form.rejectionReason && <Alert severity="error" sx={{ mb: 2 }}>Reason: {form.rejectionReason}</Alert>}

    <Stack component="form" onSubmit={save} spacing={2}>
      <Paper elevation={0} sx={sectionSx}>
        <SectionTitle icon={PersonRounded} title="Basic Profile" subtitle="Your personal information used for verification." />
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField fullWidth size="small" label="Full name" value={form.legalName || ''} onChange={(e) => update('legalName', e.target.value)} disabled={locked} required />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" type="date" label="Date of birth" value={form.dateOfBirth || ''} onChange={(e) => update('dateOfBirth', e.target.value)} disabled={locked} required InputLabelProps={{ shrink: true }} inputProps={{ max: today }} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ sm: 'center' }}>
              <Avatar src={avatarFile ? URL.createObjectURL(avatarFile) : form.profilePhoto} sx={{ width: 64, height: 64 }} />
              <Button component="label" variant="outlined" startIcon={<PhotoCameraRounded />} disabled={locked} sx={{ textTransform: 'none', borderRadius: 2 }}>
                {form.profilePhoto ? 'Replace profile photo' : 'Upload profile photo'}
                <input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} />
              </Button>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Gender" value={form.gender || ''} onChange={(e) => update('gender', e.target.value)} disabled={locked} required>
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
              <MenuItem value="other">Other</MenuItem>
              <MenuItem value="prefer_not_to_say">Prefer not to say</MenuItem>
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField fullWidth size="small" label="Address" value={form.address?.line1 || ''} onChange={(e) => update('address.line1', e.target.value)} disabled={locked} required />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <LocationFields
              value={{ country: form.address?.country, state: form.address?.state, city: form.address?.city }}
              disabled={locked}
              required={{ country: true, state: true, city: true }}
              onChange={(next) => {
                update('address.country', next.country || 'India');
                update('address.state', next.state || '');
                update('address.city', next.city || '');
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth size="small" label="PIN code" inputProps={{ inputMode: 'numeric' }} value={form.address?.postalCode || ''} onChange={(e) => update('address.postalCode', e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={locked} required />
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={sectionSx}>
        <SectionTitle icon={ContactPhoneRounded} title="Contact Verification" subtitle="Verify your mobile number using the administrator-configured Fast2SMS service." />
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 7 }}>
            <TextField
              fullWidth size="small" label="Mobile number" inputProps={{ inputMode: 'numeric' }}
              value={form.phone || ''}
              onChange={(e) => { update('phone', e.target.value.replace(/\D/g, '').slice(-10)); setMobileVerified(false); setOtpSent(false); }}
              disabled={locked} required
              InputProps={{ endAdornment: mobileVerified ? <VerifiedRounded color="success" sx={{ fontSize: 19 }} /> : undefined }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Button fullWidth variant={mobileVerified ? 'outlined' : 'contained'} disabled={locked || otpBusy || mobileVerified} onClick={() => void requestOtp()} sx={{ minHeight: 40, textTransform: 'none', borderRadius: 2 }}>
              {mobileVerified ? 'Mobile verified' : otpSent ? 'Resend OTP' : 'Send OTP'}
            </Button>
          </Grid>
          {!mobileVerified && otpSent && <>
            <Grid size={{ xs: 12, md: 7 }}>
              <TextField fullWidth size="small" label="6-digit OTP" inputProps={{ inputMode: 'numeric' }} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={otpBusy || locked} />
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Button fullWidth variant="outlined" disabled={otpBusy || locked || otp.length !== 6} onClick={() => void verifyOtp()} sx={{ minHeight: 40, textTransform: 'none', borderRadius: 2 }}>Verify OTP</Button>
            </Grid>
          </>}
          <Grid size={12}>
            <TextField fullWidth size="small" type="email" label="Email address" value={form.email || ''} onChange={(e) => update('email', e.target.value)} disabled={locked} required />
          </Grid>
          <Grid size={12}>
            <Alert severity={mobileVerified ? 'success' : 'info'} sx={{ py: .2 }}>
              {mobileVerified ? 'Mobile OTP verified.' : 'Mobile verification is required before you can submit this profile for review.'}
            </Alert>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={sectionSx}>
        <SectionTitle icon={BadgeRounded} title="Identity Verification" subtitle="Choose at least one government ID and upload its protected image." />
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Government ID type" value={form.identityVerification?.idType || ''} onChange={(e) => update('identityVerification.idType', e.target.value)} disabled={locked} required>
              {ID_TYPES.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth size="small" label="ID number" value={form.identityVerification?.idNumber || ''} onChange={(e) => update('identityVerification.idNumber', e.target.value)} disabled={locked} required />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <UploadField label="Front image" file={identityFront} existing={form.identityVerification?.frontUrl} onChange={setIdentityFront} required disabled={locked} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <UploadField label="Back image (where applicable)" file={identityBack} existing={form.identityVerification?.backUrl} onChange={setIdentityBack} disabled={locked} />
          </Grid>
          <Grid size={12}><Alert severity="info" sx={{ py: .2 }}>Government-ID images are stored as private verification documents and are not published with your public Surveyor profile.</Alert></Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={sectionSx}>
        <SectionTitle icon={WorkRounded} title="Professional Information" subtitle="Tell clients and reviewers about your professional work." />
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth size="small" label="Occupation / profession" value={form.occupation || ''} onChange={(e) => update('occupation', e.target.value)} disabled={locked} required />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Years of experience" value={form.yearsExperience ?? ''} onChange={(e) => update('yearsExperience', Number(e.target.value))} disabled={locked} required>
              {EXPERIENCE_OPTIONS.map((year) => <MenuItem key={year} value={year}>{year === 40 ? '40+ years' : `${year} ${year === 1 ? 'year' : 'years'}`}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField fullWidth size="small" label="Service area / working location" value={form.serviceArea || ''} onChange={(e) => update('serviceArea', e.target.value)} disabled={locked} required />
          </Grid>
          <Grid size={12}>
            <TextField fullWidth multiline minRows={4} label="Short professional description" value={form.professionalDescription || ''} onChange={(e) => update('professionalDescription', e.target.value.slice(0, 2000))} disabled={locked} required helperText={`${String(form.professionalDescription || '').length}/2000`} />
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={sectionSx}>
        <SectionTitle icon={AccountBalanceRounded} title="Bank Details — Optional" subtitle="You can provide bank information now or complete it later. Bank verification remains pending until Admin review." />
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth size="small" label="Bank name" value={form.bankDetails?.bankName || ''} onChange={(e) => update('bankDetails.bankName', e.target.value)} disabled={locked}>
              {BANKS.map((bank) => <MenuItem key={bank} value={bank}>{bank}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth size="small" label="IFSC" value={form.bankDetails?.ifsc || ''} onChange={(e) => update('bankDetails.ifsc', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))} disabled={locked} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth size="small" label="Account number" inputProps={{ inputMode: 'numeric' }} value={form.bankDetails?.accountNumber || ''} onChange={(e) => update('bankDetails.accountNumber', e.target.value.replace(/\D/g, '').slice(0, 24))} disabled={locked} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <UploadField label="Passbook image" file={passbookFile} existing={form.bankDetails?.passbookUrl} onChange={setPassbookFile} disabled={locked} />
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={sectionSx}>
        <Typography sx={{ color: '#16385b', fontSize: 14, fontWeight: 600, mb: 1 }}>Declaration</Typography>
        <FormControlLabel
          control={<Checkbox checked={Boolean(form.declaration?.accepted)} onChange={(e) => update('declaration.accepted', e.target.checked)} disabled={locked} />}
          label={<Typography sx={{ fontSize: 11.5, color: '#526b89' }}>I confirm that the information and documents submitted are correct and belong to me.</Typography>}
        />
      </Paper>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" spacing={1}>
        <Button type="submit" variant="outlined" startIcon={<SaveRounded />} disabled={busy || locked} sx={{ textTransform: 'none', borderRadius: 2 }}>Save draft</Button>
        <Button variant="contained" startIcon={<SendRounded />} onClick={() => void submit()} disabled={busy || locked || !form.declaration?.accepted} sx={{ textTransform: 'none', borderRadius: 2 }}>Submit for review</Button>
      </Stack>
    </Stack>

    {actions.dialogs}
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
  </Box>;
}
