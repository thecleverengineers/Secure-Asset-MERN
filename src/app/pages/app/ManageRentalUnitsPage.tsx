import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Checkbox, Chip, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, Grid, MenuItem, Paper, Stack, Tab, Tabs, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import {
  applyRentalUnitPricing, archivePropertyFloor, changeRentalUnitStatus, createPropertyFloor, createRentalUnit,
  duplicateRentalUnit, getPropertyFloorOverview, getPropertyOccupancy, getRentalStructure, getRentalUnitTenancyDetail,
  fetchRentalUnitImageBlob, startRentalTenancy, transitionRentalTenancy, updatePropertyFloor, updateRentalUnit, uploadDocument,
} from '../../services/api';

const money = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const sentence = (value: unknown) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const ROOM_TYPE_OPTIONS = [
  ['single', 'Single room'], ['pg', 'PG'], ['1bhk', '1 BHK'], ['2bhk', '2 BHK'], ['3bhk', '3 BHK'], ['4bhk', '4 BHK'],
  ['bedroom', 'Bedroom with number'], ['private_room', 'Private room'], ['entire_unit', 'Entire unit'],
] as const;
const FURNISHING_OPTIONS = [['unfurnished', 'Unfurnished'], ['semi_furnished', 'Semi-furnished'], ['fully_furnished', 'Fully furnished']] as const;
const GALLERY_CATEGORIES = [['bedroom', 'Bedroom'], ['bathroom', 'Bathroom'], ['toilet', 'Toilet'], ['kitchen', 'Kitchen'], ['balcony', 'Balcony'], ['living_room', 'Living room'], ['furniture', 'Furniture'], ['other', 'Other']] as const;
const ROOM_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const EMPTY = {
  roomNumber: '', name: '', floor: '', visibility: 'private', publicationStatus: 'draft',
  roomCategory: 'room', roomType: 'private_room', bhkConfiguration: '', bedroomCount: 1,
  bathroomCount: 1, bathroomAccess: 'attached', toiletCount: 1, toiletAccess: 'attached',
  kitchenAvailable: false, kitchenAccess: 'none', drawingRoom: false, livingRoom: false,
  diningHall: false,
  balcony: false, furnishingStatus: 'unfurnished', airConditioning: 'non_ac', liftAccess: false,
  roomSize: '', carpetArea: '', maximumOccupants: 1, preferredOccupancy: '', orientation: '',
  electricityArrangement: '', waterArrangement: '', internetWifi: false, parkingEligibility: false,
  otherAmenities: '', monthlyRent: '', securityDeposit: '', maintenanceCharge: '', bookingAmount: '',
  minimumStayMonths: '', availableFrom: '', electricity: 'metered', water: 'included',
  primaryImageJson: '', primaryImageName: '', galleryJson: '[]',
};

function imageFileId(image: any) {
  return String(image?.file?._id || image?.file || '').trim();
}

function ImageUploadField({ label, file, existingUrl, existingFileId, unitId, helper, onChange }: { label: string; file: File | null; existingUrl?: string; existingFileId?: string; unitId?: string; helper: string; onChange: (file: File | null) => void }) {
  const [preview, setPreview] = useState(existingUrl || '');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!file && existingFileId && unitId) {
      setPreview('');
      fetchRentalUnitImageBlob(unitId, existingFileId).then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview(objectUrl);
      }).catch(() => { if (active) setPreview(existingUrl || ''); });
      return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }
    if (!file) { setPreview(existingUrl || ''); return () => { active = false; }; }
    const fileObjectUrl = URL.createObjectURL(file);
    setPreview(fileObjectUrl);
    return () => { active = false; URL.revokeObjectURL(fileObjectUrl); };
  }, [existingFileId, existingUrl, file, unitId]);
  return <Stack spacing={.8}>
    <Button component="label" variant="outlined" sx={{ minHeight: 56, justifyContent: 'flex-start' }}>
      {file?.name || (existingUrl ? `Replace ${label.toLowerCase()}` : `Choose ${label.toLowerCase()}`)}
      <input hidden type="file" accept={ROOM_IMAGE_ACCEPT} onChange={(event) => { onChange(event.target.files?.[0] || null); event.currentTarget.value = ''; }} />
    </Button>
    {preview && <Box component="img" src={preview} alt={`${label} preview`} sx={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />}
    <Typography variant="caption" color="text.secondary">{helper} · JPG, PNG, WebP or GIF</Typography>
  </Stack>;
}

function ManagedRentalUnitImage({ image, unitId, alt }: { image: any; unitId: string; alt: string }) {
  const fileId = imageFileId(image);
  const [src, setSrc] = useState(fileId ? '' : String(image?.url || ''));
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSrc(fileId ? '' : String(image?.url || ''));
    if (!fileId) return () => {};
    fetchRentalUnitImageBlob(unitId, fileId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(() => {
      if (active) setSrc(String(image?.url || ''));
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, image?.url, unitId]);
  if (!src) return <Box sx={{ height: { xs: 72, sm: 92 }, bgcolor: '#F1F5F9' }} />;
  return <Box component="img" src={src} alt={alt} sx={{ display: 'block', width: '100%', height: { xs: 72, sm: 92 }, objectFit: 'cover' }} />;
}

function statusColor(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (status === 'AVAILABLE') return 'success';
  if (status === 'OCCUPIED') return 'info';
  if (['APPLICATION_PENDING', 'AGREEMENT_PENDING', 'PAYMENT_PENDING', 'NOTICE_PERIOD', 'VACATING'].includes(status)) return 'warning';
  if (['BLOCKED', 'ARCHIVED'].includes(status)) return 'error';
  return 'default';
}

const LIVE_TENANCY_STATUSES = new Set(['reserved', 'application_pending', 'deposit_pending', 'agreement_pending', 'payment_pending', 'active', 'notice', 'notice_period', 'vacating', 'move_out', 'move_out_inspection', 'final_calculation', 'landlord_review', 'final_payment', 'deposit_settlement']);

export default function ManageRentalUnitsPage() {
  const { propertyId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState(location.pathname.endsWith('/tenancy') ? 1 : 0);
  const [structure, setStructure] = useState<any>(null);
  const [occupancy, setOccupancy] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unitAccordionOpen, setUnitAccordionOpen] = useState(false);
  const [floorAccordionOpen, setFloorAccordionOpen] = useState(false);
  const [floorEditing, setFloorEditing] = useState<any>(null);
  const [floorDeleteTarget, setFloorDeleteTarget] = useState<any>(null);
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [floorOverview, setFloorOverview] = useState<any>(null);
  const [floorOverviewBusy, setFloorOverviewBusy] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<Array<File | null>>([]);
  const [floorForm, setFloorForm] = useState({ floorNumber: 0, floorName: 'Ground Floor', floorCode: 'G', sortOrder: 0 });
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState('all');
  const [bulkPricingOpen, setBulkPricingOpen] = useState(false);
  const [bulkRent, setBulkRent] = useState('');

  async function reload() {
    if (!propertyId) return;
    setBusy(true); setError('');
    try {
      const [tree, table] = await Promise.all([getRentalStructure(propertyId), getPropertyOccupancy(propertyId)]);
      const nextStructure: any = tree.data;
      setStructure(nextStructure); setOccupancy((table.data as any)?.rows || []);
      setSelectedFloorId((current) => nextStructure?.mode === 'floor' && nextStructure?.floors?.some((floor: any) => String(floor._id) === String(current))
        ? current
        : nextStructure?.floors?.[0]?._id || '');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => { void reload(); }, [propertyId]);

  useEffect(() => {
    if (!selectedFloorId || structure?.mode !== 'floor' || !structure?.property?.floorManagementEnabled) {
      setFloorOverview(null);
      return undefined;
    }
    let active = true;
    setFloorOverviewBusy(true);
    getPropertyFloorOverview(propertyId, selectedFloorId)
      .then((response) => { if (active) setFloorOverview(response.data); })
      .catch((cause) => { if (active) setError((cause as Error).message); })
      .finally(() => { if (active) setFloorOverviewBusy(false); });
    return () => { active = false; };
  }, [propertyId, selectedFloorId, structure?.mode, structure?.property?.floorManagementEnabled]);

  useEffect(() => {
    const targetId = detail
      ? 'rental-tenant-history-accordion'
      : unitAccordionOpen
        ? 'rental-unit-editor-accordion'
        : floorAccordionOpen
          ? 'rental-floor-editor-accordion'
          : '';
    if (!targetId) return undefined;
    const handle = window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    return () => window.clearTimeout(handle);
  }, [detail, floorAccordionOpen, unitAccordionOpen]);

  const units = useMemo(() => structure?.mode === 'floor'
    ? [...(structure?.floors || []).flatMap((floor: any) => floor.units || []), ...(structure?.unassignedUnits || [])]
    : structure?.units || [], [structure]);
  const filteredRows = useMemo(() => occupancy.filter((row) => {
    if (filter === 'all') return true;
    if (filter === 'payment_due') return Number(row.outstandingAmount || 0) > 0;
    if (filter === 'previous') return Number(row.historyCount || 0) > 1;
    return String(row.status || '').toLowerCase() === filter || String(row.unit?.availabilityStatus || '').toLowerCase() === filter;
  }), [occupancy, filter]);
  const floors = useMemo(() => [...(structure?.floors || [])].sort((left: any, right: any) => Number(left.floorNumber || 0) - Number(right.floorNumber || 0)), [structure?.floors]);
  const selectedFloor = useMemo(() => floors.find((floor: any) => String(floor._id) === String(selectedFloorId)) || null, [floors, selectedFloorId]);
  const selectedFloorRooms = useMemo(() => {
    if (floorOverview?.floor?._id && String(floorOverview.floor._id) === String(selectedFloorId)) return floorOverview.rooms || [];
    return selectedFloor?.units || [];
  }, [floorOverview, selectedFloor, selectedFloorId]);
  const selectedFloorSummary = useMemo(() => {
    if (floorOverview?.floor?._id && String(floorOverview.floor._id) === String(selectedFloorId)) return floorOverview.summary || {};
    const occupiedStatuses = new Set(['OCCUPIED', 'NOTICE_PERIOD', 'VACATING']);
    return {
      totalRooms: selectedFloorRooms.length,
      occupiedRooms: selectedFloorRooms.filter((unit: any) => occupiedStatuses.has(String(unit.availabilityStatus))).length,
      availableRooms: selectedFloorRooms.filter((unit: any) => ['AVAILABLE', 'APPLICATION_PENDING'].includes(String(unit.availabilityStatus))).length,
      historicalTenancies: selectedFloorRooms.reduce((total: number, unit: any) => total + Number(unit.historyCount || unit.tenancyHistory?.length || 0), 0),
    };
  }, [floorOverview, selectedFloorId, selectedFloorRooms]);

  function galleryRows() {
    try {
      const parsed = JSON.parse(form.galleryJson || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function updateGalleryRow(index: number, patch: Record<string, unknown>) {
    const rows = galleryRows();
    rows[index] = { ...(rows[index] || {}), ...patch };
    setForm((current: any) => ({ ...current, galleryJson: JSON.stringify(rows) }));
  }

  function addGalleryRow() {
    const rows = galleryRows();
    rows.push({ url: '', name: `Room image ${rows.length + 1}`, category: 'bedroom' });
    setGalleryFiles((current) => [...current, null]);
    setForm((current: any) => ({ ...current, galleryJson: JSON.stringify(rows) }));
  }

  function removeGalleryRow(index: number) {
    const rows = galleryRows();
    rows.splice(index, 1);
    setGalleryFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setForm((current: any) => ({ ...current, galleryJson: JSON.stringify(rows) }));
  }

  function openUnit(unit?: any, floor?: any) {
    setEditing(unit || null);
    const specs = unit?.specifications || {}; const pricing = unit?.pricing || {};
    setPrimaryImageFile(null);
    setGalleryFiles(unit ? Array((unit.gallery || []).length).fill(null) : []);
    setForm(unit ? {
      ...EMPTY, roomNumber: unit.roomNumber, name: unit.name, floor: unit.floor?._id || unit.floor || '', visibility: unit.visibility,
      ...specs, roomSize: specs.roomSize?.value || '', carpetArea: specs.carpetArea?.value || '',
      preferredOccupancy: (specs.preferredOccupancy || []).join(', '), otherAmenities: (specs.otherAmenities || []).join(', '),
      ...pricing, availableFrom: pricing.availableFrom ? String(pricing.availableFrom).slice(0, 10) : '',
      primaryImageJson: JSON.stringify(unit.primaryImage || null), primaryImageName: unit.primaryImage?.name || '',
      galleryJson: JSON.stringify(unit.gallery || [], null, 2),
    } : { ...EMPTY, floor: floor?._id || '' });
    setUnitAccordionOpen(true);
  }

  function openFloor(floor?: any) {
    setFloorEditing(floor || null);
    setFloorForm({
      floorNumber: Number(floor?.floorNumber ?? 0),
      floorName: floor?.floorName || 'Ground Floor',
      floorCode: floor?.floorCode || '',
      sortOrder: Number(floor?.sortOrder ?? floor?.floorNumber ?? 0),
    });
    setFloorAccordionOpen(true);
  }

  async function saveFloor() {
    const floorNumber = Number(floorForm.floorNumber);
    const floorName = String(floorForm.floorName || '').trim();
    if (!Number.isInteger(floorNumber) || floorNumber < -10 || floorNumber > 300) {
      setError('Floor number must be a whole number between -10 and 300.');
      return;
    }
    if (!floorName) {
      setError('Floor name is required.');
      return;
    }
    setBusy(true); setError('');
    try {
      const payload = { ...floorForm, floorNumber, floorName, sortOrder: Number(floorForm.sortOrder || 0) };
      if (floorEditing) await updatePropertyFloor(floorEditing._id, payload);
      else await createPropertyFloor(propertyId, payload);
      setFloorAccordionOpen(false);
      setFloorEditing(null);
      await reload();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function toggleFloor(floor: any) {
    setBusy(true); setError('');
    try {
      await updatePropertyFloor(floor._id, { status: floor.status === 'disabled' ? 'active' : 'disabled' });
      await reload();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteFloor() {
    if (!floorDeleteTarget) return;
    setBusy(true); setError('');
    try {
      await archivePropertyFloor(floorDeleteTarget._id);
      setFloorDeleteTarget(null);
      await reload();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function uploadRoomImage(file: File, name: string, category: string) {
    const upload = await uploadDocument(file, {
      property: propertyId,
      type: 'rental_unit_image',
      category: 'image',
      visibility: form.visibility === 'public' ? 'public' : 'private',
      name: name || file.name,
      description: `${editing ? 'Updated' : 'New'} rental room image for ${form.name || form.roomNumber || 'room'}`,
    });
    const driveFile = String((upload.data as any).driveFile || '').trim();
    if (!driveFile) throw new Error(`Upload completed for ${file.name}, but no secure file reference was returned.`);
    return { file: driveFile, url: upload.data.url, name: name || file.name, category };
  }

  async function payload() {
    let gallery: any[] = [];
    try { gallery = JSON.parse(form.galleryJson || '[]'); } catch { throw new Error('Room gallery metadata must be valid JSON.'); }
    if (gallery.some((image, index) => !galleryFiles[index] && !image?.file && !image?.url)) {
      throw new Error('Choose an image for every gallery row or remove the empty row.');
    }
    const existingPrimary = form.primaryImageJson ? JSON.parse(form.primaryImageJson) : null;
    const primaryImage = primaryImageFile
      ? await uploadRoomImage(primaryImageFile, form.primaryImageName, 'bedroom')
      : existingPrimary?.file || existingPrimary?.url ? { ...existingPrimary, name: form.primaryImageName || existingPrimary.name || 'Main room thumbnail' } : undefined;
    gallery = await Promise.all(gallery.map((image, index) => galleryFiles[index]
      ? uploadRoomImage(galleryFiles[index] as File, image.name, image.category || 'other')
      : image));
    const bool = (key: string) => Boolean(form[key]);
    return {
      roomNumber: form.roomNumber, name: form.name, floor: form.floor || null, visibility: form.visibility,
      specifications: {
        roomCategory: form.roomCategory, roomType: form.roomType, bhkConfiguration: form.bhkConfiguration,
        bedroomCount: Number(form.bedroomCount || 0), bathroomCount: Number(form.bathroomCount || 0), bathroomAccess: form.bathroomAccess,
        toiletCount: Number(form.toiletCount || 0), toiletAccess: form.toiletAccess, kitchenAvailable: bool('kitchenAvailable'), kitchenAccess: form.kitchenAccess,
        drawingRoom: bool('drawingRoom'), livingRoom: bool('livingRoom'), diningHall: bool('diningHall'), balcony: bool('balcony'), furnishingStatus: form.furnishingStatus,
        airConditioning: form.airConditioning, liftAccess: bool('liftAccess'), roomSize: { value: Number(form.roomSize || 0), unit: 'sqft' },
        carpetArea: { value: Number(form.carpetArea || 0), unit: 'sqft' }, maximumOccupants: Number(form.maximumOccupants || 1),
        preferredOccupancy: String(form.preferredOccupancy || '').split(',').map((x) => x.trim()).filter(Boolean), orientation: form.orientation,
        electricityArrangement: form.electricityArrangement, waterArrangement: form.waterArrangement, internetWifi: bool('internetWifi'),
        parkingEligibility: bool('parkingEligibility'), otherAmenities: String(form.otherAmenities || '').split(',').map((x) => x.trim()).filter(Boolean),
      },
      pricing: {
        monthlyRent: Number(form.monthlyRent || 0), securityDeposit: Number(form.securityDeposit || 0), maintenanceCharge: Number(form.maintenanceCharge || 0),
        bookingAmount: Number(form.bookingAmount || 0), minimumStayMonths: Number(form.minimumStayMonths || 0), availableFrom: form.availableFrom || undefined,
        electricity: form.electricity, water: form.water,
      },
      primaryImage,
      gallery,
    };
  }

  async function saveUnit() {
    setBusy(true); setError('');
    try { const nextPayload = await payload(); editing ? await updateRentalUnit(editing._id, nextPayload) : await createRentalUnit(propertyId, nextPayload); setUnitAccordionOpen(false); setEditing(null); await reload(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function unitAction(unit: any, action: string) {
    setBusy(true); setError('');
    try {
      if (action === 'duplicate') await duplicateRentalUnit(unit._id, { roomNumber: `${unit.roomNumber}-COPY`, name: `${unit.name} Copy` });
      else await changeRentalUnitStatus(unit._id, { status: action, reason: `Landlord changed room to ${sentence(action)}` });
      await reload();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const viewRoom = (unitId: string) => navigate(`/app/my-listings/${encodeURIComponent(propertyId)}/rooms/view_room/${encodeURIComponent(unitId)}`);
  async function openDetail(unitId: string) { try { setDetail((await getRentalUnitTenancyDetail(unitId)).data); } catch (cause) { setError((cause as Error).message); } }
  async function saveBulkPricing() {
    const rent = Number(bulkRent);
    if (!bulkRent.trim() || !Number.isFinite(rent) || rent < 0) {
      setError('Enter a valid non-negative monthly rent amount.');
      return;
    }
    setBusy(true); setError('');
    try {
      await applyRentalUnitPricing(propertyId, { unitIds: selected, pricing: { monthlyRent: rent } });
      setBulkPricingOpen(false);
      setBulkRent('');
      setSelected([]);
      await reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const RoomCard = ({ unit }: { unit: any }) => {
    const images = [unit.primaryImage, ...(unit.gallery || [])].filter((image: any) => image?.url).slice(0, 4);
    const currentTenantName = unit.currentTenant?.name || unit.currentTenantId?.name || unit.currentTenancy?.tenant?.name || unit.currentTenancyId?.tenant?.name || '';
    const historyCount = unit.historyCount ?? unit.tenancyHistory?.length;
    const enabledFeatures = [
      Number(unit.specifications?.toiletCount) > 0 ? `${unit.specifications.toiletCount} toilet${unit.specifications.toiletCount === 1 ? '' : 's'}` : '',
      Number(unit.specifications?.bathroomCount) > 0 ? `${unit.specifications.bathroomCount} bathroom${unit.specifications.bathroomCount === 1 ? '' : 's'}` : '',
      unit.specifications?.kitchenAvailable ? 'Kitchen' : '', unit.specifications?.balcony ? 'Balcony' : '',
      unit.specifications?.diningHall ? 'Dining hall' : '', unit.specifications?.livingRoom ? 'Living room' : '',
    ].filter(Boolean);
    return <Card variant="outlined" sx={{ borderRadius: 3, height: '100%', overflow: 'hidden' }}>
    {images.length > 0 && <Box sx={{ display: 'grid', gridTemplateColumns: images.length === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: .35, bgcolor: '#F1F5F9' }}>
      {images.map((image: any, index: number) => <Box key={`${image.name || 'image'}-${index}`} sx={{ minWidth: 0 }}>
        <ManagedRentalUnitImage image={image} unitId={unit._id} alt={image.name || `${unit.name || unit.roomNumber} image ${index + 1}`} />
        <Typography noWrap title={image.name} sx={{ px: .7, py: .35, bgcolor: '#FFFFFF', fontSize: 9.5, color: 'text.secondary' }}>{image.name || 'Unnamed image'}</Typography>
      </Box>)}
    </Box>}
    <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={.6}>
      <Box sx={{ minWidth: 0 }}><Typography noWrap title={unit.name || unit.roomNumber} sx={{ fontWeight: 900, fontSize: { xs: 12.5, sm: 14 } }}>{unit.name || unit.roomNumber}</Typography><Typography noWrap variant="body2" color="text.secondary" sx={{ fontSize: { xs: 10.5, sm: 12 } }}>Room {unit.roomNumber} · {sentence(unit.specifications?.roomType)}</Typography></Box>
      <Chip size="small" label={sentence(unit.availabilityStatus)} color={statusColor(unit.availabilityStatus)} sx={{ maxWidth: { xs: 82, sm: 120 }, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
    </Stack>
    <Typography sx={{ mt: 1, fontWeight: 800, fontSize: { xs: 12.5, sm: 15 } }}>{money(unit.pricing?.monthlyRent)}/month</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .25, fontSize: { xs: 9.5, sm: 11 } }}>{sentence(unit.specifications?.furnishingStatus)} · Max {unit.specifications?.maximumOccupants || 1}</Typography>
    {currentTenantName && <Typography noWrap title={currentTenantName} sx={{ mt: .65, fontSize: { xs: 10.5, sm: 12 }, fontWeight: 800, color: 'info.main' }}>Rented to {currentTenantName}</Typography>}
    {historyCount !== undefined && <Typography sx={{ mt: .25, fontSize: { xs: 9.5, sm: 11 }, color: 'text.secondary' }}>{historyCount} stay record{historyCount === 1 ? '' : 's'}</Typography>}
    {enabledFeatures.length > 0 && <Stack direction="row" flexWrap="wrap" gap={.35} mt={.7}>{enabledFeatures.map((feature: string) => <Chip key={feature} size="small" label={feature} variant="outlined" sx={{ height: 22, '& .MuiChip-label': { px: .7, fontSize: 9.5 } }} />)}</Stack>}
    <FormControlLabel sx={{ mt: .5, mb: 0, '& .MuiFormControlLabel-label': { fontSize: { xs: 10, sm: 12 } } }} control={<Checkbox size="small" checked={selected.includes(unit._id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, unit._id] : current.filter((id) => id !== unit._id))} />} label="Select" />
    <Stack direction="row" flexWrap="wrap" gap={{ xs: .25, sm: .7 }} mt={.5}>
      <Button size="small" variant="contained" sx={{ minWidth: 0, px: { xs: .7, sm: 1 } }} onClick={() => viewRoom(unit._id)}>View room</Button><Button size="small" sx={{ minWidth: 0, px: { xs: .5, sm: 1 } }} onClick={() => void openDetail(unit._id)}>Tenant & history</Button><Button size="small" sx={{ minWidth: 0, px: { xs: .5, sm: 1 } }} onClick={() => openUnit(unit)}>Edit</Button><Button size="small" sx={{ minWidth: 0, px: { xs: .5, sm: 1 } }} onClick={() => void unitAction(unit, 'duplicate')}>Duplicate</Button>
      {unit.availabilityStatus === 'AVAILABLE' && <Button size="small" sx={{ minWidth: 0, px: { xs: .5, sm: 1 } }} color="warning" onClick={() => void unitAction(unit, 'BLOCKED')}>Disable</Button>}
      {unit.availabilityStatus === 'BLOCKED' && <Button size="small" sx={{ minWidth: 0, px: { xs: .5, sm: 1 } }} color="success" onClick={() => void unitAction(unit, 'AVAILABLE')}>Enable</Button>}
      {!['OCCUPIED', 'NOTICE_PERIOD', 'VACATING', 'ARCHIVED'].includes(unit.availabilityStatus) && <Button size="small" sx={{ minWidth: 0, px: { xs: .5, sm: 1 } }} color="error" onClick={() => void unitAction(unit, 'ARCHIVED')}>Archive</Button>}
    </Stack></CardContent>
  </Card>;
  };

  if (!propertyId) return <Alert severity="error">A property ID is required.</Alert>;
  return <Box data-secureasset-manage-rental-units="floor-room-tenancy-manager-v184" data-secureasset-rental-actions="accordion-dropdown-v184" sx={{ p: { xs: 2, md: 3 }, maxWidth: 1500, mx: 'auto' }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} mb={2}>
      <Box><Typography variant="h4" fontWeight={950}>Manage Rental Units</Typography><Typography color="text.secondary">List rooms with independent monthly rent, features, gallery, availability and floor placement.</Typography></Box>
      <Stack direction="row" gap={1}><Button variant="outlined" onClick={() => navigate('/app/my-listings')}>Back to My Listings</Button><Button variant="contained" onClick={() => openUnit()}>Add Room</Button></Stack>
    </Stack>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    <Paper variant="outlined" sx={{ borderRadius: 3, mb: 2 }}><Tabs value={tab} onChange={(_, value) => setTab(value)}><Tab label="Manage Rooms" /><Tab label="Tenancy" /></Tabs></Paper>

    {tab === 0 && <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        {structure?.property?.floorManagementEnabled && <Button variant="outlined" onClick={() => openFloor()}>Add Floor</Button>}
        <Button variant="outlined" disabled={!selected.length || busy} onClick={() => setBulkPricingOpen(true)}>Apply same pricing ({selected.length})</Button>
        <Chip label={`${structure?.summary?.availableUnits || 0} publicly available`} color="success" variant="outlined" />
      </Stack>
      {structure?.mode === 'floor' ? <>
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5} mb={2}>
            <Box><Typography variant="h5" fontWeight={950}>Manage Floors</Typography><Typography color="text.secondary" sx={{ mt: .35 }}>Add, edit, disable or delete floors. Select a floor to see every room, its status, current tenant and stay history.</Typography></Box>
            <Button variant="contained" onClick={() => openFloor()}>Add floor</Button>
          </Stack>
          {floors.length ? <Grid container spacing={{ xs: 1, sm: 1.5 }}>
            {floors.map((floor: any) => {
              const floorUnits = floor.units || [];
              const occupied = floorUnits.filter((unit: any) => ['OCCUPIED', 'NOTICE_PERIOD', 'VACATING'].includes(String(unit.availabilityStatus))).length;
              const selectedFloorCard = String(selectedFloorId) === String(floor._id);
              return <Grid key={floor._id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card variant="outlined" sx={{ height: '100%', borderRadius: 2.5, borderColor: selectedFloorCard ? 'primary.main' : 'divider', bgcolor: selectedFloorCard ? 'rgba(21, 101, 192, .035)' : 'background.paper' }}>
                  <CardContent sx={{ p: { xs: 1.3, sm: 1.7 }, '&:last-child': { pb: { xs: 1.3, sm: 1.7 } } }}>
                    <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start"><Box sx={{ minWidth: 0 }}><Typography fontWeight={900} noWrap title={floor.floorName}>Floor {floor.floorNumber} · {floor.floorName}</Typography><Typography variant="body2" color="text.secondary">{floor.floorCode || 'No code'} · {floorUnits.length} room{floorUnits.length === 1 ? '' : 's'}</Typography></Box><Chip size="small" label={floor.status === 'disabled' ? 'Disabled' : 'Active'} color={floor.status === 'disabled' ? 'warning' : 'success'} /></Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{occupied} occupied · {floorUnits.length - occupied} not occupied</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={.5} mt={1.4}><Button size="small" variant={selectedFloorCard ? 'contained' : 'outlined'} onClick={() => setSelectedFloorId(floor._id)}>Manage floor</Button><Button size="small" onClick={() => openFloor(floor)}>Edit</Button><Button size="small" color={floor.status === 'disabled' ? 'success' : 'warning'} onClick={() => void toggleFloor(floor)} disabled={busy}>{floor.status === 'disabled' ? 'Enable' : 'Disable'}</Button><Button size="small" color="error" onClick={() => setFloorDeleteTarget(floor)} disabled={busy}>Delete</Button></Stack>
                  </CardContent>
                </Card>
              </Grid>;
            })}
          </Grid> : <Alert severity="info">No floors yet. You can still add rooms without a floor, or add the first floor when this property needs floor-wise organization.</Alert>}
        </Paper>

        {selectedFloor && <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.2} mb={1.5}><Box><Typography variant="h5" fontWeight={950}>Manage floor: {selectedFloor.floorName}</Typography><Typography color="text.secondary">Floor {selectedFloor.floorNumber}{selectedFloor.floorCode ? ` · ${selectedFloor.floorCode}` : ''}. Every room remains viewable even when locked by a tenancy.</Typography></Box><Stack direction="row" gap={.7}><Button size="small" onClick={() => openFloor(selectedFloor)}>Edit floor</Button><Button size="small" onClick={() => openUnit(undefined, selectedFloor)}>Add room</Button></Stack></Stack>
          <Stack direction="row" flexWrap="wrap" gap={.7} mb={2}><Chip label={`${selectedFloorSummary.totalRooms || 0} rooms`} /><Chip color="info" label={`${selectedFloorSummary.occupiedRooms || 0} occupied`} /><Chip color="success" label={`${selectedFloorSummary.availableRooms || 0} available`} /><Chip variant="outlined" label={`${selectedFloorSummary.historicalTenancies || 0} stay records`} /></Stack>
          {floorOverviewBusy && <Typography color="text.secondary" sx={{ mb: 1 }}>Loading the latest floor occupancy and stay history…</Typography>}
          <Grid container spacing={{ xs: 1, sm: 2 }}>{selectedFloorRooms.map((unit: any) => <Grid key={unit._id} size={{ xs: 6, sm: 6, md: 4, lg: 3 }}><RoomCard unit={unit} /></Grid>)}</Grid>
          {!floorOverviewBusy && !selectedFloorRooms.length && <Alert severity="info" sx={{ mt: 1 }}>No rooms are assigned to this floor yet.</Alert>}
        </Paper>}

        {(structure?.unassignedUnits || []).length > 0 && <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, borderRadius: 3 }}><Typography variant="h6" fontWeight={900} mb={2}>Rooms without a floor</Typography><Grid container spacing={{ xs: 1, sm: 2 }}>{structure.unassignedUnits.map((unit: any) => <Grid key={unit._id} size={{ xs: 6, sm: 6, md: 4, lg: 3 }}><RoomCard unit={unit} /></Grid>)}</Grid></Paper>}
      </> : <Grid container spacing={{ xs: 1, sm: 2 }}>{units.map((unit: any) => <Grid key={unit._id} size={{ xs: 6, sm: 6, md: 4, lg: 3 }}><RoomCard unit={unit} /></Grid>)}</Grid>}
      {!busy && !units.length && <Alert severity="info">No rooms yet. Add the first independently rentable room.</Alert>}
    </Stack>}

    {tab === 1 && <Stack spacing={2}>
      <TextField select label="Filter tenancy" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ width: { xs: '100%', sm: 280 } }}>
        {['all', 'available', 'occupied', 'payment_due', 'agreement_pending', 'notice_period', 'previous'].map((value) => <MenuItem key={value} value={value}>{sentence(value)}</MenuItem>)}
      </TextField>
      <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow>{['Room', 'Tenant', 'Status', 'Monthly Rent', 'Current Cycle', 'Outstanding', 'Agreement', 'Action'].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
        <TableBody>{filteredRows.map((row) => <TableRow key={row.unit?._id} hover><TableCell>{row.unit?.roomNumber}</TableCell><TableCell>{row.currentTenant?.name || '—'}</TableCell><TableCell><Chip size="small" label={sentence(row.unit?.availabilityStatus)} color={statusColor(row.unit?.availabilityStatus)} /></TableCell><TableCell>{money(row.unit?.pricing?.monthlyRent)}</TableCell><TableCell>{row.currentCycle?.cycleMonth || '—'}</TableCell><TableCell>{row.outstandingAmount == null ? '—' : money(row.outstandingAmount)}</TableCell><TableCell>{sentence(row.agreementStatus || '—')}</TableCell><TableCell><Stack direction="row" gap={.5}><Button size="small" variant="contained" onClick={() => viewRoom(row.unit._id)}>View room</Button><Button size="small" onClick={() => void openDetail(row.unit._id)}>{row.tenancy ? 'Tenant & history' : 'Manage tenancy'}</Button></Stack></TableCell></TableRow>)}</TableBody>
      </Table></TableContainer>
    </Stack>}

    <ProfessionalDialog open={bulkPricingOpen} onClose={() => { if (!busy) setBulkPricingOpen(false); }} fullWidth maxWidth="xs"><DialogTitle>Apply monthly rent</DialogTitle><DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Set one monthly rent amount for {selected.length} selected room{selected.length === 1 ? '' : 's'}.</Typography><TextField autoFocus fullWidth type="number" label="Monthly rent" value={bulkRent} onChange={(e) => setBulkRent(e.target.value)} inputProps={{ min: 0, step: 1 }} /></DialogContent><DialogActions><Button onClick={() => setBulkPricingOpen(false)} disabled={busy}>Cancel</Button><Button variant="contained" onClick={() => void saveBulkPricing()} disabled={busy}>Apply rent</Button></DialogActions></ProfessionalDialog>
    {floorAccordionOpen && <Accordion
      id="rental-floor-editor-accordion"
      expanded={floorAccordionOpen}
      onChange={(_, expanded) => { if (!expanded && !busy) { setFloorAccordionOpen(false); setFloorEditing(null); } }}
      disableGutters
      sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 3, mb: 2, '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRounded />}>
        <Box>
          <Typography fontWeight={900}>{floorEditing ? 'Edit property floor' : 'Add property floor'}</Typography>
          <Typography variant="body2" color="text.secondary">Manage floor details inline; rooms can be assigned to this floor or kept standalone.</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Floor number" type="number" value={floorForm.floorNumber} onChange={(e) => setFloorForm({ ...floorForm, floorNumber: Number(e.target.value) })} inputProps={{ min: -10, max: 300, step: 1 }} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Floor name" required value={floorForm.floorName} onChange={(e) => setFloorForm({ ...floorForm, floorName: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Floor code" value={floorForm.floorCode} onChange={(e) => setFloorForm({ ...floorForm, floorCode: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Display order" type="number" value={floorForm.sortOrder} onChange={(e) => setFloorForm({ ...floorForm, sortOrder: Number(e.target.value) })} /></Grid>
        </Grid>
        <Stack direction="row" justifyContent="flex-end" gap={1} mt={2}>
          <Button onClick={() => { if (!busy) { setFloorAccordionOpen(false); setFloorEditing(null); } }} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveFloor()} disabled={busy}>{floorEditing ? 'Save changes' : 'Add floor'}</Button>
        </Stack>
      </AccordionDetails>
    </Accordion>}

    <ProfessionalDialog open={Boolean(floorDeleteTarget)} onClose={() => { if (!busy) setFloorDeleteTarget(null); }} fullWidth maxWidth="sm"><DialogTitle>Delete floor?</DialogTitle><DialogContent><Typography>Delete will archive <strong>{floorDeleteTarget?.floorName || 'this floor'}</strong> so its audit history remains preserved. Move or archive every room on the floor first.</Typography></DialogContent><DialogActions><Button onClick={() => setFloorDeleteTarget(null)} disabled={busy}>Cancel</Button><Button color="error" variant="contained" onClick={() => void deleteFloor()} disabled={busy}>Delete floor</Button></DialogActions></ProfessionalDialog>

    {unitAccordionOpen && <Accordion
      id="rental-unit-editor-accordion"
      expanded={unitAccordionOpen}
      onChange={(_, expanded) => { if (!expanded && !busy) { setUnitAccordionOpen(false); setEditing(null); } }}
      disableGutters
      sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 3, mb: 2, '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRounded />}>
        <Box>
          <Typography fontWeight={900}>{editing ? `Edit ${editing.name}` : 'Add Rental Room'}</Typography>
          <Typography variant="body2" color="text.secondary">Update room details, optional floor placement, pricing and secure images inline.</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: { xs: 1.5, sm: 3 } }}><Stack spacing={3} mt={1}>
      <Typography variant="h6" fontWeight={900}>Identity and placement</Typography><Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth required label="Room number/name" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} /></Grid><Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth required label="Display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth select label="Floor (optional)" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} helperText={structure?.property?.floorManagementEnabled ? 'Choose a floor or leave this room as a standalone room.' : 'Floor management is off; this room will remain standalone.'}><MenuItem value="">No floor / standalone room</MenuItem>{(structure?.floors || []).map((f: any) => <MenuItem key={f._id} value={f._id}>{f.floorName}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth select label="Listing visibility" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}><MenuItem value="private">Private</MenuItem><MenuItem value="public">Public</MenuItem></TextField></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Room category" value={form.roomCategory} onChange={(e) => setForm({ ...form, roomCategory: e.target.value })} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth select label="Room type" value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })}>{ROOM_TYPE_OPTIONS.map(([value, title]) => <MenuItem key={value} value={value}>{title}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="BHK configuration" value={form.bhkConfiguration} onChange={(e) => setForm({ ...form, bhkConfiguration: e.target.value })} helperText="Optional custom label" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Orientation" value={form.orientation} onChange={(e) => setForm({ ...form, orientation: e.target.value })} /></Grid>
      </Grid><Divider />
      <Typography variant="h6" fontWeight={900}>Room specifications</Typography><Grid container spacing={2}>
        {['bedroomCount', 'bathroomCount', 'toiletCount', 'roomSize', 'carpetArea', 'maximumOccupants'].map((key) => <Grid key={key} size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label={sentence(key)} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></Grid>)}
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth select label="Bathroom access" value={form.bathroomAccess} onChange={(e) => setForm({ ...form, bathroomAccess: e.target.value })}><MenuItem value="attached">Attached</MenuItem><MenuItem value="shared">Shared</MenuItem><MenuItem value="none">None</MenuItem></TextField></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth select label="Toilet access" value={form.toiletAccess} onChange={(e) => setForm({ ...form, toiletAccess: e.target.value })}><MenuItem value="attached">Attached</MenuItem><MenuItem value="shared">Shared</MenuItem><MenuItem value="none">None</MenuItem></TextField></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth select label="Kitchen access" value={form.kitchenAccess} onChange={(e) => setForm({ ...form, kitchenAccess: e.target.value })}><MenuItem value="private">Private</MenuItem><MenuItem value="shared">Shared</MenuItem><MenuItem value="none">None</MenuItem></TextField></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth select label="Furnishing status" value={form.furnishingStatus} onChange={(e) => setForm({ ...form, furnishingStatus: e.target.value })}>{FURNISHING_OPTIONS.map(([value, title]) => <MenuItem key={value} value={value}>{title}</MenuItem>)}</TextField></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth select label="Air conditioning" value={form.airConditioning} onChange={(e) => setForm({ ...form, airConditioning: e.target.value })}><MenuItem value="ac">AC</MenuItem><MenuItem value="non_ac">Non-AC</MenuItem></TextField></Grid>
        {['preferredOccupancy', 'electricityArrangement', 'waterArrangement', 'otherAmenities'].map((key) => <Grid key={key} size={{ xs: 12, sm: 6 }}><TextField fullWidth label={sentence(key)} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></Grid>)}
        <Grid size={{ xs: 12 }}>
          <FormControlLabel control={<Checkbox checked={Number(form.bathroomCount || 0) > 0} onChange={(e) => setForm({ ...form, bathroomCount: e.target.checked ? Math.max(1, Number(form.bathroomCount || 0)) : 0 })} />} label="Bathroom enabled" />
          <FormControlLabel control={<Checkbox checked={Number(form.toiletCount || 0) > 0} onChange={(e) => setForm({ ...form, toiletCount: e.target.checked ? Math.max(1, Number(form.toiletCount || 0)) : 0 })} />} label="Toilet enabled" />
          {['kitchenAvailable', 'drawingRoom', 'livingRoom', 'diningHall', 'balcony', 'liftAccess', 'internetWifi', 'parkingEligibility'].map((key) => <FormControlLabel key={key} control={<Checkbox checked={Boolean(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />} label={sentence(key)} />)}
        </Grid>
      </Grid><Divider />
      <Typography variant="h6" fontWeight={900}>Independent room pricing</Typography><Grid container spacing={2}>{['monthlyRent', 'securityDeposit', 'maintenanceCharge', 'bookingAmount', 'minimumStayMonths'].map((key) => <Grid key={key} size={{ xs: 12, sm: 4 }}><TextField fullWidth type="number" label={sentence(key)} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></Grid>)}<Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth type="date" label="Available From" InputLabelProps={{ shrink: true }} value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} /></Grid></Grid><Divider />
      <Typography variant="h6" fontWeight={900}>Room gallery</Typography><Typography variant="body2" color="text.secondary">Upload a separate main image for the room thumbnail, then add gallery images with a name and category. External image URLs are not required.</Typography>
      <Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><ImageUploadField label="Main thumbnail image" file={primaryImageFile} existingUrl={(() => { try { return JSON.parse(form.primaryImageJson || 'null')?.url || ''; } catch { return ''; } })()} existingFileId={(() => { try { return imageFileId(JSON.parse(form.primaryImageJson || 'null')); } catch { return ''; } })()} unitId={editing?._id} onChange={setPrimaryImageFile} helper="Shown as the room card and primary room-details image" /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Main image name" value={form.primaryImageName} onChange={(e) => setForm({ ...form, primaryImageName: e.target.value })} helperText="A descriptive name is shown with the thumbnail." /></Grid></Grid>
      <Stack spacing={1.2}>{galleryRows().map((image: any, index: number) => <Paper key={index} variant="outlined" sx={{ p: 1.2, borderRadius: 2.5 }}><Grid container spacing={1.2} alignItems="center"><Grid size={{ xs: 12, md: 5 }}><ImageUploadField label={`Gallery image ${index + 1}`} file={galleryFiles[index] || null} existingUrl={image.url || ''} existingFileId={imageFileId(image)} unitId={editing?._id} onChange={(file) => setGalleryFiles((current) => current.map((item, itemIndex) => itemIndex === index ? file : item))} helper="Upload the room photo" /></Grid><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth size="small" label="Image name" value={image.name || ''} onChange={(e) => updateGalleryRow(index, { name: e.target.value })} /></Grid><Grid size={{ xs: 12, sm: 8, md: 2 }}><TextField fullWidth size="small" select label="Category" value={image.category || 'other'} onChange={(e) => updateGalleryRow(index, { category: e.target.value })}>{GALLERY_CATEGORIES.map(([value, title]) => <MenuItem key={value} value={value}>{title}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, sm: 4, md: 2 }}><Button fullWidth color="error" onClick={() => removeGalleryRow(index)}>Remove</Button></Grid></Grid></Paper>)}</Stack>
      <Button variant="outlined" onClick={addGalleryRow}>Add gallery image</Button>
      </Stack>
      <Stack direction="row" justifyContent="flex-end" gap={1} mt={2}>
        <Button onClick={() => { if (!busy) { setUnitAccordionOpen(false); setEditing(null); } }} disabled={busy}>Cancel</Button>
        <Button variant="contained" disabled={busy} onClick={() => void saveUnit()}>Save room</Button>
      </Stack>
      </AccordionDetails>
    </Accordion>}

    {detail && <Accordion
      id="rental-tenant-history-accordion"
      expanded={Boolean(detail)}
      onChange={(_, expanded) => { if (!expanded) setDetail(null); }}
      disableGutters
      sx={{ border: '1px solid', borderColor: 'info.main', borderRadius: 3, mb: 2, '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRounded />}>
        <Box>
          <Typography fontWeight={900}>{detail.unit?.name || 'Tenant & history'}</Typography>
          <Typography variant="body2" color="text.secondary">Current tenant, room status, payment workflow and permanent entry/exit history.</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails><Stack spacing={2}>
      {detail?.current ? <><Typography fontWeight={900}>Current Tenant: {detail.current.tenant?.name || '—'} · {detail.current.tenancyNumber || detail.current._id}</Typography><Typography variant="body2" color="text.secondary">{detail.current.tenant?.email || 'Email not shared'} · {detail.current.tenant?.phone || 'Phone not shared'}</Typography><Grid container spacing={2}>{[['Move-in Date', detail.current.startDate], ['Agreement Start', detail.current.agreement?.cycleStartedAt], ['Agreement End', detail.current.agreement?.cycleEndsAt], ['Monthly Rent', money(detail.current.monthlyRent)], ['Deposit', money(detail.current.securityDeposit)], ['Status', sentence(detail.current.status)]].map(([label, value]) => <Grid key={String(label)} size={{ xs: 12, sm: 4 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography>{String(value || '—')}</Typography></Grid>)}</Grid>
        {detail.current.status === 'payment_pending' && <Button variant="contained" onClick={async () => { await startRentalTenancy(detail.unit._id, detail.current._id); setDetail(null); await reload(); }}>Verify & Start Rent Workflow</Button>}
        {detail.current.status === 'active' && <Button color="warning" onClick={async () => { await transitionRentalTenancy(detail.current._id, { action: 'serve_notice', reason: 'Notice period started' }); setDetail(null); await reload(); }}>Start notice period</Button>}
      </> : <Alert severity="info">This room has no active tenant.</Alert>}
      <Divider /><Typography variant="h6" fontWeight={900}>Permanent tenant history · entry and exit record</Typography>{(detail?.history || []).map((item: any, index: number) => <Paper key={item._id} variant="outlined" sx={{ p: 2 }}><Typography fontWeight={800}>{index + 1}. {item.tenant?.name || 'Tenant'} · {sentence(item.status)}</Typography><Typography variant="body2" color="text.secondary">Entered: {item.startDate ? new Date(item.startDate).toLocaleDateString('en-IN') : 'Not recorded'} · Left: {item.endDate ? new Date(item.endDate).toLocaleDateString('en-IN') : LIVE_TENANCY_STATUSES.has(item.status) ? 'Still staying' : 'Not recorded'} · Agreement: {sentence(item.agreement?.status || '—')}</Typography><Typography variant="body2" sx={{ mt: .5 }}>{item.tenant?.email || 'Email not shared'} · {item.tenant?.phone || 'Phone not shared'}</Typography></Paper>)}
      <Typography variant="body2" color="text.secondary">Agreement, payments, invoices, receipts, evidence, inspections, notices and move-out settlement remain linked to each immutable tenancy record.</Typography>
      </Stack>
      <Stack direction="row" justifyContent="flex-end" mt={2}><Button onClick={() => setDetail(null)}>Close</Button></Stack>
      </AccordionDetails>
    </Accordion>}
  </Box>;
}
