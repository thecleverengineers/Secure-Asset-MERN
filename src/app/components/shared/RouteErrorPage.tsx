import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import HomeRounded from '@mui/icons-material/HomeRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import { isRouteErrorResponse, useLocation, useRouteError } from 'react-router';
import { useEffect } from 'react';
import { isChunkLoadError } from '../../utils/lazyWithRetry';

export default function RouteErrorPage() {
  const error = useRouteError();
  const location = useLocation();
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const chunkFailure = isChunkLoadError(error);
  const title = chunkFailure ? 'A newer version is available' : status === 404 ? 'Page not found' : 'This page could not be opened';
  const message = chunkFailure
    ? 'The application was updated while this browser tab was open. Reload once to use the latest files.'
    : 'Your data has not been changed. Reload the page, or return to the home page and try again.';
  const errorCode = chunkFailure ? 'asset-version' : status ? `route-${status}` : 'route-runtime';

  useEffect(() => {
    // Keep the visible error safe while leaving a useful route and classified
    // exception in the browser console for support and deployment diagnosis.
    console.error('SecureAsset route error', { path: location.pathname, code: errorCode, error });
  }, [error, errorCode, location.pathname]);

  const reload = () => {
    try {
      window.sessionStorage.removeItem('secureasset_chunk_reload_count');
      window.sessionStorage.removeItem('__secureasset_chunk_retry');
    } catch { /* A strict storage policy must not block recovery. */ }
    const url = new URL(window.location.href);
    url.searchParams.set('__secureasset_asset_refresh', String(Date.now()));
    window.location.replace(url.toString());
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: 'background.default' }}>
      <Paper elevation={0} sx={{ width: '100%', maxWidth: 560, p: { xs: 3, sm: 5 }, border: '1px solid', borderColor: 'divider', borderRadius: 5 }}>
        <Alert severity={chunkFailure ? 'info' : 'error'} sx={{ mb: 3 }}>{status ? `Error ${status}` : 'SecureAsset'} · {errorCode}</Alert>
        <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: '-.035em' }}>{title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.75 }}>{message}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
          <Button variant="contained" startIcon={<RefreshRounded />} onClick={reload}>Reload application</Button>
          <Button variant="outlined" startIcon={<HomeRounded />} href="/">Go to home</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
