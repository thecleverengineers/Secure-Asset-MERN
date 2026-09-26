import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Alert, Box, Button, Chip, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import { publicPropertyQueryOptions } from '../queries/propertyQueries';
import OptimizedImage from '../components/shared/OptimizedImage';
import { WorkspaceSkeleton } from '../components/shared/PremiumSkeleton';
import { propertyOverviewPath } from '../utils/propertyUrl';

const fallback = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85';
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const sentence = (value: unknown) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function roomStatus(unit: any) {
  const rawStatus = String(unit?.availabilityStatus || '').toUpperCase();
  const available = unit?.canBook !== false && !unit?.isLocked && !unit?.applicationInProgress && !['OCCUPIED','BLOCKED','ARCHIVED'].includes(rawStatus);
  const label = unit?.availabilityLabel || (unit?.isLocked ? 'Occupied' : unit?.applicationInProgress ? 'Application Pending' : rawStatus ? sentence(rawStatus) : 'Available');
  const tone = available
    ? { bg: '#EAF9F1', color: '#087443', dot: '#12B76A' }
    : unit?.applicationInProgress || ['APPLICATION_PENDING','AGREEMENT_PENDING','PAYMENT_PENDING','NOTICE_PERIOD','VACATING'].includes(rawStatus)
      ? { bg: '#FFF7E6', color: '#B54708', dot: '#F79009' }
      : { bg: '#FEECEC', color: '#B42318', dot: '#F04438' };
  return { available, label, tone };
}

export default function AllRoomsPage() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useQuery(publicPropertyQueryOptions(slug));
  const structure: any = query.data?.structure || null;
  const property: any = structure?.property || query.data?.listing || null;
  const rentalUnits: any[] = structure?.rentalUnits || [];
  const requestedFloor = new URLSearchParams(location.search).get('floor') || '';
  const [selectedFloorKey, setSelectedFloorKey] = useState(requestedFloor);

  const floorGroups = useMemo(() => {
    const groups = new Map<string, { key: string; floor: any; units: any[] }>();
    rentalUnits.forEach((unit: any) => {
      const floor = unit.floor || null;
      const key = floor?._id ? String(floor._id) : 'unassigned';
      if (!groups.has(key)) groups.set(key, { key, floor, units: [] });
      groups.get(key)?.units.push(unit);
    });
    return [...groups.values()].sort((left, right) => {
      if (!left.floor) return 1;
      if (!right.floor) return -1;
      return Number(left.floor.floorNumber || 0) - Number(right.floor.floorNumber || 0);
    });
  }, [rentalUnits]);

  const activeGroup = floorGroups.find((group) => group.key === selectedFloorKey) || floorGroups[0] || null;
  const activeFloorKey = activeGroup?.key || '';
  const rooms = activeGroup?.units || [];
  const availableCount = rooms.filter((unit) => roomStatus(unit).available).length;
  const occupiedCount = Math.max(0, rooms.length - availableCount);

  if (query.isPending) return <WorkspaceSkeleton rows={4} />;
  const error = query.error instanceof Error ? query.error.message : query.error ? 'Could not load rooms.' : '';
  if (error || !property) return <Container sx={{ py: 10 }}><Alert severity="error">{error || 'Property not found.'}</Alert></Container>;

  const propertyImage = property.galleryCover || property.images?.[0] || structure?.media?.find((item: any) => item?.mediaType === 'image')?.url || fallback;
  const address = [property.address?.locality, property.address?.city, property.address?.district, property.address?.state].filter(Boolean).join(', ');

  return <Box data-secureasset-all-rooms="premium-floor-rooms-v216" sx={{
    minHeight: '100vh', bgcolor: '#F7FAFC', pb: 8,
    fontFamily: '"Open Sans", Arial, sans-serif',
    '& .MuiTypography-root, & .MuiButton-root, & .MuiChip-root': { fontFamily: '"Open Sans", Arial, sans-serif' },
  }}>
    <Container maxWidth={false} sx={{ maxWidth: 1720, px: { xs: 1.25, sm: 2, md: 3.5, xl: 5 }, pt: { xs: 1.5, md: 2.5 } }}>
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(propertyOverviewPath(property))} sx={{ mb: 1.25, px: 0, color: '#5F7285', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: 'transparent', color: '#087F5B' } }}>Back to Property</Button>

      <Paper elevation={0} sx={{ p: { xs: 1.2, md: 1.5 }, border: '1px solid #E2E9EF', borderRadius: 3, bgcolor: '#fff', boxShadow: '0 10px 28px rgba(25,55,80,.04)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.35} alignItems={{ sm: 'center' }}>
          <Box sx={{ width: { xs: '100%', sm: 185 }, height: { xs: 165, sm: 118 }, borderRadius: '8px', overflow: 'hidden', bgcolor: '#EDF2F5', flexShrink: 0 }}>
            <OptimizedImage src={propertyImage} alt={property.title || 'Property'} width={520} height={350} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Chip size="small" label="Available Rooms" sx={{ height: 24, bgcolor: '#EAF9F1', color: '#087443', fontSize: 9.5, fontWeight: 800 }} />
            <Typography sx={{ mt: .65, color: '#102A43', fontSize: { xs: 22, md: 28 }, lineHeight: 1.1, letterSpacing: '-.025em', fontWeight: 800 }}>{property.title || 'Property Rooms'}</Typography>
            {address && <Stack direction="row" spacing={.45} alignItems="center" sx={{ mt: .65 }}><LocationOnRounded sx={{ fontSize: 15, color: '#77899A' }} /><Typography sx={{ color: '#77899A', fontSize: 11 }}>{address}</Typography></Stack>}
          </Box>
          <Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap>
            <Box sx={{ minWidth: 78, px: 1.1, py: .8, borderRadius: 2, bgcolor: '#F7FAFC', border: '1px solid #E7EDF2' }}><Typography sx={{ fontSize: 9, color: '#7D8E9C' }}>TOTAL ROOMS</Typography><Typography sx={{ mt: .1, fontSize: 17, color: '#173B55', fontWeight: 800 }}>{rentalUnits.length}</Typography></Box>
            <Box sx={{ minWidth: 78, px: 1.1, py: .8, borderRadius: 2, bgcolor: '#F0FBF6', border: '1px solid #DDF2E8' }}><Typography sx={{ fontSize: 9, color: '#6F8D7F' }}>AVAILABLE</Typography><Typography sx={{ mt: .1, fontSize: 17, color: '#087F5B', fontWeight: 800 }}>{rentalUnits.filter((unit) => roomStatus(unit).available).length}</Typography></Box>
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ mt: 1.4, p: { xs: 1.25, md: 1.7 }, border: '1px solid #E2E9EF', borderRadius: 3, bgcolor: '#fff', boxShadow: '0 8px 24px rgba(25,55,80,.035)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={.8}>
          <Box>
            <Typography sx={{ color: '#102A43', fontSize: 16, fontWeight: 800 }}>Rooms by Floor</Typography>
            <Typography sx={{ mt: .25, color: '#7A8D9E', fontSize: 10.5 }}>Select a floor to view every room assigned to that floor.</Typography>
          </Box>
          {activeGroup && <Stack direction="row" spacing={.55}><Chip size="small" label={`${rooms.length} rooms`} sx={{ bgcolor: '#F2F5F7', color: '#536A7D', fontSize: 9.5, fontWeight: 700 }} /><Chip size="small" label={`${availableCount} available`} sx={{ bgcolor: '#EAF9F1', color: '#087443', fontSize: 9.5, fontWeight: 700 }} />{occupiedCount > 0 && <Chip size="small" label={`${occupiedCount} unavailable`} sx={{ bgcolor: '#FFF4E7', color: '#B54708', fontSize: 9.5, fontWeight: 700 }} />}</Stack>}
        </Stack>

        {floorGroups.length ? <Box sx={{ mt: 1.2, overflowX: 'auto', pb: .25 }}>
          <Stack direction="row" spacing={.65} sx={{ minWidth: 'max-content' }}>
            {floorGroups.map((group) => {
              const floor = group.floor;
              const selected = group.key === activeFloorKey;
              const floorLabel = floor?.floorName || floor?.name || floor?.floorCode || (floor?.floorNumber !== undefined ? `Floor ${floor.floorNumber}` : 'Other Rooms');
              return <Button key={group.key} size="small" onClick={() => setSelectedFloorKey(group.key)} sx={{
                minHeight: 36, px: 1.4, borderRadius: 2,
                border: selected ? '1px solid #087F5B' : '1px solid #DFE7ED',
                bgcolor: selected ? '#EAF8F2' : '#FFFFFF',
                color: selected ? '#087F5B' : '#587083',
                textTransform: 'none', fontSize: 10.5, fontWeight: selected ? 800 : 700,
                '&:hover': { bgcolor: selected ? '#E3F6ED' : '#F8FAFB' },
              }}>{floorLabel}<Box component="span" sx={{ ml: .65, minWidth: 18, height: 18, px: .5, borderRadius: 99, display: 'inline-grid', placeItems: 'center', bgcolor: selected ? '#087F5B' : '#EEF3F6', color: selected ? '#fff' : '#708596', fontSize: 8.5, fontWeight: 800 }}>{group.units.length}</Box></Button>;
            })}
          </Stack>
        </Box> : <Alert severity="info" sx={{ mt: 1.2 }}>No public rental rooms are available for this property.</Alert>}

        <Grid container spacing={1} sx={{ mt: .55 }}>
          {rooms.map((unit: any) => {
            const roomImage = unit.primaryImage?.url || unit.gallery?.find((item: any) => item?.url)?.url || propertyImage;
            const status = roomStatus(unit);
            const roomType = sentence(unit.specifications?.roomType || unit.roomType || 'Private room');
            const floorText = unit.floor?.floorName || (unit.floor?.floorNumber !== undefined ? `Floor ${unit.floor.floorNumber}` : '');
            const roomSize = unit.specifications?.roomSize?.value ? `${unit.specifications.roomSize.value} ${unit.specifications.roomSize.unit || 'sqft'}` : '';
            return <Grid key={unit._id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Paper component="button" type="button" onClick={() => navigate(`/room_details/${unit._id}`)} elevation={0} sx={{
                width: '100%', minHeight: 112, p: .75, display: 'flex', alignItems: 'stretch', gap: .95,
                textAlign: 'left', border: '1px solid #E3E9EE', borderRadius: 2, bgcolor: '#fff', cursor: 'pointer',
                boxShadow: '0 4px 13px rgba(25,55,80,.025)', transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
                '&:hover': { transform: 'translateY(-2px)', borderColor: '#C7D6E1', boxShadow: '0 10px 24px rgba(25,55,80,.08)' },
              }}>
                <Box sx={{ width: { xs: 112, sm: 118 }, minWidth: { xs: 112, sm: 118 }, height: 96, overflow: 'hidden', borderRadius: '5px', bgcolor: '#EDF2F5', flexShrink: 0 }}>
                  <OptimizedImage src={roomImage} alt={unit.name || `Room ${unit.roomNumber}`} width={360} height={280} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '5px', display: 'block' }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, py: .15, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" spacing={.5} alignItems="flex-start">
                      <Typography noWrap sx={{ minWidth: 0, flex: 1, color: '#173B55', fontSize: 12, lineHeight: 1.2, fontWeight: 800 }}>{unit.name || `Room ${unit.roomNumber}`}</Typography>
                      <Chip size="small" label={<Stack component="span" direction="row" spacing={.35} alignItems="center"><Box component="span" sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: status.tone.dot }} />{status.label}</Stack>} sx={{ height: 20, maxWidth: 112, bgcolor: status.tone.bg, color: status.tone.color, fontSize: 8, fontWeight: 800, '& .MuiChip-label': { px: .55, overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                    </Stack>
                    <Stack direction="row" spacing={.4} alignItems="center" sx={{ mt: .4 }}><BedRounded sx={{ fontSize: 13, color: '#8393A1' }} /><Typography noWrap sx={{ fontSize: 9, color: '#75889A' }}>{[roomType, floorText].filter(Boolean).join(' · ')}</Typography></Stack>
                    {roomSize && <Typography noWrap sx={{ mt: .25, fontSize: 8.8, color: '#8A98A6' }}>Approx. {roomSize}</Typography>}
                  </Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-end" spacing={.5}>
                    <Box><Typography sx={{ color: '#087F5B', fontSize: 12.5, lineHeight: 1, fontWeight: 800 }}>{money(Number(unit.pricing?.monthlyRent || 0))}</Typography><Typography sx={{ mt: .1, color: '#8A98A6', fontSize: 7.8 }}>per month</Typography></Box>
                    <Typography sx={{ color: '#4E6A80', fontSize: 8.5, fontWeight: 700 }}>View →</Typography>
                  </Stack>
                </Box>
              </Paper>
            </Grid>;
          })}
        </Grid>

        {activeGroup && rooms.length === 0 && <Alert severity="info" sx={{ mt: 1.2 }}>No rooms are currently assigned to this floor.</Alert>}
      </Paper>

      <Paper elevation={0} sx={{ mt: 1.4, p: 1.4, border: '1px solid #E2E9EF', borderRadius: 3, bgcolor: '#fff' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
          <Stack direction="row" spacing={.8} alignItems="center"><HomeWorkRounded sx={{ color: '#087F5B' }} /><Box><Typography sx={{ color: '#173B55', fontSize: 12.5, fontWeight: 800 }}>Need more property information?</Typography><Typography sx={{ color: '#8291A0', fontSize: 9.5 }}>Return to the property overview for amenities, location, floor plan, rules, and the interactive tour.</Typography></Box></Stack>
          <Button variant="outlined" onClick={() => navigate(propertyOverviewPath(property))} sx={{ borderColor: '#D5E0E8', color: '#173B55', borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>Property Overview</Button>
        </Stack>
      </Paper>
    </Container>
  </Box>;
}
