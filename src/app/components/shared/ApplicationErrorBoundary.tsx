import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import HomeRounded from '@mui/icons-material/HomeRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ApplicationErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SecureAsset application render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: 'background.default' }}>
        <Paper elevation={0} sx={{ width: '100%', maxWidth: 560, p: { xs: 3, sm: 5 }, border: '1px solid', borderColor: 'divider', borderRadius: 5 }}>
          <Alert severity="error" sx={{ mb: 3 }}>SecureAsset could not finish loading this page.</Alert>
          <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: '-.035em' }}>A safe recovery is available</Typography>
          <Typography color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.75 }}>No changes were saved. Reload the current release or return to the public home page.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
            <Button variant="contained" startIcon={<RefreshRounded />} onClick={() => window.location.reload()}>Reload application</Button>
            <Button variant="outlined" startIcon={<HomeRounded />} href="/">Go to home</Button>
          </Stack>
        </Paper>
      </Box>
    );
  }
}
