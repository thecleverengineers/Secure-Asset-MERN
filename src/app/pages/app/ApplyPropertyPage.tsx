import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Divider, Grid, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import { createRentalApplication, getPropertyById, getPublicPropertyStructure } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { Property } from '../../services/types';
import PageHeader from '../../components/layout/PageHeader';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const flatten = (nodes: any[]): any[] => nodes.flatMap((node) => [node, ...flatten(node.children || [])]);
const safeDate = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

export default function ApplyPropertyPage() {
  const { propertyId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [structure, setStructure] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    moveInDate: safeDate(), expectedStayMonths: '12', adults: '1', children: '0', total: '1', monthlyIncome: '', rentalBudget: '', messageToLandlord: '',
  });

  const targetSpaceId = searchParams.get('space') || searchParams.get('targetSpace') || '';
  const rentalUnitId = searchParams.get('rentalUnit') || searchParams.get('room') || '';
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

  const selectedSpace = useMemo(() => flatten(structure?.spaces || []).find((item) => String(item._id) === String(targetSpaceId)), [structure, targetSpaceId]);
  const selectedRentalUnit = useMemo(() => (structure?.rentalUnits || []).find((item: any) => String(item._id) === String(rentalUnitId)), [structure, rentalUnitId]);
  const target = selectedRentalUnit || selectedSpace || property;
  const price = Number(selectedRentalUnit?.pricing?.monthlyRent || selectedSpace?.price || property?.pricing?.leaseAmount || property?.pricing?.salePrice || property?.price || 0);
  const kycReady = ['verified'].includes(String(user?.kycStatus || ''));

  function setField(name: keyof typeof form, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  async function submit() {
    if (!property) return;
    setSubmitting(true); setError(''); setNotice('');
    try {
      if ((property.listingType || property.purpose) === 'rent' && structure?.rentalUnits?.length && !selectedRentalUnit) throw new Error('Choose a specific available room before submitting your application.');
      const total = Math.max(Number(form.total || 0), Number(form.adults || 0) + Number(form.children || 0));
      const payload = {
        property: property._id,
        ...(selectedSpace?._id && { targetSpace: selectedSpace._id }),
        ...(selectedRentalUnit?._id && { rentalUnit: selectedRentalUnit._id }),
        moveInDate: form.moveInDate,
        expectedStayMonths: Number(form.expectedStayMonths || 0),
        monthlyIncome: Number(form.monthlyIncome || 0),
        rentalBudget: Number(form.rentalBudget || price || 0),
        occupantSummary: { total, adults: Number(form.adults || 0), children: Number(form.children || 0) },
        personal: { name: user?.name, email: user?.email, phone: user?.phone },
        messageToLandlord: form.messageToLandlord,
      };
      const result = await createRentalApplication(payload);
      setNotice(`Application submitted successfully. Reference: ${result.data.applicationNumber || result.data._id}`);
      setTimeout(() => navigate('/app/applications'), 900);
    } catch (cause) { setError((cause as Error).message); }
    finally { setSubmitting(false); }
  }

  if (loading) return <Box sx={{ py: 16, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (error && !property) return <Container sx={{ py: 8 }}><Alert severity="error">{error}</Alert></Container>;

  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, pb: 8 }}>
    <PageHeader eyebrow="Property application" title="Book this property" description="Submit your application for this specific property or room. The landlord or administrator will review it from their applications workspace." actions={<Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)} variant="outlined">Back</Button>} />
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 7 }}>
        {!kycReady && <Alert severity="warning" sx={{ mb: 2, borderRadius: 3 }} action={<Button color="inherit" size="small" onClick={() => navigate('/app/tenant-kyc?required=application')}>Complete KYC</Button>}>Verified tenant KYC is required before submitting an application.</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleRounded />}>{notice}</Alert>}
        <Card className="sa-surface-card" elevation={0}><CardContent>
          <Typography variant="h6" fontWeight={900} mb={2}>Application details</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Move-in date" type="date" value={form.moveInDate} onChange={(e) => setField('moveInDate', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Expected stay in months" type="number" value={form.expectedStayMonths} onChange={(e) => setField('expectedStayMonths', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Adults" type="number" value={form.adults} onChange={(e) => setField('adults', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Children" type="number" value={form.children} onChange={(e) => setField('children', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Total occupants" type="number" value={form.total} onChange={(e) => setField('total', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Monthly income" type="number" value={form.monthlyIncome} onChange={(e) => setField('monthlyIncome', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Rental budget" type="number" value={form.rentalBudget} onChange={(e) => setField('rentalBudget', e.target.value)} placeholder={price ? String(price) : ''} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={4} label="Message to landlord" value={form.messageToLandlord} onChange={(e) => setField('messageToLandlord', e.target.value)} placeholder="Introduce yourself, move-in preference, occupation and any special requirements." /></Grid>
          </Grid>
          <Button variant="contained" size="large" startIcon={<SendRounded />} onClick={submit} disabled={submitting || !kycReady} sx={{ mt: 3 }}>{submitting ? 'Submitting…' : 'Submit Application'}</Button>
        </CardContent></Card>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Card className="sa-surface-card" elevation={0} sx={{ position: { md: 'sticky' }, top: 96 }}><CardContent>
          <Chip label={String(property?.listingType || property?.purpose || 'rent').replaceAll('_', ' ')} color="primary" sx={{ mb: 1 }} />
          <Typography variant="h5" fontWeight={950}>{target?.title || target?.name || property?.title}</Typography>
          <Typography color="text.secondary" mt={.7}>{[property?.address?.locality, property?.address?.city, property?.address?.state].filter(Boolean).join(', ')}</Typography>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.2}>
            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Selected</Typography><Typography fontWeight={850}>{selectedRentalUnit?.name || selectedSpace?.name || 'Entire property'}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Estimated price</Typography><Typography fontWeight={950}>{money(price)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Status</Typography><Chip size="small" label={String(target?.availabilityStatus || target?.status || property?.status || '').replaceAll('_', ' ')} /></Stack>
          </Stack>
        </CardContent></Card>
      </Grid>
    </Grid>
  </Container>;
}
