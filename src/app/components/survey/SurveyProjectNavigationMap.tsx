import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import DirectionsRounded from '@mui/icons-material/DirectionsRounded';
import GpsFixedRounded from '@mui/icons-material/GpsFixedRounded';
import MapRounded from '@mui/icons-material/MapRounded';
import { computeMapRoute } from '../../services/api';

export type SurveyProjectDestination = { latitude: number; longitude: number } | null;

type NavigationMapProps = {
  apiKey?: string;
  destination: SurveyProjectDestination;
  destinationLabel?: string;
  externalUrl?: string | null;
  travelMode?: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
  defaultZoom?: number;
  mapId?: string;
  directionsEnabled?: boolean;
  routeRefreshSeconds?: number;
  locationUpdateSeconds?: number;
  serverRoutingEnabled?: boolean;
};

type NavigationStatus = 'idle' | 'loading' | 'ready' | 'error';

let googleMapsLoader: Promise<any> | null = null;
let googleMapsAuthFailure = false;
let googleMapsAuthFailureHandler: (() => void) | null = null;
const GOOGLE_MAPS_AUTH_FAILURE_EVENT = 'secureasset:google-maps-auth-failure';
const GOOGLE_MAPS_AUTH_FAILURE_MESSAGE = 'Google rejected this browser API key. Enable Maps JavaScript API, attach billing, and allow this site origin in Google Cloud.';

function installGoogleMapsAuthFailureHandler() {
  const browserWindow = window as typeof window & { gm_authFailure?: () => void; __secureAssetGoogleMapsAuthFailure?: boolean };
  if (googleMapsAuthFailureHandler && browserWindow.gm_authFailure === googleMapsAuthFailureHandler) return;
  const previous = browserWindow.gm_authFailure;
  googleMapsAuthFailureHandler = () => {
    googleMapsAuthFailure = true;
    browserWindow.__secureAssetGoogleMapsAuthFailure = true;
    window.dispatchEvent(new CustomEvent(GOOGLE_MAPS_AUTH_FAILURE_EVENT));
    try { if (previous && previous !== googleMapsAuthFailureHandler) previous(); } catch { /* preserve the provider callback boundary */ }
  };
  browserWindow.gm_authFailure = googleMapsAuthFailureHandler;
}

export function loadGoogleMaps(apiKey: string) {
  if (typeof window === 'undefined') return Promise.reject(new Error('Maps are available in the browser only'));
  const normalizedKey = String(apiKey || '').trim();
  if (!normalizedKey) return Promise.reject(new Error('Configure a Google Maps browser API key to enable live navigation'));
  installGoogleMapsAuthFailureHandler();
  const browserWindow = window as typeof window & { __secureAssetGoogleMapsAuthFailure?: boolean };
  const existingMaps = (window as any).google?.maps;
  if (googleMapsAuthFailure || browserWindow.__secureAssetGoogleMapsAuthFailure) return Promise.reject(new Error(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE));
  if (existingMaps) return Promise.resolve(existingMaps);
  if (googleMapsLoader) return googleMapsLoader;

  googleMapsLoader = new Promise((resolve, reject) => {
    const callbackWindow = window as typeof window & { __secureAssetGoogleMapsReady?: () => void };
    const existingScript = document.querySelector('script[data-secureasset-google-maps]') as HTMLScriptElement | null;
    // A previous failed load can leave a script element behind. Reusing it
    // means its load/error event has already fired and the next page can wait
    // forever. The shared promise protects concurrent mounts, so a stale
    // element is safe to replace here.
    existingScript?.remove();
    let script: HTMLScriptElement | null = null;
    let settled = false;
    let timer: number | undefined;
    const failOnAuthFailure = () => fail(new Error(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE));
    const readyCallback = () => {
      const maps = (window as any).google?.maps;
      if (maps) {
        // importLibrary() is the supported async readiness boundary for the
        // current Maps JavaScript API. It also forces a rejected promise for
        // several invalid-key/API-disabled states before a map is mounted.
        Promise.resolve(maps.importLibrary ? maps.importLibrary('maps') : maps).then(() => {
          if (settled) return;
          settled = true;
          if (timer) window.clearTimeout(timer);
          window.removeEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, failOnAuthFailure);
          if (callbackWindow.__secureAssetGoogleMapsReady === readyCallback) delete callbackWindow.__secureAssetGoogleMapsReady;
          resolve(maps);
        }).catch(() => fail(new Error(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE)));
      }
    };
    const fail = (reason: Error) => {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, failOnAuthFailure);
      if (callbackWindow.__secureAssetGoogleMapsReady === readyCallback) delete callbackWindow.__secureAssetGoogleMapsReady;
      script?.remove();
      reject(reason);
    };
    window.addEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, failOnAuthFailure);
    callbackWindow.__secureAssetGoogleMapsReady = readyCallback;
    script = document.createElement('script');
    script.dataset.secureassetGoogleMaps = 'true';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(normalizedKey)}&v=weekly&loading=async&authReferrerPolicy=origin&callback=__secureAssetGoogleMapsReady&libraries=geometry,places,marker`;
    script.async = true;
    script.defer = true;
    // With the explicit callback, script.onload only confirms that the
    // network request finished. Resolve from the Google callback so an API
    // key error cannot be mistaken for a usable map with a watermark.
    script.onload = () => { if (googleMapsAuthFailure) fail(new Error(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE)); };
    script.onerror = () => fail(new Error('Google Maps could not be loaded. Check the browser API key, billing account, HTTPS origin restriction, and Content-Security-Policy.'));
    document.head.appendChild(script);
    timer = window.setTimeout(() => fail(new Error('Google Maps took too long to load. Check network access and the browser API key configuration.')), 20_000);
  });
  googleMapsLoader.catch(() => { googleMapsLoader = null; });
  return googleMapsLoader;
}

function destinationPoint(destination: SurveyProjectDestination) {
  return destination ? { lat: destination.latitude, lng: destination.longitude } : null;
}

export default function SurveyProjectNavigationMap({ apiKey = '', destination, destinationLabel = 'Survey property', externalUrl, travelMode = 'DRIVING', defaultZoom = 15, mapId = '', directionsEnabled = true, routeRefreshSeconds = 10, locationUpdateSeconds = 5, serverRoutingEnabled = true }: NavigationMapProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const currentMarkerRef = useRef<any>(null);
  const currentAccuracyCircleRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const positionHandlerRef = useRef<((position: GeolocationPosition) => void) | null>(null);
  const routeBusyRef = useRef(false);
  const lastRouteAtRef = useRef(0);
  const [status, setStatus] = useState<NavigationStatus>('idle');
  const [message, setMessage] = useState('');
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [route, setRoute] = useState<{ distance: string; duration: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const travelModeLabel = { DRIVING: 'driving', WALKING: 'walking', BICYCLING: 'bicycling', TRANSIT: 'transit' }[travelMode] || 'driving';

  function locateNow() {
    if (!navigator.geolocation) { setMessage('Location services are not available on this device.'); return; }
    if (!positionHandlerRef.current) { setMessage('Live map is still loading. Try again in a moment.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => { setLocating(false); mapRef.current?.panTo({ lat: position.coords.latitude, lng: position.coords.longitude }); void positionHandlerRef.current?.(position); },
      (reason) => { setLocating(false); setMessage(reason.code === 1 ? 'Allow location access to show your exact live position.' : 'The device location could not be read.'); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  }

  useEffect(() => {
    let active = true;
    let maps: any = null;

    const stopTracking = () => {
      if (watchIdRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      if (destinationMarkerRef.current) destinationMarkerRef.current.setMap(null);
      if (currentMarkerRef.current) currentMarkerRef.current.setMap(null);
      if (currentAccuracyCircleRef.current) currentAccuracyCircleRef.current.setMap(null);
      if (routePolylineRef.current) routePolylineRef.current.setMap(null);
      mapRef.current = null;
      routePolylineRef.current = null;
      destinationMarkerRef.current = null;
      currentMarkerRef.current = null;
      currentAccuracyCircleRef.current = null;
    };

    if (!destination) {
      setStatus('error');
      setMessage('This project does not have a navigable property location yet.');
      return stopTracking;
    }
    if (!apiKey) {
      setStatus('error');
      setMessage('Configure a Google Maps public API key in site settings to enable the live map.');
      return stopTracking;
    }

    setStatus('loading');
    setMessage('Loading live Google navigation…');
    setRoute(null);
    setCurrentPosition(null);
    const onAuthFailure = () => {
      if (!active) return;
      stopTracking();
      setStatus('error');
      setMessage('Google Maps rejected the browser key. Check billing, Maps JavaScript API activation, and the HTTPS referrer restriction in Google Cloud.');
    };
    window.addEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, onAuthFailure);
    loadGoogleMaps(apiKey).then((loadedMaps) => {
      if (!active || !mapElement.current) return;
      maps = loadedMaps;
      const target = destinationPoint(destination);
      const map = new maps.Map(mapElement.current, {
        center: target,
        zoom: Math.min(Math.max(Number(defaultZoom) || 15, 1), 22),
        ...(mapId ? { mapId } : {}),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
      });
      mapRef.current = map;
      destinationMarkerRef.current = new maps.Marker({ map, position: target, title: destinationLabel, label: 'P' });
      setStatus('ready');
      setMessage('Allow location access to show your live position and route.');

      const updateRoute = async (position: GeolocationPosition) => {
        if (!active || !target) return;
        const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPosition({ latitude: origin.lat, longitude: origin.lng, accuracy: position.coords.accuracy });
        if (!currentMarkerRef.current) {
          currentMarkerRef.current = new maps.Marker({
            map,
            position: origin,
            title: 'Your live location',
            icon: { path: maps.SymbolPath?.CIRCLE || 0, scale: 7, fillColor: '#075777', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
          });
          map.panTo(origin);
        } else currentMarkerRef.current.setPosition(origin);
        if (!currentAccuracyCircleRef.current) currentAccuracyCircleRef.current = new maps.Circle({ map, center: origin, radius: Math.min(Math.max(Number(position.coords.accuracy) || 30, 10), 2_000), fillColor: '#0B5270', fillOpacity: 0.12, strokeColor: '#0B5270', strokeOpacity: 0.45, strokeWeight: 1, clickable: false });
        else { currentAccuracyCircleRef.current.setCenter(origin); currentAccuracyCircleRef.current.setRadius(Math.min(Math.max(Number(position.coords.accuracy) || 30, 10), 2_000)); }

        const now = Date.now();
        if (!directionsEnabled || !serverRoutingEnabled || routeBusyRef.current || now - lastRouteAtRef.current < Math.max(Number(routeRefreshSeconds) || 10, 5) * 1000) return;
        routeBusyRef.current = true;
        lastRouteAtRef.current = now;
        try {
          // The legacy DirectionsService / TravelMode.DRIVING path is
          // deliberately not used here. It
          // made the browser key responsible for both rendering and routing,
          // which is the source of the misleading “can't load Google Maps”
          // route failure on restricted production keys. Routes API calls now
          // stay behind the authenticated /maps/routes server boundary.
          const response = await computeMapRoute({ origin: { latitude: origin.lat, longitude: origin.lng }, destination: { latitude: target.lat, longitude: target.lng }, travelMode });
          if (!active) return;
          const nextRoute = response.data?.route;
          if (nextRoute?.encodedPolyline && maps.geometry?.encoding?.decodePath) {
            routePolylineRef.current?.setMap(null);
            routePolylineRef.current = new maps.Polyline({ map, path: maps.geometry.encoding.decodePath(nextRoute.encodedPolyline), geodesic: true, strokeColor: '#0B5270', strokeOpacity: .92, strokeWeight: 5, clickable: false });
          }
          if (nextRoute) setRoute({ distance: nextRoute.distanceText || `${Math.round(nextRoute.distanceMeters || 0)} m`, duration: nextRoute.durationText || `${Math.ceil((nextRoute.durationSeconds || 0) / 60)} min` });
          setMessage('Live route refreshed from your current location.');
        } catch (reason) {
          if (active) setMessage((reason as Error).message || 'Live location is active, but the secured Routes API could not calculate a route.');
        } finally {
          routeBusyRef.current = false;
        }
      };
      positionHandlerRef.current = updateRoute;

      if (!navigator.geolocation) {
        setMessage('Location services are not available on this device.');
        return;
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => { void updateRoute(position); },
        () => { if (active) setMessage('Allow location access to show the live route. You can still open Google Maps directions below.'); },
        { enableHighAccuracy: true, maximumAge: Math.min(Math.max(Number(locationUpdateSeconds) || 5, 1), 60) * 1000, timeout: 20000 },
      );
    }).catch((reason) => {
      if (!active) return;
      setStatus('error');
      setMessage((reason as Error).message || 'Google Maps could not be loaded.');
    });

    return () => {
      active = false;
      window.removeEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, onAuthFailure);
      positionHandlerRef.current = null;
      stopTracking();
      maps = null;
    };
  }, [apiKey, destination?.latitude, destination?.longitude, destinationLabel, travelMode, defaultZoom, mapId, directionsEnabled, routeRefreshSeconds, locationUpdateSeconds, serverRoutingEnabled]);

  const isMapVisible = Boolean(destination && apiKey && status !== 'error');
  return <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
      <Box><Stack direction="row" spacing={1} alignItems="center"><MapRounded color="primary" /><Typography sx={{ fontWeight: 950 }}>Live property navigation</Typography></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: .4 }}>Realtime location and {travelModeLabel} directions to {destinationLabel}.</Typography></Box>
      <Button size="small" variant="outlined" startIcon={locating ? <CircularProgress size={15} /> : <GpsFixedRounded />} onClick={locateNow} disabled={locating || status !== 'ready'}>{locating ? 'Locating…' : 'My location'}</Button>
      <Chip size="small" icon={<GpsFixedRounded />} color={status === 'ready' ? 'success' : status === 'loading' ? 'warning' : 'default'} label={status === 'ready' ? 'Live map' : status === 'loading' ? 'Loading map' : 'Directions'} />
    </Stack>
    {!isMapVisible && <Alert severity="info" sx={{ mt: 2 }}>{message}</Alert>}
    {isMapVisible && <Box ref={mapElement} sx={{ height: { xs: 260, md: 320 }, mt: 2, borderRadius: 3, overflow: 'hidden', bgcolor: 'action.hover' }} />}
    {isMapVisible && message && <Alert severity={status === 'error' ? 'warning' : 'info'} sx={{ mt: 1.5 }}>{message}</Alert>}
    {(currentPosition || route || externalUrl) && <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.2} sx={{ mt: 1.5 }}>
      <Typography variant="body2" color="text.secondary">{currentPosition ? `Live position ±${Math.round(currentPosition.accuracy || 0)} m` : 'Waiting for live position'}{route ? ` · ${route.distance} · ${route.duration}` : ''}</Typography>
      {externalUrl && <Button component="a" href={externalUrl} target="_blank" rel="noreferrer" size="small" variant="outlined" startIcon={<DirectionsRounded />}>Open Google Maps</Button>}
    </Stack>}
  </Paper>;
}
