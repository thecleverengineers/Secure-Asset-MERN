import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  Alert, Box, Button, Card, CardContent, Chip, Container, Divider, Grid, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import MeetingRoomRounded from '@mui/icons-material/MeetingRoomRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import PeopleAltRounded from '@mui/icons-material/PeopleAltRounded';
import { fetchRentalUnitImageBlob, getRentalUnitTenancyDetail } from '../../services/api';
import { WorkspaceSkeleton } from '../../components/shared/PremiumSkeleton';

const money = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const sentence = (value: unknown) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const display = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value);

function recordId(value: unknown) {
  if (!value) return '';
  if (typeof value === 'object') return String((value as Record<string, unknown>)._id || '');
  return String(value);
}

function dateLabel(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? display(value) : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function dateTimeLabel(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? display(value) : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusColor(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (status === 'AVAILABLE') return 'success';
  if (status === 'OCCUPIED') return 'info';
  if (['APPLICATION_PENDING', 'AGREEMENT_PENDING', 'PAYMENT_PENDING', 'NOTICE_PERIOD', 'VACATING'].includes(status)) return 'warning';
  if (['BLOCKED', 'ARCHIVED', 'MAINTENANCE'].includes(status)) return 'error';
  return 'default';
}

function imageFileId(image: any) {
  return String(image?.file?._id || image?.file || '').trim();
}

function ManagedRoomImage({ image, unitId, alt, height = 260 }: { image: any; unitId: string; alt: string; height?: number }) {
  const fileId = imageFileId(image);
  const [src, setSrc] = useState(fileId ? '' : String(image?.url || ''));
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUnavailable(false);
    setSrc(fileId ? '' : String(image?.url || ''));
    if (!fileId) return () => {};
    void fetchRentalUnitImageBlob(unitId, fileId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }).catch(() => {
      if (!active) return;
      setUnavailable(true);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, image?.url, unitId]);

  if (!src || unavailable) return <Box role="img" aria-label={`${alt} unavailable`} sx={{ height, display: 'grid', placeItems: 'center', bgcolor: '#F1F5F9', color: 'text.secondary', px: 2, textAlign: 'center' }}><Typography variant="caption">Room image unavailable</Typography></Box>;
  return <Box component="img" src={src} alt={alt} onError={() => setUnavailable(true)} sx={{ display: 'block', width: '100%', height, objectFit: 'cover' }} />;
}

function InfoGrid({ rows }: { rows: Array<[string, unknown]> }) {
  return <Grid container spacing={1.2}>{rows.map(([name, value]) => <Grid key={name} size={{ xs: 12, sm: 6 }}><Stack direction="row" justifyContent="space-between" gap={2} sx={{ minHeight: 38, py: .7, borderBottom: '1px solid', borderColor: 'divider' }}><Typography color="text.secondary" fontSize={12.5}>{name}</Typography><Typography fontWeight={800} fontSize={12.5} textAlign="right" sx={{ overflowWrap: 'anywhere' }}>{display(value)}</Typography></Stack></Grid>)}</Grid>;
}

function Section({ title, icon, children, dataKey }: { title: string; icon?: ReactNode; children: ReactNode; dataKey?: string }) {
  return <Paper data-secureasset-room-section={dataKey} variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3 }}><Stack direction="row" alignItems="center" gap={.8} mb={1.8}>{icon}{<Typography variant="h6" fontWeight={950}>{title}</Typography>}</Stack>{children}</Paper>;
}

export default function ViewRoomPage() {
  const { propertyId: routePropertyId = '', unitId = '' } = useParams();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['managed-rental-unit-view', unitId],
    queryFn: () => getRentalUnitTenancyDetail(unitId),
    enabled: Boolean(unitId),
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });
  const detail: any = query.data?.data || null;
  const unit: any = detail?.unit || null;
  const property: any = detail?.property || null;
  const propertyId = routePropertyId || recordId(property?._id || unit?.property);
  const managerPath = propertyId ? `/app/my-listings/${encodeURIComponent(propertyId)}/rooms` : '/app/my-listings';
  const propertyPath = propertyId ? `/app/property-details/${encodeURIComponent(propertyId)}` : '/app/my-listings';
  const loading = query.isPending;
  const error = query.error instanceof Error ? query.error.message : query.error ? 'Could not load this room.' : '';

  const images = useMemo(() => {
    if (!unit) return [];
    return [
      unit.primaryImage ? { ...unit.primaryImage, isPrimary: true } : null,
      ...(Array.isArray(unit.gallery) ? unit.gallery : []),
    ].filter(Boolean);
  }, [unit]);

  if (loading) return <WorkspaceSkeleton rows={4} />;
  if (error || !unit) return <Container sx={{ py: 10 }}><Alert severity="error">{error || 'Room not found or you do not have landlord access.'}</Alert></Container>;

  const specs = unit.specifications || {};
  const pricing = unit.pricing || {};
  const floor = unit.floor || null;
  const current: any = detail.current || null;
  const currentTenant: any = current?.tenant || unit.currentTenantId || null;
  const currentTenancy: any = current || unit.currentTenancyId || null;
  const history: any[] = Array.isArray(detail.history) ? detail.history : [];
  const cycles: any[] = Array.isArray(detail.cycles) ? detail.cycles : [];
  const invoices: any[] = Array.isArray(detail.invoices) ? detail.invoices : [];
  const payments: any[] = Array.isArray(detail.payments) ? detail.payments : [];
  const featureChips = [
    specs.roomType ? sentence(specs.roomType) : '', specs.bhkConfiguration || '', specs.furnishingStatus ? sentence(specs.furnishingStatus) : '',
    specs.airConditioning && specs.airConditioning !== 'non_ac' ? sentence(specs.airConditioning) : '',
    Number(specs.bathroomCount) > 0 ? `${specs.bathroomCount} bathroom${Number(specs.bathroomCount) === 1 ? '' : 's'}` : '',
    Number(specs.toiletCount) > 0 ? `${specs.toiletCount} toilet${Number(specs.toiletCount) === 1 ? '' : 's'}` : '',
    specs.kitchenAvailable ? 'Kitchen' : '', specs.balcony ? 'Balcony' : '', specs.diningHall ? 'Dining hall' : '', specs.livingRoom ? 'Living room' : '',
    specs.internetWifi ? 'Internet / Wi-Fi' : '', specs.parkingEligibility ? 'Parking eligible' : '',
  ].filter(Boolean);
  const specificationRows: Array<[string, unknown]> = [
    ['Room number', unit.roomNumber], ['Room category', sentence(specs.roomCategory)], ['Room type', sentence(specs.roomType)],
    ['BHK configuration', specs.bhkConfiguration], ['Furnishing status', sentence(specs.furnishingStatus)], ['Bedrooms', specs.bedroomCount],
    ['Bathrooms', specs.bathroomCount], ['Bathroom access', sentence(specs.bathroomAccess)], ['Toilets', specs.toiletCount],
    ['Toilet access', sentence(specs.toiletAccess)], ['Kitchen access', sentence(specs.kitchenAccess)], ['Room size', specs.roomSize?.value ? `${specs.roomSize.value} ${specs.roomSize.unit || 'sqft'}` : undefined],
    ['Carpet area', specs.carpetArea?.value ? `${specs.carpetArea.value} ${specs.carpetArea.unit || 'sqft'}` : undefined], ['Maximum occupants', specs.maximumOccupants],
    ['Preferred occupancy', Array.isArray(specs.preferredOccupancy) ? specs.preferredOccupancy.join(', ') : specs.preferredOccupancy], ['Orientation', specs.orientation],
    ['Air conditioning', sentence(specs.airConditioning)], ['Lift access', specs.liftAccess === true ? 'Yes' : specs.liftAccess === false ? 'No' : undefined],
    ['Electricity arrangement', sentence(specs.electricityArrangement)], ['Water arrangement', sentence(specs.waterArrangement)],
  ];
  const pricingRows: Array<[string, unknown]> = [
    ['Monthly rent', money(pricing.monthlyRent)], ['Security deposit', money(pricing.securityDeposit)], ['Maintenance charge', money(pricing.maintenanceCharge)],
    ['Booking amount', money(pricing.bookingAmount)], ['Minimum stay', pricing.minimumStayMonths ? `${pricing.minimumStayMonths} months` : undefined],
    ['Available from', dateLabel(pricing.availableFrom)], ['Electricity', sentence(pricing.electricity)], ['Water', sentence(pricing.water)],
  ];
  const statusHistory = Array.isArray(unit.statusHistory) ? unit.statusHistory : [];

  return <Box data-secureasset-landlord-room-view="view-room-v184" sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 8 }}>
    <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 4 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.2} mb={2}>
        <Stack direction="row" gap={.8} flexWrap="wrap"><Button startIcon={<ArrowBackRounded />} onClick={() => navigate(managerPath)}>Back to Rental Units</Button><Button variant="outlined" onClick={() => navigate(propertyPath)}>Property details</Button></Stack>
        <Button variant="contained" startIcon={<EditRounded />} onClick={() => navigate(managerPath)}>Edit in Rental Units</Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.5} mb={2.5}>
        <Box><Typography variant="h3" fontWeight={950} letterSpacing="-.045em">{unit.name || `Room ${unit.roomNumber}`}</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>{property?.title || 'Rental property'} · {floor ? `Floor ${floor.floorNumber} · ${floor.floorName}` : 'No floor / standalone room'}</Typography></Box>
        <Stack direction="row" gap={.7} flexWrap="wrap"><Chip color={statusColor(String(unit.availabilityStatus || ''))} label={sentence(unit.availabilityStatus)} /><Chip variant="outlined" label={unit.visibility === 'public' ? 'Public room' : 'Private room'} /></Stack>
      </Stack>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            {images.length ? <Grid container spacing={.45} sx={{ bgcolor: '#F1F5F9' }}>{images.map((image: any, index: number) => <Grid key={`${recordId(image.file) || image.url || 'room-image'}-${index}`} size={{ xs: index === 0 ? 12 : 6, sm: index === 0 ? 8 : 4 }}><ManagedRoomImage image={image} unitId={String(unit._id)} alt={image.name || `${unit.name || unit.roomNumber} image ${index + 1}`} height={index === 0 ? 360 : 180} /><Typography noWrap title={image.name} sx={{ px: .8, py: .45, bgcolor: '#FFFFFF', color: 'text.secondary', fontSize: 10.5 }}>{image.isPrimary ? 'Main thumbnail' : image.name || 'Room image'}</Typography></Grid>)}</Grid> : <Box sx={{ height: 220, display: 'grid', placeItems: 'center', bgcolor: '#F1F5F9', color: 'text.secondary' }}><Typography>No room images uploaded yet.</Typography></Box>}
            <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
              <Typography variant="h5" fontWeight={950}>Room overview</Typography>
              <Typography color="text.secondary" sx={{ mt: .8 }}>{unit.description || 'No room description has been added.'}</Typography>
              {featureChips.length > 0 && <Stack direction="row" flexWrap="wrap" gap={.7} mt={1.5}>{featureChips.map((feature: string) => <Chip key={feature} label={feature} variant="outlined" />)}</Stack>}
              <Divider sx={{ my: 2.5 }} />
              <Typography variant="h6" fontWeight={900} mb={1.4}>Room specifications</Typography>
              <InfoGrid rows={specificationRows} />
              {Array.isArray(unit.amenities) && unit.amenities.length > 0 && <><Typography variant="h6" fontWeight={900} mt={2.5} mb={1.2}>Additional amenities</Typography><Stack direction="row" flexWrap="wrap" gap={.7}>{unit.amenities.map((item: string) => <Chip key={item} label={item} />)}</Stack></>}
            </CardContent>
          </Card>

          <Section title="Current tenant and tenancy" icon={<PeopleAltRounded color="primary" />} dataKey="current-tenant-v184">
            {currentTenant ? <InfoGrid rows={[
              ['Tenant name', currentTenant.name], ['Email', currentTenant.email], ['Phone', currentTenant.phone], ['Tenancy status', sentence(currentTenancy?.status)],
              ['Tenancy number', currentTenancy?.tenancyNumber], ['Start date', dateLabel(currentTenancy?.startDate)], ['Expected end date', dateLabel(currentTenancy?.endDate)],
              ['Monthly rent at start', money(currentTenancy?.monthlyRent ?? pricing.monthlyRent)],
            ]} /> : <Alert severity="info">This room has no current tenant or active tenancy.</Alert>}
          </Section>

          <Section title="Permanent tenant history" icon={<HistoryRounded color="primary" />} dataKey="tenant-history-v184">
            {history.length === 0 ? <Alert severity="info">No tenant history has been recorded for this room.</Alert> : <TableContainer sx={{ overflowX: 'auto' }}><Table size="small" sx={{ minWidth: 760 }}><TableHead><TableRow><TableCell>Tenant</TableCell><TableCell>Status</TableCell><TableCell>Entered</TableCell><TableCell>Left</TableCell><TableCell>Monthly rent</TableCell><TableCell>Agreement</TableCell></TableRow></TableHead><TableBody>{history.map((entry: any, index: number) => <TableRow key={recordId(entry._id) || index} hover><TableCell><Typography fontWeight={800}>{entry.tenant?.name || '—'}</Typography><Typography variant="caption" color="text.secondary">{entry.tenant?.email || entry.tenant?.phone || 'Tenant record'}</Typography></TableCell><TableCell><Chip size="small" label={sentence(entry.status)} color={entry.status === 'active' ? 'success' : 'default'} /></TableCell><TableCell>{dateLabel(entry.startDate || entry.moveInDate || entry.createdAt)}</TableCell><TableCell>{dateLabel(entry.endDate || entry.moveOutDate || entry.closedAt)}</TableCell><TableCell>{money(entry.monthlyRent ?? pricing.monthlyRent)}</TableCell><TableCell>{sentence(entry.agreement?.status || '—')}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
          </Section>

          <Section title="Rent cycles, invoices and payments" icon={<PaymentsRounded color="primary" />} dataKey="room-financial-history-v184">
            <Stack spacing={1.2}>
              <Typography fontWeight={900}>Rent cycles</Typography>
              {cycles.length ? <TableContainer sx={{ overflowX: 'auto' }}><Table size="small" sx={{ minWidth: 620 }}><TableHead><TableRow><TableCell>Month</TableCell><TableCell>Status</TableCell><TableCell>Due</TableCell><TableCell>Outstanding</TableCell></TableRow></TableHead><TableBody>{cycles.slice(0, 24).map((cycle: any, index: number) => <TableRow key={recordId(cycle._id) || index}><TableCell>{display(cycle.cycleMonth)}</TableCell><TableCell>{sentence(cycle.status)}</TableCell><TableCell>{dateLabel(cycle.dueDate)}</TableCell><TableCell>{money(cycle.outstandingAmount ?? cycle.invoice?.balanceAmount)}</TableCell></TableRow>)}</TableBody></Table></TableContainer> : <Typography color="text.secondary" variant="body2">No rent cycles recorded.</Typography>}
              <Typography fontWeight={900} sx={{ mt: 1 }}>Invoices and payments</Typography>
              <Typography variant="body2" color="text.secondary">{invoices.length} invoice{invoices.length === 1 ? '' : 's'} · {payments.length} payment{payments.length === 1 ? '' : 's'} recorded for this room.</Typography>
              {(invoices.length > 0 || payments.length > 0) && <TableContainer sx={{ overflowX: 'auto' }}><Table size="small" sx={{ minWidth: 720 }}><TableHead><TableRow><TableCell>Record</TableCell><TableCell>Reference</TableCell><TableCell>Status</TableCell><TableCell>Amount</TableCell><TableCell>Date</TableCell></TableRow></TableHead><TableBody>{[...invoices.map((item) => ({ ...item, recordType: 'Invoice', reference: item.invoiceNumber })), ...payments.map((item) => ({ ...item, recordType: 'Payment', reference: item.transactionId || item.reference }))].slice(0, 50).map((item: any, index: number) => <TableRow key={`${recordId(item._id) || index}-${item.recordType}`}><TableCell>{item.recordType}</TableCell><TableCell>{display(item.reference)}</TableCell><TableCell>{sentence(item.status || item.paymentStatus)}</TableCell><TableCell>{money(item.amount ?? item.totalAmount ?? item.paidAmount)}</TableCell><TableCell>{dateTimeLabel(item.createdAt || item.paidAt || item.paymentDate)}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
            </Stack>
          </Section>

          <Section title="Room status history" icon={<HistoryRounded color="primary" />} dataKey="room-status-history-v184">
            {statusHistory.length === 0 ? <Typography color="text.secondary">No status changes recorded.</Typography> : <TableContainer sx={{ overflowX: 'auto' }}><Table size="small" sx={{ minWidth: 620 }}><TableHead><TableRow><TableCell>From</TableCell><TableCell>To</TableCell><TableCell>Reason</TableCell><TableCell>Changed</TableCell></TableRow></TableHead><TableBody>{statusHistory.slice().reverse().map((item: any, index: number) => <TableRow key={index}><TableCell>{sentence(item.from || '—')}</TableCell><TableCell><Chip size="small" label={sentence(item.to)} color={statusColor(String(item.to || ''))} /></TableCell><TableCell>{display(item.reason)}</TableCell><TableCell>{dateTimeLabel(item.changedAt)}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
          </Section>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Section title="Room pricing" icon={<PaymentsRounded color="primary" />} dataKey="room-pricing-v184">
            <InfoGrid rows={pricingRows} />
          </Section>
          <Section title="Floor and publication" icon={<HomeWorkRounded color="primary" />} dataKey="room-placement-v184">
            <InfoGrid rows={[
              ['Property', property?.title], ['Floor', floor ? `Floor ${floor.floorNumber} · ${floor.floorName}` : 'No floor / standalone room'], ['Floor code', floor?.floorCode],
              ['Room reference', unit.referenceNumber], ['Visibility', sentence(unit.visibility)], ['Publication', sentence(unit.publicationStatus)], ['Created', dateTimeLabel(unit.createdAt)], ['Last updated', dateTimeLabel(unit.updatedAt)],
            ]} />
          </Section>
          <Section title="Operational access" icon={<MeetingRoomRounded color="primary" />} dataKey="room-access-v184">
            <Typography variant="body2" color="text.secondary">This private landlord view includes room configuration, secure room images, current tenancy, permanent tenant history, status changes and room-linked financial records. Public visitors only receive the public room serialization.</Typography>
          </Section>
        </Grid>
      </Grid>
    </Container>
  </Box>;
}
