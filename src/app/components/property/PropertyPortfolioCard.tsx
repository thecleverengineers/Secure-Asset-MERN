import { useEffect, useMemo, useState, type ElementType, type KeyboardEvent, type MouseEvent } from 'react';
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
import ImageNotSupportedOutlined from '@mui/icons-material/ImageNotSupportedOutlined';
import { fetchPropertyImageBlob, fetchPropertyMediaBlob } from '../../services/api';

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

type PropertyImageCandidate = { src?: string; mediaId?: string; previewFileId?: string };

function imageSources(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(imageSources);
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return imageSources(item.url || item.thumbnailUrl || item.src || item.imageUrl || item.image || item.path || item.secureSource);
  }
  const source = String(value || '').trim();
  if (!source) return [];
  return source.split(/,\s*(?=(?:https?:\/\/|\/(?:api|uploads)|data:|blob:))/i)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => /^(?:https?:\/\/|data:|blob:|\/)/i.test(entry) ? entry : `/${entry}`);
}

function propertyImageCandidates(row: Record<string, any>): PropertyImageCandidate[] {
  const candidates: PropertyImageCandidate[] = [];
  const add = (value: unknown, preferMediaRecord = false) => {
    if (Array.isArray(value)) {
      value.forEach((item) => add(item, preferMediaRecord));
      return;
    }
    if (value && typeof value === 'object') {
      const item = value as Record<string, any>;
      const rawMediaId = item.mediaId || item.propertyMediaId || (preferMediaRecord ? item._id : '');
      const rawPreviewId = item.previewFileId || item.driveFileId || (typeof item.driveFile === 'object' ? item.driveFile?._id : item.driveFile);
      const mediaId = String(rawMediaId || '').trim();
      const previewFileId = String(rawPreviewId || '').trim();
      const sources = imageSources(item);
      if (mediaId || previewFileId || sources.length) {
        candidates.push({ src: sources[0], ...(mediaId ? { mediaId } : {}), ...(previewFileId ? { previewFileId } : {}) });
      }
      return;
    }
    imageSources(value).forEach((src) => candidates.push({ src }));
  };

  const mediaRecords = Array.isArray(row?.propertyMedia) ? row.propertyMedia : Array.isArray(row?.media) ? row.media : [];
  const coverRecord = mediaRecords.find((item: any) => item?.cover || item?.isCover || item?.isPrimary)
    || mediaRecords.find((item: any) => /image|photo/i.test(String(item?.mediaType || item?.mimeType || '')))
    || mediaRecords[0];
  if (coverRecord) add(coverRecord, true);
  add(row?.galleryCover);
  add(row?.coverImage);
  add(row?.mainImage);
  add(row?.primaryImage);
  add(row?.images);

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.mediaId || ''}|${candidate.previewFileId || ''}|${candidate.src || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(key.replaceAll('|', ''));
  });
}

function isAuthenticatedImageSource(source: string) {
  return /^[a-f\d]{24}$/i.test(source.replace(/^\/+/, '').split(/[?#]/, 1)[0])
    || /\/(?:api\/v\d+\/)?(?:drive\/files|files|property-media)\/[a-f\d]{24}(?:\/content)?(?:[/?#]|$)/i.test(source);
}

function mediaIdFromSource(source: string) {
  return source.match(/\/(?:api\/v\d+\/)?property-media\/([a-f\d]{24})(?:\/content)?(?:[/?#]|$)/i)?.[1] || '';
}

function PropertyCardCover({ row, title }: { row: Record<string, any>; title: string }) {
  const candidates = useMemo(() => propertyImageCandidates(row), [row]);
  const candidatesKey = useMemo(() => JSON.stringify(candidates), [candidates]);
  const propertyId = String(row?._id || '');
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSrc('');
    setFailed(false);
    const load = async () => {
      let directFallback = '';
      for (const candidate of candidates) {
        if (candidate.src && !isAuthenticatedImageSource(candidate.src) && !directFallback) directFallback = candidate.src;
        try {
          let blob: Blob | undefined;
          if (candidate.mediaId) blob = await fetchPropertyMediaBlob(candidate.mediaId, propertyId);
          else if (candidate.previewFileId) blob = await fetchPropertyImageBlob(`/drive/files/${encodeURIComponent(candidate.previewFileId)}/content`, propertyId);
          else if (candidate.src && isAuthenticatedImageSource(candidate.src)) {
            const mediaId = mediaIdFromSource(candidate.src);
            blob = mediaId
              ? await fetchPropertyMediaBlob(mediaId, propertyId)
              : await fetchPropertyImageBlob(candidate.src, propertyId);
          }
          if (blob) {
            if (!active) return;
            objectUrl = URL.createObjectURL(blob);
            setSrc(objectUrl);
            return;
          }
        } catch {
          // Older listings sometimes keep a stale media reference; try the next cover source.
        }
      }
      const fallback = directFallback || candidates.find((candidate) => candidate.src)?.src || '';
      if (active && fallback) setSrc(fallback);
      else if (active) setFailed(true);
    };
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [candidates, candidatesKey, propertyId]);

  return <Box sx={{ position: 'relative', height: { xs: 82, sm: 122, lg: 142 }, bgcolor: '#EAF2F4', overflow: 'hidden' }}>
    {src && !failed
      ? <Box component="img" src={src} alt={title} loading="lazy" sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} onError={() => setFailed(true)} />
      : <Stack alignItems="center" justifyContent="center" spacing={.5} sx={{ width: '100%', height: '100%', color: '#769098', background: 'linear-gradient(135deg, #edf5f6, #dce9ec)' }}>
        <ImageNotSupportedOutlined sx={{ fontSize: { xs: 21, sm: 25 } }} />
        <Typography sx={{ fontSize: { xs: 8, sm: 10 }, fontWeight: 750 }}>Image unavailable</Typography>
      </Stack>}
  </Box>;
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
      <PropertyCardCover row={row} title={title} />
      <Box sx={{ px: { xs: 1, sm: 1.6 }, pt: { xs: 1, sm: 1.5 }, pb: { xs: .85, sm: 1.25 }, bgcolor: '#F5FBFC', borderBottom: '1px solid rgba(11,82,112,.12)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={{ xs: .35, sm: 1 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: { xs: 'none', sm: 'grid' }, placeItems: 'center', flex: '0 0 auto', width: 38, height: 38, borderRadius: 2.5, color: '#0B5270', bgcolor: '#E4F3F7' }}><ApartmentRounded fontSize="small" /></Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap title={title} sx={{ color: '#152225', fontWeight: 900, fontSize: { xs: 11.5, sm: 15 }, lineHeight: 1.25 }}>{title}</Typography>
              <Typography noWrap color="text.secondary" sx={{ mt: .18, fontSize: { xs: 8, sm: 10.5 }, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{reference ? `Ref · ${reference}` : `${type} · ${purpose}`}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0} sx={{ flex: '0 0 auto' }}>
            {onEdit && <IconButton size="small" aria-label={`Edit ${title}`} onClick={(event) => { event.stopPropagation(); onEdit(); }} onKeyDown={(event) => event.stopPropagation()} sx={{ color: '#0B5270', width: { xs: 25, sm: 34 }, height: { xs: 25, sm: 34 } }}><EditRounded sx={{ fontSize: { xs: 15, sm: 19 } }} /></IconButton>}
            <IconButton size="small" aria-label={`More actions for ${title}`} onClick={(event) => { event.stopPropagation(); onMore(event); }} onKeyDown={(event) => event.stopPropagation()} sx={{ color: '#0B5270', width: { xs: 25, sm: 34 }, height: { xs: 25, sm: 34 } }}><MoreVertRounded sx={{ fontSize: { xs: 17, sm: 21 } }} /></IconButton>
          </Stack>
        </Stack>
        <Stack direction="row" alignItems="center" gap={.35} sx={{ mt: { xs: .55, sm: 1 } }}>
          <LocationOnRounded sx={{ color: '#5D747A', fontSize: { xs: 12, sm: 15 }, flex: '0 0 auto' }} />
          <Typography noWrap color="text.secondary" sx={{ fontSize: { xs: 9, sm: 12 } }}>{city}</Typography>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 1, sm: 1.6 }, py: { xs: .9, sm: 1.35 } }}>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={{ xs: .4, sm: .65 }} sx={{ '& .MuiChip-root': { height: { xs: 19, sm: 24 }, maxWidth: '100%' }, '& .MuiChip-label': { px: { xs: .65, sm: 1 }, fontSize: { xs: 8, sm: 12 } } }}>
          <Chip size="small" label={status} sx={{ bgcolor: '#E4F3F7', color: '#0B5270', fontWeight: 850 }} />
          <Chip size="small" icon={visibility === 'Public' ? <PublicRounded /> : <LockRounded />} label={visibility} variant="outlined" sx={{ borderColor: 'rgba(11,82,112,.22)', color: '#33535C', fontWeight: 800, '& .MuiChip-icon': { fontSize: { xs: 11, sm: 14 }, ml: { xs: .45, sm: .75 } } }} />
          <Chip size="small" label={`${type} · ${purpose}`} variant="outlined" sx={{ borderColor: '#D9E5E8', color: '#587078', fontWeight: 750 }} />
        </Stack>
        <Box sx={{ mt: { xs: .75, sm: 1.25 }, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) minmax(0, .85fr)' }, gap: { xs: .45, sm: .75 } }}>
          <Box sx={{ minWidth: 0, p: { xs: .65, sm: 1 }, borderRadius: 2, bgcolor: '#F8FAFB' }}>
            <Typography color="text.secondary" sx={{ fontSize: { xs: 8, sm: 9.5 }, fontWeight: 900, letterSpacing: '.065em', textTransform: 'uppercase' }}>{purpose === 'Rent' ? 'Monthly rent' : purpose === 'Sale' ? 'Sale price' : 'Lease amount'}</Typography>
            <Typography noWrap sx={{ mt: .15, color: '#152225', fontSize: { xs: 11.5, sm: 14.5 }, fontWeight: 930 }}>{propertyPrice(row)}</Typography>
          </Box>
          <Box sx={{ minWidth: 0, p: { xs: .65, sm: 1 }, borderRadius: 2, bgcolor: '#F8FAFB' }}>
            <Typography color="text.secondary" sx={{ fontSize: { xs: 8, sm: 9.5 }, fontWeight: 900, letterSpacing: '.065em', textTransform: 'uppercase' }}>Portfolio state</Typography>
            <Typography noWrap sx={{ mt: .15, color: '#152225', fontSize: { xs: 10.5, sm: 13.5 }, fontWeight: 880 }}>{visibility} listing</Typography>
          </Box>
        </Box>
        {facts.length > 0 && <Box sx={{ mt: 1.25 }}>
          <Typography sx={{ mb: .65, color: '#68777A', fontSize: { xs: 8, sm: 9.5 }, fontWeight: 850, letterSpacing: '.07em', textTransform: 'uppercase' }}>Property details</Typography>
          <Stack direction="row" flexWrap="wrap" gap={{ xs: .4, sm: .65 }}>
            {facts.map(({ label, value, Icon }) => <Stack key={label} direction="row" alignItems="center" spacing={{ xs: .3, sm: .55 }} sx={{ minWidth: { xs: 0, sm: 82 }, flex: { xs: '1 1 42%', sm: '0 0 auto' }, px: { xs: .45, sm: .9 }, py: { xs: .5, sm: .65 }, border: '1px solid rgba(11,82,112,.12)', borderRadius: 2, bgcolor: '#FFFFFF' }}>
              <Icon sx={{ color: '#0B5270', fontSize: { xs: 13, sm: 16 }, flex: '0 0 auto' }} />
              <Typography noWrap sx={{ color: '#152225', fontSize: { xs: 8.5, sm: 11 }, fontWeight: 800 }}>{value}<Box component="span" sx={{ ml: { xs: .2, sm: .35 }, color: '#68777A', fontWeight: 600 }}>{label.toLowerCase()}</Box></Typography>
            </Stack>)}
          </Stack>
        </Box>}
        <Box sx={{ mt: { xs: .8, sm: 1.25 }, p: { xs: .65, sm: 1 }, border: '1px solid rgba(11,82,112,.12)', borderRadius: '2px', bgcolor: '#FFFFFF' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={.5} sx={{ mb: { xs: .5, sm: .75 } }}>
            <Typography sx={{ color: '#152225', fontSize: { xs: 9.5, sm: 11.5 }, fontWeight: 850 }}>Amenities</Typography>
            <Typography noWrap sx={{ color: '#68777A', fontSize: { xs: 7.5, sm: 10 } }}>{amenities.length ? `${amenities.length} included` : 'None added'}</Typography>
          </Stack>
          {amenities.length > 0 ? <Stack direction="row" flexWrap="wrap" useFlexGap gap={{ xs: .4, sm: .65 }}>
            {amenities.slice(0, 4).map(({ label, Icon }) => <Stack key={label} title={label} aria-label={label} alignItems="center" justifyContent="center" spacing={{ xs: .2, sm: .35 }} sx={{ width: { xs: 45, sm: 62 }, minHeight: { xs: 43, sm: 55 }, px: .35, py: { xs: .35, sm: .55 }, border: '1px solid rgba(11,82,112,.10)', borderRadius: '2px', bgcolor: '#F5FBFC', color: '#0B5270' }}>
              <Icon sx={{ fontSize: { xs: 15, sm: 18 } }} />
              <Typography noWrap sx={{ width: '100%', color: '#526A70', fontSize: { xs: 7.2, sm: 9.2 }, textAlign: 'center' }}>{label}</Typography>
            </Stack>)}
            {amenities.length > 4 && <Stack alignItems="center" justifyContent="center" spacing={{ xs: .2, sm: .35 }} sx={{ width: { xs: 45, sm: 62 }, minHeight: { xs: 43, sm: 55 }, border: '1px dashed rgba(11,82,112,.24)', borderRadius: '2px', bgcolor: '#FFFFFF', color: '#0B5270' }}>
              <Typography sx={{ fontSize: { xs: 10, sm: 13 }, fontWeight: 900 }}>+{amenities.length - 4}</Typography>
              <Typography sx={{ color: '#526A70', fontSize: { xs: 7, sm: 9.2 } }}>more</Typography>
            </Stack>}
          </Stack> : <Typography color="text.secondary" sx={{ fontSize: 11 }}>Add amenities to show them here.</Typography>}
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: .5, sm: .8 }} sx={{ mt: { xs: .8, sm: 1.3 } }} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <Button size="small" variant="contained" endIcon={<ArrowOutwardRounded />} onClick={(event) => { event.stopPropagation(); onOpen(); }} sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' }, minHeight: { xs: 32, sm: 42 }, px: { xs: .5, sm: 1.5 }, fontSize: { xs: 9, sm: 13 }, fontWeight: 850, whiteSpace: 'nowrap', '& .MuiButton-endIcon': { ml: { xs: .3, sm: .8 }, mr: 0 }, '& .MuiButton-endIcon svg': { fontSize: { xs: 14, sm: 20 } } }}>Open property</Button>
          {isRent && onManageRooms && <Button size="small" variant="outlined" startIcon={<MeetingRoomRounded />} onClick={(event) => { event.stopPropagation(); onManageRooms(); }} sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' }, minHeight: { xs: 32, sm: 42 }, px: { xs: .5, sm: 1.5 }, fontSize: { xs: 9, sm: 13 }, fontWeight: 820, whiteSpace: 'nowrap', '& .MuiButton-startIcon': { ml: 0, mr: { xs: .3, sm: .8 } }, '& .MuiButton-startIcon svg': { fontSize: { xs: 14, sm: 20 } } }}>Manage rooms</Button>}
        </Stack>
      </Box>
    </CardContent>
  </Card>;
}
