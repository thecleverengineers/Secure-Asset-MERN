import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import {
  Alert, Box, Button, Chip, DialogContent, DialogTitle, Divider, IconButton,
  InputAdornment, Paper, Stack, TextField, Typography,
} from '@mui/material';
import ProfessionalDialog from '../components/shared/ProfessionalDialog';
import { LogoMark } from '../components/premium/LogoMark';
import AudioFileRounded from '@mui/icons-material/AudioFileRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import ImageRounded from '@mui/icons-material/ImageRounded';
import InsertDriveFileRounded from '@mui/icons-material/InsertDriveFileRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import MovieRounded from '@mui/icons-material/MovieRounded';
import ReportRounded from '@mui/icons-material/ReportRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import { getPublicDriveItem, publicDriveContentUrl, publicDriveFolderFileUrl } from '../services/api';
import { WorkspaceSkeleton } from '../components/shared/PremiumSkeleton';

function formatBytes(bytes = 0) { if (!bytes) return '0 B'; const units = ['B','KB','MB','GB']; const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / 1024 ** i).toFixed(i > 1 ? 1 : 0)} ${units[i]}`; }
function icon(item: any) { if (item.category === 'image') return <ImageRounded color="success" />; if (item.category === 'video') return <MovieRounded color="secondary" />; if (item.category === 'audio') return <AudioFileRounded color="warning" />; if (item.mimeType?.includes('pdf') || item.category === 'document') return <DescriptionRounded color="error" />; return <InsertDriveFileRounded />; }

export default function PublicDrivePage() {
  const { type = 'file', token = '' } = useParams();
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [currentFolder, setCurrentFolder] = useState('');

  async function load(pass = submittedPassword, targetFolder = currentFolder, authorisedEmail = submittedEmail) {
    setLoading(true); setError('');
    try { const result = await getPublicDriveItem(type as 'file' | 'folder', token, pass, targetFolder, authorisedEmail); setData(result.data); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { setCurrentFolder(''); load('', ''); }, [type, token]);
  const files = useMemo(() => (data?.files || []).filter((item: any) => item.name.toLowerCase().includes(query.toLowerCase())), [data, query]);

  if (loading) return <WorkspaceSkeleton rows={2} />;
  if (error) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: 'background.default' }}><Paper sx={{ p: 4, maxWidth: 480, borderRadius: 4, textAlign: 'center' }}><LockRounded color="primary" sx={{ fontSize: 56 }} /><Typography variant="h5" sx={{ fontWeight: 900, mt: 1 }}>Restricted document</Typography><Typography color="text.secondary" sx={{ my: 2 }}>{error}</Typography><Stack gap={1.5}><TextField fullWidth type="email" label="Authorised email, when required" value={email} onChange={(e) => setEmail(e.target.value)} /><TextField fullWidth type="password" label="Share-link password, when required" value={password} onChange={(e) => setPassword(e.target.value)} /><Button fullWidth variant="contained" onClick={() => { setSubmittedPassword(password); setSubmittedEmail(email); load(password, currentFolder, email); }}>Open securely</Button></Stack></Paper></Box>;

  const item = data?.item;
  return <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
    <Box sx={{ px: { xs: 2, md: 5 }, py: 1.25, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><LogoMark /><Typography variant="caption" color="text.secondary">Secure public preview</Typography></Box><Stack direction="row"><IconButton onClick={() => navigator.share?.({ title: item?.name, url: location.href })}><ShareRounded /></IconButton><IconButton><ReportRounded /></IconButton></Stack></Stack></Box>
    <Box sx={{ maxWidth: 1180, mx: 'auto', p: { xs: 2, md: 4 } }}>
      {data.type === 'file' ? <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}><Box><Stack direction="row" gap={1.5} alignItems="center">{icon(item)}<Box><Typography variant="h5" sx={{ fontWeight: 900 }}>{item.name}</Typography><Typography color="text.secondary">{formatBytes(item.sizeBytes)} · Updated {new Date(item.updatedAt).toLocaleDateString()}</Typography></Box></Stack>{item.description && <Typography sx={{ mt: 2 }}>{item.description}</Typography>}</Box>{item.publicLink?.allowDownload && <Button startIcon={<DownloadRounded />} variant="contained" href={publicDriveContentUrl(token, submittedPassword, true, submittedEmail)}>Download</Button>}</Stack><Divider sx={{ my: 3 }} /><Box sx={{ minHeight: 560, bgcolor: '#101418', borderRadius: 3, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>{item.mimeType?.startsWith('image/') ? <img src={publicDriveContentUrl(token, submittedPassword, false, submittedEmail)} alt={item.name} style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} /> : item.mimeType?.startsWith('video/') ? <video src={publicDriveContentUrl(token, submittedPassword, false, submittedEmail)} controls style={{ maxWidth: '100%', maxHeight: '75vh' }} /> : item.mimeType?.startsWith('audio/') ? <audio src={publicDriveContentUrl(token, submittedPassword, false, submittedEmail)} controls /> : item.mimeType?.includes('pdf') || item.mimeType?.startsWith('text/') ? <iframe title={item.name} src={publicDriveContentUrl(token, submittedPassword, false, submittedEmail)} style={{ width: '100%', height: '75vh', border: 0, background: 'white' }} /> : <Alert severity="info">This file type cannot be previewed in the browser.</Alert>}</Box></Paper> : <><Paper sx={{ p: 3, borderRadius: 4, mb: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}><Box><Stack direction="row" gap={1.5} alignItems="center"><FolderRounded color="primary" sx={{ fontSize: 44 }} /><Box><Typography variant="h4" sx={{ fontWeight: 950 }}>{item.name}</Typography><Typography color="text.secondary">{item.description || 'Shared folder'}</Typography></Box></Stack></Box><TextField size="small" placeholder="Search this folder" value={query} onChange={(e) => setQuery(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> }} /></Stack></Paper><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 1.5 }}>{(data.folders || []).map((folder: any) => <Paper key={folder._id} variant="outlined" onClick={() => { setCurrentFolder(folder._id); load(submittedPassword, folder._id); }} sx={{ p: 2, borderRadius: 3, cursor: 'pointer', '&:hover': { boxShadow: 3 } }}><FolderRounded color="primary" /><Typography sx={{ mt: 1, fontWeight: 850 }}>{folder.name}</Typography><Chip size="small" label="Public folder" sx={{ mt: 1 }} /></Paper>)}{files.map((file: any) => <Paper key={file._id} variant="outlined" onClick={() => setPreview(file)} sx={{ p: 2, borderRadius: 3, cursor: 'pointer', '&:hover': { boxShadow: 3 } }}>{icon(file)}<Typography noWrap sx={{ mt: 1, fontWeight: 850 }}>{file.name}</Typography><Typography variant="caption" color="text.secondary">{formatBytes(file.sizeBytes)}</Typography></Paper>)}</Box></>}
    </Box>
    <ProfessionalDialog open={Boolean(preview)} onClose={() => setPreview(null)} fullWidth maxWidth="lg"><DialogTitle sx={{ fontWeight: 900 }}>{preview?.name}</DialogTitle><DialogContent dividers sx={{ minHeight: 600, bgcolor: '#101418', display: 'grid', placeItems: 'center' }}>{preview && (preview.mimeType?.startsWith('image/') ? <img src={publicDriveFolderFileUrl(token, preview._id, submittedPassword, false, submittedEmail)} alt={preview.name} style={{ maxWidth: '100%', maxHeight: '75vh' }} /> : preview.mimeType?.startsWith('video/') ? <video src={publicDriveFolderFileUrl(token, preview._id, submittedPassword, false, submittedEmail)} controls style={{ maxWidth: '100%', maxHeight: '75vh' }} /> : preview.mimeType?.startsWith('audio/') ? <audio src={publicDriveFolderFileUrl(token, preview._id, submittedPassword, false, submittedEmail)} controls /> : preview.mimeType?.includes('pdf') || preview.mimeType?.startsWith('text/') ? <iframe title={preview.name} src={publicDriveFolderFileUrl(token, preview._id, submittedPassword, false, submittedEmail)} style={{ width: '100%', height: '75vh', border: 0, background: 'white' }} /> : <Button variant="contained" startIcon={<DownloadRounded />} href={publicDriveFolderFileUrl(token, preview._id, submittedPassword, true, submittedEmail)}>Download file</Button>)}</DialogContent></ProfessionalDialog>
  </Box>;
}
