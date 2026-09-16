import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Stack, Typography } from '@mui/material';
import DirectionsRounded from '@mui/icons-material/DirectionsRounded';
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import { getPropertyVisitNavigation, getResource } from '../../services/api';
import { useSite } from '../../context/SiteContext';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';
import SurveyProjectNavigationMap from '../../components/survey/SurveyProjectNavigationMap';

const approvedStatuses = new Set(['approved', 'rescheduled', 'confirmed', 'visitor_arrived', 'visit_in_progress', 'completed']);
const label = (value: unknown) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateLabel = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Time to be confirmed';

export default function PropertyVisitsPage() {
  const { data: siteData } = useSite();
  const [visits, setVisits] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [navigation, setNavigation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [navigationLoading, setNavigationLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setVisits((await getResource('property-visits', { limit: 100, sort: '-confirmedStart,-createdAt' })).data || []); }
    catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function toggleNavigation(visit: any) {
    const id = String(visit._id);
    if (selectedId === id) { setSelectedId(''); setNavigation(null); return; }
    setSelectedId(id); setNavigation(null); setNavigationLoading(true); setError('');
    try { setNavigation((await getPropertyVisitNavigation(id)).data); }
    catch (caught) { setError((caught as Error).message); }
    finally { setNavigationLoading(false); }
  }

  const mapSettings = siteData.settings?.map || {};
  const mapApiKey = mapSettings.enabled === false || mapSettings.navigationEnabled === false || (mapSettings.provider && mapSettings.provider !== 'google') ? '' : String(mapSettings.publicApiKey || '');
  const travelMode = String(mapSettings.travelMode || 'DRIVING').toUpperCase() as 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 }, pb: 8 }}>
    <CompactPageToolbar marker="property-visits-toolbar-v153" title="Property site visits" description="Track visits and, after approval, open the exact property pin." actions={<Button variant="outlined" startIcon={<RefreshRounded />} onClick={load} disabled={loading}>Refresh</Button>} />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {loading ? <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : !visits.length ? <Alert severity="info">You have no property site visits yet. Open a marketplace listing to request one.</Alert> : <Stack spacing={1.6}>{visits.map((visit) => {
      const isApproved = approvedStatuses.has(String(visit.status || ''));
      const isSelected = selectedId === String(visit._id);
      const property = visit.property || {};
      return <Card key={visit._id} className="sa-surface-card" elevation={0}><CardContent><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
        <Box><Stack direction="row" spacing={1} alignItems="center"><LocationOnRounded color="primary" /><Typography fontWeight={900}>{property.title || 'Property site visit'}</Typography><Chip size="small" label={label(visit.status)} color={isApproved ? 'success' : visit.status === 'rejected' || visit.status === 'cancelled' ? 'default' : 'warning'} /></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: .7 }}>{visit.space?.name || visit.space?.code ? `${visit.space.name || visit.space.code} · ` : ''}{dateLabel(visit.confirmedStart || visit.proposedStart || visit.preferredStart)}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .35 }}>{isApproved ? 'The exact property pin is available for this approved visit.' : 'The exact property pin is shared after the landlord or administrator confirms this visit.'}</Typography></Box>
        {isApproved && <Button variant={isSelected ? 'outlined' : 'contained'} startIcon={<DirectionsRounded />} onClick={() => void toggleNavigation(visit)} disabled={navigationLoading && isSelected}>{navigationLoading && isSelected ? 'Loading route…' : isSelected ? 'Hide navigation' : 'Open live navigation'}</Button>}
      </Stack>{isSelected && navigation && (navigation.available ? <Box sx={{ mt: 2 }}><SurveyProjectNavigationMap apiKey={mapApiKey} destination={navigation.destination} destinationLabel={navigation.property?.title || property.title || 'Property'} externalUrl={navigation.navigationUrl} travelMode={travelMode} defaultZoom={Number(mapSettings.defaultZoom || 15)} mapId={String(mapSettings.mapId || '')} directionsEnabled={mapSettings.directionsEnabled !== false} serverRoutingEnabled={mapSettings.serverRoutesEnabled !== false && mapSettings.routesEnabled !== false} routeRefreshSeconds={Number(mapSettings.routeRefreshSeconds || 10)} locationUpdateSeconds={Number(mapSettings.locationUpdateSeconds || 5)} /></Box> : <Alert severity="warning" sx={{ mt: 2 }}>{navigation.reason || 'Exact navigation is not available for this visit.'}</Alert>)}{isSelected && !navigation && navigationLoading && <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}><CircularProgress size={18} /><Typography color="text.secondary">Preparing the approved property destination…</Typography></Stack>}</CardContent></Card>;
    })}</Stack>}
    {visits.some((visit) => approvedStatuses.has(String(visit.status || ''))) && !mapApiKey && <Alert severity="info" sx={{ mt: 2 }} icon={<EventAvailableRounded />}>Live Google navigation needs a browser Maps API key. Until an administrator configures it, approved visits still include an “Open Google Maps” fallback link.</Alert>}
  </Container>;
}
