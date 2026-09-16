import { Box } from '@mui/material';
import { StandaloneDesignStudio } from './SiteAdministrationPage';

/**
 * Dedicated route for the visual editor. Keeping this page separate from the
 * Site Administration tabs means an administrator can open Design Studio
 * directly from the sidebar without navigating through a settings screen.
 */
export default function DesignStudioPage() {
  return <Box sx={{ px: { xs: 1.5, sm: 2.5, lg: 3.5 }, pb: 5 }}>
    <StandaloneDesignStudio />
  </Box>;
}
