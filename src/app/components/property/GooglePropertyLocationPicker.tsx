import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import MyLocationRounded from '@mui/icons-material/MyLocationRounded';
import { loadGoogleMaps } from '../survey/SurveyProjectNavigationMap';
import GooglePlacesUiKit from './GooglePlacesUiKit';

export type PropertyCoordinates = { latitude: number; longitude: number } | null;

type GooglePropertyLocationPickerProps = {
  apiKey?: string;
  value: PropertyCoordinates;
  defaultCenter?: { latitude: number; longitude: number };
  mapId?: string;
  placesUiKitEnabled?: boolean;
  onChange: (coordinates: { latitude: number; longitude: number }) => void;
};

function validCoordinates(value: any): value is { latitude: number; longitude: number } {
  return Boolean(value)
    && Number.isFinite(Number(value.latitude))
    && Number.isFinite(Number(value.longitude))
    && Math.abs(Number(value.latitude)) <= 90
    && Math.abs(Number(value.longitude)) <= 180
    && (Number(value.latitude) !== 0 || Number(value.longitude) !== 0);
}

export default function GooglePropertyLocationPicker({ apiKey = '', value, defaultCenter, mapId = '', placesUiKitEnabled = true, onChange }: GooglePropertyLocationPickerProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState('');
  const [locationError, setLocationError] = useState('');
  const onPlacesSelect = useCallback((place: { placeId: string; latitude: number; longitude: number; label?: string }) => {
    updatePin(place.latitude, place.longitude);
    setLocationError('');
  }, []);
  onChangeRef.current = onChange;
  valueRef.current = value;

  function updatePin(latitude: number, longitude: number) {
    const coordinates = { latitude, longitude };
    const position = { lat: latitude, lng: longitude };
    markerRef.current?.setMap(mapRef.current);
    markerRef.current?.setPosition(position);
    mapRef.current?.panTo(position);
    if (mapRef.current) mapRef.current.setZoom(Math.max(Number(mapRef.current.getZoom() || 15), 15));
    onChangeRef.current(coordinates);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setLocationError('Location services are not available in this browser.'); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setLocationError('');
        updatePin(position.coords.latitude, position.coords.longitude);
      },
      (reason) => {
        setLocating(false);
        setLocationError(reason.code === 1 ? 'Allow location access to capture your exact device position.' : 'The device location could not be read. You can still click any point on the map or enter coordinates.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  }

  useEffect(() => {
    if (!apiKey || !mapElement.current) { setMapError(''); return undefined; }
    let active = true;
    let map: any = null;
    let clickListener: any = null;
    let dragListener: any = null;
    const fallbackCenter = defaultCenter && validCoordinates(defaultCenter) ? defaultCenter : { latitude: 20.5937, longitude: 78.9629 };
    setMapError('');

    loadGoogleMaps(apiKey).then((maps) => {
      if (!active || !mapElement.current) return;
      const initial = validCoordinates(valueRef.current) ? valueRef.current : fallbackCenter;
      map = new maps.Map(mapElement.current, {
        center: { lat: Number(initial.latitude), lng: Number(initial.longitude) },
        zoom: validCoordinates(value) ? 17 : 5,
        ...(mapId ? { mapId } : {}),
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
      });
      mapRef.current = map;
      markerRef.current = new maps.Marker({
        map: validCoordinates(value) ? map : null,
        position: { lat: Number(initial.latitude), lng: Number(initial.longitude) },
        title: 'Exact property location',
        draggable: true,
        label: 'P',
      });
      const pick = (latLng: any) => {
        const latitude = Number(latLng?.lat?.());
        const longitude = Number(latLng?.lng?.());
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        updatePin(latitude, longitude);
      };
      clickListener = map.addListener('click', (event: any) => pick(event.latLng));
      dragListener = markerRef.current.addListener('dragend', (event: any) => pick(event.latLng));
      if (validCoordinates(valueRef.current)) {
        const position = { lat: Number(valueRef.current.latitude), lng: Number(valueRef.current.longitude) };
        markerRef.current.setMap(map);
        markerRef.current.setPosition(position);
        map.panTo(position);
        map.setZoom(Math.max(Number(map.getZoom() || 15), 15));
      }
    }).catch((reason) => {
      if (active) setMapError((reason as Error).message || 'Google Maps could not be loaded.');
    });

    return () => {
      active = false;
      clickListener?.remove?.();
      dragListener?.remove?.();
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
      map = null;
    };
  }, [apiKey, defaultCenter?.latitude, defaultCenter?.longitude, mapId]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !validCoordinates(value)) return;
    const position = { lat: Number(value.latitude), lng: Number(value.longitude) };
    markerRef.current.setMap(mapRef.current);
    markerRef.current.setPosition(position);
    mapRef.current.panTo(position);
    mapRef.current.setZoom(Math.max(Number(mapRef.current.getZoom() || 15), 15));
  }, [value?.latitude, value?.longitude]);

  return <Paper elevation={0} sx={{ gridColumn: '1 / -1', p: { xs: 1.5, md: 2 }, border: '1px solid', borderColor: 'primary.main', borderRadius: 3.5, bgcolor: 'rgba(7, 87, 119, .035)' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center"><MyLocationRounded color="primary" /><Typography sx={{ fontWeight: 900 }}>Point the exact property location</Typography></Stack>
        <Typography color="text.secondary" sx={{ fontSize: 12, mt: .35 }}>Click the property entrance or parcel on Google Maps, then drag the pin until it matches the actual location.</Typography>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1}>
        {validCoordinates(value) && <Chip size="small" color="success" icon={<LocationOnRounded />} label="Exact pin captured" />}
        <Button size="small" variant="outlined" startIcon={locating ? <CircularProgress size={15} /> : <MyLocationRounded />} onClick={useCurrentLocation} disabled={locating}>
          {locating ? 'Finding you…' : 'Use my current location'}
        </Button>
      </Stack>
    </Stack>
    {!apiKey && <Alert severity="warning" sx={{ mt: 1.5 }}>Live Google pinning is not configured yet. Enter the latitude and longitude below, or ask an administrator to enable the browser Maps API key in Maps & Navigation.</Alert>}
    {locationError && <Alert severity="warning" sx={{ mt: 1.5 }}>{locationError}</Alert>}
    {apiKey && placesUiKitEnabled && <GooglePlacesUiKit apiKey={apiKey} onSelect={onPlacesSelect} />}
    {apiKey && !mapError && <Box ref={mapElement} sx={{ height: { xs: 270, md: 340 }, mt: 1.5, borderRadius: 3, overflow: 'hidden', bgcolor: 'action.hover' }} />}
    {mapError && <Alert severity="error" sx={{ mt: 1.5 }}>{mapError} Check Google Cloud billing, enable Maps JavaScript API, and allow <code>{typeof window !== 'undefined' ? window.location.origin : 'this site'}/*</code> in the browser key restrictions. Coordinates can still be captured with “Use my current location” or by entering latitude and longitude.</Alert>}
    {apiKey && !mapError && <Typography color="text.secondary" sx={{ fontSize: 12, mt: 1 }}>Click anywhere—even an unlisted village, road, or parcel—to place the pin. No Google locality result is required.</Typography>}
    {!validCoordinates(value) && <Alert severity="info" sx={{ mt: 1.5 }}>No exact coordinates are saved yet. This pin is required before the property can be saved.</Alert>}
  </Paper>;
}
