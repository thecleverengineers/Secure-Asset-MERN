import { useEffect, useState } from 'react';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import HomeRounded from '@mui/icons-material/HomeRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';

type AppLoadingScreenProps = { label?: string; fullScreen?: boolean };

export default function AppLoadingScreen({ label = 'Loading SecureAsset…', fullScreen = false }: AppLoadingScreenProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ minHeight: fullScreen ? '100vh' : 360, display: 'grid', placeItems: 'center', p: 3 }}
    >
      <Stack spacing={1.2} alignItems="center" sx={{ textAlign: 'center', maxWidth: 680, width: 'min(680px, 100%)' }}>
        <Box sx={{ width: '100%', p: { xs: 2, sm: 3 }, border: '1px solid', borderColor: 'divider', borderRadius: 4, bgcolor: 'background.paper', boxShadow: '0 18px 50px rgba(17,40,44,.08)' }}>
          <Stack spacing={1.1}>
            <Skeleton variant="text" width="28%" height={18} />
            <Skeleton variant="rounded" width="64%" height={34} sx={{ borderRadius: 2 }} />
            <Skeleton variant="text" width="88%" height={18} />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, mt: 1 }}>
              <Skeleton variant="rounded" height={74} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rounded" height={74} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rounded" height={74} sx={{ borderRadius: 2 }} />
            </Box>
          </Stack>
        </Box>
        <Typography color="text.secondary" sx={{ fontSize: 13 }}>{slow ? 'This is taking longer than expected.' : label}</Typography>
        {slow && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
            <Button variant="contained" startIcon={<RefreshRounded />} onClick={() => window.location.reload()}>Reload application</Button>
            <Button variant="outlined" startIcon={<HomeRounded />} href="/">Go to home</Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
