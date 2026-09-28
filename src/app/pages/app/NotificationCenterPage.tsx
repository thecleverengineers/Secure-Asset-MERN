import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert, Avatar, Badge, Box, Button, Card, Checkbox, DialogActions, DialogContent, Divider,
  FormControlLabel, IconButton, Menu, MenuItem, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import ApartmentRounded from '@mui/icons-material/ApartmentRounded';
import AssignmentRounded from '@mui/icons-material/AssignmentRounded';
import BuildRounded from '@mui/icons-material/BuildRounded';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import DoneAllRounded from '@mui/icons-material/DoneAllRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import GavelRounded from '@mui/icons-material/GavelRounded';
import HomeWorkRounded from '@mui/icons-material/HomeWorkRounded';
import MailRounded from '@mui/icons-material/MailRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import NotificationsRounded from '@mui/icons-material/NotificationsRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import {
  deleteNotification,
  getNotificationPreferences,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../../services/api';
import { useRealtime } from '../../context/RealtimeContext';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';

type NotificationFilter = 'all' | 'unread' | 'property' | 'tenancy' | 'finance' | 'approvals' | 'system';
type Feedback = { severity: 'success' | 'error'; text: string } | null;

const channels = ['inApp', 'email', 'sms', 'whatsapp', 'push'];
const filterLabels: Record<NotificationFilter, string> = {
  all: 'All',
  unread: 'Unread',
  property: 'Property',
  tenancy: 'Tenancy',
  finance: 'Finance',
  approvals: 'Approvals',
  system: 'System',
};

const categoryPresentation: Record<string, { color: string; bg: string; icon: any }> = {
  payment: { color: '#16A55F', bg: '#DFF7E9', icon: PaymentsRounded },
  survey: { color: '#F28A18', bg: '#FFF0D8', icon: AssignmentRounded },
  complaint: { color: '#EC4B78', bg: '#FFE3EC', icon: NotificationsRounded },
  lease: { color: '#7C3AED', bg: '#F0E6FF', icon: GavelRounded },
  maintenance: { color: '#53697A', bg: '#EAF1F5', icon: BuildRounded },
  message: { color: '#1675E0', bg: '#E1F0FF', icon: MailRounded },
  system: { color: '#1675E0', bg: '#E1F0FF', icon: WorkspacePremiumRounded },
};

function relativeTime(value: unknown) {
  const createdAt = new Date(String(value || ''));
  if (Number.isNaN(createdAt.getTime())) return 'Just now';
  const elapsed = Math.max(0, Date.now() - createdAt.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

function formattedDate(value: unknown) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function internalActionPath(value: unknown) {
  const path = String(value || '').trim();
  return path.startsWith('/') && !path.startsWith('//') ? path : '';
}

function groupFor(item: any): Exclude<NotificationFilter, 'all' | 'unread'> {
  const category = String(item?.category || '').toLowerCase();
  const text = `${item?.title || ''} ${item?.message || ''} ${item?.actionUrl || ''}`.toLowerCase();
  if (category === 'payment' || /payment|rent|invoice|deposit|billing|transaction/.test(text)) return 'finance';
  if (category === 'lease' || /tenancy|tenant|agreement|lease|occupancy|rent reminder/.test(text)) return 'tenancy';
  if (/approval|application|kyc|verified|verification|review|accepted|rejected/.test(text)) return 'approvals';
  if (category === 'survey' || category === 'maintenance' || /property|survey|room|listing|maintenance/.test(text)) return 'property';
  return 'system';
}

function presentationFor(item: any) {
  const category = String(item?.category || 'system').toLowerCase();
  if (/application/.test(String(item?.title || '').toLowerCase())) return { color: '#12A8C3', bg: '#DCF7FB', icon: DescriptionRounded };
  if (/kyc|verified|verification/.test(String(item?.title || '').toLowerCase())) return { color: '#12964C', bg: '#DFF6E7', icon: VerifiedUserRounded };
  return categoryPresentation[category] || categoryPresentation.system;
}

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const { subscribe } = useRealtime();
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [selectedId, setSelectedId] = useState('');
  const [preferences, setPreferences] = useState<any>({ channels: {}, categories: {}, quietHours: {} });
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loading, setLoading] = useState(false);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuId, setRowMenuId] = useState('');
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [notifications, prefs] = await Promise.all([
        getNotifications({ limit: 100 }),
        getNotificationPreferences(),
      ]);
      const nextRows = notifications.data || [];
      setRows(nextRows);
      setPreferences(prefs.data || { channels: {}, categories: {}, quietHours: {} });
      setSelectedId((current) => current && nextRows.some((item: any) => item._id === current) ? current : (nextRows[0]?._id || ''));
    } catch (error) {
      setFeedback({ severity: 'error', text: (error as Error).message || 'Notifications could not be loaded.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => subscribe('notification:new', (payload: any) => {
    setRows((current) => current.some((item) => item._id === payload._id) ? current : [payload, ...current]);
    setSelectedId((current) => current || payload._id);
  }), [subscribe]);

  const unread = useMemo(() => rows.filter((item) => !item.readAt).length, [rows]);
  const counts = useMemo(() => {
    const result: Record<NotificationFilter, number> = { all: rows.length, unread, property: 0, tenancy: 0, finance: 0, approvals: 0, system: 0 };
    rows.forEach((item) => { result[groupFor(item)] += 1; });
    return result;
  }, [rows, unread]);

  const visibleRows = useMemo(() => rows.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !item.readAt;
    return groupFor(item) === filter;
  }), [rows, filter]);

  useEffect(() => {
    if (!visibleRows.length) { setSelectedId(''); return; }
    if (!visibleRows.some((item) => item._id === selectedId)) setSelectedId(visibleRows[0]._id);
  }, [visibleRows, selectedId]);

  const selected = useMemo(
    () => rows.find((item) => item._id === selectedId) || visibleRows[0] || null,
    [rows, selectedId, visibleRows],
  );

  async function markRead(id: string) {
    try {
      await markNotificationRead(id);
      setRows((current) => current.map((item) => item._id === id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item));
    } catch (error) {
      setFeedback({ severity: 'error', text: (error as Error).message || 'Notification could not be marked as read.' });
    }
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
    } catch (error) {
      setFeedback({ severity: 'error', text: (error as Error).message || 'Notifications could not be marked as read.' });
    }
  }

  async function removeNotification(id: string) {
    try {
      await deleteNotification(id);
      setRows((current) => current.filter((item) => item._id !== id));
      setRowMenuAnchor(null);
      setRowMenuId('');
    } catch (error) {
      setFeedback({ severity: 'error', text: (error as Error).message || 'Notification could not be removed.' });
    }
  }

  async function savePreferences() {
    try {
      const result = await updateNotificationPreferences(preferences);
      setPreferences(result.data || preferences);
      setPreferencesOpen(false);
      setFeedback({ severity: 'success', text: result.message || 'Notification preferences saved.' });
    } catch (error) {
      setFeedback({ severity: 'error', text: (error as Error).message || 'Notification preferences could not be saved.' });
    }
  }

  const selectedPresentation = selected ? presentationFor(selected) : categoryPresentation.system;
  const SelectedIcon = selectedPresentation.icon;
  const selectedAction = selected ? internalActionPath(selected.actionUrl) : '';

  return <Box
    data-secureasset-notification-center="premium-reference-v161"
    sx={{ width: '100%', maxWidth: 1320, mx: 'auto', px: { xs: 1.1, sm: 2, lg: 2.5 }, pb: { xs: 11, md: 5 }, fontFamily: '"Open Sans", sans-serif' }}
  >
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: { xs: 154, md: 174 },
        borderRadius: { xs: '18px', md: '20px' },
        border: '1px solid rgba(24,91,124,.16)',
        background: 'linear-gradient(112deg,#062F52 0%,#0A5676 50%,#064B65 100%)',
        boxShadow: '0 18px 44px rgba(8,49,76,.16)',
        mb: 1.7,
      }}
    >
      <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 78% 38%, rgba(54,166,229,.28), transparent 24%), radial-gradient(circle at 65% 110%, rgba(44,190,213,.20), transparent 38%)' }} />
      <Box sx={{ position: 'absolute', right: { xs: -20, sm: 80, md: 150 }, top: { xs: 16, md: 18 }, opacity: .95 }}>
        <Badge badgeContent={unread} color="error" max={99} sx={{ '& .MuiBadge-badge': { top: 8, right: 7, fontSize: 12, minWidth: 28, height: 28, borderRadius: '14px', fontWeight: 800, border: '2px solid rgba(255,255,255,.85)' } }}>
          <Box sx={{ width: { xs: 92, md: 122 }, height: { xs: 92, md: 122 }, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#DDF4FF', background: 'radial-gradient(circle, rgba(91,192,255,.32), rgba(16,91,134,.04) 68%, transparent 70%)', filter: 'drop-shadow(0 14px 18px rgba(0,18,38,.28))' }}>
            <NotificationsRounded sx={{ fontSize: { xs: 62, md: 82 } }} />
          </Box>
        </Badge>
      </Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ position: 'relative', px: { xs: 2, sm: 2.6, md: 3.1 }, py: { xs: 2.1, md: 2.7 }, minHeight: { xs: 154, md: 174 } }}>
        <Box sx={{ maxWidth: { xs: '75%', sm: 520 } }}>
          <Typography sx={{ color: '#fff', fontSize: { xs: 24, md: 30 }, fontWeight: 800, letterSpacing: '-.02em' }}>Notifications</Typography>
          <Typography sx={{ mt: .7, color: 'rgba(255,255,255,.82)', fontSize: { xs: 11.5, md: 13 }, lineHeight: 1.55, maxWidth: 480 }}>Stay updated with important activities, approvals and updates across your SecureAsset workspace.</Typography>
        </Box>
        <Box sx={{ display: { xs: 'none', md: 'block' }, width: 180, color: '#fff', mr: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.5 }}>Real-time Updates<br />for a Safer<br />Property Ecosystem</Typography>
          <Box sx={{ mt: 1.1, width: 30, height: 2, bgcolor: 'rgba(255,255,255,.6)' }} />
        </Box>
      </Stack>
    </Box>

    <Stack direction="row" spacing={.8} sx={{ overflowX: 'auto', pb: .8, mb: .5, px: .1, '&::-webkit-scrollbar': { height: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(21,99,138,.18)', borderRadius: 99 } }}>
      {(Object.keys(filterLabels) as NotificationFilter[]).map((key) => (
        <Button
          key={key}
          onClick={() => setFilter(key)}
          startIcon={key === 'all' ? <NotificationsRounded /> : key === 'unread' ? <MailRounded /> : key === 'property' ? <HomeWorkRounded /> : key === 'tenancy' ? <ApartmentRounded /> : key === 'finance' ? <PaymentsRounded /> : key === 'approvals' ? <FactCheckRounded /> : <SettingsRounded />}
          sx={{
            minWidth: 'max-content',
            height: 40,
            px: 1.35,
            borderRadius: '11px',
            border: '1px solid',
            borderColor: filter === key ? '#0E628D' : '#DCE8EF',
            bgcolor: filter === key ? '#0E628D' : '#F9FCFD',
            color: filter === key ? '#fff' : '#496579',
            textTransform: 'none',
            fontSize: 10.5,
            fontWeight: 700,
            boxShadow: filter === key ? '0 8px 18px rgba(14,98,141,.18)' : 'none',
            '&:hover': { bgcolor: filter === key ? '#0B567D' : '#F1F7FA' },
            '& .MuiButton-startIcon': { mr: .55, '& svg': { fontSize: 15 } },
          }}
        >
          {filterLabels[key]}
          <Box component="span" sx={{ ml: .65, minWidth: 20, height: 20, px: .45, display: 'grid', placeItems: 'center', borderRadius: '10px', bgcolor: filter === key ? 'rgba(255,255,255,.92)' : '#EAF1F5', color: filter === key ? '#0E628D' : '#7C8D99', fontSize: 9.5, fontWeight: 800 }}>{counts[key]}</Box>
        </Button>
      ))}
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Refresh"><span><IconButton onClick={() => void load()} disabled={loading} sx={{ flexShrink: 0, width: 40, height: 40, borderRadius: '11px', border: '1px solid #DCE8EF', bgcolor: '#fff' }}><RefreshRounded sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
      <Tooltip title="Notification preferences"><IconButton onClick={() => setPreferencesOpen(true)} sx={{ flexShrink: 0, width: 40, height: 40, borderRadius: '11px', border: '1px solid #DCE8EF', bgcolor: '#fff' }}><TuneRounded sx={{ fontSize: 18 }} /></IconButton></Tooltip>
    </Stack>

    {feedback && <Alert severity={feedback.severity} onClose={() => setFeedback(null)} sx={{ mb: 1.2, borderRadius: '12px', fontSize: 12 }}>{feedback.text}</Alert>}

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.65fr) minmax(300px, .72fr)' }, gap: 1.5 }}>
      <Card elevation={0} sx={{ border: '1px solid #DFE9EF', borderRadius: '18px', boxShadow: '0 14px 34px rgba(19,62,88,.07)', overflow: 'hidden', bgcolor: '#fff' }}>
        <Stack divider={<Divider flexItem sx={{ ml: { xs: 7.5, sm: 8.5 } }} />}>
          {visibleRows.map((item) => {
            const presentation = presentationFor(item);
            const Icon = presentation.icon;
            const actionPath = internalActionPath(item.actionUrl);
            const active = selected?._id === item._id;
            return <Box
              key={item._id}
              onClick={() => {
                setSelectedId(item._id);
                if (!item.readAt) void markRead(item._id);
              }}
              sx={{
                position: 'relative',
                px: { xs: 1.2, sm: 1.7 },
                py: { xs: 1.35, sm: 1.5 },
                cursor: 'pointer',
                bgcolor: active ? '#F0F7FF' : '#fff',
                transition: 'background-color .18s ease',
                '&:hover': { bgcolor: active ? '#EEF7FF' : '#FAFCFD' },
                ...(active ? { '&:before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, bgcolor: '#1675E0' } } : {}),
              }}
            >
              <Stack direction="row" alignItems="center" gap={{ xs: 1.05, sm: 1.35 }}>
                <Avatar sx={{ width: { xs: 42, sm: 47 }, height: { xs: 42, sm: 47 }, bgcolor: presentation.bg, color: presentation.color }}><Icon sx={{ fontSize: { xs: 21, sm: 24 } }} /></Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" alignItems="center" gap={.65}>
                    <Typography noWrap sx={{ minWidth: 0, color: '#10283C', fontSize: { xs: 12.5, sm: 13.4 }, fontWeight: 800 }}>{item.title || 'Workspace notification'}</Typography>
                    {!item.readAt && <Box sx={{ flexShrink: 0, px: .55, py: .12, borderRadius: '7px', bgcolor: '#FF3864', color: '#fff', fontSize: 7.8, fontWeight: 800, lineHeight: 1.55 }}>New</Box>}
                  </Stack>
                  <Typography sx={{ mt: .38, color: '#4E687A', fontSize: { xs: 10.2, sm: 11 }, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.message || 'Open this notification to review the latest workspace update.'}</Typography>
                </Box>
                <Stack alignItems="flex-end" spacing={.35} sx={{ flexShrink: 0, pl: .2 }}>
                  <Typography sx={{ color: '#698091', fontSize: { xs: 8.8, sm: 9.8 }, whiteSpace: 'nowrap' }}>{relativeTime(item.createdAt)}</Typography>
                  <Stack direction="row" alignItems="center" spacing={.2}>
                    {!item.readAt && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#1675E0' }} />}
                    {actionPath && <IconButton aria-label="Open notification" size="small" onClick={(event) => { event.stopPropagation(); void openNotification(item); }} sx={{ width: 25, height: 25 }}><ChevronRightRounded sx={{ fontSize: 18 }} /></IconButton>}
                    <IconButton aria-label="Notification actions" size="small" onClick={(event) => { event.stopPropagation(); setRowMenuAnchor(event.currentTarget); setRowMenuId(item._id); }} sx={{ width: 25, height: 25 }}><MoreVertRounded sx={{ fontSize: 17 }} /></IconButton>
                  </Stack>
                </Stack>
              </Stack>
            </Box>;
          })}
          {!visibleRows.length && <Box sx={{ py: 8, px: 2, textAlign: 'center' }}>
            <Box sx={{ width: 58, height: 58, mx: 'auto', borderRadius: '50%', bgcolor: '#EAF4FB', color: '#0E628D', display: 'grid', placeItems: 'center' }}><NotificationsRounded /></Box>
            <Typography sx={{ mt: 1.2, color: '#10283C', fontSize: 14, fontWeight: 800 }}>{filter === 'unread' ? 'You are all caught up' : 'No notifications in this view'}</Typography>
            <Typography sx={{ mt: .45, color: '#768A98', fontSize: 10.5 }}>New workspace activity will appear here automatically.</Typography>
          </Box>}
        </Stack>
      </Card>

      <Card elevation={0} sx={{ display: { xs: 'none', lg: 'block' }, border: '1px solid #DFE9EF', borderRadius: '18px', boxShadow: '0 14px 34px rgba(19,62,88,.07)', bgcolor: '#fff', minHeight: 520 }}>
        {selected ? <Box sx={{ p: 2.1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Avatar sx={{ width: 52, height: 52, bgcolor: selectedPresentation.bg, color: selectedPresentation.color, borderRadius: '14px' }}><SelectedIcon sx={{ fontSize: 26 }} /></Avatar>
            <Typography sx={{ color: '#6E8290', fontSize: 9.8 }}>{relativeTime(selected.createdAt)}</Typography>
          </Stack>
          <Typography sx={{ mt: 1.65, color: '#0F273B', fontSize: 18, lineHeight: 1.25, fontWeight: 800 }}>{selected.title || 'Workspace notification'}</Typography>
          <Typography sx={{ mt: .8, color: '#5D7484', fontSize: 11.3, lineHeight: 1.55 }}>{selected.message || 'Open the related workspace item for more information.'}</Typography>

          <Box sx={{ mt: 2, p: 1.25, borderRadius: '13px', border: '1px solid #E2ECF1', bgcolor: '#F8FBFC' }}>
            <Stack direction="row" spacing={1.05} alignItems="center">
              <Box sx={{ width: 54, height: 54, borderRadius: '11px', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#0E638D,#2CA5C2)', color: '#fff' }}><HomeWorkRounded sx={{ fontSize: 28 }} /></Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: '#10283C', fontSize: 12.2, fontWeight: 800 }}>{groupFor(selected) === 'approvals' ? 'Approval workspace' : groupFor(selected) === 'finance' ? 'Finance workspace' : groupFor(selected) === 'tenancy' ? 'Tenancy workspace' : groupFor(selected) === 'property' ? 'Property workspace' : 'SecureAsset workspace'}</Typography>
                <Typography noWrap sx={{ mt: .25, color: '#6D8392', fontSize: 9.6 }}>{selectedAction || 'Account activity'}</Typography>
              </Box>
            </Stack>
          </Box>

          <Typography sx={{ mt: 2.1, mb: .8, color: '#10283C', fontSize: 12.5, fontWeight: 800 }}>Notification Details</Typography>
          <Stack divider={<Divider flexItem />}>
            <Stack direction="row" spacing={1.1} alignItems="center" sx={{ py: 1.05 }}><Avatar sx={{ width: 34, height: 34, bgcolor: '#EFF5F9', color: '#537184' }}><DescriptionRounded sx={{ fontSize: 18 }} /></Avatar><Box><Typography sx={{ color: '#6D8392', fontSize: 9.2 }}>Category</Typography><Typography sx={{ color: '#10283C', fontSize: 11.2, fontWeight: 700 }}>{filterLabels[groupFor(selected)]}</Typography></Box></Stack>
            <Stack direction="row" spacing={1.1} alignItems="center" sx={{ py: 1.05 }}><Avatar sx={{ width: 34, height: 34, bgcolor: '#EFF5F9', color: '#537184' }}><SecurityRounded sx={{ fontSize: 18 }} /></Avatar><Box><Typography sx={{ color: '#6D8392', fontSize: 9.2 }}>Status</Typography><Typography sx={{ color: '#10283C', fontSize: 11.2, fontWeight: 700 }}>{selected.readAt ? 'Read' : 'Unread'}</Typography></Box></Stack>
            <Stack direction="row" spacing={1.1} alignItems="center" sx={{ py: 1.05 }}><Avatar sx={{ width: 34, height: 34, bgcolor: '#EFF5F9', color: '#537184' }}><AssignmentRounded sx={{ fontSize: 18 }} /></Avatar><Box><Typography sx={{ color: '#6D8392', fontSize: 9.2 }}>Received</Typography><Typography sx={{ color: '#10283C', fontSize: 11.2, fontWeight: 700 }}>{formattedDate(selected.createdAt)}</Typography></Box></Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2.2 }}>
            {!selected.readAt && <Button fullWidth variant="outlined" onClick={() => void markRead(selected._id)} sx={{ borderRadius: '10px', textTransform: 'none', fontSize: 10.5, fontWeight: 700 }}>Mark as Read</Button>}
            {selectedAction && <Button fullWidth variant="contained" onClick={() => void openNotification(selected)} sx={{ borderRadius: '10px', textTransform: 'none', fontSize: 10.5, fontWeight: 700, boxShadow: 'none', background: 'linear-gradient(90deg,#064F76,#0F789D)' }}>View Details</Button>}
          </Stack>
        </Box> : <Box sx={{ minHeight: 500, display: 'grid', placeItems: 'center', p: 3, textAlign: 'center' }}><Box><NotificationsRounded sx={{ fontSize: 45, color: '#AEC3CF' }} /><Typography sx={{ mt: 1, color: '#10283C', fontWeight: 800 }}>Select a notification</Typography><Typography sx={{ mt: .4, color: '#7C8F9B', fontSize: 10.5 }}>Its details will appear here.</Typography></Box></Box>}
      </Card>
    </Box>

    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mt: 1.3 }}>
      <Typography sx={{ color: '#7A8D99', fontSize: 9.8 }}>{unread ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'All notifications are read'}</Typography>
      <Button onClick={() => void markAllRead()} disabled={!unread || loading} startIcon={<DoneAllRounded />} sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' }, textTransform: 'none', fontSize: 10.2, fontWeight: 700 }}>Mark all as read</Button>
    </Stack>

    <Menu anchorEl={rowMenuAnchor} open={Boolean(rowMenuAnchor)} onClose={() => { setRowMenuAnchor(null); setRowMenuId(''); }} PaperProps={{ sx: { minWidth: 180, mt: .4, borderRadius: '12px', border: '1px solid #DFE9EF', boxShadow: '0 12px 28px rgba(14,52,78,.14)' } }}>
      {rowMenuId && !rows.find((item) => item._id === rowMenuId)?.readAt && <MenuItem onClick={() => { void markRead(rowMenuId); setRowMenuAnchor(null); setRowMenuId(''); }} sx={{ fontSize: 11.5 }}><CheckCircleOutlineRounded sx={{ mr: 1, fontSize: 18 }} />Mark as read</MenuItem>}
      <MenuItem onClick={() => void removeNotification(rowMenuId)} sx={{ fontSize: 11.5, color: 'error.main' }}><DeleteOutlineRounded sx={{ mr: 1, fontSize: 18 }} />Delete notification</MenuItem>
    </Menu>

    <ProfessionalDialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)} fullWidth maxWidth="sm" enableMinimize={false} enableMaximize={false} professionalTitle="Notification preferences" professionalSubtitle="Choose how SecureAsset reaches you.">
      <DialogContent dividers sx={{ py: 2 }}>
        <Stack spacing={1.45}>
          <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>In-app notifications always remain available in this centre. Configure additional channels and quiet hours below.</Typography>
          <Box>
            <Typography sx={{ color: '#142A35', fontSize: 12.5, fontWeight: 800 }}>Delivery channels</Typography>
            <Box sx={{ mt: .45, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' } }}>
              {channels.map((key) => <FormControlLabel key={key} sx={{ m: 0 }} control={<Checkbox size="small" checked={preferences.channels?.[key] ?? key === 'inApp'} onChange={(event) => setPreferences((current: any) => ({ ...current, channels: { ...current.channels, [key]: event.target.checked } }))} />} label={<Typography sx={{ fontSize: 11.5 }}>{key.replace(/([A-Z])/g, ' $1')}</Typography>} />)}
            </Box>
          </Box>
          <Divider />
          <Box>
            <Typography sx={{ color: '#142A35', fontSize: 12.5, fontWeight: 800 }}>Quiet hours</Typography>
            <FormControlLabel sx={{ mt: .35, ml: 0 }} control={<Switch size="small" checked={Boolean(preferences.quietHours?.enabled)} onChange={(event) => setPreferences((current: any) => ({ ...current, quietHours: { ...current.quietHours, enabled: event.target.checked } }))} />} label={<Typography sx={{ fontSize: 11.5 }}>Pause delivery outside the app</Typography>} />
            <Stack direction="row" spacing={1} sx={{ mt: .45 }}>
              <TextField size="small" fullWidth label="Start" type="time" InputLabelProps={{ shrink: true }} value={preferences.quietHours?.start || '22:00'} onChange={(event) => setPreferences((current: any) => ({ ...current, quietHours: { ...current.quietHours, start: event.target.value } }))} />
              <TextField size="small" fullWidth label="End" type="time" InputLabelProps={{ shrink: true }} value={preferences.quietHours?.end || '07:00'} onChange={(event) => setPreferences((current: any) => ({ ...current, quietHours: { ...current.quietHours, end: event.target.value } }))} />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.35 }}>
        <Button onClick={() => setPreferencesOpen(false)}>Cancel</Button>
        <Button variant="contained" onClick={() => void savePreferences()}>Save preferences</Button>
      </DialogActions>
    </ProfessionalDialog>
  </Box>;
}
