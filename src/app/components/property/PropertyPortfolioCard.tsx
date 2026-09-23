import type { ElementType, KeyboardEvent, MouseEvent } from 'react';
import { Box, Button, Card, CardContent, Chip, IconButton, Stack, Typography } from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import AccessibleRounded from '@mui/icons-material/AccessibleRounded';
import AcUnitRounded from '@mui/icons-material/AcUnitRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ChildFriendlyRounded from '@mui/icons-material/ChildFriendlyRounded';
import ChairRounded from '@mui/icons-material/ChairRounded';
import DeckRounded from '@mui/icons-material/DeckRounded';
import DirectionsRunRounded from '@mui/icons-material/DirectionsRunRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import FitnessCenterRounded from '@mui/icons-material/FitnessCenterRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import Inventory2Rounded from '@mui/icons-material/Inventory2Rounded';
import KitchenRounded from '@mui/icons-material/KitchenRounded';
import LocalParkingRounded from '@mui/icons-material/LocalParkingRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import PoolRounded from '@mui/icons-material/PoolRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import ShowerRounded from '@mui/icons-material/ShowerRounded';
import VideocamRounded from '@mui/icons-material/VideocamRounded';
import WifiRounded from '@mui/icons-material/WifiRounded';
import YardRounded from '@mui/icons-material/YardRounded';

type PropertyPortfolioCardProps = {
  row: Record<string, any>;
  onOpen: () => void;
  onEdit?: () => void;
  onManageRooms?: () => void;
  onMore: (event: MouseEvent<HTMLButtonElement>) => void;
};

const AMENITY_ICONS: Array<{ match: RegExp; Icon: ElementType }> = [
  { match: /cctv|camera|video surveillance/, Icon: VideocamRounded },
  { match: /security|guard|gated community/, Icon: SecurityRounded },
  { match: /pool|swimming/, Icon: PoolRounded },
  { match: /gym|fitness/, Icon: FitnessCenterRounded },
  { match: /garden|green space|landscap/, Icon: YardRounded },
  { match: /child|play area/, Icon: ChildFriendlyRounded },
  { match: /jogging|running|track/, Icon: DirectionsRunRounded },
  { match: /clubhouse|community hall|common room/, Icon: GroupsRounded },
  { match: /terrace|balcony|deck/, Icon: DeckRounded },
  { match: /air condition|\bac\b|cooling/, Icon: AcUnitRounded },
  { match: /kitchen|cooking/, Icon: KitchenRounded },
  { match: /store room|storage/, Icon: Inventory2Rounded },
  { match: /servant room|guest room|bedroom|room/, Icon: MeetingRoomRounded },
  { match: /wheelchair|accessible/, Icon: AccessibleRounded },
  { match: /parking|garage/, Icon: LocalParkingRounded },
  { match: /wifi|wi-fi|internet/, Icon: WifiRounded },
  { match: /bath|shower|toilet/, Icon: ShowerRounded },
  { match: /bed|sleep/, Icon: BedRounded },
  { match: /furnish|furniture/, Icon: ChairRounded },
  { match: /lift|elevator/, Icon: ApartmentRounded },
];

function isEnabled(value: unknown) {
  return value === true || value === 1 || ['true', 'yes', '1'].includes(String(value).trim().toLowerCase());
}

function amenityLabel(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return titleCase(String(value));
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return amenityLabel(item.label || item.name || item.title || item.key || '');
  }
  return '';
}

function amenityItems(row: Record<string, any>) {
  const labels = Array.isArray(row?.amenities) ? row.amenities.map(amenityLabel) : [];
  const details = row?.amenityDetails && typeof row.amenityDetails === 'object' ? row.amenityDetails : {};
  Object.entries(details).forEach(([key, enabled]) => {
    if (isEnabled(enabled)) labels.push(titleCase(key.replace(/([a-z0-9])([A-Z])/g, '$1 $2')));
  });

  const seen = new Set<string>();
  return labels.filter(Boolean).reduce<Array<{ label: string; Icon: ElementType }>>((items, label) => {
    const normalized = label.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normalized || seen.has(normalized)) return items;
    seen.add(normalized);
    const match = AMENITY_ICONS.find((rule) => rule.match.test(label));
    items.push({ label, Icon: match?.Icon || CheckCircleRounded });
    return items;
  }, []);
}

function propertyFacts(row: Record<string, any>) {
  const specifications = row?.specifications || {};
  const rooms = row?.roomDetails || {};
  const facts = [
    { label: 'Bedrooms', value: specifications.bedrooms ?? rooms.bedrooms, Icon: BedRounded },
    { label: 'Bathrooms', value: specifications.bathrooms ?? rooms.bathrooms, Icon: ShowerRounded },
    { label: 'Balconies', value: specifications.balconies ?? rooms.balconies, Icon: DeckRounded },
  ];
  return facts.filter(({ value }) => value !== undefined && value !== null && value !== '' && Number(value) > 0);
}

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
 * A responsive dashboard card for property portfolio records. The common
 * facts and amenity tiles keep listings scannable on both phone and desktop.
 */
export default function PropertyPortfolioCard({ row, onOpen, onEdit, onManageRooms, onMore }: PropertyPortfolioCardProps) {
  const title = String(row?.title || 'Untitled property');
  const reference = String(row?.referenceNumber || row?.code || '').trim();
  const purpose = titleCase(row?.purpose || row?.listingType || 'rent');
  const type = titleCase(row?.type || 'Property');
  const status = titleCase(row?.status || 'draft');
  const visibility = String(row?.visibility || 'private').toLowerCase() === 'public' ? 'Public' : 'Private';
  const city = [row?.address?.city, row?.address?.state].filter(Boolean).join(', ') || 'Location not added';
  const amenities = amenityItems(row);
  const facts = propertyFacts(row);
  const isRent = String(row?.purpose || row?.listingType || '').toLowerCase() === 'rent';
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    onOpen();
  };

  return <Card
    data-secureasset-property-portfolio-card="amenity-dashboard-v1"
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
          <Stack direction="row" alignItems="center" spacing={.2} sx={{ mt: -.35, mr: -.55, flex: '0 0 auto' }}>
            {onEdit && <IconButton aria-label={`Edit ${title}`} onClick={(event) => { event.stopPropagation(); onEdit(); }} onKeyDown={(event) => event.stopPropagation()} sx={{ color: '#0B5270' }}><EditRounded fontSize="small" /></IconButton>}
            <IconButton aria-label={`More actions for ${title}`} onClick={(event) => { event.stopPropagation(); onMore(event); }} onKeyDown={(event) => event.stopPropagation()} sx={{ color: '#0B5270' }}><MoreVertRounded /></IconButton>
          </Stack>
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
        {facts.length > 0 && <Box sx={{ mt: 1.25 }}>
          <Typography sx={{ mb: .65, color: '#68777A', fontSize: 9.5, fontWeight: 850, letterSpacing: '.07em', textTransform: 'uppercase' }}>Property details</Typography>
          <Stack direction="row" flexWrap="wrap" gap={.65}>
            {facts.map(({ label, value, Icon }) => <Stack key={label} direction="row" alignItems="center" spacing={.55} sx={{ minWidth: 82, px: .9, py: .65, border: '1px solid rgba(11,82,112,.12)', borderRadius: 2, bgcolor: '#FFFFFF' }}>
              <Icon sx={{ color: '#0B5270', fontSize: 16 }} />
              <Typography sx={{ color: '#152225', fontSize: 11, fontWeight: 800 }}>{value}<Box component="span" sx={{ ml: .35, color: '#68777A', fontWeight: 600 }}>{label.toLowerCase()}</Box></Typography>
            </Stack>)}
          </Stack>
        </Box>}
        <Box sx={{ mt: 1.25, p: 1, border: '1px solid rgba(11,82,112,.12)', borderRadius: 2.5, bgcolor: '#FFFFFF' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ mb: .75 }}>
            <Typography sx={{ color: '#152225', fontSize: 11.5, fontWeight: 850 }}>Amenities</Typography>
            <Typography sx={{ color: '#68777A', fontSize: 10 }}>{amenities.length ? `${amenities.length} included` : 'None added'}</Typography>
          </Stack>
          {amenities.length > 0 ? <Stack direction="row" flexWrap="wrap" useFlexGap gap={.65}>
            {amenities.slice(0, 4).map(({ label, Icon }) => <Stack key={label} title={label} aria-label={label} alignItems="center" justifyContent="center" spacing={.35} sx={{ width: 62, minHeight: 55, px: .45, py: .55, border: '1px solid rgba(11,82,112,.10)', borderRadius: 2, bgcolor: '#F5FBFC', color: '#0B5270' }}>
              <Icon sx={{ fontSize: 18 }} />
              <Typography noWrap sx={{ width: '100%', color: '#526A70', fontSize: 9.2, textAlign: 'center' }}>{label}</Typography>
            </Stack>)}
            {amenities.length > 4 && <Stack alignItems="center" justifyContent="center" spacing={.35} sx={{ width: 62, minHeight: 55, border: '1px dashed rgba(11,82,112,.24)', borderRadius: 2, bgcolor: '#FFFFFF', color: '#0B5270' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 900 }}>+{amenities.length - 4}</Typography>
              <Typography sx={{ color: '#526A70', fontSize: 9.2 }}>more</Typography>
            </Stack>}
          </Stack> : <Typography color="text.secondary" sx={{ fontSize: 11 }}>Add amenities to show them here.</Typography>}
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={.8} sx={{ mt: 1.3 }} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <Button variant="contained" endIcon={<ArrowOutwardRounded />} onClick={(event) => { event.stopPropagation(); onOpen(); }} sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' }, minHeight: 42, fontWeight: 850 }}>Open property</Button>
          {isRent && onManageRooms && <Button variant="outlined" startIcon={<MeetingRoomRounded />} onClick={(event) => { event.stopPropagation(); onManageRooms(); }} sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' }, minHeight: 42, fontWeight: 820 }}>Manage rooms</Button>}
        </Stack>
      </Box>
    </CardContent>
  </Card>;
}
