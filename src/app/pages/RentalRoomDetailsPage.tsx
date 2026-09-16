import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  Alert, Box, Button, Card, CardContent, Chip, Container, Divider, Grid, Paper, Stack, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import BathtubRounded from '@mui/icons-material/BathtubRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import KitchenRounded from '@mui/icons-material/KitchenRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import BalconyRounded from '@mui/icons-material/BalconyRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import { publicRentalUnitQueryOptions } from '../queries/propertyQueries';
import OptimizedImage from '../components/shared/OptimizedImage';
import { WorkspaceSkeleton } from '../components/shared/PremiumSkeleton';
import { propertyOverviewPath } from '../utils/propertyUrl';
import { sharePublicListing } from '../utils/publicShare';

const fallback = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85';
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const sentence = (value: unknown) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function RentalRoomDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useQuery(publicRentalUnitQueryOptions(id));
  const structure: any = query.data?.structure || null;
  const property: any = structure?.property || query.data?.listing || null;
  const room: any = structure?.selectedRentalUnit || structure?.rentalUnits?.find((item: any) => String(item._id) === String(id)) || null;
  const loading = query.isPending;
  const error = query.error instanceof Error ? query.error.message : query.error ? 'Could not load this room.' : '';

  const images = useMemo(() => {
    const roomImages = [room?.primaryImage?.url, ...(room?.gallery || []).map((item: any) => item.url)].filter(Boolean);
    return roomImages.length ? roomImages : [property?.galleryCover, ...(property?.images || [])].filter(Boolean);
  }, [room, property]);

  if (loading) return <WorkspaceSkeleton rows={3} />;
  if (error || !room || !property) return <Container sx={{ py: 10 }}><Alert severity="error">{error || 'Room not found or no longer public.'}</Alert></Container>;

  const specs = room.specifications || {};
  const canBook = room.canBook !== false && !room.isLocked;
  const roomTitle = room.name || `Room ${room.roomNumber}`;
  const shareTitle = `${roomTitle} · ${property.title}`;
  const shareImage = images[0] || fallback;
  const floorLabel = room.floor ? `Floor ${room.floor.floorNumber} · ${room.floor.floorName}` : 'Floor not assigned';
  const featureChips = [
    specs.roomType ? sentence(specs.roomType) : '', specs.bhkConfiguration || '', specs.furnishingStatus ? sentence(specs.furnishingStatus) : '',
    specs.airConditioning ? sentence(specs.airConditioning) : '', specs.bathroomAccess ? `${sentence(specs.bathroomAccess)} bathroom` : '',
    specs.toiletAccess ? `${sentence(specs.toiletAccess)} toilet` : '', specs.kitchenAvailable ? 'Kitchen' : '', specs.balcony ? 'Balcony' : '',
    specs.diningHall ? 'Dining hall' : '', specs.livingRoom ? 'Living room' : '', specs.internetWifi ? 'Internet / Wi-Fi' : '', specs.parkingEligibility ? 'Parking' : '',
  ].filter(Boolean);
  const rows: Array<[string, string]> = [
    ['Room number', room.roomNumber || '—'], ['Floor', floorLabel], ['Room type', sentence(specs.roomType) || '—'],
    ['Furnishing', sentence(specs.furnishingStatus) || '—'], ['Bedrooms', String(specs.bedroomCount ?? '—')],
    ['Bathrooms', `${specs.bathroomCount ?? 0}${specs.bathroomAccess ? ` · ${sentence(specs.bathroomAccess)}` : ''}`],
    ['Toilets', `${specs.toiletCount ?? 0}${specs.toiletAccess ? ` · ${sentence(specs.toiletAccess)}` : ''}`],
    ['Maximum occupants', String(specs.maximumOccupants ?? '—')],
    ['Room size', specs.roomSize?.value ? `${specs.roomSize.value} ${specs.roomSize.unit || 'sqft'}` : '—'],
    ['Available from', room.pricing?.availableFrom ? new Date(room.pricing.availableFrom).toLocaleDateString('en-IN') : 'Immediately / as agreed'],
  ];

  return <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 8 }}>
    <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 4 } }}>
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(propertyOverviewPath(property))} sx={{ mb: 2 }}>Back to property</Button>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} gap={1.5} mb={2}>
        <Box><Typography variant="h3" fontWeight={950} letterSpacing="-.04em">{roomTitle}</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>{property.title} · {floorLabel}</Typography></Box>
        <Stack direction="row" gap={1} alignItems="center" justifyContent="flex-end" flexWrap="wrap">
          <Button data-secureasset-public-room-share="public-room-share-v200" variant="outlined" startIcon={<ShareRounded />} onClick={() => void sharePublicListing({ title: shareTitle, imageUrl: shareImage, url: window.location.href })} aria-label={`Share ${shareTitle}`}>Share</Button>
          <Chip color={room.isLocked ? 'warning' : room.applicationInProgress ? 'info' : 'success'} label={room.availabilityLabel || (room.isLocked ? 'Locked — already booked' : 'Available to book')} />
        </Stack>
      </Stack>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
            <Grid container spacing={.5} sx={{ bgcolor: 'action.hover' }}>
              {(images.length ? images : [fallback]).slice(0, 6).map((url: string, index: number) => <Grid key={`${url}-${index}`} size={{ xs: index === 0 ? 12 : 6, sm: index === 0 ? 8 : 4 }}><OptimizedImage src={url} alt={`${room.name || room.roomNumber} image ${index + 1}`} width={1200} height={index === 0 ? 700 : 360} sizes="(max-width: 900px) 100vw, 66vw" style={{ display: 'block', width: '100%', height: index === 0 ? 400 : 160, objectFit: 'cover' }} /></Grid>)}
            </Grid>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h5" fontWeight={950}>Room features</Typography>
              <Stack direction="row" flexWrap="wrap" gap={.8} mt={1.5}>{featureChips.map((feature: string) => <Chip key={feature} icon={<CheckCircleRounded />} label={feature} variant="outlined" />)}</Stack>
              <Divider sx={{ my: 2.5 }} />
              <Grid container spacing={1.5}>{rows.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6 }}><Stack direction="row" justifyContent="space-between" gap={2} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}><Typography color="text.secondary" fontSize={13}>{label}</Typography><Typography fontWeight={800} fontSize={13} textAlign="right">{value}</Typography></Stack></Grid>)}</Grid>
              {(room.amenities || []).length > 0 && <><Typography variant="h6" fontWeight={900} sx={{ mt: 3 }}>Additional amenities</Typography><Stack direction="row" flexWrap="wrap" gap={.8} mt={1}>{room.amenities.map((item: string) => <Chip key={item} label={item} />)}</Stack></>}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, position: { lg: 'sticky' }, top: { lg: 90 } }}>
            <Typography color="text.secondary" fontSize={11} fontWeight={800}>ROOM MONTHLY RENT</Typography>
            <Typography fontSize={37} fontWeight={950} color="primary">{money(Number(room.pricing?.monthlyRent || 0))}<Typography component="span" color="text.secondary" fontSize={14}> / month</Typography></Typography>
            {room.pricing?.securityDeposit ? <Typography color="text.secondary" fontSize={13}>Security deposit {money(Number(room.pricing.securityDeposit))}</Typography> : null}
            <Divider sx={{ my: 2.5 }} />
            {room.isLocked && <Alert severity="warning" sx={{ mb: 2 }}>This room is locked because another booking or active tenancy is already using it. You can still view every room detail.</Alert>}
            {room.applicationInProgress && <Alert severity="info" sx={{ mb: 2 }}>An application is in progress. The room remains visible while the landlord reviews it.</Alert>}
            <Button fullWidth size="large" variant="contained" disabled={!canBook} onClick={() => navigate(`/app/apply_property/${property._id}?rentalUnit=${room._id}`)}>{canBook ? 'Book Now' : 'Locked'}</Button>
            <Button fullWidth variant="outlined" sx={{ mt: 1 }} onClick={() => navigate(propertyOverviewPath(property))}>View all rooms</Button>
            <Stack direction="row" gap={1} mt={2} alignItems="center"><BedRounded color="disabled" /><Typography variant="body2" color="text.secondary">{specs.bedroomCount || 0} bedroom{Number(specs.bedroomCount) === 1 ? '' : 's'}</Typography><BathtubRounded color="disabled" /><Typography variant="body2" color="text.secondary">{specs.bathroomCount || 0} bath</Typography></Stack>
            {specs.kitchenAvailable && <Stack direction="row" gap={1} mt={1} alignItems="center"><KitchenRounded color="disabled" /><Typography variant="body2" color="text.secondary">Kitchen enabled</Typography></Stack>}
            {specs.balcony && <Stack direction="row" gap={1} mt={1} alignItems="center"><BalconyRounded color="disabled" /><Typography variant="body2" color="text.secondary">Balcony enabled</Typography></Stack>}
            <Stack direction="row" gap={1} mt={1} alignItems="center"><MeetingRoomRounded color="disabled" /><Typography variant="body2" color="text.secondary">{room.availabilityLabel || sentence(room.availabilityStatus)}</Typography></Stack>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  </Box>;
}
