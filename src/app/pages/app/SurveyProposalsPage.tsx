import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import ChatRounded from '@mui/icons-material/ChatRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import WorkOutlineRounded from '@mui/icons-material/WorkOutlineRounded';
import { useNavigate } from 'react-router';
import { createConversation, getSurveyorProposals, updateResource } from '../../services/api';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';

const money = (value: unknown) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const label = (value: unknown) => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function SurveyProposalsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { const response = await getSurveyorProposals({ status, limit: 100 }); setRows(response.data || []); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [status]);

  async function chat(row: any) {
    setBusy(row._id); setError('');
    try {
      const response = await createConversation({ participants: [row.client?._id || row.client], type: 'survey', title: `Survey proposal · ${row.job?.title || row.quotationNumber}`, reference: { model: 'SurveyQuotation', id: row._id, label: row.job?.title || row.quotationNumber } });
      navigate(`/app/messages?conversation=${response.data?._id || ''}`);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(''); }
  }

  async function withdraw(row: any) {
    setBusy(row._id); setError('');
    try { await updateResource('survey-quotations', row._id, { status: 'withdrawn' }); setNotice('Proposal withdrawn.'); await load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(''); }
  }

  return <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 7 }}>
    <CompactPageToolbar marker="survey-quotations-toolbar-v153" title="My Proposals" description="Track every formal survey bid from submission through hiring." actions={<Stack direction="row" spacing={1}><TextField select size="small" label="Status" value={status} onChange={(event) => setStatus(event.target.value)} sx={{ minWidth: 170 }}><MenuItem value="">All proposals</MenuItem>{['submitted','viewed','under_negotiation','revised','accepted','rejected','withdrawn','expired'].map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}</TextField><Button variant="outlined" startIcon={<RefreshRounded />} onClick={load}>Refresh</Button></Stack>} />
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {loading ? <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : !rows.length ? <Paper elevation={0} sx={{ p: 5, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}><DescriptionRounded color="primary" sx={{ fontSize: 48 }} /><Typography sx={{ mt: 1, fontWeight: 900 }}>No proposals yet</Typography><Typography color="text.secondary" sx={{ mt: .5, mb: 2 }}>Find a suitable job and submit your price, method, and delivery dates.</Typography><Button variant="contained" onClick={() => navigate('/app/survey-job-marketplace')}>Find survey jobs</Button></Paper> : <Stack spacing={1.5}>{rows.map((row) => <Paper key={row._id} elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: '1px solid', borderColor: 'divider', transition: 'transform .18s, box-shadow .18s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 15px 38px rgba(11,82,112,.11)' } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box sx={{ minWidth: 0 }}><Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap><Typography sx={{ fontWeight: 920, fontSize: 17 }}>{row.job?.title || 'Survey proposal'}</Typography><Chip size="small" label={label(row.status)} color={row.status === 'accepted' ? 'success' : row.status === 'rejected' || row.status === 'expired' ? 'error' : 'primary'} /></Stack><Typography color="text.secondary" sx={{ mt: .5, fontSize: 12 }}>{row.quotationNumber} · {row.job?.addressApproximate || 'Location protected'} · {row.client?.name || 'Landlord'}</Typography></Box>
        <Stack direction="row" spacing={2}><Box><Typography color="text.secondary" sx={{ fontSize: 10, fontWeight: 800 }}>PROPOSED PRICE</Typography><Typography sx={{ fontWeight: 900 }}>{money(row.totalAmount)}</Typography></Box><Box><Typography color="text.secondary" sx={{ fontSize: 10, fontWeight: 800 }}>DISTANCE</Typography><Typography sx={{ fontWeight: 900 }}>{Number.isFinite(row.distanceKm) ? `${row.distanceKm} km` : '—'}</Typography></Box></Stack>
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="body2" color="text.secondary">{row.scope || 'No scope summary supplied.'}</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}><Button size="small" variant="outlined" startIcon={<ChatRounded />} onClick={() => chat(row)} disabled={busy === row._id}>Chat with landlord</Button>{row.project?._id && <Button size="small" variant="contained" startIcon={<FolderOpenRounded />} onClick={() => navigate(`/app/survey-projects/${row.project._id}`)}>Open active project</Button>}{['draft','submitted','viewed','under_negotiation','revised'].includes(row.status) && <Button size="small" color="error" onClick={() => withdraw(row)} disabled={busy === row._id}>Withdraw</Button>}</Stack>
    </Paper>)}</Stack>}
    <Button sx={{ mt: 2 }} startIcon={<WorkOutlineRounded />} onClick={() => navigate('/app/survey-job-marketplace')}>Browse more jobs</Button>
  </Box>;
}
