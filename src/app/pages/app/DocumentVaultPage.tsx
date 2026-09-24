import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ElementType, type ReactNode } from 'react';
import {
  Alert, Avatar, Box, Breadcrumbs, Button, Chip, CircularProgress, DialogActions, DialogContent, DialogTitle,
  Divider, Drawer, FormControl, IconButton, InputAdornment, LinearProgress, List, ListItemButton, ListItemIcon,
  ListItemText, Menu, MenuItem, Pagination, Paper, Select, Stack, Tab, Tabs, TextField, Tooltip, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import AddRounded from '@mui/icons-material/AddRounded';
import ArchiveRounded from '@mui/icons-material/ArchiveRounded';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import BadgeRounded from '@mui/icons-material/BadgeRounded';
import AudioFileRounded from '@mui/icons-material/AudioFileRounded';
import CakeRounded from '@mui/icons-material/CakeRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import CloudRounded from '@mui/icons-material/CloudRounded';
import CloudUploadRounded from '@mui/icons-material/CloudUploadRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import DeleteForeverRounded from '@mui/icons-material/DeleteForeverRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import DriveFileMoveRounded from '@mui/icons-material/DriveFileMoveRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import ImageRounded from '@mui/icons-material/ImageRounded';
import InsertDriveFileRounded from '@mui/icons-material/InsertDriveFileRounded';
import LinkRounded from '@mui/icons-material/LinkRounded';
import ListRounded from '@mui/icons-material/ListRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import MovieRounded from '@mui/icons-material/MovieRounded';
import PeopleRounded from '@mui/icons-material/PeopleRounded';
import PreviewRounded from '@mui/icons-material/PreviewRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import RestoreFromTrashRounded from '@mui/icons-material/RestoreFromTrashRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import StarBorderRounded from '@mui/icons-material/StarBorderRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import GavelRounded from '@mui/icons-material/GavelRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import StorageRounded from '@mui/icons-material/StorageRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import CameraAltRounded from '@mui/icons-material/CameraAltRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import LockOpenRounded from '@mui/icons-material/LockOpenRounded';
import HowToVoteRounded from '@mui/icons-material/HowToVoteRounded';
import MapRounded from '@mui/icons-material/MapRounded';
import { toast } from 'sonner';
import {
  addDriveComment, bulkDriveAction, createDriveFolder, createDriveLegalTemplates, createDrivePublicLink, uploadDriveScannedPng,
  downloadDriveFile, downloadDriveFolder, driveItemAction, fetchDriveFileBlob, getDriveActivity, getDriveBootstrap,
  getDriveBreadcrumbs, getDriveComments, getDriveFile, getDriveItems, getDriveSharedWithMe, permanentlyDeleteDriveItem,
  revokeDrivePublicLink, setDriveFileApproval, shareDriveItem, updateDriveFile, updateDriveFolder, uploadDriveFile, uploadDriveVersion,
  beginDeviceUnlockAuthentication, clearDeviceUnlockToken, completeDeviceUnlockAuthentication, getSecurityOverview,
  hasVaultPinUnlockToken, requestVaultPinOtp, setVaultPin as updateVaultPin, unlockVaultPin,
} from '../../services/api';
import { useActionDialog } from '../../components/shared/useActionDialog';
import { useSite } from '../../context/SiteContext';
import { normaliseDesignSystem } from '../../designSystem';
import { authenticationOptionsForBrowser, deviceUnlockSupported, serializePublicKeyCredential } from '../../services/deviceUnlock';
import { enhanceScannedPage, SCAN_ENHANCER_PROFILE } from '../../utils/scanEnhancement';
import '../../../styles/document-vault.css';

const systemSections = [
  ['my-drive', 'My Drive', FolderOpenRounded], ['recent', 'Recent Files', HistoryRounded], ['starred', 'Starred', StarRounded],
  ['shared', 'Shared With Me', PeopleRounded], ['legal-documents', 'Legal Documents', GavelRounded],
  ['property-documents', 'Property Documents', FolderRounded], ['survey-documents', 'Survey Documents', FolderRounded],
  ['archived-files', 'Archived', ArchiveRounded], ['trash', 'Trash', DeleteOutlineRounded],
] as const;

const STORAGE_DOCUMENT_CATEGORIES = [
  { key: 'pan-card', label: 'PAN Card', systemKey: 'smart-national-identity-financial-proofs-pan-card', icon: CreditCardRounded, color: '#087ea4' },
  { key: 'birth-certificate', label: 'Birth Certificate', systemKey: 'smart-civil-life-event-certificates-birth-certificate', icon: CakeRounded, color: '#7c3aed' },
  { key: 'indian-passport', label: 'Indian Passport', systemKey: 'smart-national-identity-financial-proofs-indian-passport', icon: PublicRounded, color: '#2563eb' },
  { key: 'voter-id', label: 'Voter ID', systemKey: 'smart-national-identity-financial-proofs-voter-id', icon: HowToVoteRounded, color: '#4f46e5' },
  { key: 'aadhaar-card', label: 'Aadhaar Card', systemKey: 'smart-national-identity-financial-proofs-aadhaar-card', icon: BadgeRounded, color: '#0f9f8c' },
  { key: 'driving-licence', label: 'Driving Licence', systemKey: 'smart-transport-mobility-driving-licence', icon: DriveFileMoveRounded, color: '#b7791f' },
  { key: 'land-patta', label: 'Land Patta', systemKey: 'smart-property-land-records-land-patta', icon: MapRounded, color: '#4d8b18' },
] as const;

const mobileCategories = [
  { key: 'image', label: 'Image', icon: ImageRounded, category: 'image', action: 'category' },
  { key: 'video', label: 'Video', icon: MovieRounded, category: 'video', action: 'category' },
  { key: 'audio', label: 'Music', icon: AudioFileRounded, category: 'audio', action: 'category' },
  { key: 'document', label: 'Document', icon: DescriptionRounded, category: 'document', action: 'category' },
  { key: 'shared', label: 'Cloud', icon: CloudRounded, category: 'shared', action: 'section' },
  { key: 'pan-card', label: 'PAN Card', icon: CreditCardRounded, color: '#087ea4', category: 'smart-national-identity-financial-proofs-pan-card', action: 'smart-folder' },
  { key: 'birth-certificate', label: 'Birth Certificate', icon: CakeRounded, color: '#7c3aed', category: 'smart-civil-life-event-certificates-birth-certificate', action: 'smart-folder' },
  { key: 'indian-passport', label: 'Indian Passport', icon: PublicRounded, color: '#2563eb', category: 'smart-national-identity-financial-proofs-indian-passport', action: 'smart-folder' },
  { key: 'voter-id', label: 'Voter ID', icon: HowToVoteRounded, color: '#4f46e5', category: 'smart-national-identity-financial-proofs-voter-id', action: 'smart-folder' },
  { key: 'aadhaar-card', label: 'Aadhaar Card', icon: BadgeRounded, color: '#0f9f8c', category: 'smart-national-identity-financial-proofs-aadhaar-card', action: 'smart-folder' },
  { key: 'driving-licence', label: 'Driving Licence', icon: DriveFileMoveRounded, color: '#b7791f', category: 'smart-transport-mobility-driving-licence', action: 'smart-folder' },
  { key: 'land-patta', label: 'Land Patta', icon: MapRounded, color: '#4d8b18', category: 'smart-property-land-records-land-patta', action: 'smart-folder' },
] as const;

const VAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

type DriveItem = Record<string, any> & { _id: string; name: string; itemType?: 'file' | 'folder' };
type StorageDocumentCategory = {
  key: string;
  label: string;
  category: string;
  systemKey: string;
  name: string;
  icon: ElementType;
  color?: string;
  _id?: string;
  fileCount?: number;
  description?: string;
};

function formatBytes(bytes = 0) {
  if (!bytes) return '0 B'; const units = ['B', 'KB', 'MB', 'GB', 'TB']; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}
function formatVaultDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function itemIcon(item: DriveItem) {
  if (item.itemType === 'folder') return <FolderRounded color="primary" />;
  if (item.category === 'image') return <ImageRounded color="success" />;
  if (item.category === 'video') return <MovieRounded color="secondary" />;
  if (item.category === 'audio') return <AudioFileRounded color="warning" />;
  if (item.category === 'legal') return <GavelRounded color="error" />;
  if (item.mimeType?.includes('pdf') || item.category === 'document') return <DescriptionRounded color="error" />;
  return <InsertDriveFileRounded />;
}
function visibilityChip(item: DriveItem) {
  const value = item.visibility || 'private';
  return <Chip size="small" icon={value === 'public' ? <PublicRounded /> : <LockRounded />} label={value.replaceAll('_', ' ')} variant="outlined" sx={{ textTransform: 'capitalize', height: 24 }} />;
}

function VaultConfiguredIcon({ source, fallback, size = 18 }: { source?: string; fallback: ReactNode; size?: number }) {
  return source ? <Box component="img" src={source} alt="" aria-hidden="true" sx={{ width: size, height: size, objectFit: 'contain' }} /> : fallback;
}

function VaultRecentThumbnail({ item, full = false }: { item: DriveItem; full?: boolean }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const isImage = item.itemType !== 'folder' && (item.category === 'image' || item.mimeType?.startsWith('image/'));

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setThumbnailUrl(null);
    if (!isImage) return () => { active = false; };

    void fetchDriveFileBlob(item._id).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setThumbnailUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => undefined);

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isImage, item._id]);

  return <Box className={`sa-vault-mobile-recent-thumbnail${full ? ' is-full' : ''}${item.itemType === 'folder' ? ' is-folder' : ''}`} data-secureasset-document-vault-thumbnail={thumbnailUrl ? 'image-v160' : 'file-v160'}>
    {thumbnailUrl ? <Box component="img" src={thumbnailUrl} alt={`${item.name} preview`} /> : itemIcon(item)}
  </Box>;
}

export default function DocumentVaultPage() {
  const actions = useActionDialog();
  const { data: site } = useSite();
  const design = useMemo(() => normaliseDesignSystem(site.settings?.design), [site.settings?.design]);
  const theme = useTheme();
  const mobileOrTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<Record<string, any> | null>(null);
  const [section, setSection] = useState('my-drive');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<DriveItem[]>([]);
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<DriveItem[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [search, setSearch] = useState('');
  const [mobileCategory, setMobileCategory] = useState<string | null>(null);
  const [mobilePage, setMobilePage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ anchor: HTMLElement; item: DriveItem } | null>(null);
  const [folderDialog, setFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [shareDialog, setShareDialog] = useState<DriveItem | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('viewer');
  const [linkDialog, setLinkDialog] = useState<DriveItem | null>(null);
  const [linkOptions, setLinkOptions] = useState({ slug: '', password: '', startsAt: '', expiresAt: '', restricted: true, allowDownload: false, allowPreview: true, maxViews: '', maxDownloads: '', allowedEmails: '', allowedDomains: '', allowedCountries: '', confirmSensitive: false });
  const [publicUrl, setPublicUrl] = useState('');
  const [preview, setPreview] = useState<{ item: DriveItem; url: string } | null>(null);
  const [details, setDetails] = useState<Record<string, any> | null>(null);
  const [activity, setActivity] = useState<Record<string, any>[]>([]);
  const [comments, setComments] = useState<Record<string, any>[]>([]);
  const [comment, setComment] = useState('');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [dragActive, setDragActive] = useState(false);
  const [vaultUnlocking, setVaultUnlocking] = useState(true);
  const [vaultLocked, setVaultLocked] = useState(false);
  const [vaultLockRequired, setVaultLockRequired] = useState(false);
  const [vaultLockError, setVaultLockError] = useState('');
  const [vaultPinEnabled, setVaultPinEnabled] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinOtpSent, setPinOtpSent] = useState(false);
  const [pinOtp, setPinOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMaskedMobile, setPinMaskedMobile] = useState('');
  const [developmentPinOtp, setDevelopmentPinOtp] = useState('');
  const [pinOtpBusy, setPinOtpBusy] = useState(false);
  const [pinSaveBusy, setPinSaveBusy] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [pinUnlockBusy, setPinUnlockBusy] = useState(false);
  const [pinDialogError, setPinDialogError] = useState('');
  const vaultUnlockRun = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  function patchVisibleDriveItem(id: string, patch: Record<string, any>) {
    setFolders((current) => current.map((item) => item._id === id ? { ...item, ...patch } : item));
    setFiles((current) => current.map((item) => item._id === id ? { ...item, ...patch } : item));
    setBootstrap((current) => current ? { ...current, recent: Array.isArray(current.recent) ? current.recent.map((item: DriveItem) => item._id === id ? { ...item, ...patch } : item) : current.recent } : current);
    setDetails((current) => current?.file?._id === id ? { ...current, file: { ...current.file, ...patch } } : current);
  }
  function removeVisibleDriveItem(id: string) {
    setFolders((current) => current.filter((item) => item._id !== id));
    setFiles((current) => current.filter((item) => item._id !== id));
    setBootstrap((current) => current ? { ...current, recent: Array.isArray(current.recent) ? current.recent.filter((item: DriveItem) => item._id !== id) : current.recent } : current);
    setSelected((current) => { const next = new Set(current); next.delete(id); return next; });
    setDetails((current) => current?.file?._id === id ? null : current);
  }

  const systemFolders = useMemo<Map<string, DriveItem>>(() => new Map<string, DriveItem>((bootstrap?.folders || []).map((f: DriveItem) => [String(f.systemKey || ''), f] as [string, DriveItem])), [bootstrap]);
  const storageDocumentFolders = useMemo<StorageDocumentCategory[]>(() => {
    const serverDocuments = Array.isArray(bootstrap?.quickAccessDocuments) ? bootstrap.quickAccessDocuments : [];
    const serverByKey = new Map<string, DriveItem>(serverDocuments.map((item: DriveItem) => [String(item.systemKey || item.quickAccessKey || item.key || ''), item]));
    return STORAGE_DOCUMENT_CATEGORIES.map((definition) => {
      const serverDocument = serverByKey.get(definition.systemKey);
      return {
        ...(serverDocument || {}),
        key: definition.key,
        label: definition.label,
        category: definition.systemKey,
        systemKey: definition.systemKey,
        name: definition.label,
        icon: definition.icon,
        color: definition.color,
        description: serverDocument?.description || `Protected ${definition.label} records.`,
        fileCount: Number(serverDocument?.fileCount || 0),
      } as StorageDocumentCategory;
    });
  }, [bootstrap]);
  const selectedStorageDocument = useMemo(() => storageDocumentFolders.find((item) => item.systemKey === section && item._id === folderId) || null, [folderId, section, storageDocumentFolders]);
  const allItems = useMemo<DriveItem[]>(() => [...folders.map((x) => ({ ...x, itemType: 'folder' } as DriveItem)), ...files.map((x) => ({ ...x, itemType: 'file' } as DriveItem))], [folders, files]);
  const activeSmartFolder = useMemo(() => {
    const candidate = breadcrumbs[breadcrumbs.length - 1] || allItems.find((item) => item.itemType === 'folder' && item._id === folderId);
    return String(candidate?.systemKey || '').startsWith('smart-') ? candidate : null;
  }, [allItems, breadcrumbs, folderId]);
  const filtered = useMemo(() => search ? allItems.filter((item) => `${item.name} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase())) : allItems, [allItems, search]);
  const mobileMatchingItems = useMemo(() => {
    const source = section !== 'my-drive' || folderId || mobileCategory ? filtered : ((Array.isArray(bootstrap?.recent) && bootstrap.recent.length ? bootstrap.recent : filtered) as DriveItem[]);
    const query = search.trim().toLowerCase();
    return source.map((item) => item.itemType ? item : { ...item, itemType: 'file' as const }).filter((item) => !query || `${item.name} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase().includes(query));
  }, [bootstrap, filtered, folderId, mobileCategory, search, section]);
  const mobilePageCount = Math.max(1, Math.ceil(mobileMatchingItems.length / 8));
  const currentMobilePage = Math.min(mobilePage, mobilePageCount);
  const mobileRecentItems = mobileMatchingItems.slice((currentMobilePage - 1) * 8, currentMobilePage * 8);
  useEffect(() => { setMobilePage(1); }, [section, folderId, mobileCategory, search]);


  const loadBootstrap = useCallback(async () => {
    const result = await getDriveBootstrap(); setBootstrap(result.data);
    return result.data;
  }, []);

  const load = useCallback(async (targetSection = section, targetFolder = folderId) => {
    setLoading(true); setSelected(new Set());
    try {
      const base = bootstrap || await loadBootstrap();
      if (targetSection === 'shared') {
        const response = await getDriveSharedWithMe();
        setFolders((response.data.folders || []) as DriveItem[]); setFiles((response.data.files || []) as DriveItem[]); setBreadcrumbs([]); setFolderId(null);
      } else if (targetSection === 'recent') {
        setFolders([]); setFiles((base.recent || []) as DriveItem[]); setBreadcrumbs([]); setFolderId(null);
      } else if (targetSection === 'starred') {
        const response = await getDriveItems({ folderId: targetFolder || undefined, starred: true }); setFolders(response.data.folders as DriveItem[]); setFiles(response.data.files as DriveItem[]);
      } else {
        const systemFolder = systemFolders.get(targetSection) || (base.folders || []).find((x: DriveItem) => x.systemKey === targetSection);
        const resolvedFolder = targetFolder || systemFolder?._id || null;
        const status = targetSection === 'trash' ? 'trashed' : targetSection === 'archived-files' ? 'archived' : 'active';
        const response = await getDriveItems({ folderId: resolvedFolder || undefined, status }); setFolders(response.data.folders as DriveItem[]); setFiles(response.data.files as DriveItem[]); setFolderId(resolvedFolder);
        if (resolvedFolder) setBreadcrumbs((await getDriveBreadcrumbs(resolvedFolder)).data as DriveItem[]); else setBreadcrumbs([]);
      }
    } catch (error: any) { toast.error(error.message); }
    finally { setLoading(false); }
  }, [bootstrap, folderId, loadBootstrap, section, systemFolders]);

  async function openStorageDocument(document: StorageDocumentCategory) {
    const targetFolder = document._id;
    if (!targetFolder) {
      toast.error('This storage category is still being prepared. Refresh the vault and try again.');
      return;
    }
    const targetSection = document.systemKey;
    setSection(targetSection); setMobileCategory(null); setFolderId(targetFolder); setSearch(''); setSelected(new Set());
    await load(targetSection, targetFolder);
  }

  async function chooseSection(key: string) {
    setSection(key); setMobileCategory(null); setFolderId(null); setSearch('');
    const base = bootstrap || await loadBootstrap(); const target = (base.folders || []).find((x: DriveItem) => x.systemKey === key)?._id || null;
    await load(key, target);
  }
  async function openFolder(item: DriveItem) { setFolderId(item._id); await load(section, item._id); }

  async function chooseMobileCategory(category: string, action: string) {
    if (action === 'smart-folder') {
      const document = storageDocumentFolders.find((item) => item.systemKey === category);
      if (document) await openStorageDocument(document);
      else toast.error('This storage category is unavailable. Refresh the vault and try again.');
      return;
    }
    if (action === 'section') {
      await chooseSection(category);
      return;
    }
    setMobileCategory(category); setSection('my-drive'); setFolderId(null); setSearch(''); setSelected(new Set()); setLoading(true);
    try {
      const response = await getDriveItems({ category, status: 'active' });
      setFolders((response.data.folders || []) as DriveItem[]); setFiles((response.data.files || []) as DriveItem[]); setBreadcrumbs([]);
    } catch (error: any) { toast.error(error.message); }
    finally { setLoading(false); }
  }

  async function createFolder() {
    if (!folderName.trim()) return;
    const smartContext = section.startsWith('smart-') || Boolean(activeSmartFolder);
    try { await createDriveFolder({ name: folderName, parent: folderId, category: section.includes('legal') || smartContext ? 'legal' : 'general', sensitive: section.includes('legal') || smartContext }); toast.success('Folder created'); setFolderDialog(false); setFolderName(''); await load(); }
    catch (error: any) { toast.error(error.message); }
  }

  async function uploadChosenFiles(chosen: File[]) {
    if (!chosen.length) return;
    for (const file of chosen) {
      setUploadProgress((current) => ({ ...current, [file.name]: 0 }));
      try {
        const smartFolder = activeSmartFolder || (section.startsWith('smart-') ? systemFolders.get(section) : null);
        const smartUpload = Boolean(smartFolder?.systemKey?.startsWith('smart-'));
        await uploadDriveFile(file, {
          folder: folderId || '', category: smartUpload || section === 'legal-documents' ? 'legal' : '',
          confidentiality: smartUpload || section === 'legal-documents' ? 'legal_record' : 'private',
          documentType: smartFolder?.name || '',
        }, (percent) => setUploadProgress((current) => ({ ...current, [file.name]: percent })));
        toast.success(`${file.name} uploaded`);
      } catch (error: any) { toast.error(`${file.name}: ${error.message}`); }
      finally { setUploadProgress((current) => { const next = { ...current }; delete next[file.name]; return next; }); }
    }
    await load(); await loadBootstrap();
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files || []); event.target.value = ''; await uploadChosenFiles(chosen);
  }

  async function handleScan(event: ChangeEvent<HTMLInputElement>) {
    const pages = Array.from(event.target.files || []); event.target.value = ''; if (!pages.length) return;
    const pageLabel = `${pages.length} page${pages.length === 1 ? '' : 's'}`;
    const enhanceProgressKey = `Enhancing scan (${pageLabel})`;
    const uploadProgressKey = `Uploading PNG (${pageLabel})`;
    setUploadProgress((current) => ({ ...current, [enhanceProgressKey]: 0, [uploadProgressKey]: 0 }));
    try {
      for (const [index, page] of pages.entries()) {
        const enhancedPage = await enhanceScannedPage(page, (percent) => setUploadProgress((current) => ({ ...current, [enhanceProgressKey]: Math.min(100, Math.round(((index + (percent / 100)) / pages.length) * 100)) })));
        await uploadDriveScannedPng(enhancedPage, {
          folder: folderId || '', name: enhancedPage.name,
          legal: String(section === 'legal-documents' || Boolean(activeSmartFolder)),
          category: section.startsWith('smart-') || Boolean(activeSmartFolder) ? 'legal' : '',
          enhancement: SCAN_ENHANCER_PROFILE,
        }, (percent) => setUploadProgress((current) => ({ ...current, [uploadProgressKey]: Math.min(100, Math.round(((index + (percent / 100)) / pages.length) * 100)) })));
      }
      toast.success(`${pages.length === 1 ? 'Document' : `${pages.length} documents`} cleaned and saved as high-quality original PNG${pages.length === 1 ? '' : 's'}`); await load(); await loadBootstrap();
    } catch (error: any) { toast.error(error.message); }
    finally { setUploadProgress((current) => { const next = { ...current }; delete next[enhanceProgressKey]; delete next[uploadProgressKey]; return next; }); }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault(); setDragActive(false);
    const chosen = Array.from(event.dataTransfer.files || []); void uploadChosenFiles(chosen);
  }

  async function itemAction(item: DriveItem, action: string) {
    setMenu(null);
    try {
      if (action === 'open') return item.itemType === 'folder' ? openFolder(item) : openPreview(item);
      if (action === 'download') return item.itemType === 'folder' ? downloadDriveFolder(item._id, item.name) : downloadDriveFile(item._id, item.name);
      if (action === 'star') item.itemType === 'folder' ? await updateDriveFolder(item._id, { starred: !item.starred }) : await updateDriveFile(item._id, { starred: !item.starred });
      if (action === 'rename') {
        const nextName = await actions.askText(`Enter a new name for “${item.name}”.`, { title: 'Rename item', label: 'New name', initialValue: item.name });
        if (!nextName?.trim() || nextName.trim() === item.name) return;
        if (item.itemType === 'folder') await updateDriveFolder(item._id, { name: nextName.trim() });
        else if (item.itemType === 'file') await updateDriveFile(item._id, { name: nextName.trim() });
        else throw new Error('This item type cannot be renamed.');
        patchVisibleDriveItem(item._id, { name: nextName.trim() });
        toast.success('Renamed successfully'); return;
      }
      if (action === 'trash') {
        if (!item.itemType) throw new Error('This item cannot be deleted because its type is unknown. Refresh the vault and try again.');
        if (!await actions.askConfirmation(`Move “${item.name}” to Trash? You can restore it later.`, { title: 'Move to Trash', danger: true })) return;
        await driveItemAction(item.itemType, item._id, 'trash'); removeVisibleDriveItem(item._id); toast.success('Moved to Trash'); return;
      }
      if (action === 'restore') { await driveItemAction(item.itemType!, item._id, 'restore'); removeVisibleDriveItem(item._id); toast.success('Restored successfully'); return; }
      if (action === 'delete') { if (!await actions.askConfirmation(`Permanently delete “${item.name}”? This cannot be undone.`, { title: 'Permanently delete item', danger: true })) return; await permanentlyDeleteDriveItem(item.itemType!, item._id); removeVisibleDriveItem(item._id); toast.success('Deleted permanently'); return; }
      if (action === 'share') { setShareDialog(item); return; }
      if (action === 'instant-share') { await instantShare(item); return; }
      if (action === 'link') { openLinkDialog(item); return; }
      if (action === 'details') { await openDetails(item); return; }
      toast.success('Updated'); await load(); await loadBootstrap();
    } catch (error: any) { toast.error(error.message); }
  }

  async function openPreview(item: DriveItem) {
    if (item.itemType === 'folder') return openFolder(item);
    try { const blob = await fetchDriveFileBlob(item._id); const url = URL.createObjectURL(blob); setPreview({ item, url }); }
    catch (error: any) { toast.error(error.message); }
  }
  function closePreview() { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); }

  async function openDetails(item: DriveItem) {
    if (item.itemType === 'file') {
      const [fileData, logs, notes] = await Promise.all([getDriveFile(item._id), getDriveActivity(item._id), getDriveComments(item._id)]);
      setDetails(fileData.data); setActivity(logs.data); setComments(notes.data);
    } else { setDetails({ file: item, versions: [], shares: [] }); setActivity((await getDriveActivity(item._id)).data); setComments([]); }
  }

  async function submitShare() {
    if (!shareDialog || !shareEmail) return;
    try { await shareDriveItem(shareDialog.itemType!, shareDialog._id, { email: shareEmail, permission: sharePermission }); toast.success('Access shared'); setShareDialog(null); setShareEmail(''); }
    catch (error: any) { toast.error(error.message); }
  }

  function openLinkDialog(item: DriveItem) {
    setLinkDialog(item); setPublicUrl('');
    setLinkOptions((current) => ({ ...current, restricted: true, allowDownload: false, allowPreview: true, confirmSensitive: false }));
  }

  async function instantShare(item: DriveItem) {
    if (item.itemType !== 'file' || item.status === 'trashed' || item.status === 'archived') return;
    try {
      const blob = await fetchDriveFileBlob(item._id, true);
      const file = new File([blob], item.name, { type: item.mimeType || blob.type || 'application/octet-stream' });
      const canShareFile = typeof navigator.share === 'function' && (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));
      if (canShareFile) {
        try {
          await navigator.share({ title: item.name, files: [file] });
          toast.success('Original file shared successfully.');
        } catch (error: any) {
          if (error?.name === 'AbortError') return;
          const localUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a'); anchor.href = localUrl; anchor.download = item.name; anchor.click();
          URL.revokeObjectURL(localUrl);
          toast.info('File sharing was unavailable, so the original file was downloaded for manual attachment.');
        }
      } else {
        const localUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a'); anchor.href = localUrl; anchor.download = item.name; anchor.click();
        URL.revokeObjectURL(localUrl);
        toast.info('Your browser does not support file sharing, so the original file was downloaded for manual attachment.');
      }
    } catch (error: any) { toast.error(error.message); }
  }

  async function createLink() {
    if (!linkDialog) return;
    try {
      const result = await createDrivePublicLink(linkDialog.itemType!, linkDialog._id, { ...linkOptions, expiresAt: linkOptions.expiresAt || undefined }); setPublicUrl(result.data.url); await navigator.clipboard?.writeText(result.data.url); toast.success(linkOptions.restricted ? 'Restricted link created and copied' : 'Public link created and copied'); await load();
    } catch (error: any) { toast.error(error.message); }
  }

  async function removePublicLink() {
    if (!linkDialog) return; try { await revokeDrivePublicLink(linkDialog.itemType!, linkDialog._id); toast.success('Public access revoked'); setLinkDialog(null); await load(); }
    catch (error: any) { toast.error(error.message); }
  }

  async function buildTemplates() { try { await createDriveLegalTemplates(); toast.success('Legal folders created'); await chooseSection('legal-documents'); } catch (error: any) { toast.error(error.message); } }

  async function addCommentNow() {
    if (!details?.file?._id || !comment.trim()) return; await addDriveComment(details.file._id, comment); setComment(''); setComments((await getDriveComments(details.file._id)).data);
  }

  async function uploadVersionNow(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || !details?.file?._id) return;
    try { await uploadDriveVersion(details.file._id, file, 'New version uploaded from Document Vault'); toast.success('New version uploaded'); await openDetails({ ...details.file, itemType: 'file' }); await load(); }
    catch (error: any) { toast.error(error.message); } event.target.value = '';
  }

  const usage = bootstrap?.usage?.usedBytes || 0; const quota = bootstrap?.quotaBytes || 1; const percent = Math.min(100, usage / quota * 100);
  const workspaceLabel = breadcrumbs.at(-1)?.name || systemSections.find(([key]) => key === section)?.[1] || 'Documents';
  const mobileRecentLabel = selectedStorageDocument?.label || (mobileCategory ? mobileCategories.find((item) => item.category === mobileCategory)?.label || 'Filtered files' : section === 'my-drive' && !folderId ? 'Recent files' : workspaceLabel);

  function openVaultPinDialog() {
    setPinOtpSent(false); setPinOtp(''); setNewPin(''); setConfirmPin(''); setDevelopmentPinOtp(''); setPinDialogError('');
    setPinDialogOpen(true);
  }

  async function sendVaultPinOtp() {
    setPinOtpBusy(true); setPinDialogError('');
    try {
      const response = await requestVaultPinOtp();
      setPinMaskedMobile(response.data.maskedMobile); setDevelopmentPinOtp(response.developmentOtp || ''); setPinOtpSent(true);
      toast.success(response.message || 'SMS verification code sent');
    } catch (error: any) { setPinDialogError(error.message || 'Could not send the verification code'); }
    finally { setPinOtpBusy(false); }
  }

  async function saveVaultPin() {
    if (!/^\d{6}$/.test(newPin)) { setPinDialogError('Choose a six-digit security code'); return; }
    if (newPin !== confirmPin) { setPinDialogError('The two security codes do not match'); return; }
    if (!/^\d{6}$/.test(pinOtp)) { setPinDialogError('Enter the six-digit SMS verification code'); return; }
    setPinSaveBusy(true); setPinDialogError('');
    try {
      const wasLocked = vaultLocked;
      await updateVaultPin(pinOtp, newPin);
      setVaultPinEnabled(true); setVaultLockRequired(true); setPinDialogOpen(false);
      setPinOtpSent(false); setPinOtp(''); setNewPin(''); setConfirmPin(''); setDevelopmentPinOtp('');
      toast.success(vaultPinEnabled ? 'Document Vault security code changed' : 'Document Vault is now protected');
      if (wasLocked) { setVaultLocked(false); void beginVaultUnlock(); }
    } catch (error: any) { setPinDialogError(error.message || 'Could not update the security code'); }
    finally { setPinSaveBusy(false); }
  }

  async function unlockVaultWithPin() {
    if (!/^\d{6}$/.test(unlockPin)) { setVaultLockError('Enter your six-digit Document Vault security code.'); return; }
    setPinUnlockBusy(true); setVaultLockError('');
    try {
      await unlockVaultPin(unlockPin); setUnlockPin('');
      await beginVaultUnlock();
    } catch (error: any) { setVaultLockError(error.message || 'The security code could not be verified'); }
    finally { setPinUnlockBusy(false); }
  }

  async function beginVaultUnlock() {
    const runId = ++vaultUnlockRun.current;
    setVaultLocked(false); setVaultLockError(''); setVaultUnlocking(true);
    try {
      const security = await getSecurityOverview();
      if (runId !== vaultUnlockRun.current) return;
      const pinEnabled = Boolean(security.data.vaultPinEnabled);
      const deviceLockEnabled = Boolean(mobileOrTablet && security.data.deviceUnlockEnabled);
      setVaultPinEnabled(pinEnabled); setVaultLockRequired(pinEnabled || deviceLockEnabled);
      if (pinEnabled && !hasVaultPinUnlockToken()) {
        setVaultUnlocking(false); setVaultLocked(true); setVaultLockError('Enter your six-digit Document Vault security code to continue.');
        return;
      }
      if (deviceLockEnabled) {
        if (!deviceUnlockSupported()) throw new Error('Secure device unlock requires HTTPS and a phone or tablet with screen lock, fingerprint or face unlock enabled.');
        const options = (await beginDeviceUnlockAuthentication()).data;
        const credential = await navigator.credentials.get({ publicKey: authenticationOptionsForBrowser(options) });
        await completeDeviceUnlockAuthentication(serializePublicKeyCredential(credential));
      }
      if (runId !== vaultUnlockRun.current) return;
      await load();
      if (runId !== vaultUnlockRun.current) return;
      setVaultUnlocking(false); setVaultLocked(false);
    } catch (error: any) {
      if (runId !== vaultUnlockRun.current) return;
      const message = error?.name === 'NotAllowedError' ? 'The device prompt was cancelled. Complete fingerprint, face unlock or screen lock to open the vault.' : error?.message || 'The vault could not verify this device.';
      setVaultUnlocking(false); setVaultLocked(true); setVaultLockError(message);
    }
  }

  useEffect(() => {
    void beginVaultUnlock();
    const retryAfterExpiry = () => { void beginVaultUnlock(); };
    window.addEventListener('secureasset:device-unlock-required', retryAfterExpiry);
    return () => { vaultUnlockRun.current += 1; window.removeEventListener('secureasset:device-unlock-required', retryAfterExpiry); };
  }, [mobileOrTablet]);

  // A successful device check is deliberately ephemeral. When a protected
  // phone/tablet vault is left idle or backgrounded, discard the in-memory
  // unlock token and require the platform authenticator again.
  useEffect(() => {
    if ((!vaultPinEnabled && (!mobileOrTablet || !vaultLockRequired)) || vaultUnlocking || vaultLocked) return undefined;
    let timer: number | undefined;
    const lockVault = () => {
      if (timer) window.clearTimeout(timer);
      clearDeviceUnlockToken();
      setUnlockPin(''); setVaultLockError(vaultPinEnabled ? 'The vault was locked after inactivity. Enter your six-digit security code.' : 'The vault was locked after inactivity. Verify this device to continue.');
      setVaultLocked(true);
    };
    const armTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(lockVault, VAULT_IDLE_TIMEOUT_MS);
    };
    const handleVisibility = () => { if (document.visibilityState === 'hidden') lockVault(); else armTimer(); };
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((eventName) => window.addEventListener(eventName, armTimer, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibility);
    armTimer();
    return () => {
      if (timer) window.clearTimeout(timer);
      ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((eventName) => window.removeEventListener(eventName, armTimer));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [mobileOrTablet, vaultLockRequired, vaultLocked, vaultPinEnabled, vaultUnlocking]);

  return <Box className="sa-document-vault-page sa-vault-premium" data-vault-theme={theme.palette.mode} aria-busy={vaultUnlocking || vaultLocked} sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }}>
    {(vaultUnlocking || vaultLocked) && <Box className="sa-vault-unlock-overlay" role={vaultLocked ? 'dialog' : 'status'} aria-modal={vaultLocked || undefined} aria-live="polite" aria-label="Unlocking secure document vault" data-vault-state={vaultLocked ? 'locked' : 'unlocking'}>
      <Box className="sa-vault-unlock-grid" />
      <Box className="sa-vault-unlock-scanline" />
      <Stack className="sa-vault-unlock-content" alignItems="center" spacing={2.2}>
        <Box className="sa-vault-unlock-orb">
          <Box className="sa-vault-unlock-ring sa-vault-unlock-ring-one" />
          <Box className="sa-vault-unlock-ring sa-vault-unlock-ring-two" />
          <Box className="sa-vault-unlock-ring sa-vault-unlock-ring-three" />
          <Box className="sa-vault-unlock-core">
            <LockRounded className="sa-vault-lock-closed" />
            <LockOpenRounded className="sa-vault-lock-open" />
          </Box>
        </Box>
        <Stack alignItems="center" spacing={.8}>
          <Chip className="sa-vault-unlock-chip" icon={<SecurityRounded />} label="Secure access protocol" size="small" />
          <Typography className="sa-vault-unlock-title">{vaultLocked ? 'Document Vault is locked' : vaultLockRequired ? 'Confirm your security' : 'Unlocking your document vault'}</Typography>
          <Typography className="sa-vault-unlock-subtitle">{vaultLocked ? vaultLockError : vaultPinEnabled ? 'Enter your six-digit security code to continue' : vaultLockRequired ? 'Use fingerprint, face unlock or your screen lock to continue' : 'Verifying your session and protected storage'}</Typography>
        </Stack>
        {vaultLocked && vaultPinEnabled ? <Stack className="sa-vault-pin-unlock-form" alignItems="center" spacing={1.2}>
          <TextField className="sa-vault-pin-input" fullWidth autoFocus value={unlockPin} onChange={(event) => setUnlockPin(event.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={(event) => { if (event.key === 'Enter') void unlockVaultWithPin(); }} type="password" label="6-digit security code" inputProps={{ inputMode: 'numeric', maxLength: 6, autoComplete: 'one-time-code', 'aria-label': 'Six-digit Document Vault security code' }} />
          <Button className="sa-vault-pin-unlock-button" fullWidth variant="contained" startIcon={<LockOpenRounded />} disabled={pinUnlockBusy || unlockPin.length !== 6} onClick={() => void unlockVaultWithPin()}>{pinUnlockBusy ? 'Verifying code…' : 'Unlock Document Vault'}</Button>
          <Button size="small" onClick={openVaultPinDialog} sx={{ color: 'rgba(232,250,255,.82)', textTransform: 'none' }}>Change or reset code with SMS verification</Button>
        </Stack> : vaultLocked ? <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button className="sa-light-button" variant="contained" startIcon={<LockOpenRounded />} onClick={() => void beginVaultUnlock()} sx={{ bgcolor: '#8effc5', color: '#073a4c', '&:hover': { bgcolor: '#c1ffdf' } }}>Try device unlock again</Button><Button variant="outlined" onClick={() => window.location.assign('/app/security')} sx={{ color: 'white', borderColor: 'rgba(255,255,255,.4)' }}>Open Security</Button></Stack> : <Box className="sa-vault-unlock-progress"><Box className="sa-vault-unlock-progress-bar" /></Box>}
        <Stack direction="row" spacing={2.2} className="sa-vault-unlock-signals">
          <Stack direction="row" alignItems="center" spacing={.55}><Box className="sa-vault-signal-dot" /> {vaultLocked ? 'Vault access paused' : vaultLockRequired ? 'Security verification required' : 'Identity verified'}</Stack>
          <Stack direction="row" alignItems="center" spacing={.55}><Box className="sa-vault-signal-dot" /> Access scope checked</Stack>
        </Stack>
      </Stack>
    </Box>}
    <ProfessionalDialog className="sa-vault-pin-dialog" open={pinDialogOpen} onClose={() => !pinSaveBusy && setPinDialogOpen(false)} fullWidth maxWidth="xs" enableMinimize={false} enableMaximize={false} sx={{ zIndex: 1700 }}>
      <DialogTitle sx={{ fontWeight: 900 }}>{vaultPinEnabled ? 'Change vault security code' : 'Protect the Document Vault'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.6} sx={{ mt: .5 }}>
          <Alert severity="info">We’ll verify your registered mobile with a one-time code from Fast2SMS before saving this six-digit security code.</Alert>
          {pinDialogError && <Alert severity="error">{pinDialogError}</Alert>}
          {pinOtpSent && <>
            <Alert severity="success">Verification code sent to {pinMaskedMobile || 'your registered mobile'}.</Alert>
            {developmentPinOtp && <Alert severity="warning">Development OTP: <strong>{developmentPinOtp}</strong></Alert>}
            <TextField fullWidth autoFocus label="SMS verification code" value={pinOtp} onChange={(event) => setPinOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputProps={{ inputMode: 'numeric', maxLength: 6, autoComplete: 'one-time-code' }} />
            <TextField fullWidth label="New six-digit security code" type="password" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputProps={{ inputMode: 'numeric', maxLength: 6, autoComplete: 'new-password' }} />
            <TextField fullWidth label="Confirm security code" type="password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputProps={{ inputMode: 'numeric', maxLength: 6, autoComplete: 'new-password' }} />
            <Button size="small" disabled={pinOtpBusy} onClick={() => void sendVaultPinOtp()}>{pinOtpBusy ? 'Sending…' : 'Send a new verification code'}</Button>
          </>}
          {!pinOtpSent && <Button fullWidth variant="outlined" startIcon={<SecurityRounded />} disabled={pinOtpBusy} onClick={() => void sendVaultPinOtp()}>{pinOtpBusy ? 'Sending verification code…' : 'Send verification code'}</Button>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={() => setPinDialogOpen(false)} disabled={pinSaveBusy}>Cancel</Button><Button variant="contained" disabled={!pinOtpSent || pinSaveBusy || pinOtp.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6} onClick={() => void saveVaultPin()}>{pinSaveBusy ? 'Saving…' : vaultPinEnabled ? 'Change security code' : 'Protect vault'}</Button></DialogActions>
    </ProfessionalDialog>
    <Stack data-secureasset-document-vault-toolbar="compact-v151" data-secureasset-document-vault-layout="record-workspace-v1" className="sa-vault-heading">
      <Stack direction="row" spacing={1.6} alignItems="center">
        <Box className="sa-vault-brand-mark"><SecurityRounded /></Box>
        <Box><Typography className="sa-vault-kicker">SECUREASSET / PRIVATE WORKSPACE</Typography><Typography component="h1" className="sa-vault-heading-title">Document vault</Typography><Typography className="sa-vault-heading-copy">Private document workspace. Everything important, thoughtfully organised.</Typography></Box>
      </Stack>
      <Stack direction="row" className="sa-vault-heading-actions" spacing={1}>
        <Button variant="outlined" startIcon={<CameraAltRounded />} onClick={() => scanRef.current?.click()}>Scan document</Button>
        <Button variant="contained" startIcon={<CloudUploadRounded />} onClick={() => inputRef.current?.click()}>Upload files</Button>
      </Stack>
    </Stack>
    <Box className="sa-vault-overview" aria-label="Vault overview">
      <Paper elevation={0} className="sa-vault-overview-card sa-vault-access-card">
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography className="sa-vault-stat-label">ACCESS PROTECTION</Typography><SecurityRounded /></Stack>
        <Typography className="sa-vault-stat-value">{vaultUnlocking ? 'Checking access' : vaultLocked ? 'Vault locked' : vaultPinEnabled ? 'Security code enabled' : vaultLockRequired ? 'Device verification' : 'Account access'}</Typography>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}><Typography className="sa-vault-stat-detail">{vaultLockRequired ? 'Auto-lock after 10 minutes idle' : 'Add a six-digit vault code'}</Typography><Button onClick={openVaultPinDialog} endIcon={<ChevronRightRounded />}>{vaultPinEnabled ? 'Manage' : 'Set up'}</Button></Stack>
      </Paper>
      <Paper elevation={0} className="sa-vault-overview-card">
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography className="sa-vault-stat-label">STORAGE</Typography><StorageRounded /></Stack>
        <Typography className="sa-vault-stat-value">{bootstrap ? formatBytes(usage) : '—'}<Box component="span">{bootstrap ? ` / ${formatBytes(quota)}` : ' Loading'}</Box></Typography>
        <LinearProgress aria-label="Vault storage usage" variant="determinate" value={percent} color={percent >= 90 ? 'error' : percent >= 75 ? 'warning' : 'primary'} />
        <Typography className="sa-vault-stat-detail">{bootstrap ? `${formatBytes(Math.max(0, quota - usage))} available` : 'Checking available storage'}</Typography>
      </Paper>
      <Paper elevation={0} className="sa-vault-overview-card sa-vault-privacy-card">
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography className="sa-vault-stat-label">SHARING CONTROL</Typography><LockRounded /></Stack>
        <Typography className="sa-vault-stat-value">Private by default</Typography>
        <Typography className="sa-vault-stat-detail">You choose who can access your documents.</Typography>
      </Paper>
    </Box>
    <Box className="sa-vault-upload-progress" aria-live="polite">{Object.entries(uploadProgress).map(([name, progress]) => <Paper key={name} sx={{ p: 1.5, mb: 1.5, borderRadius: 3 }}><Stack direction="row" justifyContent="space-between"><Typography variant="body2" sx={{ fontWeight: 600 }}>{name}</Typography><Typography variant="caption">{progress}%</Typography></Stack><LinearProgress aria-label={`Uploading ${name}`} variant="determinate" value={progress} sx={{ mt: 1, borderRadius: 9 }} /></Paper>)}</Box>
    <Box className="sa-vault-mobile-shell" aria-label="SecureAsset mobile and tablet document drive">
      <TextField className="sa-vault-mobile-search" fullWidth size="small" placeholder="Search your documents" value={search} onChange={(e) => setSearch(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton size="small" aria-label="Upload files" onClick={() => inputRef.current?.click()}><CloudUploadRounded fontSize="small" /></IconButton></InputAdornment> }} />
      <Box className="sa-vault-mobile-navigation" component="nav" aria-label="Vault sections">{systemSections.map(([key, label, Icon]) => <Button key={key} aria-current={section === key && !mobileCategory ? 'page' : undefined} startIcon={<Icon />} onClick={() => void chooseSection(key)}>{label}</Button>)}</Box>

      <Stack direction="row" alignItems="center" justifyContent="space-between" className="sa-vault-mobile-section-heading">
        <Box><Typography>Quick Access</Typography><Typography>Tap a category to open its protected files</Typography></Box>
        <Stack direction="row" spacing={.6} alignItems="center"><Button onClick={() => setFolderDialog(true)} startIcon={<AddRounded />}>Folder</Button></Stack>
      </Stack>
      <Box className="sa-vault-mobile-category-grid" data-secureasset-document-vault-storage-categories="four-icon-cards-v160" data-secureasset-document-vault-storage-categories-v187="document-essentials-v187" data-secureasset-document-vault-storage-documents="pan-birth-passport-voter-aadhaar-driving-land-patta-v187" data-secureasset-document-vault-quick-access="transparent-cards-v205" data-secureasset-document-vault-quick-access-mobile="white-premium-cards-v213">
        {mobileCategories.map((item) => {
          const Icon = item.icon;
          const active = (item.action === 'category' && mobileCategory === item.category) || (item.action === 'section' && section === item.category) || (item.action === 'smart-folder' && section === item.category);
          return <Paper key={item.key} className={`sa-vault-mobile-category-tile${active ? ' is-active' : ''}${item.action === 'smart-folder' ? ' is-smart-folder' : ''}`} elevation={0} onClick={() => void chooseMobileCategory(item.category, item.action)} role="button" tabIndex={0} aria-pressed={active} aria-label={`Open ${item.label} files`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void chooseMobileCategory(item.category, item.action); } }}>
            <Box className={`sa-vault-mobile-category-icon is-${item.key}`}>{design.iconAssets.quickAccess[item.key] ? <Box component="img" src={design.iconAssets.quickAccess[item.key]} alt="" aria-hidden="true" sx={{ width: 30, height: 30, objectFit: 'contain' }} /> : <Icon sx={{ color: (item as { color?: string }).color }} />}</Box><Typography>{item.label}</Typography>
          </Paper>;
        })}
      </Box>

      <Box className="sa-vault-mobile-actions"><Button onClick={() => scanRef.current?.click()} startIcon={<CameraAltRounded />}>Scan securely to PNG</Button><Button onClick={() => inputRef.current?.click()} startIcon={<CloudUploadRounded />}>Upload</Button></Box>

      {breadcrumbs.length > 0 && <Breadcrumbs className="sa-vault-mobile-breadcrumbs" aria-label="Document folder path" maxItems={3}>{breadcrumbs.map((crumb) => <Button key={crumb._id} size="small" onClick={() => void openFolder(crumb)}>{crumb.name}</Button>)}</Breadcrumbs>}
      <Stack direction="row" alignItems="center" justifyContent="space-between" className={`sa-vault-mobile-section-heading sa-vault-mobile-files-heading${selectedStorageDocument ? ' is-storage-folder' : ''}`} data-secureasset-document-vault-mobile-content={selectedStorageDocument ? `storage-folder-${selectedStorageDocument.key}-v189` : 'recent-files-v188'}>
        <Box><Typography>{mobileRecentLabel}</Typography><Typography>{`${mobileMatchingItems.length} item${mobileMatchingItems.length === 1 ? '' : 's'}`}</Typography></Box>
        {selectedStorageDocument ? <Button onClick={() => void chooseSection('recent')}>Back</Button> : <Button onClick={() => void chooseSection('recent')}>View all</Button>}
      </Stack>
      <Stack className={selectedStorageDocument ? 'sa-vault-mobile-folder-list' : 'sa-vault-mobile-recent-list'} data-secureasset-document-vault-recent-files="thumbnail-list-v160" data-secureasset-document-vault-folder-only={selectedStorageDocument ? selectedStorageDocument.key : undefined}>
        {loading ? <Box className="sa-vault-mobile-empty"><CircularProgress size={24} /><Typography>Loading your files…</Typography></Box> : mobileRecentItems.length === 0 ? <Box className="sa-vault-mobile-empty"><FolderOpenRounded /><Typography>{search ? 'No matching documents' : selectedStorageDocument ? `No ${selectedStorageDocument.label} files yet` : 'Your documents belong here'}</Typography><Button onClick={() => search ? setSearch('') : inputRef.current?.click()}>{search ? 'Clear search' : 'Upload a document'}</Button></Box> : <Box className="sa-vault-mobile-recent-grid">{mobileRecentItems.map((item) => <Paper key={`mobile-${item.itemType}-${item._id}`} className="sa-vault-mobile-recent-card" elevation={0} onClick={() => void itemAction(item, 'open')} role="button" tabIndex={0} aria-label={`Open ${item.name}`} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); void itemAction(item, 'open'); } }}>
          <Box className="sa-vault-mobile-recent-card-media"><VaultRecentThumbnail item={item} full /><IconButton size="small" aria-label={`Open actions for ${item.name}`} onClick={(event) => { event.stopPropagation(); setMenu({ anchor: event.currentTarget, item }); }}><MoreVertRounded fontSize="small" /></IconButton></Box>
          <Box sx={{ minWidth: 0 }}><Typography noWrap>{item.name}</Typography><Typography noWrap>{item.itemType === 'folder' ? 'Protected folder' : `${item.category || 'Document'} · ${formatBytes(item.sizeBytes)}`}</Typography><Typography className="sa-vault-mobile-file-date" noWrap>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Protected file'}</Typography></Box>
          <Button className="sa-vault-card-share-button" fullWidth startIcon={<VaultConfiguredIcon source={design.iconAssets.globalShare} fallback={<ShareRounded />} />} disabled={item.itemType === 'folder'} onClick={(event) => { event.stopPropagation(); void instantShare(item); }}>Share</Button>
        </Paper>)}</Box>}
      </Stack>
      {mobilePageCount > 1 && <Pagination className="sa-vault-mobile-pagination" aria-label="Document pages" count={mobilePageCount} page={currentMobilePage} onChange={(_event, page) => setMobilePage(page)} size="small" siblingCount={0} />}

    </Box>
    <Tooltip title="Scan securely to PNG" placement="left">
      <IconButton className="sa-vault-mobile-floating-scan" aria-label="Open secure document scanner" onClick={() => scanRef.current?.click()}>
        <CameraAltRounded />
      </IconButton>
    </Tooltip>

    <input ref={inputRef} hidden type="file" multiple onChange={handleFiles} /><input ref={scanRef} hidden type="file" accept="image/jpeg,image/png" multiple capture="environment" onChange={handleScan} />

    <Box className="sa-vault-desktop-workspace" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '218px minmax(0,1fr)' }, gap: 2.5 }}>
      <Paper className="sa-surface-card sa-vault-collection-nav" component="nav" aria-label="Vault sections" elevation={0} sx={{ p: 1.2, borderRadius: 4, alignSelf: 'start', position: { lg: 'sticky' }, top: { lg: 92 } }}>
        <Typography className="sa-vault-sidebar-heading">Library</Typography>
        <List dense>{systemSections.map(([key, label, Icon]) => <ListItemButton key={key} selected={section === key} onClick={() => chooseSection(key)} sx={{ borderRadius: 2.5, mb: .4 }}><ListItemIcon sx={{ minWidth: 38 }}><Icon fontSize="small" /></ListItemIcon><ListItemText primary={label} primaryTypographyProps={{ fontWeight: section === key ? 800 : 600, fontSize: 13 }} /></ListItemButton>)}</List>
        <Divider sx={{ my: 1 }} />
        <Typography className="sa-vault-sidebar-heading">Quick Access</Typography>
        <List dense>{storageDocumentFolders.map((document) => { const Icon = document.icon; const active = section === document.systemKey && folderId === document._id; return <ListItemButton key={`storage-${document.key}`} selected={active} onClick={() => void openStorageDocument(document)} sx={{ borderRadius: 2.5, mb: .25, pl: 1.5 }}><ListItemIcon sx={{ minWidth: 34 }}><Icon fontSize="small" sx={{ color: document.color }} /></ListItemIcon><ListItemText primary={document.label} secondary={`${document.fileCount || 0} records`} primaryTypographyProps={{ fontWeight: active ? 800 : 600, fontSize: 11 }} secondaryTypographyProps={{ fontSize: 9 }} /></ListItemButton>; })}</List>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ p: 1.5 }}><Stack direction="row" alignItems="center" gap={1}><StorageRounded color="primary" /><Typography variant="body2" sx={{ fontWeight: 800 }}>Storage</Typography></Stack><LinearProgress variant="determinate" value={percent} color={percent >= 90 ? 'error' : percent >= 75 ? 'warning' : 'primary'} sx={{ mt: 1.2, height: 8, borderRadius: 9 }} /><Typography variant="caption" color="text.secondary">{formatBytes(usage)} of {formatBytes(quota)} used</Typography></Box>
      </Paper>

      <Paper className="sa-surface-card sa-vault-library" elevation={0} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }} onDrop={handleDrop} sx={{ borderRadius: 4, overflow: 'hidden', minHeight: 590, position: 'relative', outline: dragActive ? '2px dashed' : 'none', outlineColor: 'primary.main', outlineOffset: -8 }}>
        <Stack className="sa-vault-library-heading" direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Box><Typography className="sa-vault-kicker">YOUR DOCUMENT LIBRARY</Typography><Typography component="h2">{workspaceLabel}</Typography></Box>
          <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setFolderDialog(true)}>New folder</Button>
        </Stack>
        {dragActive && <Box sx={{ position: 'absolute', inset: 0, zIndex: 5, bgcolor: 'rgba(11,82,112,.12)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}><Paper sx={{ px: 4, py: 3, borderRadius: 4, textAlign: 'center' }}><CloudUploadRounded color="primary" sx={{ fontSize: 52 }} /><Typography variant="h6" sx={{ fontWeight: 900 }}>Drop files to upload</Typography><Typography color="text.secondary">Files remain private by default.</Typography></Paper></Box>}
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1.5} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box>
            <Breadcrumbs maxItems={5}>{breadcrumbs.map((crumb) => <Button key={crumb._id} size="small" onClick={() => openFolder(crumb)} sx={{ minWidth: 0 }}>{crumb.name}</Button>)}</Breadcrumbs>
            <Typography variant="caption" color="text.secondary">{filtered.length} item{filtered.length === 1 ? '' : 's'}</Typography>
          </Box>
          <Stack direction="row" gap={1} alignItems="center"><TextField size="small" placeholder="Search this folder" value={search} onChange={(e) => setSearch(e.target.value)} inputProps={{ 'aria-label': 'Search this folder' }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} sx={{ minWidth: { sm: 230 } }} /><Tooltip title="Refresh"><IconButton aria-label="Refresh documents" onClick={() => load()}><RefreshRounded /></IconButton></Tooltip><Tooltip title={view === 'grid' ? 'List view' : 'Grid view'}><IconButton aria-label={view === 'grid' ? 'Switch to list view' : 'Switch to grid view'} onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>{view === 'grid' ? <ListRounded /> : <GridViewRounded />}</IconButton></Tooltip></Stack>
        </Stack>

        {section === 'legal-documents' && <Alert severity="info" action={<Button color="inherit" size="small" onClick={buildTemplates}>Create templates</Button>} sx={{ m: 2 }}>Legal records are private by default. Public sharing requires explicit confirmation and creates a permanent audit record.</Alert>}
        {section === 'trash' && <Alert severity="warning" sx={{ m: 2 }}>Items are retained for the configured recovery period. Final signed legal records cannot be permanently deleted by normal users.</Alert>}

        {loading ? <Box className="sa-vault-library-empty"><CircularProgress size={28} /><Typography>Loading your documents…</Typography></Box> : filtered.length === 0 ? <Box className="sa-vault-library-empty"><Box className="sa-vault-empty-emblem"><FolderOpenRounded /></Box><Typography component="h3">{search ? 'No matching documents' : 'A place for what matters'}</Typography><Typography>{search ? 'Try another name, description or tag.' : 'Keep your identity, property and legal records together.'}</Typography><Button variant="contained" startIcon={search ? <SearchRounded /> : <CloudUploadRounded />} onClick={() => search ? setSearch('') : inputRef.current?.click()}>{search ? 'Clear search' : 'Upload your first document'}</Button><Typography variant="caption">New uploads are private by default.</Typography></Box> : view === 'grid' ?
          <Box className="sa-vault-recent-grid" sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 1.5 }}>{filtered.map((item) => <Paper key={`${item.itemType}-${item._id}`} className="sa-vault-recent-card" variant="outlined" onClick={() => void itemAction(item, 'open')} role="button" tabIndex={0} aria-label={`Open ${item.name}`} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); void itemAction(item, 'open'); } }} sx={{ p: 0, borderRadius: 3, cursor: 'pointer', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: '.18s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 } }}><Box className="sa-vault-recent-card-media"><VaultRecentThumbnail item={item} full /><IconButton size="small" aria-label={`Open actions for ${item.name}`} onClick={(event) => { event.stopPropagation(); setMenu({ anchor: event.currentTarget, item }); }}><MoreVertRounded fontSize="small" /></IconButton></Box><Box sx={{ px: 1.5, pt: 1.4, minWidth: 0, flex: 1 }}><Typography noWrap sx={{ fontWeight: 800, fontSize: 13.5 }}>{item.name}</Typography><Typography variant="caption" color="text.secondary">{item.itemType === 'folder' ? 'Folder' : formatBytes(item.sizeBytes)}</Typography><Stack direction="row" gap={.5} sx={{ mt: 1.2 }} flexWrap="wrap">{visibilityChip(item)}{item.starred && <StarRounded color="warning" sx={{ fontSize: 20 }} />}{item.immutable && <VerifiedRounded color="success" sx={{ fontSize: 20 }} />}</Stack></Box><Button className="sa-vault-card-share-button" fullWidth startIcon={<VaultConfiguredIcon source={design.iconAssets.globalShare} fallback={<ShareRounded />} />} disabled={item.itemType === 'folder'} onClick={(event) => { event.stopPropagation(); void instantShare(item); }}>Share</Button></Paper>)}</Box> :
          <Box className="sa-vault-record-list" data-secureasset-document-vault-records="list-v1" role="table">
            <Box className="sa-vault-record-list-head" role="row"><Typography role="columnheader">Document</Typography><Typography role="columnheader">Access</Typography><Typography role="columnheader">Modified</Typography><Typography role="columnheader">Size</Typography><Typography role="columnheader" aria-label="Actions" /></Box>
            {filtered.map((item) => <Box key={`${item.itemType}-${item._id}`} className="sa-vault-record-row" role="row" tabIndex={0} onClick={() => void itemAction(item, 'open')} onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === 'Enter') void itemAction(item, 'open'); }}>
              <Box className="sa-vault-record-document" role="cell"><VaultRecentThumbnail item={item} /><Box className="sa-vault-record-name"><Typography noWrap>{item.name}</Typography><Typography noWrap>{item.description || (item.itemType === 'folder' ? 'Protected folder' : item.category || 'Document')}</Typography></Box></Box>
              <Box role="cell">{visibilityChip(item)}{item.immutable && <VerifiedRounded color="success" sx={{ ml: .5, fontSize: 17, verticalAlign: 'middle' }} />}</Box>
              <Typography className="sa-vault-record-date" role="cell">{formatVaultDate(item.updatedAt || item.createdAt)}</Typography>
              <Typography className="sa-vault-record-size" role="cell">{item.itemType === 'folder' ? '—' : formatBytes(item.sizeBytes)}</Typography>
              <IconButton size="small" aria-label={`Actions for ${item.name}`} onClick={(event) => { event.stopPropagation(); setMenu({ anchor: event.currentTarget, item }); }}><MoreVertRounded fontSize="small" /></IconButton>
            </Box>)}
          </Box>}
      </Paper>
    </Box>

    <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)} PaperProps={{ sx: { minWidth: 210, borderRadius: 3 } }}>
      <MenuItem data-secureasset-document-vault-recent-action="preview" onClick={() => menu && itemAction(menu.item, 'open')}><PreviewRounded fontSize="small" sx={{ mr: 1.3 }} />Preview</MenuItem>
      <MenuItem onClick={() => menu && itemAction(menu.item, 'download')}><DownloadRounded fontSize="small" sx={{ mr: 1.3 }} />Download</MenuItem>
      <MenuItem onClick={() => menu && itemAction(menu.item, 'star')}>{menu?.item.starred ? <StarRounded fontSize="small" sx={{ mr: 1.3 }} /> : <StarBorderRounded fontSize="small" sx={{ mr: 1.3 }} />} {menu?.item.starred ? 'Remove star' : 'Add to Starred'}</MenuItem>
      <MenuItem data-secureasset-document-vault-recent-action="rename" onClick={() => menu && itemAction(menu.item, 'rename')}><EditRounded fontSize="small" sx={{ mr: 1.3 }} />Rename</MenuItem>
      <MenuItem data-secureasset-document-vault-sharing="direct-original-file-v197" onClick={() => menu && itemAction(menu.item, 'instant-share')}><VaultConfiguredIcon source={design.iconAssets.globalShare} fallback={<ContentCopyRounded fontSize="small" />} size={18} /> <Box component="span" sx={{ ml: 1.3 }}>Share</Box></MenuItem>
      <MenuItem onClick={() => menu && itemAction(menu.item, 'share')}><VaultConfiguredIcon source={design.iconAssets.globalShare} fallback={<ShareRounded fontSize="small" />} size={18} /> <Box component="span" sx={{ ml: 1.3 }}>Share privately</Box></MenuItem>
      <MenuItem onClick={() => menu && itemAction(menu.item, 'link')}><LinkRounded fontSize="small" sx={{ mr: 1.3 }} />Public / restricted link</MenuItem>
      <MenuItem onClick={() => menu && itemAction(menu.item, 'details')}><DescriptionRounded fontSize="small" sx={{ mr: 1.3 }} />Details & versions</MenuItem><Divider />
      {section === 'trash' ? <><MenuItem onClick={() => menu && itemAction(menu.item, 'restore')}><RestoreFromTrashRounded fontSize="small" sx={{ mr: 1.3 }} />Restore</MenuItem><MenuItem onClick={() => menu && itemAction(menu.item, 'delete')} sx={{ color: 'error.main' }}><DeleteForeverRounded fontSize="small" sx={{ mr: 1.3 }} />Delete permanently</MenuItem></> : <MenuItem data-secureasset-document-vault-recent-action="delete" onClick={() => menu && itemAction(menu.item, 'trash')} sx={{ color: 'error.main' }}><DeleteOutlineRounded fontSize="small" sx={{ mr: 1.3 }} />Delete</MenuItem>}
    </Menu>

    <ProfessionalDialog open={folderDialog} onClose={() => setFolderDialog(false)} fullWidth maxWidth="xs"><DialogTitle sx={{ fontWeight: 900 }}>Create folder</DialogTitle><DialogContent><TextField autoFocus fullWidth label="Folder name" value={folderName} onChange={(e) => setFolderName(e.target.value)} sx={{ mt: 1 }} /></DialogContent><DialogActions><Button onClick={() => setFolderDialog(false)}>Cancel</Button><Button variant="contained" onClick={createFolder}>Create</Button></DialogActions></ProfessionalDialog>

    <ProfessionalDialog open={Boolean(shareDialog)} onClose={() => setShareDialog(null)} fullWidth maxWidth="sm"><DialogTitle sx={{ fontWeight: 900 }}>Share “{shareDialog?.name}”</DialogTitle><DialogContent><Stack gap={2} sx={{ mt: 1 }}><TextField label="User or external email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} /><FormControl><Select value={sharePermission} onChange={(e) => setSharePermission(e.target.value)}>{['viewer','commenter','downloader','uploader','editor','manager','co_owner'].map((x) => <MenuItem key={x} value={x}>{x.replace('_',' ')}</MenuItem>)}</Select></FormControl><Alert severity="info">Removing access immediately removes the item from the recipient’s Shared With Me section.</Alert></Stack></DialogContent><DialogActions><Button onClick={() => setShareDialog(null)}>Cancel</Button><Button variant="contained" onClick={submitShare}>Share</Button></DialogActions></ProfessionalDialog>

    <ProfessionalDialog open={Boolean(linkDialog)} onClose={() => setLinkDialog(null)} fullWidth maxWidth="sm"><DialogTitle sx={{ fontWeight: 900 }}>Public or restricted link</DialogTitle><DialogContent><Stack gap={2} sx={{ mt: 1 }}><Stack direction="row" gap={1}><Button fullWidth variant={linkOptions.restricted ? 'contained' : 'outlined'} onClick={() => setLinkOptions({ ...linkOptions, restricted: !linkOptions.restricted })}>{linkOptions.restricted ? 'Restricted link' : 'Public link'}</Button><Button fullWidth variant={linkOptions.allowPreview ? 'contained' : 'outlined'} onClick={() => setLinkOptions({ ...linkOptions, allowPreview: !linkOptions.allowPreview })}>{linkOptions.allowPreview ? 'Preview allowed' : 'Preview blocked'}</Button><Button fullWidth variant={linkOptions.allowDownload ? 'contained' : 'outlined'} onClick={() => setLinkOptions({ ...linkOptions, allowDownload: !linkOptions.allowDownload })}>{linkOptions.allowDownload ? 'Downloads allowed' : 'Downloads blocked'}</Button></Stack><TextField label="Custom link name (optional)" value={linkOptions.slug} onChange={(e) => setLinkOptions({ ...linkOptions, slug: e.target.value })} /><TextField label="Optional password" type="password" value={linkOptions.password} onChange={(e) => setLinkOptions({ ...linkOptions, password: e.target.value })} /><Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}><TextField fullWidth label="Access starts" type="datetime-local" InputLabelProps={{ shrink: true }} value={linkOptions.startsAt} onChange={(e) => setLinkOptions({ ...linkOptions, startsAt: e.target.value })} /><TextField fullWidth label="Link expiry" type="datetime-local" InputLabelProps={{ shrink: true }} value={linkOptions.expiresAt} onChange={(e) => setLinkOptions({ ...linkOptions, expiresAt: e.target.value })} /></Stack><Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}><TextField fullWidth label="Maximum views" type="number" value={linkOptions.maxViews} onChange={(e) => setLinkOptions({ ...linkOptions, maxViews: e.target.value })} /><TextField fullWidth label="Maximum downloads" type="number" value={linkOptions.maxDownloads} onChange={(e) => setLinkOptions({ ...linkOptions, maxDownloads: e.target.value })} /></Stack><TextField label="Allowed emails (comma separated)" value={linkOptions.allowedEmails} onChange={(e) => setLinkOptions({ ...linkOptions, allowedEmails: e.target.value })} /><TextField label="Allowed email domains (comma separated)" placeholder="company.com" value={linkOptions.allowedDomains} onChange={(e) => setLinkOptions({ ...linkOptions, allowedDomains: e.target.value })} /><TextField label="Allowed country codes (comma separated)" placeholder="IN, SG" value={linkOptions.allowedCountries} onChange={(e) => setLinkOptions({ ...linkOptions, allowedCountries: e.target.value })} />{linkDialog && (linkDialog.sensitive || linkDialog.category === 'legal' || ['confidential','highly_confidential','legal_record','identity_document','financial_document'].includes(linkDialog.confidentiality)) && <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => setLinkOptions({ ...linkOptions, confirmSensitive: true })}>{linkOptions.confirmSensitive ? 'Confirmed' : 'I understand'}</Button>}>This protected record may contain identity numbers, signatures, financial details or confidential legal information. Consider sharing a redacted copy.</Alert>}{publicUrl && <TextField label="Share link" value={publicUrl} InputProps={{ readOnly: true, endAdornment: <InputAdornment position="end"><Button onClick={() => navigator.clipboard.writeText(publicUrl)}>Copy</Button></InputAdornment> }} />}</Stack></DialogContent><DialogActions><Button color="error" onClick={removePublicLink}>Revoke existing link</Button><Box sx={{ flex: 1 }} /><Button onClick={() => setLinkDialog(null)}>Close</Button><Button variant="contained" onClick={createLink}>{linkOptions.restricted ? 'Generate restricted link' : 'Generate public link'}</Button></DialogActions></ProfessionalDialog>

    <ProfessionalDialog open={Boolean(preview)} onClose={closePreview} fullScreen><DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography sx={{ fontWeight: 900 }}>{preview?.item.name}</Typography><Typography variant="caption" color="text.secondary">{preview?.item.mimeType}</Typography></Box><Stack direction="row"><Button startIcon={<DownloadRounded />} onClick={() => preview && downloadDriveFile(preview.item._id, preview.item.name)}>Download</Button><Button onClick={closePreview}>Close</Button></Stack></DialogTitle><DialogContent dividers sx={{ bgcolor: '#101418', display: 'grid', placeItems: 'center', p: 1 }}>{preview && (preview.item.mimeType?.startsWith('image/') ? <img src={preview.url} alt={preview.item.name} style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }} /> : preview.item.mimeType?.startsWith('video/') ? <video src={preview.url} controls style={{ maxWidth: '100%', maxHeight: '85vh' }} /> : preview.item.mimeType?.startsWith('audio/') ? <audio src={preview.url} controls /> : preview.item.mimeType?.includes('pdf') || preview.item.mimeType?.startsWith('text/') ? <iframe title={preview.item.name} src={preview.url} style={{ width: '100%', height: '86vh', border: 0, background: 'white' }} /> : <Alert severity="info">Preview is unavailable for this file type. Download the file to open it.</Alert>)}</DialogContent></ProfessionalDialog>

    {actions.dialogs}
    <Drawer anchor="right" open={Boolean(details)} onClose={() => setDetails(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 2.5 } }}>
      {details && <><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" sx={{ fontWeight: 900 }}>{details.file?.name}</Typography><Typography variant="caption" color="text.secondary">{formatBytes(details.file?.sizeBytes)} · Version {details.file?.currentVersion || 1}</Typography></Box><IconButton onClick={() => setDetails(null)}><MoreVertRounded /></IconButton></Stack><Tabs value={0} sx={{ mt: 2 }}><Tab label="Details" /><Tab label="Activity" /><Tab label="Comments" /></Tabs><Divider />
        <Stack gap={1.3} sx={{ py: 2 }}><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Visibility</Typography>{visibilityChip(details.file)}</Stack><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Confidentiality</Typography><Typography sx={{ textTransform: 'capitalize' }}>{details.file?.confidentiality?.replaceAll('_',' ')}</Typography></Stack><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Approval</Typography><Chip size="small" label={details.file?.approval?.status || 'draft'} /></Stack><Button component="label" variant="outlined" startIcon={<CloudUploadRounded />}>Upload new version<input hidden type="file" onChange={uploadVersionNow} /></Button><Stack direction="row" gap={1}><Button fullWidth variant="outlined" onClick={() => setDriveFileApproval(details.file._id, { status: 'submitted' }).then(() => openDetails({ ...details.file, itemType: 'file' }))}>Request approval</Button><Button fullWidth variant="outlined" color="success" onClick={() => setDriveFileApproval(details.file._id, { status: 'final' }).then(() => openDetails({ ...details.file, itemType: 'file' }))}>Mark final</Button></Stack></Stack>
        <Typography sx={{ fontWeight: 850, mb: 1 }}>Version history</Typography>{(details.versions || []).map((version: any) => <Paper key={version._id} variant="outlined" sx={{ p: 1.2, mb: 1, borderRadius: 2.5 }}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="body2" sx={{ fontWeight: 750 }}>Version {version.version}</Typography><Typography variant="caption" color="text.secondary">{formatBytes(version.sizeBytes)} · {new Date(version.createdAt).toLocaleString()}</Typography></Box>{version.immutable && <VerifiedRounded color="success" />}</Stack></Paper>)}
        <Typography sx={{ fontWeight: 850, mt: 2, mb: 1 }}>Comments</Typography><Stack direction="row" gap={1}><TextField size="small" fullWidth placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} /><Button variant="contained" onClick={addCommentNow}>Post</Button></Stack>{comments.map((row) => <Stack key={row._id} direction="row" gap={1.2} sx={{ mt: 1.5 }}><Avatar sx={{ width: 30, height: 30 }}>{row.user?.name?.[0]}</Avatar><Box><Typography variant="body2" sx={{ fontWeight: 750 }}>{row.user?.name}</Typography><Typography variant="body2">{row.body}</Typography></Box></Stack>)}
        <Typography sx={{ fontWeight: 850, mt: 2, mb: 1 }}>Recent activity</Typography>{activity.slice(0, 10).map((row) => <Box key={row._id} sx={{ py: .8, borderBottom: '1px solid', borderColor: 'divider' }}><Typography variant="body2" sx={{ fontWeight: 650 }}>{row.action.replaceAll('_',' ')}</Typography><Typography variant="caption" color="text.secondary">{new Date(row.createdAt).toLocaleString()}</Typography></Box>)}</>}
    </Drawer>
  </Box>;
}
