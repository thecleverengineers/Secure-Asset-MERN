import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowBackIosNewRounded from '@mui/icons-material/ArrowBackIosNewRounded';
import ArrowForwardIosRounded from '@mui/icons-material/ArrowForwardIosRounded';
import BalconyRounded from '@mui/icons-material/BalconyRounded';
import BathtubRounded from '@mui/icons-material/BathtubRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import ChatRounded from '@mui/icons-material/ChatRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import KitchenRounded from '@mui/icons-material/KitchenRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import OpenInFullRounded from '@mui/icons-material/OpenInFullRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import SquareFootRounded from '@mui/icons-material/SquareFootRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import SupportAgentRounded from '@mui/icons-material/SupportAgentRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import WifiRounded from '@mui/icons-material/WifiRounded';
import WindowRounded from '@mui/icons-material/WindowRounded';
import { publicRentalUnitQueryOptions } from '../queries/propertyQueries';
import OptimizedImage from '../components/shared/OptimizedImage';
import { WorkspaceSkeleton } from '../components/shared/PremiumSkeleton';
import { propertyAllRoomsPath, propertyOverviewPath } from '../utils/propertyUrl';
import { sharePublicListing } from '../utils/publicShare';

const fallback = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=88';
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const sentence = (value: unknown) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function roomStatus(unit: any) {
  const raw = String(unit?.availabilityStatus || '').toUpperCase();
  const available = unit?.canBook !== false && !unit?.isLocked && !unit?.applicationInProgress && !['OCCUPIED','BLOCKED','ARCHIVED'].includes(raw);
  const label = unit?.availabilityLabel || (unit?.isLocked ? 'Occupied' : unit?.applicationInProgress ? 'Application Pending' : raw ? sentence(raw) : 'Available');
  const tone = available
    ? { bg: '#E8FAF1', color: '#087443', dot: '#12B76A' }
    : unit?.applicationInProgress || ['APPLICATION_PENDING','AGREEMENT_PENDING','PAYMENT_PENDING','NOTICE_PERIOD','VACATING'].includes(raw)
      ? { bg: '#FFF7E6', color: '#B54708', dot: '#F79009' }
      : { bg: '#FEECEC', color: '#B42318', dot: '#F04438' };
  return { available, label, tone };
}

function InfoMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Stack alignItems="center" spacing={.45} sx={{ minWidth: 0 }}>
    <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 2.2, bgcolor: '#F5F8FA', color: '#173B55' }}>{icon}</Box>
    <Typography sx={{ color: '#102A43', fontSize: { xs: 10.5, sm: 11.5 }, fontWeight: 800, lineHeight: 1.15, textAlign: 'center' }}>{value}</Typography>
    <Typography sx={{ color: '#7B8D9E', fontSize: 8.6, textAlign: 'center' }}>{label}</Typography>
  </Stack>;
}

export default function RentalRoomDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useQuery(publicRentalUnitQueryOptions(id));
  const structure: any = query.data?.structure || null;
  const property: any = structure?.property || query.data?.listing || null;
  const room: any = structure?.selectedRentalUnit || structure?.rentalUnits?.find((item: any) => String(item._id) === String(id)) || null;
  const loading = query.isPending;
  const error = query.error instanceof Error ? query.error.message : query.error ? 'Could not load this room.' : '';

  const [activeImage, setActiveImage] = useState(0);
  const [similarIndex, setSimilarIndex] = useState(0);
  const [saved, setSaved] = useState(false);

  const images = useMemo(() => {
    const roomImages = [room?.primaryImage?.url, ...(room?.gallery || []).map((item: any) => item.url)].filter(Boolean);
    const propertyImages = [property?.galleryCover, ...(property?.images || [])].filter(Boolean);
    return [...new Set((roomImages.length ? [...roomImages, ...propertyImages] : propertyImages).filter(Boolean))];
  }, [room, property]);

  const floorPlanMedia = useMemo(() => {
    const media = Array.isArray(structure?.media) ? structure.media : [];
    return media.find((item: any) => item?.category === 'floor_plan')?.url || '';
  }, [structure]);

  const similarRooms = useMemo(() => {
    return (structure?.rentalUnits || []).filter((item: any) => String(item?._id) !== String(id));
  }, [structure, id]);

  if (loading) return <WorkspaceSkeleton rows={4} />;
  if (error || !room || !property) return <Container sx={{ py: 10 }}><Alert severity="error">{error || 'Room not found or no longer public.'}</Alert></Container>;

  const specs = room.specifications || {};
  const status = roomStatus(room);
  const canBook = status.available;
  const roomTitle = room.name || `Room ${room.roomNumber}`;
  const shareTitle = `${roomTitle} · ${property.title}`;
  const shareImage = images[0] || fallback;
  const floorName = room.floor?.floorName || room.floor?.name || '';
  const floorNumber = room.floor?.floorNumber;
  const floorLabel = floorName || (floorNumber !== undefined ? `Floor ${floorNumber}` : 'Floor not assigned');
  const address = [
    property.address?.locality,
    property.address?.city,
    property.address?.district,
    property.address?.state,
  ].filter(Boolean).join(', ');
  const roomSize = specs.roomSize?.value ? `${specs.roomSize.value} ${specs.roomSize.unit || 'sqft'}` : 'Not specified';
  const occupancy = specs.maximumOccupants ? `${specs.maximumOccupants} ${Number(specs.maximumOccupants) === 1 ? 'Person' : 'Persons'}` : 'Not specified';
  const roomType = sentence(specs.roomType || 'Private room');
  const rent = Number(room.pricing?.monthlyRent || 0);
  const deposit = Number(room.pricing?.securityDeposit || 0);
  const rating = Number(property.ratingAverage || property.averageRating || property.rating || 0);
  const reviewCount = Number(property.reviewCount || property.reviewsCount || 0);
  const description = room.description || specs.description || property.description || 'A well-planned room with secure booking, transparent pricing, and complete property information through Secure Asset.';

  const amenityNames = [
    specs.bedroomCount ? 'Bed' : '',
    specs.furnishingStatus ? sentence(specs.furnishingStatus) : '',
    specs.studyTable ? 'Study Table' : '',
    specs.airConditioning ? 'AC' : '',
    specs.bathroomAccess ? `${sentence(specs.bathroomAccess)} Bathroom` : '',
    specs.internetWifi ? 'Wi-Fi' : '',
    specs.powerBackup ? 'Power Backup' : '',
    specs.fan ? 'Fan' : '',
    specs.balcony ? 'Balcony' : '',
    specs.window ? 'Window' : '',
    specs.lights ? 'Lights' : '',
    specs.curtains ? 'Curtains' : '',
    specs.kitchenAvailable ? 'Kitchen' : '',
    ...(room.amenities || []),
  ].filter(Boolean);

  const details = [
    ['Room Type', roomType, <BedRounded sx={{ fontSize: 18 }} />],
    ['Floor', floorLabel, <HomeWorkRounded sx={{ fontSize: 18 }} />],
    ['Size', roomSize, <SquareFootRounded sx={{ fontSize: 18 }} />],
    ['Occupancy', occupancy, <GroupsRounded sx={{ fontSize: 18 }} />],
    ['Rent (Monthly)', rent ? money(rent) : 'On request', <DescriptionRounded sx={{ fontSize: 18 }} />],
    ['Security Deposit', deposit ? money(deposit) : 'Not specified', <SecurityRounded sx={{ fontSize: 18 }} />],
    ['Availability', status.label, <CheckCircleRounded sx={{ fontSize: 18 }} />],
    ['Furnishing', sentence(specs.furnishingStatus || 'Not specified'), <BedRounded sx={{ fontSize: 18 }} />],
  ];

  const similarSlideItems = similarRooms.length
    ? [0,1,2,3].map((offset) => similarRooms[(similarIndex + offset) % similarRooms.length])
      .filter((item, index, items) => item && items.findIndex((other) => String(other?._id) === String(item?._id)) === index)
    : [];

  const previousImage = () => setActiveImage((current) => images.length ? (current - 1 + images.length) % images.length : 0);
  const nextImage = () => setActiveImage((current) => images.length ? (current + 1) % images.length : 0);
  const previousSimilar = () => setSimilarIndex((current) => similarRooms.length ? (current - 1 + similarRooms.length) % similarRooms.length : 0);
  const nextSimilar = () => setSimilarIndex((current) => similarRooms.length ? (current + 1) % similarRooms.length : 0);

  const bookRoom = () => navigate(`/app/apply_property/${property._id}?rentalUnit=${room._id}`);
  const contactLandlord = () => navigate(`/app/schedule_visit/${property._id}?rentalUnit=${room._id}`);

  const sectionCard = {
    border: '1px solid #E2E9EF',
    borderRadius: '14px',
    bgcolor: '#FFFFFF',
    boxShadow: '0 7px 22px rgba(24,55,80,.035)',
  } as const;

  return <Box data-secureasset-room-details="approved-premium-room-v217" sx={{
    minHeight: '100vh', bgcolor: '#F7FAFC', pb: { xs: 8, md: 5 },
    fontFamily: '"Open Sans", Arial, sans-serif',
    '& .MuiTypography-root, & .MuiButton-root, & .MuiChip-root': { fontFamily: '"Open Sans", Arial, sans-serif' },
  }}>
    <Container maxWidth={false} sx={{ maxWidth: 1840, px: { xs: 1.1, sm: 2, md: 3.5, xl: 5 }, pt: { xs: 1.2, md: 2 } }}>
      <Stack direction="row" spacing={.6} alignItems="center" sx={{ mb: 1.2, color: '#748699', minWidth: 0 }}>
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(propertyOverviewPath(property))} sx={{ p: 0, minWidth: 0, color: '#61768A', textTransform: 'none', fontSize: 10.5, fontWeight: 700 }}>Home</Button>
        <Typography sx={{ fontSize: 10 }}>›</Typography>
        <Typography noWrap sx={{ fontSize: 10 }}>Marketplace</Typography>
        <Typography sx={{ fontSize: 10 }}>›</Typography>
        <Typography noWrap sx={{ fontSize: 10 }}>{property.title}</Typography>
        <Typography sx={{ fontSize: 10 }}>›</Typography>
        <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#173B55' }}>Room Details</Typography>
      </Stack>

      <Grid container spacing={1.35} alignItems="stretch">
        <Grid size={{ xs: 12, lg: 5 }}>
          <Box sx={{ position: 'relative', height: { xs: 255, sm: 330, lg: 390 }, borderRadius: '12px', overflow: 'hidden', bgcolor: '#EAF0F4' }}>
            <OptimizedImage src={images[activeImage] || fallback} alt={roomTitle} width={1200} height={800} priority sizes="(max-width: 900px) 100vw, 42vw" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <IconButton aria-label="Previous room image" onClick={previousImage} disabled={images.length <= 1} sx={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, bgcolor: 'rgba(7,30,46,.82)', color: '#fff', '&:hover': { bgcolor: 'rgba(7,30,46,.94)' } }}><ArrowBackIosNewRounded sx={{ fontSize: 17 }} /></IconButton>
            <IconButton aria-label="Next room image" onClick={nextImage} disabled={images.length <= 1} sx={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, bgcolor: 'rgba(7,30,46,.82)', color: '#fff', '&:hover': { bgcolor: 'rgba(7,30,46,.94)' } }}><ArrowForwardIosRounded sx={{ fontSize: 17 }} /></IconButton>
            <Chip label={`${activeImage + 1} / ${Math.max(images.length, 1)}`} size="small" sx={{ position: 'absolute', left: 10, bottom: 10, height: 23, bgcolor: 'rgba(7,30,46,.78)', color: '#fff', fontSize: 9, fontWeight: 800 }} />
            <IconButton aria-label="View room photo fullscreen" onClick={() => window.open(images[activeImage] || fallback, '_blank', 'noopener,noreferrer')} sx={{ position: 'absolute', right: 10, bottom: 10, width: 30, height: 30, bgcolor: 'rgba(7,30,46,.78)', color: '#fff', '&:hover': { bgcolor: 'rgba(7,30,46,.94)' } }}><OpenInFullRounded sx={{ fontSize: 16 }} /></IconButton>
          </Box>

          <Stack direction="row" spacing={.7} sx={{ mt: .75, overflowX: 'auto', pb: .15 }}>
            {(images.length ? images : [fallback]).slice(0, 7).map((url: string, index: number) => <Box
              component="button"
              type="button"
              key={`${url}-${index}`}
              aria-label={`Show room image ${index + 1}`}
              onClick={() => setActiveImage(index)}
              sx={{
                p: 0, flex: '0 0 74px', width: 74, height: 54, borderRadius: '5px', overflow: 'hidden', cursor: 'pointer',
                border: index === activeImage ? '2px solid #0A8F74' : '1px solid #DFE7ED',
                bgcolor: '#EDF2F5',
              }}
            ><OptimizedImage src={url} alt="" width={220} height={150} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '5px', display: 'block' }} /></Box>)}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Box sx={{ px: { xs: .25, lg: .9 }, py: { xs: .3, lg: .5 }, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Chip size="small" label={status.label} sx={{ height: 24, bgcolor: status.tone.bg, color: status.tone.color, fontSize: 9.5, fontWeight: 800 }} />
              <Stack direction="row" spacing={.35}>
                <IconButton aria-label="Save room" onClick={() => setSaved((value) => !value)} size="small" sx={{ color: saved ? '#E23E57' : '#587083' }}>{saved ? <FavoriteRounded sx={{ fontSize: 19 }} /> : <FavoriteBorderRounded sx={{ fontSize: 19 }} />}</IconButton>
                <IconButton aria-label={`Share ${shareTitle}`} onClick={() => void sharePublicListing({ title: shareTitle, imageUrl: shareImage, url: window.location.href })} size="small" sx={{ color: '#587083' }}><ShareRounded sx={{ fontSize: 18 }} /></IconButton>
              </Stack>
            </Stack>
            <Typography component="h1" sx={{ mt: .75, color: '#0D2340', fontSize: { xs: 26, md: 30 }, lineHeight: 1.05, letterSpacing: '-.03em', fontWeight: 800 }}>{roomTitle}</Typography>
            <Typography sx={{ mt: .45, color: '#344F66', fontSize: 12.5, fontWeight: 700 }}>{property.title}</Typography>
            {address && <Stack direction="row" spacing={.45} alignItems="center" sx={{ mt: .65 }}><LocationOnRounded sx={{ fontSize: 15, color: '#71869A' }} /><Typography sx={{ color: '#71869A', fontSize: 10.5 }}>{address}</Typography></Stack>}
            {rating > 0 && <Stack direction="row" spacing={.5} alignItems="center" sx={{ mt: .55 }}><StarRounded sx={{ fontSize: 16, color: '#F59E0B' }} /><Typography sx={{ color: '#173B55', fontSize: 10.5, fontWeight: 800 }}>{rating.toFixed(1)}</Typography>{reviewCount > 0 && <Typography sx={{ color: '#7C8D9C', fontSize: 9.5 }}>({reviewCount} reviews)</Typography>}</Stack>}

            <Box sx={{ mt: 1.6, pt: 1.45, borderTop: '1px solid #E7EDF2', display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: .8 }}>
              <InfoMetric icon={<BedRounded sx={{ fontSize: 19 }} />} label="Type" value={roomType} />
              <InfoMetric icon={<HomeWorkRounded sx={{ fontSize: 19 }} />} label="Floor" value={floorLabel} />
              <InfoMetric icon={<SquareFootRounded sx={{ fontSize: 19 }} />} label="Size" value={roomSize} />
              <InfoMetric icon={<GroupsRounded sx={{ fontSize: 19 }} />} label="Capacity" value={occupancy} />
            </Box>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Paper elevation={0} sx={{ ...sectionCard, p: { xs: 1.4, md: 1.6 }, height: '100%' }}>
            <Stack direction="row" alignItems="baseline" spacing={.4}>
              <Typography sx={{ color: '#0D2340', fontSize: { xs: 29, md: 31 }, lineHeight: 1, fontWeight: 800 }}>{rent ? money(rent) : 'On request'}</Typography>
              {rent > 0 && <Typography sx={{ color: '#748699', fontSize: 10.5 }}>/month</Typography>}
            </Stack>
            {deposit > 0 && <Typography sx={{ mt: .55, color: '#6F8191', fontSize: 10.5 }}>Security Deposit: {money(deposit)}</Typography>}
            <Button fullWidth variant="contained" startIcon={<DescriptionRounded />} disabled={!canBook} onClick={bookRoom} sx={{ mt: 1.4, minHeight: 47, bgcolor: '#087F8C', borderRadius: 2, textTransform: 'none', fontSize: 12, fontWeight: 800, boxShadow: '0 8px 18px rgba(8,127,140,.18)', '&:hover': { bgcolor: '#066E79' } }}>{canBook ? 'Book This Room' : status.label}</Button>
            <Button fullWidth variant="outlined" startIcon={<ChatRounded />} onClick={contactLandlord} sx={{ mt: .85, minHeight: 43, borderColor: '#C9D6E0', color: '#173B55', borderRadius: 2, textTransform: 'none', fontSize: 11, fontWeight: 750 }}>Contact Landlord</Button>

            <Stack spacing={.75} sx={{ mt: 1.55 }}>
              {[
                [VerifiedRounded, 'Verified Property'],
                [SecurityRounded, 'Safe & Secure Booking'],
                [ChatRounded, 'Direct Landlord Contact'],
                [DescriptionRounded, 'Agreement Support'],
                [SupportAgentRounded, '24/7 Assistance'],
              ].map(([Icon, label]: any) => <Stack key={label} direction="row" spacing={.7} alignItems="center"><Box sx={{ width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: '#E8FAF1', color: '#0B9B63' }}><Icon sx={{ fontSize: 13 }} /></Box><Typography sx={{ color: '#345066', fontSize: 9.8, fontWeight: 700 }}>{label}</Typography></Stack>)}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ ...sectionCard, mt: 1.5, p: { xs: 1.35, md: 1.8 }, display: { xs: 'none', md: 'block' } }}>
        <Stack direction="row" spacing={.7} alignItems="center"><DescriptionRounded sx={{ color: '#173B55', fontSize: 19 }} /><Typography sx={{ color: '#102A43', fontSize: 15, fontWeight: 800 }}>Room Overview</Typography></Stack>
        <Typography sx={{ mt: .85, color: '#5F7285', fontSize: 11.5, lineHeight: 1.6 }}>{description}</Typography>
        <Box sx={{ mt: 1.45, p: 1.25, borderRadius: 2.5, bgcolor: '#F8FAFC', border: '1px solid #E8EEF3' }}>
          <Grid container spacing={0}>
            {details.map(([label, value, icon], index) => <Grid key={String(label)} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Stack direction="row" spacing={.9} alignItems="center" sx={{ minHeight: 64, px: 1, py: .6, borderRight: { lg: index % 4 !== 3 ? '1px solid #E5EBF0' : 'none' }, borderBottom: index < 4 ? '1px solid #E5EBF0' : 'none' }}>
                <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: '#FFFFFF', color: '#173B55', border: '1px solid #E3EAF0', flexShrink: 0 }}>{icon}</Box>
                <Box sx={{ minWidth: 0 }}><Typography sx={{ color: '#748699', fontSize: 9.2 }}>{label}</Typography><Typography sx={{ mt: .18, color: label === 'Availability' && canBook ? '#087F5B' : '#102A43', fontSize: 10.8, fontWeight: 800 }}>{value}</Typography></Box>
              </Stack>
            </Grid>)}
          </Grid>
        </Box>
      </Paper>

      <Grid container spacing={1.3} sx={{ mt: 0 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ ...sectionCard, mt: 1.3, p: { xs: 1.35, md: 1.6 }, height: { md: '100%' } }}>
            <Stack direction="row" spacing={.65} alignItems="center"><CheckCircleRounded sx={{ color: '#173B55', fontSize: 18 }} /><Typography sx={{ color: '#102A43', fontSize: 14.5, fontWeight: 800 }}>Room Amenities</Typography>{amenityNames.length > 8 && <Chip size="small" label={`+${amenityNames.length - 8} more`} sx={{ height: 20, bgcolor: '#F2F5F7', color: '#597083', fontSize: 8.5 }} />}</Stack>
            <Grid container spacing={.7} sx={{ mt: .55 }}>
              {amenityNames.slice(0, 12).map((name: string, index: number) => {
                const Icon = /wifi/i.test(name) ? WifiRounded : /power/i.test(name) ? BoltRounded : /balcony|window/i.test(name) ? WindowRounded : /kitchen/i.test(name) ? KitchenRounded : /bath/i.test(name) ? BathtubRounded : BedRounded;
                return <Grid key={`${name}-${index}`} size={{ xs: 4, sm: 3, md: 4, lg: 3 }}>
                  <Stack alignItems="center" spacing={.45} sx={{ p: .85, border: '1px solid #E4EBF1', borderRadius: 2, minHeight: 72, bgcolor: '#FFFFFF' }}>
                    <Icon sx={{ fontSize: 18, color: '#173B55' }} />
                    <Typography sx={{ color: '#50677A', fontSize: 8.8, lineHeight: 1.15, textAlign: 'center' }}>{name}</Typography>
                  </Stack>
                </Grid>;
              })}
            </Grid>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ ...sectionCard, mt: 1.3, p: { xs: 1.35, md: 1.6 }, height: { md: '100%' } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Stack direction="row" spacing={.65} alignItems="center"><GridViewRounded sx={{ color: '#173B55', fontSize: 18 }} /><Typography sx={{ color: '#102A43', fontSize: 14.5, fontWeight: 800 }}>Floor Plan & Location</Typography></Stack>
              {floorPlanMedia && <Button size="small" onClick={() => window.open(floorPlanMedia, '_blank', 'noopener,noreferrer')} sx={{ p: 0, minWidth: 0, textTransform: 'none', fontSize: 9.5, fontWeight: 700 }}>View Full Floor Plan →</Button>}
            </Stack>
            <Box sx={{ mt: .8, position: 'relative', height: { xs: 180, md: 190 }, borderRadius: 2, overflow: 'hidden', bgcolor: '#F2F5F7', display: 'grid', placeItems: 'center' }}>
              {floorPlanMedia ? <OptimizedImage src={floorPlanMedia} alt="Floor plan" width={760} height={420} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : <GridViewRounded sx={{ fontSize: 48, color: '#A8B6C1' }} />}
              {floorPlanMedia && <IconButton onClick={() => window.open(floorPlanMedia, '_blank', 'noopener,noreferrer')} sx={{ position: 'absolute', right: 8, bottom: 8, width: 30, height: 30, bgcolor: 'rgba(255,255,255,.94)', color: '#173B55', border: '1px solid #DCE5EC' }}><OpenInFullRounded sx={{ fontSize: 15 }} /></IconButton>}
            </Box>
            <Typography sx={{ mt: .65, color: '#6F8191', fontSize: 9.5 }}>This room is located on {floorLabel.toLowerCase()} of the property.</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 1.3 }}>
        {[
          ['Room Overview', description],
          ['Room Details', details.map(([label, value]) => `${label}: ${value}`).join(' · ')],
          ['Room Amenities', amenityNames.join(' · ') || 'Amenities not specified'],
          ['Floor Plan & Location', `Located on ${floorLabel}. ${floorPlanMedia ? 'Floor plan is available.' : 'Floor plan has not been uploaded yet.'}`],
        ].map(([title, body], index) => <Accordion key={String(title)} defaultExpanded={index === 0} elevation={0} disableGutters sx={{ mb: .65, border: '1px solid #E2E9EF', borderRadius: '10px !important', bgcolor: '#fff', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreRounded sx={{ fontSize: 18 }} />} sx={{ minHeight: 46, px: 1.25, '& .MuiAccordionSummary-content': { my: .8 } }}>
            <Typography sx={{ color: '#102A43', fontSize: 11.5, fontWeight: 800 }}>{title}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, px: 1.25, pb: 1.2 }}><Typography sx={{ color: '#607487', fontSize: 9.7, lineHeight: 1.55 }}>{body}</Typography></AccordionDetails>
        </Accordion>)}
      </Box>

      <Paper elevation={0} sx={{ ...sectionCard, mt: 1.3, p: { xs: 1.25, md: 1.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={.65} alignItems="center"><DescriptionRounded sx={{ color: '#173B55', fontSize: 18 }} /><Typography sx={{ color: '#102A43', fontSize: 14.5, fontWeight: 800 }}>More Photos</Typography></Stack>
          <Button size="small" onClick={() => setActiveImage(0)} sx={{ textTransform: 'none', fontSize: 9.5, fontWeight: 700 }}>View All Photos ({images.length})</Button>
        </Stack>
        <Stack direction="row" spacing={.8} sx={{ mt: .8, overflowX: 'auto', pb: .15 }}>
          {(images.length ? images : [fallback]).slice(0, 8).map((url: string, index: number) => <Box component="button" type="button" key={`more-${url}-${index}`} onClick={() => setActiveImage(index)} sx={{ p: 0, flex: { xs: '0 0 44%', sm: '0 0 23%' }, height: { xs: 100, md: 120 }, border: '1px solid #E2E9EF', borderRadius: '7px', overflow: 'hidden', cursor: 'pointer', bgcolor: '#EDF2F5' }}><OptimizedImage src={url} alt={`Room photo ${index + 1}`} width={460} height={300} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></Box>)}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ ...sectionCard, mt: 1.3, p: { xs: 1.25, md: 1.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Stack direction="row" spacing={.65} alignItems="center"><SecurityRounded sx={{ color: '#173B55', fontSize: 18 }} /><Typography sx={{ color: '#102A43', fontSize: 14.5, fontWeight: 800 }}>Similar Rooms in This Property</Typography></Stack>
          <Stack direction="row" spacing={.5}>
            <IconButton aria-label="Previous similar room" onClick={previousSimilar} disabled={similarRooms.length <= 1} sx={{ width: 30, height: 30, border: '1px solid #DCE5EC', color: '#173B55', bgcolor: '#fff' }}><ArrowBackIosNewRounded sx={{ fontSize: 13 }} /></IconButton>
            <IconButton aria-label="Next similar room" onClick={nextSimilar} disabled={similarRooms.length <= 1} sx={{ width: 30, height: 30, border: '1px solid #DCE5EC', color: '#173B55', bgcolor: '#fff' }}><ArrowForwardIosRounded sx={{ fontSize: 13 }} /></IconButton>
          </Stack>
        </Stack>

        {similarSlideItems.length ? <Grid container spacing={.8} sx={{ mt: .45 }}>
          {similarSlideItems.map((item: any, index: number) => {
            const itemStatus = roomStatus(item);
            const itemImage = item.primaryImage?.url || item.gallery?.find((entry: any) => entry?.url)?.url || property.galleryCover || fallback;
            const itemSize = item.specifications?.roomSize?.value ? `${item.specifications.roomSize.value} ${item.specifications.roomSize.unit || 'sqft'}` : '';
            return <Grid key={String(item._id)} size={{ xs: 6, md: 3 }} sx={{ display: index > 1 ? { xs: 'none', md: 'block' } : 'block' }}>
              <Paper component="button" type="button" onClick={() => navigate(`/room_details/${item._id}`)} elevation={0} sx={{ width: '100%', p: .55, textAlign: 'left', border: '1px solid #E2E9EF', borderRadius: 2.2, bgcolor: '#fff', overflow: 'hidden', cursor: 'pointer', transition: 'transform .18s ease, box-shadow .18s ease', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 9px 20px rgba(25,55,80,.08)' } }}>
                <Box sx={{ position: 'relative', height: { xs: 92, sm: 105, md: 100 }, borderRadius: '5px', overflow: 'hidden', bgcolor: '#EDF2F5' }}>
                  <OptimizedImage src={itemImage} alt={item.name || 'Similar room'} width={430} height={270} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '5px' }} />
                  <Chip size="small" label={itemStatus.label} sx={{ position: 'absolute', left: 5, top: 5, height: 19, bgcolor: itemStatus.tone.bg, color: itemStatus.tone.color, fontSize: 7.6, fontWeight: 800 }} />
                </Box>
                <Box sx={{ px: .25, pt: .55, pb: .15 }}>
                  <Typography noWrap sx={{ color: '#173B55', fontSize: { xs: 9.7, md: 10.8 }, fontWeight: 800 }}>{item.name || `Room ${item.roomNumber}`}</Typography>
                  <Stack direction="row" justifyContent="space-between" spacing={.5} sx={{ mt: .3 }}>
                    <Typography noWrap sx={{ color: '#7A8D9E', fontSize: 7.6 }}>{itemSize || sentence(item.specifications?.roomType || 'Room')}</Typography>
                    <Typography sx={{ color: '#7A8D9E', fontSize: 7.6 }}>{item.floor?.floorName || ''}</Typography>
                  </Stack>
                  <Typography sx={{ mt: .45, color: '#087F5B', fontSize: { xs: 9.4, md: 10.2 }, fontWeight: 800 }}>{money(Number(item.pricing?.monthlyRent || 0))}<Typography component="span" sx={{ color: '#8998A5', fontSize: 7 }}> /month</Typography></Typography>
                </Box>
              </Paper>
            </Grid>;
          })}
        </Grid> : <Typography sx={{ mt: 1, color: '#7A8D9E', fontSize: 10.5 }}>No other public rooms are currently available in this property.</Typography>}
      </Paper>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={.8} justifyContent="space-between" sx={{ mt: 1.3 }}>
        <Button variant="text" startIcon={<ArrowBackRounded />} onClick={() => navigate(propertyOverviewPath(property))} sx={{ color: '#587083', textTransform: 'none', fontSize: 10.5, fontWeight: 700 }}>Back to Property</Button>
        <Button variant="outlined" onClick={() => navigate(propertyAllRoomsPath(property))} sx={{ borderColor: '#D5E0E8', color: '#173B55', borderRadius: 2, textTransform: 'none', fontSize: 10.5, fontWeight: 700 }}>View All Rooms</Button>
      </Stack>
    </Container>
  </Box>;
}
