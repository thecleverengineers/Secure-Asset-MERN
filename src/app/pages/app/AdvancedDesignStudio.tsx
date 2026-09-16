import { useEffect, useMemo, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, FormControl, FormControlLabel, Grid, IconButton, InputLabel, MenuItem,
  Paper, Select, Slider, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import AppsRounded from '@mui/icons-material/AppsRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import DevicesRounded from '@mui/icons-material/DevicesRounded';
import DoneAllRounded from '@mui/icons-material/DoneAllRounded';
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import GroupWorkRounded from '@mui/icons-material/GroupWorkRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import ViewCarouselRounded from '@mui/icons-material/ViewCarouselRounded';
import LayersRounded from '@mui/icons-material/LayersRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import OpenWithRounded from '@mui/icons-material/OpenWithRounded';
import PaletteRounded from '@mui/icons-material/PaletteRounded';
import PreviewRounded from '@mui/icons-material/PreviewRounded';
import RedoRounded from '@mui/icons-material/RedoRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import SplitscreenRounded from '@mui/icons-material/SplitscreenRounded';
import TabRounded from '@mui/icons-material/TabRounded';
import UndoRounded from '@mui/icons-material/UndoRounded';
import UploadRounded from '@mui/icons-material/UploadRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import WidgetsRounded from '@mui/icons-material/WidgetsRounded';
import ZoomInRounded from '@mui/icons-material/ZoomInRounded';
import ZoomOutRounded from '@mui/icons-material/ZoomOutRounded';
import { DEFAULT_CANVAS_LAYER_STYLE, normaliseDesignSystem, OPEN_SANS_FONT_FAMILY, OPEN_SANS_FONT_NAME, type CanvasLayerStyleToken, type CanvasLayerToken, type DesignSystem, type NavigationDesignItem, type PageDesignToken } from '../../designSystem';
import { ICON_CATALOG, ICON_LIBRARY_SIZE, resolveIconComponent, searchIcons } from '../../iconLibrary';
import { uploadSiteAsset } from '../../services/api';

type SettingsShape = Record<string, any>;
type PageCatalogEntry = { key?: string; label?: string; path?: string; scope?: string; kind?: string; enabled?: boolean };
type StudioProps = { settings: SettingsShape; setSettings: Dispatch<SetStateAction<SettingsShape>>; onPublish?: () => void; applicationPages?: PageCatalogEntry[] };
type StudioPanel = 'pages' | 'layers' | 'components' | 'assets' | 'icons' | 'menus';
type Device = 'desktop' | 'tablet' | 'mobile';

const bottomAppBarIconDefinitions = [
  ['home', 'Home'], ['explore', 'Explore'], ['vault', 'Vault'], ['wishlist', 'Wishlist'], ['profile', 'Profile'],
  ['property', 'Property'], ['account', 'Account'], ['login', 'Login'],
] as const;
const quickAccessIconDefinitions = [
  ['image', 'Image'], ['video', 'Video'], ['audio', 'Music'], ['document', 'Document'], ['shared', 'Cloud'],
  ['pan-card', 'PAN Card'], ['birth-certificate', 'Birth Certificate'], ['indian-passport', 'Indian Passport'],
  ['voter-id', 'Voter ID'], ['aadhaar-card', 'Aadhaar Card'], ['driving-licence', 'Driving Licence'], ['land-patta', 'Land Patta'],
] as const;

const setPath = (object: any, path: string, value: any) => {
  const keys = path.split('.'); let cursor = object;
  keys.slice(0, -1).forEach((key) => { cursor[key] ||= {}; cursor = cursor[key]; }); cursor[keys[keys.length - 1]] = value; return object;
};
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const layerStyle = (patch: Partial<CanvasLayerStyleToken> = {}): CanvasLayerStyleToken => ({ ...DEFAULT_CANVAS_LAYER_STYLE, ...patch });

function IconAssetUpload({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setWorking(true); setError('');
    try { onChange((await uploadSiteAsset(file)).data.url); }
    catch (caught) { setError((caught as Error).message || 'Icon upload failed'); }
    finally { setWorking(false); }
  }
  return <Stack spacing={.6} sx={{ minWidth: 0 }}>
    <Typography fontSize={11.5} fontWeight={800}>{label}</Typography>
    <Stack direction="row" spacing={.7} alignItems="center">
      <Button component="label" size="small" variant="outlined" startIcon={working ? <CircularProgress size={14} /> : <UploadRounded />} disabled={working}>
        {working ? 'Uploading…' : value ? 'Replace' : 'Upload'}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload} />
      </Button>
      {value && <Button size="small" color="error" onClick={() => onChange('')}>Remove</Button>}
    </Stack>
    {value && <Box component="img" src={value} alt={`${label} preview`} sx={{ width: 54, height: 54, objectFit: 'contain', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: .5 }} />}
    {error && <Typography color="error" fontSize={10.5}>{error}</Typography>}
  </Stack>;
}
const defaultPages: PageDesignToken[] = [
  { key: 'home', label: 'Public homepage', path: '/', enabled: true, background: '#F7F7F5', surface: '#FFFFFF', headerVariant: 'hero', footerVariant: 'default', maxWidth: 1580, padding: 32, cardRadius: 18, buttonRadius: 12, density: 'comfortable', desktop: { columns: 12, gap: 24, padding: 32 }, tablet: { columns: 8, gap: 20, padding: 24 }, mobile: { columns: 4, gap: 16, padding: 16 } },
  { key: 'login', label: 'Authentication', path: '/login', enabled: true, background: '#F7F7F5', surface: '#FFFFFF', headerVariant: 'minimal', footerVariant: 'minimal', maxWidth: 1280, padding: 24, cardRadius: 0, buttonRadius: 12, density: 'comfortable', desktop: { columns: 12, gap: 24, padding: 32 }, tablet: { columns: 8, gap: 20, padding: 24 }, mobile: { columns: 4, gap: 16, padding: 16 } },
  { key: 'dashboard', label: 'User dashboard', path: '/app/dashboard', enabled: true, background: '#F7F7F5', surface: '#FFFFFF', headerVariant: 'default', footerVariant: 'hidden', maxWidth: 1580, padding: 32, cardRadius: 18, buttonRadius: 12, density: 'comfortable', desktop: { columns: 12, gap: 24, padding: 32 }, tablet: { columns: 8, gap: 20, padding: 24 }, mobile: { columns: 4, gap: 16, padding: 16 } },
  { key: 'admin', label: 'Admin workspace', path: '/app/design-studio', enabled: true, background: '#F7F7F5', surface: '#FFFFFF', headerVariant: 'default', footerVariant: 'hidden', maxWidth: 1920, padding: 24, cardRadius: 12, buttonRadius: 10, density: 'compact', desktop: { columns: 12, gap: 20, padding: 24 }, tablet: { columns: 8, gap: 16, padding: 20 }, mobile: { columns: 4, gap: 12, padding: 16 } },
];
const staticApplicationPages: PageCatalogEntry[] = [
  { key: 'marketplace', label: 'Marketplace', path: '/marketplace', scope: 'public' },
  { key: 'public-search', label: 'Public search', path: '/search', scope: 'public' },
  { key: 'property-detail', label: 'Property detail', path: '/marketplace/:id', scope: 'public' },
  { key: 'surveyors', label: 'Surveyor marketplace', path: '/surveyors', scope: 'public' },
  { key: 'surveyor-profile', label: 'Surveyor profile', path: '/surveyors/:id', scope: 'public' },
  { key: 'surveyor-private-profile', label: 'Private surveyor profile', path: '/surveyor-private/:id', scope: 'public' },
  { key: 'public-drive', label: 'Public drive', path: '/public-drive/:type/:token', scope: 'public' },
  { key: 'pricing', label: 'Pricing', path: '/pricing', scope: 'public' },
  { key: 'about', label: 'About', path: '/about', scope: 'public' },
  { key: 'contact', label: 'Contact', path: '/contact', scope: 'public' },
  { key: 'reset-password', label: 'Reset password', path: '/reset-password', scope: 'public' },
  { key: 'apply-property', label: 'Apply for property', path: '/app/apply_property/:propertyId', scope: 'app' },
  { key: 'schedule-visit', label: 'Schedule property visit', path: '/app/schedule_visit/:propertyId', scope: 'app' },
];
const cleanRoute = (value: string) => String(value || '').split('?')[0].replace(/\/+$/, '') || '/';
const pageIdentity = (value: string) => cleanRoute(value).toLowerCase();
const pageKeyForRoute = (path: string, hint = '') => {
  const clean = cleanRoute(path);
  if (clean === '/') return 'home';
  if (clean === '/login') return 'login';
  if (clean === '/reset-password') return 'reset-password';
  if (clean === '/app/dashboard') return 'dashboard';
  if (clean === '/app/design-studio') return 'admin';
  const routeKey = clean.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `${hint && hint !== 'dashboard' ? `${hint.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-` : ''}${routeKey || 'page'}`.slice(0, 64);
};
const pageTemplateForRoute = (entry: PageCatalogEntry): PageDesignToken => {
  const path = cleanRoute(entry.path || '/app/dashboard');
  const isApp = path.startsWith('/app/');
  const isAuth = ['/login', '/reset-password'].includes(path) || /\/auth|register|forgot-password/.test(path);
  const template = clone(isApp ? defaultPages[2] : defaultPages[0]);
  return {
    ...template,
    key: pageKeyForRoute(path, entry.key),
    label: String(entry.label || entry.key || path).slice(0, 96),
    path,
    enabled: entry.enabled !== false,
    headerVariant: isAuth ? 'minimal' : template.headerVariant,
    footerVariant: isAuth ? 'minimal' : isApp ? 'hidden' : 'default',
    maxWidth: isApp ? 1580 : 1580,
    padding: isApp ? 32 : 32,
  };
};
const defaultLayers: CanvasLayerToken[] = [
  { id: 'hero', pageKey: 'dashboard', type: 'frame', label: 'Page header', x: 24, y: 24, width: 760, height: 104, zIndex: 0, visible: true, locked: false, parentId: '', component: 'header', dataBinding: '', interaction: '', style: layerStyle({ backgroundColor: '#0B5270', color: '#FFFFFF', borderColor: '#0B5270', borderRadius: 0, boxShadow: 'none', frame: 'toolbar' }) },
  { id: 'kpi', pageKey: 'dashboard', type: 'component', label: 'Performance card', x: 24, y: 148, width: 360, height: 180, zIndex: 1, visible: true, locked: false, parentId: '', component: 'card', dataBinding: 'analytics.performance', interaction: '', style: layerStyle({ backgroundColor: '#FFFFFF', frame: 'card' }) },
  { id: 'table', pageKey: 'dashboard', type: 'component', label: 'Recent transactions', x: 404, y: 148, width: 380, height: 260, zIndex: 2, visible: true, locked: false, parentId: '', component: 'table', dataBinding: 'payments.recent', interaction: 'navigate:/app/payments', style: layerStyle({ backgroundColor: '#FFFFFF', frame: 'section', borderRadius: 0 }) },
  { id: 'home-header', pageKey: 'home', type: 'frame', label: 'Public header', x: 0, y: 0, width: 820, height: 78, zIndex: 0, visible: true, locked: false, parentId: '', component: 'header', dataBinding: '', interaction: '', style: layerStyle({ backgroundColor: '#0B5270', color: '#FFFFFF', borderColor: '#0B5270', borderRadius: 0, boxShadow: 'none', frame: 'toolbar', padding: 20 }) },
  { id: 'home-hero', pageKey: 'home', type: 'frame', label: 'Hero section', x: 24, y: 102, width: 772, height: 220, zIndex: 1, visible: true, locked: false, parentId: '', component: 'section', dataBinding: 'home.carousel', interaction: '', style: layerStyle({ backgroundColor: '#EAF2F4', borderRadius: 18, boxShadow: 'soft', frame: 'section', fontSize: 24, padding: 28 }) },
  { id: 'home-featured', pageKey: 'home', type: 'component', label: 'Featured property cards', x: 24, y: 346, width: 772, height: 168, zIndex: 2, visible: true, locked: false, parentId: '', component: 'card', dataBinding: 'properties.featured', interaction: 'navigate:/marketplace', style: layerStyle({ backgroundColor: '#FFFFFF', frame: 'card', display: 'grid', flexDirection: 'row', gap: 16 }) },
  { id: 'home-footer', pageKey: 'home', type: 'frame', label: 'Public footer', x: 0, y: 548, width: 820, height: 104, zIndex: 3, visible: true, locked: false, parentId: '', component: 'footer', dataBinding: 'footer.navigation', interaction: '', style: layerStyle({ backgroundColor: '#0B5270', color: '#FFFFFF', borderColor: '#0B5270', borderRadius: 0, boxShadow: 'none', frame: 'toolbar', padding: 20 }) },
  { id: 'login-header', pageKey: 'login', type: 'frame', label: 'Authentication header', x: 0, y: 0, width: 820, height: 72, zIndex: 0, visible: true, locked: false, parentId: '', component: 'header', dataBinding: '', interaction: '', style: layerStyle({ backgroundColor: '#0B5270', color: '#FFFFFF', borderColor: '#0B5270', borderRadius: 0, boxShadow: 'none', frame: 'toolbar', padding: 18 }) },
  { id: 'login-form', pageKey: 'login', type: 'component', label: 'Login form', x: 210, y: 126, width: 400, height: 360, zIndex: 1, visible: true, locked: false, parentId: '', component: 'card', dataBinding: 'auth.login', interaction: 'submit:login', style: layerStyle({ backgroundColor: '#FFFFFF', borderRadius: 0, boxShadow: 'raised', frame: 'modal', padding: 28 }) },
  { id: 'login-footer', pageKey: 'login', type: 'frame', label: 'Authentication footer', x: 0, y: 560, width: 820, height: 88, zIndex: 2, visible: true, locked: false, parentId: '', component: 'footer', dataBinding: 'footer.legalLinks', interaction: '', style: layerStyle({ backgroundColor: '#0B5270', color: '#FFFFFF', borderColor: '#0B5270', borderRadius: 0, boxShadow: 'none', frame: 'toolbar', padding: 18 }) },
  { id: 'admin-header', pageKey: 'admin', type: 'frame', label: 'Admin workspace header', x: 24, y: 24, width: 772, height: 88, zIndex: 0, visible: true, locked: false, parentId: '', component: 'header', dataBinding: '', interaction: '', style: layerStyle({ backgroundColor: '#0B5270', color: '#FFFFFF', borderColor: '#0B5270', borderRadius: 0, boxShadow: 'none', frame: 'toolbar' }) },
  { id: 'admin-canvas', pageKey: 'admin', type: 'component', label: 'Design canvas frame', x: 24, y: 136, width: 772, height: 300, zIndex: 1, visible: true, locked: false, parentId: '', component: 'section', dataBinding: 'design.canvas.layers', interaction: '', style: layerStyle({ backgroundColor: '#FFFFFF', frame: 'section', borderRadius: 0, boxShadow: 'soft' }) },
];
const materialisePages = (stored: PageDesignToken[], applicationPages: PageCatalogEntry[] = []) => {
  const catalog = [...defaultPages, ...staticApplicationPages, ...applicationPages, { key: 'content-page', label: 'Dynamic content page', path: '/:slug', scope: 'public' }].filter((entry) => entry.path);
  const seenRoutes = new Set<string>();
  const pages: PageDesignToken[] = [];
  catalog.forEach((entry) => {
    const path = cleanRoute(String(entry.path));
    const identity = pageIdentity(path);
    if (seenRoutes.has(identity)) return;
    seenRoutes.add(identity);
    const storedPage = stored.find((candidate) => pageIdentity(candidate.path) === identity || (entry.key && candidate.key === entry.key));
    const base = storedPage || ('desktop' in entry ? clone(entry as PageDesignToken) : pageTemplateForRoute(entry));
    pages.push({ ...base, key: storedPage?.key || (entry.key && ['home', 'login', 'dashboard', 'admin'].includes(entry.key) ? entry.key : pageKeyForRoute(path, entry.key)), path: cleanRoute(storedPage?.path || path), label: String(storedPage?.label || entry.label || entry.key || path).slice(0, 96), enabled: storedPage?.enabled !== false && entry.enabled !== false });
  });
  stored.forEach((entry) => {
    if (!pages.some((page) => pageIdentity(page.path) === pageIdentity(entry.path))) pages.push(clone(entry));
  });
  return pages.slice(0, 400);
};
const generatedLayersForPage = (page: PageDesignToken): CanvasLayerToken[] => {
  const key = page.key.slice(0, 48);
  const width = 772;
  const layers: CanvasLayerToken[] = [
    { id: `${key}-header`, pageKey: page.key, type: 'frame', label: `${page.label} header`, x: 0, y: 0, width: 820, height: 78, zIndex: 0, visible: true, locked: false, parentId: '', component: 'header', dataBinding: '', interaction: '', style: layerStyle({ backgroundColor: '#0B5270', color: '#FFFFFF', borderColor: '#0B5270', borderRadius: 0, boxShadow: 'none', frame: 'toolbar', padding: 20 }) },
    { id: `${key}-content`, pageKey: page.key, type: 'frame', label: `${page.label} content`, x: 24, y: 104, width, height: 320, zIndex: 1, visible: true, locked: false, parentId: '', component: 'section', dataBinding: '', interaction: '', style: layerStyle({ backgroundColor: '#FFFFFF', frame: 'section', boxShadow: 'soft', borderRadius: page.cardRadius }) },
  ];
  if (page.footerVariant !== 'hidden') layers.push({ id: `${key}-footer`, pageKey: page.key, type: 'frame', label: `${page.label} footer`, x: 0, y: 468, width: 820, height: 96, zIndex: 2, visible: true, locked: false, parentId: '', component: 'footer', dataBinding: '', interaction: '', style: layerStyle({ backgroundColor: '#0B5270', color: '#FFFFFF', borderColor: '#0B5270', borderRadius: 0, boxShadow: 'none', frame: 'toolbar', padding: 20 }) });
  return layers;
};
const fallbackLayersForPage = (page: PageDesignToken) => {
  const builtIn = defaultLayers.filter((entry) => entry.pageKey === page.key);
  return builtIn.length ? builtIn.map((entry) => clone(entry)) : generatedLayersForPage(page);
};
const materialiseLayers = (stored: CanvasLayerToken[], page: PageDesignToken) => {
  if (stored.some((entry) => entry.pageKey === page.key)) return stored;
  return [...stored, ...fallbackLayersForPage(page)];
};
const knownNavigation: NavigationDesignItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/app/dashboard', icon: 'DashboardRounded', section: 'workspace', order: 10, enabled: true, mobilePrimary: true, placement: 'both', badge: '', roles: [], loginRequired: true, external: false, parentKey: '' },
  { key: 'design-studio', label: 'Design Studio', path: '/app/design-studio', icon: 'PaletteRounded', section: 'administration', order: 15, enabled: true, mobilePrimary: false, placement: 'sidebar', badge: 'NEW', roles: ['admin'], loginRequired: true, external: false, parentKey: '' },
  { key: 'properties', label: 'Properties', path: '/app/properties', icon: 'ApartmentRounded', section: 'property', order: 20, enabled: true, mobilePrimary: true, placement: 'both', badge: '', roles: [], loginRequired: true, external: false, parentKey: '' },
  { key: 'payments', label: 'Payments & invoices', path: '/app/payments', icon: 'PaymentsRounded', section: 'finance', order: 30, enabled: true, mobilePrimary: true, placement: 'both', badge: '', roles: [], loginRequired: true, external: false, parentKey: '' },
  { key: 'documents', label: 'Document vault', path: '/app/documents', icon: 'FolderRounded', section: 'records', order: 40, enabled: true, mobilePrimary: false, placement: 'sidebar', badge: '', roles: [], loginRequired: true, external: false, parentKey: '' },
];
const componentNames = ['button', 'card', 'input', 'modal', 'alert', 'table', 'header', 'footer', 'section', 'nav', 'sidebar', 'bottom-app-bar', 'tabs', 'dropdown', 'badge', 'profile', 'empty-state', 'loading'];
const deviceWidth: Record<Device, number> = { desktop: 820, tablet: 620, mobile: 390 };

function NumberToken({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <TextField size="small" fullWidth type="number" label={label} value={value} inputProps={{ min, max, step }} onChange={(event) => onChange(Number(event.target.value))} />;
}

function ColorToken({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Stack direction="row" spacing={.8} alignItems="center"><Box component="input" type="color" aria-label={`${label} colour`} value={value} onChange={(event: any) => onChange(event.target.value.toUpperCase())} sx={{ width: 35, height: 35, p: .2, border: '1px solid', borderColor: 'divider', cursor: 'pointer' }} /><TextField size="small" fullWidth label={label} value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} /></Stack>;
}

function LayerSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <FormControl size="small" fullWidth><InputLabel>{label}</InputLabel><Select value={value} label={label} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <MenuItem key={option} value={option}>{option.replaceAll('-', ' ')}</MenuItem>)}</Select></FormControl>;
}

function LayerStyleEditor({ style, onChange }: { style: CanvasLayerStyleToken; onChange: (patch: Partial<CanvasLayerStyleToken>) => void }) {
  const set = (key: keyof CanvasLayerStyleToken, value: any) => onChange({ [key]: value } as Partial<CanvasLayerStyleToken>);
  return <Stack spacing={1.35} sx={{ mt: 1.25 }}>
    <Divider /><Typography fontWeight={900} fontSize={12}>Live redesign · appearance</Typography>
    <Typography variant="caption" color="text.secondary">These values are applied immediately to the selected live component and saved as bounded design tokens.</Typography>
    <Grid container spacing={1}><Grid size={6}><ColorToken label="Background" value={style.backgroundColor} onChange={(value) => set('backgroundColor', value)} /></Grid><Grid size={6}><ColorToken label="Text" value={style.color} onChange={(value) => set('color', value)} /></Grid><Grid size={6}><ColorToken label="Overlay" value={style.overlayColor || '#FFFFFF'} onChange={(value) => set('overlayColor', value)} /></Grid><Grid size={6}><LayerSelect label="Frame" value={style.frame} options={['none', 'section', 'card', 'modal', 'toolbar']} onChange={(value) => set('frame', value)} /></Grid></Grid>
    <TextField size="small" label="Background image / asset URL" value={style.backgroundImage} onChange={(event) => set('backgroundImage', event.target.value)} helperText="Use an approved uploaded asset path or HTTPS URL." />
    <Stack direction="row" spacing={.7}><Button size="small" color="error" variant="outlined" startIcon={<DeleteRounded />} disabled={!style.backgroundImage && !style.erased} onClick={() => onChange({ backgroundImage: '', erased: true })}>Erase image</Button><Button size="small" variant="outlined" onClick={() => set('erased', false)} disabled={!style.erased}>Restore image</Button></Stack>
    <Stack direction="row" spacing={1} alignItems="center"><Typography fontSize={11} sx={{ minWidth: 66 }}>Opacity</Typography><Slider size="small" value={style.opacity} min={.2} max={1} step={.05} onChange={(_, value) => set('opacity', Number(value))} /><Typography fontSize={11} sx={{ minWidth: 35, textAlign: 'right' }}>{Math.round(style.opacity * 100)}%</Typography></Stack>
    <Typography fontWeight={900} fontSize={12}>Border, radius, shadow & spacing</Typography>
    <Grid container spacing={1}><Grid size={6}><ColorToken label="Border" value={style.borderColor} onChange={(value) => set('borderColor', value)} /></Grid><Grid size={6}><NumberToken label="Border px" value={style.borderWidth} min={0} max={4} onChange={(value) => set('borderWidth', value)} /></Grid><Grid size={6}><LayerSelect label="Border style" value={style.borderStyle} options={['none', 'solid', 'dashed', 'dotted']} onChange={(value) => set('borderStyle', value)} /></Grid><Grid size={6}><NumberToken label="Radius" value={style.borderRadius} min={0} max={80} onChange={(value) => set('borderRadius', value)} /></Grid><Grid size={6}><LayerSelect label="Box shadow" value={style.boxShadow} options={['none', 'subtle', 'soft', 'raised', 'floating']} onChange={(value) => set('boxShadow', value)} /></Grid><Grid size={6}><NumberToken label="Padding" value={style.padding} min={0} max={120} onChange={(value) => set('padding', value)} /></Grid><Grid size={6}><NumberToken label="Margin" value={style.margin} min={-120} max={120} onChange={(value) => set('margin', value)} /></Grid></Grid>
    <Typography fontWeight={900} fontSize={12}>Typography</Typography>
    <Grid container spacing={1}><Grid size={12}><LayerSelect label="Font family" value={OPEN_SANS_FONT_NAME} options={[OPEN_SANS_FONT_NAME]} onChange={(value) => set('fontFamily', value)} /></Grid><Grid size={6}><NumberToken label="Font size" value={style.fontSize} min={10} max={64} onChange={(value) => set('fontSize', value)} /></Grid><Grid size={6}><NumberToken label="Font weight" value={style.fontWeight} min={400} max={900} step={50} onChange={(value) => set('fontWeight', value)} /></Grid><Grid size={6}><LayerSelect label="Text align" value={style.textAlign} options={['left', 'center', 'right']} onChange={(value) => set('textAlign', value)} /></Grid><Grid size={6}><LayerSelect label="Text overflow" value={style.overflow} options={['visible', 'hidden', 'clip']} onChange={(value) => set('overflow', value)} /></Grid></Grid>
    <Typography fontWeight={900} fontSize={12}>Layout, sizing & positioning</Typography>
    <Grid container spacing={1}><Grid size={6}><LayerSelect label="Display" value={style.display} options={['block', 'flex', 'grid']} onChange={(value) => set('display', value)} /></Grid><Grid size={6}><LayerSelect label="Direction" value={style.flexDirection} options={['row', 'column']} onChange={(value) => set('flexDirection', value)} /></Grid><Grid size={6}><LayerSelect label="Justify" value={style.justifyContent} options={['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']} onChange={(value) => set('justifyContent', value)} /></Grid><Grid size={6}><LayerSelect label="Align" value={style.alignItems} options={['flex-start', 'center', 'flex-end', 'stretch']} onChange={(value) => set('alignItems', value)} /></Grid><Grid size={6}><NumberToken label="Gap" value={style.gap} min={0} max={96} onChange={(value) => set('gap', value)} /></Grid><Grid size={6}><LayerSelect label="Position" value={style.position} options={['absolute', 'relative', 'fixed', 'sticky']} onChange={(value) => set('position', value)} /></Grid><Grid size={6}><LayerSelect label="Width sizing" value={style.widthMode} options={['fixed', 'auto', 'fill']} onChange={(value) => set('widthMode', value)} /></Grid><Grid size={6}><LayerSelect label="Height sizing" value={style.heightMode} options={['fixed', 'auto', 'fill']} onChange={(value) => set('heightMode', value)} /></Grid><Grid size={6}><NumberToken label="Min width" value={style.minWidth} min={0} max={1920} onChange={(value) => set('minWidth', value)} /></Grid><Grid size={6}><NumberToken label="Max width" value={style.maxWidth} min={40} max={1920} onChange={(value) => set('maxWidth', value)} /></Grid><Grid size={6}><NumberToken label="Min height" value={style.minHeight} min={0} max={1200} onChange={(value) => set('minHeight', value)} /></Grid><Grid size={6}><NumberToken label="Max height" value={style.maxHeight} min={24} max={1200} onChange={(value) => set('maxHeight', value)} /></Grid></Grid>
    <Typography fontWeight={900} fontSize={12}>Image crop & object positioning</Typography>
    <Grid container spacing={1}><Grid size={6}><LayerSelect label="Object fit" value={style.objectFit} options={['cover', 'contain', 'fill']} onChange={(value) => set('objectFit', value)} /></Grid><Grid size={6}><LayerSelect label="Object position" value={style.objectPosition} options={['center', 'top', 'right', 'bottom', 'left']} onChange={(value) => set('objectPosition', value)} /></Grid><Grid size={6}><NumberToken label="Crop top %" value={style.cropTop} min={0} max={100} onChange={(value) => set('cropTop', value)} /></Grid><Grid size={6}><NumberToken label="Crop right %" value={style.cropRight} min={0} max={100} onChange={(value) => set('cropRight', value)} /></Grid><Grid size={6}><NumberToken label="Crop bottom %" value={style.cropBottom} min={0} max={100} onChange={(value) => set('cropBottom', value)} /></Grid><Grid size={6}><NumberToken label="Crop left %" value={style.cropLeft} min={0} max={100} onChange={(value) => set('cropLeft', value)} /></Grid></Grid>
  </Stack>;
}

const LAYER_SHADOWS: Record<CanvasLayerStyleToken['boxShadow'], string> = {
  none: 'none', subtle: '0 4px 14px rgba(18,34,37,.07)', soft: '0 10px 30px rgba(18,34,37,.10)',
  raised: '0 16px 42px rgba(18,34,37,.15)', floating: '0 24px 80px rgba(18,34,37,.20)',
};

function LiveLayer({ layer, selected, primaryColor, borderColor, snapToGrid, gridSize, zoom, onSelect, onPosition, onResize }: { layer: CanvasLayerToken; selected: boolean; primaryColor: string; borderColor: string; snapToGrid: boolean; gridSize: number; zoom: number; onSelect: (event: any) => void; onPosition: (x: number, y: number) => void; onResize: (width: number, height: number) => void }) {
  const style = layer.style;
  const image = style.backgroundImage && !style.erased ? style.backgroundImage : '';
  const backgroundImage = image ? (style.overlayColor ? `linear-gradient(${style.overlayColor}, ${style.overlayColor}), url("${image}")` : `url("${image}")`) : 'none';
  const width = style.widthMode === 'fill' ? '100%' : style.widthMode === 'auto' ? 'auto' : layer.width;
  const height = style.heightMode === 'fill' ? '100%' : style.heightMode === 'auto' ? 'auto' : layer.height;
  const handlePosition = (event: any) => {
    if (layer.locked) return;
    const rect = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const rawX = Math.round((event.clientX - rect.left) / zoom); const rawY = Math.round((event.clientY - rect.top) / zoom);
    onPosition(snapToGrid ? Math.round(rawX / gridSize) * gridSize : rawX, snapToGrid ? Math.round(rawY / gridSize) * gridSize : rawY);
  };
  const handleResize = (event: any) => {
    event.stopPropagation();
    if (layer.locked) return;
    const canvas = event.currentTarget.parentElement?.parentElement as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rawWidth = Math.max(40, Math.round((event.clientX - rect.left) / zoom - layer.x));
    const rawHeight = Math.max(24, Math.round((event.clientY - rect.top) / zoom - layer.y));
    onResize(snapToGrid ? Math.round(rawWidth / gridSize) * gridSize : rawWidth, snapToGrid ? Math.round(rawHeight / gridSize) * gridSize : rawHeight);
  };
  return <Box key={layer.id} draggable={!layer.locked} onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData('text/plain', layer.id); }} onDragEnd={handlePosition} onClick={onSelect} sx={{
    position: style.position, left: layer.x, top: layer.y, width, height, minWidth: style.minWidth || undefined, maxWidth: style.maxWidth, minHeight: style.minHeight || undefined, maxHeight: style.maxHeight,
    display: style.display, flexDirection: style.flexDirection, justifyContent: style.justifyContent, alignItems: style.alignItems, gap: style.gap, padding: style.padding, margin: style.margin, boxSizing: 'border-box',
    bgcolor: style.erased ? 'transparent' : style.backgroundColor, backgroundImage, backgroundSize: style.objectFit, backgroundPosition: style.objectPosition, backgroundRepeat: 'no-repeat', clipPath: (style.cropTop || style.cropRight || style.cropBottom || style.cropLeft) ? `inset(${style.cropTop}% ${style.cropRight}% ${style.cropBottom}% ${style.cropLeft}%)` : undefined, opacity: style.opacity,
    border: style.borderStyle === 'none' ? 'none' : `${selected ? Math.max(2, style.borderWidth) : style.borderWidth}px ${style.borderStyle} ${selected ? primaryColor : style.borderColor}`, borderRadius: style.borderRadius, color: style.color,
    fontSize: style.fontSize, fontFamily: OPEN_SANS_FONT_FAMILY, fontWeight: style.fontWeight, textAlign: style.textAlign, overflow: style.overflow, cursor: layer.locked ? 'not-allowed' : 'move', userSelect: 'none', zIndex: layer.zIndex,
    boxShadow: selected ? `0 0 0 4px ${primaryColor}2B, ${LAYER_SHADOWS[style.boxShadow]}` : LAYER_SHADOWS[style.boxShadow], transition: 'box-shadow .16s ease, border-color .16s ease, transform .16s ease',
    '&:hover': { boxShadow: selected ? `0 0 0 4px ${primaryColor}3D, ${LAYER_SHADOWS[style.boxShadow]}` : `0 0 0 2px ${primaryColor}66, ${LAYER_SHADOWS[style.boxShadow]}` },
    '&::after': selected ? { content: '"Redesign"', position: 'absolute', top: -12, right: 8, px: .7, py: .25, bgcolor: primaryColor, color: '#FFFFFF', fontSize: 9, fontWeight: 850, lineHeight: 1.2, borderRadius: 1, pointerEvents: 'none' } : undefined,
  }}><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 28, height: 28, display: 'grid', placeItems: 'center', bgcolor: `${primaryColor}16`, borderRadius: 1 }}><Typography fontSize={12} fontWeight={900}>{layer.component.slice(0, 1).toUpperCase()}</Typography></Box><Typography fontWeight={850} fontSize={13}>{layer.label}</Typography></Stack><Typography fontSize={11} sx={{ mt: .5, opacity: .72 }}>{layer.dataBinding ? `Data: ${layer.dataBinding}` : 'Select to redesign this live component'}</Typography>{selected && <Stack direction="row" spacing={.5} sx={{ mt: 1 }}><Chip size="small" label={`${layer.width} × ${layer.height}`} /><Chip size="small" label={layer.locked ? 'Locked' : 'Editable'} /></Stack>}{selected && !layer.locked && <Box aria-label="Resize layer" title="Drag to resize" draggable onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData('text/plain', `resize:${layer.id}`); }} onDragEnd={handleResize} sx={{ position: 'absolute', right: -5, bottom: -5, width: 12, height: 12, border: '2px solid', borderColor: primaryColor, bgcolor: '#FFFFFF', cursor: 'nwse-resize', zIndex: 2 }} />}</Box>;
}

export default function AdvancedDesignStudio({ settings, setSettings, onPublish, applicationPages = [] }: StudioProps) {
  const design = useMemo(() => normaliseDesignSystem(settings.design), [settings.design]);
  const [panel, setPanel] = useState<StudioPanel>('pages');
  const [pageKey, setPageKey] = useState('dashboard');
  const [device, setDevice] = useState<Device>('desktop');
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState('');
  const [iconStyle, setIconStyle] = useState<any>(design.iconLibrary.style);
  const [iconTone, setIconTone] = useState<any>(design.iconLibrary.tone);
  const [buttonVariant, setButtonVariant] = useState<keyof DesignSystem['buttons']>('primary');
  const [history, setHistory] = useState<DesignSystem[]>([]);
  const [future, setFuture] = useState<DesignSystem[]>([]);
  const [preview, setPreview] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const pages = materialisePages(design.pageDesigns, applicationPages);
  const page = pages.find((entry) => entry.key === pageKey) || pages[0];
  const layers = materialiseLayers(design.canvas.layers, page).filter((layer) => layer.pageKey === pageKey);
  const icons = useMemo(() => searchIcons(query, iconStyle, iconTone, 180), [iconStyle, iconTone, query]);
  const navigation = design.navigation.length ? design.navigation : knownNavigation;

  const commit = (next: DesignSystem) => { setHistory((current) => [...current.slice(-19), design]); setFuture([]); setSettings((current) => ({ ...current, design: next })); };
  const update = (path: string, value: any) => { const next = clone(design); setPath(next, path, value); commit(normaliseDesignSystem(next)); };
  const updateLayer = (patch: Partial<CanvasLayerToken>) => {
    const next = clone(design); const source = materialiseLayers(next.canvas.layers, page); const index = source.findIndex((layer) => layer.id === displayLayer?.id);
    if (index >= 0) source[index] = { ...source[index], ...patch }; next.canvas.layers = source; commit(normaliseDesignSystem(next));
  };
  const updateLayers = (ids: string[], patch: Partial<CanvasLayerToken>) => {
    const next = clone(design); const source = materialiseLayers(next.canvas.layers, page); next.canvas.layers = source.map((layer) => ids.includes(layer.id) ? { ...layer, ...patch } : layer); commit(normaliseDesignSystem(next));
  };
  const undo = () => { const previous = history.at(-1); if (!previous) return; setFuture((current) => [design, ...current]); setHistory((current) => current.slice(0, -1)); setSettings((current) => ({ ...current, design: previous })); };
  const redo = () => { const next = future[0]; if (!next) return; setHistory((current) => [...current, design]); setFuture((current) => current.slice(1)); setSettings((current) => ({ ...current, design: next })); };
  const updatePage = (patch: Partial<PageDesignToken>) => {
    const next = clone(design); const source = materialisePages(next.pageDesigns, applicationPages); const index = source.findIndex((entry) => entry.key === pageKey);
    if (index >= 0) source[index] = { ...source[index], ...patch }; else source.push({ ...defaultPages[0], key: pageKey, label: pageKey, path: `/app/${pageKey}`, ...patch }); next.pageDesigns = source; commit(normaliseDesignSystem(next));
  };
  const createPage = () => {
    const key = `page-${Date.now()}`;
    const next = clone(design);
    const source = materialisePages(next.pageDesigns, applicationPages);
    source.push({ ...defaultPages[0], key, label: 'New page', path: `/new-page-${source.length + 1}` });
    next.pageDesigns = source;
    commit(normaliseDesignSystem(next));
    setPageKey(key);
  };
  const updateNavigation = (nextItems: NavigationDesignItem[]) => update('navigation', nextItems);
  const duplicateLayer = () => { if (!displayLayer) return; const next = clone(design); const source = materialiseLayers(next.canvas.layers, page); source.push({ ...displayLayer, id: `${displayLayer.id}-copy-${Date.now()}`, label: `${displayLayer.label} copy`, x: displayLayer.x + 24, y: displayLayer.y + 24, zIndex: source.length }); next.canvas.layers = source; commit(normaliseDesignSystem(next)); };
  const addLayer = (component = 'card') => { const next = clone(design); const source = materialiseLayers(next.canvas.layers, page); const id = `layer-${Date.now()}`; source.push({ id, pageKey, type: 'component', label: `${component.replaceAll('-', ' ')} component`, x: 56, y: 440 + source.filter((layer) => layer.pageKey === pageKey).length * 12, width: 320, height: component === 'button' ? 48 : 140, zIndex: source.length, visible: true, locked: false, parentId: '', component, dataBinding: '', interaction: '', style: layerStyle({ borderRadius: component === 'modal' ? 0 : 12, frame: component === 'modal' ? 'modal' : 'card' }) }); next.canvas.layers = source; commit(normaliseDesignSystem(next)); setSelectedState([id]); };
  const [selectedState, setSelectedState] = useState<string[]>(['kpi']);
  const selectedIds = selectedState;
  const selectLayer = (event: any, id: string) => setSelectedState(event?.metaKey || event?.ctrlKey ? (selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]) : [id]);
  const displayLayer = layers.find((layer) => layer.id === selectedIds[0]) || layers[0];
  const selectedComponent = displayLayer?.component || 'card';
  useEffect(() => {
    setSelectedState((current) => current.some((id) => layers.some((layer) => layer.id === id)) ? current : (layers[0] ? [layers[0].id] : []));
  }, [pageKey, design.canvas.layers]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      if (event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateLayer(); }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [design, duplicateLayer, future, history]);

  const panelItems: Array<[StudioPanel, string, any]> = [['pages', 'Pages', AppsRounded], ['layers', 'Layers', LayersRounded], ['components', 'Components', WidgetsRounded], ['assets', 'Assets', FolderRounded], ['icons', 'Icons', ViewCarouselRounded], ['menus', 'Menus', MenuRounded]];
  const toolbarButton = (label: string, icon: any, action: () => void, disabled = false) => <Tooltip title={label} key={label}><IconButton size="small" disabled={disabled} onClick={action} aria-label={label}>{icon}</IconButton></Tooltip>;

  return <Box className="sa-design-studio" sx={{ minHeight: 'calc(100vh - 180px)', mx: { xs: -2, md: -3, lg: -4 }, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
    <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {toolbarButton('Undo', <UndoRounded fontSize="small" />, undo, !history.length)}{toolbarButton('Redo', <RedoRounded fontSize="small" />, redo, !future.length)}<Divider orientation="vertical" flexItem />
      {toolbarButton('Zoom out', <ZoomOutRounded fontSize="small" />, () => setZoom((value) => Math.max(.25, Number((value - .1).toFixed(2)))))}<Chip size="small" label={`${Math.round(zoom * 100)}%`} onClick={() => setZoom(1)} />{toolbarButton('Zoom in', <ZoomInRounded fontSize="small" />, () => setZoom((value) => Math.min(2, Number((value + .1).toFixed(2)))))}
      <FormControl size="small" sx={{ minWidth: 118 }}><InputLabel>Viewport</InputLabel><Select value={device} label="Viewport" onChange={(event) => setDevice(event.target.value as Device)} startAdornment={<DevicesRounded sx={{ mr: .5, fontSize: 17 }} />}>{(['desktop', 'tablet', 'mobile'] as Device[]).map((value) => <MenuItem key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</MenuItem>)}</Select></FormControl>
      <Box sx={{ flex: 1 }} /><Button size="small" variant={liveMode ? 'contained' : 'outlined'} startIcon={<PreviewRounded />} onClick={() => setLiveMode((value) => !value)}>{liveMode ? 'Live page' : 'Canvas mode'}</Button><Button size="small" variant={preview ? 'contained' : 'outlined'} startIcon={<PreviewRounded />} onClick={() => setPreview((value) => !value)}>{preview ? 'Exit preview' : 'Preview flow'}</Button><Button size="small" variant="outlined" startIcon={<SaveRounded />} onClick={onPublish}>Save draft</Button><Button size="small" variant="contained" startIcon={<DoneAllRounded />} onClick={onPublish}>Publish</Button>
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '244px minmax(420px, 1fr) 300px' }, minHeight: 680 }}>
      <Paper square elevation={0} sx={{ borderRight: { lg: '1px solid' }, borderBottom: { xs: '1px solid', lg: 0 }, borderColor: 'divider', overflow: 'hidden' }}>
        <Tabs value={panel} onChange={(_, value) => setPanel(value)} variant="scrollable" scrollButtons={false} sx={{ minHeight: 46, '& .MuiTab-root': { minWidth: 86, minHeight: 46, px: 1, fontSize: 10.5 } }}>{panelItems.map(([key, label, Icon]) => <Tab key={key} value={key} icon={<Icon sx={{ fontSize: 17 }} />} iconPosition="top" label={label} />)}</Tabs>
        <Box sx={{ p: 1.35, maxHeight: { lg: 635 }, overflowY: 'auto' }}>
          {panel === 'pages' && <Stack spacing={1}><Stack direction="row" alignItems="center" justifyContent="space-between"><Typography className="sa-page-kicker">All application pages</Typography><Chip size="small" label={`${pages.length} routes`} /></Stack><Typography variant="caption" color="text.secondary">Every configured public, authenticated, role-specific and custom route is independently editable.</Typography><TextField size="small" placeholder="Search pages, modules or routes" value={query} onChange={(event) => setQuery(event.target.value)} InputProps={{ startAdornment: <SearchRounded sx={{ mr: .6, fontSize: 17 }} /> }} />{pages.filter((entry) => !query || `${entry.label} ${entry.path}`.toLowerCase().includes(query.toLowerCase())).map((entry) => <Button key={entry.key} fullWidth variant={pageKey === entry.key ? 'contained' : 'text'} onClick={() => setPageKey(entry.key)} sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 1 }}><Stack><Typography fontSize={12} fontWeight={800}>{entry.label}</Typography><Typography fontSize={10} sx={{ opacity: .7 }}>{entry.path}</Typography></Stack></Button>)}<Button size="small" startIcon={<AddRounded />} onClick={createPage}>Create page</Button><Divider sx={{ my: 1 }} /><Typography fontWeight={850} fontSize={12}>Page settings</Typography>{page && <><TextField size="small" label="Page label" value={page.label} onChange={(event) => updatePage({ label: event.target.value })} /><TextField size="small" label="Route" value={page.path} onChange={(event) => updatePage({ path: event.target.value })} /><FormControl size="small"><InputLabel>Header</InputLabel><Select value={page.headerVariant} label="Header" onChange={(event) => updatePage({ headerVariant: event.target.value as any })}><MenuItem value="default">Default</MenuItem><MenuItem value="minimal">Minimal</MenuItem><MenuItem value="hero">Hero</MenuItem></Select></FormControl><FormControl size="small"><InputLabel>Footer</InputLabel><Select value={page.footerVariant} label="Footer" onChange={(event) => updatePage({ footerVariant: event.target.value as any })}><MenuItem value="default">Default</MenuItem><MenuItem value="minimal">Minimal</MenuItem><MenuItem value="hidden">Hidden</MenuItem></Select></FormControl><ColorToken label="Page background" value={page.background} onChange={(value) => updatePage({ background: value })} /><NumberToken label="Max width" value={page.maxWidth} min={640} max={1920} onChange={(value) => updatePage({ maxWidth: value })} /></>}</Stack>}
          {panel === 'layers' && <Stack spacing={.65}><Stack direction="row" alignItems="center" justifyContent="space-between"><Typography className="sa-page-kicker">Layers</Typography><Button size="small" startIcon={<AddRounded />} onClick={() => addLayer()}>Add</Button></Stack><TextField size="small" placeholder="Search layers" value={query} onChange={(event) => setQuery(event.target.value)} InputProps={{ startAdornment: <SearchRounded sx={{ mr: .6, fontSize: 17 }} /> }} />{layers.filter((layer) => !query || layer.label.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.zIndex - a.zIndex).map((layer) => { const Icon = resolveIconComponent(layer.component); return <Stack key={layer.id} draggable={!layer.locked} onDragStart={() => setDragKey(layer.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (!dragKey || dragKey === layer.id) return; const next = clone(design); const source = materialiseLayers(next.canvas.layers, page); const from = source.findIndex((item) => item.id === dragKey); const to = source.findIndex((item) => item.id === layer.id); if (from >= 0 && to >= 0) { const [moved] = source.splice(from, 1); source.splice(to, 0, moved); source.forEach((item, index) => { item.zIndex = index; }); next.canvas.layers = source; commit(normaliseDesignSystem(next)); } }} direction="row" alignItems="center" spacing={.4} sx={{ px: .5, py: .35, border: '1px solid', borderColor: selectedIds.includes(layer.id) ? 'primary.main' : 'transparent', bgcolor: selectedIds.includes(layer.id) ? 'action.selected' : 'transparent', cursor: 'pointer' }} onClick={(event) => selectLayer(event, layer.id)}><DragIndicatorRounded sx={{ fontSize: 15, color: 'text.disabled' }} /><Icon sx={{ fontSize: 17, color: 'primary.main' }} /><Typography noWrap sx={{ flex: 1, fontSize: 11.5, fontWeight: selectedIds.includes(layer.id) ? 800 : 600 }}>{layer.label}</Typography>{layer.locked ? <LockRounded sx={{ fontSize: 14 }} /> : null}{layer.visible ? <VisibilityRounded sx={{ fontSize: 15, color: 'text.disabled' }} /> : <VisibilityOffRounded sx={{ fontSize: 15 }} />}</Stack>; })}<Stack direction="row" spacing={.5} sx={{ pt: 1 }}><Button size="small" onClick={() => updateLayer({ zIndex: (displayLayer?.zIndex || 0) + 1 })} startIcon={<ArrowUpwardRounded />}>Front</Button><Button size="small" onClick={() => updateLayer({ zIndex: Math.max(0, (displayLayer?.zIndex || 0) - 1) })} startIcon={<ArrowDownwardRounded />}>Back</Button></Stack></Stack>}
          {panel === 'components' && <Stack spacing={1}><Typography className="sa-page-kicker">Reusable components</Typography><Typography variant="caption" color="text.secondary">Edit a master once and apply it everywhere. Page overrides remain local to the selected page.</Typography>{componentNames.map((key) => { const master = design.componentLibrary[key]; return <Card key={key} variant="outlined"><CardContent sx={{ p: 1 }}><Stack direction="row" alignItems="center" spacing={.6}><WidgetsRounded sx={{ fontSize: 16, color: 'primary.main' }} /><Typography sx={{ flex: 1, fontSize: 11.5, fontWeight: 800 }}>{key.replaceAll('-', ' ')}</Typography><Switch size="small" checked={master?.enabled !== false} onChange={(_, value) => update(`componentLibrary.${key}.enabled`, value)} /></Stack><Stack direction="row" spacing={.7} sx={{ mt: .7 }}><NumberToken label="Radius" value={master?.radius || 12} min={0} max={40} onChange={(value) => update(`componentLibrary.${key}.radius`, value)} /><NumberToken label="Height" value={master?.height || 40} min={20} max={120} onChange={(value) => update(`componentLibrary.${key}.height`, value)} /></Stack></CardContent></Card>})}</Stack>}
          {panel === 'assets' && <Stack spacing={1.3}><Typography className="sa-page-kicker">Brand kit & assets</Typography><Alert severity="info">Upload approved image icons for the bottom app bar, global file sharing and every Quick Access card. Changes remain staged until Publish.</Alert><TextField size="small" label="Primary full-width logo URL" value={design.branding.logoUrl} onChange={(event) => update('branding.logoUrl', event.target.value)} /><TextField size="small" label="Light / dark logo URL" value={design.branding.logoLightUrl} onChange={(event) => update('branding.logoLightUrl', event.target.value)} /><TextField size="small" label="Favicon URL" value={design.branding.faviconUrl} onChange={(event) => update('branding.faviconUrl', event.target.value)} />{design.branding.logoUrl && <Box component="img" src={design.branding.logoUrl} alt="Brand preview" sx={{ width: '100%', maxHeight: 72, objectFit: 'contain', objectPosition: 'left center', border: '1px solid', borderColor: 'divider', p: 1 }} />}<ColorToken label="Brand primary" value={design.branding.primary} onChange={(value) => update('branding.primary', value)} /><ColorToken label="Brand accent" value={design.branding.accent} onChange={(value) => update('branding.accent', value)} /><TextField size="small" label="Brand font" value={OPEN_SANS_FONT_NAME} helperText="Open Sans is enforced across the application." InputProps={{ readOnly: true }} /><Divider sx={{ my: .5 }} /><Typography fontWeight={850} fontSize={12}>Bottom app bar icons</Typography><Typography variant="caption" color="text.secondary">One image can be assigned per destination. The fallback Material icon remains active when no upload exists.</Typography><Grid container spacing={1}>{bottomAppBarIconDefinitions.map(([key, label]) => <Grid size={{ xs: 12, sm: 6 }} key={key}><IconAssetUpload label={label} value={design.iconAssets.bottomAppBar[key]} onChange={(value) => update(`iconAssets.bottomAppBar.${key}`, value)} /></Grid>)}</Grid><Divider sx={{ my: .5 }} /><Typography fontWeight={850} fontSize={12}>Global share icon</Typography><IconAssetUpload label="Share action" value={design.iconAssets.globalShare} onChange={(value) => update('iconAssets.globalShare', value)} /><Divider sx={{ my: .5 }} /><Typography fontWeight={850} fontSize={12}>Quick Access category icons</Typography><Typography variant="caption" color="text.secondary">These uploads appear on the circular Quick Access cards in the Document Vault.</Typography><Grid container spacing={1}>{quickAccessIconDefinitions.map(([key, label]) => <Grid size={{ xs: 12, sm: 6 }} key={key}><IconAssetUpload label={label} value={design.iconAssets.quickAccess[key]} onChange={(value) => update(`iconAssets.quickAccess.${key}`, value)} /></Grid>)}</Grid></Stack>}
          {panel === 'icons' && <Stack spacing={1}><Typography className="sa-page-kicker">Icon & asset manager</Typography><Typography variant="caption" color="text.secondary">{ICON_LIBRARY_SIZE.toLocaleString()} performance-safe production icons. Favorites and recent choices are stored by name.</Typography><TextField size="small" placeholder="Search production icons" value={query} onChange={(event) => setQuery(event.target.value)} InputProps={{ startAdornment: <SearchRounded sx={{ mr: .6, fontSize: 17 }} /> }} /><Stack direction="row" spacing={.7}><FormControl size="small" fullWidth><InputLabel>Style</InputLabel><Select value={iconStyle} label="Style" onChange={(event) => setIconStyle(event.target.value)}>{['outline', 'filled', 'rounded', 'sharp', 'two-tone'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl><FormControl size="small" fullWidth><InputLabel>Tone</InputLabel><Select value={iconTone} label="Tone" onChange={(event) => setIconTone(event.target.value)}>{['monochrome', 'colorful'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Stack><NumberToken label="Icon size" value={design.iconLibrary.size} min={12} max={64} onChange={(value) => update('iconLibrary.size', value)} /><ColorToken label="Icon colour" value={design.iconLibrary.defaultColor} onChange={(value) => update('iconLibrary.defaultColor', value)} /><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: .4, maxHeight: 410, overflowY: 'auto' }}>{icons.map((entry) => { const Icon = resolveIconComponent(entry.name); const favorite = design.iconLibrary.favorites.includes(entry.name); return <Tooltip key={entry.name} title={`${entry.label} · ${entry.style}`}><IconButton onClick={() => { const favorites = favorite ? design.iconLibrary.favorites.filter((name) => name !== entry.name) : [...design.iconLibrary.favorites, entry.name].slice(-100); const next = clone(design); next.iconLibrary.favorites = favorites; next.iconLibrary.recent = [entry.name, ...next.iconLibrary.recent.filter((name) => name !== entry.name)].slice(0, 100); commit(normaliseDesignSystem(next)); }} sx={{ display: 'grid', placeItems: 'center', minHeight: 46, border: '1px solid', borderColor: favorite ? 'secondary.main' : 'divider', color: design.iconLibrary.tone === 'colorful' ? 'secondary.main' : design.iconLibrary.defaultColor }}><Icon sx={{ fontSize: 22 }} /></IconButton></Tooltip>; })}</Box></Stack>}
          {panel === 'menus' && <Stack spacing={1}><Typography className="sa-page-kicker">Navigation builder</Typography><Typography variant="caption" color="text.secondary">Drag rows to reorder. Keep role-based visibility and login requirements enforced by the server.</Typography>{navigation.map((item, index) => { const Icon = resolveIconComponent(item.icon); return <Stack key={item.key} draggable onDragStart={() => setDragKey(item.key)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (!dragKey || dragKey === item.key) return; const next = [...navigation]; const from = next.findIndex((entry) => entry.key === dragKey); const to = next.findIndex((entry) => entry.key === item.key); const [moved] = next.splice(from, 1); next.splice(to, 0, moved); updateNavigation(next.map((entry, order) => ({ ...entry, order: (order + 1) * 10 }))); }} direction="row" alignItems="center" spacing={.5} sx={{ p: .5, border: '1px solid', borderColor: 'divider', bgcolor: item.enabled ? 'transparent' : 'action.disabledBackground' }}><DragIndicatorRounded sx={{ fontSize: 15, color: 'text.disabled' }} /><Icon sx={{ fontSize: 17, color: 'primary.main' }} /><Typography noWrap sx={{ flex: 1, fontSize: 11.5, fontWeight: 700 }}>{item.label}</Typography><Chip size="small" label={item.placement} sx={{ fontSize: 9 }} /><Switch size="small" checked={item.enabled} onChange={(_, value) => updateNavigation(navigation.map((entry) => entry.key === item.key ? { ...entry, enabled: value } : entry))} /></Stack>})}<Button size="small" startIcon={<AddRounded />} onClick={() => updateNavigation([...navigation, { ...knownNavigation[0], key: `custom-${navigation.length + 1}`, label: 'New menu item', path: '/app/dashboard', order: (navigation.length + 1) * 10 }])}>Add menu item</Button></Stack>}
        </Box>
        <Divider sx={{ my: 1.5 }} />
        <Stack spacing={1}><Typography fontWeight={850} fontSize={12}>Design profiles & quality</Typography><Stack direction="row" spacing={.7}><FormControl size="small" fullWidth><InputLabel>Theme</InputLabel><Select value={design.profiles.theme} label="Theme" onChange={(event) => update('profiles.theme', event.target.value)}>{['light', 'dark', 'high-contrast', 'campaign'].map((value) => <MenuItem key={value} value={value}>{value.replace('-', ' ')}</MenuItem>)}</Select></FormControl><FormControl size="small" fullWidth><InputLabel>Dashboard system</InputLabel><Select value={design.profiles.dashboard} label="Dashboard system" onChange={(event) => update('profiles.dashboard', event.target.value)}><MenuItem value="secureasset">SecureAsset</MenuItem><MenuItem value="midnight">Midnight</MenuItem><MenuItem value="editorial">Editorial</MenuItem><MenuItem value="soft">Soft</MenuItem></Select></FormControl></Stack><Stack direction="row" spacing={.7}><NumberToken label="Motion ms" value={design.motion.duration} min={0} max={1200} onChange={(value) => update('motion.duration', value)} /><NumberToken label="Grid px" value={design.motion.gridSpacing} min={2} max={64} onChange={(value) => update('motion.gridSpacing', value)} /></Stack><FormControl size="small"><InputLabel>Button priority</InputLabel><Select value={buttonVariant} label="Button priority" onChange={(event) => setButtonVariant(event.target.value as keyof DesignSystem['buttons'])}>{Object.keys(design.buttons).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl><Stack direction="row" spacing={.5} flexWrap="wrap" useFlexGap><Chip size="small" color="success" icon={<CheckRounded />} label="Contrast tokens bounded" /><Chip size="small" color={design.canvas.layers.some((layer) => !layer.dataBinding && layer.type === 'component') ? 'warning' : 'success'} label={design.canvas.layers.some((layer) => !layer.dataBinding && layer.type === 'component') ? 'Review unbound data' : 'Data bindings set'} /><Chip size="small" color="success" icon={<CheckRounded />} label="Routes use server access" /></Stack></Stack>
      </Paper>
      <Box sx={{ minWidth: 0, bgcolor: '#E8ECEB', p: { xs: 1.2, md: 2 }, position: 'relative', overflow: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Stack direction="row" spacing={.7} alignItems="center"><SplitscreenRounded sx={{ fontSize: 17, color: 'primary.main' }} /><Typography fontSize={12} fontWeight={850}>{liveMode ? 'Live page' : 'Canvas'} · {page?.label || 'Untitled page'} · {device}</Typography><Chip size="small" label={page?.path || '/'} /><Chip size="small" color={liveMode ? 'success' : 'default'} label={liveMode ? 'Edit on page' : 'Frame editor'} /></Stack><Stack direction="row" spacing={.4}>{toolbarButton('Toggle rulers', <GridViewRounded fontSize="small" />, () => update('canvas.rulers', !design.canvas.rulers))}{toolbarButton('Toggle guides', <DoneAllRounded fontSize="small" />, () => update('canvas.guides', !design.canvas.guides))}<FormControlLabel sx={{ ml: 0 }} control={<Switch size="small" checked={design.canvas.snapToGrid} onChange={(_, value) => update('canvas.snapToGrid', value)} />} label={<Typography fontSize={10}>Snap</Typography>} /></Stack></Stack>
        <Box sx={{ width: deviceWidth[device], maxWidth: '100%', mx: 'auto', transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'width .2s', bgcolor: page?.surface || '#fff', backgroundImage: design.canvas.guides ? `linear-gradient(${design.colors.border}55 1px, transparent 1px), linear-gradient(90deg, ${design.colors.border}55 1px, transparent 1px)` : 'none', backgroundSize: `${design.canvas.gridSize}px ${design.canvas.gridSize}px`, border: '1px solid', borderColor: 'divider', boxShadow: '0 24px 60px rgba(15,35,40,.16)', minHeight: device === 'mobile' ? 720 : 600, position: 'relative', overflow: 'hidden' }} onClick={() => setSelectedState([])}>
          {layers.sort((a, b) => a.zIndex - b.zIndex).map((layer) => layer.visible ? <LiveLayer key={layer.id} layer={layer} selected={selectedIds.includes(layer.id)} primaryColor={design.colors.primary} borderColor={design.colors.border} snapToGrid={design.canvas.snapToGrid} gridSize={design.canvas.gridSize} zoom={zoom} onSelect={(event) => { event.stopPropagation(); selectLayer(event, layer.id); }} onPosition={(x, y) => updateLayer({ x, y })} onResize={(width, height) => updateLayer({ width, height })} /> : null)}
          {!layers.length && <Stack alignItems="center" justifyContent="center" sx={{ height: 500, color: 'text.secondary' }}><GridViewRounded sx={{ fontSize: 42, opacity: .35 }} /><Typography fontWeight={800}>Empty frame</Typography><Button startIcon={<AddRounded />} onClick={() => addLayer('card')}>Add component</Button></Stack>}
        </Box>
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.5, color: 'text.secondary' }}><Typography fontSize={10}>Drag to position</Typography><Typography fontSize={10}>•</Typography><Typography fontSize={10}>Select multiple with Ctrl / ⌘</Typography><Typography fontSize={10}>•</Typography><Typography fontSize={10}>Snap {design.canvas.snapToGrid ? 'on' : 'off'}</Typography></Stack>
      </Box>
      <Paper square elevation={0} sx={{ borderLeft: { lg: '1px solid' }, borderTop: { xs: '1px solid', lg: 0 }, borderColor: 'divider', p: 1.4, overflowY: 'auto', maxHeight: { lg: 720 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography className="sa-page-kicker">Properties</Typography><Stack direction="row" spacing={.1}>{toolbarButton('Duplicate', <ContentCopyRounded fontSize="small" />, duplicateLayer, !displayLayer)}{toolbarButton('Group selection', <GroupWorkRounded fontSize="small" />, () => selectedIds.length > 1 && selectedIds.forEach((id) => updateLayer({ parentId: 'group-1' })), selectedIds.length < 2)}{toolbarButton(displayLayer?.locked ? 'Unlock layer' : 'Lock layer', displayLayer?.locked ? <LockRounded fontSize="small" /> : <LockRounded fontSize="small" />, () => updateLayer({ locked: !displayLayer?.locked }), !displayLayer)}{toolbarButton('Delete layer', <DeleteRounded fontSize="small" />, () => { if (!displayLayer) return; const next = clone(design); next.canvas.layers = materialiseLayers(next.canvas.layers, page).filter((layer) => layer.id !== displayLayer.id); commit(normaliseDesignSystem(next)); setSelectedState([]); }, !displayLayer)}</Stack></Stack>
        {displayLayer ? <Stack spacing={1.4} sx={{ mt: 1.2 }}><TextField size="small" label="Layer name" value={displayLayer.label} onChange={(event) => updateLayer({ label: event.target.value })} /><TextField size="small" select label="Component" value={displayLayer.component} onChange={(event) => updateLayer({ component: event.target.value })}>{componentNames.map((key) => <MenuItem key={key} value={key}>{key.replaceAll('-', ' ')}</MenuItem>)}</TextField><Grid container spacing={1}><Grid size={6}><NumberToken label="X" value={displayLayer.x} min={-2000} max={4000} onChange={(value) => updateLayer({ x: value })} /></Grid><Grid size={6}><NumberToken label="Y" value={displayLayer.y} min={-2000} max={4000} onChange={(value) => updateLayer({ y: value })} /></Grid><Grid size={6}><NumberToken label="Width" value={displayLayer.width} min={40} max={1920} onChange={(value) => updateLayer({ width: value })} /></Grid><Grid size={6}><NumberToken label="Height" value={displayLayer.height} min={24} max={1200} onChange={(value) => updateLayer({ height: value })} /></Grid><Grid size={6}><NumberToken label="Z-index" value={displayLayer.zIndex} min={0} max={9999} onChange={(value) => updateLayer({ zIndex: value })} /></Grid></Grid><TextField size="small" label="Data binding" value={displayLayer.dataBinding} onChange={(event) => updateLayer({ dataBinding: event.target.value })} helperText="Connect to a validated resource path; preview uses sample data." /><TextField size="small" label="Interaction" value={displayLayer.interaction} onChange={(event) => updateLayer({ interaction: event.target.value })} helperText="e.g. navigate:/app/payments or modal:review" /><LayerStyleEditor style={displayLayer.style} onChange={(patch) => updateLayer({ style: { ...displayLayer.style, ...patch } })} /><Divider /><Typography fontWeight={850} fontSize={12}>Auto-layout & responsive constraints</Typography><Stack direction="row" spacing={.7}><FormControl size="small" fullWidth><InputLabel>Page layout</InputLabel><Select value={page?.density || 'comfortable'} label="Page layout" onChange={(event) => updatePage({ density: event.target.value as any })}><MenuItem value="compact">Compact</MenuItem><MenuItem value="comfortable">Comfortable</MenuItem><MenuItem value="spacious">Spacious</MenuItem></Select></FormControl><NumberToken label="Page padding" value={page?.padding || 16} min={0} max={96} onChange={(value) => updatePage({ padding: value })} /></Stack><Stack direction="row" spacing={.7}><NumberToken label="Responsive gap" value={page?.desktop.gap || design.motion.gridSpacing} min={0} max={96} onChange={(value) => updatePage({ desktop: { ...page.desktop, gap: value } })} /><NumberToken label="Responsive columns" value={page?.desktop.columns || 12} min={1} max={24} onChange={(value) => updatePage({ desktop: { ...page.desktop, columns: value } })} /></Stack><Typography fontWeight={850} fontSize={12}>Component master · {selectedComponent}</Typography><Stack direction="row" spacing={.7}><NumberToken label="Master radius" value={design.componentLibrary[selectedComponent]?.radius || design.borders.cardRadius} min={0} max={40} onChange={(value) => update(`componentLibrary.${selectedComponent}.radius`, value)} /><NumberToken label="Master height" value={design.componentLibrary[selectedComponent]?.height || design.effects.buttonHeight} min={20} max={120} onChange={(value) => update(`componentLibrary.${selectedComponent}.height`, value)} /></Stack>{selectedComponent === 'button' && <Stack spacing={1}><Typography fontWeight={800} fontSize={12}>Advanced button editor</Typography><FormControl size="small"><InputLabel>Priority</InputLabel><Select value={buttonVariant} label="Priority" onChange={(event) => setButtonVariant(event.target.value as keyof DesignSystem['buttons'])}>{Object.keys(design.buttons).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl><ColorToken label="Background" value={design.buttons[buttonVariant].background} onChange={(value) => update(`buttons.${buttonVariant}.background`, value)} /><ColorToken label="Text" value={design.buttons[buttonVariant].text} onChange={(value) => update(`buttons.${buttonVariant}.text`, value)} /><ColorToken label="Hover" value={design.buttons[buttonVariant].hoverBackground} onChange={(value) => update(`buttons.${buttonVariant}.hoverBackground`, value)} /><TextField size="small" label="Gradient (optional CSS gradient token)" value={design.buttons[buttonVariant].gradient} onChange={(event) => update(`buttons.${buttonVariant}.gradient`, event.target.value)} /><Stack direction="row" spacing={.7}><NumberToken label="Height" value={design.buttons[buttonVariant].height} min={28} max={88} onChange={(value) => update(`buttons.${buttonVariant}.height`, value)} /><NumberToken label="Icon gap" value={design.buttons[buttonVariant].iconGap} min={0} max={24} onChange={(value) => update(`buttons.${buttonVariant}.iconGap`, value)} /></Stack><FormControl size="small"><InputLabel>Responsive sizing</InputLabel><Select value={design.buttons[buttonVariant].widthMode} label="Responsive sizing" onChange={(event) => update(`buttons.${buttonVariant}.widthMode`, event.target.value)}><MenuItem value="auto">Auto</MenuItem><MenuItem value="fixed">Fixed</MenuItem><MenuItem value="full">Full width</MenuItem></Select></FormControl></Stack>}<Divider /><Typography fontWeight={850} fontSize={12}>Bottom app bar</Typography><FormControlLabel control={<Switch size="small" checked={design.bottomAppBar.enabled} onChange={(_, value) => update('bottomAppBar.enabled', value)} />} label={<Typography fontSize={11}>Enabled</Typography>} /><Grid container spacing={1}><Grid size={6}><NumberToken label="Height" value={design.bottomAppBar.height} min={48} max={104} onChange={(value) => update('bottomAppBar.height', value)} /></Grid><Grid size={6}><NumberToken label="Icon size" value={design.bottomAppBar.iconSize} min={14} max={36} onChange={(value) => update('bottomAppBar.iconSize', value)} /></Grid></Grid><ColorToken label="Bar background" value={design.bottomAppBar.background} onChange={(value) => update('bottomAppBar.background', value)} /><Stack direction="row" spacing={.7}><ColorToken label="Active" value={design.bottomAppBar.activeColor} onChange={(value) => update('bottomAppBar.activeColor', value)} /><ColorToken label="Inactive" value={design.bottomAppBar.inactiveColor} onChange={(value) => update('bottomAppBar.inactiveColor', value)} /></Stack><FormControl size="small"><InputLabel>Active indicator</InputLabel><Select value={design.bottomAppBar.activeIndicator} label="Active indicator" onChange={(event) => update('bottomAppBar.activeIndicator', event.target.value)}><MenuItem value="line">Line</MenuItem><MenuItem value="pill">Pill</MenuItem><MenuItem value="none">None</MenuItem></Select></FormControl></Stack> : <Stack alignItems="center" sx={{ py: 10, color: 'text.secondary' }}><OpenWithRounded /><Typography fontSize={12} sx={{ mt: 1 }}>Select a component to redesign</Typography></Stack>}
      </Paper>
    </Box>
    <Box sx={{ px: 2, py: .8, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}><Typography className="sa-page-kicker">Responsive controls</Typography><Chip size="small" icon={<GridViewRounded />} label={`Grid ${design.canvas.gridSize}px`} /><Chip size="small" label={`Desktop ${page?.desktop.columns} columns`} /><Chip size="small" label={`Tablet ${page?.tablet.columns} columns`} /><Chip size="small" label={`Mobile ${page?.mobile.columns} columns`} /><Box sx={{ flex: 1 }} /><Button size="small" startIcon={<RestartAltRounded />} onClick={() => { const next = clone(design); next.canvas.layers = []; commit(normaliseDesignSystem(next)); }}>Reset canvas</Button><Typography fontSize={10} color="text.secondary">Structured tokens only · no unrestricted CSS</Typography></Box>
  </Box>;
}
