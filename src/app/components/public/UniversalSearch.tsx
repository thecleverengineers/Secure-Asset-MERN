import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Autocomplete, Avatar, Box, Button, Chip, CircularProgress, DialogContent, IconButton,
  InputAdornment, Stack, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import ProfessionalDialog from '../shared/ProfessionalDialog';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import EngineeringRounded from '@mui/icons-material/EngineeringRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import ManageSearchRounded from '@mui/icons-material/ManageSearchRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { searchPublicMarketplace } from '../../services/api';
import type { PublicSearchResult, PublicSearchResultType } from '../../services/types';

const categoryLabels: Record<PublicSearchResultType, string> = {
  property: 'Properties',
  verified_rental: 'Verified rentals',
  surveyor: 'Surveyors',
  trusted_seller: 'Trusted sellers',
  landlord: 'Landlords',
  location: 'Locations',
};

const categoryIcons: Record<PublicSearchResultType, typeof ApartmentRounded> = {
  property: ApartmentRounded,
  verified_rental: VerifiedRounded,
  surveyor: EngineeringRounded,
  trusted_seller: StorefrontRounded,
  landlord: HomeWorkRounded,
  location: LocationOnRounded,
};

export function searchCategoryLabel(type: PublicSearchResultType) {
  return categoryLabels[type];
}

export function SearchResultIcon({ type, fontSize = 22 }: { type: PublicSearchResultType; fontSize?: number }) {
  const Icon = categoryIcons[type] || ManageSearchRounded;
  return <Icon sx={{ fontSize }} />;
}

interface UniversalSearchFieldProps {
  initialValue?: string;
  autoFocus?: boolean;
  compact?: boolean;
  placeholder?: string;
  onNavigate?: () => void;
}

export function UniversalSearchField({
  initialValue = '',
  autoFocus = false,
  compact = false,
  placeholder = 'Search properties, surveyors, sellers, landlords or locations…',
  onNavigate,
}: UniversalSearchFieldProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialValue);
  const [options, setOptions] = useState<PublicSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setQuery(initialValue), [initialValue]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setOptions([]);
      setLoading(false);
      setError('');
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await searchPublicMarketplace(value, { limit: compact ? 5 : 8 });
        if (active) setOptions(response.data.results);
      } catch (searchError) {
        if (active) {
          setOptions([]);
          setError(searchError instanceof Error ? searchError.message : 'Search is temporarily unavailable.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, compact]);

  const go = (href: string) => {
    onNavigate?.();
    navigate(href);
  };
  const submit = () => {
    const value = query.trim();
    if (!value) return;
    go(`/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <Box component="form" onSubmit={(event) => { event.preventDefault(); submit(); }} sx={{ width: '100%', position: 'relative' }}>
      <Autocomplete<PublicSearchResult, false, false, true>
        freeSolo
        autoHighlight
        clearOnBlur={false}
        filterOptions={(items) => items}
        options={options}
        inputValue={query}
        loading={loading}
        getOptionLabel={(option) => typeof option === 'string' ? option : option.title}
        groupBy={(option) => typeof option === 'string' ? '' : categoryLabels[option.type]}
        onInputChange={(_event, value, reason) => { if (reason !== 'reset') setQuery(value); }}
        onChange={(_event, value) => {
          if (typeof value === 'string') {
            setQuery(value);
            window.setTimeout(submit, 0);
          } else if (value?.href) go(value.href);
        }}
        noOptionsText={query.trim().length < 2 ? 'Type at least two characters' : error || 'No matching public records'}
        slotProps={{
          popper: { sx: { zIndex: 1700 } },
          paper: {
            sx: {
              mt: 1, borderRadius: 3.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider',
              boxShadow: '0 24px 70px rgba(15, 23, 42, .18)', maxHeight: compact ? 430 : 560,
            },
          },
        }}
        renderGroup={(params) => (
          <Box component="li" key={params.key} sx={{ '& ul': { p: 0 } }}>
            <Typography sx={{ px: 2, pt: 1.5, pb: .7, fontSize: 10.5, fontWeight: 900, letterSpacing: '.09em', color: 'text.secondary', textTransform: 'uppercase' }}>
              {params.group}
            </Typography>
            {params.children}
          </Box>
        )}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props;
          return (
            <Box component="li" key={key} {...optionProps} sx={{ px: '14px !important', py: '10px !important', gap: 1.3, alignItems: 'center !important' }}>
              <Avatar src={option.image || undefined} variant={option.type === 'property' || option.type === 'verified_rental' ? 'rounded' : 'circular'} sx={{ width: 46, height: 46, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                <SearchResultIcon type={option.type} fontSize={21} />
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" alignItems="center" gap={.7}>
                  <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 850 }}>{option.title}</Typography>
                  {option.verified && <VerifiedRounded color="primary" sx={{ fontSize: 16, flexShrink: 0 }} />}
                </Stack>
                <Typography noWrap sx={{ color: 'text.secondary', fontSize: 11.5, mt: .2 }}>{option.subtitle || categoryLabels[option.type]}</Typography>
              </Box>
              <Chip size="small" label={option.badge || categoryLabels[option.type]} variant="outlined" sx={{ display: { xs: 'none', sm: 'flex' }, maxWidth: 130 }} />
              <ArrowOutwardRounded sx={{ fontSize: 17, color: 'text.disabled' }} />
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            autoFocus={autoFocus}
            placeholder={placeholder}
            error={Boolean(error)}
            helperText={error || undefined}
            inputProps={{ ...params.inputProps, 'aria-label': 'Search the SecureAsset marketplace' }}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <Stack direction="row" alignItems="center" gap={.5}>
                  {loading && <CircularProgress size={18} />}
                  {params.InputProps.endAdornment}
                  <Button
                    type="submit"
                    variant="contained"
                    disableElevation
                    aria-label="Show all search results"
                    sx={{ minWidth: compact ? 42 : 96, height: compact ? 38 : 46, px: compact ? 0 : 2.2, borderRadius: 2.3, display: { xs: compact ? 'none' : 'inline-flex', sm: 'inline-flex' } }}
                  >
                    {compact ? <SearchRounded fontSize="small" /> : 'Search'}
                  </Button>
                </Stack>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                minHeight: compact ? 46 : 62,
                bgcolor: 'background.paper',
                borderRadius: compact ? 999 : 3.5,
                pr: compact ? .6 : .9,
                boxShadow: compact ? 'none' : '0 16px 45px rgba(15, 23, 42, .12)',
                '& fieldset': { borderColor: compact ? 'divider' : 'transparent' },
                '&:hover fieldset': { borderColor: compact ? 'primary.main' : 'transparent' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 1.5 },
              },
              '& .MuiInputBase-input': { fontSize: compact ? 13 : { xs: 14, sm: 16 }, fontWeight: 600 },
              '& .MuiFormHelperText-root': { bgcolor: 'background.paper', m: 0, px: 1.5, pt: .5 },
            }}
          />
        )}
      />
    </Box>
  );
}

export function UniversalSearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search).get('q') || '', [location.search]);

  return (
    <ProfessionalDialog
      open={open}
      onClose={onClose}
      fullScreen={mobile}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: { borderRadius: mobile ? 0 : 5, bgcolor: 'background.default', overflow: 'visible' } }}
      professionalTitle="Search everything public"
      professionalSubtitle="Properties, verified rentals, surveyors, sellers, landlords and locations."
      enableMinimize={!mobile}
    >
      <DialogContent sx={{ p: { xs: 2, sm: 4 }, pt: { xs: 2, sm: 3.5 }, overflow: 'visible' }}>
        <UniversalSearchField initialValue={query} autoFocus onNavigate={onClose} />
        <Stack direction="row" gap={1} flexWrap="wrap" mt={2.5}>
          {['Verified rentals', 'Trusted sellers', 'Surveyors', 'City or address'].map((label) => <Chip key={label} label={label} size="small" variant="outlined" />)}
        </Stack>
      </DialogContent>
    </ProfessionalDialog>
  );
}
