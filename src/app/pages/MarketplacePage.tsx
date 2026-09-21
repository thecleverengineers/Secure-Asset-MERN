import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Alert, Box, Button, Card, CardContent, Chip, Container, FormControlLabel, IconButton,
  InputAdornment, MenuItem, Pagination, Skeleton, Stack, Switch, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SquareFootOutlined from '@mui/icons-material/SquareFootOutlined';
import StarRounded from '@mui/icons-material/StarRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import type { Property, PropertyFilters } from '../services/types';
import { getProperties } from '../services/api';
import { useSite } from '../context/SiteContext';
import LocationFields from '../components/shared/LocationFields';
import OptimizedImage from '../components/shared/OptimizedImage';
import { publicPropertyQueryOptions } from '../queries/propertyQueries';
import { useWishlist } from '../context/WishlistContext';
import { propertyOverviewPath } from '../utils/propertyUrl';

const money = (value: number) => {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  if (value >= 1_000) return `₹${Math.round(value / 1_000)}K`;
  return `₹${value || 0}`;
};
const sentence = (value: string) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const fallback = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80';
const bool = (value: string | null) => value === 'true';
const DESKTOP_MARKETPLACE_CARD_WIDTH = 286;

function listingPriceDetails(property: Property, purpose: string) {
  if (purpose === 'lease') return { amount: Number(property.pricing?.leaseAmount ?? property.price ?? 0), label: 'Lease amount', period: '/ year' };
  const monthlyRent = property.pricing?.monthlyRent ?? property.price;
  if (purpose === 'rent') return { amount: Number(monthlyRent || property.startingMonthlyRent || property.rentalSummary?.startingMonthlyRent || 0), label: 'Rent amount', period: '/ month' };
  return { amount: Number(property.pricing?.salePrice ?? property.price ?? 0), label: 'Sale price', period: '' };
}

function filtersFromParams(params: URLSearchParams): PropertyFilters {
  const listingType = params.get('listingType');
  return {
    type: params.get('type') || 'all',
    listingType: listingType === 'sale' || listingType === 'lease' || listingType === 'rent' ? listingType : 'rent',
    search: params.get('search') || '',
    city: params.get('city') || '',
    state: params.get('state') || '',
    country: params.get('country') || '',
    address: params.get('address') || '',
    landlord: params.get('landlord') || '',
    verified: bool(params.get('verified')),
    trustedSeller: bool(params.get('trustedSeller')),
    minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
    maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
    page: Math.max(Number(params.get('page') || 1), 1),
    limit: 12,
  };
}

function ListingCard({ property, compact = false, isWishlisted, onToggle }: { property: Property; compact?: boolean; isWishlisted?: boolean; onToggle?: (property: Property) => Promise<void> }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const purpose = property.listingType || property.purpose || (property.isSale ? 'sale' : 'rent');
  const priceDetails = listingPriceDetails(property, purpose);
  const roomPricedRentProperty = purpose === 'rent' && property.listingKind !== 'space';
  const address = [property.address?.line1, property.address?.city, property.address?.state, property.address?.country].filter(Boolean).join(', ');

  return (
    <Card
      className="sa-interactive-card"
      variant="outlined"
      onClick={() => navigate(propertyOverviewPath(property))}
      onMouseEnter={() => { void queryClient.prefetchQuery(publicPropertyQueryOptions(property.slug || property._id)); }}
      onFocus={() => { void queryClient.prefetchQuery(publicPropertyQueryOptions(property.slug || property._id)); }}
      sx={{ height: '100%', width: compact ? 226 : DESKTOP_MARKETPLACE_CARD_WIDTH, minWidth: compact ? 226 : DESKTOP_MARKETPLACE_CARD_WIDTH, flex: compact ? '0 0 226px' : '0 0 286px', p: compact ? .65 : .8, borderColor: 'rgba(13, 73, 96, .14)', borderRadius: '22px', overflow: 'visible', cursor: 'pointer', bgcolor: '#fff', boxShadow: '0 7px 22px rgba(19, 56, 77, .075)', transition: 'transform .22s ease, box-shadow .22s ease, border-color .22s ease', '&:hover': { transform: 'translateY(-5px)', borderColor: 'rgba(11, 82, 112, .32)', boxShadow: '0 18px 36px rgba(19, 56, 77, .14)' } }}
    >
      <Box sx={{ position: 'relative' }}>
        <Box sx={{ height: compact ? 172 : { xs: 190, md: 166, lg: 176 }, overflow: 'hidden', bgcolor: 'action.hover', borderRadius: '16px' }}>
          <OptimizedImage
            src={property.images?.[0] || property.galleryCover || fallback}
            alt={property.title}
            width={640}
            height={360}
            sizes={compact ? '226px' : '286px'}
            style={{ objectFit: 'cover', borderRadius: '16px' }}
          />
        </Box>
        <Stack direction="row" gap={.7} flexWrap="wrap" sx={{ position: 'absolute', top: 12, left: 12, right: 42 }}>
          <Chip size="small" label={sentence(purpose)} color="primary" />
          {property.listingKind === 'space' && <Chip size="small" label={sentence(property.type)} icon={property.type === 'bed' ? <BedRounded /> : <MeetingRoomRounded />} />}
          {property.isFeatured && <Chip size="small" icon={<StarRounded />} label="Featured" sx={{ bgcolor: 'warning.main' }} />}
        </Stack>
        {onToggle && <IconButton aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'} onClick={(event) => { event.stopPropagation(); void onToggle(property); }} sx={{ position: 'absolute', top: 10, right: 10, bgcolor: 'rgba(255,255,255,.94)', color: isWishlisted ? 'error.main' : 'text.primary', '&:hover': { bgcolor: '#fff' } }}>{isWishlisted ? <FavoriteRounded /> : <FavoriteBorderRounded />}</IconButton>}
        {property.isVerified && <VerifiedRounded color="primary" sx={{ position: 'absolute', top: compact ? 52 : 14, right: compact ? 14 : onToggle ? 58 : 14, bgcolor: 'background.paper', borderRadius: '50%' }} />}
      </Box>
      <CardContent sx={{ p: compact ? .5 : .75, pt: compact ? 1 : 1.1, '&:last-child': { pb: compact ? .35 : .5 } }}>
        <Typography className="open-sans-property-title" sx={{ fontFamily: '"Open Sans", Arial, sans-serif', fontOpticalSizing: 'auto', fontStyle: 'normal', fontVariationSettings: '"wdth" 100', fontSize: { xs: 12.5, sm: compact ? 13 : 13.5 }, lineHeight: 1.3, minHeight: compact ? 32 : 35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{property.title}</Typography>
        <Stack direction="row" alignItems="center" gap={.45} mt={.55}>
          <LocationOnOutlined fontSize="small" color="disabled" />
          <Typography color="text.secondary" fontSize={11.25} noWrap>{address || 'Location available on request'}</Typography>
        </Stack>
        {purpose === 'rent' && Number(property.availableRoomCount || property.rentalSummary?.availableUnits || 0) > 0 && <Typography sx={{ mt: .7, fontSize: 10.5, fontWeight: 800, color: 'success.main' }}>{Number(property.availableRoomCount || property.rentalSummary?.availableUnits || 0)} rooms available · View Rooms</Typography>}
        {!compact && <Stack direction="row" gap={1.2} mt={1.15}>
          {property.bedrooms !== null && property.bedrooms !== undefined && <Stack direction="row" gap={.4} alignItems="center"><BedRounded sx={{ fontSize: 15 }} color="disabled" /><Typography fontSize={10.5}>{property.bedrooms} beds</Typography></Stack>}
          <Stack direction="row" gap={.4} alignItems="center"><SquareFootOutlined sx={{ fontSize: 15 }} color="disabled" /><Typography fontSize={10.5}>{Number(property.area || 0).toLocaleString()} {property.areaUnit || 'sqft'}</Typography></Stack>
        </Stack>}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mt={compact ? 1.15 : 1.3}>
          {roomPricedRentProperty ? <Box><Typography sx={{ color: 'text.secondary', fontFamily: '"Open Sans", Arial, sans-serif', fontSize: compact ? 8.75 : 9.5, fontWeight: 700, lineHeight: 1.15 }}>ROOM-BASED RENT</Typography><Typography sx={{ color: 'primary.main', fontFamily: '"Open Sans", Arial, sans-serif', fontWeight: 800, fontSize: compact ? 12.5 : 13, lineHeight: 1.2, mt: .2 }}>View rooms for monthly price</Typography></Box> : <Box>
            <Typography sx={{ color: 'text.secondary', fontFamily: '"Open Sans", Arial, sans-serif', fontSize: compact ? 8.75 : 9.5, fontWeight: 700, lineHeight: 1.15 }}>{priceDetails.label}</Typography>
            <Stack direction="row" alignItems="baseline" gap={.45} sx={{ mt: .2, minHeight: 18 }}>
              <Typography sx={{ color: 'primary.main', fontFamily: '"Open Sans", Arial, sans-serif', fontWeight: 800, fontSize: compact ? 12.5 : 13, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{money(priceDetails.amount)}</Typography>
              {priceDetails.period && <Typography component="span" sx={{ color: 'text.secondary', fontFamily: '"Open Sans", Arial, sans-serif', fontSize: compact ? 9.5 : 10.5, fontWeight: 600, lineHeight: 1.2 }}>{priceDetails.period}</Typography>}
            </Stack>
          </Box>}
          {property.urgentType && property.urgentType !== 'none' && <Chip size="small" color="error" label={sentence(property.urgentType)} />}
        </Stack>
      </CardContent>
    </Card>
  );
}

function DesktopMarketplaceRail({ title, subtitle, listings, loading, emptyMessage, isWishlisted, onToggle }: { title: string; subtitle: string; listings: Property[]; loading: boolean; emptyMessage: string; isWishlisted: (id: string, kind?: 'property' | 'space') => boolean; onToggle: (property: Property) => Promise<void> }) {
  const railRef = useRef<HTMLDivElement>(null);
  const slide = (direction: -1 | 1) => {
    railRef.current?.scrollBy({ left: direction * (DESKTOP_MARKETPLACE_CARD_WIDTH + 18) * 2, behavior: 'smooth' });
  };

  return (
    <Box component="section" sx={{ mt: 3.2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} sx={{ mb: 1.35 }}>
        <Box>
          <Typography component="h2" sx={{ fontSize: 21, fontWeight: 900, letterSpacing: '-.035em', color: '#102d3c' }}>{title}</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 12, mt: .3 }}>{subtitle}</Typography>
        </Box>
        <Stack direction="row" gap={.7}>
          <IconButton aria-label="Previous properties" onClick={() => slide(-1)} size="small" sx={{ border: '1px solid rgba(13, 73, 96, .16)', bgcolor: '#fff' }}>
            <ArrowBackRounded fontSize="small" />
          </IconButton>
          <IconButton aria-label="Next properties" onClick={() => slide(1)} size="small" sx={{ border: '1px solid rgba(13, 73, 96, .16)', bgcolor: '#fff' }}>
            <ArrowForwardRounded fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Box
        ref={railRef}
        className="sa-desktop-marketplace-rail"
        sx={{
          display: 'flex',
          gap: '18px',
          overflowX: 'auto',
          overflowY: 'visible',
          px: .5,
          pb: 1.4,
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
            <Box key={index} sx={{ flex: '0 0 286px', width: DESKTOP_MARKETPLACE_CARD_WIDTH, minWidth: DESKTOP_MARKETPLACE_CARD_WIDTH, p: .8, border: '1px solid rgba(13, 73, 96, .14)', borderRadius: '20px', bgcolor: '#fff' }}>
              <Skeleton variant="rounded" height={166} sx={{ borderRadius: '16px' }} />
              <Skeleton sx={{ mt: 1.4 }} />
              <Skeleton width="72%" />
              <Skeleton width="56%" sx={{ mt: 2.2 }} />
            </Box>
          ))
          : listings.map((property) => (
            <Box key={property._id} sx={{ flex: '0 0 286px', width: DESKTOP_MARKETPLACE_CARD_WIDTH, minWidth: DESKTOP_MARKETPLACE_CARD_WIDTH, scrollSnapAlign: 'start' }}>
              <ListingCard property={property} isWishlisted={isWishlisted(String(property._id), property.listingKind === 'space' ? 'space' : 'property')} onToggle={onToggle} />
            </Box>
          ))}
        {!loading && !listings.length && (
          <Box sx={{ flex: '0 0 286px', width: DESKTOP_MARKETPLACE_CARD_WIDTH, minWidth: DESKTOP_MARKETPLACE_CARD_WIDTH, minHeight: 230, display: 'flex', alignItems: 'center', p: 2, border: '1px dashed rgba(13, 73, 96, .22)', borderRadius: '20px', bgcolor: 'rgba(255,255,255,.72)' }}>
            <Typography color="text.secondary" fontSize={13}>{emptyMessage}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function MobileListingRail({ title, listings, loading, onSeeAll, isWishlisted, onToggle }: { title: string; listings: Property[]; loading: boolean; onSeeAll: () => void; isWishlisted: (id: string, kind?: 'property' | 'space') => boolean; onToggle: (property: Property) => Promise<void> }) {
  return <Box sx={{ mt: 2.7 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: .8, mb: 1.1 }}>
      <Typography sx={{ fontWeight: 900, fontSize: 17, letterSpacing: '-.035em' }}>{title}</Typography>
      <IconButton aria-label={`See all ${title}`} onClick={onSeeAll} size="small" sx={{ bgcolor: 'action.hover' }}><ArrowForwardRounded fontSize="small" /></IconButton>
    </Stack>
    <Box className="sa-mobile-listing-rail" sx={{ display: 'flex', gap: 1.4, overflowX: 'auto', px: .8, pb: 1, scrollSnapType: 'x mandatory' }}>
      {loading
        ? Array.from({ length: 3 }).map((_, index) => <Box key={index} sx={{ flex: '0 0 226px', height: 295, borderRadius: 3, bgcolor: 'action.hover' }} />)
        : listings.map((property) => <Box key={property._id} sx={{ flex: '0 0 226px', scrollSnapAlign: 'start' }}><ListingCard property={property} compact isWishlisted={isWishlisted(String(property._id), property.listingKind === 'space' ? 'space' : 'property')} onToggle={onToggle} /></Box>)}
    </Box>
    {!loading && !listings.length && <Typography color="text.secondary" sx={{ px: .8, fontSize: 13 }}>No published homes are available yet.</Typography>}
  </Box>;
}

export default function MarketplacePage() {
  const { data: { propertyTypes } } = useSite();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<PropertyFilters>(() => filtersFromParams(searchParams));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const wishlist = useWishlist();
  const paramsKey = searchParams.toString();

  useEffect(() => {
    setFilters(filtersFromParams(new URLSearchParams(paramsKey)));
  }, [paramsKey]);

  const types = useMemo(() => [
    { key: 'all', label: 'All property types' },
    ...(propertyTypes || []).map((item: any) => ({ key: item.key, label: item.label })),
  ], [propertyTypes]);

  const updateFilters = (patch: Partial<PropertyFilters>) => {
    const next = { ...filters, ...patch };
    if (!Object.prototype.hasOwnProperty.call(patch, 'page')) next.page = 1;
    setFilters(next);
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === false || value === 'all' || key === 'limit') return;
      if (key === 'page' && value === 1) return;
      params.set(key, String(value));
    });
    setSearchParams(params, { replace: true });
  };

  const listingsQuery = useQuery({
    queryKey: ['marketplace', filters],
    queryFn: () => getProperties(filters),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
  const listings = listingsQuery.data?.data || [];
  const total = listingsQuery.data?.total || 0;
  const totalPages = listingsQuery.data?.totalPages || Math.max(1, Math.ceil(total / 12));
  const loading = listingsQuery.isPending;
  const error = listingsQuery.error instanceof Error ? listingsQuery.error.message : listingsQuery.error ? 'Could not load marketplace listings.' : '';
  const marketplaceTitle = filters.listingType === 'sale' ? 'Available Properties for Sale' : filters.listingType === 'lease' ? 'Available Properties for Lease' : 'Available Properties for Rent';
  const featuredListings = useMemo(() => listings.filter((property) => Boolean(property.isFeatured)).slice(0, 12), [listings]);
  const verifiedListings = useMemo(() => listings.filter((property) => Boolean(property.isVerified)).slice(0, 12), [listings]);

  const clear = () => updateFilters({
    type: 'all', listingType: 'rent', search: '', city: '', state: '', country: '', address: '',
    landlord: '', verified: false, trustedSeller: false, minPrice: undefined, maxPrice: undefined, page: 1,
  });

  const mobileCategory = (label: string, icon: ReactNode, patch: Partial<PropertyFilters>) => <Chip clickable onClick={() => updateFilters(patch)} icon={icon as any} label={label} variant="outlined" sx={{ flex: '0 0 auto', height: 38, px: .5, borderColor: 'rgba(21,34,37,.16)', bgcolor: 'background.paper', boxShadow: '0 4px 10px rgba(15,23,42,.08)', '& .MuiChip-label': { fontSize: 13, fontWeight: 700 } }} />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', backgroundImage: 'radial-gradient(circle at 92% 2%, rgba(32,132,99,.10), transparent 30rem)' }}>
      <Box sx={{ display: { xs: 'none', md: 'block' }, borderBottom: '1px solid rgba(255,255,255,.16)', color: '#fff', background: 'linear-gradient(118deg, #073f56 0%, #0a607a 66%, #197869 145%)', position: 'relative', overflow: 'hidden', '&::after': { content: '""', position: 'absolute', width: 280, height: 280, right: '8%', top: -210, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.10)' } }}>
        <Container maxWidth="xl" sx={{ py: 3.4, position: 'relative', zIndex: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
            <Box>
              <Typography component="h1" sx={{ color: '#fff', fontSize: { md: 26, lg: 30 }, fontWeight: 820, letterSpacing: '-.045em' }}>{marketplaceTitle}</Typography>
              <Typography sx={{ mt: .5, color: 'rgba(255,255,255,.76)', fontSize: 13 }}>Find a verified home, commercial space or plot that fits your needs.</Typography>
            </Box>
            <Stack direction="row" alignItems="center" gap={1.2}>
              <Chip icon={<ApartmentRounded />} label={`${total} live listings`} sx={{ height: 36, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.18)', fontWeight: 780, '& .MuiChip-icon': { color: '#fff' } }} />
              <ToggleButtonGroup exclusive value={filters.listingType} onChange={(_event, value) => value && updateFilters({ listingType: value })} size="small" sx={{ p: .35, borderRadius: 3, bgcolor: 'rgba(255,255,255,.10)', '& .MuiToggleButton-root': { px: 1.6, color: 'rgba(255,255,255,.75)', border: 0, fontWeight: 780, textTransform: 'none', '&.Mui-selected': { color: '#073f56', bgcolor: '#fff', '&:hover': { bgcolor: '#fff' } } } }}>
                <ToggleButton value="rent">Rent</ToggleButton>
                <ToggleButton value="sale">Sale</ToggleButton>
                <ToggleButton value="lease">Lease</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box sx={{ display: { xs: 'block', md: 'none' }, px: 1.5, pt: 1.5, pb: 10 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.2} sx={{ mx: -1.5, mt: -1.5, px: 2, pt: 2.2, pb: 5.4, color: '#fff', background: 'linear-gradient(125deg, #073f56, #0a607a 68%, #197869 145%)', borderRadius: '0 0 28px 28px' }}>
          <Box>
            <Typography component="h1" sx={{ color: '#fff', fontSize: 23, fontWeight: 820, letterSpacing: '-.045em', lineHeight: 1.08 }}>{marketplaceTitle}</Typography>
            <Typography sx={{ mt: .65, color: 'rgba(255,255,255,.76)', fontSize: 12 }}>Find a verified space that fits your needs.</Typography>
          </Box>
          <Chip label={`${total} live`} size="small" sx={{ mt: .25, fontWeight: 800, color: '#fff', bgcolor: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.20)' }} />
        </Stack>

        <Box sx={{ mt: -3.2, position: 'relative', zIndex: 1, p: 1, border: '1px solid rgba(13, 73, 96, .13)', borderRadius: '20px', bgcolor: 'rgba(255,255,255,.96)', backdropFilter: 'blur(16px)', boxShadow: '0 16px 36px rgba(23, 60, 81, .16)' }}>
          <TextField size="small" fullWidth placeholder="Search by property, area or city" value={filters.search || ''} onChange={(event) => updateFilters({ search: event.target.value })} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: .85, mt: .85 }}>
            <TextField select size="small" label="Property type" value={filters.type || 'all'} onChange={(event) => updateFilters({ type: event.target.value })}>
              {types.map((item) => <MenuItem key={item.key} value={item.key}>{item.label}</MenuItem>)}
            </TextField>
            <Button variant="contained" startIcon={<TuneRounded />} onClick={() => setFiltersOpen((open) => !open)} sx={{ minHeight: 40, borderRadius: 2.5, textTransform: 'none', fontWeight: 850 }}>{filtersOpen ? 'Close filters' : 'Filters'}</Button>
          </Box>
          {filtersOpen && <Box sx={{ display: 'grid', gap: .85, mt: .85 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: .85 }}><LocationFields value={{ country: filters.country, state: filters.state, city: filters.city }} onChange={(next) => updateFilters({ country: next.country || '', state: next.state || '', city: next.city || '' })} /></Box>
            <TextField size="small" label="Address / locality" value={filters.address || ''} onChange={(event) => updateFilters({ address: event.target.value })} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: .85 }}>
              <TextField size="small" type="number" label="Min price" value={filters.minPrice || ''} onChange={(event) => updateFilters({ minPrice: event.target.value ? Number(event.target.value) : undefined })} />
              <TextField size="small" type="number" label="Max price" value={filters.maxPrice || ''} onChange={(event) => updateFilters({ maxPrice: event.target.value ? Number(event.target.value) : undefined })} />
            </Box>
            <FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={Boolean(filters.verified)} onChange={(_event, checked) => updateFilters({ verified: checked })} />} label={<Typography fontSize={12}>Verified listings only</Typography>} />
          </Box>}
        </Box>

        <Box className="sa-mobile-category-rail" sx={{ display: 'flex', gap: .85, overflowX: 'auto', py: 1.35, px: .1 }}>
          {mobileCategory('All', <StorefrontRounded fontSize="small" />, { listingType: 'all', type: 'all', page: 1 })}
          {mobileCategory('Rent', <HomeWorkRounded fontSize="small" />, { listingType: 'rent', type: 'all', page: 1 })}
          {mobileCategory('Sale', <ApartmentRounded fontSize="small" />, { listingType: 'sale', type: 'all', page: 1 })}
          {mobileCategory('Lease', <MeetingRoomRounded fontSize="small" />, { listingType: 'lease', type: 'all', page: 1 })}
        </Box>
        <MobileListingRail title="Featured properties" listings={featuredListings} loading={loading} onSeeAll={() => updateFilters({ page: 1 })} isWishlisted={wishlist.isWishlisted} onToggle={wishlist.toggle} />
        <MobileListingRail title="Verified properties" listings={verifiedListings} loading={loading} onSeeAll={() => updateFilters({ page: 1 })} isWishlisted={wishlist.isWishlisted} onToggle={wishlist.toggle} />
        <MobileListingRail title="All available properties" listings={listings} loading={loading} onSeeAll={() => updateFilters({ page: 1 })} isWishlisted={wishlist.isWishlisted} onToggle={wishlist.toggle} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Box>

      <Container maxWidth="xl" sx={{ display: { xs: 'none', md: 'block' }, py: 3.25 }}>
        <Box sx={{ p: 1.25, border: '1px solid rgba(13, 73, 96, .14)', borderRadius: '22px', bgcolor: 'rgba(255,255,255,.96)', backdropFilter: 'blur(16px)', boxShadow: '0 12px 30px rgba(23, 60, 81, .085)' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { md: 'minmax(230px, 1.45fr) minmax(165px, .8fr) minmax(170px, .8fr) auto', xl: 'minmax(320px, 1.65fr) minmax(180px, .75fr) minmax(180px, .75fr) auto' }, gap: 1 }}>
            <TextField size="small" placeholder="Search by property, area or city" value={filters.search || ''} onChange={(event) => updateFilters({ search: event.target.value })} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} />
            <TextField select size="small" label="Property type" value={filters.type || 'all'} onChange={(event) => updateFilters({ type: event.target.value })}>
              {types.map((item) => <MenuItem key={item.key} value={item.key}>{item.label}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Listing type" value={filters.listingType || 'rent'} onChange={(event) => updateFilters({ listingType: event.target.value as PropertyFilters['listingType'] })}>
              <MenuItem value="rent">For rent</MenuItem><MenuItem value="sale">For sale</MenuItem><MenuItem value="lease">For lease</MenuItem>
            </TextField>
            <Button variant="contained" startIcon={<TuneRounded />} onClick={() => setFiltersOpen((open) => !open)} sx={{ minWidth: 118, borderRadius: 2.5, textTransform: 'none', fontWeight: 850 }}>{filtersOpen ? 'Close' : 'Filters'}</Button>
          </Box>
          {filtersOpen && <Box sx={{ mt: 1.1, pt: 1.1, borderTop: '1px solid rgba(13, 73, 96, .1)' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))', xl: '1.8fr minmax(190px, .8fr) minmax(145px, .6fr) minmax(145px, .6fr)' }, gap: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}><LocationFields value={{ country: filters.country, state: filters.state, city: filters.city }} onChange={(next) => updateFilters({ country: next.country || '', state: next.state || '', city: next.city || '' })} /></Box>
              <TextField size="small" label="Address / locality" value={filters.address || ''} onChange={(event) => updateFilters({ address: event.target.value })} />
              <TextField size="small" type="number" label="Minimum price" value={filters.minPrice || ''} onChange={(event) => updateFilters({ minPrice: event.target.value ? Number(event.target.value) : undefined })} />
              <TextField size="small" type="number" label="Maximum price" value={filters.maxPrice || ''} onChange={(event) => updateFilters({ maxPrice: event.target.value ? Number(event.target.value) : undefined })} />
            </Box>
            <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" mt={.8}>
              <FormControlLabel control={<Switch size="small" checked={Boolean(filters.verified)} onChange={(_event, checked) => updateFilters({ verified: checked })} />} label={<Typography fontSize={12}>Verified listings only</Typography>} />
              <FormControlLabel control={<Switch size="small" checked={Boolean(filters.trustedSeller)} onChange={(_event, checked) => updateFilters({ trustedSeller: checked })} />} label={<Typography fontSize={12}>Trusted sellers only</Typography>} />
              {filters.landlord && <Chip icon={<HomeWorkRounded />} color="primary" label="Filtered by landlord" onDelete={() => updateFilters({ landlord: '' })} />}
              {(filters.search || filters.city || filters.state || filters.country || filters.address || filters.minPrice || filters.maxPrice || filters.verified || filters.trustedSeller || filters.landlord) && <Button size="small" onClick={clear} sx={{ textTransform: 'none', fontWeight: 800 }}>Clear filters</Button>}
            </Stack>
          </Box>}
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <DesktopMarketplaceRail
          title="Featured properties"
          subtitle="Prioritised public listings selected for the marketplace."
          listings={featuredListings}
          loading={loading}
          emptyMessage="No featured properties match the current filters."
          isWishlisted={wishlist.isWishlisted}
          onToggle={wishlist.toggle}
        />
        <DesktopMarketplaceRail
          title="Verified properties"
          subtitle="Listings with SecureAsset verification."
          listings={verifiedListings}
          loading={loading}
          emptyMessage="No verified properties match the current filters."
          isWishlisted={wishlist.isWishlisted}
          onToggle={wishlist.toggle}
        />
        <DesktopMarketplaceRail
          title="All available properties"
          subtitle="Browse every public property that matches your filters."
          listings={listings}
          loading={loading}
          emptyMessage="No available properties match the current filters."
          isWishlisted={wishlist.isWishlisted}
          onToggle={wishlist.toggle}
        />

        {!loading && !listings.length && !error && (
          <Box py={12} textAlign="center">
            <StorefrontRounded color="disabled" sx={{ fontSize: 50, mb: 1 }} />
            <Typography fontWeight={900} fontSize={22}>No matching listings</Typography>
            <Typography color="text.secondary">Try another property type, seller, location or price range.</Typography>
            <Button sx={{ mt: 2 }} onClick={clear}>Clear filters</Button>
          </Box>
        )}

        {totalPages > 1 && <Stack alignItems="center" mt={5}><Pagination color="primary" count={totalPages} page={filters.page || 1} onChange={(_event, page) => updateFilters({ page })} /></Stack>}
      </Container>
    </Box>
  );
}
