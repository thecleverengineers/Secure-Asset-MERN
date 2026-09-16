import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Divider, IconButton, InputAdornment, LinearProgress, List,
  ListItemAvatar, ListItemButton, ListItemText, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ArchiveRounded from '@mui/icons-material/ArchiveRounded';
import AttachFileRounded from '@mui/icons-material/AttachFileRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import WifiOffRounded from '@mui/icons-material/WifiOffRounded';
import WifiRounded from '@mui/icons-material/WifiRounded';
import {
  archiveConversation, createConversation, downloadDriveFile, getConversationMessages, getConversations,
  getMessagingContacts, markConversationRead, sendConversationMessage, uploadDriveFile,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';

const formatBytes = (bytes = 0) => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

export default function MessagingPage() {
  const { user } = useAuth();
  const realtime = useRealtime();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [newRecipient, setNewRecipient] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notice, setNotice] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function loadConversations() {
    try {
      const response = await getConversations();
      setConversations(response.data || []);
      if (!activeId && response.data?.[0]?._id) setActiveId(response.data[0]._id);
    } catch (error) { setNotice((error as Error).message); }
  }
  async function loadContacts() {
    try { setContacts((await getMessagingContacts()).data || []); }
    catch (error) { setNotice((error as Error).message); }
  }
  async function loadMessages(id: string) {
    if (!id) return;
    try {
      const response = await getConversationMessages(id, { limit: 100 });
      setMessages(response.data || []);
      await markConversationRead(id);
      setConversations((current) => current.map((row) => row._id === id ? { ...row, unreadCount: 0 } : row));
    } catch (error) { setNotice((error as Error).message); }
  }

  useEffect(() => { void loadConversations(); void loadContacts(); }, []);
  useEffect(() => {
    if (!activeId) { setMessages([]); return undefined; }
    void loadMessages(activeId);
    realtime.joinConversation(activeId);
    return () => realtime.leaveConversation(activeId);
  }, [activeId]);
  useEffect(() => realtime.subscribe('message:new', (message: any) => {
    setConversations((current) => current.map((row) => row._id === String(message.conversation)
      ? { ...row, lastMessagePreview: message.body || 'Attachment', lastMessageAt: message.createdAt, unreadCount: row._id === activeId ? 0 : Number(row.unreadCount || 0) + 1 }
      : row));
    if (String(message.conversation) === activeId) setMessages((current) => current.some((row) => row._id === message._id) ? current : [...current, message]);
  }), [realtime.subscribe, activeId]);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if ((!text && !attachments.length) || !activeId || uploading) return;
    const pending = attachments;
    setBody(''); setAttachments([]);
    try {
      const response = await sendConversationMessage(activeId, { body: text, attachments: pending });
      setMessages((current) => current.some((row) => row._id === response.data._id) ? current : [...current, response.data]);
      await loadConversations();
    } catch (error) { setNotice((error as Error).message); setBody(text); setAttachments(pending); }
  }
  async function startConversation() {
    if (!newRecipient) return;
    try {
      const response = await createConversation({ participants: [newRecipient], type: 'direct' });
      setNewRecipient(''); await loadConversations(); setActiveId(response.data._id);
    } catch (error) { setNotice((error as Error).message); }
  }
  async function archiveActive() {
    if (!activeId) return;
    try { await archiveConversation(activeId); setActiveId(''); await loadConversations(); }
    catch (error) { setNotice((error as Error).message); }
  }
  async function attachFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length) return;
    setUploading(true); setUploadProgress(0);
    try {
      const next: Array<{ file: string; name: string; mimeType: string; sizeBytes: number }> = [];
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        const response = await uploadDriveFile(file, { category: 'document', description: 'Secure conversation attachment', duplicateAction: 'copy' }, (percent) => setUploadProgress(Math.round((index * 100 + percent) / selected.length)));
        next.push({ file: response.data._id, name: response.data.name, mimeType: response.data.mimeType, sizeBytes: response.data.sizeBytes });
      }
      setAttachments((current) => [...current, ...next].slice(0, 20));
    } catch (error) { setNotice((error as Error).message); }
    finally { setUploading(false); setUploadProgress(0); }
  }

  const active = conversations.find((row) => row._id === activeId);
  const visible = useMemo(() => conversations.filter((row) => `${row.title || ''} ${(row.participants || []).map((participant: any) => participant.name).join(' ')}`.toLowerCase().includes(search.toLowerCase())), [conversations, search]);
  function conversationTitle(row: any) { return row.title || (row.participants || []).filter((participant: any) => participant._id !== user?._id).map((participant: any) => participant.name).join(', ') || 'Conversation'; }

  return <Box sx={{ px: { xs: 1, sm: 3, lg: 4 }, pb: 4 }}>
    <Box sx={{ px: { xs: 1, sm: 0 } }}><CompactPageToolbar marker="messages-toolbar-v153" title="Messages" description="Private conversation history, live delivery and secure Vault attachments." meta={<Chip size="small" icon={realtime.status === 'connected' ? <WifiRounded /> : <WifiOffRounded />} color={realtime.status === 'connected' ? 'success' : 'default'} label={realtime.status} />} /></Box>
    {notice && <Alert severity="error" onClose={() => setNotice('')} sx={{ mb: 2 }}>{notice}</Alert>}
    <Paper className="sa-surface-card" elevation={0} sx={{ height: { xs: 'calc(100dvh - 205px)', md: 690 }, minHeight: 500, borderRadius: { xs: 3, md: 4 }, overflow: 'hidden', display: 'grid', gridTemplateColumns: { xs: activeId ? '0 1fr' : '1fr 0', md: '340px 1fr' } }}>
      <Box sx={{ borderRight: '1px solid', borderColor: 'divider', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><Box sx={{ p: 1.5 }}><TextField fullWidth size="small" placeholder="Search conversations" value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> }} /><Stack direction="row" gap={1} sx={{ mt: 1 }}><TextField select fullWidth size="small" label="Start conversation" value={newRecipient} onChange={(event) => setNewRecipient(event.target.value)}>{contacts.map((candidate) => <MenuItem value={candidate._id} key={candidate._id}>{candidate.name} · {candidate.activeMode || candidate.role}</MenuItem>)}</TextField><IconButton color="primary" disabled={!newRecipient} onClick={startConversation}><AddRounded /></IconButton></Stack></Box><Divider /><List sx={{ overflowY: 'auto', flex: 1, p: 0 }}>{visible.map((row) => <ListItemButton key={row._id} selected={row._id === activeId} onClick={() => setActiveId(row._id)} sx={{ py: 1.5 }}><ListItemAvatar><Avatar src={(row.participants || []).find((participant: any) => participant._id !== user?._id)?.avatar}>{conversationTitle(row)[0]}</Avatar></ListItemAvatar><ListItemText primary={<Stack direction="row" justifyContent="space-between"><Typography noWrap sx={{ fontWeight: row.unreadCount ? 900 : 700, maxWidth: 180 }}>{conversationTitle(row)}</Typography>{row.unreadCount ? <Chip size="small" color="primary" label={row.unreadCount} /> : null}</Stack>} secondary={<Typography noWrap variant="body2" color="text.secondary">{row.lastMessagePreview || 'No messages yet'}</Typography>} /></ListItemButton>)}{!visible.length && <Alert severity="info" sx={{ m: 2 }}>No conversations yet.</Alert>}</List></Box>
      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{active ? <><Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}><Button sx={{ display: { md: 'none' }, mr: 1 }} onClick={() => setActiveId('')}>Back</Button><Avatar sx={{ mr: 1.2 }}>{conversationTitle(active)[0]}</Avatar><Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 850 }}>{conversationTitle(active)}</Typography><Typography variant="caption" color="text.secondary">{active.type} conversation</Typography></Box><IconButton title="Archive conversation" onClick={archiveActive}><ArchiveRounded /></IconButton></Stack><Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'background.default' }}><Stack gap={1.2}>{messages.map((message) => { const mine = String(message.sender?._id || message.sender) === String(user?._id); return <Box key={message._id} sx={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}><Paper elevation={0} sx={{ px: 1.6, py: 1.1, bgcolor: mine ? 'primary.main' : 'background.paper', color: mine ? 'primary.contrastText' : 'text.primary', borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', border: mine ? 'none' : '1px solid', borderColor: 'divider' }}>{message.body && <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.body}</Typography>}{(message.attachments || []).map((attachment: any, index: number) => <Button key={`${attachment.file || attachment.legacyUrl || index}`} size="small" color="inherit" startIcon={<DownloadRounded />} onClick={() => attachment.file && downloadDriveFile(attachment.file, attachment.name || 'attachment')} sx={{ mt: .7, mr: .5, maxWidth: '100%' }}>{attachment.name || 'Attachment'} · {formatBytes(attachment.sizeBytes)}</Button>)}<Typography variant="caption" sx={{ opacity: .7, display: 'block' }}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography></Paper></Box>; })}<div ref={bottomRef} /></Stack></Box><Box component="form" onSubmit={submit} sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>{uploading && <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 1 }} />}{attachments.length > 0 && <Stack direction="row" gap={.7} flexWrap="wrap" sx={{ mb: 1 }}>{attachments.map((attachment, index) => <Chip key={attachment.file} label={`${attachment.name} · ${formatBytes(attachment.sizeBytes)}`} onDelete={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} deleteIcon={<CloseRounded />} />)}</Stack>}<Stack direction="row" gap={1}><IconButton component="label" disabled={uploading} title="Attach files securely from Document Vault"><AttachFileRounded /><input hidden type="file" multiple onChange={attachFiles} /></IconButton><TextField fullWidth size="small" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message…" multiline maxRows={4} /><IconButton type="submit" color="primary" disabled={(!body.trim() && !attachments.length) || uploading}>{uploading ? <CircularProgress size={20} /> : <SendRounded />}</IconButton></Stack></Box></> : <Box sx={{ display: 'grid', placeItems: 'center', height: '100%', p: 4 }}><Typography color="text.secondary">Select or start a conversation.</Typography></Box>}</Box>
    </Paper>
  </Box>;
}
