import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  Box, Button, Chip, Divider, IconButton, Paper, Stack, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import BathtubOutlined from '@mui/icons-material/BathtubOutlined';
import BedOutlined from '@mui/icons-material/BedOutlined';
import ChairOutlined from '@mui/icons-material/ChairOutlined';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CropFreeRounded from '@mui/icons-material/CropFreeRounded';
import DeckOutlined from '@mui/icons-material/DeckOutlined';
import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import KeyboardArrowRightRounded from '@mui/icons-material/KeyboardArrowRightRounded';
import KingBedOutlined from '@mui/icons-material/KingBedOutlined';
import KitchenOutlined from '@mui/icons-material/KitchenOutlined';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import MapOutlined from '@mui/icons-material/MapOutlined';
import ShareRounded from '@mui/icons-material/ShareRounded';
import ShowerOutlined from '@mui/icons-material/ShowerOutlined';
import SquareFootOutlined from '@mui/icons-material/SquareFootOutlined';
import ViewInArOutlined from '@mui/icons-material/ViewInArOutlined';
import WifiRounded from '@mui/icons-material/WifiRounded';
import OptimizedImage from '../shared/OptimizedImage';

const fallback = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=88';
const FRAME_RADIUS = '1px';
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const sentence = (value: unknown) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

type TourProps = {
  property: any;
  units: any[];
  onBack: () => void;
  onBook: (unit: any) => void;
  onShare: () => void;
  onToggleSaved: () => void;
  onView: (unit: any) => void;
  saved: boolean;
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'bedroom', label: 'Bedrooms' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'bathroom', label: 'Bathrooms' },
  { key: 'living_room', label: 'Living' },
  { key: 'furniture', label: 'Amenities' },
  { key: 'balcony', label: 'Balcony' },
];

const HOTSPOT_LAYOUT = [
  { left: '9%', top: '43%', label: 'Kitchen', category: 'kitchen' },
  { left: '44%', top: '45%', label: 'Balcony', category: 'balcony' },
  { left: '79%', top: '37%', label: 'Bedroom', category: 'bedroom' },
  { left: '83%', top: '67%', label: 'Bathroom', category: 'bathroom' },
  { left: '39%', top: '79%', label: '360° View', category: 'living_room' },
];

function imageItems(unit: any) {
  return [unit?.primaryImage, ...(Array.isArray(unit?.gallery) ? unit.gallery : [])].filter((item) => item?.url);
}

function roomStatus(unit: any) {
  const available = unit?.canBook !== false && !unit?.isLocked;
  return {
    available,
    label: available ? unit?.availabilityLabel || 'Available' : sentence(unit?.availabilityStatus || 'Booked'),
  };
}

function amenityItems(unit: any) {
  const specifications = unit?.specifications || {};
  return [
    specifications.bathroomAccess === 'attached' ? { icon: ShowerOutlined, label: 'Attached Bath' } : null,
    specifications.balcony ? { icon: DeckOutlined, label: 'Balcony' } : null,
    specifications.internetWifi ? { icon: WifiRounded, label: 'Wi-Fi' } : null,
    { icon: ChairOutlined, label: sentence(specifications.furnishingStatus || 'Furnished') },
  ].filter(Boolean) as Array<{ icon: typeof ShowerOutlined; label: string }>;
}

function RoomFacts({ unit, compact = false }: { unit: any; compact?: boolean }) {
  const specifications = unit?.specifications || {};
  const facts = [
    { Icon: SquareFootOutlined, value: `${Number(specifications.roomSize?.value || 0).toLocaleString()} ${specifications.roomSize?.unit || 'sqft'}`, label: 'Size' },
    { Icon: KingBedOutlined, value: sentence(specifications.furnishingStatus || 'Not specified'), label: 'Furnishing' },
  ];
  return <Stack direction={compact ? 'row' : 'column'} spacing={compact ? 2 : 2.1} flexWrap="wrap">
    {facts.map(({ Icon, value, label }) => <Stack direction="row" spacing={1.2} alignItems="center" key={label}>
      <Icon sx={{ color: '#0B5270', fontSize: compact ? 19 : 24 }} />
      <Box><Typography fontWeight={900} fontSize={compact ? 12 : 15} lineHeight={1.15}>{value}</Typography>{!compact && <Typography color="text.secondary" fontSize={11.5}>{label}</Typography>}</Box>
    </Stack>)}
  </Stack>;
}

function RoomAmenities({ unit, compact = false }: { unit: any; compact?: boolean }) {
  return <Stack direction="row" justifyContent="space-between" spacing={.75} sx={{ width: '100%' }}>
    {amenityItems(unit).map(({ icon: Icon, label }) => <Stack key={label} alignItems="center" spacing={.35} sx={{ minWidth: 0, flex: 1 }}>
      <Icon sx={{ color: '#0B5270', fontSize: compact ? 18 : 22 }} />
      <Typography noWrap title={label} fontSize={compact ? 9 : 9.5} color="text.secondary" textAlign="center">{label}</Typography>
    </Stack>)}
  </Stack>;
}

function RoomCard({ unit, active, onSelect }: { unit: any; active: boolean; onSelect: () => void }) {
  const status = roomStatus(unit);
  const image = imageItems(unit)[0]?.url || fallback;
  return <Paper
    component="button"
    type="button"
    onClick={onSelect}
    elevation={0}
    sx={{
      flex: '0 0 240px', width: 240, border: '1px solid', borderColor: active ? '#008C73' : '#E3EAEF',
      borderRadius: FRAME_RADIUS, bgcolor: '#fff', p: 1, textAlign: 'left', cursor: 'pointer', color: 'inherit',
      transition: 'transform .2s ease, box-shadow .2s ease', boxShadow: active ? '0 10px 24px rgba(5, 97, 82, .14)' : '0 5px 16px rgba(16, 42, 67, .06)',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 28px rgba(16, 42, 67, .13)' },
    }}
  >
    <Stack direction="row" spacing={1.15} alignItems="center">
      <Box sx={{ width: 78, height: 72, borderRadius: FRAME_RADIUS, overflow: 'hidden', flexShrink: 0 }}><OptimizedImage src={image} alt={unit.name || unit.roomNumber} width={180} height={150} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap fontWeight={950} fontSize={13}>{unit.name || `Room ${unit.roomNumber}`}</Typography>
        <Typography noWrap color="text.secondary" fontSize={10.5}>{sentence(unit.specifications?.roomType || 'Private room')}</Typography>
        <Chip size="small" label={status.label} sx={{ mt: .6, height: 20, bgcolor: status.available ? '#DDF7EC' : '#FFE5E5', color: status.available ? '#08785E' : '#C12D2D', fontSize: 9.5, fontWeight: 850 }} />
        <Typography noWrap fontWeight={950} fontSize={12.5} mt={.55}>{money(Number(unit.pricing?.monthlyRent || 0))} / month</Typography>
      </Box>
    </Stack>
  </Paper>;
}

export default function InteractivePropertyTour({ property, units, onBack, onBook, onShare, onToggleSaved, onView, saved }: TourProps) {
  const [selectedId, setSelectedId] = useState(String(units[0]?._id || ''));
  const [category, setCategory] = useState('all');
  const [tab, setTab] = useState<'photos' | 'tour' | 'floor'>('tour');
  const [detailsOpen, setDetailsOpen] = useState(true);
  const selected = units.find((unit) => String(unit._id) === selectedId) || units[0] || null;
  const selectedImages = imageItems(selected);
  const categoryImage = selectedImages.find((item) => category === 'all' || item.category === category)?.url;
  const heroImage = categoryImage || selectedImages[0]?.url || property.galleryCover || property.images?.[0] || fallback;
  const status = roomStatus(selected);
  const address = [property.address?.locality, property.address?.city, property.address?.state].filter(Boolean).join(', ');
  const allImages = units.flatMap(imageItems);
  const filterCounts = useMemo(() => Object.fromEntries(FILTERS.map((filter) => [filter.key, filter.key === 'all' ? allImages.length : allImages.filter((image) => image.category === filter.key).length])), [allImages]);
  const floorGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; units: any[] }>();
    units.forEach((unit) => {
      const key = unit.floor?._id ? String(unit.floor._id) : 'all-rooms';
      const label = unit.floor ? `${unit.floor.floorName || `Floor ${unit.floor.floorNumber}`}` : 'All Rooms';
      if (!groups.has(key)) groups.set(key, { key, label, units: [] });
      groups.get(key)?.units.push(unit);
    });
    return [...groups.values()];
  }, [units]);

  useEffect(() => {
    if (!units.some((unit) => String(unit._id) === selectedId)) setSelectedId(String(units[0]?._id || ''));
  }, [selectedId, units]);

  const selectRoom = (unit: any) => { setSelectedId(String(unit._id)); setDetailsOpen(true); };
  const activateHotspot = (index: number, hotspot: typeof HOTSPOT_LAYOUT[number]) => {
    const unit = units[index % Math.max(units.length, 1)] || selected;
    if (unit) selectRoom(unit);
    setCategory(hotspot.category);
  };
  const hotspotKey = (event: KeyboardEvent<HTMLButtonElement>, index: number, hotspot: typeof HOTSPOT_LAYOUT[number]) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateHotspot(index, hotspot); }
  };

  if (!selected) return null;

  return <Paper
    data-secureasset-interactive-tour="reference-clone-v203"
    elevation={0}
    sx={{
      overflow: 'hidden', borderRadius: FRAME_RADIUS, border: '1px solid #E4EBF0', bgcolor: '#FBFDFE', boxShadow: { xs: 'none', sm: '0 24px 70px rgba(17, 52, 75, .1)' },
      '& .MuiButton-root, & .MuiIconButton-root, & .MuiChip-root': { borderRadius: FRAME_RADIUS },
    }}
  >
    <Box sx={{ p: { xs: 1.6, sm: 2.5, lg: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: { xs: 1.2, md: 2 } }}>
        <Button startIcon={<ArrowBackRounded />} onClick={onBack} sx={{ px: .5, color: '#102A43', fontWeight: 850, textTransform: 'none' }}>Back to properties</Button>
        <Stack direction="row" spacing={.5}>
          <IconButton aria-label="Share property" onClick={onShare} sx={{ color: '#102A43' }}><ShareRounded fontSize="small" /></IconButton>
          <IconButton aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'} onClick={onToggleSaved} sx={{ color: saved ? '#E45757' : '#102A43' }}>{saved ? <FavoriteRounded fontSize="small" /> : <FavoriteBorderRounded fontSize="small" />}</IconButton>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-end' }} spacing={1.4}>
        <Box>
          <Stack direction="row" spacing={.6} alignItems="center" sx={{ color: '#718096', mb: .7 }}><Typography fontSize={11}>Properties</Typography><Typography fontSize={11}>›</Typography><Typography fontSize={11}>{property.title}</Typography><Typography fontSize={11}>›</Typography><Typography fontSize={11} color="#008C73">Interactive Tour</Typography></Stack>
          <Typography component="h1" sx={{ color: '#102A43', fontWeight: 950, fontSize: { xs: 25, sm: 32, lg: 38 }, letterSpacing: '-.045em', lineHeight: 1.02 }}>Interactive Property Tour</Typography>
          <Typography sx={{ color: '#173B55', fontWeight: 850, fontSize: { xs: 14, md: 18 }, mt: .45 }}>{property.title} · {sentence(property.type)} Rental</Typography>
        </Box>
        <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
          <Stack direction="row" spacing={.6} justifyContent={{ md: 'flex-end' }} alignItems="center"><LocationOnOutlined sx={{ fontSize: 18, color: '#0B5270' }} /><Typography fontWeight={800} fontSize={12.5}>{address || 'Location available on request'}</Typography></Stack>
          <Typography color="text.secondary" fontSize={11.5} mt={.45}>Explore every room before you book.</Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={.8} sx={{ display: { xs: 'none', md: 'flex' }, mt: 2.2, overflowX: 'auto', pb: .35 }}>
        {FILTERS.map((filter) => <Chip key={filter.key} clickable onClick={() => setCategory(filter.key)} label={<>{filter.label} <Box component="span" sx={{ ml: .55, color: category === filter.key ? 'inherit' : '#8A98A8' }}>{filterCounts[filter.key] || 0}</Box></>} sx={{ height: 34, borderRadius: FRAME_RADIUS, bgcolor: category === filter.key ? '#008C73' : '#fff', color: category === filter.key ? '#fff' : '#345', border: '1px solid', borderColor: category === filter.key ? '#008C73' : '#E4EAF0', fontWeight: 800, boxShadow: category === filter.key ? '0 7px 18px rgba(0, 140, 115, .2)' : 'none' }} />)}
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<MapOutlined />} sx={{ minWidth: 150, borderColor: '#153B55', color: '#153B55', fontWeight: 850 }}>View Floor Plan</Button>
        <Button variant="contained" endIcon={<KeyboardArrowRightRounded />} sx={{ minWidth: 140, bgcolor: '#008C73', fontWeight: 900, boxShadow: '0 8px 20px rgba(0,140,115,.2)', '&:hover': { bgcolor: '#007660' } }}>Start Tour</Button>
      </Stack>

      <Stack direction="row" sx={{ display: { xs: 'flex', md: 'none' }, mt: 1.6, mx: -1.6, px: 1.6, borderBottom: '1px solid #E5EBF0' }}>
        {([['photos', 'Photos'], ['tour', 'Interactive Tour'], ['floor', 'Floor Plan']] as const).map(([value, label]) => <Button key={value} onClick={() => setTab(value)} sx={{ flex: 1, borderRadius: 0, color: tab === value ? '#008C73' : '#64748B', borderBottom: '2px solid', borderColor: tab === value ? '#008C73' : 'transparent', fontSize: 11.5, fontWeight: tab === value ? 900 : 700 }}>{label}</Button>)}
      </Stack>

      <Box sx={{ mt: { xs: 1.2, md: 1.7 }, display: { md: 'grid' }, gridTemplateColumns: { md: 'minmax(0, 1fr) 280px', lg: 'minmax(0, 1fr) 320px' }, gap: 1.6 }}>
        <Box sx={{ position: 'relative', height: { xs: 425, sm: 500, md: 520 }, borderRadius: FRAME_RADIUS, overflow: 'hidden', bgcolor: '#DDE8EA' }}>
          <OptimizedImage src={heroImage} alt={`${selected.name || property.title} interactive view`} width={1600} height={1000} sizes="(max-width: 900px) 100vw, 70vw" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,30,42,.03), rgba(8,30,42,.08) 55%, rgba(8,30,42,.28))' }} />
          {tab === 'tour' && HOTSPOT_LAYOUT.map((hotspot, index) => <Box key={hotspot.label} component="button" type="button" onClick={() => activateHotspot(index, hotspot)} onKeyDown={(event) => hotspotKey(event, index, hotspot)} aria-label={`Explore ${hotspot.label}`} sx={{ position: 'absolute', left: hotspot.left, top: hotspot.top, transform: 'translate(-50%,-50%)', border: 0, bgcolor: 'transparent', p: 0, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: .55, zIndex: 2 }}>
            <Box sx={{ width: { xs: 28, md: 34 }, height: { xs: 28, md: 34 }, borderRadius: '50%', bgcolor: '#00A78B', border: '4px solid rgba(255,255,255,.94)', boxShadow: '0 0 0 6px rgba(0,167,139,.26), 0 5px 18px rgba(0,0,0,.28)', display: 'grid', placeItems: 'center' }}><Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#fff' }} /></Box>
            <Typography sx={{ display: { xs: index === 4 ? 'block' : 'none', sm: 'block' }, bgcolor: 'rgba(9,31,43,.78)', px: .8, py: .4, borderRadius: FRAME_RADIUS, fontSize: { xs: 9, md: 11 }, fontWeight: 850, backdropFilter: 'blur(7px)', whiteSpace: 'nowrap' }}>{hotspot.label}</Typography>
          </Box>)}
          {tab === 'floor' && <Box sx={{ position: 'absolute', inset: 16, bgcolor: 'rgba(255,255,255,.94)', borderRadius: FRAME_RADIUS, display: 'grid', placeItems: 'center', textAlign: 'center', p: 3 }}><Box><MapOutlined sx={{ fontSize: 54, color: '#008C73' }} /><Typography fontWeight={950} color="#102A43">Floor plan overview</Typography><Typography color="text.secondary" fontSize={12}>Choose a room below to inspect its placement and dimensions.</Typography></Box></Box>}
          <Stack direction="row" spacing={.8} alignItems="center" sx={{ position: 'absolute', left: 14, bottom: 13, px: 1.1, py: .55, bgcolor: 'rgba(7,26,36,.76)', color: '#fff', borderRadius: FRAME_RADIUS, backdropFilter: 'blur(8px)' }}><LocationOnOutlined sx={{ fontSize: 15 }} /><Typography fontSize={10.5} fontWeight={750}>Click hotspots to explore the property</Typography></Stack>
          <IconButton aria-label="Open full screen tour" sx={{ position: 'absolute', right: 12, bottom: 12, color: '#fff', bgcolor: 'rgba(7,26,36,.62)', '&:hover': { bgcolor: 'rgba(7,26,36,.82)' } }}><CropFreeRounded fontSize="small" /></IconButton>
        </Box>

        <Paper variant="outlined" sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', borderRadius: FRAME_RADIUS, p: 2.2, borderColor: '#E2E9EE', bgcolor: '#fff' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}><Typography fontWeight={950} fontSize={20}>{selected.name || `Room ${selected.roomNumber}`}</Typography><Chip size="small" label={status.label} sx={{ bgcolor: status.available ? '#DDF7EC' : '#FFE5E5', color: status.available ? '#08785E' : '#C12D2D', fontWeight: 900 }} /></Stack>
          <Typography color="text.secondary" fontSize={12.5} lineHeight={1.55} mt={1}>Comfortable, well-ventilated {sentence(selected.specifications?.roomType || 'private room')} with carefully selected amenities.</Typography>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={2.2}>
            <Stack direction="row" spacing={1.2} alignItems="center"><Typography sx={{ color: '#0B5270', fontWeight: 950, fontSize: 24 }}>₹</Typography><Box><Typography fontWeight={950}>{money(Number(selected.pricing?.monthlyRent || 0))} / month</Typography><Typography color="text.secondary" fontSize={11.5}>Rent</Typography></Box></Stack>
            <RoomFacts unit={selected} />
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Typography fontWeight={900} fontSize={12.5} mb={1.5}>Amenities</Typography>
          <RoomAmenities unit={selected} />
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1} mt={2.2}><Button fullWidth variant="outlined" onClick={() => onView(selected)} sx={{ borderColor: '#173B55', color: '#173B55', fontWeight: 900 }}>View Room</Button><Button fullWidth variant="contained" disabled={!status.available} onClick={() => onBook(selected)} sx={{ bgcolor: '#008C73', fontWeight: 900, '&:hover': { bgcolor: '#007660' } }}>Book Now</Button></Stack>
        </Paper>
      </Box>

      <Box sx={{ display: { xs: 'block', md: 'none' }, position: 'relative', mt: -1.3, zIndex: 3 }}>
        {detailsOpen ? <Paper elevation={5} sx={{ mx: .5, p: 1.5, borderRadius: FRAME_RADIUS, bgcolor: '#fff' }}>
          <Stack direction="row" spacing={1.2} alignItems="flex-start"><Box sx={{ width: 82, height: 72, borderRadius: FRAME_RADIUS, overflow: 'hidden', flexShrink: 0 }}><OptimizedImage src={selectedImages[0]?.url || fallback} alt={selected.name || selected.roomNumber} width={190} height={160} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Box><Box sx={{ flex: 1, minWidth: 0 }}><Stack direction="row" justifyContent="space-between"><Box><Typography noWrap fontWeight={950} fontSize={14}>{selected.name || `Room ${selected.roomNumber}`}</Typography><Chip size="small" label={status.label} sx={{ mt: .4, height: 21, bgcolor: status.available ? '#DDF7EC' : '#FFE5E5', color: status.available ? '#08785E' : '#C12D2D', fontSize: 9.5, fontWeight: 900 }} /></Box><IconButton size="small" onClick={() => setDetailsOpen(false)}><CloseRounded fontSize="small" /></IconButton></Stack><Typography fontWeight={950} fontSize={13} mt={.5}>{money(Number(selected.pricing?.monthlyRent || 0))} / month</Typography></Box></Stack>
          <Divider sx={{ my: 1.3 }} />
          <RoomFacts unit={selected} compact />
          <Divider sx={{ my: 1.3 }} />
          <RoomAmenities unit={selected} compact />
          <Stack direction="row" spacing={1} mt={1.4}><Button fullWidth variant="outlined" onClick={() => onView(selected)} sx={{ color: '#153B55', borderColor: '#153B55', fontWeight: 900 }}>View Room</Button><Button fullWidth variant="contained" disabled={!status.available} onClick={() => onBook(selected)} sx={{ bgcolor: '#008C73', fontWeight: 900 }}>Book Now</Button></Stack>
        </Paper> : <Button fullWidth variant="contained" onClick={() => setDetailsOpen(true)} sx={{ bgcolor: '#008C73', fontWeight: 900 }}>View selected room</Button>}
      </Box>

      <Stack direction="row" spacing={.8} sx={{ mt: { xs: 2, md: 1.6 }, overflowX: 'auto', pb: .4 }}>
        {floorGroups.map((group, index) => <Chip key={group.key} icon={index === 0 ? <HomeOutlined /> : <BedOutlined />} label={group.label} sx={{ height: 34, bgcolor: index === 0 ? '#E4F8F4' : '#F4F7FA', color: index === 0 ? '#08725F' : '#425466', border: '1px solid', borderColor: index === 0 ? '#51C6B1' : '#E3E9EE', fontWeight: 850 }} />)}
        <Typography sx={{ ml: 'auto !important', whiteSpace: 'nowrap', alignSelf: 'center', color: 'text.secondary', fontSize: 11.5 }}>{units.length} rooms</Typography>
      </Stack>
      <Stack direction="row" spacing={1.1} sx={{ mt: 1.1, overflowX: 'auto', pb: .7, scrollSnapType: 'x proximity', '& > *': { scrollSnapAlign: 'start' } }}>{units.map((unit) => <RoomCard key={unit._id} unit={unit} active={String(unit._id) === String(selected._id)} onSelect={() => selectRoom(unit)} />)}<IconButton aria-label="See more rooms" sx={{ flex: '0 0 44px', alignSelf: 'center', bgcolor: '#fff', border: '1px solid #E1E8ED', boxShadow: '0 8px 22px rgba(16,42,67,.1)' }}><KeyboardArrowRightRounded /></IconButton></Stack>
    </Box>

    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, md: 4 }} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.2, md: 2.6 }, bgcolor: '#F2F8FA', borderTop: '1px solid #E2EBEF' }}>
      <Typography sx={{ color: '#102A43', fontSize: { xs: 20, md: 25 }, fontWeight: 950, letterSpacing: '-.03em', lineHeight: 1.05 }}>More Than Listings.<br />Higher Living.</Typography>
      {[['Immersive Property Discovery', HomeOutlined], ['Build Trust Through Transparency', ViewInArOutlined], ['Faster Rentals, Happier People', CheckCircleRounded], ['A Smarter Real Estate Ecosystem', BathtubOutlined]].map(([label, Icon]: any) => <Stack key={label} direction="row" spacing={1.1} alignItems="center"><Icon sx={{ color: '#153B55' }} /><Typography sx={{ color: '#345', fontSize: 11.5, maxWidth: 125, lineHeight: 1.25 }}>{label}</Typography></Stack>)}
    </Stack>
  </Paper>;
}
