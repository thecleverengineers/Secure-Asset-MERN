import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, Menu, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography, DialogContent, DialogActions, Paper, useMediaQuery, useTheme,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import { createResource, deleteResource, fetchPropertyMediaBlob, getPropertyTree, updateResource, uploadDocument } from '../../services/api';
import { useActionDialog } from '../../components/shared/useActionDialog';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import PropertyFormWizard from '../../components/property/PropertyFormWizard';
import { useSite } from '../../context/SiteContext';
import { PropertyFullDetailsView } from './ResourcePage';

type SpaceNode = { _id: string; children?: SpaceNode[]; [key: string]: any };
type PropertyPromotionRecord = { _id?: string; type?: unknown; space?: unknown; startsAt?: unknown; endsAt?: unknown; amount?: unknown; status?: unknown; metrics?: Record<string, unknown>; [key: string]: any };
type PropertyTreeData = { property: any; tree: SpaceNode[]; propertyMedia?: any[]; promotions?: PropertyPromotionRecord[] };

const UNIT_STATUSES = ['draft', 'available', 'reserved', 'occupied', 'rented', 'leased', 'sold', 'sold_out', 'maintenance', 'inactive', 'archived'];
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', available: 'Available', reserved: 'Reserved', occupied: 'Occupied', rented: 'Rented', leased: 'Leased',
  sold: 'Sold Out', sold_out: 'Sold Out', maintenance: 'Maintenance', inactive: 'Inactive', archived: 'Archived',
};
const STATUS_COLOURS: Record<string, { background: string; color: string }> = {
  available: { background: '#F1F5F9', color: '#334155' }, rented: { background: '#F1F5F9', color: '#334155' },
  leased: { background: '#F1F5F9', color: '#334155' }, sold: { background: '#F1F5F9', color: '#334155' }, sold_out: { background: '#F1F5F9', color: '#334155' },
  occupied: { background: '#F1F5F9', color: '#334155' }, reserved: { background: '#F1F5F9', color: '#334155' },
};

function flattenSpaces(nodes: SpaceNode[], depth = 0): SpaceNode[] {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flattenSpaces(node.children || [], depth + 1)]);
}

function updateTreeStatus(nodes: SpaceNode[], id: string, status: string): SpaceNode[] {
  return nodes.map((node) => ({
    ...node,
    ...(String(node._id) === id ? { status } : {}),
    children: updateTreeStatus(node.children || [], id, status),
  }));
}

function removeTreeNode(nodes: SpaceNode[], id: string): SpaceNode[] {
  return nodes
    .filter((node) => String(node._id) !== id)
    .map((node) => ({ ...node, children: removeTreeNode(node.children || [], id) }));
}

function label(value: unknown) {
  const raw = String(value || '');
  return STATUS_LABELS[raw] || raw.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || '—';
}

function display(value: unknown) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function recordId(value: unknown) {
  if (!value) return '';
  if (typeof value === 'object') return String((value as Record<string, unknown>)._id || '');
  return String(value);
}

function referenceLabel(value: unknown) {
  if (!value) return '—';
  if (typeof value !== 'object') return display(value);
  const item = value as Record<string, unknown>;
  return display(item.name || item.email || item.code || item._id);
}

function spaceLabel(value: unknown) {
  if (!value) return 'Property-wide';
  if (typeof value !== 'object') return display(value);
  const item = value as Record<string, unknown>;
  const parts = [
    item.name,
    item.roomNumber ? 'Room ' + item.roomNumber : '',
    item.flatNumber ? 'Flat ' + item.flatNumber : '',
    item.apartmentNumber ? 'Apartment ' + item.apartmentNumber : '',
  ].filter(Boolean).map((part) => String(part));
  return parts.join(' · ') || referenceLabel(value);
}

function dateLabel(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? display(value) : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function moneyLabel(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount) : '—';
}

function firstPropertyImageSource(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && typeof candidate === 'object') {
    const record = candidate as Record<string, unknown>;
    return firstPropertyImageSource(record.url || record.thumbnailUrl || record.src || record.image);
  }
  const source = String(candidate || '').trim().split(/,\s*(?=(?:https?:\/\/|\/(?:api|uploads)|data:|blob:))/i)[0]?.trim() || '';
  if (!source) return '';
  return /^(?:https?:\/\/|data:|blob:|\/)/i.test(source) ? source : '/' + source;
}

function propertyHeaderImage(property: any, propertyMedia: any[]) {
  const cover = propertyMedia.find((item) => Boolean(item?.cover || item?.isCover)) || propertyMedia[0] || null;
  return {
    mediaId: recordId(cover?._id),
    directSrc: firstPropertyImageSource(cover?.url)
      || firstPropertyImageSource(cover?.thumbnailUrl)
      || firstPropertyImageSource(property?.galleryCover)
      || firstPropertyImageSource(property?.images),
    alt: String(cover?.altText || cover?.caption || property?.title || 'Property image'),
  };
}

function PropertyImageHeader({ property, propertyId, propertyMedia, loading, visibilityBusy, onBack, onVisibility, onEdit, onAddSpace, onRefresh }: {
  property: any;
  propertyId: string;
  propertyMedia: any[];
  loading: boolean;
  visibilityBusy: boolean;
  onBack: () => void;
  onVisibility: () => void;
  onEdit: () => void;
  onAddSpace: () => void;
  onRefresh: () => void;
}) {
  const cover = useMemo(() => propertyHeaderImage(property, propertyMedia), [property, propertyMedia]);
  const [imageSrc, setImageSrc] = useState('');
  const [imageLoading, setImageLoading] = useState(Boolean(cover.mediaId));
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const visibility = property?.visibility === 'public' ? 'public' : 'private';
  const nextVisibility = visibility === 'public' ? 'private' : 'public';
  const location = [property?.address?.city, property?.address?.state].filter(Boolean).join(', ');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setImageUnavailable(false);
    setImageLoading(Boolean(cover.mediaId));
    setImageSrc(cover.mediaId ? '' : cover.directSrc);
    if (!cover.mediaId) return () => {};
    void fetchPropertyMediaBlob(cover.mediaId, propertyId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setImageSrc(objectUrl);
      setImageLoading(false);
    }).catch(() => {
      if (!active) return;
      setImageSrc(cover.directSrc);
      setImageLoading(false);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cover.directSrc, cover.mediaId, propertyId]);

  const runAction = (action: () => void) => {
    setMenuAnchor(null);
    action();
  };

  return <>
    <Box
      data-secureasset-property-image-header="property-image-header-v155"
      sx={{ position: 'relative', minHeight: { xs: 232, sm: 300, lg: 350 }, overflow: 'hidden', border: '1px solid #D9E2E7', borderRadius: { xs: 3, md: 4 }, bgcolor: '#E9EFF2', boxShadow: '0 12px 32px rgba(15, 23, 42, .08)' }}
    >
      {imageSrc && !imageUnavailable
        ? <Box component="img" src={imageSrc} alt={cover.alt} onError={() => setImageUnavailable(true)} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Box role="img" aria-label="Property image unavailable" sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', px: 3, bgcolor: '#E9EFF2', color: '#52616B', textAlign: 'center' }}>
          {imageLoading ? <CircularProgress size={28} /> : <Typography sx={{ fontSize: 14 }}>No property image available</Typography>}
        </Box>}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8, 15, 22, .38) 0%, rgba(8, 15, 22, .04) 38%, rgba(8, 15, 22, .76) 100%)' }} />
      <Button
        aria-label="Back to properties"
        variant="contained"
        size="small"
        startIcon={<ArrowBackRounded />}
        onClick={onBack}
        sx={{ position: 'absolute', top: { xs: 12, sm: 16 }, left: { xs: 12, sm: 16 }, color: '#17202A', bgcolor: 'rgba(255,255,255,.94)', boxShadow: '0 5px 18px rgba(0,0,0,.14)', '&:hover': { bgcolor: '#FFFFFF' } }}
      >
        Back to properties
      </Button>
      <Stack data-secureasset-property-image-title="bottom-overlay-v155" direction="row" alignItems="flex-end" justifyContent="space-between" gap={1.5} sx={{ position: 'absolute', right: { xs: 12, sm: 20 }, bottom: { xs: 12, sm: 18 }, left: { xs: 12, sm: 20 }, color: '#FFFFFF' }}>
        <Box sx={{ minWidth: 0, pr: 1 }}>
          <Typography component="h1" noWrap sx={{ fontSize: { xs: 21, sm: 27, md: 31 }, lineHeight: 1.18, textShadow: '0 2px 16px rgba(0,0,0,.55)' }}>{property?.title || 'Property details'}</Typography>
          {(location || property?.referenceNumber || property?.code) && <Typography noWrap sx={{ mt: .55, fontSize: { xs: 12, sm: 13.5 }, color: 'rgba(255,255,255,.88)', textShadow: '0 1px 8px rgba(0,0,0,.52)' }}>{[location, property?.referenceNumber ? `Ref ${property.referenceNumber}` : property?.code ? `Code ${property.code}` : ''].filter(Boolean).join(' · ')}</Typography>}
        </Box>
        <IconButton
          data-secureasset-property-action-menu="three-dot-v155"
          aria-label="Property actions"
          aria-controls={menuAnchor ? 'property-action-menu' : undefined}
          aria-haspopup="menu"
          aria-expanded={menuAnchor ? 'true' : undefined}
          onClick={(event) => setMenuAnchor(event.currentTarget)}
          sx={{ flex: '0 0 auto', width: 42, height: 42, color: '#17202A', bgcolor: 'rgba(255,255,255,.94)', boxShadow: '0 5px 18px rgba(0,0,0,.14)', '&:hover': { bgcolor: '#FFFFFF' } }}
        >
          <MoreVertRounded />
        </IconButton>
      </Stack>
    </Box>
    <Menu data-secureasset-property-action-items="visibility-edit-add-refresh-v155" id="property-action-menu" anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)} PaperProps={{ sx: { minWidth: 264, border: '1px solid #D8E2E7', borderRadius: 2.5, mt: .5, fontFamily: '"Open Sans", Arial, sans-serif', fontWeight: 400, '&, & *': { fontFamily: '"Open Sans", Arial, sans-serif', fontWeight: '400 !important' } } }}>
      <MenuItem onClick={() => runAction(onVisibility)} disabled={visibilityBusy} sx={{ py: 1.1, gap: 1.2 }}>
        {visibility === 'public' ? <PublicRounded fontSize="small" /> : <LockRounded fontSize="small" />}
        <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontSize: 14 }}>Visibility</Typography><Typography color="text.secondary" sx={{ fontSize: 11.5 }}>Currently {visibility} · make {nextVisibility}</Typography></Box>
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => runAction(onEdit)}><EditRounded fontSize="small" sx={{ mr: 1.25 }} />Edit Property</MenuItem>
      <MenuItem onClick={() => runAction(onAddSpace)}><AddRounded fontSize="small" sx={{ mr: 1.25 }} />Add Room / Flat / Apartment</MenuItem>
      <MenuItem onClick={() => runAction(onRefresh)} disabled={loading}><RefreshRounded fontSize="small" sx={{ mr: 1.25 }} />Refresh</MenuItem>
    </Menu>
  </>;
}

const PROMOTION_LABELS: Record<string, string> = {
  featured: 'Featured', top_listing: 'Top listing', urgent_sale: 'Urgent sale', urgent_rent: 'Urgent rent',
  homepage_banner: 'Homepage banner', recommended: 'Recommended', location_sponsored: 'Location sponsored',
};

function promotionLabel(value: unknown) {
  const raw = String(value || '');
  return PROMOTION_LABELS[raw] || label(raw);
}

function metricLabel(metrics: Record<string, unknown> = {}) {
  return [
    'Views ' + display(metrics.views),
    'Clicks ' + display(metrics.clicks),
    'Enquiries ' + display(metrics.enquiries),
    'Applications ' + display(metrics.applications),
  ].join(' · ');
}

type RelatedPanelProps = { propertyId: string };

function PropertyPromotionsPanel({ propertyId, promotions = [], onDelete, onAdd, onEdit, busyId }: RelatedPanelProps & { promotions?: PropertyPromotionRecord[]; onDelete: (id: string, title: string) => void; onAdd: () => void; onEdit: (record: PropertyPromotionRecord) => void; busyId: string }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  return <Box sx={{ mt: 2, pt: { xs: 2.5, md: 3 }, borderTop: '1px solid #DDE4E8' }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}>
      <Box>
        <Typography sx={{ fontWeight: 400, fontSize: 19, letterSpacing: '-.02em' }}>Property Promotions</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 12.5, mt: .35 }}>Featured, urgent, recommended and sponsored promotion records for this property.</Typography>
      </Box>
      <Stack direction="row" spacing={.7} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={promotions.length + ' record' + (promotions.length === 1 ? '' : 's')} variant="outlined" />
        <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={onAdd}>Add promotion</Button>
      </Stack>
    </Stack>
    <Divider sx={{ my: 2 }} />
    {promotions.length === 0 ? <Box sx={{ py: 5, textAlign: 'center', borderTop: '1px dashed #CBD5E1' }}>
      <Typography sx={{ fontWeight: 400 }}>No promotion records for this property</Typography>
      <Typography color="text.secondary" sx={{ fontSize: 13, mt: .5 }}>Create a promotion without leaving this property record.</Typography>
      <Button variant="contained" startIcon={<AddRounded />} onClick={onAdd} sx={{ mt: 2 }}>Add first promotion</Button>
    </Box> : mobile ? <Stack spacing={1} data-secureasset-property-promotions="mobile-cards-v154">
      {promotions.map((promotion, index) => {
        const id = recordId(promotion._id);
        const title = promotionLabel(promotion.type);
        return <Paper key={id || index} variant="outlined" sx={{ p: 1.3, borderRadius: 3, borderColor: 'rgba(11,82,112,.16)', bgcolor: '#FFFFFF' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 400, fontSize: 14.5 }}>{title}</Typography>
              <Typography noWrap color="text.secondary" sx={{ mt: .2, fontSize: 11.5 }}>{spaceLabel(promotion.space)}</Typography>
            </Box>
            <Chip size="small" label={label(promotion.status || 'pending')} variant="outlined" sx={{ borderColor: '#BFD3DA', color: '#0B5270', fontWeight: 400 }} />
          </Stack>
          <Box sx={{ mt: 1.1, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: .7 }}>
            <Box sx={{ p: .85, borderRadius: 2, bgcolor: '#F5FBFC' }}><Typography color="text.secondary" sx={{ fontSize: 9.5, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '.06em' }}>Schedule</Typography><Typography sx={{ mt: .2, fontSize: 11.5, fontWeight: 400 }}>{dateLabel(promotion.startsAt)} – {dateLabel(promotion.endsAt)}</Typography></Box>
            <Box sx={{ p: .85, borderRadius: 2, bgcolor: '#F5FBFC' }}><Typography color="text.secondary" sx={{ fontSize: 9.5, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '.06em' }}>Amount</Typography><Typography sx={{ mt: .2, fontSize: 12, fontWeight: 400 }}>{moneyLabel(promotion.amount)}</Typography></Box>
          </Box>
          <Typography color="text.secondary" sx={{ mt: .9, fontSize: 10.5 }}>{metricLabel(promotion.metrics || {})}</Typography>
          {id && <Stack direction="row" gap={.7} sx={{ mt: 1.1 }}>
            <Button fullWidth size="small" variant="outlined" startIcon={<EditRounded />} onClick={() => onEdit(promotion)}>Edit</Button>
            <Button fullWidth size="small" color="error" disabled={busyId === 'property-promotions:' + id} onClick={() => onDelete(id, title)}>Delete</Button>
          </Stack>}
        </Paper>;
      })}
    </Stack> : <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 950 }}>
        <TableHead><TableRow>
          <TableCell>Promotion</TableCell><TableCell>Room / space</TableCell><TableCell>Schedule</TableCell><TableCell>Amount</TableCell>
          <TableCell>Status</TableCell><TableCell>Performance</TableCell><TableCell align="right">Actions</TableCell>
        </TableRow></TableHead>
        <TableBody>{promotions.map((promotion, index) => {
          const id = recordId(promotion._id);
          const title = promotionLabel(promotion.type);
          return <TableRow key={id || index} hover>
            <TableCell><Typography sx={{ fontWeight: 400 }}>{title}</Typography><Typography color="text.secondary" sx={{ fontSize: 11.5 }}>{display(promotion.type)}</Typography></TableCell>
            <TableCell>{spaceLabel(promotion.space)}</TableCell>
            <TableCell>{dateLabel(promotion.startsAt)}<Typography color="text.secondary" sx={{ fontSize: 11.5 }}>to {dateLabel(promotion.endsAt)}</Typography></TableCell>
            <TableCell>{moneyLabel(promotion.amount)}</TableCell>
            <TableCell><Chip size="small" label={label(promotion.status || 'pending')} variant="outlined" sx={{ borderColor: '#CBD5E1', color: '#334155', fontWeight: 400 }} /></TableCell>
            <TableCell><Typography sx={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{metricLabel(promotion.metrics || {})}</Typography></TableCell>
            <TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={.4}>
              {id && <Button size="small" startIcon={<EditRounded />} onClick={() => onEdit(promotion)}>Edit</Button>}
              {id && <Button size="small" color="error" disabled={busyId === 'property-promotions:' + id} onClick={() => onDelete(id, title)}>Delete</Button>}
            </Stack></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>
    </TableContainer>}
  </Box>;
}

type InlineEditorKind = 'gallery' | 'space' | 'promotion';
type InlineEditorProps = { kind: InlineEditorKind; propertyId: string; record?: any; onClose: () => void; onSaved: () => void };

function InlinePropertyEditor({ kind, propertyId, record, onClose, onSaved }: InlineEditorProps) {
  const [form, setForm] = useState<Record<string, any>>({
    property: propertyId, name: record?.name || '', level: record?.level || 'room', roomNumber: record?.roomNumber || '', flatNumber: record?.flatNumber || '', apartmentNumber: record?.apartmentNumber || '', status: record?.status || 'available',
    category: record?.category || 'property_image', mediaType: record?.mediaType || 'image', caption: record?.caption || '', altText: record?.altText || '', cover: Boolean(record?.cover), visibility: record?.visibility || 'public',
    type: record?.type || 'featured', startsAt: record?.startsAt ? String(record.startsAt).slice(0, 10) : '', endsAt: record?.endsAt ? String(record.endsAt).slice(0, 10) : '', amount: record?.amount ?? '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState('');
  const [existingPreview, setExistingPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) { setFilePreview(''); return undefined; }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setExistingPreview('');
    if (kind !== 'gallery' || !record?._id || file) return () => {};
    fetchPropertyMediaBlob(String(record._id)).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setExistingPreview(objectUrl);
    }).catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, record?._id, file]);
  const preview = filePreview || existingPreview || String(record?.thumbnailUrl || record?.url || '');
  const set = (name: string, value: any) => setForm((current) => ({ ...current, [name]: value }));
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      let payload: Record<string, any> = { ...form, property: propertyId };
      if (kind === 'gallery') {
        if (!record && !file) throw new Error('Choose an image to upload');
        if (file) {
          const upload = await uploadDocument(file, { property: propertyId, type: 'property_image', category: 'image', visibility: form.visibility === 'public' ? 'public' : 'private' });
          payload = { property: propertyId, category: form.category || 'property_image', mediaType: 'image', url: upload.data.url, thumbnailUrl: upload.data.url, document: upload.data._id, driveFile: (upload.data as any).driveFile, caption: form.caption || file.name, altText: form.altText || file.name, cover: Boolean(form.cover), visibility: form.visibility || 'public' };
        } else { delete payload.file; delete payload.url; delete payload.thumbnailUrl; }
      }
      if (kind === 'space') payload = { property: propertyId, name: form.name, level: form.level, roomNumber: form.roomNumber, flatNumber: form.flatNumber, apartmentNumber: form.apartmentNumber, status: form.status };
      if (kind === 'promotion') payload = { property: propertyId, type: form.type, startsAt: form.startsAt || undefined, endsAt: form.endsAt || undefined, amount: form.amount === '' ? undefined : Number(form.amount), status: form.status || 'pending' };
      record?._id ? await updateResource(kind === 'gallery' ? 'property-media' : kind === 'space' ? 'property-spaces' : 'property-promotions', record._id, payload) : await createResource(kind === 'gallery' ? 'property-media' : kind === 'space' ? 'property-spaces' : 'property-promotions', payload);
      onSaved();
    } catch (caught) { setError((caught as Error).message || 'Could not save this record.'); } finally { setSaving(false); }
  }
  const title = kind === 'gallery' ? 'Upload property gallery image' : kind === 'space' ? 'Room / flat / apartment' : 'Property promotion';
  return <ProfessionalDialog open onClose={onClose} fullWidth maxWidth="md" professionalTitle={title} professionalSubtitle="Managed inside this property only">
    <Box component="form" onSubmit={save}><DialogContent dividers><Stack spacing={1.5}>
      {error && <Alert severity="error">{error}</Alert>}
      {kind === 'gallery' && <><Button component="label" variant="outlined" sx={{ minHeight: 56 }}>{file?.name || (record ? 'Choose replacement image' : 'Choose image to upload')}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] || null)} /></Button>{preview && <Box component="img" src={preview} alt="Gallery thumbnail preview" onError={() => setExistingPreview('')} sx={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 2, bgcolor: 'action.hover' }} />}<TextField label="Caption" value={form.caption} onChange={(e) => set('caption', e.target.value)} fullWidth size="small" /><TextField label="Gallery category" value={form.category} onChange={(e) => set('category', e.target.value)} fullWidth size="small" /></>}
      {kind === 'space' && <><TextField label="Name / number" required value={form.name} onChange={(e) => set('name', e.target.value)} fullWidth size="small" /><TextField select label="Type" value={form.level} onChange={(e) => set('level', e.target.value)} fullWidth size="small">{['building','floor','apartment','room','bed','other'].map((v) => <MenuItem key={v} value={v}>{label(v)}</MenuItem>)}</TextField><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Room number" value={form.roomNumber} onChange={(e) => set('roomNumber', e.target.value)} fullWidth size="small" /><TextField label="Flat number" value={form.flatNumber} onChange={(e) => set('flatNumber', e.target.value)} fullWidth size="small" /><TextField label="Apartment number" value={form.apartmentNumber} onChange={(e) => set('apartmentNumber', e.target.value)} fullWidth size="small" /></Stack><TextField select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)} fullWidth size="small">{UNIT_STATUSES.map((v) => <MenuItem key={v} value={v}>{label(v)}</MenuItem>)}</TextField></>}
      {kind === 'promotion' && <><TextField select label="Promotion type" value={form.type} onChange={(e) => set('type', e.target.value)} fullWidth size="small">{Object.keys(PROMOTION_LABELS).map((v) => <MenuItem key={v} value={v}>{PROMOTION_LABELS[v]}</MenuItem>)}</TextField><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Start date" type="date" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} fullWidth size="small" InputLabelProps={{ shrink: true }} /><TextField label="End date" type="date" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} fullWidth size="small" InputLabelProps={{ shrink: true }} /><TextField label="Amount" type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} fullWidth size="small" /></Stack><TextField select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)} fullWidth size="small">{['pending','active','paused','expired','cancelled'].map((v) => <MenuItem key={v} value={v}>{label(v)}</MenuItem>)}</TextField></>}
    </Stack></DialogContent><DialogActions><Button onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></DialogActions></Box>
  </ProfessionalDialog>;
}

export default function PropertyDetailsPage() {
  const { propertyId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: siteData } = useSite();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [propertyEditorOpen, setPropertyEditorOpen] = useState(false);
  const [editor, setEditor] = useState<{ kind: InlineEditorKind; record?: any } | null>(null);
  const actions = useActionDialog();

  const propertyTreeQuery = useQuery({
    queryKey: ['property-tree', propertyId] as const,
    queryFn: async () => (await getPropertyTree(propertyId)).data as PropertyTreeData,
    enabled: Boolean(propertyId),
    staleTime: 20_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });
  const data = propertyTreeQuery.data || null;
  const loading = propertyTreeQuery.isFetching;
  const queryError = propertyTreeQuery.error instanceof Error
    ? propertyTreeQuery.error.message
    : propertyTreeQuery.error ? 'Could not load property details.' : '';
  const activeError = error || (!propertyId ? 'Property ID is missing.' : queryError);

  async function load() {
    setError('');
    if (!propertyId) return;
    const result = await propertyTreeQuery.refetch();
    if (result.error) setError(result.error instanceof Error ? result.error.message : 'Could not refresh property details.');
  }

  const property = data?.property;
  const isRentProperty = String(property?.listingType || property?.purpose || '').toLowerCase() === 'rent';
  const spaces = useMemo(() => flattenSpaces(data?.tree || []), [data?.tree]);
  const counts = useMemo(() => ({
    total: spaces.length,
    available: spaces.filter((space) => space.status === 'available').length,
    rented: spaces.filter((space) => space.status === 'rented').length,
    leased: spaces.filter((space) => space.status === 'leased').length,
    soldOut: spaces.filter((space) => ['sold', 'sold_out'].includes(space.status)).length,
  }), [spaces]);

  async function changeStatus(space: SpaceNode, status: string) {
    const id = String(space._id || '');
    if (!id || !status || status === space.status) return;
    setBusyId(id);
    setError('');
    try {
      await updateResource('property-spaces', id, { status });
      queryClient.setQueryData<PropertyTreeData>(['property-tree', propertyId], (current) => current ? { ...current, tree: updateTreeStatus(current.tree || [], id, status) } : current);
      setNotice(`${space.name || 'Unit'} status updated to ${label(status)}.`);
    } catch (caught) {
      setError((caught as Error).message || 'Could not update unit status.');
    } finally {
      setBusyId('');
    }
  }

  async function changePropertyVisibility(next: 'private' | 'public') {
    if (!property || next === (property.visibility === 'public' ? 'public' : 'private')) return;
    const confirmed = await actions.askConfirmation(
      next === 'public'
        ? 'Make this property public? Tenants will be able to discover it on the marketplace.'
        : 'Make this property private? It will be removed from the public marketplace and kept in your workspace.',
      { title: next === 'public' ? 'Publish property' : 'Make property private', danger: next === 'private' },
    );
    if (!confirmed) return;
    setVisibilityBusy(true);
    setError('');
    try {
      const response = await updateResource('properties', propertyId, { visibility: next });
      queryClient.setQueryData<PropertyTreeData>(['property-tree', propertyId], (current) => current ? { ...current, property: { ...current.property, ...(response.data || {}), visibility: next } } : current);
      setNotice(`Property is now ${next}.`);
    } catch (caught) {
      setError((caught as Error).message || 'Could not update property visibility.');
    } finally {
      setVisibilityBusy(false);
    }
  }

  async function removeRecord(resource: string, id: string, title: string) {
    if (!id || !await actions.askConfirmation('Delete ' + title + '? This cannot be undone.', { title: 'Delete record', danger: true })) return;
    const key = resource + ':' + id;
    setBusyId(key);
    setError('');
    try {
      await deleteResource(resource, id);
      queryClient.setQueryData<PropertyTreeData>(['property-tree', propertyId], (current) => {
        if (!current) return current;
        if (resource === 'property-spaces') return { ...current, tree: removeTreeNode(current.tree || [], id) };
        if (resource === 'property-media') return { ...current, propertyMedia: (current.propertyMedia || []).filter((item) => recordId(item?._id) !== id) };
        if (resource === 'property-promotions') return { ...current, promotions: (current.promotions || []).filter((item) => recordId(item?._id) !== id) };
        return current;
      });
      setNotice(title + ' deleted.');
      await load();
    } catch (caught) {
      setError((caught as Error).message || 'Could not delete this record.');
    } finally {
      setBusyId('');
    }
  }

  const rentalUnitsPath = `/app/my-listings/${encodeURIComponent(propertyId)}/rooms`;
  const addSpace = () => isRentProperty ? navigate(rentalUnitsPath) : setEditor({ kind: 'space' });
  const editProperty = () => setPropertyEditorOpen(true);
  const refreshAfterEditor = async () => { setEditor(null); setNotice('Saved successfully.'); await load(); };
  const refreshAfterPropertyEdit = (message: string) => { setPropertyEditorOpen(false); setNotice(message); void load(); };

  if (loading && !data) return <Box sx={{ py: 16, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return <Box
    data-secureasset-property-visibility="property-visibility-v71"
    data-secureasset-property-mobile-workspace="mobile-property-workspace-v154"
    data-secureasset-property-details-font="open-sans-regular-v155"
    data-secureasset-property-editor="accordion-dropdown-v184"
    sx={{
      width: '100%',
      maxWidth: 1280,
      mx: 'auto',
      px: { xs: 1.25, sm: 3, lg: 4 },
      pb: { xs: 10, md: 6 },
      fontFamily: '"Open Sans", Arial, sans-serif',
      fontWeight: 400,
      '&, & *': { fontFamily: '"Open Sans", Arial, sans-serif', fontWeight: '400 !important' },
    }}
  >
    {property && <PropertyImageHeader
      property={property}
      propertyId={propertyId}
      propertyMedia={data?.propertyMedia || []}
      loading={loading}
      visibilityBusy={visibilityBusy}
      onBack={() => navigate('/app/properties')}
      onVisibility={() => void changePropertyVisibility(property.visibility === 'public' ? 'private' : 'public')}
      onEdit={editProperty}
      onAddSpace={addSpace}
      onRefresh={() => void load()}
    />}

    {property && <Accordion
      id="property-editor-accordion"
      expanded={propertyEditorOpen}
      onChange={(_, expanded) => setPropertyEditorOpen(expanded)}
      disableGutters
      sx={{ mt: 2, border: '1px solid', borderColor: propertyEditorOpen ? 'primary.main' : 'divider', borderRadius: 3, '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRounded />}>
        <Box>
          <Typography fontWeight={900}>Edit Property</Typography>
          <Typography variant="body2" color="text.secondary">Update property details, listing type, visibility, amenities, legal information and media inline.</Typography>
        </Box>
      </AccordionSummary>
      {propertyEditorOpen && <AccordionDetails sx={{ p: { xs: 0, sm: 1 } }}>
        <PropertyFormWizard
          open={propertyEditorOpen}
          mode="edit"
          property={property}
          propertyTypes={siteData.propertyTypes || []}
          onClose={() => setPropertyEditorOpen(false)}
          onSaved={refreshAfterPropertyEdit}
          layout="page"
        />
      </AccordionDetails>}
    </Accordion>}

    {property && isRentProperty && <Paper
      id="manage-rental-units-entry"
      data-secureasset-rental-unit-entry="dedicated-manager-v184"
      variant="outlined"
      sx={{ mt: 2, p: { xs: 1.5, sm: 2.5 }, borderRadius: 3, borderColor: 'rgba(11,82,112,.2)', bgcolor: 'rgba(11,82,112,.025)' }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={950}>Rental Units</Typography>
          <Typography color="text.secondary" sx={{ mt: .35 }}>Open the dedicated room and flat manager to add, edit, delete, enable, disable and review every rental unit.</Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate(rentalUnitsPath)} sx={{ flexShrink: 0 }}>Open Rental Units</Button>
      </Stack>
    </Paper>}

    {activeError && <Alert severity="error" onClose={() => { setError(''); if (queryError) void load(); }} sx={{ mt: 2, mb: 2 }}>{activeError}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mt: 2, mb: 2 }}>{notice}</Alert>}
    {!property && <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>This property could not be loaded.</Alert>}
    {property && <>
      <PropertyFullDetailsView
        property={property}
        propertyMedia={data?.propertyMedia || []}
        showContextBanner={false}
        galleryVariant="carousel"
        onAddGallery={() => setEditor({ kind: 'gallery' })}
        onEditGallery={(id) => setEditor({ kind: 'gallery', record: (data?.propertyMedia || []).find((item) => recordId(item?._id) === id) })}
        onDeleteGallery={(id, title) => void removeRecord('property-media', id, title)}
      />
      <PropertyPromotionsPanel
        propertyId={propertyId}
        promotions={data?.promotions || []}
        onAdd={() => setEditor({ kind: 'promotion' })}
        onEdit={(record) => setEditor({ kind: 'promotion', record })}
        busyId={busyId}
        onDelete={(id, title) => void removeRecord('property-promotions', id, title)}
      />
      {!isRentProperty && <Box sx={{ mt: 2, pt: { xs: 2.5, md: 3 }, borderTop: '1px solid #DDE4E8' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 400, fontSize: 19, letterSpacing: '-.02em' }}>Room Numbers &amp; Spaces · Independent Unit Inventory</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 12.5, mt: .35 }}>Each room, flat, or apartment has its own number fields and availability status.</Typography>
          </Box>
          <Stack direction="row" spacing={.7} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`${counts.total} total`} variant="outlined" />
            <Chip size="small" label={`${counts.available} available`} variant="outlined" sx={{ borderColor: '#CBD5E1', color: '#334155', fontWeight: 400 }} />
            <Chip size="small" label={`${counts.rented + counts.leased} occupied/leased`} variant="outlined" sx={{ borderColor: '#CBD5E1', color: '#334155', fontWeight: 400 }} />
            <Chip size="small" label={`${counts.soldOut} sold out`} variant="outlined" sx={{ borderColor: '#CBD5E1', color: '#334155', fontWeight: 400 }} />
            <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={addSpace}>Add space</Button>
          </Stack>
        </Stack>
        <Divider sx={{ my: 2 }} />
        {spaces.length === 0 ? <Box sx={{ py: 7, textAlign: 'center', borderTop: '1px dashed #CBD5E1' }}>
          <Typography sx={{ fontWeight: 400 }}>No independent units added yet</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: .5 }}>Add each room, flat, or apartment separately so its status can be managed independently.</Typography>
          <Button variant="contained" startIcon={<AddRounded />} onClick={addSpace} sx={{ mt: 2 }}>Add first unit</Button>
        </Box> : mobile ? <Stack spacing={1} data-secureasset-property-inventory="mobile-cards-v154">
          {spaces.map((space) => {
            const tone = STATUS_COLOURS[space.status] || STATUS_COLOURS.available;
            return <Paper key={space._id} variant="outlined" sx={{ p: 1.35, borderRadius: 3, borderColor: 'rgba(11,82,112,.16)', bgcolor: '#FFFFFF' }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0, pl: Math.min(Number(space.depth || 0) * 1, 3) }}>
                  <Typography sx={{ fontWeight: 400, fontSize: 14.5 }}>{display(space.name)}</Typography>
                  <Typography color="text.secondary" sx={{ mt: .18, fontSize: 11.5 }}>{label(space.level)} · Floor {display(space.floorNumber)}</Typography>
                </Box>
                <Chip size="small" label={label(space.status)} variant="outlined" sx={{ borderColor: '#BFD3DA', color: tone.color, fontWeight: 400, flex: '0 0 auto' }} />
              </Stack>
              <Box sx={{ mt: 1.1, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: .7 }}>
                {[
                  ['Room number', display(space.roomNumber)], ['Flat number', display(space.flatNumber)],
                  ['Apartment number', display(space.apartmentNumber)], ['Unit type', label(space.level)],
                ].map(([field, value]) => <Box key={field} sx={{ minWidth: 0, p: .85, borderRadius: 2, bgcolor: '#F5FBFC' }}>
                  <Typography color="text.secondary" sx={{ fontSize: 9.5, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '.06em' }}>{field}</Typography>
                  <Typography noWrap sx={{ mt: .2, fontSize: 12.5, fontWeight: 400 }}>{value}</Typography>
                </Box>)}
              </Box>
              <Box sx={{ mt: 1.1 }}>
                <Typography color="text.secondary" sx={{ mb: .5, fontSize: 10, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '.07em' }}>Availability status</Typography>
                <Select fullWidth size="small" value={space.status || 'draft'} disabled={busyId === String(space._id)} onChange={(event) => void changeStatus(space, String(event.target.value))} inputProps={{ 'aria-label': `Set ${display(space.name)} availability status` }} sx={{ bgcolor: '#FFFFFF' }}>
                  {UNIT_STATUSES.map((status) => <MenuItem key={status} value={status}>{label(status)}</MenuItem>)}
                </Select>
              </Box>
              <Stack direction="row" gap={.7} sx={{ mt: 1.1 }}>
                <Button fullWidth size="small" variant="outlined" startIcon={<EditRounded />} onClick={() => setEditor({ kind: 'space', record: space })}>Edit unit</Button>
                <Button fullWidth size="small" color="error" disabled={busyId === 'property-spaces:' + String(space._id)} onClick={() => void removeRecord('property-spaces', String(space._id), String(space.name || 'unit'))}>Delete</Button>
              </Stack>
            </Paper>;
          })}
        </Stack> : <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1050, '& .MuiTableCell-head': { color: '#64748B', fontSize: 11, fontWeight: 400, letterSpacing: '.06em', textTransform: 'uppercase' } }}>
            <TableHead><TableRow>
              <TableCell>Type</TableCell><TableCell>Room number</TableCell><TableCell>Flat number</TableCell><TableCell>Apartment number</TableCell>
              <TableCell>Unit name</TableCell><TableCell>Floor</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>{spaces.map((space) => {
              const tone = STATUS_COLOURS[space.status] || STATUS_COLOURS.available;
              return <TableRow key={space._id} hover>
                <TableCell><Chip size="small" label={label(space.level)} variant="outlined" /></TableCell>
                <TableCell>{display(space.roomNumber)}</TableCell>
                <TableCell>{display(space.flatNumber)}</TableCell>
                <TableCell>{display(space.apartmentNumber)}</TableCell>
                <TableCell><Typography sx={{ fontWeight: 400, pl: Math.min(Number(space.depth || 0) * 1.5, 4) }}>{display(space.name)}</Typography></TableCell>
                <TableCell>{display(space.floorNumber)}</TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" gap={.8}>
                    <Chip size="small" label={label(space.status)} variant="outlined" sx={{ borderColor: '#CBD5E1', color: tone.color, fontWeight: 400 }} />
                    <Select size="small" value={space.status || 'draft'} disabled={busyId === String(space._id)} onChange={(event) => void changeStatus(space, String(event.target.value))} sx={{ minWidth: 145 }}>
                      {UNIT_STATUSES.map((status) => <MenuItem key={status} value={status}>{label(status)}</MenuItem>)}
                    </Select>
                  </Stack>
                </TableCell>
                <TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={.4}>
                  <Button size="small" startIcon={<EditRounded />} onClick={() => setEditor({ kind: 'space', record: space })}>Edit</Button>
                  <Button size="small" color="error" disabled={busyId === 'property-spaces:' + String(space._id)} onClick={() => void removeRecord('property-spaces', String(space._id), String(space.name || 'unit'))}>Delete</Button>
                </Stack></TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        </TableContainer>}
      </Box>}
    </>}
    {actions.dialogs}
    {editor && <InlinePropertyEditor kind={editor.kind} propertyId={propertyId} record={editor.record} onClose={() => setEditor(null)} onSaved={() => void refreshAfterEditor()} />}
  </Box>;
}
