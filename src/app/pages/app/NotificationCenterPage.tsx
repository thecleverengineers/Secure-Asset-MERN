import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Avatar, Box, Button, Card, Checkbox, DialogActions, DialogContent, Divider, FormControlLabel, IconButton, Menu, MenuItem, Paper, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import BuildRounded from '@mui/icons-material/BuildRounded';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DoneAllRounded from '@mui/icons-material/DoneAllRounded';
import GavelRounded from '@mui/icons-material/GavelRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import MailRounded from '@mui/icons-material/MailRounded';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import TravelExploreRounded from '@mui/icons-material/TravelExploreRounded';
import { deleteNotification, getNotificationPreferences, getNotifications, markAllNotificationsRead, markNotificationRead, updateNotificationPreferences } from '../../services/api';
import { useRealtime } from '../../context/RealtimeContext';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';

type NotificationTab = 'inbox' | 'archived';
type Feedback = { severity: 'success' | 'error'; text: string } | null;

const categories = ['all', 'payment', 'survey', 'complaint', 'lease', 'maintenance', 'message', 'system'];
const channels = ['inApp', 'email', 'sms', 'whatsapp', 'push'];
const categoryPresentation: Record<string, { label: string; color: string; icon: any }> = {
  payment: { label: 'Payments', color: '#0B6E96', icon: PaymentsRounded },
  survey: { label: 'Survey', color: '#7A5C16', icon: TravelExploreRounded },
  complaint: { label: 'Support', color: '#B44747', icon: MailRounded },
  lease: { label: 'Lease', color: '#586D38', icon: GavelRounded },
  maintenance: { label: 'Maintenance', color: '#9A5B16', icon: BuildRounded },
  message: { label: 'Message', color: '#7657A8', icon: MailRounded },
  system: { label: 'Workspace', color: '#4D6470', icon: HomeWorkRounded },
};

function relativeTime(value: unknown) {
  const createdAt = new Date(String(value || ''));
  if (Number.isNaN(createdAt.getTime())) return 'Just now';
  const elapsed = Math.max(0, Date.now() - createdAt.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function internalActionPath(value: unknown) {
  const path = String(value || '').trim();
  return path.startsWith('/') && !path.startsWith('//') ? path : '';
}

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const { subscribe } = useRealtime();
  const [rows, setRows] = useState<any[]>([]);
  const [category, setCategory] = useState('all');
  const [tab, setTab] = useState<NotificationTab>('inbox');
  const [preferences, setPreferences] = useState<any>({ channels: {}, categories: {}, quietHours: {} });
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loading, setLoading] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [notifications, prefs] = await Promise.all([
        getNotifications({ limit: 100, category: category === 'all' ? '' : category }),
        getNotificationPreferences(),
      ]);
      setRows(notifications.data || []);
      setPreferences(prefs.data || { channels: {}, categories: {}, quietHours: {} });
    } catch (error) { setFeedback({ severity: 'error', text: (error as Error).message || 'Notifications could not be loaded.' }); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [category]);
  useEffect(() => subscribe('notification:new', (payload: any) => setRows((current) => current.some((item) => item._id === payload._id) ? current : [payload, ...current])), [subscribe]);

  const unread = useMemo(() => rows.filter((item) => !item.readAt).length, [rows]);
  const visibleRows = useMemo(() => rows.filter((item) => tab === 'archived' ? Boolean(item.readAt) : !item.readAt), [rows, tab]);

  async function markRead(id: string) {
    try {
      await markNotificationRead(id);
      setRows((current) => current.map((item) => item._id === id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item));
    } catch (error) { setFeedback({ severity: 'error', text: (error as Error).message || 'Notification could not be marked as read.' }); }
  }

  async function openNotification(item: any) {
    if (!item.readAt) await markRead(item._id);
    const path = internalActionPath(item.actionUrl);
    if (path) navigate(path);
  }

  async function markAllRead() {
    try {
      await markAllNotificationsRead();
      setRows((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setFeedback({ severity: 'success', text: 'All notifications are marked as read.' });
      setTab('archived');
    } catch (error) { setFeedback({ severity: 'error', text: (error as Error).message || 'Notifications could not be marked as read.' }); }
  }

  async function removeNotification(id: string) {
    try {
      await deleteNotification(id);
      setRows((current) => current.filter((item) => item._id !== id));
    } catch (error) { setFeedback({ severity: 'error', text: (error as Error).message || 'Notification could not be removed.' }); }
  }

  async function savePreferences() {
    try {
      const result = await updateNotificationPreferences(preferences);
      setPreferences(result.data || preferences);
      setPreferencesOpen(false);
      setFeedback({ severity: 'success', text: result.message || 'Notification preferences saved.' });
    } catch (error) { setFeedback({ severity: 'error', text: (error as Error).message || 'Notification preferences could not be saved.' }); }
  }

  return <Box data-secureasset-notification-center="reference-panel-v160" sx={{ maxWidth: 790, mx: 'auto', px: { xs: 1.1, sm: 2.25 }, pb: { xs: 10, md: 5 } }}>
    <Card elevation={0} sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: { xs: 3, sm: 4 }, boxShadow: '0 14px 32px rgba(11,82,112,.09)' }}>
      <Box sx={{ px: { xs: 1.45, sm: 2.15 }, pt: { xs: 1.35, sm: 1.7 }, pb: .85 }}>
        <Stack direction="row" alignItems="center" gap={.8}>
          <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ color: '#142A35', fontSize: { xs: 18, sm: 20 }, fontWeight: 800, lineHeight: 1.2 }}>Notifications</Typography><Typography color="text.secondary" sx={{ mt: .28, fontSize: 10.5 }}>Your account, property and workspace activity</Typography></Box>
          <Tooltip title="Refresh"><span><IconButton aria-label="Refresh notifications" size="small" onClick={() => void load()} disabled={loading}><RefreshRounded fontSize="small" /></IconButton></span></Tooltip>
          <Tooltip title="Notification preferences"><IconButton data-secureasset-notification-preferences="dialog-v160" aria-label="Open notification preferences" size="small" onClick={() => setPreferencesOpen(true)}><SettingsRounded fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Close notifications"><IconButton aria-label="Close notifications" size="small" onClick={() => navigate('/app/dashboard')}><ArrowBackRounded fontSize="small" /></IconButton></Tooltip>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 1.1, sm: 1.55 }, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" gap={.4}>
          <Tabs data-secureasset-notification-tabs="for-you-archived-v160" value={tab} onChange={(_, value) => setTab(value)} aria-label="Notification views" sx={{ minHeight: 42, flex: 1, '& .MuiTabs-indicator': { height: 2.5, borderRadius: 9, bgcolor: 'primary.main' }, '& .MuiTab-root': { minHeight: 42, minWidth: 0, px: { xs: .8, sm: 1.2 }, textTransform: 'none', fontSize: 11, fontWeight: 700 } }}>
            <Tab value="inbox" label={<Stack direction="row" alignItems="center" gap={.55}><span>For you</span>{unread > 0 && <Box component="span" sx={{ minWidth: 17, height: 17, px: .4, display: 'grid', placeItems: 'center', borderRadius: 9, bgcolor: 'rgba(11,82,112,.12)', color: 'primary.main', fontSize: 9, fontWeight: 800 }}>{unread}</Box>}</Stack>} />
            <Tab value="archived" label="Archived" />
          </Tabs>
          <Tooltip title="Filter category"><IconButton data-secureasset-notification-filter="category-menu-v160" aria-label="Filter notification category" size="small" onClick={(event) => setFilterAnchor(event.currentTarget)}><MoreHorizRounded fontSize="small" /></IconButton></Tooltip>
          <Button data-secureasset-notification-mark-all="functional-v160" size="small" onClick={() => void markAllRead()} disabled={!unread || loading} startIcon={<DoneAllRounded sx={{ fontSize: '15px !important' }} />} sx={{ flexShrink: 0, minWidth: 0, px: { xs: .65, sm: 1 }, fontSize: { xs: 9.5, sm: 10.5 }, fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}>Mark all as read</Button>
        </Stack>
      </Box>

      {feedback && <Alert severity={feedback.severity} onClose={() => setFeedback(null)} sx={{ mx: { xs: 1.1, sm: 1.55 }, mt: 1.1, borderRadius: 2.25, fontSize: 12 }}>{feedback.text}</Alert>}

      <Box data-secureasset-notification-list="compact-reference-cards-v160" sx={{ px: { xs: 1.1, sm: 1.55 }, py: { xs: 1, sm: 1.25 } }}>
        <Stack divider={<Divider flexItem />}>
          {visibleRows.map((item) => {
            const presentation = categoryPresentation[String(item.category || 'system')] || categoryPresentation.system;
            const Icon = presentation.icon;
            const actionPath = internalActionPath(item.actionUrl);
            return <Box data-secureasset-notification-card="actionable-v160" key={item._id} sx={{ py: { xs: 1.05, sm: 1.35 }, px: .2 }}>
              <Stack direction="row" alignItems="flex-start" gap={{ xs: .95, sm: 1.25 }}>
                <Avatar sx={{ width: { xs: 34, sm: 39 }, height: { xs: 34, sm: 39 }, mt: .12, bgcolor: `${presentation.color}16`, color: presentation.color }}><Icon sx={{ fontSize: { xs: 18, sm: 20 } }} /></Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={.8}><Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ color: '#162C37', fontSize: { xs: 12.2, sm: 13.2 }, lineHeight: 1.35, fontWeight: 800 }}>{item.title || 'Workspace notification'}</Typography><Stack direction="row" alignItems="center" gap={.55} sx={{ mt: .28 }}><Typography color="text.secondary" sx={{ fontSize: 9.2 }}>{relativeTime(item.createdAt)}</Typography><Box component="span" sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'divider' }} /><Typography sx={{ color: presentation.color, fontSize: 9.2, fontWeight: 700 }}>{presentation.label}</Typography></Stack></Box><Stack direction="row" sx={{ mt: -.5, mr: -.55 }}><Tooltip title={item.readAt ? 'Archived notification' : 'Mark as read'}><span>{!item.readAt && <IconButton aria-label="Mark notification as read" size="small" onClick={() => void markRead(item._id)}><CheckCircleOutlineRounded sx={{ fontSize: 17 }} /></IconButton>}</span></Tooltip><Tooltip title="Delete"><IconButton aria-label="Delete notification" size="small" onClick={() => void removeNotification(item._id)}><DeleteOutlineRounded sx={{ fontSize: 17 }} /></IconButton></Tooltip></Stack></Stack>
                  <Typography color="text.secondary" sx={{ mt: .72, fontSize: { xs: 10.7, sm: 11.5 }, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.message || 'Open this notification to review the related workspace update.'}</Typography>
                  {actionPath && <Paper variant="outlined" sx={{ mt: .85, px: .85, py: .65, borderRadius: 1.85, borderColor: 'rgba(11,82,112,.14)', bgcolor: 'rgba(11,82,112,.025)' }}><Stack direction="row" alignItems="center" justifyContent="space-between" gap={.8}><Typography noWrap sx={{ minWidth: 0, color: 'text.secondary', fontSize: 9.4 }}>Related workspace item</Typography><Button size="small" onClick={() => void openNotification(item)} endIcon={<OpenInNewRounded sx={{ fontSize: '13px !important' }} />} sx={{ minWidth: 0, flexShrink: 0, p: 0, color: 'primary.main', fontSize: 9.5, fontWeight: 800, textTransform: 'none' }}>Open</Button></Stack></Paper>}
                </Box>
              </Stack>
            </Box>;
          })}
          {!visibleRows.length && <Box data-secureasset-notification-empty="compact-v160" sx={{ py: { xs: 5, sm: 6 }, textAlign: 'center' }}><Box sx={{ width: 47, height: 47, mx: 'auto', display: 'grid', placeItems: 'center', borderRadius: '50%', bgcolor: 'rgba(11,82,112,.08)', color: 'primary.main' }}><NotificationsNoneRounded /></Box><Typography sx={{ mt: 1.15, color: '#162C37', fontSize: 13, fontWeight: 800 }}>{tab === 'archived' ? 'No archived notifications' : 'You are all caught up'}</Typography><Typography color="text.secondary" sx={{ mt: .45, fontSize: 10.5 }}>{tab === 'archived' ? 'Read notifications will stay here until you remove them.' : 'New account and property activity will appear here.'}</Typography></Box>}
        </Stack>
      </Box>
    </Card>

    <Menu anchorEl={filterAnchor} open={Boolean(filterAnchor)} onClose={() => setFilterAnchor(null)} PaperProps={{ sx: { minWidth: 180, border: '1px solid', borderColor: 'divider', borderRadius: 2.25, mt: .5 } }}>
      {categories.map((item) => <MenuItem key={item} selected={item === category} onClick={() => { setCategory(item); setFilterAnchor(null); }} sx={{ fontSize: 12 }}>{item === 'all' ? 'All activity' : categoryPresentation[item]?.label || item}</MenuItem>)}
    </Menu>

    <ProfessionalDialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)} fullWidth maxWidth="sm" enableMinimize={false} enableMaximize={false} professionalTitle="Notification preferences" professionalSubtitle="Choose how SecureAsset reaches you.">
      <DialogContent dividers sx={{ py: 2 }}>
        <Stack spacing={1.45}><Typography sx={{ color: 'text.secondary', fontSize: 12 }}>In-app notifications always remain available in this centre. Configure additional channels and quiet hours below.</Typography><Box><Typography sx={{ color: '#142A35', fontSize: 12.5, fontWeight: 800 }}>Delivery channels</Typography><Box sx={{ mt: .45, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' } }}>{channels.map((key) => <FormControlLabel key={key} sx={{ m: 0 }} control={<Checkbox size="small" checked={preferences.channels?.[key] ?? key === 'inApp'} onChange={(event) => setPreferences((current: any) => ({ ...current, channels: { ...current.channels, [key]: event.target.checked } }))} />} label={<Typography sx={{ fontSize: 11.5 }}>{key.replace(/([A-Z])/g, ' $1')}</Typography>} />)}</Box></Box><Divider /><Box><Typography sx={{ color: '#142A35', fontSize: 12.5, fontWeight: 800 }}>Quiet hours</Typography><FormControlLabel sx={{ mt: .35, ml: 0 }} control={<Switch size="small" checked={Boolean(preferences.quietHours?.enabled)} onChange={(event) => setPreferences((current: any) => ({ ...current, quietHours: { ...current.quietHours, enabled: event.target.checked } }))} />} label={<Typography sx={{ fontSize: 11.5 }}>Pause delivery outside the app</Typography>} /><Stack direction="row" spacing={1} sx={{ mt: .45 }}><TextField size="small" fullWidth label="Start" type="time" InputLabelProps={{ shrink: true }} value={preferences.quietHours?.start || '22:00'} onChange={(event) => setPreferences((current: any) => ({ ...current, quietHours: { ...current.quietHours, start: event.target.value } }))} /><TextField size="small" fullWidth label="End" type="time" InputLabelProps={{ shrink: true }} value={preferences.quietHours?.end || '07:00'} onChange={(event) => setPreferences((current: any) => ({ ...current, quietHours: { ...current.quietHours, end: event.target.value } }))} /></Stack></Box></Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.35 }}><Button onClick={() => setPreferencesOpen(false)}>Cancel</Button><Button variant="contained" onClick={() => void savePreferences()}>Save preferences</Button></DialogActions>
    </ProfessionalDialog>
  </Box>;
}
