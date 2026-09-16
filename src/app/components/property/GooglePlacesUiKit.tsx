import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { loadGoogleMaps } from '../survey/SurveyProjectNavigationMap';

type SelectedPlace = { placeId: string; latitude: number; longitude: number; label?: string };

export default function GooglePlacesUiKit({ apiKey, onSelect }: { apiKey?: string; onSelect: (place: SelectedPlace) => void }) {
  const searchHostRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<any>(null);
  const detailsRequestRef = useRef<any>(null);
  const [query, setQuery] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiKey || !searchHostRef.current) return undefined;
    let active = true;
    let searchElement: any = null;
    let detailsElement: any = null;
    let selectListener: any = null;
    setError('');
    setLoading(true);
    loadGoogleMaps(apiKey).then(async (maps) => {
      await maps.importLibrary?.('places');
      if (!active || !searchHostRef.current) return;
      // PlaceSearchElement is the Places UI Kit web component. It owns the
      // compliant result list and attribution; the app only consumes the
      // selected place's coordinates for the exact property pin.
      searchElement = document.createElement('gmp-place-search');
      searchElement.setAttribute('selectable', '');
      searchElement.appendChild(document.createElement('gmp-place-all-content'));
      const request = document.createElement('gmp-place-text-search-request');
      request.setAttribute('max-result-count', '5');
      searchElement.appendChild(request);
      requestRef.current = request;
      detailsElement = document.createElement('gmp-place-details-compact');
      const detailsRequest = document.createElement('gmp-place-details-place-request');
      detailsElement.appendChild(detailsRequest);
      const contentConfig = document.createElement('gmp-place-content-config');
      ['gmp-place-media', 'gmp-place-rating', 'gmp-place-price', 'gmp-place-open-now-status', 'gmp-place-attribution'].forEach((tagName) => contentConfig.appendChild(document.createElement(tagName)));
      detailsElement.appendChild(contentConfig);
      detailsRequestRef.current = detailsRequest;
      searchHostRef.current.replaceChildren(searchElement, detailsElement);
      selectListener = async (event: any) => {
        const place = event?.place;
        try { await place?.fetchFields?.({ fields: ['id', 'displayName', 'formattedAddress', 'location'] }); } catch { /* the selected event may already contain the requested fields */ }
        const location = place?.location;
        const latitude = Number(location?.lat?.() ?? location?.lat);
        const longitude = Number(location?.lng?.() ?? location?.lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        const placeId = String(place?.id || '').replace(/^places\//, '');
        if (detailsRequestRef.current && place) detailsRequestRef.current.place = place;
        setSelectedPlaceId(placeId);
        onSelect({ placeId, latitude, longitude, label: String(place?.displayName || place?.formattedAddress || '').trim() });
      };
      searchElement.addEventListener('gmp-select', selectListener);
      setLoading(false);
    }).catch((reason) => { if (active) { setLoading(false); setError((reason as Error).message || 'Places UI Kit could not be loaded.'); } });
    return () => {
      active = false;
      if (searchElement && selectListener) searchElement.removeEventListener('gmp-select', selectListener);
      requestRef.current = null;
      detailsRequestRef.current = null;
      if (searchHostRef.current) searchHostRef.current.replaceChildren();
    };
  }, [apiKey, onSelect]);

  function search() {
    const value = query.trim();
    if (!value) return;
    if (!requestRef.current) { setError('Places search is still loading.'); return; }
    (requestRef.current as any).textQuery = value;
    setSelectedPlaceId('');
  }

  return <Box sx={{ mt: 1.5 }}>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: .6 }}>Search a known road, landmark, or nearby place with Google Places UI Kit</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <TextField fullWidth size="small" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') search(); }} placeholder="Search a road, landmark, or place" />
      <Button variant="outlined" startIcon={loading ? <CircularProgress size={15} /> : <SearchRounded />} onClick={search} disabled={loading || !query.trim()}>{loading ? 'Loading…' : 'Search places'}</Button>
    </Stack>
    {error && <Alert severity="warning" sx={{ mt: 1 }}>{error}</Alert>}
    <Box ref={searchHostRef} sx={{ mt: 1, '& gmp-place-search': { display: 'block', width: '100%', minHeight: 0 }, '& gmp-place-details-compact': { display: selectedPlaceId ? 'block' : 'none', width: '100%', mt: 1 } }} />
  </Box>;
}
