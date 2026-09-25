import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Grid, MenuItem, Paper,
  Snackbar, Stack, TextField, Typography,
} from '@mui/material';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import LinkOffRounded from '@mui/icons-material/LinkOffRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import ImageRounded from '@mui/icons-material/ImageRounded';
import {
  createSurveyorPrivateLink,
  getMySurveyorSubscription,
  revokeSurveyorPrivateLink,
  saveSurveyorProfile,
  setSurveyorProfileVisibility,
  uploadSurveyorProfileAsset,
} from '../../services/api';
import { useActionDialog } from '../../components/shared/useActionDialog';

const array = (value: any) => Array.isArray(value) ? value.join(', ') : value || '';
const split = (value: any) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

function readPreview(file: File, done: (url: string) => void) {
  const reader = new FileReader();
  reader.onload = () => done(String(reader.result || ''));
  reader.readAsDataURL(file);
}

function ImageUploadCard({
  title,
  subtitle,
  value,
  preview,
  fileName,
  onFile,
  logo = false,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  value?: string;
  preview?: string;
  fileName?: string;
  onFile: (file: File) => void;
  logo?: boolean;
  disabled?: boolean;
}) {
  const image = preview || value || '';
  return <Paper
    elevation={0}
    sx={{
      p: 2,
      border: '1px solid #dce8f2',
      borderRadius: 3,
      bgcolor: '#fbfdff',
      height: '100%',
    }}
  >
    <Stack direction="row" spacing={1.5} alignItems="center">
      {logo
        ? <Box sx={{
          width: 72, height: 72, borderRadius: 2.5, border: '1px solid #dce8f2',
          bgcolor: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0,
        }}>
          {image ? <Box component="img" src={image} alt={title} sx={{ width: '100%', height: '100%', objectFit: 'contain', p: .7 }} /> : <ImageRounded sx={{ color: '#8ca0b8', fontSize: 28 }} />}
        </Box>
        : <Avatar src={image} sx={{ width: 72, height: 72, bgcolor: '#edf6f8', color: '#177d76' }}><PhotoCameraRounded /></Avatar>}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#173b5f' }}>{title}</Typography>
        <Typography sx={{ mt: .35, fontSize: 10.5, color: '#71859e', lineHeight: 1.5 }}>{subtitle}</Typography>
        {fileName && <Typography noWrap sx={{ mt: .65, fontSize: 9.5, color: '#4c6d8e' }}>{fileName}</Typography>}
        {!fileName && value && <Typography sx={{ mt: .65, fontSize: 9.5, color: '#3b8a7d' }}>Uploaded image available</Typography>}
      </Box>
    </Stack>
    <Button
      component="label"
      variant="outlined"
      size="small"
      disabled={disabled}
      startIcon={logo ? <ImageRounded /> : <PhotoCameraRounded />}
      sx={{ mt: 1.5, textTransform: 'none', borderRadius: 2, fontSize: 10.5 }}
    >
      {value || preview ? 'Replace image' : 'Upload image'}
      <input
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
    </Button>
    <Typography sx={{ mt: .7, fontSize: 9, color: '#8a9aae' }}>PNG, JPG, WebP or GIF · maximum 8 MB</Typography>
  </Paper>;
}

export default function SurveyorProfilePage() {
  const actions = useActionDialog();
  const [form, setForm] = useState<any>({
    profileType: 'individual',
    availability: 'available',
    specialisations: '',
    languages: '',
    qualifications: '',
    certifications: '',
    equipmentSummary: '',
    serviceLocations: '',
  });
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [agencyLogoFile, setAgencyLogoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const [agencyLogoPreview, setAgencyLogoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [share, setShare] = useState('');

  async function load() {
    setLoading(true);
    try {
      const response = await getMySurveyorSubscription();
      const profile = response.data?.profile || {};
      setForm({
        ...profile,
        profileType: profile.profileType || 'individual',
        availability: profile.availability || 'available',
        specialisations: array(profile.specialisations),
        languages: array(profile.languages),
        qualifications: array(profile.qualifications),
        certifications: array(profile.certifications),
        equipmentSummary: array(profile.equipmentSummary),
        serviceLocations: (profile.serviceLocations || [])
          .map((item: any) => [item.city, item.state].filter(Boolean).join(', '))
          .join('; '),
      });
      setProfilePhotoPreview('');
      setAgencyLogoPreview('');
      setProfilePhotoFile(null);
      setAgencyLogoFile(null);
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
      keys.slice(0, -1).forEach((key) => {
        cursor[key] ||= {};
        cursor = cursor[key];
      });
      cursor[keys.at(-1)!] = value;
      return next;
    });
  }

  function body(overrides: Record<string, any> = {}) {
    return {
      ...form,
      ...overrides,
      yearsExperience: Number(form.yearsExperience || 0),
      teamSize: Number(form.teamSize || 0),
      startingPrice: Number(form.startingPrice || 0),
      averageCompletionDays: Number(form.averageCompletionDays || 0),
      specialisations: split(form.specialisations),
      languages: split(form.languages),
      qualifications: split(form.qualifications),
      certifications: split(form.certifications),
      equipmentSummary: split(form.equipmentSummary),
      serviceLocations: String(form.serviceLocations || '')
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
          const [city, state] = item.split(',').map((value) => value.trim());
          return { city, state, radiusKm: 50 };
        }),
    };
  }

  async function uploadPendingProfileAssets() {
    const uploaded: Record<string, string> = {};
    if (profilePhotoFile) {
      const result = await uploadSurveyorProfileAsset(profilePhotoFile, 'profile_photo');
      uploaded.profilePhoto = result.data.url;
    }
    if (agencyLogoFile) {
      const result = await uploadSurveyorProfileAsset(agencyLogoFile, 'agency_logo');
      uploaded.agencyLogo = result.data.url;
    }
    return uploaded;
  }

  async function persistProfile() {
    const uploaded = await uploadPendingProfileAssets();
    const response = await saveSurveyorProfile(body(uploaded));
    setProfilePhotoFile(null);
    setAgencyLogoFile(null);
    setProfilePhotoPreview('');
    setAgencyLogoPreview('');
    return response;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await persistProfile();
      setNotice('Professional profile saved');
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function visibility(next: 'private' | 'public') {
    setBusy(true);
    setError('');
    try {
      await persistProfile();
      await setSurveyorProfileVisibility(next);
      setNotice(next === 'public' ? 'Profile submitted/published for marketplace' : 'Profile made private');
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function link() {
    const entered = await actions.askText(
      'Optional access code for this private link. Leave it blank for no access code.',
      { title: 'Create private profile link', label: 'Access code' },
    );
    if (entered === null) return;
    const accessCode = entered.trim() || undefined;
    setBusy(true);
    try {
      const response = await createSurveyorPrivateLink(accessCode);
      const url = new URL(response.data.url, window.location.origin).toString();
      setShare(url);
      await navigator.clipboard?.writeText(url);
      setNotice(accessCode ? 'Private link created with access-code protection and copied' : 'Private link created and copied');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await revokeSurveyorPrivateLink();
      setShare('');
      setNotice('Private link revoked');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function selectProfilePhoto(file: File) {
    setProfilePhotoFile(file);
    readPreview(file, setProfilePhotoPreview);
  }

  function selectAgencyLogo(file: File) {
    setAgencyLogoFile(file);
    readPreview(file, setAgencyLogoPreview);
  }

  if (loading) return <Box sx={{ p: 10, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  const textFields: Array<[string, string, string?]> = [
    ['name', 'Surveyor or agency name'],
    ['professionalTitle', 'Professional title'],
    ['yearsExperience', 'Years of experience', 'number'],
    ['registrationNumber', 'Registration number'],
    ['licenceNumber', 'Licence number'],
    ['teamSize', 'Team size', 'number'],
    ['startingPrice', 'Starting service price', 'number'],
    ['averageCompletionDays', 'Average completion time (days)', 'number'],
    ['publicContact.phone', 'Public phone'],
    ['publicContact.email', 'Public email'],
    ['publicContact.website', 'Website'],
    ['officeAddress.line1', 'Office address'],
    ['officeAddress.city', 'City'],
    ['officeAddress.state', 'State'],
    ['officeAddress.postalCode', 'Postal code'],
  ];

  const getValue = (object: any, path: string) => path.split('.').reduce((value, key) => value?.[key], object);

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6, fontFamily: "'Open Sans', sans-serif" }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 600, letterSpacing: '-.04em', color: '#143757' }}>Professional Profile</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>Your public profile appears in the Surveyor Marketplace after verification.</Typography>
      </Box>
      <Stack direction="row" spacing={1}>
        <Chip label={form.verificationStatus || 'not verified'} color={form.verificationStatus === 'verified' ? 'success' : 'warning'} />
        <Chip label={`${form.visibility || 'private'} · ${form.publicationStatus || 'draft'}`} />
      </Stack>
    </Stack>

    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {share && <Alert severity="success" sx={{ mb: 2 }} action={<Button size="small" onClick={() => navigator.clipboard.writeText(share)}>Copy</Button>}>{share}</Alert>}

    <Paper component="form" onSubmit={save} elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #dfe9f2', borderRadius: 4 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField select fullWidth size="small" label="Profile type" value={form.profileType} onChange={(event) => setForm({ ...form, profileType: event.target.value })}>
            <MenuItem value="individual">Independent surveyor</MenuItem>
            <MenuItem value="agency">Survey agency</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField select fullWidth size="small" label="Availability" value={form.availability} onChange={(event) => setForm({ ...form, availability: event.target.value })}>
            {['available', 'busy', 'limited', 'unavailable'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <ImageUploadCard
            title="Profile photo"
            subtitle="Upload the photograph displayed on your public Surveyor profile."
            value={form.profilePhoto}
            preview={profilePhotoPreview}
            fileName={profilePhotoFile?.name}
            onFile={selectProfilePhoto}
            disabled={busy}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ImageUploadCard
            title="Agency logo"
            subtitle="Upload your agency or business logo. This replaces the old logo URL field."
            value={form.agencyLogo}
            preview={agencyLogoPreview}
            fileName={agencyLogoFile?.name}
            onFile={selectAgencyLogo}
            logo
            disabled={busy}
          />
        </Grid>

        {textFields.map(([name, label, type]) => <Grid size={{ xs: 12, md: 6 }} key={name}>
          <TextField
            fullWidth
            size="small"
            label={label}
            type={type || 'text'}
            value={getValue(form, name) || ''}
            onChange={(event) => update(name, type === 'number' ? Number(event.target.value) : event.target.value)}
          />
        </Grid>)}

        <Grid size={12}>
          <TextField multiline rows={4} fullWidth size="small" label="Business description" value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Grid>

        {[
          ['specialisations', 'Specialisations'],
          ['languages', 'Languages spoken'],
          ['qualifications', 'Qualifications'],
          ['certifications', 'Certifications'],
          ['equipmentSummary', 'Equipment used'],
        ].map(([name, label]) => <Grid size={{ xs: 12, md: 6 }} key={name}>
          <TextField fullWidth size="small" label={`${label} (comma separated)`} value={form[name] || ''} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
        </Grid>)}

        <Grid size={12}>
          <TextField fullWidth size="small" label="Service locations (City, State; City, State)" value={form.serviceLocations || ''} onChange={(event) => setForm({ ...form, serviceLocations: event.target.value })} />
        </Grid>
        <Grid size={12}>
          <TextField multiline rows={3} fullWidth size="small" label="Terms and conditions" value={form.terms || ''} onChange={(event) => setForm({ ...form, terms: event.target.value })} />
        </Grid>
      </Grid>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mt: 3 }}>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ContentCopyRounded />} onClick={link} disabled={busy}>Private link</Button>
          <Button variant="text" color="warning" startIcon={<LinkOffRounded />} onClick={revoke} disabled={busy}>Revoke</Button>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<VisibilityOffRounded />} onClick={() => visibility('private')} disabled={busy}>Make private</Button>
          <Button variant="outlined" startIcon={<PublicRounded />} onClick={() => visibility('public')} disabled={busy}>Publish</Button>
          <Button type="submit" variant="contained" startIcon={<SaveRounded />} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </Stack>
      </Stack>
    </Paper>

    {actions.dialogs}
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
  </Box>;
}
