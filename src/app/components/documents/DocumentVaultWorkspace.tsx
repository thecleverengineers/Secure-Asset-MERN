import { useEffect, useMemo, useState, type DragEvent, type ElementType, type ReactNode } from 'react';
import { Alert, Box, Breadcrumbs, Button, CircularProgress, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, MenuItem, Pagination, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import CloudUploadRounded from '@mui/icons-material/CloudUploadRounded';
import StorageRounded from '@mui/icons-material/StorageRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import ListRounded from '@mui/icons-material/ListRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import CalendarTodayRounded from '@mui/icons-material/CalendarTodayRounded';
import ImageRounded from '@mui/icons-material/ImageRounded';
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import InsertDriveFileRounded from '@mui/icons-material/InsertDriveFileRounded';
import CameraAltRounded from '@mui/icons-material/CameraAltRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import { Link } from 'react-router';
import ProfessionalDialog from '../shared/ProfessionalDialog';

type Item = Record<string, any> & { _id: string; name: string; itemType?: 'file' | 'folder' };
type Category = { key: string; label: string; systemKey: string; icon: ElementType; _id?: string; fileCount?: number; color?: string };
type Props = {
  items: Item[]; categories: Category[]; sections: ReadonlyArray<readonly [string, string, ElementType]>;
  section: string; folderId: string | null; breadcrumbs: Item[]; search: string; loading: boolean;
  usage: number; quota: number; usageByCategory: Record<string, number>; ready: boolean;
  pinEnabled: boolean; lockRequired: boolean; uploadProgress: Record<string, number>;
  iconAssets: Record<string, string>; thumbnail: (item: Item) => ReactNode;
  onSearch: (value: string) => void; onSection: (key: string) => void; onCategory: (category: Category) => void;
  onOpen: (item: Item) => void; onMenu: (anchor: HTMLElement, item: Item) => void; onStar: (item: Item) => void;
  onUpload: () => void; onScan: () => void; onSecurity: () => void; onRefresh: () => void;
  onNewFolder: () => void; onTemplates: () => void; onDrop: (event: DragEvent<HTMLElement>) => void;
};

const fileTypes = [
  { key: 'all', label: 'All', icon: null }, { key: 'image', label: 'Images', icon: ImageRounded },
  { key: 'pdf', label: 'PDF', icon: PictureAsPdfRounded }, { key: 'document', label: 'Documents', icon: DescriptionRounded },
  { key: 'other', label: 'Others', icon: InsertDriveFileRounded },
] as const;
const colors = ['#082a67', '#e74766', '#a48a53', '#8960d7'];
function bytes(value = 0) {
  if (value <= 0) return '0 B';
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 4);
  return `${(value / 1024 ** i).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`;
}
function fileType(item: Item) {
  const mime = String(item.mimeType || '').toLowerCase();
  if (mime.startsWith('image/') || item.category === 'image') return 'image';
  if (mime.includes('pdf') || /\.pdf$/i.test(item.name)) return 'pdf';
  if (mime.startsWith('text/') || /word|document|sheet|excel|presentation/.test(mime)) return 'document';
  return 'other';
}
function dateLabel(item: Item) {
  const date = new Date(item.updatedAt || item.createdAt || '');
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DocumentVaultWorkspace(props: Props) {
  const [fileFilter, setFileFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const percent = props.quota > 0 ? Math.min(100, Math.max(0, props.usage / props.quota * 100)) : 0;
  const selectedCategory = props.categories.find(c => c._id === props.folderId);
  const heading = selectedCategory?.label || props.breadcrumbs.at(-1)?.name || (props.section === 'all-documents' ? 'All Documents' : props.section === 'recent' ? 'Recent Files' : props.sections.find(s => s[0] === props.section)?.[1]) || 'Files';
  const matches = useMemo(() => {
    const query = props.search.trim().toLowerCase();
    return props.items.filter(item => {
      const category = props.categories.find(c => c._id === (item.folder?._id || item.folder));
      return (fileFilter === 'all' || (item.itemType !== 'folder' && fileType(item) === fileFilter))
        && (!query || `${item.name} ${item.description || ''} ${category?.label || ''} ${(item.tags || []).join(' ')}`.toLowerCase().includes(query));
    }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'size' ? Number(b.sizeBytes || 0) - Number(a.sizeBytes || 0) : (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0));
  }, [props.items, props.categories, props.search, sort, fileFilter]);
  useEffect(() => { setPage(1); }, [props.section, props.folderId, props.search, fileFilter, sort]);
  useEffect(() => { setFileFilter('all'); }, [props.section, props.folderId]);
  const pageCount = Math.max(1, Math.ceil(matches.length / 12));
  const activePage = Math.min(page, pageCount);
  const visibleItems = matches.slice((activePage - 1) * 12, activePage * 12);
  const usageRows = [
    { label: 'Images', value: Number(props.usageByCategory.images || 0) },
    { label: 'Documents & PDF', value: Number(props.usageByCategory.documents || 0) },
    { label: 'Video & audio', value: Number(props.usageByCategory.videos || 0) + Number(props.usageByCategory.audio || 0) },
  ];
  usageRows.push({ label: 'Others', value: Math.max(0, props.usage - usageRows.reduce((sum, r) => sum + r.value, 0)) });
  const onCategory = (category: Category) => { props.onCategory(category); setFilterOpen(false); };
  const renderCategoryIcon = (category: Category) => {
    const Icon = category.icon;
    return <Box className={`dv-category-icon dv-icon-${category.key}`}>{props.iconAssets[category.key] ? <img src={props.iconAssets[category.key]} alt="" /> : <Icon />}</Box>;
  };
  const categoryControl = <TextField select label="Category" size="small" value={selectedCategory?.key || 'all'} onChange={e => { const category = props.categories.find(c => c.key === e.target.value); if (category) onCategory(category); else props.onSection('all-documents'); }}><MenuItem value="all">All Categories</MenuItem>{props.categories.map(c => <MenuItem value={c.key} key={c.key}>{c.label}</MenuItem>)}</TextField>;
  const sortControl = <TextField select label="Sort by" size="small" value={sort} onChange={e => setSort(e.target.value)}><MenuItem value="recent">Recent</MenuItem><MenuItem value="name">Name A–Z</MenuItem><MenuItem value="size">Largest first</MenuItem></TextField>;

  return <Box className="dv-workspace" data-secureasset-document-vault-layout="reference-september-2026">
    <Box className="dv-heading" data-secureasset-document-vault-toolbar="compact-v151">
      <Box><Typography component="h1">Documents</Typography><Typography>Securely store, organize and access your important documents.</Typography></Box>
      <Tooltip title={props.pinEnabled ? 'Manage six-digit vault PIN' : 'Create a six-digit vault PIN'}><IconButton aria-label="Manage vault PIN" onClick={props.onSecurity}><SecurityRounded /></IconButton></Tooltip>
    </Box>
    <Box className="dv-toolbar">
      <Box className="dv-storage-inline">
        <Box className="dv-storage-icon"><StorageRounded /></Box>
        <Box className="dv-storage-copy"><Typography className="dv-mobile-storage-label">Storage Used</Typography><Typography>{props.ready ? <><strong>{bytes(props.usage)}</strong> <span>of {bytes(props.quota)} <span className="dv-desktop-only">used</span></span></> : 'Checking storage…'}</Typography><LinearProgress aria-label="Storage used" variant="determinate" value={percent} /></Box>
        <Typography className="dv-storage-percent">{Math.round(percent)}%</Typography>
      </Box>
      <TextField className="dv-search" size="small" placeholder="Search documents, categories…" value={props.search} onChange={e => props.onSearch(e.target.value)} inputProps={{ 'aria-label': 'Search documents and categories' }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> }} />
      <IconButton className="dv-filter-toggle" aria-label="Filter and sort documents" onClick={() => setFilterOpen(true)}><TuneRounded /></IconButton>
      <Box className="dv-desktop-filters">{categoryControl}{sortControl}</Box>
      <Box className="dv-view-switch" role="group" aria-label="Document view"><IconButton aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><GridViewRounded /></IconButton><IconButton aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><ListRounded /></IconButton></Box>
      <Button className="dv-upload" variant="contained" startIcon={<CloudUploadRounded />} onClick={props.onUpload}>Upload<span className="dv-upload-label"> Document</span></Button>
    </Box>
    <Box className="dv-uploads" aria-live="polite">{Object.entries(props.uploadProgress).map(([name, progress]) => <Paper key={name}><Typography>{name} · {progress}%</Typography><LinearProgress aria-label={`Uploading ${name}`} variant="determinate" value={progress} /></Paper>)}</Box>
    <Box className="dv-columns">
      <Box className="dv-content">
        <Box className="dv-section-heading"><Typography component="h2">Quick Access</Typography><Button endIcon={<ChevronRightRounded />} onClick={() => setFilterOpen(true)}><span className="dv-wide-label">View All Categories</span><span className="dv-short-label">View All</span></Button></Box>
        <Box className="dv-category-grid" data-secureasset-document-vault-quick-access="reference-categories">
          {props.categories.map(category => <Button key={category.key} className={`dv-category-card${selectedCategory?.key === category.key ? ' is-active' : ''}`} aria-label={`Open ${category.label} files`} aria-pressed={selectedCategory?.key === category.key} onClick={() => onCategory(category)}>{renderCategoryIcon(category)}<Typography component="span" className="dv-category-label">{category.label}</Typography><Typography component="span" className="dv-category-count">{props.ready ? `${category.fileCount || 0} files` : '—'}</Typography></Button>)}
        </Box>
        <Box className="dv-files-heading"><Typography component="h2">{heading}</Typography><Button className="dv-view-all" endIcon={<ChevronRightRounded />} onClick={() => props.onSection('all-documents')}>View All</Button>
          <Box className="dv-type-tabs" role="group" aria-label="Filter by file type">{fileTypes.map(({key, label, icon: Icon}) => <Button key={key} aria-pressed={fileFilter === key} onClick={() => setFileFilter(key)} startIcon={Icon ? <Icon /> : undefined}>{label}</Button>)}</Box>
        </Box>
        {(props.breadcrumbs.length > 0 || props.section !== 'recent' || props.search) && <Box className="dv-context-row"><Breadcrumbs aria-label="Document folder path"><Button onClick={() => props.onSection('recent')}>Documents</Button>{props.breadcrumbs.map(crumb => <Button key={crumb._id} onClick={() => props.onOpen({ ...crumb, itemType: 'folder' })}>{crumb.name}</Button>)}</Breadcrumbs><Typography aria-live="polite">{matches.length} item{matches.length === 1 ? '' : 's'}</Typography></Box>}
        {props.section === 'legal-documents' && <Alert severity="info" action={<Button onClick={props.onTemplates}>Create templates</Button>}>Legal records are private by default. Public sharing requires explicit confirmation.</Alert>}
        {props.section === 'trash' && <Alert severity="info">Deleted items can be restored during the configured recovery period.</Alert>}
        <Box className={`dv-file-surface${dragActive ? ' is-dragging' : ''}`} onDragEnter={e => { e.preventDefault(); setDragActive(true); }} onDragOver={e => e.preventDefault()} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false); }} onDrop={e => { setDragActive(false); props.onDrop(e); }}>
          {dragActive && <Box className="dv-drop-hint"><CloudUploadRounded /> Drop files to upload</Box>}
          {props.loading ? <Box className="dv-empty" role="status"><CircularProgress size={28} /><Typography>Loading your documents…</Typography></Box> : visibleItems.length === 0 ? <Box className="dv-empty"><FolderRounded /><Typography component="h3">{props.search || fileFilter !== 'all' ? 'No matching documents' : 'Your documents belong here'}</Typography><Typography>{props.search || fileFilter !== 'all' ? 'Try another search or file type.' : 'Upload a file or scan a document to get started.'}</Typography><Button variant="contained" onClick={() => { if (props.search || fileFilter !== 'all') { props.onSearch(''); setFileFilter('all'); } else props.onUpload(); }}>{props.search || fileFilter !== 'all' ? 'Clear filters' : 'Upload a document'}</Button></Box> : <Box className={`dv-file-grid is-${view}`}>
            {visibleItems.map(item => {
              const category = props.categories.find(c => c._id === (item.folder?._id || item.folder));
              const type = fileType(item); const TypeIcon = item.itemType === 'folder' ? FolderRounded : type === 'pdf' ? PictureAsPdfRounded : type === 'image' ? ImageRounded : DescriptionRounded;
              return <Paper className="dv-file-card" key={`${item.itemType}-${item._id}`} elevation={0}>
                <button className="dv-file-preview" aria-label={`Preview ${item.name}`} onClick={() => props.onOpen(item)}>{props.thumbnail(item)}<span className={`dv-file-badge is-${type}`}><TypeIcon /></span></button>
                <IconButton className="dv-file-menu" aria-label={`Actions for ${item.name}`} onClick={e => props.onMenu(e.currentTarget, item)}><MoreVertRounded /></IconButton>
                <Box className="dv-file-info"><Box className="dv-file-title-row"><button className="dv-file-name" title={item.name} onClick={() => props.onOpen(item)}>{item.name}</button><IconButton className="dv-favourite" aria-label={`${item.starred ? 'Remove' : 'Add'} ${item.name} ${item.starred ? 'from' : 'to'} favourites`} onClick={() => props.onStar(item)}>{item.starred ? <FavoriteRounded /> : <FavoriteBorderRounded />}</IconButton></Box><Typography className="dv-file-category"><FolderRounded />{category?.label || item.documentType || (item.itemType === 'folder' ? 'Folder' : 'My Documents')}</Typography><Typography className="dv-file-meta"><CalendarTodayRounded />{dateLabel(item)}<span>·</span>{item.itemType === 'folder' ? 'Folder' : bytes(item.sizeBytes)}</Typography></Box>
              </Paper>;
            })}
          </Box>}
        </Box>
        {pageCount > 1 && <Pagination className="dv-pagination" aria-label="Document pages" page={activePage} count={pageCount} onChange={(_, value) => setPage(value)} siblingCount={0} />}
        <Box className="dv-footer-actions"><Button startIcon={<AddRounded />} onClick={props.onNewFolder}>New folder</Button><Button startIcon={<RefreshRounded />} onClick={props.onRefresh}>Refresh</Button><Button startIcon={<TuneRounded />} onClick={() => setFilterOpen(true)}>Browse library</Button></Box>
      </Box>
      <Box component="aside" className="dv-aside" aria-label="Storage and document categories">
        <Paper className="dv-side-panel" elevation={0}><Typography component="h2">Storage Usage</Typography><Box className="dv-storage-summary"><Box className="dv-storage-ring" role="img" aria-label={`${Math.round(percent)} percent of storage used`}><CircularProgress variant="determinate" value={100} size={94} thickness={4.5} /><CircularProgress variant="determinate" value={percent} size={94} thickness={4.5} /><Typography>{Math.round(percent)}%</Typography></Box><Typography><strong>{props.ready ? bytes(props.usage) : '—'}</strong> of {bytes(props.quota)} used</Typography></Box><Box className="dv-usage-legend">{usageRows.map((row, i) => <Box key={row.label}><span style={{ backgroundColor: colors[i] }} /><Typography>{row.label}</Typography><Typography>{bytes(row.value)}</Typography></Box>)}</Box><Button className="dv-upgrade" fullWidth component={Link} to="/pricing" variant="outlined" startIcon={<WorkspacePremiumRounded />}>Upgrade Storage</Button></Paper>
        <Paper className="dv-side-panel dv-categories-panel" elevation={0}><Typography component="h2">Categories</Typography><Button fullWidth onClick={() => props.onSection('all-documents')} startIcon={<DescriptionRounded />}>All Documents<ChevronRightRounded className="dv-category-total" /></Button>{props.categories.map(category => <Button fullWidth key={category.key} onClick={() => onCategory(category)}>{renderCategoryIcon(category)}<span>{category.label.replace(' Certificate', category.key === 'vehicle-registration' ? '' : ' Certificate')}</span><span className="dv-category-total">{props.ready ? category.fileCount || 0 : '—'}</span></Button>)}</Paper>
        <Paper className="dv-side-panel dv-protection-panel" elevation={0}><SecurityRounded /><Box><Typography>{props.pinEnabled ? 'PIN protection is on' : 'Protect your documents'}</Typography><Typography>{props.lockRequired ? 'Auto-lock after 10 minutes idle.' : 'Set your own six-digit vault PIN.'}</Typography></Box><Button onClick={props.onSecurity}>{props.pinEnabled ? 'Manage PIN' : 'Create PIN'}</Button></Paper>
      </Box>
    </Box>
    <Tooltip title="Scan Document (Camera to PNG)" placement="left"><Button className="dv-scan" aria-label="Scan document" onClick={props.onScan}><CameraAltRounded /><span>Scan Document</span></Button></Tooltip>
    <ProfessionalDialog open={filterOpen} onClose={() => setFilterOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Browse documents</DialogTitle><DialogContent><Stack gap={2.5} sx={{ pt: 1 }}>{categoryControl}{sortControl}<TextField select label="Library" value={props.sections.some(s => s[0] === props.section) ? props.section : 'all-documents'} onChange={e => { props.onSection(e.target.value); setFilterOpen(false); }}><MenuItem value="all-documents">All Documents</MenuItem>{props.sections.map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField><Box role="group" aria-label="Document view in filters"><Button onClick={() => setView('grid')} variant={view === 'grid' ? 'contained' : 'outlined'} startIcon={<GridViewRounded />}>Grid</Button> <Button onClick={() => setView('list')} variant={view === 'list' ? 'contained' : 'outlined'} startIcon={<ListRounded />}>List</Button></Box></Stack></DialogContent><DialogActions><Button onClick={() => setFilterOpen(false)}>Done</Button></DialogActions></ProfessionalDialog>
  </Box>;
}
