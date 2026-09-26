import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowBackIosNewRounded from '@mui/icons-material/ArrowBackIosNewRounded';
import ArrowForwardIosRounded from '@mui/icons-material/ArrowForwardIosRounded';
import BadgeRounded from '@mui/icons-material/BadgeRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ContactPhoneRounded from '@mui/icons-material/ContactPhoneRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import SquareFootRounded from '@mui/icons-material/SquareFootRounded';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import WorkRounded from '@mui/icons-material/WorkRounded';
import {
  createRentalApplication,
  getPropertyById,
  getPublicPropertyStructure,
  uploadDocument,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { Property } from '../../services/types';
import OptimizedImage from '../../components/shared/OptimizedImage';

const fallback = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=88';
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const flatten = (nodes: any[]): any[] => nodes.flatMap((node) => [node, ...flatten(node.children || [])]);
const safeDate = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const sentence = (value: unknown) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  gender: string;
  occupation: string;
  moveInDate: string;
  expectedStayMonths: string;
  total: string;
  purposeOfStay: string;
  idType: string;
  idNumber: string;
  currentAddress: string;
  employer: string;
  monthlyIncome: string;
  employmentType: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  messageToLandlord: string;
};

type FileKey = 'idProof' | 'addressProof' | 'incomeProof' | 'profilePhoto';

const initialForm: FormState = {
  fullName: '',
  phone: '',
  email: '',
  gender: '',
  occupation: '',
  moveInDate: safeDate(),
  expectedStayMonths: '12',
  total: '1',
  purposeOfStay: 'Work',
  idType: 'Aadhaar',
  idNumber: '',
  currentAddress: '',
  employer: '',
  monthlyIncome: '',
  employmentType: 'Full-time',
  emergencyName: '',
  emergencyRelation: '',
  emergencyPhone: '',
  messageToLandlord: '',
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: 42,
    bgcolor: '#FFFFFF',
    borderRadius: '7px',
    fontSize: 11,
    '& fieldset': { borderColor: '#D8E3EB' },
    '&:hover fieldset': { borderColor: '#B7C9D6' },
    '&.Mui-focused fieldset': { borderColor: '#0B8B69', borderWidth: 1.4 },
  },
  '& .MuiInputLabel-root': { fontSize: 10.8, color: '#607487' },
  '& .MuiInputBase-input': { py: 1.05 },
  '& textarea': { fontSize: 11, lineHeight: 1.5 },
} as const;

function SectionTitle({ number, icon, title, subtitle }: { number: number; icon: React.ReactNode; title: string; subtitle: string }) {
  return <Stack direction="row" spacing={.8} alignItems="flex-start" sx={{ mb: 1.05 }}>
    <Box sx={{ width: 25, height: 25, borderRadius: 1.7, display: 'grid', placeItems: 'center', bgcolor: '#EAF8F2', color: '#087F5B', flexShrink: 0 }}>{icon}</Box>
    <Box>
      <Typography sx={{ color: '#102A43', fontSize: 12.5, fontWeight: 800 }}>{number}. {title}</Typography>
      <Typography sx={{ mt: .12, color: '#8392A0', fontSize: 8.8 }}>{subtitle}</Typography>
    </Box>
  </Stack>;
}

function UploadTile({ title, hint, file, onSelect, required = true }: { title: string; hint: string; file: File | null; onSelect: (file: File | null) => void; required?: boolean }) {
  const inputId = `application-upload-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return <Paper elevation={0} sx={{ p: 1, border: '1px solid #DDE7EE', borderRadius: 2, bgcolor: '#FFFFFF', minHeight: 67 }}>
    <Stack direction="row" spacing={.8} alignItems="center">
      <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: '#EEF6FF', color: '#3478DA', flexShrink: 0 }}><DescriptionRounded sx={{ fontSize: 17 }} /></Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ color: '#173B55', fontSize: 9.5, fontWeight: 800 }}>{title}{required ? <Box component="span" sx={{ color: '#E5484D' }}> *</Box> : null}</Typography>
        <Typography noWrap sx={{ mt: .12, color: '#8190A0', fontSize: 7.7 }}>{file ? file.name : hint}</Typography>
      </Box>
      <Button component="label" htmlFor={inputId} startIcon={<UploadFileRounded sx={{ fontSize: '14px !important' }} />} sx={{ minWidth: 0, px: .6, textTransform: 'none', fontSize: 8.2, fontWeight: 800 }}>Upload
        <input id={inputId} hidden type="file" accept={title === 'Profile Photo' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,application/pdf'} onChange={(event) => onSelect(event.target.files?.[0] || null)} />
      </Button>
    </Stack>
  </Paper>;
}

export default function ApplyPropertyPage() {
  const { propertyId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [structure, setStructure] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [files, setFiles] = useState<Record<FileKey, File | null>>({ idProof: null, addressProof: null, incomeProof: null, profilePhoto: null });
  const [consent, setConsent] = useState({ truth: false, verification: false, privacy: false });

  const targetSpaceId = searchParams.get('space') || searchParams.get('targetSpace') || '';
  const rentalUnitId = searchParams.get('rentalUnit') || searchParams.get('room') || '';
  const draftKey = `secureasset:application-draft:${propertyId}:${rentalUnitId || targetSpaceId || 'property'}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const [propertyResponse, structureResponse] = await Promise.all([getPropertyById(propertyId), getPublicPropertyStructure(propertyId)]);
        if (!cancelled) { setProperty(propertyResponse.data); setStructure(structureResponse.data); }
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [propertyId]);

  useEffect(() => {
    let restored = false;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.form) { setForm((current) => ({ ...current, ...parsed.form })); restored = true; }
        if (parsed?.consent) setConsent((current) => ({ ...current, ...parsed.consent }));
      }
    } catch { /* ignore corrupt local draft */ }
    if (!restored) {
      setForm((current) => ({
        ...current,
        fullName: current.fullName || String(user?.name || ''),
        phone: current.phone || String(user?.phone || ''),
        email: current.email || String(user?.email || ''),
      }));
    }
  }, [draftKey, user?.name, user?.phone, user?.email]);

  const selectedSpace = useMemo(() => flatten(structure?.spaces || []).find((item) => String(item._id) === String(targetSpaceId)), [structure, targetSpaceId]);
  const selectedRentalUnit = useMemo(() => (structure?.rentalUnits || []).find((item: any) => String(item._id) === String(rentalUnitId)), [structure, rentalUnitId]);
  const target: any = selectedRentalUnit || selectedSpace || property;
  const specs = selectedRentalUnit?.specifications || {};
  const price = Number(selectedRentalUnit?.pricing?.monthlyRent || selectedSpace?.price || property?.pricing?.leaseAmount || property?.pricing?.salePrice || property?.price || 0);
  const deposit = Number(selectedRentalUnit?.pricing?.securityDeposit || property?.pricing?.securityDeposit || 0);
  const kycReady = ['verified'].includes(String(user?.kycStatus || '').toLowerCase());

  const images = useMemo(() => {
    const roomImages = [
      selectedRentalUnit?.primaryImage?.url,
      ...(selectedRentalUnit?.gallery || []).map((item: any) => item?.url),
    ].filter(Boolean);
    const propertyImages = [property?.galleryCover, ...((property as any)?.images || [])].filter(Boolean);
    return [...new Set([...roomImages, ...propertyImages].filter(Boolean))] as string[];
  }, [selectedRentalUnit, property]);

  const roomTitle = selectedRentalUnit?.name || (selectedRentalUnit?.roomNumber ? `Room ${selectedRentalUnit.roomNumber}` : target?.name || property?.title || 'Selected Property');
  const floorLabel = selectedRentalUnit?.floor?.floorName || selectedRentalUnit?.floor?.name || (selectedRentalUnit?.floor?.floorNumber !== undefined ? `Floor ${selectedRentalUnit.floor.floorNumber}` : 'Floor');
  const roomType = sentence(specs.roomType || 'Room');
  const roomSize = specs.roomSize?.value ? `${specs.roomSize.value} ${specs.roomSize.unit || 'sqft'}` : '—';
  const occupancy = specs.maximumOccupants ? `${specs.maximumOccupants} ${Number(specs.maximumOccupants) === 1 ? 'Person' : 'Persons'}` : '—';
  const address = [property?.address?.locality, property?.address?.city, property?.address?.district, property?.address?.state, property?.address?.country].filter(Boolean).join(', ');
  const availabilityRaw = String(selectedRentalUnit?.availabilityStatus || selectedRentalUnit?.status || property?.status || 'available').toUpperCase();
  const available = selectedRentalUnit ? selectedRentalUnit.canBook !== false && !selectedRentalUnit.isLocked && !selectedRentalUnit.applicationInProgress && !['OCCUPIED','BLOCKED','ARCHIVED'].includes(availabilityRaw) : true;
  const totalOnApproval = price + deposit;

  function setField(name: keyof FormState, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function setFile(name: FileKey, file: File | null) {
    if (file && file.size > 8 * 1024 * 1024) { setError('Each supporting document must be 8 MB or smaller.'); return; }
    setFiles((current) => ({ ...current, [name]: file })); setError('');
  }

  function saveDraft() {
    localStorage.setItem(draftKey, JSON.stringify({ form, consent, savedAt: new Date().toISOString() }));
    setNotice('Draft saved securely on this device.');
    setTimeout(() => setNotice(''), 2500);
  }

  function validate() {
    if (!kycReady) return 'Verified tenant KYC is required before submitting an application.';
    if (!form.fullName.trim() || !form.phone.trim() || !form.email.trim()) return 'Complete your applicant name, phone number, and email address.';
    if (!form.gender || !form.occupation.trim()) return 'Complete gender and occupation.';
    if (!form.moveInDate || Number(form.expectedStayMonths || 0) <= 0 || Number(form.total || 0) <= 0) return 'Complete the rental request details.';
    if (!form.idType || !form.idNumber.trim() || !form.currentAddress.trim()) return 'Complete identity and current-address information.';
    if (!form.employer.trim() || Number(form.monthlyIncome || 0) <= 0 || !form.employmentType) return 'Complete employment and income information.';
    if (!form.emergencyName.trim() || !form.emergencyRelation.trim() || !form.emergencyPhone.trim()) return 'Complete the emergency contact.';
    if (!files.idProof || !files.addressProof || !files.incomeProof || !files.profilePhoto) return 'Upload ID proof, address proof, income proof, and profile photo.';
    if (!consent.truth || !consent.verification || !consent.privacy) return 'Accept all declarations and consent items before submitting.';
    return '';
  }

  async function submit() {
    if (!property) return;
    const validationError = validate();
    if (validationError) { setError(validationError); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setSubmitting(true); setUploading(true); setError(''); setNotice('');
    try {
      if ((property.listingType || property.purpose) === 'rent' && structure?.rentalUnits?.length && !selectedRentalUnit) throw new Error('Choose a specific available room before submitting your application.');

      const documentIds: string[] = [];
      for (const [key, file] of Object.entries(files) as Array<[FileKey, File | null]>) {
        if (!file) continue;
        const uploaded = await uploadDocument(file, { property: String(property._id), applicationPurpose: key, visibility: 'private' });
        const documentId = String((uploaded.data as any)?._id || '');
        if (documentId) documentIds.push(documentId);
      }
      setUploading(false);

      const total = Math.max(1, Number(form.total || 1));
      const payload = {
        property: property._id,
        ...(selectedSpace?._id && { targetSpace: selectedSpace._id }),
        ...(selectedRentalUnit?._id && { rentalUnit: selectedRentalUnit._id }),
        moveInDate: form.moveInDate,
        expectedStayMonths: Number(form.expectedStayMonths || 0),
        monthlyIncome: Number(form.monthlyIncome || 0),
        rentalBudget: price,
        occupantSummary: { total, adults: total, children: 0 },
        personal: {
          name: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          gender: form.gender,
          occupation: form.occupation.trim(),
          purposeOfStay: form.purposeOfStay,
          consent: { ...consent, acceptedAt: new Date().toISOString() },
        },
        employment: {
          employer: form.employer.trim(),
          occupation: form.occupation.trim(),
          monthlyIncome: Number(form.monthlyIncome || 0),
          employmentType: form.employmentType,
        },
        identity: {
          type: form.idType,
          number: form.idNumber.trim(),
          currentAddress: form.currentAddress.trim(),
        },
        references: [{ name: form.emergencyName.trim(), relation: form.emergencyRelation.trim(), phone: form.emergencyPhone.trim() }],
        documents: documentIds,
        messageToLandlord: form.messageToLandlord.trim(),
      };
      const result = await createRentalApplication(payload);
      localStorage.removeItem(draftKey);
      setNotice(`Application submitted successfully. Reference: ${result.data.applicationNumber || result.data._id}`);
      setTimeout(() => navigate('/app/applications'), 1100);
    } catch (cause) {
      setUploading(false);
      setError((cause as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Box sx={{ py: 16, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (error && !property) return <Container sx={{ py: 8 }}><Alert severity="error">{error}</Alert></Container>;

  const inputProps = { size: 'small' as const, fullWidth: true, sx: fieldSx };
  const sectionCard = { border: '1px solid #E1E9EF', borderRadius: '12px', bgcolor: '#FFFFFF', boxShadow: '0 7px 22px rgba(30,63,88,.035)' } as const;

  return <Box data-secureasset-application="approved-premium-application-v218" sx={{
    minHeight: '100vh', bgcolor: '#F6F9FB', pb: { xs: 10, md: 6 },
    fontFamily: '"Open Sans", Arial, sans-serif',
    '& .MuiTypography-root, & .MuiButton-root, & .MuiChip-root, & .MuiInputBase-root, & .MuiInputLabel-root': { fontFamily: '"Open Sans", Arial, sans-serif' },
  }}>
    <Container maxWidth={false} sx={{ maxWidth: 1740, px: { xs: 1.1, sm: 2, md: 3.2, xl: 4.5 }, pt: { xs: 1.2, md: 2 } }}>
      <Stack direction="row" spacing={.55} alignItems="center" sx={{ color: '#7B8D9E', mb: .8, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <IconButton aria-label="Go back" onClick={() => navigate(-1)} size="small" sx={{ color: '#173B55', ml: -.7 }}><ArrowBackRounded sx={{ fontSize: 18 }} /></IconButton>
        <Typography sx={{ fontSize: 9.2, color: '#3478DA' }}>Marketplace</Typography><Typography sx={{ fontSize: 9 }}>›</Typography>
        <Typography noWrap sx={{ fontSize: 9 }}>{property?.title}</Typography><Typography sx={{ fontSize: 9 }}>›</Typography>
        <Typography noWrap sx={{ fontSize: 9 }}>{roomTitle}</Typography><Typography sx={{ fontSize: 9 }}>›</Typography>
        <Typography sx={{ fontSize: 9, color: '#173B55', fontWeight: 800 }}>Apply</Typography>
      </Stack>

      <Typography component="h1" sx={{ color: '#0D2340', fontSize: { xs: 22, md: 28 }, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-.025em' }}>Apply for This Room</Typography>
      <Typography sx={{ mt: .25, color: '#64798B', fontSize: 10.5 }}>Complete this application to request approval from the landlord.</Typography>

      {!kycReady && <Alert severity="warning" sx={{ mt: 1.1, borderRadius: 2 }} action={<Button color="inherit" size="small" onClick={() => navigate('/app/tenant-kyc?required=application')}>Complete KYC</Button>}>Verified tenant KYC is required before submitting an application.</Alert>}
      {error && <Alert severity="error" sx={{ mt: 1.1, borderRadius: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mt: 1.1, borderRadius: 2 }} icon={<CheckCircleRounded />}>{notice}</Alert>}

      <Grid container spacing={1.25} sx={{ mt: .2 }}>
        <Grid size={{ xs: 12, lg: 9 }}>
          <Paper elevation={0} sx={{ ...sectionCard, p: { xs: .9, md: 1.15 } }}>
            <Grid container spacing={1}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Box sx={{ position: 'relative', height: { xs: 210, md: 205 }, borderRadius: '9px', overflow: 'hidden', bgcolor: '#EAF0F4' }}>
                  <OptimizedImage src={images[activeImage] || fallback} alt={roomTitle} width={900} height={560} priority style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <Chip size="small" label={`${Math.min(activeImage + 1, Math.max(images.length, 1))} / ${Math.max(images.length, 1)}`} sx={{ position: 'absolute', left: 7, bottom: 7, height: 20, bgcolor: 'rgba(7,30,46,.76)', color: '#fff', fontSize: 7.8, fontWeight: 800 }} />
                  {images.length > 1 && <>
                    <IconButton aria-label="Previous room photo" onClick={() => setActiveImage((current) => (current - 1 + images.length) % images.length)} sx={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', width: 29, height: 29, bgcolor: 'rgba(7,30,46,.74)', color: '#fff' }}><ArrowBackIosNewRounded sx={{ fontSize: 13 }} /></IconButton>
                    <IconButton aria-label="Next room photo" onClick={() => setActiveImage((current) => (current + 1) % images.length)} sx={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', width: 29, height: 29, bgcolor: 'rgba(7,30,46,.74)', color: '#fff' }}><ArrowForwardIosRounded sx={{ fontSize: 13 }} /></IconButton>
                  </>}
                </Box>
                <Stack direction="row" spacing={.5} sx={{ mt: .55, overflowX: 'auto' }}>
                  {(images.length ? images : [fallback]).slice(0, 6).map((url, index) => <Box component="button" type="button" key={`${url}-${index}`} onClick={() => setActiveImage(index)} sx={{ p: 0, flex: '0 0 58px', height: 42, borderRadius: '5px', overflow: 'hidden', border: index === activeImage ? '2px solid #0A8F74' : '1px solid #DCE6ED', bgcolor: '#EDF2F5', cursor: 'pointer' }}><OptimizedImage src={url} alt="" width={180} height={120} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '5px', display: 'block' }} /></Box>)}
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={.5} flexWrap="wrap" useFlexGap>
                  {Boolean((property as any)?.isVerified || (property as any)?.verificationStatus === 'verified') && <Chip size="small" icon={<VerifiedRounded sx={{ fontSize: '12px !important' }} />} label="Verified Property" sx={{ height: 21, bgcolor: '#E7F8EF', color: '#087443', fontSize: 7.8, fontWeight: 800, '& .MuiChip-icon': { color: '#087443' } }} />}
                  <Chip size="small" label={available ? 'Available' : sentence(availabilityRaw)} sx={{ height: 21, bgcolor: available ? '#EAF9F1' : '#FFF4E7', color: available ? '#087443' : '#B54708', fontSize: 7.8, fontWeight: 800 }} />
                </Stack>
                <Typography sx={{ mt: .65, color: '#0D2340', fontSize: { xs: 20, md: 21 }, lineHeight: 1.05, fontWeight: 800 }}>{roomTitle}</Typography>
                <Typography sx={{ mt: .35, color: '#38546A', fontSize: 10.5, fontWeight: 700 }}>{property?.title}</Typography>
                {address && <Stack direction="row" spacing={.35} alignItems="center" sx={{ mt: .45 }}><LocationOnRounded sx={{ fontSize: 13, color: '#73879A' }} /><Typography noWrap sx={{ color: '#73879A', fontSize: 8.2 }}>{address}</Typography></Stack>}

                <Grid container spacing={.5} sx={{ mt: 1.1, pt: 1, borderTop: '1px solid #E8EEF3' }}>
                  {[
                    [<BedRounded sx={{ fontSize: 16 }} />, roomType, 'Room Type'],
                    [<HomeWorkRounded sx={{ fontSize: 16 }} />, floorLabel, 'Floor'],
                    [<SquareFootRounded sx={{ fontSize: 16 }} />, roomSize, 'Size'],
                    [<GroupsRounded sx={{ fontSize: 16 }} />, occupancy, 'Occupancy'],
                  ].map(([icon, value, label], index) => <Grid key={String(label)} size={{ xs: 3 }}>
                    <Stack alignItems="center" spacing={.25} sx={{ minWidth: 0 }}>
                      <Box sx={{ color: '#173B55', height: 18 }}>{icon}</Box>
                      <Typography noWrap sx={{ maxWidth: '100%', color: '#173B55', fontSize: 7.8, fontWeight: 800 }}>{String(value)}</Typography>
                      <Typography sx={{ color: '#8594A2', fontSize: 6.8 }}>{String(label)}</Typography>
                    </Stack>
                  </Grid>)}
                </Grid>
              </Grid>

              <Grid size={{ xs: 12, md: 3 }}>
                <Box sx={{ height: '100%', p: 1.05, borderRadius: 2.2, bgcolor: '#F7FAFC', border: '1px solid #EDF2F5' }}>
                  <Stack direction="row" alignItems="baseline" spacing={.3}><Typography sx={{ color: '#0D2340', fontSize: 22, lineHeight: 1, fontWeight: 800 }}>{price ? money(price) : 'On request'}</Typography>{price > 0 && <Typography sx={{ color: '#7A8D9E', fontSize: 8.5 }}>/month</Typography>}</Stack>
                  <Typography sx={{ mt: .45, color: '#708497', fontSize: 8.5 }}>Security Deposit: {deposit ? money(deposit) : 'Not specified'}</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Paper elevation={0} sx={{ ...sectionCard, p: 1.25, height: '100%' }}>
            <Stack direction="row" spacing={.55} alignItems="center"><SecurityRounded sx={{ color: '#087F5B', fontSize: 18 }} /><Typography sx={{ color: '#102A43', fontSize: 13, fontWeight: 800 }}>Application Progress</Typography></Stack>
            <Stack spacing={.75} sx={{ mt: 1 }}>
              {[
                ['1', 'Applicant Details', 'Provide your personal information'],
                ['2', 'Verification', 'Upload required documents'],
                ['3', 'Review', 'Confirm your details'],
                ['4', 'Submit', 'Send application to landlord'],
              ].map(([step, title, subtitle], index) => <Stack key={step} direction="row" spacing={.75} alignItems="flex-start">
                <Box sx={{ width: 25, height: 25, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: index === 0 ? '#0B9567' : '#F5F8FA', color: index === 0 ? '#fff' : '#587083', border: index === 0 ? 'none' : '1px solid #D6E1E8', fontSize: 9, fontWeight: 800 }}>{step}</Box>
                <Box><Typography sx={{ color: index === 0 ? '#087443' : '#173B55', fontSize: 9.7, fontWeight: 800 }}>{title}</Typography><Typography sx={{ mt: .05, color: '#8392A0', fontSize: 7.6 }}>{subtitle}</Typography></Box>
              </Stack>)}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={1.25} sx={{ mt: 0 }}>
        <Grid size={{ xs: 12, lg: 9 }}>
          <Paper elevation={0} sx={{ ...sectionCard, mt: 1.25, p: { xs: 1.15, md: 1.4 } }}>
            <SectionTitle number={1} icon={<PersonRounded sx={{ fontSize: 16 }} />} title="Applicant Details" subtitle="Tell us about yourself" />
            <Grid container spacing={.85}>
              <Grid size={{ xs: 12, sm: 4 }}><TextField {...inputProps} required label="Full Name" value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField {...inputProps} required label="Phone Number" value={form.phone} onChange={(e) => setField('phone', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField {...inputProps} required label="Email Address" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField {...inputProps} select required label="Gender" value={form.gender} onChange={(e) => setField('gender', e.target.value)}><MenuItem value="Male">Male</MenuItem><MenuItem value="Female">Female</MenuItem><MenuItem value="Other">Other</MenuItem><MenuItem value="Prefer not to say">Prefer not to say</MenuItem></TextField></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField {...inputProps} required label="Occupation" value={form.occupation} onChange={(e) => setField('occupation', e.target.value)} /></Grid>
            </Grid>

            <Box sx={{ my: 1.35, borderTop: '1px solid #E8EEF3' }} />
            <SectionTitle number={2} icon={<CalendarMonthRounded sx={{ fontSize: 16 }} />} title="Rental Request" subtitle="Your rental plans" />
            <Grid container spacing={.85}>
              <Grid size={{ xs: 12, sm: 3 }}><TextField {...inputProps} required label="Move-in Date" type="date" value={form.moveInDate} onChange={(e) => setField('moveInDate', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid size={{ xs: 12, sm: 3 }}><TextField {...inputProps} select required label="Intended Duration" value={form.expectedStayMonths} onChange={(e) => setField('expectedStayMonths', e.target.value)}>{['1','3','6','9','12','18','24'].map((months) => <MenuItem key={months} value={months}>{months} Month{months === '1' ? '' : 's'}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, sm: 3 }}><TextField {...inputProps} required label="Number of Occupants" type="number" value={form.total} onChange={(e) => setField('total', e.target.value)} inputProps={{ min: 1 }} /></Grid>
              <Grid size={{ xs: 12, sm: 3 }}><TextField {...inputProps} select required label="Purpose of Stay" value={form.purposeOfStay} onChange={(e) => setField('purposeOfStay', e.target.value)}>{['Work','Study','Family','Business','Relocation','Other'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid>
            </Grid>

            <Box sx={{ my: 1.35, borderTop: '1px solid #E8EEF3' }} />
            <SectionTitle number={3} icon={<SecurityRounded sx={{ fontSize: 16 }} />} title="Identity & Verification" subtitle="Provide valid identification" />
            <Grid container spacing={.85}>
              <Grid size={{ xs: 12, sm: 3 }}><TextField {...inputProps} select required label="ID Type" value={form.idType} onChange={(e) => setField('idType', e.target.value)}>{['Aadhaar','Passport','Driving Licence','Voter ID','PAN Card'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, sm: 3 }}><TextField {...inputProps} required label="ID Number" value={form.idNumber} onChange={(e) => setField('idNumber', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField {...inputProps} required label="Address (Current)" value={form.currentAddress} onChange={(e) => setField('currentAddress', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><UploadTile title="ID Proof" hint="Aadhaar, Passport or Government ID · JPG, PNG or PDF (Max 8MB)" file={files.idProof} onSelect={(file) => setFile('idProof', file)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><UploadTile title="Address Proof" hint="Utility bill, Bank statement etc. · JPG, PNG or PDF (Max 8MB)" file={files.addressProof} onSelect={(file) => setFile('addressProof', file)} /></Grid>
            </Grid>

            <Box sx={{ my: 1.35, borderTop: '1px solid #E8EEF3' }} />
            <SectionTitle number={4} icon={<WorkRounded sx={{ fontSize: 16 }} />} title="Employment / Income Information" subtitle="Help us verify your financial stability" />
            <Grid container spacing={.85}>
              <Grid size={{ xs: 12, sm: 5 }}><TextField {...inputProps} required label="Employer / Company" value={form.employer} onChange={(e) => setField('employer', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 3 }}><TextField {...inputProps} required label="Monthly Income (₹)" type="number" value={form.monthlyIncome} onChange={(e) => setField('monthlyIncome', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField {...inputProps} select required label="Employment Type" value={form.employmentType} onChange={(e) => setField('employmentType', e.target.value)}>{['Full-time','Part-time','Self-employed','Business Owner','Student','Freelancer','Other'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid>
            </Grid>

            <Box sx={{ my: 1.35, borderTop: '1px solid #E8EEF3' }} />
            <SectionTitle number={5} icon={<ContactPhoneRounded sx={{ fontSize: 16 }} />} title="Emergency Contact" subtitle="Someone we can reach in an emergency" />
            <Grid container spacing={.85}>
              <Grid size={{ xs: 12, sm: 4 }}><TextField {...inputProps} required label="Contact Name" value={form.emergencyName} onChange={(e) => setField('emergencyName', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField {...inputProps} required label="Relation" value={form.emergencyRelation} onChange={(e) => setField('emergencyRelation', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField {...inputProps} required label="Phone Number" value={form.emergencyPhone} onChange={(e) => setField('emergencyPhone', e.target.value)} /></Grid>
            </Grid>

            <Box sx={{ my: 1.35, borderTop: '1px solid #E8EEF3' }} />
            <SectionTitle number={6} icon={<DescriptionRounded sx={{ fontSize: 16 }} />} title="Message to Landlord (Optional)" subtitle="Introduce yourself and share any additional information" />
            <TextField {...inputProps} multiline minRows={3} value={form.messageToLandlord} onChange={(e) => setField('messageToLandlord', e.target.value)} placeholder="Tell the landlord about yourself, your rental plans and any special requirements." inputProps={{ maxLength: 500 }} />
            <Typography sx={{ mt: .3, textAlign: 'right', color: '#8796A3', fontSize: 7.6 }}>{form.messageToLandlord.length}/500</Typography>
          </Paper>

          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper elevation={0} sx={{ ...sectionCard, mt: 1.25, p: { xs: 1.15, md: 1.35 } }}>
                <SectionTitle number={7} icon={<UploadFileRounded sx={{ fontSize: 16 }} />} title="Supporting Documents" subtitle="Upload the following documents to complete your application" />
                <Grid container spacing={.75}>
                  <Grid size={{ xs: 12, sm: 4 }}><UploadTile title="ID Proof" hint="Government issued ID" file={files.idProof} onSelect={(file) => setFile('idProof', file)} /></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><UploadTile title="Income Proof" hint="Payslip, bank statement or ITR" file={files.incomeProof} onSelect={(file) => setFile('incomeProof', file)} /></Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><UploadTile title="Profile Photo" hint="Recent clear profile photo" file={files.profilePhoto} onSelect={(file) => setFile('profilePhoto', file)} /></Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Paper elevation={0} sx={{ ...sectionCard, mt: 1.25, p: { xs: 1.15, md: 1.35 } }}>
                <SectionTitle number={8} icon={<BadgeRounded sx={{ fontSize: 16 }} />} title="Declarations & Consent" subtitle="Please confirm before submission" />
                <Stack spacing={.1}>
                  <FormControlLabel control={<Checkbox size="small" checked={consent.truth} onChange={(e) => setConsent((current) => ({ ...current, truth: e.target.checked }))} sx={{ py: .1, color: '#8797A5', '&.Mui-checked': { color: '#0B9567' } }} />} label={<Typography sx={{ fontSize: 8.4, color: '#50677A' }}>I confirm that all information provided is true and correct.</Typography>} />
                  <FormControlLabel control={<Checkbox size="small" checked={consent.verification} onChange={(e) => setConsent((current) => ({ ...current, verification: e.target.checked }))} sx={{ py: .1, color: '#8797A5', '&.Mui-checked': { color: '#0B9567' } }} />} label={<Typography sx={{ fontSize: 8.4, color: '#50677A' }}>I authorize the landlord to verify my details and documents.</Typography>} />
                  <FormControlLabel control={<Checkbox size="small" checked={consent.privacy} onChange={(e) => setConsent((current) => ({ ...current, privacy: e.target.checked }))} sx={{ py: .1, color: '#8797A5', '&.Mui-checked': { color: '#0B9567' } }} />} label={<Typography sx={{ fontSize: 8.4, color: '#50677A' }}>I agree to SecureAsset privacy and rental application terms.</Typography>} />
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Stack spacing={1.15} sx={{ mt: 1.25, position: { lg: 'sticky' }, top: { lg: 88 } }}>
            <Paper elevation={0} sx={{ ...sectionCard, p: 1.25 }}>
              <Stack direction="row" spacing={.55} alignItems="center"><DescriptionRounded sx={{ fontSize: 17, color: '#173B55' }} /><Typography sx={{ color: '#102A43', fontSize: 12.5, fontWeight: 800 }}>Booking Summary</Typography></Stack>
              <Stack spacing={.7} sx={{ mt: 1 }}>
                {[['Monthly Rent', price ? money(price) : 'On request'],['Security Deposit', deposit ? money(deposit) : 'Not specified'],['Move-in Date', form.moveInDate ? new Date(form.moveInDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],['Duration', `${form.expectedStayMonths || '—'} Months`],['No. of Occupants', `${form.total || '—'} Person${form.total === '1' ? '' : 's'}`]].map(([label,value]) => <Stack key={label} direction="row" justifyContent="space-between" spacing={1}><Typography sx={{ color: '#64798B', fontSize: 9 }}>{label}</Typography><Typography sx={{ color: '#173B55', fontSize: 9, fontWeight: 800, textAlign: 'right' }}>{value}</Typography></Stack>)}
              </Stack>
              <Box sx={{ mt: 1, p: 1, borderRadius: 2, bgcolor: '#E8F9EF', border: '1px solid #D4F0E0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline"><Typography sx={{ color: '#087443', fontSize: 10.5, fontWeight: 800 }}>Total Due on Approval</Typography><Typography sx={{ color: '#087443', fontSize: 17, fontWeight: 800 }}>{money(totalOnApproval)}</Typography></Stack>
                <Typography sx={{ mt: .2, color: '#658575', fontSize: 7.4 }}>(Security deposit + first month rent)</Typography>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ ...sectionCard, p: 1.25 }}>
              <Stack direction="row" spacing={.55} alignItems="center"><SecurityRounded sx={{ fontSize: 17, color: '#087F5B' }} /><Typography sx={{ color: '#102A43', fontSize: 12.5, fontWeight: 800 }}>Why Apply on SecureAsset?</Typography></Stack>
              <Stack spacing={.8} sx={{ mt: 1 }}>
                {[
                  [VerifiedRounded,'Verified Property','Property details are reviewed before publication'],
                  [LockRounded,'Your Data is Protected','Your documents are stored securely'],
                  [ContactPhoneRounded,'Direct Landlord Communication','Connect directly through verified workflows'],
                ].map(([Icon,title,sub]: any) => <Stack key={title} direction="row" spacing={.75} alignItems="center"><Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: '#EAF9F1', color: '#0B9567', flexShrink: 0 }}><Icon sx={{ fontSize: 17 }} /></Box><Box><Typography sx={{ color: '#173B55', fontSize: 9.4, fontWeight: 800 }}>{title}</Typography><Typography sx={{ mt: .08, color: '#8190A0', fontSize: 7.4 }}>{sub}</Typography></Box></Stack>)}
              </Stack>
            </Paper>

            <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
              <Button fullWidth variant="contained" startIcon={<SendRounded />} onClick={submit} disabled={submitting || !kycReady || !available} sx={{ minHeight: 45, bgcolor: '#078B59', borderRadius: 2, textTransform: 'none', fontSize: 11, fontWeight: 800, boxShadow: '0 8px 18px rgba(7,139,89,.18)', '&:hover': { bgcolor: '#067A4E' } }}>{submitting ? (uploading ? 'Uploading documents…' : 'Submitting…') : 'Submit Application'}</Button>
              <Button fullWidth variant="outlined" startIcon={<SaveRounded />} onClick={saveDraft} disabled={submitting} sx={{ mt: .7, minHeight: 41, borderColor: '#CAD7E1', color: '#173B55', borderRadius: 2, textTransform: 'none', fontSize: 10, fontWeight: 800 }}>Save Draft</Button>
              <Stack direction="row" spacing={.5} justifyContent="center" alignItems="center" sx={{ mt: .8 }}><LockRounded sx={{ fontSize: 12, color: '#667D90' }} /><Typography sx={{ color: '#667D90', fontSize: 7.4, textAlign: 'center' }}>Your information is secure and only shared with the landlord for this application.</Typography></Stack>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Container>

    <Paper elevation={0} sx={{ display: { xs: 'block', lg: 'none' }, position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, p: .9, px: 1.2, borderTop: '1px solid #DDE6ED', bgcolor: 'rgba(255,255,255,.97)', backdropFilter: 'blur(14px)' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: .55 }}><Typography sx={{ color: '#526A7D', fontSize: 8.5 }}>Total Due on Approval</Typography><Typography sx={{ color: '#087443', fontSize: 14, fontWeight: 800 }}>{money(totalOnApproval)}</Typography></Stack>
      <Stack direction="row" spacing={.7}>
        <Button fullWidth variant="contained" startIcon={<SendRounded />} onClick={submit} disabled={submitting || !kycReady || !available} sx={{ minHeight: 42, bgcolor: '#078B59', borderRadius: 2, textTransform: 'none', fontSize: 10.5, fontWeight: 800 }}>{submitting ? 'Submitting…' : 'Submit Application'}</Button>
        <Button variant="outlined" onClick={saveDraft} disabled={submitting} sx={{ minWidth: 96, borderColor: '#CAD7E1', color: '#173B55', borderRadius: 2, textTransform: 'none', fontSize: 9.5, fontWeight: 800 }}>Save Draft</Button>
      </Stack>
    </Paper>
  </Box>;
}
