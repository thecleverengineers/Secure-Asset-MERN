import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, Grid, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import ExploreRounded from '@mui/icons-material/ExploreRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import KeyRounded from '@mui/icons-material/KeyRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { getMyProperties } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { safeRecord, safeRecordArray } from '../../utils/runtimeData';
import { propertyOverviewPath } from '../../utils/propertyUrl';

type PropertyRecord = {
  id?: string;
  source?: string;
  property?: Record<string, any>;
  status?: string;
  startDate?: string;
  endDate?: string;
  monthlyRent?: number;
  paidAt?: string;
  paidAmount?: number;
  leaseNumber?: string;
  paymentCycle?: string;
  cycleId?: string;
  space?: Record<string, any>;
  unit?: Record<string, any>;
};

type PropertyCollection = {
  rented: PropertyRecord[];
  leased: PropertyRecord[];
  purchased: PropertyRecord[];
};

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const sentence = (value: string) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateText = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
};

const tabs = [
  { value: 'all', label: 'All properties', icon: HomeWorkRounded },
  { value: 'rented', label: 'Rented', icon: KeyRounded },
  { value: 'leased', label: 'Leased', icon: ApartmentRounded },
  { value: 'purchased', label: 'Purchased', icon: VerifiedRounded },
] as const;

function locationText(property: Record<string, any> = {}) {
  const address = property.address || {};
  return [address.locality, address.city, address.state].filter(Boolean).join(', ') || 'Location available in your agreement';
}

function PropertyCard({ record, category, onOpen }: { record: PropertyRecord; category: 'rented' | 'leased' | 'purchased'; onOpen: (record: PropertyRecord) => void }) {
  const property = record.property || {};
  const hasRentCycle = Boolean(record.cycleId && category !== 'purchased');
  const label = category === 'purchased' ? 'Purchased' : category === 'leased' ? 'Leased' : 'Rented';
  const period = category === 'purchased'
    ? record.paidAt ? `Purchased ${dateText(record.paidAt)}` : 'Purchase recorded'
    : record.startDate ? `${label} from ${dateText(record.startDate)}` : `${label} property`;
  const financial = category === 'purchased'
    ? record.paidAmount ? money(record.paidAmount) : ''
    : record.monthlyRent ? `${money(record.monthlyRent)} / month` : '';

  return <Card data-secureasset-my-property-cycle-card="text-first-v164" elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 4, overflow: 'hidden', transition: 'transform .18s ease, box-shadow .18s ease', '&:hover': hasRentCycle ? { transform: 'translateY(-3px)', boxShadow: '0 16px 34px rgba(15,35,40,.12)' } : undefined }}>
    <CardActionArea disabled={!hasRentCycle} onClick={() => onOpen(record)} aria-label={hasRentCycle ? `Open rent cycle for ${property.title || 'property'}` : undefined} sx={{ textAlign: 'inherit', alignItems: 'stretch', height: hasRentCycle ? '100%' : 'auto', '&.Mui-disabled': { opacity: 1 } }}>
      <CardContent sx={{ p: { xs: 1.8, sm: 2.2 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
          <Box aria-hidden="true" sx={{ width: 42, height: 42, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 2.5, color: 'primary.main', bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.100' }}><HomeWorkRounded sx={{ fontSize: 21 }} /></Box>
          <Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontWeight: 900, fontSize: 16 }}>{property.title || 'Property record'}</Typography><Typography noWrap color="text.secondary" sx={{ fontSize: 11.5, mt: .35 }}>{property.code || property.referenceNumber || 'SecureAsset property'}</Typography></Box>
        </Stack>
        <Chip size="small" label={label} color={category === 'purchased' ? 'success' : 'primary'} sx={{ flexShrink: 0, fontWeight: 800 }} />
      </Stack>
      <Typography color="text.secondary" sx={{ fontSize: 12.2, mt: 1 }}>{locationText(property)}</Typography>
      <Stack spacing={.85} sx={{ mt: 1.6 }}>
        <Stack direction="row" spacing={1} alignItems="center"><CalendarMonthRounded sx={{ fontSize: 16, color: 'text.secondary' }} /><Typography sx={{ fontSize: 11.8 }}>{period}</Typography></Stack>
        {financial && <Stack direction="row" spacing={1} alignItems="center"><Typography sx={{ color: 'primary.main', fontSize: 13, fontWeight: 900 }}>{financial}</Typography>{category !== 'purchased' && <Typography color="text.secondary" sx={{ fontSize: 11 }}>plan</Typography>}</Stack>}
        {record.status && <Typography color="text.secondary" sx={{ fontSize: 11.5 }}>Status: <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>{sentence(record.status)}</Box></Typography>}
      </Stack>
      {hasRentCycle && <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2, pt: 1.25, borderTop: '1px solid', borderColor: 'divider', color: 'primary.main' }}><Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>Open rent cycle</Typography><ArrowForwardRounded sx={{ fontSize: 18 }} /></Stack>}
      </CardContent>
    </CardActionArea>
    {!hasRentCycle && property._id && property.visibility === 'public' && property.publicationStatus === 'published' && <Box sx={{ px: { xs: 1.8, sm: 2.2 }, pb: { xs: 1.8, sm: 2.2 } }}><Button fullWidth variant="outlined" size="small" onClick={() => onOpen(record)} sx={{ borderRadius: 2.5 }}>View public details</Button></Box>}
  </Card>;
}

function EmptyProperties({ category, onBrowse }: { category: string; onBrowse: () => void }) {
  return <Box sx={{ py: { xs: 5, md: 7 }, px: 2, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 4, bgcolor: 'background.paper' }}>
    <Box sx={{ width: 58, height: 58, mx: 'auto', display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: 'primary.50', color: 'primary.main' }}><HomeWorkRounded /></Box>
    <Typography sx={{ mt: 1.6, fontWeight: 900, fontSize: 18 }}>{category === 'all' ? 'Your property journey starts here' : `No ${category} properties yet`}</Typography>
    <Typography color="text.secondary" sx={{ maxWidth: 480, mx: 'auto', mt: .7, fontSize: 13 }}>Approved rental, lease, and completed purchase records connected to your tenant account will appear here automatically.</Typography>
    <Button variant="contained" startIcon={<ExploreRounded />} onClick={onBrowse} sx={{ mt: 2.2 }}>Browse properties</Button>
  </Box>;
}

export default function MyPropertyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<PropertyCollection>({ rented: [], leased: [], purchased: [] });
  const [tab, setTab] = useState<(typeof tabs)[number]['value']>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    getMyProperties()
      .then((response) => {
        if (!mounted) return;
        const payload = safeRecord(response?.data);
        setData({
          rented: safeRecordArray(payload.rented) as PropertyRecord[],
          leased: safeRecordArray(payload.leased) as PropertyRecord[],
          purchased: safeRecordArray(payload.purchased) as PropertyRecord[],
        });
      })
      .catch((cause) => { if (mounted) setError((cause as Error).message || 'Could not load your property records'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const records = useMemo(() => tab === 'all'
    ? [...data.rented.map((record) => ({ record, category: 'rented' as const })), ...data.leased.map((record) => ({ record, category: 'leased' as const })), ...data.purchased.map((record) => ({ record, category: 'purchased' as const }))]
    : data[tab].map((record) => ({ record, category: tab as 'rented' | 'leased' | 'purchased' })), [data, tab]);
  const allCount = data.rented.length + data.leased.length + data.purchased.length;

  const openProperty = (record: PropertyRecord) => {
    if (record.cycleId) {
      navigate(`/app/my-property/${record.cycleId}/rent-cycle`);
      return;
    }
    if (record.property?._id) navigate(propertyOverviewPath(record.property));
  };

  if (loading) return <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (user?.role !== 'tenant') return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 } }}><Alert severity="info">My Property is available in the tenant workspace.</Alert></Box>;

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 6 }}>
    <Stack data-secureasset-my-property-toolbar="compact-v151" direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1.2} sx={{ mb: 2.2 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip icon={<HomeWorkRounded />} label={`${allCount} connected records`} />
        <Chip icon={<VerifiedRounded />} label="Private to you" variant="outlined" />
      </Stack>
      <Button variant="outlined" size="small" startIcon={<ExploreRounded />} onClick={() => navigate('/marketplace')}>Browse properties</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Box sx={{ mb: 2.4, overflowX: 'auto' }}><Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ minHeight: 48, '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 800 } }}>
      {tabs.map(({ value, label, icon: Icon }) => <Tab key={value} value={value} icon={<Icon sx={{ fontSize: 18 }} />} iconPosition="start" label={`${label} ${value === 'all' ? allCount : data[value].length}`} />)}
    </Tabs></Box>
    {records.length ? <Grid container spacing={{ xs: 1.7, sm: 2.3 }}>{records.map(({ record, category }) => <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={`${category}-${record.id || record.property?._id}`}><PropertyCard record={record} category={category} onOpen={openProperty} /></Grid>)}</Grid> : <EmptyProperties category={tab} onBrowse={() => navigate('/marketplace')} />}
  </Box>;
}
