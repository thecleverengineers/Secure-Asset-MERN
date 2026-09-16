import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { getAdminRentalManagement } from '../../services/api';

const money = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const sentence = (value: unknown) => String(value || '—').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function RentalManagementAdminPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true); setError('');
    try { setRows((await getAdminRentalManagement(filters)).data || []); }
    catch (cause) { setError((cause as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1800, mx: 'auto' }}>
    <Typography variant="h4" fontWeight={950}>Rental Management</Typography>
    <Typography color="text.secondary" mb={3}>Property, floor, room, tenant, agreement, invoice and permanent tenancy tracking.</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} flexWrap="wrap" gap={1.5}>
      {[['propertyId', 'Property ID'], ['landlordId', 'Landlord ID'], ['tenantId', 'Tenant ID'], ['roomId', 'Room ID'], ['agreementId', 'Agreement ID'], ['invoiceId', 'Invoice ID'], ['tenancyId', 'Tenancy ID']].map(([key, label]) => <TextField key={key} size="small" label={label} value={filters[key] || ''} onChange={(e) => setFilters((current) => ({ ...current, [key]: e.target.value }))} />)}
      <Button variant="contained" disabled={loading} onClick={() => void load()}>Search records</Button>
      <Button onClick={() => { setFilters({}); setTimeout(() => void load()); }}>Clear</Button>
    </Stack></Paper>
    <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow>{['Property', 'Landlord', 'Room', 'Current Tenant', 'Previous', 'Agreement', 'Move-in', 'Move-out', 'Rent', 'Deposit', 'Cycle', 'Outstanding', 'Availability', 'Tenancy'].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
      <TableBody>{rows.map((row) => <TableRow key={row._id} hover><TableCell>{row.property?.title || row.property?._id}</TableCell><TableCell>{row.landlord?.name || '—'}</TableCell><TableCell>{row.rentalUnit?.roomNumber || '—'}<Typography variant="caption" display="block">{row.floor?.floorName || ''}</Typography></TableCell><TableCell>{row.status === 'closed' ? '—' : row.tenant?.name || '—'}</TableCell><TableCell>{row.previousTenants || 0}</TableCell><TableCell>{sentence(row.agreement?.status)}</TableCell><TableCell>{row.startDate ? new Date(row.startDate).toLocaleDateString() : '—'}</TableCell><TableCell>{row.moveOutDate || row.endDate ? new Date(row.moveOutDate || row.endDate).toLocaleDateString() : '—'}</TableCell><TableCell>{money(row.monthlyRent)}</TableCell><TableCell>{money(row.securityDeposit)}</TableCell><TableCell>{row.currentRentCycle?.cycleMonth || '—'}</TableCell><TableCell>{money(row.outstandingAmount)}</TableCell><TableCell><Chip size="small" label={sentence(row.rentalUnit?.availabilityStatus)} /></TableCell><TableCell>{sentence(row.status)}</TableCell></TableRow>)}
        {!rows.length && !loading && <TableRow><TableCell colSpan={14}><Alert severity="info">No rental records match these identifiers.</Alert></TableCell></TableRow>}
      </TableBody></Table></TableContainer>
  </Box>;
}
