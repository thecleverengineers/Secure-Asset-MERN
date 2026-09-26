import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControl, Grid, InputLabel, LinearProgress, MenuItem, Select,
  Stack, TextField, Typography,
} from '@mui/material';
import CloudUploadRounded from '@mui/icons-material/CloudUploadRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import { getResource, submitTenantKyc, updateTenantKycWhatsapp, uploadDocument } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/layout/PageHeader';
import TenantKycDocumentPreview, { tenantKycFileId } from '../../components/kyc/TenantKycDocumentPreview';

const GOVERNMENT_ID_OPTIONS = [
  'Aadhaar Card — identity and address verification',
  'PAN Card — financial and tax verification; especially important for buying or selling property',
  'Voter ID / EPIC — identity and address verification',
  'Passport — identity, nationality and address verification',
  'Driving Licence — identity and address verification',
  'Government-issued Employee ID — supplementary identity proof',
  'NREGA Job Card — identity and address proof where applicable',
  'OCI Card — for Overseas Citizens of India',
  'Foreign Passport and valid Visa — for foreign tenants or buyers',
];
const ADDRESS_PROOF_OPTIONS = [
  'Aadhaar Card', 'Passport', 'Voter ID Card', 'Driving Licence', 'Ration Card', 'Recent electricity bill', 'Recent water bill', 'Recent gas bill',
  'Recent landline telephone bill', 'Property tax receipt', 'Registered rent or lease agreement', 'Bank statement or bank passbook showing the current address',
  'Government-issued residence or domicile certificate', 'Employer-issued accommodation letter, where applicable',
];
const STATUS_PROGRESS: Record<string, number> = { not_started: 10, incomplete: 25, submitted: 65, under_review: 75, changes_required: 45, verified: 100, rejected: 35, expired: 30, suspended: 20, pending: 55 };
const KYC_DOCUMENT_ACCEPT = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';
const KYC_DOCUMENT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);
const PASSPORT_PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

type KycForm = {
  whatsappNumber: string;
  governmentIdentityType: string; governmentIdentityNumber: string; governmentIdentityFrontFile: string; governmentIdentityBackFile: string;
  addressProofType: string; addressProofNumber: string; addressProofFrontFile: string; addressProofBackFile: string;
  passportPhotoFile: string;
};

const emptyForm: KycForm = {
  whatsappNumber: '',
  governmentIdentityType: '', governmentIdentityNumber: '', governmentIdentityFrontFile: '', governmentIdentityBackFile: '',
  addressProofType: '', addressProofNumber: '', addressProofFrontFile: '', addressProofBackFile: '', passportPhotoFile: '',
};

function valueFromRecord(record: any): KycForm {
  return {
    whatsappNumber: record?.whatsappNumber || '',
    governmentIdentityType: record?.governmentIdentity?.documentType || '',
    governmentIdentityNumber: record?.governmentIdentity?.documentId || '',
    governmentIdentityFrontFile: tenantKycFileId(record?.governmentIdentity?.frontFile || record?.governmentId),
    governmentIdentityBackFile: tenantKycFileId(record?.governmentIdentity?.backFile),
    addressProofType: record?.addressProofDetails?.documentType || '',
    addressProofNumber: record?.addressProofDetails?.documentId || '',
    addressProofFrontFile: tenantKycFileId(record?.addressProofDetails?.frontFile || record?.addressProof),
    addressProofBackFile: tenantKycFileId(record?.addressProofDetails?.backFile),
    passportPhotoFile: tenantKycFileId(record?.passportPhoto?.file || record?.profilePhoto),
  };
}

function normalizeWhatsAppInput(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}
function validWhatsApp(value: string) {
  return /^[6-9]\d{9}$/.test(normalizeWhatsAppInput(value));
}

function UploadDropZone({ label, helper, value, accept, onUpload, disabled }: { label: string; helper?: string; value?: string; accept?: string; disabled?: boolean; onUpload: (file: File) => Promise<void> }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  async function handleFile(file?: File) {
    if (!file || disabled) return;
    setBusy(true); setUploadError('');
    try { await onUpload(file); }
    catch (cause) { setUploadError((cause as Error).message); }
    finally { setBusy(false); setDrag(false); }
  }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); void handleFile(event.dataTransfer.files?.[0]); }
  function onChange(event: ChangeEvent<HTMLInputElement>) { void handleFile(event.target.files?.[0]); event.target.value = ''; }
  return <Box
    onDragOver={(event) => { event.preventDefault(); if (!disabled) setDrag(true); }}
    onDragLeave={() => setDrag(false)}
    onDrop={onDrop}
    sx={{ border: '1.5px dashed', borderColor: drag ? 'primary.main' : value ? 'success.main' : 'divider', bgcolor: drag ? 'primary.main' : 'action.hover', color: drag ? 'primary.contrastText' : 'text.primary', borderRadius: 4, p: 2, transition: '.2s', minHeight: 130 }}
  >
    <Stack alignItems="center" textAlign="center" spacing={1}>
      <CloudUploadRounded color={drag ? 'inherit' : value ? 'success' : 'primary'} sx={{ fontSize: 38 }} />
      <Typography fontWeight={900}>{label}</Typography>
      <Typography color={drag ? 'inherit' : 'text.secondary'} fontSize={12}>{helper || 'Drag & drop file here or click to upload'}</Typography>
      {value ? <><Chip color="success" size="small" label="Uploaded" /><Box sx={{ width: '100%', maxWidth: 220 }}><TenantKycDocumentPreview label="Uploaded document" value={value} height={92} /></Box></> : null}
      <Button component="label" variant="outlined" disabled={disabled || busy} sx={{ bgcolor: 'background.paper' }}>{busy ? 'Uploading…' : value ? 'Replace file' : 'Choose file'}<input hidden type="file" accept={accept} onChange={onChange} /></Button>
      {uploadError && <Typography color="error" fontSize={12}>{uploadError}</Typography>}
    </Stack>
  </Box>;
}

export default function TenantKycPage() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState<KycForm>(emptyForm);
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    try {
      const result = await getResource('tenant-kyc', { limit: 10 });
      const own = result.data.find((item: any) => String(item.user?._id || item.user) === user?._id) || result.data[0];
      if (own) {
        setRecord(own);
        const next = valueFromRecord(own);
        setForm({ ...next, whatsappNumber: next.whatsappNumber || String((user as any)?.whatsappNumber || (user as any)?.phone || '') });
      } else {
        setForm((current) => ({ ...current, whatsappNumber: String((user as any)?.whatsappNumber || (user as any)?.phone || '') }));
      }
    } catch (cause) { setError((cause as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const status = String(record?.status || user?.kycStatus || 'not_started');
  const verified = status === 'verified';
  const progress = STATUS_PROGRESS[status] || 10;
  const whatsappValid = validWhatsApp(form.whatsappNumber);
  const complete = useMemo(() => Boolean(whatsappValid && form.governmentIdentityType && form.governmentIdentityNumber && form.governmentIdentityFrontFile && form.addressProofType && form.addressProofNumber && form.addressProofFrontFile && form.addressProofBackFile && form.passportPhotoFile), [form, whatsappValid]);
  function setField(name: keyof KycForm, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  async function uploadTo(field: keyof KycForm, file: File, category: string) {
    const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
    const allowedExtensions = field === 'passportPhotoFile' ? PASSPORT_PHOTO_EXTENSIONS : KYC_DOCUMENT_EXTENSIONS;
    if (!allowedExtensions.has(extension)) throw new Error(field === 'passportPhotoFile' ? 'Passport-size photograph must be JPG, JPEG, or PNG.' : 'KYC documents must be JPG, JPEG, PNG, or PDF.');
    if (field === 'passportPhotoFile') {
      if (file.size > 2 * 1024 * 1024) throw new Error('Passport-size photograph must be maximum 2 MB.');
    }
    const result = await uploadDocument(file, { category, type: 'tenant_kyc', description: `${category.replaceAll('_', ' ')} uploaded for tenant KYC`, visibility: 'private' });
    setField(field, String((result.data as any).driveFile || result.data._id));
  }
  async function saveWhatsAppNumber() {
    setError(''); setNotice('');
    if (!whatsappValid) { setError('Enter a valid 10-digit Indian WhatsApp number.'); return; }
    setSaving(true);
    try {
      const result = await updateTenantKycWhatsapp(normalizeWhatsAppInput(form.whatsappNumber));
      setRecord(result.data);
      setNotice(result.message || 'WhatsApp number updated for rent reminders.');
      await refreshUser();
    } catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }

  async function submit() {
    setError(''); setNotice(''); setSaving(true);
    try {
      if (!complete) throw new Error('Please add a valid WhatsApp number and complete Government Identity, Address Proof, and Passport-Size Photograph before submitting.');
      const payload = {
        whatsappNumber: normalizeWhatsAppInput(form.whatsappNumber),
        governmentIdentity: { documentType: form.governmentIdentityType, documentId: form.governmentIdentityNumber, frontFile: form.governmentIdentityFrontFile, ...(form.governmentIdentityBackFile ? { backFile: form.governmentIdentityBackFile } : {}) },
        addressProofDetails: { documentType: form.addressProofType, documentId: form.addressProofNumber, frontFile: form.addressProofFrontFile, backFile: form.addressProofBackFile },
        passportPhoto: { file: form.passportPhotoFile, requirementsAccepted: true },
        governmentId: form.governmentIdentityFrontFile,
        addressProof: form.addressProofFrontFile,
        profilePhoto: form.passportPhotoFile,
      };
      const result = await submitTenantKyc(payload);
      setRecord(result.data); setNotice('KYC submitted successfully. Your dashboard access is now enabled while admin review continues.');
      await refreshUser();
    } catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }
  if (loading) return <Box sx={{ py: 16, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6, maxWidth: 1180 }}>
    <PageHeader eyebrow="Secure onboarding" title="Tenant KYC verification" description="Complete your identity, address and photograph checks to activate the tenant workspace and property workflows." meta={<Chip size="small" label={status.replaceAll('_', ' ')} color={verified ? 'success' : complete ? 'warning' : 'default'} />} />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}{record?.reason && <Alert severity={verified ? 'success' : 'warning'} sx={{ mb: 2 }}>{record.reason}</Alert>}
    <Card className="sa-surface-card" elevation={0} sx={{ mb: 3 }}><CardContent><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} mb={1}><Typography fontWeight={850}>Verification progress</Typography><Typography color="text.secondary" sx={{ fontSize: 12, fontWeight: 800 }}>{progress}% complete</Typography></Stack><LinearProgress variant="determinate" value={progress} sx={{ height: 9 }} /><Typography color="text.secondary" fontSize={12} mt={1}>{verified ? 'Your KYC is verified.' : complete ? 'All required fields are complete. Submit for review to unlock dashboard access.' : 'Fill all required steps below, including your WhatsApp contact, to complete your KYC.'}</Typography></CardContent></Card>

    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12 }}><Card className="sa-surface-card" elevation={0}><CardContent>
        <Typography variant="h6" fontWeight={950}>Step D — WhatsApp Contact</Typography>
        <Typography color="text.secondary" fontSize={13} mb={2}>Required for SecureAsset rent reminders. Enter the WhatsApp number where monthly rent reminders must be delivered. Indian mobile numbers only.</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 8 }}><TextField
            fullWidth required label="WhatsApp number" placeholder="+91 98765 43210"
            value={form.whatsappNumber}
            onChange={(e) => setField('whatsappNumber', e.target.value)}
            error={Boolean(form.whatsappNumber) && !whatsappValid}
            helperText={Boolean(form.whatsappNumber) && !whatsappValid ? 'Enter a valid 10-digit Indian WhatsApp number.' : 'Rent reminders are sent to this number at 8:30 AM during the reminder period.'}
            inputProps={{ inputMode: 'tel', maxLength: 16 }}
          /></Grid>
          {verified && <Grid size={{ xs: 12, md: 4 }}><Button fullWidth variant="outlined" size="large" onClick={() => void saveWhatsAppNumber()} disabled={saving || !whatsappValid}>{saving ? 'Saving…' : 'Update WhatsApp Number'}</Button></Grid>}
        </Grid>
      </CardContent></Card></Grid>
      <Grid size={{ xs: 12 }}><Card className="sa-surface-card" elevation={0}><CardContent>
        <Typography variant="h6" fontWeight={950}>Step A — Government Identity</Typography><Typography color="text.secondary" fontSize={13} mb={2}>Choose one government identity document and upload the front side. The back side is optional when your document has no reverse side.</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}><FormControl fullWidth><InputLabel>Government identity type</InputLabel><Select label="Government identity type" value={form.governmentIdentityType} onChange={(e) => setField('governmentIdentityType', e.target.value)} disabled={verified}>{GOVERNMENT_ID_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</Select></FormControl></Grid>
          <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Document ID" value={form.governmentIdentityNumber} onChange={(e) => setField('governmentIdentityNumber', e.target.value)} disabled={verified} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><UploadDropZone label="Upload Front Side" accept={KYC_DOCUMENT_ACCEPT} value={form.governmentIdentityFrontFile} disabled={verified} onUpload={(file) => uploadTo('governmentIdentityFrontFile', file, 'tenant_government_identity_front')} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><UploadDropZone label="Upload Back Side (Optional)" helper="Upload only if your identity document has a reverse side" accept={KYC_DOCUMENT_ACCEPT} value={form.governmentIdentityBackFile} disabled={verified} onUpload={(file) => uploadTo('governmentIdentityBackFile', file, 'tenant_government_identity_back')} /></Grid>
        </Grid>
      </CardContent></Card></Grid>

      <Grid size={{ xs: 12 }}><Card className="sa-surface-card" elevation={0}><CardContent>
        <Typography variant="h6" fontWeight={950}>Step B — Address Proof</Typography><Typography color="text.secondary" fontSize={13} mb={2}>Choose one address proof document and upload both front and back sides.</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}><FormControl fullWidth><InputLabel>Address proof type</InputLabel><Select label="Address proof type" value={form.addressProofType} onChange={(e) => setField('addressProofType', e.target.value)} disabled={verified}>{ADDRESS_PROOF_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</Select></FormControl></Grid>
          <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Document ID" value={form.addressProofNumber} onChange={(e) => setField('addressProofNumber', e.target.value)} disabled={verified} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><UploadDropZone label="Upload Front Side" accept={KYC_DOCUMENT_ACCEPT} value={form.addressProofFrontFile} disabled={verified} onUpload={(file) => uploadTo('addressProofFrontFile', file, 'tenant_address_proof_front')} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><UploadDropZone label="Upload Back Side" accept={KYC_DOCUMENT_ACCEPT} value={form.addressProofBackFile} disabled={verified} onUpload={(file) => uploadTo('addressProofBackFile', file, 'tenant_address_proof_back')} /></Grid>
        </Grid>
      </CardContent></Card></Grid>

      <Grid size={{ xs: 12 }}><Card className="sa-surface-card" elevation={0}><CardContent>
        <Typography variant="h6" fontWeight={950}>Step C — Passport Size Photo</Typography><Typography color="text.secondary" fontSize={13} mb={2}>Recent colour photograph. Clear front-facing image, white or light background, no sunglasses or filters. JPG, JPEG, or PNG only. Maximum file size: 2 MB. Recommended dimensions: 35 mm × 45 mm.</Typography>
        <UploadDropZone label="Upload Passport-Size Photograph" helper="Drag & drop your recent colour photograph or click to upload" accept=".jpg,.jpeg,.png,image/jpeg,image/png" value={form.passportPhotoFile} disabled={verified} onUpload={(file) => uploadTo('passportPhotoFile', file, 'tenant_passport_photo')} />
      </CardContent></Card></Grid>
    </Grid>

    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mt={3} alignItems={{ sm: 'center' }}>
      <Button variant="contained" size="large" startIcon={<SaveRounded />} onClick={submit} disabled={verified || saving || !complete}>{verified ? 'KYC verified' : saving ? 'Submitting…' : 'Submit KYC for Review'}</Button>
      {!complete && !verified && <Typography color="text.secondary" fontSize={13}>Complete all required fields and uploads to enable submission.</Typography>}
    </Stack>
  </Box>;
}
