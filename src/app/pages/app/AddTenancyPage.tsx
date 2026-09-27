import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddHomeWorkRounded from '@mui/icons-material/AddHomeWorkRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import BedRounded from '@mui/icons-material/BedRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';
import { createDirectTenancy, getDirectTenancyOptions } from '../../services/api';

type RecordValue = Record<string, any>;

type DirectTenancyForm = {
  tenantUserId: string;
  propertyId: string;
  rentalUnitId: string;
  startDate: string;
  durationMonths: string;
  monthlyRent: string;
  securityDeposit: string;
  maintenanceCharge: string;
  dueDay: string;
  dueTime: string;
};

function todayInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? '₹' + amount.toLocaleString('en-IN') : '₹0';
}

function idOf(value: any) {
  return String(value?._id || value || '');
}

function tenantLabel(row: RecordValue) {
  const user = row.user || {};
  const name = user.name || row.name || 'Tenant';
  const phone = user.phone || row.phone || '';
  const source = row.isAddedByYou && row.isTenancyHolder
    ? 'Added by you + tenancy holder'
    : row.isTenancyHolder
      ? 'Tenancy holder'
      : 'Added by you';
  return `${name}${phone ? ` · ${phone}` : ''} · ${source}`;
}

function listingLabel(row: RecordValue) {
  const city = row.address?.city ? ` · ${row.address.city}` : '';
  return `${row.title || 'Rental listing'}${city}`;
}

function roomLabel(row: RecordValue) {
  const floor = row.floor?.floorName ? ` · ${row.floor.floorName}` : '';
  const rent = Number(row.pricing?.monthlyRent || 0) > 0 ? ` · ${formatMoney(row.pricing.monthlyRent)}/month` : '';
  return `${row.name || row.roomNumber || 'Room'}${floor}${rent}`;
}

export default function AddTenancyPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<RecordValue[]>([]);
  const [listings, setListings] = useState<RecordValue[]>([]);
  const [rooms, setRooms] = useState<RecordValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<DirectTenancyForm>({
    tenantUserId: '',
    propertyId: '',
    rentalUnitId: '',
    startDate: todayInput(),
    durationMonths: '12',
    monthlyRent: '',
    securityDeposit: '',
    maintenanceCharge: '',
    dueDay: '1',
    dueTime: '09:00',
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    getDirectTenancyOptions()
      .then((result) => {
        if (!active) return;
        setTenants(result.data?.tenants || []);
        setListings(result.data?.listings || []);
      })
      .catch((exception) => active && setError((exception as Error).message || 'Could not load tenancy options.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function selectProperty(propertyId: string) {
    setForm((current) => ({ ...current, propertyId, rentalUnitId: '', monthlyRent: '', securityDeposit: '', maintenanceCharge: '' }));
    setRooms([]);
    if (!propertyId) return;
    setLoadingRooms(true);
    setError('');
    try {
      const result = await getDirectTenancyOptions(propertyId);
      setRooms(result.data?.rooms || []);
    } catch (exception) {
      setError((exception as Error).message || 'Available rooms could not be loaded.');
    } finally {
      setLoadingRooms(false);
    }
  }

  function selectRoom(rentalUnitId: string) {
    const room = rooms.find((item) => idOf(item) === rentalUnitId);
    setForm((current) => ({
      ...current,
      rentalUnitId,
      monthlyRent: room ? String(room.pricing?.monthlyRent ?? '') : '',
      securityDeposit: room ? String(room.pricing?.securityDeposit ?? '') : '',
      maintenanceCharge: room ? String(room.pricing?.maintenanceCharge ?? '') : '',
    }));
  }

  const selectedTenant = useMemo(() => tenants.find((item) => idOf(item) === form.tenantUserId), [tenants, form.tenantUserId]);
  const selectedListing = useMemo(() => listings.find((item) => idOf(item) === form.propertyId), [listings, form.propertyId]);
  const selectedRoom = useMemo(() => rooms.find((item) => idOf(item) === form.rentalUnitId), [rooms, form.rentalUnitId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = await createDirectTenancy({
        tenantUserId: form.tenantUserId,
        propertyId: form.propertyId,
        rentalUnitId: form.rentalUnitId,
        startDate: form.startDate,
        durationMonths: Number(form.durationMonths),
        monthlyRent: Number(form.monthlyRent),
        securityDeposit: Number(form.securityDeposit || 0),
        maintenanceCharge: Number(form.maintenanceCharge || 0),
        dueDay: Number(form.dueDay),
        dueTime: form.dueTime,
      });
      const tenancyId = idOf(result.data?.tenancy);
      navigate(tenancyId ? `/app/tenancy_details/${encodeURIComponent(tenancyId)}` : '/app/tenancies', { replace: true });
    } catch (exception) {
      setError((exception as Error).message || 'The tenancy could not be added.');
    } finally {
      setSaving(false);
    }
  }

  return <Box
    data-secureasset-direct-tenancy="added-or-holder-own-available-listing-room-v230"
    sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }}
  >
    <CompactPageToolbar
      title="Add Tenancy"
      description="Create a tenancy directly for a tenant you added or an existing tenancy-holder tenant, using one of your own available rental rooms."
      actions={<Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/app/tenancies')} sx={{ textTransform: 'none' }}>Back to tenancies</Button>}
    />

    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Alert severity="info" sx={{ mb: 2 }}>
      You can select either a registered tenant added by you or an existing tenancy-holder tenant under your landlord account. Only your own available rental listings and rooms with AVAILABLE status can be used. Creating the tenancy locks the selected room as occupied.
    </Alert>

    {loading ? <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress size={30} /></Box> : (
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2.2}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
                <PersonRounded color="primary" />
                <Box><Typography sx={{ fontSize: 16, fontWeight: 700 }}>1. Select tenant</Typography><Typography color="text.secondary" sx={{ fontSize: 12.5 }}>Choose a tenant added by you or an existing tenancy-holder tenant under your account.</Typography></Box>
              </Stack>
              <TextField
                select
                fullWidth
                required
                size="small"
                label="Added / tenancy-holder tenant"
                value={form.tenantUserId}
                onChange={(event) => setForm({ ...form, tenantUserId: event.target.value })}
                helperText={tenants.length ? 'Added-by-you and tenancy-holder tenants are combined here; duplicates are merged automatically.' : 'No eligible added or tenancy-holder tenant is available yet.'}
              >
                {tenants.map((tenant) => <MenuItem key={idOf(tenant)} value={idOf(tenant)}>{tenantLabel(tenant)}</MenuItem>)}
              </TextField>
              {selectedTenant && <Typography sx={{ mt: 1, fontSize: 12, color: 'text.secondary' }}>
                {selectedTenant.isAddedByYou ? 'Added by you' : ''}
                {selectedTenant.isAddedByYou && selectedTenant.isTenancyHolder ? ' · ' : ''}
                {selectedTenant.isTenancyHolder ? 'Tenancy holder' : ''}
                {' · '}KYC: {String(selectedTenant.user?.kycStatus || 'not started').replaceAll('_', ' ')}
              </Typography>}
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
                <ApartmentRounded color="primary" />
                <Box><Typography sx={{ fontSize: 16, fontWeight: 700 }}>2. Select your available listing</Typography><Typography color="text.secondary" sx={{ fontSize: 12.5 }}>Only your rent listings with available or partially occupied status.</Typography></Box>
              </Stack>
              <TextField
                select
                fullWidth
                required
                size="small"
                label="Available rental listing"
                value={form.propertyId}
                onChange={(event) => void selectProperty(event.target.value)}
                helperText={listings.length ? 'The room list below is loaded only from the selected listing.' : 'No available rental listing was found in your account.'}
              >
                {listings.map((listing) => <MenuItem key={idOf(listing)} value={idOf(listing)}>{listingLabel(listing)}</MenuItem>)}
              </TextField>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
                <BedRounded color="primary" />
                <Box><Typography sx={{ fontSize: 16, fontWeight: 700 }}>3. Select available room</Typography><Typography color="text.secondary" sx={{ fontSize: 12.5 }}>Occupied, reserved, payment-pending and agreement-pending rooms are excluded.</Typography></Box>
              </Stack>
              <TextField
                select
                fullWidth
                required
                size="small"
                disabled={!form.propertyId || loadingRooms}
                label={loadingRooms ? 'Loading available rooms…' : 'Available room'}
                value={form.rentalUnitId}
                onChange={(event) => selectRoom(event.target.value)}
                helperText={form.propertyId && !loadingRooms && rooms.length === 0 ? 'This listing has no AVAILABLE room.' : 'Only AVAILABLE rooms can be assigned.'}
              >
                {rooms.map((room) => <MenuItem key={idOf(room)} value={idOf(room)}>{roomLabel(room)}</MenuItem>)}
              </TextField>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
                <ReceiptLongRounded color="primary" />
                <Box><Typography sx={{ fontSize: 16, fontWeight: 700 }}>4. Tenancy terms</Typography><Typography color="text.secondary" sx={{ fontSize: 12.5 }}>Rent values are prefilled from the selected room and can be adjusted for this tenancy.</Typography></Box>
              </Stack>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField required fullWidth size="small" type="date" label="Start date" InputLabelProps={{ shrink: true }} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
                  <TextField select required fullWidth size="small" label="Duration" value={form.durationMonths} onChange={(event) => setForm({ ...form, durationMonths: event.target.value })}>
                    {[1, 3, 6, 9, 12, 18, 24, 36].map((months) => <MenuItem key={months} value={String(months)}>{months} month{months === 1 ? '' : 's'}</MenuItem>)}
                  </TextField>
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField required fullWidth size="small" type="number" inputProps={{ min: 1, step: 1 }} label="Monthly rent" value={form.monthlyRent} onChange={(event) => setForm({ ...form, monthlyRent: event.target.value })} />
                  <TextField fullWidth size="small" type="number" inputProps={{ min: 0, step: 1 }} label="Security deposit" value={form.securityDeposit} onChange={(event) => setForm({ ...form, securityDeposit: event.target.value })} />
                  <TextField fullWidth size="small" type="number" inputProps={{ min: 0, step: 1 }} label="Monthly maintenance" value={form.maintenanceCharge} onChange={(event) => setForm({ ...form, maintenanceCharge: event.target.value })} />
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField required fullWidth size="small" type="number" inputProps={{ min: 1, max: 31 }} label="Rent due day" value={form.dueDay} onChange={(event) => setForm({ ...form, dueDay: event.target.value })} />
                  <TextField required fullWidth size="small" type="time" label="Due time" InputLabelProps={{ shrink: true }} value={form.dueTime} onChange={(event) => setForm({ ...form, dueTime: event.target.value })} />
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: 'background.paper' }}>
            <CardContent>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <AddHomeWorkRounded color="primary" />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>Ready to create tenancy</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>
                    {selectedTenant ? tenantLabel(selectedTenant) : 'Select tenant'} · {selectedListing ? selectedListing.title : 'Select listing'} · {selectedRoom ? selectedRoom.name || selectedRoom.roomNumber : 'Select room'}
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                <Button onClick={() => navigate('/app/tenancies')} disabled={saving}>Cancel</Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddHomeWorkRounded />}
                  disabled={saving || !form.tenantUserId || !form.propertyId || !form.rentalUnitId || !form.monthlyRent}
                  sx={{ textTransform: 'none', minWidth: 150 }}
                >
                  {saving ? 'Creating…' : 'Add tenancy'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    )}
  </Box>;
}
