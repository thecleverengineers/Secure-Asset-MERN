import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Alert, Avatar, Box, Card, CardActionArea, Chip, CircularProgress, Container, Grid, Stack, Typography,
} from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { SearchResultIcon, UniversalSearchField, searchCategoryLabel } from '../components/public/UniversalSearch';
import { searchPublicMarketplace } from '../services/api';
import type { PublicSearchPayload, PublicSearchResult, PublicSearchResultType } from '../services/types';

const categories: Array<{ key: 'all' | PublicSearchResultType; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'property', label: 'Properties' },
  { key: 'verified_rental', label: 'Verified rentals' },
  { key: 'surveyor', label: 'Surveyors' },
  { key: 'trusted_seller', label: 'Trusted sellers' },
  { key: 'landlord', label: 'Landlords' },
  { key: 'location', label: 'Locations' },
];

function ResultCard({ result }: { result: PublicSearchResult }) {
  const navigate = useNavigate();
  const price = Number(result.metadata?.price || 0);
  return (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: 4, overflow: 'hidden', transition: 'transform .2s, box-shadow .2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 } }}>
      <CardActionArea onClick={() => navigate(result.href)} sx={{ height: '100%', p: 2.2, display: 'flex', alignItems: 'stretch' }}>
        <Stack spacing={1.6} sx={{ width: '100%' }}>
          <Stack direction="row" alignItems="center" gap={1.3}>
            <Avatar src={result.image || undefined} variant={result.type === 'property' || result.type === 'verified_rental' ? 'rounded' : 'circular'} sx={{ width: 54, height: 54, bgcolor: 'primary.main' }}>
              <SearchResultIcon type={result.type} />
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" alignItems="center" gap={.6}>
                <Typography noWrap sx={{ fontWeight: 900, fontSize: 15.5 }}>{result.title}</Typography>
                {result.verified && <VerifiedRounded color="primary" sx={{ fontSize: 17 }} />}
              </Stack>
              <Typography noWrap color="text.secondary" sx={{ fontSize: 12, mt: .25 }}>{result.subtitle || searchCategoryLabel(result.type)}</Typography>
            </Box>
          </Stack>
          {result.description && <Typography color="text.secondary" sx={{ fontSize: 12.5, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{result.description}</Typography>}
          <Stack direction="row" alignItems="center" justifyContent="space-between" mt="auto">
            <Chip size="small" label={result.badge || searchCategoryLabel(result.type)} color={result.verified ? 'primary' : 'default'} variant={result.verified ? 'filled' : 'outlined'} />
            <Stack direction="row" alignItems="center" gap={.8}>
              {price > 0 && <Typography color="primary" sx={{ fontWeight: 900, fontSize: 13 }}>₹{price.toLocaleString('en-IN')}</Typography>}
              <ArrowForwardRounded sx={{ fontSize: 18, color: 'text.secondary' }} />
            </Stack>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export default function PublicSearchPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') || '').trim();
  const selected = (params.get('type') || 'all') as 'all' | PublicSearchResultType;
  const [payload, setPayload] = useState<PublicSearchPayload>({ query: '', results: [], counts: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.length < 2) {
      setPayload({ query, results: [], counts: {} });
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    searchPublicMarketplace(query, { types: selected === 'all' ? undefined : [selected], limit: 20 })
      .then((response) => { if (active) setPayload(response.data); })
      .catch((searchError) => { if (active) setError(searchError instanceof Error ? searchError.message : 'Search failed.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, selected]);

  const visible = useMemo(() => selected === 'all' ? payload.results : payload.results.filter((item) => item.type === selected || (selected === 'property' && item.type === 'verified_rental')), [payload.results, selected]);
  const chooseCategory = (type: 'all' | PublicSearchResultType) => {
    const next = new URLSearchParams(params);
    if (type === 'all') next.delete('type'); else next.set('type', type);
    setParams(next);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', py: { xs: 4, md: 6 } }}>
        <Container maxWidth="lg">
          <Typography sx={{ fontWeight: 950, fontSize: { xs: 29, md: 43 }, letterSpacing: '-.045em', mb: 2.5 }}>Search SecureAsset</Typography>
          <UniversalSearchField initialValue={query} />
        </Container>
      </Box>
      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack direction="row" gap={1} flexWrap="wrap" mb={3}>
          {categories.map((category) => {
            const count = category.key === 'all' ? payload.results.length : payload.counts[category.key] || 0;
            return <Chip key={category.key} clickable onClick={() => chooseCategory(category.key)} color={selected === category.key ? 'primary' : 'default'} variant={selected === category.key ? 'filled' : 'outlined'} label={`${category.label}${query ? ` · ${count}` : ''}`} />;
          })}
        </Stack>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {loading ? <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : query.length < 2 ? (
          <Box sx={{ py: 12, textAlign: 'center' }}><Typography sx={{ fontWeight: 900, fontSize: 22 }}>Start with at least two characters</Typography><Typography color="text.secondary" mt={.7}>Search by property, surveyor, landlord, seller, city, state, country or address.</Typography></Box>
        ) : visible.length ? (
          <Grid container spacing={2}>{visible.map((result) => <Grid key={`${result.type}-${result.id}`} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}><ResultCard result={result} /></Grid>)}</Grid>
        ) : (
          <Box sx={{ py: 12, textAlign: 'center' }}><Typography sx={{ fontWeight: 900, fontSize: 22 }}>No public matches found</Typography><Typography color="text.secondary" mt={.7}>Try a broader property type, person name, city, state or address.</Typography></Box>
        )}
      </Container>
    </Box>
  );
}
