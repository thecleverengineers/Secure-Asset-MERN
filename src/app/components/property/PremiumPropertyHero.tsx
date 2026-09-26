import { useMemo, useState, type ReactNode } from 'react';
import { Box, Button, Chip, IconButton, Paper, Stack, Typography } from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import BathtubRounded from '@mui/icons-material/BathtubRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import DirectionsCarRounded from '@mui/icons-material/DirectionsCarRounded';
import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import MailOutlineRounded from '@mui/icons-material/MailOutlineRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import WeekendRounded from '@mui/icons-material/WeekendRounded';
import OptimizedImage from '../shared/OptimizedImage';

const fallback = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=88';
const RADIUS = '12px';

type FactKind = 'bed' | 'bath' | 'living' | 'kitchen' | 'balcony' | 'parking' | 'lift' | 'property';
type HeroFact = { label: string; value: string; kind?: FactKind };

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
  facts?: HeroFact[];
  contactName?: string;
  saved: boolean;
  onShare: () => void;
  shareAction?: ReactNode;
  onToggleSaved: () => void;
  onBook: () => void;
  bookingLabel?: string;
  onScheduleVisit: () => void;
  onDirections: () => void;
  onEnquiry?: () => void;
};

const factIcon = (kind?: FactKind) => {
  const sx = { fontSize: 20 };
  if (kind === 'bed') return <BedRounded sx={sx} />;
  if (kind === 'bath') return <BathtubRounded sx={sx} />;
  if (kind === 'living') return <WeekendRounded sx={sx} />;
  if (kind === 'parking') return <DirectionsCarRounded sx={sx} />;
  if (kind === 'property' || kind === 'lift') return <ApartmentRounded sx={sx} />;
  return <HomeWorkRounded sx={sx} />;
};

export default function PremiumPropertyHero({
  title, purpose, propertyType, address, images, floorPlanMedia, price, priceSuffix,
  deposit, availableLabel = 'Available for Rent', verified = false, urgentLabel,
  bedrooms, bathrooms, roomCount, furnishing, amenities = [], facts = [], contactName,
  saved, onShare, shareAction, onToggleSaved, onBook, bookingLabel = 'Book Room / Apply',
  onScheduleVisit, onDirections, onEnquiry,
}: PropertyHeroProps) {
  const gallery = useMemo(() => (images.length ? images.filter(Boolean) : [fallback]), [images]);
  const [activeImage, setActiveImage] = useState(0);
  const mainImage = gallery[Math.min(activeImage, gallery.length - 1)] || fallback;
  const visibleFacts = facts.length ? facts : [
    bedrooms ? { label: 'Bedrooms', value: bedrooms, kind: 'bed' as const } : null,
    bathrooms ? { label: 'Bathrooms', value: bathrooms, kind: 'bath' as const } : null,
    roomCount ? { label: 'Rooms', value: roomCount, kind: 'living' as const } : null,
    furnishing ? { label: 'Furnishing', value: furnishing, kind: 'property' as const } : null,
  ].filter(Boolean) as HeroFact[];

  const openFloorPlan = () => {
    const item = floorPlanMedia?.[0];
    if (item?.url) window.open(item.url, '_blank', 'noopener,noreferrer');
    else onScheduleVisit();
  };

  return <Box data-secureasset-premium-property-hero="approved-overview-v214" sx={{
    fontFamily: '"Open Sans", Arial, sans-serif',
    '& .MuiTypography-root, & .MuiButton-root, & .MuiChip-root': { fontFamily: '"Open Sans", Arial, sans-serif' },
  }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1.2 }}>
      <Stack direction="row" spacing={.7} alignItems="center" sx={{ color: '#718096', minWidth: 0, overflow: 'hidden' }}>
        <Typography noWrap sx={{ fontSize: 11.5 }}>Marketplace</Typography>
        <Typography sx={{ fontSize: 11.5 }}>›</Typography>
        <Typography noWrap sx={{ fontSize: 11.5 }}>{propertyType || 'Property'}</Typography>
        <Typography sx={{ fontSize: 11.5 }}>›</Typography>
        <Typography noWrap sx={{ color: '#173B55', fontSize: 11.5, fontWeight: 700 }}>{title}</Typography>
      </Stack>
      <Stack direction="row" spacing={.7} flexShrink={0}>
        {shareAction || <Button variant="outlined" size="small" startIcon={<ShareRounded />} onClick={onShare} sx={{ minHeight: 34, px: 1.4, borderColor: '#D8E2EA', color: '#173B55', borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>Share</Button>}
        <Button variant="outlined" size="small" startIcon={saved ? <FavoriteRounded /> : <FavoriteBorderRounded />} onClick={onToggleSaved} sx={{ minHeight: 34, px: 1.4, borderColor: '#D8E2EA', color: saved ? '#D14343' : '#173B55', borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>Save</Button>
      </Stack>
    </Stack>

    <Box sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.35fr) minmax(0,.8fr)', lg: 'minmax(0,4.75fr) minmax(170px,1.75fr) minmax(270px,2.55fr) minmax(275px,2.2fr)' },
      gap: { xs: 1.25, lg: 1.5 },
      alignItems: 'stretch',
    }}>
      <Box sx={{ position: 'relative', height: { xs: 285, sm: 365, lg: 378 }, borderRadius: RADIUS, overflow: 'hidden', bgcolor: '#eaf0f3', gridColumn: { md: '1 / 2', lg: 'auto' } }}>
        <OptimizedImage src={mainImage} alt={title} width={1500} height={980} priority sizes="(max-width: 900px) 100vw, 46vw" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(5,22,34,.02) 55%,rgba(5,22,34,.32))' }} />
        {verified && <Chip icon={<CheckCircleRounded sx={{ fontSize: '16px !important' }} />} label="Verified Property" size="small" sx={{ position: 'absolute', top: 13, left: 13, bgcolor: '#0b2f52', color: '#fff', fontWeight: 800, '& .MuiChip-icon': { color: '#3ad59f' } }} />}
        <Button onClick={() => setActiveImage((activeImage + 1) % gallery.length)} startIcon={<GridViewRounded />} sx={{ position: 'absolute', left: 13, bottom: 13, color: '#fff', bgcolor: 'rgba(6,24,37,.78)', px: 1.25, borderRadius: 2, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: 'rgba(6,24,37,.92)' } }}>View All Photos ({gallery.length})</Button>
      </Box>

      <Stack spacing={1} sx={{ display: { xs: 'flex', md: 'grid', lg: 'flex' }, gridTemplateColumns: { md: 'repeat(3,1fr)' }, minWidth: 0 }}>
        {[1,2,3].map((offset, index) => {
          const source = gallery[(activeImage + offset) % gallery.length] || mainImage;
          const remaining = Math.max(0, gallery.length - 3);
          return <Box component="button" type="button" key={offset} onClick={() => setActiveImage((activeImage + offset) % gallery.length)} sx={{
            position: 'relative', height: { xs: 92, md: 118, lg: index === 2 ? 116 : 126 }, p: 0, border: 0,
            borderRadius: RADIUS, overflow: 'hidden', bgcolor: '#edf2f4', cursor: 'pointer',
          }}>
            <OptimizedImage src={source} alt="" width={500} height={300} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {index === 2 && remaining > 0 && <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(7,27,43,.38)', color: '#fff', fontSize: 24, fontWeight: 800 }}>+{remaining}</Box>}
          </Box>;
        })}
      </Stack>

      <Box sx={{ p: { xs: .35, lg: .6 }, minWidth: 0 }}>
        <Chip label={availableLabel || sentenceCase(purpose)} size="small" sx={{ bgcolor: '#dcfce7', color: '#087443', height: 26, fontWeight: 700 }} />
        <Typography component="h1" sx={{ mt: 1, color: '#0c2441', fontSize: { xs: 26, lg: 30 }, lineHeight: 1.05, letterSpacing: '-.025em', fontWeight: 800 }}>{title}</Typography>
        <Stack direction="row" spacing={.55} alignItems="flex-start" sx={{ mt: 1 }}>
          <LocationOnRounded sx={{ fontSize: 17, color: '#61758a', mt: .2 }} />
          <Typography sx={{ color: '#61758a', fontSize: 12.5, lineHeight: 1.45 }}>{address || 'Location available on request'}</Typography>
        </Stack>
        <Stack direction="row" spacing={.55} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          {propertyType && <Chip size="small" label={propertyType} sx={{ height: 23, bgcolor: '#f2f4f7', color: '#536779', fontSize: 10.5 }} />}
          {bedrooms && <Chip size="small" label={`${bedrooms} BHK`} sx={{ height: 23, bgcolor: '#f2f4f7', color: '#536779', fontSize: 10.5 }} />}
          {verified && <Chip size="small" label="Verified Property" sx={{ height: 23, bgcolor: '#dcfce7', color: '#087443', fontSize: 10.5 }} />}
          {urgentLabel && <Chip size="small" label={urgentLabel} sx={{ height: 23, bgcolor: '#fff3e8', color: '#b65309', fontSize: 10.5 }} />}
        </Stack>
        <Box sx={{ mt: 1.8, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: .8 }}>
          {visibleFacts.slice(0,8).map((fact, index) => {
            const accents = [
              ['#eaf8f1','#079455'],['#fff4ea','#e65f19'],['#eef5ff','#3276d6'],['#eaf8f1','#079455'],
              ['#f5eeff','#805ad5'],['#fff4e8','#d97706'],['#edf6ff','#2563eb'],['#eef7f7','#0f766e'],
            ];
            const accent = accents[index % accents.length];
            return <Stack key={fact.label} alignItems="center" spacing={.45} sx={{ minWidth: 0 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: accent[0], color: accent[1] }}>{factIcon(fact.kind)}</Box>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#173B55', textAlign: 'center', lineHeight: 1.05 }}>{fact.value}</Typography>
              <Typography sx={{ fontSize: 9.4, color: '#6b7d8e', textAlign: 'center', lineHeight: 1.1 }}>{fact.label}</Typography>
            </Stack>;
          })}
        </Box>
      </Box>

      <Paper elevation={0} sx={{ p: 1.7, borderRadius: RADIUS, border: '1px solid #e3e9ee', boxShadow: '0 10px 30px rgba(15,42,64,.06)', bgcolor: '#fff', alignSelf: 'stretch' }}>
        <Stack direction="row" alignItems="baseline" spacing={.55}>
          <Typography sx={{ color: '#0c2441', fontSize: { xs: 28, lg: 30 }, fontWeight: 800, letterSpacing: '-.025em' }}>{price > 0 ? new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(price) : 'On request'}</Typography>
          {price > 0 && <Typography sx={{ color: '#76879a', fontSize: 11.5 }}>{priceSuffix || ''}</Typography>}
        </Stack>
        <Button fullWidth variant="contained" onClick={onBook} startIcon={<CalendarMonthRounded />} sx={{ mt: 1.25, minHeight: 48, bgcolor: '#087f5b', borderRadius: 2, textTransform: 'none', fontWeight: 800, boxShadow: '0 8px 20px rgba(8,127,91,.17)', '&:hover': { bgcolor: '#066d4e' } }}>{bookingLabel}</Button>
        <Button fullWidth variant="outlined" onClick={openFloorPlan} startIcon={<GridViewRounded />} sx={{ mt: .85, minHeight: 44, borderColor: '#cad5df', color: '#173B55', borderRadius: 2, textTransform: 'none', fontWeight: 750 }}>View Floor Plan</Button>
        <Button fullWidth variant="outlined" onClick={onEnquiry || onScheduleVisit} startIcon={<MailOutlineRounded />} sx={{ mt: .85, minHeight: 44, borderColor: '#cad5df', color: '#173B55', borderRadius: 2, textTransform: 'none', fontWeight: 750 }}>Send Enquiry</Button>
        {deposit ? <Typography sx={{ mt: 1, fontSize: 10.5, color: '#8190a0' }}>Security deposit {new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(deposit)}</Typography> : null}
        <Box sx={{ mt: 1.4, p: 1.1, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #edf1f5' }}>
          <Typography sx={{ color: '#8190a0', fontSize: 9.5, fontWeight: 700 }}>CONTACT LANDLORD</Typography>
          <Typography sx={{ mt: .3, color: '#183a55', fontSize: 12.5, fontWeight: 800 }}>{contactName || 'Secure contact available'}</Typography>
          <Typography sx={{ mt: .25, color: '#8997a6', fontSize: 9.5 }}>Contact details remain protected until the appropriate enquiry stage.</Typography>
        </Box>
      </Paper>
    </Box>
  </Box>;
}

function sentenceCase(value: string) {
  return String(value || '').replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase());
}
