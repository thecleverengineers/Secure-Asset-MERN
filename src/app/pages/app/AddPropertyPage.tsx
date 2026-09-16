import { Box, Button } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { useNavigate } from 'react-router';
import PropertyFormWizard from '../../components/property/PropertyFormWizard';
import { useSite } from '../../context/SiteContext';
import PageHeader from '../../components/layout/PageHeader';

export default function AddPropertyPage() {
  const navigate = useNavigate();
  const { data: siteData } = useSite();

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
    <PageHeader eyebrow="Portfolio" title="Add a property" description="Create a complete listing in four focused steps. Private legal records remain restricted from public views." actions={<Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/app/properties')} variant="outlined">Back to properties</Button>} />
    <PropertyFormWizard
      mode="create"
      layout="page"
      propertyTypes={siteData.propertyTypes || []}
      onClose={() => navigate('/app/properties')}
      onSaved={() => navigate('/app/properties')}
    />
  </Box>;
}
