import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Avatar, Box, Button, Card,
  CardActionArea, CardContent, Chip, CircularProgress, Divider, IconButton, Pagination,
  Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import { PropertyCardCover } from '../../components/property/PropertyPortfolioCard';
import { getPropertyTenancyHistory, getTenancyHistoryProperties } from '../../services/api';

type DataRow = Record<string, any>;
type HistoryFilter = 'all' | 'current' | 'past' | 'upcoming' | 'cancelled' | 'other';
const groups: Record<HistoryFilter, string> = { all: 'All history', current: 'Current tenants', past: 'Past tenancies', upcoming: 'Upcoming / pending', cancelled: 'Cancelled', other: 'Other records' };
const money = (value: any) => value === null || value === undefined ? 'Not recorded' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value));
const readable = (value: any) => String(value || 'Not recorded').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
function dateText(value: any, includeTime = false) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', ...(includeTime ? { timeStyle: 'medium' as const } : {}), timeZone: 'Asia/Kolkata' }).format(new Date(value));
}
function addressText(address: any) { return typeof address === 'string' ? address : [address?.line1, address?.locality, address?.city, address?.state].filter(Boolean).join(', '); }
function Rent({ rent }: { rent: DataRow }) {
  return <Box><Typography sx={{ fontSize: 17, fontWeight: 500, color: 'primary.main' }}>{rent?.amount == null ? 'Not recorded' : money(rent.amount)}{rent?.maximum > rent?.amount ? ' – ' + money(rent.maximum) : ''}{rent?.amount != null && <Typography component="span" sx={{ fontSize: 12, ml: .5 }}>/ month</Typography>}</Typography><Typography color="text.secondary" sx={{ fontSize: 11, mt: .25 }}>{rent?.label || 'Monthly rent'}</Typography></Box>;
}
function DateItem({ label, value, time = false }: { label: string; value: any; time?: boolean }) {
  return <Box><Typography color="text.secondary" sx={{ fontSize: 11 }}>{label}</Typography><Typography sx={{ mt: .3, fontSize: 12.5 }}>{dateText(value, time)}</Typography></Box>;
}
function TenancyRecord({ record }: { record: DataRow }) {
  return <Card variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
    <CardContent sx={{ p: { xs: 1.6, md: 2.2 }, '&:last-child': { pb: 2.2 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }}>
        <Stack direction="row" spacing={1.3} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar src={record.tenant?.avatar} sx={{ width: 44, height: 44, bgcolor: 'action.selected', color: 'primary.main' }}>{String(record.tenant?.name || '?').slice(0, 1)}</Avatar>
          <Box sx={{ minWidth: 0 }}><Typography sx={{ fontSize: 15, fontWeight: 500, overflowWrap: 'anywhere' }}>{record.tenant?.name || 'Tenant record unavailable'}</Typography><Typography color="text.secondary" sx={{ fontSize: 12, mt: .25 }}>{[record.unitName, record.roomNumber, record.floorName].filter(Boolean).join(' · ')}</Typography><Typography color="text.secondary" sx={{ fontSize: 11, mt: .25 }}>{record.tenancyNumber || 'Tenancy ' + String(record._id).slice(-8)}</Typography></Box>
        </Stack>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
          <Chip label={groups[record.group as HistoryFilter] || 'Other record'} size="small" color={record.group === 'current' ? 'success' : 'default'} variant="outlined" />
          <Chip label={readable(record.status)} size="small" sx={{ bgcolor: 'action.hover' }} />
          <Button component={Link} to={'/app/tenancy_details/' + encodeURIComponent(record._id)} size="small" endIcon={<ArrowForwardRounded />} sx={{ textTransform: 'none' }}>Open tenancy</Button>
        </Stack>
      </Stack>
      <Divider sx={{ my: 1.8 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(5,minmax(0,1fr))' }, gap: 2 }}>
        <DateItem label="Agreement start" value={record.startDate} />
        <DateItem label="Agreement end" value={record.endDate} />
        <DateItem label="Tenancy activated" value={record.activatedAt} time />
        <DateItem label="Closed on" value={record.closedAt} time />
        <Box><Typography color="text.secondary" sx={{ fontSize: 11 }}>Monthly rent</Typography><Typography sx={{ mt: .3, fontSize: 14, color: 'primary.main', fontWeight: 500 }}>{money(record.monthlyRent)}</Typography></Box>
      </Box>
    </CardContent>
    <Accordion disableGutters elevation={0} sx={{ borderTop: '1px solid', borderColor: 'divider', '&:before': { display: 'none' }, bgcolor: 'action.hover' }}>
      <AccordionSummary expandIcon={<ExpandMoreRounded />} aria-label={'Activity history for ' + (record.tenant?.name || record.tenancyNumber || record._id)}><Stack direction="row" spacing={1} alignItems="center"><HistoryRounded sx={{ fontSize: 17, color: 'primary.main' }} /><Typography sx={{ fontSize: 12 }}>Activity history · {record.events?.length || 0} recorded events</Typography></Stack></AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 2, md: 3 }, pb: 2.2 }}>
        {!record.events?.length ? <Typography color="text.secondary" sx={{ fontSize: 12 }}>No timestamped activity has been recorded for this tenancy.</Typography> : <Stack spacing={2}>{record.events.map((event: DataRow, index: number) => <Box key={index} sx={{ borderLeft: '2px solid', borderColor: 'divider', pl: 2 }}><Typography color="primary.main" sx={{ fontSize: 11 }}>{dateText(event.at, true)} IST</Typography><Typography sx={{ fontSize: 13, mt: .3, fontWeight: 500 }}>{event.title}</Typography>{event.detail && <Typography color="text.secondary" sx={{ fontSize: 12, mt: .3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{event.detail}</Typography>}</Box>)}</Stack>}
      </AccordionDetails>
    </Accordion>
  </Card>;
}

export default function TenancyHistoryPage() {
  const { propertyId } = useParams();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  useEffect(() => { const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { setSearch(''); setQuery(''); setPage(1); setFilter('all'); }, [propertyId]);
  const history = useQuery({
    queryKey: ['landlord-tenancy-history', propertyId || 'properties', page, query, filter],
    queryFn: async () => propertyId ? (await getPropertyTenancyHistory(propertyId, { page, limit: 15, search: query, filter })).data : await getTenancyHistoryProperties({ page, limit: 12, search: query }),
    staleTime: 15_000,
  });
  const data = history.data as DataRow | undefined;
  const property = propertyId ? data?.property : undefined;
  const records: DataRow[] = propertyId ? data?.records || [] : data?.data || [];
  const pagination = data?.pagination;
  const counts = data?.counts || {};
  return <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 1.5, sm: 2.5 }, pt: 1.5, pb: 5 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 2.5 }}>
      <Stack direction="row" alignItems="center" spacing={1.3}>
        {propertyId && <IconButton component={Link} to="/app/tenancy-history" aria-label="Back to tenancy history"><ArrowBackRounded /></IconButton>}
        <Box><Typography component="h1" sx={{ fontSize: { xs: 21, md: 26 }, fontWeight: 500 }}>{propertyId ? 'Property tenancy history' : 'Tenancy History'}</Typography><Typography color="text.secondary" sx={{ fontSize: 12.5, mt: .4 }}>{propertyId ? 'Current tenants, previous stays and recorded activity.' : 'Choose one of your rent properties to review its complete tenancy record.'}</Typography></Box>
      </Stack>
      <IconButton aria-label="Refresh tenancy history" onClick={() => void history.refetch()} disabled={history.isFetching}><ReplayRounded /></IconButton>
    </Stack>
    {history.isError && <Alert severity="error" sx={{ mb: 2 }}>{history.error instanceof Error ? history.error.message : 'Tenancy history could not be loaded.'}</Alert>}
    {property && <Card variant="outlined" sx={{ mb: 2.5, borderRadius: 3 }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '220px 1fr' }, gap: 1 }}><PropertyCardCover row={property} title={property.title || 'Property'} /><CardContent><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}><Box><Typography component="h2" sx={{ fontSize: 20, fontWeight: 500 }}>{property.title || property.code || 'Property'}</Typography><Typography color="text.secondary" sx={{ fontSize: 12, mt: .6 }}>{addressText(property.address) || 'Address not recorded'}</Typography>{(property.deletedAt || property.status === 'archived') && <Chip size="small" label="Archived property" sx={{ mt: 1 }} />}</Box><Rent rent={data?.rent || {}} /></Stack></CardContent></Box></Card>}
    {property && <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 1.2, mb: 2.5 }}>{(['all', 'current', 'past', 'upcoming'] as HistoryFilter[]).map((key) => <Card key={key} variant="outlined" sx={{ borderRadius: 2.5 }}><CardActionArea onClick={() => { setFilter(key); setPage(1); }}><CardContent sx={{ py: 1.5 }}><Typography color="text.secondary" sx={{ fontSize: 11.5 }}>{groups[key]}</Typography><Typography sx={{ fontSize: 25, mt: .6, fontWeight: 500 }}>{counts[key] || 0}</Typography></CardContent></CardActionArea></Card>)}</Box>
      <Typography color="text.secondary" sx={{ fontSize: 11.5, mb: 1.5 }}>Activity times are shown in IST. Agreement dates describe the rental term; activation, inspections and closure use their recorded timestamps.</Typography>
    </>}
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
      {propertyId ? <Tabs value={filter} onChange={(_event, value) => { setFilter(value); setPage(1); }} variant="scrollable" scrollButtons="auto" aria-label="Filter tenancy history" sx={{ minHeight: 40, '& .MuiTab-root': { textTransform: 'none', minHeight: 40, fontSize: 12 } }}>{(Object.keys(groups) as HistoryFilter[]).filter((key) => key !== 'other' || counts.other).map((key) => <Tab value={key} key={key} label={groups[key]} />)}</Tabs> : <Typography color="text.secondary" sx={{ fontSize: 13 }}>{pagination ? `${pagination.total} rent properties` : 'Your rent properties'}</Typography>}
      <TextField size="small" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={propertyId ? 'Search tenant, room or reference' : 'Search property or location'} inputProps={{ 'aria-label': propertyId ? 'Search tenancy history' : 'Search history properties' }} sx={{ width: { xs: '100%', md: 290 }, flexShrink: 0 }} />
    </Stack>
    {history.isFetching && <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}><CircularProgress size={18} /><Typography color="text.secondary" sx={{ fontSize: 12 }}>Loading tenancy history…</Typography></Stack>}
    {!history.isFetching && !history.isError && records.length === 0 && <Card variant="outlined" sx={{ textAlign: 'center', py: 5, px: 2, borderRadius: 3 }}><HomeWorkRounded sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} /><Typography sx={{ fontSize: 16, fontWeight: 500 }}>{propertyId ? 'No matching tenancy records' : 'No matching rent properties'}</Typography><Typography color="text.secondary" sx={{ fontSize: 13, mt: .5 }}>{query || filter !== 'all' ? 'Try another search or filter.' : propertyId ? 'Tenancy records will appear here as rental workflows are created.' : 'Rent properties you own will appear here, including those without a tenancy yet.'}</Typography></Card>}
    {propertyId ? <Stack spacing={1.5}>{records.map((record) => <TenancyRecord key={record._id} record={record} />)}</Stack> : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: 2 }}>{records.map((row) => <Card key={row._id} variant="outlined" sx={{ borderRadius: 3, '&:hover': { borderColor: 'primary.main', boxShadow: '0 8px 24px rgba(11,82,112,.08)' } }}><CardActionArea component={Link} to={'/app/property_tenancy_history/' + encodeURIComponent(row._id)} aria-label={'View tenancy history for ' + (row.title || row.code)} sx={{ height: '100%' }}><PropertyCardCover row={row} title={row.title || 'Property'} /><CardContent sx={{ p: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="start" gap={1}><Typography component="h2" sx={{ fontSize: 17, fontWeight: 500 }}>{row.title || row.code || 'Property'}</Typography><HistoryRounded sx={{ fontSize: 20, color: 'primary.main' }} /></Stack><Typography color="text.secondary" sx={{ mt: .5, fontSize: 12, minHeight: 18 }}>{addressText(row.address) || 'Address not recorded'}</Typography><Box sx={{ my: 1.6 }}><Rent rent={row.rent} /></Box><Stack direction="row" useFlexGap flexWrap="wrap" gap={.7}><Chip size="small" variant="outlined" label={`${row.counts.current} current`} color={row.counts.current ? 'success' : 'default'} /><Chip size="small" variant="outlined" label={`${row.counts.past} past`} />{row.deletedAt && <Chip size="small" label="Archived" />}</Stack><Stack direction="row" spacing={.5} alignItems="center" sx={{ mt: 1.7, color: 'primary.main' }}><Typography sx={{ fontSize: 12 }}>View tenancy history</Typography><ArrowForwardRounded sx={{ fontSize: 15 }} /></Stack></CardContent></CardActionArea></Card>)}</Box>}
    {pagination?.pages > 1 && <Stack alignItems="center" sx={{ mt: 3 }}><Pagination page={pagination.page} count={pagination.pages} onChange={(_event, value) => setPage(value)} /></Stack>}
  </Box>;
}
