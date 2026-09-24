import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, DialogActions, DialogContent,
  MenuItem, Pagination, Snackbar, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import WhatsApp from '@mui/icons-material/WhatsApp';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';
import { useActionDialog } from '../../components/shared/useActionDialog';
import { useAuth } from '../../context/AuthContext';
import {
  createTenantInvitation, cancelTenantInvitation, getMyListings, getLandlordTenants, resendTenantInvitation, updateResource,
} from '../../services/api';

type RecordValue = Record<string, any>;
type FilterKey = 'all' | 'added' | 'holders';
type TenantForm = { name: string; email: string; phone: string; property: string; unitName: string; privateNotes: string };
const blankForm = (): TenantForm => ({ name: '', email: '', phone: '', property: '', unitName: '', privateNotes: '' });
const idOf = (value: any) => String(value?._id || value || '');
const display = (value: any, fallback = '—') => String(value || '').trim() || fallback;
const photoOf = (value: any) => value?.avatar || value?.profilePhoto || value?.photo || '';
const propertyPhoto = (property: any) => property?.galleryCover || property?.images?.[0]?.url || property?.images?.[0] || property?.coverImage || '';
const prettyStatus = (value: any) => display(value, 'Not started').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function LandlordTenantsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const actions = useActionDialog();
  const [records, setRecords] = useState<RecordValue[]>([]);
  const [counts, setCounts] = useState({ all: 0, added: 0, holders: 0 });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [properties, setProperties] = useState<RecordValue[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecordValue | null>(null);
  const [form, setForm] = useState<TenantForm>(blankForm());
  const latestRequest = useRef(0);
  const [shareInvite, setShareInvite] = useState<RecordValue | null>(null);

  const reload = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const result = await getLandlordTenants({ page, limit: 20, filter, search: query });
      if (requestId !== latestRequest.current) return;
      setRecords(result.data || []);
      setCounts(result.counts);
      setPages(result.pagination.pages);
      setError('');
    } catch (exception) {
      if (requestId === latestRequest.current) setError((exception as Error).message || 'Tenant records could not be loaded.');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [page, filter, query]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    void getMyListings<RecordValue>({ limit: 100 }).then((result) => setProperties(result.data || []))
      .catch(() => setProperties([]));
  }, []);

  const visibleRows = records;
  function openCreate() {
    setError(''); setEditing(null); setForm(blankForm()); setFormOpen(true);
  }
  function openEdit(row: RecordValue) {
    setError(''); setEditing(row);
    setForm({
      name: row.name || row.user?.name || '',
      email: row.email || row.user?.email || '',
      phone: row.phone || row.user?.phone || '',
      property: idOf(row.property),
      unitName: row.unitName || '',
      privateNotes: row.privateNotes || '',
    });
    setFormOpen(true);
  }
  function openWhatsApp(invite: RecordValue) {
    const digits = String(invite.tenant?.phone || invite.phone || '').replace(/\D/g, '');
    const recipient = '91' + digits.slice(-10);
    const text = 'Hello ' + display(invite.tenant?.name || invite.name, 'there') + ', complete your SecureAsset tenant registration and KYC here: ' + invite.inviteUrl;
    window.open('https://wa.me/' + recipient + '?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  }
  async function copyInvite() {
    if (!shareInvite?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(String(shareInvite.inviteUrl));
      setNotice('Invitation link copied.');
    } catch { setError('Could not copy the link. Select and copy it from the invitation dialog.'); }
  }
  async function submitForm(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) {
        await updateResource('tenants', idOf(editing), {
          name: form.name, email: form.email, phone: form.phone, property: form.property,
          unitName: form.unitName, privateNotes: form.privateNotes,
        });
        setNotice('Tenant record updated.');
        setFormOpen(false);
        await reload();
      } else {
        const result = await createTenantInvitation(form);
        setFormOpen(false);
        setShareInvite(result.data);
        setNotice('Tenant added. Send their secure invitation through WhatsApp.');
        await reload();
      }
    } catch (exception) {
      setError((exception as Error).message || 'The tenant record could not be saved.');
    } finally {
      setSaving(false);
    }
  }
  async function resend(row: RecordValue) {
    try {
      const result = await resendTenantInvitation(idOf(row));
      setShareInvite(result.data);
      setNotice('A fresh seven-day invitation is ready to send.');
      await reload();
    } catch (exception) {
      setError((exception as Error).message || 'A new invitation could not be created.');
    }
  }
  async function remove(row: RecordValue) {
    const confirmed = await actions.askConfirmation('Cancel this invitation and revoke its registration link?', { title: 'Cancel invitation', danger: true });
    if (!confirmed) return;
    try {
      await cancelTenantInvitation(idOf(row));
      setNotice('Invitation cancelled.');
      await reload();
    } catch (exception) {
      setError((exception as Error).message || 'The tenant contact could not be removed.');
    }
  }

  const holdersCount = counts.holders;
  const addedCount = counts.added;
  return <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 4 }}>
    <CompactPageToolbar title="Manage Tenants" description="Invite tenants, follow their verification, and open current tenancy records." actions={<Button onClick={openCreate} startIcon={<AddRounded />} variant="contained" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 500 }}>Add tenant</Button>} />
    <Stack spacing={2.25} sx={{ px: { xs: 1.25, md: 2.5 }, pt: 2 }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(3,minmax(0,1fr))' }, gap: 1.25 }}>
        {[
          ['All tenant records', counts.all, PersonRounded],
          ['Added by you', addedCount, AddRounded],
          ['Tenancy holders', holdersCount, ApartmentRounded],
        ].map(([label, count, Icon]: any) => <Card key={label} variant="outlined" sx={{ borderRadius: 2.5, borderColor: 'rgba(11,82,112,.14)', background: 'linear-gradient(145deg,#fff,#f7fbfc)' }}>
          <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between"><Box><Typography color="text.secondary" fontSize={11} fontWeight={500}>{label}</Typography><Typography fontSize={{ xs: 22, sm: 25 }} fontWeight={500}>{count}</Typography></Box><Avatar sx={{ width: 35, height: 35, bgcolor: '#e8f4f7', color: '#0b5270' }}><Icon sx={{ fontSize: 19 }} /></Avatar></Stack>
          </CardContent>
        </Card>)}
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Tabs value={filter} onChange={(_, next) => { setFilter(next); setPage(1); }} variant="scrollable" allowScrollButtonsMobile sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 700, px: 1.5 } }}>
          <Tab value="all" label="All" />
          <Tab value="added" label="Added by you" />
          <Tab value="holders" label="Tenancy holders" />
        </Tabs>
        <TextField size="small" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tenants or property" sx={{ width: { xs: '100%', sm: 290 }, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
      </Stack>
      {loading ? <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}><CircularProgress size={28} /></Box>
        : visibleRows.length === 0 ? <Card variant="outlined" sx={{ borderRadius: 3, textAlign: 'center', py: 5, borderColor: 'rgba(11,82,112,.14)' }}><PersonRounded sx={{ color: '#76939d', fontSize: 34 }} /><Typography fontWeight={800} sx={{ mt: 1 }}>No tenants in this view</Typography><Typography color="text.secondary" fontSize={13} sx={{ mt: .5 }}>Add a tenant to prepare a secure WhatsApp invitation.</Typography><Button onClick={openCreate} startIcon={<AddRounded />} sx={{ mt: 1.5, textTransform: 'none' }}>Add tenant</Button></Card>
          : <Stack spacing={1.1}>{visibleRows.map((row) => {
            const property = typeof row.property === 'object' ? row.property : properties.find((item) => idOf(item) === idOf(row.property));
            const name = display(row.name || row.user?.name, 'Tenant');
            const isOwnerContact = idOf(row.createdBy) === idOf(user?._id);
            const kyc = row.user?.kycStatus || row.kycStatus;
            const registered = Boolean(row.user || row.invitationStatus === 'registered');
            return <Card key={row._id} variant="outlined" sx={{ borderRadius: 2.5, borderColor: 'rgba(11,82,112,.15)', overflow: 'hidden', transition: 'box-shadow .16s, transform .16s', '&:hover': { boxShadow: '0 9px 26px rgba(11,82,112,.09)', transform: 'translateY(-1px)' } }}>
              <CardContent sx={{ p: { xs: 1.25, sm: 1.6 }, '&:last-child': { pb: { xs: 1.25, sm: 1.6 } } }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                  <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: { md: 230 }, flex: 1 }}>
                    <Avatar src={photoOf(row.user)} sx={{ width: 42, height: 42, bgcolor: '#e7f3f6', color: '#0b5270' }}>{name.slice(0, 1).toUpperCase()}</Avatar>
                    <Box sx={{ minWidth: 0 }}><Typography noWrap fontSize={14} fontWeight={800}>{name}</Typography><Typography noWrap color="text.secondary" fontSize={11}>{display(row.email || row.user?.email, 'Email not added')}</Typography><Typography color="text.secondary" fontSize={11}>{display(row.phone || row.user?.phone, 'Mobile not added')}</Typography></Box>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                    <Box component="img" src={propertyPhoto(property)} alt="" sx={{ display: propertyPhoto(property) ? 'block' : 'none', width: 58, height: 48, objectFit: 'cover', borderRadius: 1 }} />
                    <Box sx={{ minWidth: 0 }}><Typography noWrap fontSize={12.5} fontWeight={750}>{display(property?.title, 'Property')}</Typography><Typography noWrap color="text.secondary" fontSize={11}>{display(row.unitName, row.isTenancyHolder ? 'Current tenancy' : 'No room assigned')}</Typography></Box>
                  </Stack>
                  <Stack direction="row" spacing={.6} useFlexGap flexWrap="wrap" sx={{ minWidth: { md: 155 } }}>
                    <Chip size="small" label={registered ? 'Account linked' : row.invitationStatus === 'pending' ? 'Invitation ready' : prettyStatus(row.invitationStatus || 'not_sent')} color={registered ? 'success' : 'default'} variant="outlined" />
                    {registered && <Chip size="small" label={'KYC · ' + prettyStatus(kyc)} variant="outlined" color={kyc === 'verified' ? 'success' : 'warning'} />}
                  </Stack>
                  <Stack direction="row" spacing={.6} useFlexGap flexWrap="wrap" justifyContent={{ md: 'flex-end' }}>
                    {row.isTenancyHolder && (row.tenancies?.length ? row.tenancies : [{ _id: row.tenancyId }]).map((tenancy: RecordValue, index: number) => <Button key={tenancy._id} size="small" onClick={() => navigate('/app/tenancy_details/' + encodeURIComponent(tenancy._id))} endIcon={<OpenInNewRounded />} sx={{ textTransform: 'none', fontSize: 11 }}>Open tenancy{row.tenancies?.length > 1 ? ' ' + (index + 1) : ''}</Button>)}
                    {!registered && isOwnerContact && <Button size="small" onClick={() => void resend(row)} startIcon={<SendRounded />} sx={{ textTransform: 'none', fontSize: 11 }}>Resend invite</Button>}
                    {isOwnerContact && <Button size="small" onClick={() => openEdit(row)} startIcon={<EditRounded />} sx={{ textTransform: 'none', fontSize: 11 }}>Manage</Button>}
                    {isOwnerContact && !registered && <Button size="small" color="error" onClick={() => void remove(row)} startIcon={<DeleteOutlineRounded />} sx={{ textTransform: 'none', fontSize: 11 }}>Cancel invite</Button>}
                    {registered && (row.phone || row.user?.phone) && <Button size="small" href={'https://wa.me/91' + String(row.phone || row.user?.phone).replace(/\D/g, '').slice(-10)} target="_blank" rel="noreferrer" startIcon={<WhatsApp />} sx={{ textTransform: 'none', fontSize: 11 }}>WhatsApp</Button>}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>;
          })}</Stack>}
      {pages > 1 && <Pagination count={pages} page={Math.min(page, pages)} onChange={(_event, value) => setPage(value)} sx={{ alignSelf: 'center' }} />}
    </Stack>

    <ProfessionalDialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="sm" professionalTitle={editing ? 'Manage tenant' : 'Add tenant'} professionalSubtitle={editing ? 'Update the private unit details or notes for this tenant.' : 'The tenant creates their own password, verifies their mobile, and completes the standard KYC workflow.'} enableMinimize={false}>
      <Box component="form" onSubmit={submitForm}>
        <DialogContent><Stack spacing={1.35} sx={{ pt: .5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField required label="Tenant full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={Boolean(editing?.user)} />
          <TextField required type="email" label="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={Boolean(editing)} />
          <TextField required label="WhatsApp mobile number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/[^\d+]/g, '').slice(0, 14) })} helperText="Use the tenant’s own Indian mobile number. They will verify it with OTP." disabled={Boolean(editing)} />
          {!editing && <TextField select label="Property (optional)" value={form.property} onChange={(event) => setForm({ ...form, property: event.target.value })}><MenuItem value="">Assign later</MenuItem>{properties.map((property) => <MenuItem key={property._id} value={property._id}>{property.title || property.code || 'Property'}</MenuItem>)}</TextField>}
          <TextField label="Room or unit (optional)" value={form.unitName} onChange={(event) => setForm({ ...form, unitName: event.target.value })} />
          {editing && <TextField label="Private landlord notes" multiline minRows={2} value={form.privateNotes} onChange={(event) => setForm({ ...form, privateNotes: event.target.value })} helperText="Only you can view these notes." />}
          {!editing && <TextField label="Private landlord notes (optional)" multiline minRows={2} value={form.privateNotes} onChange={(event) => setForm({ ...form, privateNotes: event.target.value })} helperText="Only you can view these notes." />}
          {editing && <Alert severity="info">Contact details are locked after an invitation is issued so the account is always matched to the verified email and mobile.</Alert>}
        </Stack></DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}><Button onClick={() => setFormOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button><Button type="submit" variant="contained" disabled={saving} sx={{ textTransform: 'none', borderRadius: 2 }}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create invite'}</Button></DialogActions>
      </Box>
    </ProfessionalDialog>

    <ProfessionalDialog open={Boolean(shareInvite)} onClose={() => setShareInvite(null)} fullWidth maxWidth="sm" professionalTitle="Send tenant invitation" professionalSubtitle="Share this private, single-use registration link in the tenant’s WhatsApp chat." enableMinimize={false}>
      <DialogContent><Stack spacing={1.4} sx={{ pt: .5 }}><Alert severity="success">The invitation expires in seven days. The tenant sets their password, completes mobile OTP verification, then submits KYC through the standard tenant workflow.</Alert><TextField fullWidth size="small" label="Secure invitation link" value={shareInvite?.inviteUrl || ''} InputProps={{ readOnly: true }} /><Typography variant="caption" color="text.secondary">The tenant must use the invited email and mobile number. After verification, their account will be linked to this tenant record.</Typography></Stack></DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}><Button onClick={() => setShareInvite(null)} sx={{ textTransform: 'none' }}>Close</Button><Button onClick={() => void copyInvite()} startIcon={<ContentCopyRounded />} sx={{ textTransform: 'none' }}>Copy link</Button><Button onClick={() => openWhatsApp(shareInvite || {})} variant="contained" startIcon={<WhatsApp />} sx={{ textTransform: 'none', borderRadius: 2 }}>Open WhatsApp</Button></DialogActions>
    </ProfessionalDialog>
    {actions.dialogs}
    <Snackbar open={Boolean(notice)} autoHideDuration={3600} onClose={() => setNotice('')} message={notice} />
  </Box>;
}
