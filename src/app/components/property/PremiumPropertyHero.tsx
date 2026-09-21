import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import BathtubRounded from '@mui/icons-material/BathtubRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import DirectionsRounded from '@mui/icons-material/DirectionsRounded';
import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import ImageRounded from '@mui/icons-material/ImageRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import PlayCircleFilledRounded from '@mui/icons-material/PlayCircleFilledRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import SquareFootRounded from '@mui/icons-material/SquareFootRounded';
import ViewInArRounded from '@mui/icons-material/ViewInArRounded';
import OptimizedImage from '../shared/OptimizedImage';

const fallback = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=88';

type PropertyHeroProps = {
  title: string;
  purpose: string;
  propertyType?: string;
  address?: string;
  images: string[];
  tourMedia: any[];
  floorPlanMedia: any[];
  price: number;
  priceLabel: string;
  priceSuffix?: string;
  deposit?: number;
  availableLabel?: string;
  verified?: boolean;
  urgentLabel?: string;
  bedrooms?: string;
  bathrooms?: string;
  area?: string;
  roomCount?: string;
  furnishing?: string;
  amenities?: string[];
  saved: boolean;
  onShare: () => void;
  shareAction?: ReactNode;
  onToggleSaved: () => void;
  onBook: () => void;
  bookingLabel?: string;
  onScheduleVisit: () => void;
  onDirections: () => void;
};

type HeroTab = 'photos' | 'tour' | 'floor-plan';

function formatMediaName(item: any, fallbackName: string) {
  return String(item?.caption || item?.altText || fallbackName).trim();
}

export default function PremiumPropertyHero({
  title,
  purpose,
  propertyType,
  address,
  images,
  tourMedia,
  floorPlanMedia,
  price,
  priceLabel,
  priceSuffix,
  deposit,
  availableLabel = 'Available now',
  verified = false,
  urgentLabel,
  bedrooms,
  bathrooms,
  area,
  roomCount,
  furnishing,
  amenities = [],
  saved,
  onShare,
  shareAction,
  onToggleSaved,
  onBook,
  bookingLabel = 'Book Now',
  onScheduleVisit,
  onDirections,
}: PropertyHeroProps) {
  const gallery = useMemo(() => (images.length ? images.filter(Boolean) : [fallback]), [images]);
  const [tab, setTab] = useState<HeroTab>('photos');
  const [activeImage, setActiveImage] = useState(0);
  const heroImage = gallery[Math.min(activeImage, gallery.length - 1)] || fallback;
  const stats = [
    bedrooms ? { Icon: BedRounded, label: 'Bedrooms', value: bedrooms } : null,
    bathrooms ? { Icon: BathtubRounded, label: 'Bathrooms', value: bathrooms } : null,
    area ? { Icon: SquareFootRounded, label: 'Area', value: area } : null,
    roomCount ? { Icon: ApartmentRounded, label: 'Rooms', value: roomCount } : null,
  ].filter(Boolean) as Array<{ Icon: typeof BedRounded; label: string; value: string }>;
  const media = tab === 'tour' ? tourMedia[0] : floorPlanMedia[0];
  const hasMedia = Boolean(media?.url);

  useEffect(() => {
    if (activeImage >= gallery.length) setActiveImage(0);
  }, [activeImage, gallery.length]);

  return (
    <Paper
      data-secureasset-premium-property-hero="gallery-v203"
      elevation={0}
      sx={{
        overflow: 'hidden',
        borderRadius: { xs: 3.5, md: 4.5 },
        border: '1px solid #E0E9EE',
        bgcolor: '#FBFDFE',
        boxShadow: '0 24px 72px rgba(16, 42, 67, .10)',
      }}
    >
      <Box sx={{ p: { xs: 1.5, sm: 2.25, md: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={1.5}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" gap={.7} flexWrap="wrap" sx={{ mb: 1.1 }}>
              <Chip label={purpose} size="small" sx={{ bgcolor: '#E1F7F2', color: '#00745E', fontWeight: 900, borderRadius: 1.5 }} />
              {propertyType && <Chip label={propertyType} size="small" variant="outlined" sx={{ borderColor: '#D5E1E8', color: '#3B5568', fontWeight: 750, borderRadius: 1.5 }} />}
              <Chip label={availableLabel} size="small" sx={{ bgcolor: '#ECF9F1', color: '#167353', fontWeight: 850, borderRadius: 1.5 }} />
              {verified && <Chip icon={<CheckCircleRounded sx={{ fontSize: '15px !important' }} />} label="Verified listing" size="small" sx={{ bgcolor: '#EDF4FF', color: '#265C9E', fontWeight: 850, borderRadius: 1.5 }} />}
              {urgentLabel && <Chip label={urgentLabel} size="small" sx={{ bgcolor: '#FFF0EB', color: '#B64A2C', fontWeight: 850, borderRadius: 1.5 }} />}
            </Stack>
            <Typography component="h1" sx={{ color: '#102A43', fontWeight: 950, fontSize: { xs: 28, sm: 36, lg: 42 }, lineHeight: 1.04, letterSpacing: '-.045em' }}>
              {title}
            </Typography>
            <Stack direction="row" gap={.65} alignItems="center" sx={{ color: '#587083', mt: 1 }}>
              <LocationOnRounded sx={{ color: '#008C73', fontSize: 19 }} />
              <Typography fontSize={{ xs: 12.5, sm: 14 }} fontWeight={650}>{address || 'Location shared after your enquiry'}</Typography>
            </Stack>
          </Box>
          <Stack direction="row" gap={.75} sx={{ flexShrink: 0 }}>
            {shareAction || <Button data-secureasset-public-property-share="public-listing-share-v200" variant="outlined" size="small" startIcon={<ShareRounded />} onClick={onShare} sx={{ minHeight: 38, borderColor: '#C9D9E2', color: '#163A54', fontWeight: 850, textTransform: 'none' }}>Share</Button>}
            <IconButton aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'} onClick={onToggleSaved} sx={{ width: 38, height: 38, border: '1px solid #C9D9E2', color: saved ? '#D44545' : '#163A54', bgcolor: '#fff' }}>
              {saved ? <FavoriteRounded fontSize="small" /> : <FavoriteBorderRounded fontSize="small" />}
            </IconButton>
          </Stack>
        </Stack>

        <Tabs
          value={tab}
          onChange={(_, value: HeroTab) => setTab(value)}
          variant="scrollable"
          scrollButtons={false}
          aria-label="Property media"
          sx={{ mt: { xs: 1.8, md: 2.4 }, minHeight: 44, borderBottom: '1px solid #E0E9EE', '& .MuiTabs-indicator': { height: 3, borderRadius: 3, bgcolor: '#008C73' }, '& .MuiTab-root': { minHeight: 44, minWidth: { xs: 105, sm: 130 }, px: 1.2, textTransform: 'none', color: '#718397', fontSize: { xs: 11.5, sm: 12.5 }, fontWeight: 800 }, '& .Mui-selected': { color: '#007C66 !important' } }}
        >
          <Tab value="photos" icon={<ImageRounded sx={{ fontSize: 17 }} />} iconPosition="start" label={`Photos (${gallery.length})`} />
          <Tab value="tour" icon={<ViewInArRounded sx={{ fontSize: 17 }} />} iconPosition="start" label="Interactive tour" />
          <Tab value="floor-plan" icon={<GridViewRounded sx={{ fontSize: 17 }} />} iconPosition="start" label="Floor plan" />
        </Tabs>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 315px' }, gap: { xs: 1.5, lg: 2.25 }, mt: { xs: 1.5, md: 2.25 } }}>
          <Box sx={{ minWidth: 0 }}>
            {tab === 'photos' ? <>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1.65fr) minmax(135px, .65fr)' }, gap: 1, height: { xs: 330, sm: 420, md: 480 } }}>
                <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: { xs: 3, md: 3.5 }, bgcolor: '#E1EAED' }}>
                  <OptimizedImage src={heroImage} alt={`${title} — image ${activeImage + 1}`} width={1600} height={1000} priority sizes="(max-width: 900px) 100vw, 65vw" style={{ objectFit: 'cover' }} />
                  <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,33,48,.01) 56%, rgba(10,33,48,.32))' }} />
                  <Chip icon={<ImageRounded sx={{ fontSize: '16px !important' }} />} label={`${activeImage + 1} / ${gallery.length}`} size="small" sx={{ position: 'absolute', left: 13, bottom: 13, bgcolor: 'rgba(8,29,42,.80)', color: '#fff', fontWeight: 850, backdropFilter: 'blur(10px)', '& .MuiChip-icon': { color: '#fff' } }} />
                </Box>
                <Box sx={{ display: { xs: 'none', sm: 'grid' }, gridTemplateRows: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                  {gallery.slice(1, 3).map((image, index) => <Box component="button" type="button" key={`${image}-${index}`} onClick={() => setActiveImage(index + 1)} aria-label={`Show photo ${index + 2}`} sx={{ position: 'relative', p: 0, border: activeImage === index + 1 ? '3px solid #00A78B' : 0, overflow: 'hidden', borderRadius: 3, bgcolor: '#E1EAED', cursor: 'pointer', '&:hover img': { transform: 'scale(1.04)' } }}><OptimizedImage src={image} alt={`${title} — image ${index + 2}`} width={650} height={450} sizes="25vw" style={{ objectFit: 'cover', transition: 'transform .24s ease' }} />{index === 1 && gallery.length > 3 && <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(9,32,46,.46)', color: '#fff' }}><Typography fontWeight={950} fontSize={17}>+{gallery.length - 3} photos</Typography></Box>}</Box>)}
                </Box>
              </Box>
              <Stack direction="row" spacing={.85} sx={{ overflowX: 'auto', mt: 1.1, pb: .2, '&::-webkit-scrollbar': { height: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#C8D5DE', borderRadius: 9 } }}>
                {gallery.map((image, index) => <Box component="button" type="button" key={`${image}-${index}`} onClick={() => setActiveImage(index)} aria-label={`View photo ${index + 1}`} sx={{ flex: '0 0 78px', height: 56, p: 0, border: activeImage === index ? '3px solid #00A78B' : '1px solid #DCE6EB', borderRadius: 1.8, overflow: 'hidden', cursor: 'pointer', bgcolor: '#E1EAED' }}><OptimizedImage src={image} alt="" width={160} height={112} sizes="120px" style={{ objectFit: 'cover' }} /></Box>)}
              </Stack>
            </> : <Box sx={{ position: 'relative', minHeight: { xs: 330, sm: 420, md: 480 }, overflow: 'hidden', borderRadius: { xs: 3, md: 3.5 }, bgcolor: tab === 'floor-plan' ? '#F2F7F8' : '#123B4B', display: 'grid', placeItems: 'center' }}>
              {hasMedia && media.mediaType === 'video' ? <Box component="video" controls preload="metadata" src={media.url} poster={heroImage} sx={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'cover', bgcolor: '#071E2C' }} /> : hasMedia && media.mediaType === 'image' ? <OptimizedImage src={media.url} alt={formatMediaName(media, tab === 'tour' ? 'Virtual property tour' : 'Floor plan')} width={1500} height={1000} sizes="(max-width: 900px) 100vw, 65vw" style={{ position: 'absolute', inset: 0, objectFit: tab === 'floor-plan' ? 'contain' : 'cover', padding: tab === 'floor-plan' ? 24 : 0 }} /> : <Box sx={{ position: 'absolute', inset: 0, background: tab === 'tour' ? `linear-gradient(120deg, rgba(5,26,38,.42), rgba(5,26,38,.12)), url(${heroImage}) center / cover` : 'linear-gradient(135deg, #E9F2F3, #F9FBFB)' }} />}
              {!hasMedia && <Stack alignItems="center" textAlign="center" spacing={1.2} sx={{ position: 'relative', zIndex: 1, maxWidth: 320, p: 3, color: tab === 'tour' ? '#fff' : '#163A54' }}>
                {tab === 'tour' ? <PlayCircleFilledRounded sx={{ fontSize: 50 }} /> : <GridViewRounded sx={{ fontSize: 47, color: '#008C73' }} />}
                <Typography fontSize={18} fontWeight={950}>{tab === 'tour' ? 'Tour media is being prepared' : 'No public floor plan yet'}</Typography>
                <Typography fontSize={12.5} sx={{ opacity: .83 }}>{tab === 'tour' ? 'Browse the full image gallery while the owner adds an immersive tour.' : 'The owner can add a verified floor plan to this listing.'}</Typography>
                {tab === 'tour' && <Button onClick={() => setTab('photos')} variant="contained" size="small" sx={{ mt: .4, bgcolor: '#fff', color: '#133D51', fontWeight: 900, '&:hover': { bgcolor: '#F0F7F6' } }}>Browse photos</Button>}
              </Stack>}
            </Box>}

            <Stack direction="row" flexWrap="wrap" gap={{ xs: 1, sm: 1.4 }} sx={{ mt: 1.6 }}>
              {stats.map(({ Icon, label, value }) => <Stack key={label} direction="row" alignItems="center" gap={.9} sx={{ minWidth: { xs: 'calc(50% - 4px)', sm: 116 }, px: 1.15, py: .9, borderRadius: 2, bgcolor: '#F4F8FA', border: '1px solid #E4ECEF' }}><Icon sx={{ fontSize: 19, color: '#0B5270' }} /><Box><Typography fontSize={12.5} fontWeight={900} lineHeight={1.05}>{value}</Typography><Typography fontSize={9.5} color="text.secondary">{label}</Typography></Box></Stack>)}
              {furnishing && <Stack direction="row" alignItems="center" gap={.9} sx={{ minWidth: { xs: 'calc(50% - 4px)', sm: 150 }, px: 1.15, py: .9, borderRadius: 2, bgcolor: '#F4F8FA', border: '1px solid #E4ECEF' }}><ApartmentRounded sx={{ fontSize: 19, color: '#0B5270' }} /><Box><Typography fontSize={12.5} fontWeight={900} lineHeight={1.05}>{furnishing}</Typography><Typography fontSize={9.5} color="text.secondary">Furnishing</Typography></Box></Stack>}
            </Stack>
            {amenities.length > 0 && <Stack direction="row" gap={.7} flexWrap="wrap" sx={{ mt: 1.45 }}>{amenities.slice(0, 6).map((amenity) => <Chip key={amenity} label={amenity} size="small" variant="outlined" sx={{ borderColor: '#D6E5E8', color: '#3E5B6D', fontWeight: 700, bgcolor: '#fff' }} />)}</Stack>}
          </Box>

          <Paper elevation={0} sx={{ alignSelf: 'start', position: { lg: 'sticky' }, top: { lg: 92 }, border: '1px solid #DCE8ED', borderRadius: 3.5, p: { xs: 1.75, md: 2.2 }, bgcolor: '#fff', boxShadow: '0 14px 34px rgba(16,42,67,.08)' }}>
            <Typography sx={{ color: '#6E8495', fontSize: 10.5, fontWeight: 900, letterSpacing: '.08em' }}>{priceLabel.toUpperCase()}</Typography>
            <Stack direction="row" alignItems="baseline" gap={.55} sx={{ mt: .35 }}><Typography sx={{ color: '#102A43', fontWeight: 950, fontSize: { xs: 29, md: 32 }, letterSpacing: '-.04em' }}>{price > 0 ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price) : 'On request'}</Typography>{price > 0 && priceSuffix && <Typography color="text.secondary" fontSize={12} fontWeight={750}>{priceSuffix}</Typography>}</Stack>
            {deposit && <Typography sx={{ color: '#708597', fontSize: 11.5, mt: .4 }}>Security deposit {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(deposit)}</Typography>}
            <Divider sx={{ my: 1.8 }} />
            <Stack spacing={.85}><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary" fontSize={11.5}>Listing status</Typography><Typography color="#08755D" fontSize={11.5} fontWeight={900}>{availableLabel}</Typography></Stack><Typography color="text.secondary" fontSize={11.5}>SecureAsset keeps exact owner and access details private until the appropriate enquiry stage.</Typography></Stack>
            <Button fullWidth variant="contained" size="large" onClick={onBook} sx={{ mt: 2, minHeight: 46, bgcolor: '#008C73', color: '#fff', fontWeight: 950, textTransform: 'none', boxShadow: '0 9px 20px rgba(0,140,115,.23)', '&:hover': { bgcolor: '#007761' } }}>{bookingLabel}</Button>
            <Button fullWidth variant="outlined" size="medium" startIcon={<CalendarMonthRounded />} onClick={onScheduleVisit} sx={{ mt: 1, minHeight: 42, borderColor: '#173B55', color: '#173B55', fontWeight: 850, textTransform: 'none' }}>Schedule a visit</Button>
            <Button fullWidth size="small" startIcon={<DirectionsRounded />} onClick={onDirections} sx={{ mt: .65, color: '#375A70', fontWeight: 800, textTransform: 'none' }}>Get directions</Button>
          </Paper>
        </Box>
      </Box>
    </Paper>
  );
}
