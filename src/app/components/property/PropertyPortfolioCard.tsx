import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Box, Button, Card, CardContent, Chip, IconButton, Stack, Typography } from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import ImageNotSupportedOutlined from '@mui/icons-material/ImageNotSupportedOutlined';
import { fetchPropertyImageBlob, fetchPropertyMediaBlob } from '../../services/api';

type PropertyPortfolioCardProps = {
  row: Record<string, any>;
  onOpen: () => void;
  onEdit?: (event?: MouseEvent<HTMLButtonElement>) => void;
  onManageRooms?: () => void;
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

export function PropertyCardCover({ row, title, onEdit, onMore }: {
  row: Record<string, any>;
  title: string;
  onEdit?: (event?: MouseEvent<HTMLButtonElement>) => void;
  onMore?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
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

  return <Box sx={{ position: 'relative', height: { xs: 82, sm: 122, lg: 142 }, mx: { xs: .5, sm: .75 }, mt: { xs: .5, sm: .75 }, borderRadius: '5px', bgcolor: '#EAF2F4', overflow: 'hidden' }}>
    {src && !failed
      ? <Box component="img" src={src} alt={title} loading="lazy" sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', borderRadius: '5px' }} onError={() => setFailed(true)} />
      : <Stack alignItems="center" justifyContent="center" spacing={.5} sx={{ width: '100%', height: '100%', color: '#769098', background: 'linear-gradient(135deg, #edf5f6, #dce9ec)' }}>
        <ImageNotSupportedOutlined sx={{ fontSize: { xs: 21, sm: 25 } }} />
        <Typography sx={{ fontSize: { xs: 8, sm: 10 }, fontWeight: 750 }}>Image unavailable</Typography>
      </Stack>}
    <Stack direction="row" spacing={.35} sx={{ position: 'absolute', top: { xs: 5, sm: 7 }, right: { xs: 5, sm: 7 }, zIndex: 1 }}>
      {onEdit && <IconButton
        size="small"
        aria-label={`Edit ${title}`}
        onClick={(event) => { event.stopPropagation(); onEdit(event); }}
        onKeyDown={(event) => event.stopPropagation()}
        sx={{ width: { xs: 25, sm: 29 }, height: { xs: 25, sm: 29 }, color: '#0B5270', bgcolor: 'rgba(255,255,255,.94)', border: '1px solid rgba(11,82,112,.16)', boxShadow: '0 2px 7px rgba(20,45,55,.18)', '&:hover': { bgcolor: '#FFFFFF' } }}
      ><EditRounded sx={{ fontSize: { xs: 14, sm: 17 } }} /></IconButton>}
      {onMore && <IconButton
        size="small"
        aria-label={`More actions for ${title}`}
        onClick={(event) => { event.stopPropagation(); onMore(event); }}
        onKeyDown={(event) => event.stopPropagation()}
        sx={{ width: { xs: 25, sm: 29 }, height: { xs: 25, sm: 29 }, color: '#0B5270', bgcolor: 'rgba(255,255,255,.94)', border: '1px solid rgba(11,82,112,.16)', boxShadow: '0 2px 7px rgba(20,45,55,.18)', '&:hover': { bgcolor: '#FFFFFF' } }}
      ><MoreVertRounded sx={{ fontSize: { xs: 17, sm: 20 } }} /></IconButton>}
    </Stack>
  </Box>;
}

/**
 * A compact property dashboard card. The title and actions remain readable
 * while the cover image stays prominent at every grid size.
 */
export default function PropertyPortfolioCard({ row, onOpen, onEdit, onManageRooms, onMore }: PropertyPortfolioCardProps) {
  const title = String(row?.title || 'Untitled property');
  const reference = String(row?.referenceNumber || row?.code || '').trim();
  const purpose = titleCase(row?.purpose || row?.listingType || 'rent');
  const type = titleCase(row?.type || 'Property');
  const status = titleCase(row?.status || 'draft');
  const visibility = String(row?.visibility || 'private').toLowerCase() === 'public' ? 'Public' : 'Private';
  const city = [row?.address?.city, row?.address?.state].filter(Boolean).join(', ') || 'Location not added';
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
      <PropertyCardCover row={row} title={title} onEdit={onEdit} onMore={onMore} />
      <Box sx={{ px: { xs: 1, sm: 1.6 }, pt: { xs: 1, sm: 1.5 }, pb: { xs: .85, sm: 1.25 }, bgcolor: '#F5FBFC', borderBottom: '1px solid rgba(11,82,112,.12)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={{ xs: .35, sm: 1 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: { xs: 'none', sm: 'grid' }, placeItems: 'center', flex: '0 0 auto', width: 38, height: 38, borderRadius: 2.5, color: '#0B5270', bgcolor: '#E4F3F7' }}><ApartmentRounded fontSize="small" /></Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography title={title} sx={{ color: '#152225', fontWeight: 900, fontSize: { xs: 11.5, sm: 15 }, lineHeight: 1.25, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{title}</Typography>
              <Typography noWrap color="text.secondary" sx={{ mt: .18, fontSize: { xs: 8, sm: 10.5 }, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{reference ? `Ref · ${reference}` : `${type} · ${purpose}`}</Typography>
            </Box>
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
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={.6} sx={{ mt: { xs: .65, sm: .95 } }}>
          <Typography color="text.secondary" sx={{ flex: '0 0 auto', fontSize: { xs: 8, sm: 10 }, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>{purpose === 'Rent' ? 'Monthly' : purpose === 'Sale' ? 'Sale price' : 'Lease'}</Typography>
          <Typography noWrap title={propertyPrice(row)} sx={{ minWidth: 0, color: '#152225', fontSize: { xs: 10, sm: 13 }, fontWeight: 900 }}>{propertyPrice(row)}</Typography>
        </Stack>
        <Stack direction="row" gap={{ xs: .4, sm: .7 }} sx={{ mt: { xs: .75, sm: 1.1 } }} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <Button size="small" variant="contained" endIcon={<ArrowOutwardRounded />} onClick={(event) => { event.stopPropagation(); onOpen(); }} sx={{ flex: 1, minWidth: 0, minHeight: { xs: 29, sm: 36 }, px: { xs: .35, sm: 1 }, fontSize: { xs: 8, sm: 11 }, lineHeight: 1.1, fontWeight: 820, textTransform: 'none', whiteSpace: 'normal', '& .MuiButton-endIcon': { ml: { xs: .2, sm: .45 }, mr: 0 }, '& .MuiButton-endIcon svg': { fontSize: { xs: 11, sm: 15 } } }}>Open property</Button>
          {isRent && onManageRooms && <Button size="small" variant="outlined" startIcon={<MeetingRoomRounded />} onClick={(event) => { event.stopPropagation(); onManageRooms(); }} sx={{ flex: 1, minWidth: 0, minHeight: { xs: 29, sm: 36 }, px: { xs: .35, sm: 1 }, fontSize: { xs: 8, sm: 11 }, lineHeight: 1.1, fontWeight: 800, textTransform: 'none', whiteSpace: 'normal', '& .MuiButton-startIcon': { ml: 0, mr: { xs: .2, sm: .45 } }, '& .MuiButton-startIcon svg': { fontSize: { xs: 11, sm: 15 } } }}>Manage rooms</Button>}
        </Stack>
      </Box>
    </CardContent>
  </Card>;
}
