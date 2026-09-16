import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Divider, Grid, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import { createResource, getPropertyById, getPublicPropertyStructure } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSite } from '../../context/SiteContext';
import type { Property } from '../../services/types';
import PageHeader from '../../components/layout/PageHeader';
import SurveyProjectNavigationMap from '../../components/survey/SurveyProjectNavigationMap';

const flatten = (nodes: any[]): any[] => nodes.flatMap((node) => [node, ...flatten(node.children || [])]);
const defaultDateTime = () => {
  const date = new Date(Date.now() + 2 * 86400000);
  date.setHours(11, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export default function ScheduleVisitPage() {
  const { propertyId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: siteData } = useSite();
  const [property, setProperty] = useState<Property | null>(null);
  const [structure, setStructure] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ preferredStart: defaultDateTime(), visitorCount: '1', purpose: 'site_visit', message: '', accessibilitySupport: '', phone: user?.phone || '', email: user?.email || '' });

  const targetSpaceId = searchParams.get('space') || searchParams.get('targetSpace') || '';
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        const [propertyResponse, structureResponse] = await Promise.all([getPropertyById(propertyId), getPublicPropertyStructure(propertyId)]);
        if (!cancelled) { setProperty(propertyResponse.data); setStructure(structureResponse.data); }
      } catch (cause) { if (!cancelled) setError((cause as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [propertyId]);

  const selectedSpace = useMemo(() => flatten(structure?.spaces || []).find((item) => String(item._id) === String(targetSpaceId)), [structure, targetSpaceId]);
  const target = selectedSpace || property;
  const exactLatitude = Number(property?.map?.latitude);
  const exactLongitude = Number(property?.map?.longitude);
  const exactDestination = property?.locationPrivacy === 'exact_public'
    && Number.isFinite(exactLatitude) && Number.isFinite(exactLongitude) && !(exactLatitude === 0 && exactLongitude === 0)
    ? { latitude: exactLatitude, longitude: exactLongitude } : null;
  const mapSettings = siteData.settings?.map || {};
  const mapApiKey = mapSettings.enabled === false || mapSettings.navigationEnabled === false || (mapSettings.provider && mapSettings.provider !== 'google') ? '' : String(mapSettings.publicApiKey || '');
  const travelMode = String(mapSettings.travelMode || 'DRIVING').toUpperCase() as 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
  const publicDirectionsUrl = exactDestination ? `https://www.google.com/maps/dir/?api=1&destination=${exactDestination.latitude},${exactDestination.longitude}` : null;
  function setField(name: keyof typeof form, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  async function submit() {
    if (!property) return;
    setSubmitting(true); setError(''); setNotice('');
    try {
      const response = await createResource('property-visits', {
        property: property._id,
        ...(selectedSpace?._id && { space: selectedSpace._id }),
        preferredStart: form.preferredStart ? new Date(form.preferredStart).toISOString() : undefined,
        visitorCount: Number(form.visitorCount || 1),
        contact: { phone: form.phone, email: form.email, name: user?.name },
        purpose: form.purpose,
        message: form.message,
        accessibilitySupport: form.accessibilitySupport,
      });
      setNotice(`Site visit request submitted. Reference: ${response.data._id}`);
      setTimeout(() => navigate('/app/property-visits'), 900);
    } catch (cause) { setError((cause as Error).message); }
    finally { setSubmitting(false); }
  }

  if (loading) return <Box sx={{ py: 16, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (error && !property) return <Container sx={{ py: 8 }}><Alert severity="error">{error}</Alert></Container>;

  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, pb: 8 }}>
    <PageHeader eyebrow="Property visit" title="Schedule a site visit" description="Choose a preferred time for this property. The landlord or administrator can approve, reschedule or confirm your visit." actions={<Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)} variant="outlined">Back</Button>} />
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 7 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleRounded />}>{notice}</Alert>}
        <Card className="sa-surface-card" elevation={0}><CardContent>
          <Typography variant="h6" fontWeight={900} mb={2}>Visit request</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Preferred date and time" type="datetime-local" value={form.preferredStart} onChange={(e) => setField('preferredStart', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Number of visitors" type="number" value={form.visitorCount} onChange={(e) => setField('visitorCount', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Phone" value={form.phone} onChange={(e) => setField('phone', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Email" value={form.email} onChange={(e) => setField('email', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Purpose" value={form.purpose} onChange={(e) => setField('purpose', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={4} label="Message" value={form.message} onChange={(e) => setField('message', e.target.value)} placeholder="Mention your preferred timing, who will visit, and any question about the property." /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Accessibility support" value={form.accessibilitySupport} onChange={(e) => setField('accessibilitySupport', e.target.value)} placeholder="Optional" /></Grid>
          </Grid>
          <Button variant="contained" size="large" startIcon={<SendRounded />} onClick={submit} disabled={submitting} sx={{ mt: 3 }}>{submitting ? 'Submitting…' : 'Submit Visit Request'}</Button>
        </CardContent></Card>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Card className="sa-surface-card" elevation={0} sx={{ position: { md: 'sticky' }, top: 96 }}><CardContent>
          <Chip label="Selected property" color="primary" sx={{ mb: 1 }} />
          <Typography variant="h5" fontWeight={950}>{target?.title || target?.name || property?.title}</Typography>
          <Typography color="text.secondary" mt={.7}>{[property?.address?.locality, property?.address?.city, property?.address?.state].filter(Boolean).join(', ')}</Typography>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.2}>
            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Visit for</Typography><Typography fontWeight={850}>{selectedSpace?.name || 'Entire property'}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Listing type</Typography><Typography fontWeight={850}>{String(property?.listingType || property?.purpose || 'rent').replaceAll('_', ' ')}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Status</Typography><Chip size="small" label={String(target?.status || property?.status || '').replaceAll('_', ' ')} /></Stack>
          </Stack>
          <Divider sx={{ my: 2 }} />
          {exactDestination ? <SurveyProjectNavigationMap apiKey={mapApiKey} destination={exactDestination} destinationLabel={property?.title || 'Property'} externalUrl={publicDirectionsUrl} travelMode={travelMode} defaultZoom={Number(mapSettings.defaultZoom || 15)} mapId={String(mapSettings.mapId || '')} directionsEnabled={mapSettings.directionsEnabled !== false} serverRoutingEnabled={mapSettings.serverRoutesEnabled !== false && mapSettings.routesEnabled !== false} routeRefreshSeconds={Number(mapSettings.routeRefreshSeconds || 10)} locationUpdateSeconds={Number(mapSettings.locationUpdateSeconds || 5)} /> : <Alert severity="info">The exact property pin will be shared after the landlord or administrator confirms this site visit.</Alert>}
        </CardContent></Card>
      </Grid>
    </Grid>
  </Container>;
}
