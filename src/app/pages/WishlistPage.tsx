import { useNavigate } from 'react-router';
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, Container, Grid, IconButton, Stack, Typography,
} from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import ExploreRounded from '@mui/icons-material/ExploreRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import type { Property } from '../services/types';
import OptimizedImage from '../components/shared/OptimizedImage';
import { propertyOverviewPath } from '../utils/propertyUrl';

const fallbackImage = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=82';

function money(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function locationLabel(property: Property) {
  const value: any = property;
  return [value.address?.locality, value.address?.city, value.address?.state].filter(Boolean).join(', ') || 'Location available on request';
}

function priceValue(property: Property) {
  const value: any = property;
  return Number(value.price || value.pricing?.monthlyRent || value.pricing?.salePrice || value.pricing?.leaseAmount || 0);
}

function WishlistCard({ item, onRemove }: { item: any; onRemove: () => Promise<void> }) {
  const navigate = useNavigate();
  const property = item.listing as Property;
  const value: any = property;
  const openPath = item.listingKind === 'space' ? `/marketplace/${item.listingId}` : propertyOverviewPath(property);
  return <Card className="sa-wishlist-card" variant="outlined" sx={{ height: '100%', p: .75, overflow: 'visible', borderColor: 'rgba(13, 73, 96, .14)', borderRadius: '20px', bgcolor: '#fff', boxShadow: '0 5px 16px rgba(19, 56, 77, .07)', transition: 'transform .2s, box-shadow .2s, border-color .2s', '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(11, 82, 112, .3)', boxShadow: '0 14px 28px rgba(19, 56, 77, .13)' } }}>
    <Box sx={{ position: 'relative' }}>
      <CardActionArea onClick={() => navigate(openPath)}>
        <Box sx={{ height: { xs: 142, sm: 165, md: 154 }, overflow: 'hidden', bgcolor: 'action.hover', borderRadius: '16px' }}>
          <OptimizedImage src={value.images?.[0] || value.galleryCover || value.coverImage || fallbackImage} alt={value.title || value.name || 'Saved property'} width={720} height={440} sizes="(max-width: 600px) 50vw, (max-width: 1200px) 25vw, 16.67vw" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} />
        </Box>
      </CardActionArea>
      <IconButton aria-label="Remove from wishlist" onClick={() => void onRemove()} sx={{ position: 'absolute', top: 10, right: 10, bgcolor: 'rgba(255,255,255,.94)', color: 'error.main', '&:hover': { bgcolor: '#fff' } }}><FavoriteRounded /></IconButton>
    </Box>
    <CardActionArea onClick={() => navigate(openPath)} sx={{ '& .MuiCardActionArea-focusHighlight': { opacity: 0 } }}>
      <CardContent sx={{ p: .7, pt: 1.05, '&:last-child': { pb: .45 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Typography sx={{ minWidth: 0, flex: 1, fontFamily: '"Open Sans", Arial, sans-serif', fontWeight: 850, fontSize: { xs: 11.5, sm: 13.25 }, lineHeight: 1.3, minHeight: { xs: 30, sm: 34 }, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{value.title || value.name || 'Saved property'}</Typography>
          <Chip size="small" label={String(value.listingType || value.purpose || 'rent').replaceAll('_', ' ')} sx={{ height: 21, flexShrink: 0, textTransform: 'capitalize', '& .MuiChip-label': { px: .8, fontSize: 9 } }} />
        </Stack>
        <Stack direction="row" gap={.4} alignItems="center" sx={{ mt: .55 }}>
          <LocationOnRounded sx={{ fontSize: 14, color: 'text.disabled' }} />
          <Typography noWrap color="text.secondary" fontSize={10.75}>{locationLabel(property)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: 1.3 }}>
          <Box><Typography color="text.secondary" fontSize={9.25} fontWeight={800}>SAVED PRICE</Typography><Typography color="primary" fontWeight={950} fontSize={18}>{money(priceValue(property))}</Typography></Box>
          <ArrowForwardRounded sx={{ color: 'text.secondary', fontSize: 19 }} />
        </Stack>
      </CardContent>
    </CardActionArea>
  </Card>;
}

export default function WishlistPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, loading, error, remove } = useWishlist();
  const isTenant = user?.role === 'tenant';
  return <Box className="sa-wishlist-page" sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', pb: { xs: 10, md: 5 } }}>
    <Box sx={{ borderBottom: '1px solid rgba(16, 62, 82, .1)', bgcolor: '#fff' }}>
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 2.7 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5} alignItems={{ sm: 'center' }}>
          <Box><Typography component="h1" sx={{ color: '#102d3c', fontSize: { xs: 23, md: 27 }, fontWeight: 900, letterSpacing: '-.045em' }}>Saved properties</Typography><Typography color="text.secondary" sx={{ mt: .45, fontSize: { xs: 12, md: 12.5 } }}>{isTenant ? 'Your saved properties are securely synced to your account.' : 'Save properties on this device while you explore SecureAsset.'}</Typography></Box>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Chip label={`${items.length} saved`} sx={{ height: 34, borderRadius: 2.5, bgcolor: 'rgba(11, 82, 112, .07)', color: 'primary.main', fontWeight: 800 }} /><Button variant="contained" startIcon={<ExploreRounded />} onClick={() => navigate('/marketplace')} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 850 }}>Explore properties</Button></Stack>
        </Stack>
      </Container>
    </Box>
    <Container maxWidth="xl" sx={{ py: { xs: 2.25, md: 3.25 } }}>
      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && !items.length && <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}><CircularProgress size={30} /></Box>}
      {!loading && !items.length && <Box sx={{ py: { xs: 8, md: 12 }, px: 2, textAlign: 'center', border: '1px solid rgba(13, 73, 96, .12)', borderRadius: '20px', bgcolor: '#fff' }}><FavoriteRounded sx={{ fontSize: 54, color: 'text.disabled', mb: 1 }} /><Typography sx={{ fontWeight: 900, fontSize: 22 }}>Your wishlist is empty</Typography><Typography color="text.secondary" sx={{ mt: .7 }}>Tap the heart on a property to keep it here for later.</Typography><Button variant="outlined" sx={{ mt: 2.5, borderRadius: 2.5, textTransform: 'none', fontWeight: 800 }} onClick={() => navigate('/marketplace')}>Find a property</Button></Box>}
      {Boolean(items.length) && <Grid container spacing={{ xs: 1.1, sm: 1.5, lg: 1.8 }}>{items.map((item) => <Grid key={`${item.listingKind}-${item.listingId}`} size={{ xs: 6, sm: 4, md: 3, xl: 2 }}><WishlistCard item={item} onRemove={() => remove(item.listingId, item.listingKind)} /></Grid>)}</Grid>}
    </Container>
  </Box>;
}
