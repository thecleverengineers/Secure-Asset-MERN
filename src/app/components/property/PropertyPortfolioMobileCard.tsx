import type { KeyboardEvent, MouseEvent } from 'react';
import { Box, Button, Card, CardContent, Chip, IconButton, Stack, Typography } from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import LockRounded from '@mui/icons-material/LockRounded';

type PropertyPortfolioMobileCardProps = {
  row: Record<string, any>;
  onOpen: () => void;
  onEdit?: () => void;
  onMore: (event: MouseEvent<HTMLButtonElement>) => void;
};

function titleCase(value: unknown) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || '—';
}

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
    : 'Price on request';
}

function propertyPrice(row: Record<string, any>) {
  const purpose = String(row?.purpose || row?.listingType || 'rent');
  if (Number.isFinite(Number(row?.price)) && Number(row.price) > 0) return money(row.price);
  if (purpose === 'sale') return money(row?.pricing?.salePrice);
  if (purpose === 'lease') return money(row?.pricing?.leaseAmount);
  return money(row?.pricing?.monthlyRent);
}

/**
 * A touch-first, scan-friendly alternative to a compressed desktop table row.
 * It is intentionally specific to property portfolio records so that the
 * title, location, price, status, and record actions stay immediately useful
 * on a narrow viewport.
 */
export default function PropertyPortfolioMobileCard({ row, onOpen, onEdit, onMore }: PropertyPortfolioMobileCardProps) {
  const title = String(row?.title || 'Untitled property');
  const reference = String(row?.referenceNumber || row?.code || '').trim();
  const purpose = titleCase(row?.purpose || row?.listingType || 'rent');
  const type = titleCase(row?.type || 'Property');
  const status = titleCase(row?.status || 'draft');
  const visibility = String(row?.visibility || 'private').toLowerCase() === 'public' ? 'Public' : 'Private';
  const city = [row?.address?.city, row?.address?.state].filter(Boolean).join(', ') || 'Location not added';
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    onOpen();
  };

  return <Card
    data-secureasset-property-mobile-card="portfolio-v154"
    className="sa-surface-card"
    elevation={0}
    onClick={onOpen}
    onKeyDown={handleKeyDown}
    role="button"
    tabIndex={0}
    aria-label={`Open ${title} details`}
    sx={{
      overflow: 'hidden',
      cursor: 'pointer',
      borderColor: 'rgba(11,82,112,.16)',
      transition: 'border-color .18s ease, transform .18s ease, box-shadow .18s ease',
      '&:hover': { borderColor: '#0B5270', transform: 'translateY(-1px)', boxShadow: '0 12px 24px rgba(11,82,112,.10)' },
      '&:focus-visible': { outline: '3px solid rgba(11,82,112,.30)', outlineOffset: 2 },
    }}
  >
    <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
      <Box sx={{ px: 1.6, pt: 1.5, pb: 1.25, bgcolor: '#F5FBFC', borderBottom: '1px solid rgba(11,82,112,.12)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', flex: '0 0 auto', width: 38, height: 38, borderRadius: 2.5, color: '#0B5270', bgcolor: '#E4F3F7' }}><ApartmentRounded fontSize="small" /></Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ color: '#152225', fontWeight: 900, fontSize: 15, lineHeight: 1.25 }}>{title}</Typography>
              <Typography noWrap color="text.secondary" sx={{ mt: .18, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{reference ? `Ref · ${reference}` : `${type} · ${purpose}`}</Typography>
            </Box>
          </Stack>
          <IconButton aria-label={`More actions for ${title}`} onClick={onMore} onKeyDown={(event) => event.stopPropagation()} sx={{ mt: -.35, mr: -.55, color: '#0B5270' }}><MoreVertRounded /></IconButton>
        </Stack>
        <Stack direction="row" alignItems="center" gap={.45} sx={{ mt: 1 }}>
          <LocationOnRounded sx={{ color: '#5D747A', fontSize: 15, flex: '0 0 auto' }} />
          <Typography noWrap color="text.secondary" sx={{ fontSize: 12 }}>{city}</Typography>
        </Stack>
      </Box>

      <Box sx={{ px: 1.6, py: 1.35 }}>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={.65}>
          <Chip size="small" label={status} sx={{ bgcolor: '#E4F3F7', color: '#0B5270', fontWeight: 850 }} />
          <Chip size="small" icon={visibility === 'Public' ? <PublicRounded /> : <LockRounded />} label={visibility} variant="outlined" sx={{ borderColor: 'rgba(11,82,112,.22)', color: '#33535C', fontWeight: 800, '& .MuiChip-icon': { fontSize: 14 } }} />
          <Chip size="small" label={`${type} · ${purpose}`} variant="outlined" sx={{ borderColor: '#D9E5E8', color: '#587078', fontWeight: 750 }} />
        </Stack>
        <Box sx={{ mt: 1.25, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, .85fr)', gap: .75 }}>
          <Box sx={{ minWidth: 0, p: 1, borderRadius: 2, bgcolor: '#F8FAFB' }}>
            <Typography color="text.secondary" sx={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '.065em', textTransform: 'uppercase' }}>{purpose === 'Rent' ? 'Monthly rent' : purpose === 'Sale' ? 'Sale price' : 'Lease amount'}</Typography>
            <Typography noWrap sx={{ mt: .25, color: '#152225', fontSize: 14.5, fontWeight: 930 }}>{propertyPrice(row)}</Typography>
          </Box>
          <Box sx={{ minWidth: 0, p: 1, borderRadius: 2, bgcolor: '#F8FAFB' }}>
            <Typography color="text.secondary" sx={{ fontSize: 9.5, fontWeight: 900, letterSpacing: '.065em', textTransform: 'uppercase' }}>Portfolio state</Typography>
            <Typography noWrap sx={{ mt: .25, color: '#152225', fontSize: 13.5, fontWeight: 880 }}>{visibility} listing</Typography>
          </Box>
        </Box>
        <Stack direction="row" gap={.8} sx={{ mt: 1.3 }} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <Button fullWidth variant="contained" endIcon={<ArrowOutwardRounded />} onClick={(event) => { event.stopPropagation(); onOpen(); }} sx={{ minHeight: 42, fontWeight: 850 }}>Open property</Button>
          {onEdit && <Button variant="outlined" startIcon={<EditRounded />} onClick={(event) => { event.stopPropagation(); onEdit(); }} sx={{ minWidth: 106, minHeight: 42, fontWeight: 820 }}>Edit</Button>}
        </Stack>
      </Box>
    </CardContent>
  </Card>;
}
