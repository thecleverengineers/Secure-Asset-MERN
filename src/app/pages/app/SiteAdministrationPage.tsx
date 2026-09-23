import { Suspense, useEffect, useMemo, useState, type ChangeEvent, type Dispatch, type KeyboardEvent, type MouseEvent, type SetStateAction } from 'react';
import { useLocation } from 'react-router';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Chip, CircularProgress, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, Grid, IconButton, MenuItem, Paper, Stack, Switch, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import LocationFields from '../../components/shared/LocationFields';
import AddRounded from '@mui/icons-material/AddRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import BusinessRounded from '@mui/icons-material/BusinessRounded';
import CategoryRounded from '@mui/icons-material/CategoryRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import EventRounded from '@mui/icons-material/EventRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import HomeRounded from '@mui/icons-material/HomeRounded';
import HotelRounded from '@mui/icons-material/HotelRounded';
import ImageRounded from '@mui/icons-material/ImageRounded';
import LanguageRounded from '@mui/icons-material/LanguageRounded';
import LandscapeRounded from '@mui/icons-material/LandscapeRounded';
import PaletteRounded from '@mui/icons-material/PaletteRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SlideshowRounded from '@mui/icons-material/SlideshowRounded';
import SortRounded from '@mui/icons-material/SortRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import StraightenRounded from '@mui/icons-material/StraightenRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import UploadRounded from '@mui/icons-material/UploadRounded';
import ViewQuiltRounded from '@mui/icons-material/ViewQuiltRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import { createResource, deleteResource, getAppConfiguration, getFast2SmsSettings, getMapsPlatformStatus, getMapsSettings, getRazorpaySettings, getResource, testFast2SmsSettings, updateFast2SmsSettings, updateMapsSettings, updateRazorpaySettings, updateResource, uploadSiteAsset } from '../../services/api';
import { useSite } from '../../context/SiteContext';
import { useActionDialog } from '../../components/shared/useActionDialog';
import type { Fast2SmsSettings, MapsSettings } from '../../services/types';
import { DESIGN_PRESETS, designPreset, normaliseDesignSystem, OPEN_SANS_FONT_NAME } from '../../designSystem';
import AppLoadingScreen from '../../components/shared/AppLoadingScreen';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

// The searchable 1,000+ icon catalogue is an admin-only tool. Keep it out of
// the normal authenticated shell and load it only when the design studio is
// opened.
const AdvancedDesignStudio = lazyWithRetry(() => import('./AdvancedDesignStudio'));

type FormShape = Record<string, any>;
const get = (object: any, path: string) => path.split('.').reduce((value, key) => value?.[key], object);
const set = (object: any, path: string, value: any) => { const keys = path.split('.'); let current = object; keys.slice(0, -1).forEach((key) => { current[key] ||= {}; current = current[key]; }); current[keys[keys.length - 1]] = value; return object; };
const synchroniseLogoSources = (payload: FormShape, source: 'site' | 'design'): FormShape => {
  const next = { ...payload };
  const design = { ...(next.design || {}) };
  const branding = { ...(design.branding || {}) };
  const valueFor = (topKey: string, nestedKey: string) => source === 'design'
    ? (branding[nestedKey] !== undefined ? branding[nestedKey] : next[topKey])
    : (next[topKey] !== undefined ? next[topKey] : branding[nestedKey]);
  [['logoUrl', 'logoUrl'], ['logoLightUrl', 'logoLightUrl'], ['faviconUrl', 'faviconUrl']].forEach(([topKey, nestedKey]) => {
    const value = valueFor(topKey, nestedKey);
    if (value !== undefined) {
      next[topKey] = value;
      branding[nestedKey] = value;
    }
  });
  next.design = { ...design, branding };
  return next;
};
const sentence = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const siteFields = [
  ['siteTitle', 'Site title'], ['shortTitle', 'Short title'], ['tagline', 'Tagline'], ['description', 'Site description'],
  ['logoUrl', 'Primary logo URL'], ['logoLightUrl', 'Light-mode logo URL'], ['faviconUrl', 'Favicon URL'], ['defaultOgImageUrl', 'Default social image URL'],
  ['brand.primaryColor', 'Primary colour'], ['brand.secondaryColor', 'Secondary colour'], ['brand.accentColor', 'Accent colour'],
  ['contact.email', 'Contact email'], ['contact.phone', 'Contact phone'], ['contact.whatsapp', 'WhatsApp'], ['contact.address', 'Office address'], ['contact.supportHours', 'Support hours'],
  ['social.facebook', 'Facebook URL'], ['social.instagram', 'Instagram URL'], ['social.x', 'X URL'], ['social.linkedin', 'LinkedIn URL'], ['social.youtube', 'YouTube URL'],
  ['seo.defaultTitle', 'Default SEO title'], ['seo.defaultDescription', 'Default SEO description'], ['seo.titleTemplate', 'Title template'], ['seo.robots', 'Default robots'], ['seo.canonicalBaseUrl', 'Canonical base URL'], ['seo.googleSiteVerification', 'Google site verification token'],
  ['maintenance.message', 'Maintenance message'],
  ['authentication.badge', 'Login badge'], ['authentication.headline', 'Login headline'], ['authentication.description', 'Login description'], ['authentication.features', 'Login feature chips (comma separated)'], ['authentication.footerText', 'Login footer'],
  ['authentication.loginTitle', 'Login title'], ['authentication.loginSubtitle', 'Login subtitle'], ['authentication.registerTitle', 'Registration title'], ['authentication.registerSubtitle', 'Registration subtitle'], ['authentication.otpTitle', 'OTP title'], ['authentication.otpSubtitle', 'OTP subtitle'], ['authentication.forgotTitle', 'Forgot-password title'], ['authentication.forgotSubtitle', 'Forgot-password subtitle'],
] as const;

type FooterLink = { label: string; path: string; external?: boolean };
type FooterGroup = { heading: string; links: FooterLink[] };
const defaultFooterNavigation: FooterGroup[] = [
  { heading: 'Platform', links: [{ label: 'Marketplace', path: '/marketplace' }, { label: 'Pricing', path: '/pricing' }, { label: 'About SecureAsset', path: '/about' }] },
  { heading: 'Operations', links: [{ label: 'Rent automation', path: '/pricing' }, { label: 'Document vault', path: '/login' }, { label: 'Surveyor marketplace', path: '/surveyors' }] },
  { heading: 'Access', links: [{ label: 'Secure login', path: '/login' }, { label: 'Create account', path: '/login?mode=register' }, { label: 'Contact support', path: '/contact' }] },
];
const defaultLegalLinks: FooterLink[] = [{ label: 'Privacy Policy', path: '/privacy-policy' }, { label: 'Terms of Service', path: '/terms-of-service' }, { label: 'Request a callback', path: '/callback' }];
const defaultCallback = { label: 'Request a callback', path: '/callback' };
const copyFooterNavigation = (value: any): FooterGroup[] => Array.isArray(value) && value.length ? value.map((group) => ({ heading: String(group?.heading || ''), links: Array.isArray(group?.links) ? group.links.map((link: any) => ({ label: String(link?.label || ''), path: String(link?.path || ''), external: Boolean(link?.external) })) : [] })) : defaultFooterNavigation.map((group) => ({ ...group, links: group.links.map((link) => ({ ...link })) }));
const copyFooterLinks = (value: any): FooterLink[] => Array.isArray(value) && value.length ? value.map((link) => ({ label: String(link?.label || ''), path: String(link?.path || ''), external: Boolean(link?.external) })) : defaultLegalLinks.map((link) => ({ ...link }));

type CollectionDefinition = { resource: string; title: string; description: string; columns: string[]; fields: Array<{ key: string; label: string; type?: 'text'|'number'|'boolean'|'select'|'textarea'|'array'|'json'|'image'; options?: string[]; required?: boolean; helper?: string }> };
const definitions: CollectionDefinition[] = [
  { resource: 'design-studio', title: 'Application Design Studio', description: 'Control the global visual system for cards, modals, navigation, buttons and iconography.', columns: [], fields: [] },
  { resource: 'seo-pages', title: 'SEO Pages', description: 'Database-controlled title, description, social cards, robots and structured data for each route.', columns: ['path','title','robots','active'], fields: [
    { key:'path',label:'Route path',required:true },{key:'title',label:'SEO title',required:true},{key:'description',label:'Meta description',type:'textarea'},{key:'keywords',label:'Keywords',type:'array'},
    {key:'canonicalUrl',label:'Canonical URL'},{key:'robots',label:'Robots',options:['index,follow','noindex,follow','noindex,nofollow'],type:'select'},
    {key:'ogTitle',label:'Open Graph title'},{key:'ogDescription',label:'Open Graph description',type:'textarea'},{key:'ogImageUrl',label:'Open Graph image URL'},
    {key:'structuredData',label:'JSON-LD structured data',type:'json'},{key:'active',label:'Active',type:'boolean'},
  ]},
  { resource: 'home-carousel', title: 'Homepage Carousel', description: 'Schedule hero slides, responsive images, calls-to-action and audience targeting.', columns: ['sortOrder','title','audience','startsAt','endsAt','active'], fields: [
    {key:'title',label:'Headline',required:true},{key:'subtitle',label:'Subtitle',type:'textarea'},{key:'eyebrow',label:'Eyebrow text'},
    {key:'imageUrl',label:'Desktop carousel image',type:'image',helper:'Upload a wide desktop image. Recommended: 1920 × 720 px.'},{key:'mobileImageUrl',label:'Mobile carousel image',type:'image',helper:'Upload a portrait mobile image. Recommended: 1080 × 1350 px.'},{key:'altText',label:'Image alt text'},
    {key:'primaryCta.label',label:'Primary button label'},{key:'primaryCta.url',label:'Primary button URL'},{key:'secondaryCta.label',label:'Secondary button label'},{key:'secondaryCta.url',label:'Secondary button URL'},
    {key:'textAlign',label:'Text alignment',type:'select',options:['left','center','right']},{key:'audience',label:'Audience',type:'select',options:['all','tenant','landlord','surveyor']},
    {key:'sortOrder',label:'Sort order',type:'number'},{key:'startsAt',label:'Start date'},{key:'endsAt',label:'End date'},{key:'active',label:'Active',type:'boolean'},
  ]},
  { resource: 'home-sections', title: 'Homepage Sections', description: 'Control statistics, featured content, locations, testimonials and calls-to-action.', columns: ['sortOrder','key','type','title','active'], fields: [
    {key:'key',label:'Unique key',required:true},{key:'type',label:'Section type',type:'select',options:['stats','features','featured_properties','featured_surveyors','locations','testimonials','cta','custom'],required:true},
    {key:'title',label:'Title'},{key:'subtitle',label:'Subtitle',type:'textarea'},{key:'content',label:'Section content JSON',type:'json'},{key:'sortOrder',label:'Sort order',type:'number'},{key:'active',label:'Active',type:'boolean'},
  ]},
  { resource: 'property-type-configs', title: 'Property Types', description: 'Configure property categories, hierarchy modes and allowed listing purposes.', columns: ['sortOrder','label','category','hierarchyMode','active'], fields: [
    {key:'key',label:'Key',required:true},{key:'label',label:'Display label',required:true},{key:'category',label:'Category',type:'select',options:['residential','commercial','land','hospitality','event','other']},
    {key:'hierarchyMode',label:'Hierarchy mode',type:'select',options:['simple','building','apartment_building','pg_hostel','commercial','land']},{key:'allowedPurposes',label:'Purposes',type:'array'},{key:'fields',label:'Dynamic form fields JSON',type:'json'},{key:'sortOrder',label:'Sort order',type:'number'},{key:'active',label:'Active',type:'boolean'},
  ]},
  { resource: 'area-units', title: 'Area Units', description: 'Manage regional conversion values for square feet, square metres, Bigha, Katha, Lessa and other units.', columns: ['sortOrder','label','symbol','squareMetreFactor','active'], fields: [
    {key:'key',label:'Key',required:true},{key:'label',label:'Label',required:true},{key:'symbol',label:'Symbol'},{key:'squareMetreFactor',label:'Square metre factor',type:'number',required:true},
    {key:'region.country',label:'Country'},{key:'region.state',label:'State / Province'},{key:'region.city',label:'City'},{key:'sortOrder',label:'Sort order',type:'number'},{key:'active',label:'Active',type:'boolean'},
  ]},
  { resource: 'landlord-plans', title: 'Landlord Plans', description: 'Configure property hierarchy capacity, public listings, active tenants, Vault storage, access and billing.', columns: ['name','limits.properties','limits.buildings','limits.apartments','limits.rooms','limits.beds','limits.publicListings','limits.activeTenants','limits.storageMB','features.apiAccess','features.prioritySupport','prices.monthly','prices.yearly'], fields: [
    {key:'name',label:'Plan name',required:true},{key:'limits.properties',label:'Number of properties they can list',type:'number',required:true},
    {key:'limits.buildings',label:'Number of buildings they can manage',type:'number',required:true},{key:'limits.apartments',label:'Number of apartments they can manage',type:'number',required:true},
    {key:'limits.rooms',label:'Number of rooms they can manage',type:'number',required:true},{key:'limits.beds',label:'Number of beds they can manage',type:'number',required:true},
    {key:'limits.publicListings',label:'Number of public listings they can publish',type:'number',required:true},
    {key:'limits.activeTenants',label:'Number of active tenants they can manage',type:'number',required:true},{key:'limits.storageMB',label:'Total Vault storage (MB)',type:'number',required:true},
    {key:'features.apiAccess',label:'API access',type:'boolean'},{key:'features.prioritySupport',label:'Priority support',type:'boolean'},
    {key:'billingCycle',label:'Plan billing',type:'select',options:['monthly','yearly'],required:true},{key:'price',label:'Price (INR)',type:'number',required:true},
  ]},
];

function AssetUpload({ value, onChange, label, allowManualInput = true, helper }: { value?: string; onChange: (value:string)=>void; label:string; allowManualInput?: boolean; helper?: string }) {
  const [working,setWorking]=useState(false); const [error,setError]=useState('');
  async function upload(event: ChangeEvent<HTMLInputElement>) { const file=event.target.files?.[0]; if(!file)return; setWorking(true); setError(''); try { const result=await uploadSiteAsset(file); onChange(result.data.url); } catch(caught) { setError((caught as Error).message || 'Image upload failed'); } finally { setWorking(false); event.target.value=''; } }
  return <Stack spacing={1}>{allowManualInput ? <TextField label={label} value={value || ''} onChange={(event)=>onChange(event.target.value)} fullWidth size="small" /> : <Box><Typography sx={{fontSize:13,fontWeight:850}}>{label}</Typography><Typography color="text.secondary" sx={{fontSize:11.5,mt:.25}}>{helper || 'Upload an image from your device.'}</Typography></Box>}<Stack direction={{xs:'column',sm:'row'}} spacing={1}><Button component="label" variant="outlined" startIcon={working?<CircularProgress size={16}/>:<UploadRounded/>} disabled={working}>{working?'Uploading…':'Upload image'}<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload}/></Button>{value&&<Button className="sa-danger-button" variant="outlined" startIcon={<DeleteRounded/>} onClick={()=>onChange('')}>Remove image</Button>}</Stack>{error&&<Alert severity="error">{error}</Alert>}{value?<Box component="img" src={value} alt={label} sx={{height:132,width:'100%',objectFit:'cover',border:'1px solid',borderColor:'divider',p:.5}}/>:<Box sx={{minHeight:104,border:'1px dashed',borderColor:'divider',display:'grid',placeItems:'center',color:'text.secondary'}}><Stack alignItems="center" spacing={.5}><ImageRounded fontSize="small"/><Typography sx={{fontSize:11.5}}>No image uploaded</Typography></Stack></Box>}</Stack>;
}

function FooterAdministration({ settings, setSettings }: { settings: FormShape; setSettings: Dispatch<SetStateAction<FormShape>> }) {
  const footer = get(settings, 'footer') || {};
  const navigation = copyFooterNavigation(footer.navigation);
  const legalLinks = copyFooterLinks(footer.legalLinks);
  const callback = { ...defaultCallback, ...(footer.callback || {}) };
  const updateFooter = (patch: Record<string, any>) => setSettings((current) => ({
    ...current,
    footer: {
      description: current.footer?.description || '',
      navigation: copyFooterNavigation(current.footer?.navigation),
      legalLinks: copyFooterLinks(current.footer?.legalLinks),
      callback: { ...defaultCallback, ...(current.footer?.callback || {}) },
      ...patch,
    },
  }));
  const updateNavigation = (next: FooterGroup[]) => updateFooter({ navigation: next });
  const updateLegalLinks = (next: FooterLink[]) => updateFooter({ legalLinks: next });

  return <Stack spacing={3}>
    <Box><Typography variant="h6" fontWeight={900}>Footer, legal links & callback</Typography><Typography color="text.secondary" fontSize={13}>Manage the complete public footer here. The destination and copy of Privacy Policy, Terms of Service and Callback pages remain editable in the <b>Content Pages</b> module.</Typography></Box>
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }} justifyContent="space-between"><Alert severity="info" sx={{ flex: 1 }}>Changes in this tab publish with the Site settings button. Callback requests appear in Website Enquiries, including the visitor’s preferred time.</Alert><Button component="a" href="/app/content-pages" variant="outlined">Manage content pages</Button></Stack>
    <TextField fullWidth multiline minRows={3} label="Footer description" value={footer.description || ''} onChange={(event) => updateFooter({ description: event.target.value })} helperText="Shown below the logo on every public page." />
    <Divider />
    <Box><Typography fontWeight={900}>Callback call-to-action</Typography><Typography color="text.secondary" fontSize={13} sx={{ mt: .4 }}>Displayed in the footer and can point to your dynamic callback page or a different approved destination.</Typography></Box>
    <Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Callback label" value={callback.label || ''} onChange={(event) => updateFooter({ callback: { ...callback, label: event.target.value } })} /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Callback destination" value={callback.path || ''} onChange={(event) => updateFooter({ callback: { ...callback, path: event.target.value } })} helperText="Use /callback for the built-in callback request page." /></Grid></Grid>
    <Divider />
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}><Box><Typography fontWeight={900}>Footer navigation groups</Typography><Typography color="text.secondary" fontSize={13}>Add, remove and reorder the links displayed in the main footer columns.</Typography></Box><Button variant="outlined" startIcon={<AddRounded />} onClick={() => updateNavigation([...navigation, { heading: 'New group', links: [{ label: 'New link', path: '/' }] }])}>Add group</Button></Stack>
    <Stack spacing={2}>{navigation.map((group, groupIndex) => <Card variant="outlined" key={`${group.heading}-${groupIndex}`}><CardContent sx={{ p: { xs: 2, md: 2.5 } }}><Stack spacing={2}><Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}><TextField fullWidth size="small" label="Group heading" value={group.heading} onChange={(event) => updateNavigation(navigation.map((item, index) => index === groupIndex ? { ...item, heading: event.target.value } : item))} /><Button className="sa-danger-button" color="error" variant="outlined" startIcon={<DeleteRounded />} onClick={() => updateNavigation(navigation.filter((_item, index) => index !== groupIndex))}>Remove group</Button></Stack><Stack spacing={1.5}>{group.links.map((link, linkIndex) => <Grid container spacing={1} alignItems="center" key={`${link.label}-${linkIndex}`}><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth size="small" label="Link label" value={link.label} onChange={(event) => updateNavigation(navigation.map((item, index) => index === groupIndex ? { ...item, links: item.links.map((entry, entryIndex) => entryIndex === linkIndex ? { ...entry, label: event.target.value } : entry) } : item))} /></Grid><Grid size={{ xs: 12, md: 5 }}><TextField fullWidth size="small" label="Destination" value={link.path} onChange={(event) => updateNavigation(navigation.map((item, index) => index === groupIndex ? { ...item, links: item.links.map((entry, entryIndex) => entryIndex === linkIndex ? { ...entry, path: event.target.value } : entry) } : item))} /></Grid><Grid size={{ xs: 9, md: 3 }}><FormControlLabel control={<Switch size="small" checked={Boolean(link.external)} onChange={(_event, external) => updateNavigation(navigation.map((item, index) => index === groupIndex ? { ...item, links: item.links.map((entry, entryIndex) => entryIndex === linkIndex ? { ...entry, external } : entry) } : item))} />} label="Open in new tab" /></Grid><Grid size={{ xs: 3, md: 1 }} sx={{ textAlign: 'right' }}><IconButton className="sa-danger-button" color="error" onClick={() => updateNavigation(navigation.map((item, index) => index === groupIndex ? { ...item, links: item.links.filter((_entry, entryIndex) => entryIndex !== linkIndex) } : item))} aria-label="Remove footer link"><DeleteRounded /></IconButton></Grid></Grid>)}</Stack><Button size="small" variant="text" startIcon={<AddRounded />} sx={{ alignSelf: 'flex-start' }} onClick={() => updateNavigation(navigation.map((item, index) => index === groupIndex ? { ...item, links: [...item.links, { label: 'New link', path: '/' }] } : item))}>Add link</Button></Stack></CardContent></Card>)}</Stack>
    <Divider />
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}><Box><Typography fontWeight={900}>Footer legal & service links</Typography><Typography color="text.secondary" fontSize={13}>These links appear in the footer’s bottom row.</Typography></Box><Button variant="outlined" startIcon={<AddRounded />} onClick={() => updateLegalLinks([...legalLinks, { label: 'New legal link', path: '/' }])}>Add link</Button></Stack>
    <Stack spacing={1.5}>{legalLinks.map((link, index) => <Grid container spacing={1} alignItems="center" key={`${link.label}-${index}`}><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth size="small" label="Link label" value={link.label} onChange={(event) => updateLegalLinks(legalLinks.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></Grid><Grid size={{ xs: 12, md: 5 }}><TextField fullWidth size="small" label="Destination" value={link.path} onChange={(event) => updateLegalLinks(legalLinks.map((item, itemIndex) => itemIndex === index ? { ...item, path: event.target.value } : item))} /></Grid><Grid size={{ xs: 9, md: 3 }}><FormControlLabel control={<Switch size="small" checked={Boolean(link.external)} onChange={(_event, external) => updateLegalLinks(legalLinks.map((item, itemIndex) => itemIndex === index ? { ...item, external } : item))} />} label="Open in new tab" /></Grid><Grid size={{ xs: 3, md: 1 }} sx={{ textAlign: 'right' }}><IconButton className="sa-danger-button" color="error" onClick={() => updateLegalLinks(legalLinks.filter((_item, itemIndex) => itemIndex !== index))} aria-label="Remove legal footer link"><DeleteRounded /></IconButton></Grid></Grid>)}</Stack>
  </Stack>;
}

export function StandaloneDesignStudio() {
  const [settings, setSettings] = useState<FormShape>({});
  const [applicationPages, setApplicationPages] = useState<Record<string, any>[]>([]);
  const [settingsId, setSettingsId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const { refresh } = useSite();
  async function load() {
    setLoading(true); setError('');
    try {
      const [settingsResult, modulesResult, contentResult] = await Promise.allSettled([
        getResource('site-settings', { limit: 1 }),
        getAppConfiguration(),
        getResource('content-pages', { limit: 400 }),
      ]);
      if (settingsResult.status === 'rejected') throw settingsResult.reason;
      const row = settingsResult.value.data[0] || {};
      setSettings(row); setSettingsId(row._id || '');
      const modules = modulesResult.status === 'fulfilled' ? modulesResult.value.data.modules || [] : [];
      const contentPages = contentResult.status === 'fulfilled' ? contentResult.value.data || [] : [];
      setApplicationPages([
        ...modules,
        ...contentPages.filter((entry: any) => entry?.active !== false && entry?.path).map((entry: any) => ({ key: `content-${entry._id || entry.path}`, label: entry.title || entry.path, path: entry.path, scope: 'public', kind: 'content' })),
      ]);
    } catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function publish() {
    setSaving(true); setError('');
    try {
      const payload = synchroniseLogoSources({ ...settings }, 'design'); delete payload._id; delete payload.createdAt; delete payload.updatedAt; delete payload.__v;
      settingsId ? await updateResource('site-settings', settingsId, payload) : await createResource('site-settings', payload);
      setSaved('Application design published across SecureAsset.'); await load(); await refresh();
    } catch (caught) { setError((caught as Error).message); }
    finally { setSaving(false); }
  }
  if (loading) return <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  return <Stack spacing={2}>{error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}{saved && <Alert severity="success" onClose={() => setSaved('')}>{saved}</Alert>}<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end"><Button startIcon={<RefreshRounded />} onClick={load}>Reload settings</Button><Button variant="contained" startIcon={<SaveRounded />} disabled={saving} onClick={publish}>{saving ? 'Publishing…' : 'Publish application design'}</Button></Stack><Suspense fallback={<AppLoadingScreen label="Loading the design studio…" />}><AdvancedDesignStudio settings={settings} setSettings={setSettings} applicationPages={applicationPages} onPublish={publish} /></Suspense></Stack>;
}

function CollectionEditor({ definition }: { definition: CollectionDefinition }) {
  if (definition.resource === 'design-studio') return <StandaloneDesignStudio />;
  return <ResourceCollectionEditor definition={definition} />;
}

const propertyTypeVisual = (category: string) => {
  const palette: Record<string, { icon: any; accent: string; tint: string; gradient: string }> = {
    residential: { icon: HomeRounded, accent: '#0B5270', tint: '#E4F3F7', gradient: 'linear-gradient(135deg, #0B5270 0%, #2F9CB3 100%)' },
    commercial: { icon: StorefrontRounded, accent: '#7A4E16', tint: '#FFF1DC', gradient: 'linear-gradient(135deg, #A8631B 0%, #E2A33D 100%)' },
    land: { icon: LandscapeRounded, accent: '#28704F', tint: '#E5F5EC', gradient: 'linear-gradient(135deg, #28704F 0%, #63B57E 100%)' },
    hospitality: { icon: HotelRounded, accent: '#8A3D56', tint: '#FBE9F0', gradient: 'linear-gradient(135deg, #8A3D56 0%, #D8849D 100%)' },
    event: { icon: EventRounded, accent: '#68439A', tint: '#F0E9FB', gradient: 'linear-gradient(135deg, #68439A 0%, #A582D3 100%)' },
    other: { icon: CategoryRounded, accent: '#41566A', tint: '#EAF0F5', gradient: 'linear-gradient(135deg, #41566A 0%, #7B93A8 100%)' },
  };
  return palette[category] || palette.other;
};

function PropertyTypeCard({ row, onEdit, onRemove }: { row: any; onEdit: () => void; onRemove: () => void }) {
  const category = String(row.category || 'other').toLowerCase();
  const visual = propertyTypeVisual(category);
  const Icon = visual.icon;
  const purposes = Array.isArray(row.allowedPurposes) && row.allowedPurposes.length
    ? row.allowedPurposes.map((purpose: string) => sentence(String(purpose))).join(' · ')
    : 'All listing purposes';

  return <Card variant="outlined" sx={{
    height: '100%', overflow: 'hidden', position: 'relative', borderRadius: 4,
    borderColor: 'rgba(11,82,112,.12)', background: 'linear-gradient(145deg, #FFFFFF 0%, #F9FCFD 100%)',
    boxShadow: '0 10px 28px rgba(15, 42, 52, .06)', transition: 'transform .22s ease, box-shadow .22s ease, border-color .22s ease',
    '&:hover': { transform: 'translateY(-4px)', borderColor: `${visual.accent}55`, boxShadow: `0 18px 38px ${visual.accent}22` },
  }}>
    <Box sx={{ height: 7, background: visual.gradient }} />
    <CardContent sx={{ p: { xs: 2, sm: 2.4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
        <Stack direction="row" spacing={1.4} alignItems="center" sx={{ minWidth: 0 }}>
          <Box sx={{ width: 48, height: 48, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 3, color: visual.accent, bgcolor: visual.tint, boxShadow: `inset 0 0 0 1px ${visual.accent}18` }}>
            <Icon sx={{ fontSize: 25 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={950} sx={{ fontSize: 17, lineHeight: 1.15, letterSpacing: '-.02em' }} noWrap>{row.label || row.key || 'Untitled property type'}</Typography>
            <Typography color="text.secondary" sx={{ mt: .45, fontSize: 11.5, textTransform: 'capitalize' }}>{sentence(category)} collection</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={.25} sx={{ flex: '0 0 auto', mt: -.4, mr: -.7 }}>
          <IconButton size="small" title="Edit property type" onClick={onEdit} sx={{ color: '#0B5270', '&:hover': { bgcolor: '#E4F3F7' } }}><EditRounded fontSize="small" /></IconButton>
          <IconButton size="small" title="Delete property type" onClick={onRemove} sx={{ color: '#C2413B', '&:hover': { bgcolor: '#FDECEA' } }}><DeleteRounded fontSize="small" /></IconButton>
        </Stack>
      </Stack>

      <Divider sx={{ my: 1.8, borderColor: 'rgba(15,42,52,.08)' }} />
      <Stack direction="row" flexWrap="wrap" useFlexGap gap={.75}>
        <Chip size="small" label={`Hierarchy · ${sentence(String(row.hierarchyMode || 'simple'))}`} sx={{ bgcolor: visual.tint, color: visual.accent, border: 'none', fontWeight: 800, '& .MuiChip-label': { px: 1.1 } }} />
        <Chip size="small" label={row.active === false ? 'Inactive' : 'Active'} sx={{ bgcolor: row.active === false ? '#F3F4F6' : '#E8F7EF', color: row.active === false ? '#64748B' : '#23734A', border: 'none', fontWeight: 800, '& .MuiChip-label': { px: 1.1 } }} />
      </Stack>

      <Box sx={{ mt: 1.7, p: 1.25, borderRadius: 2.5, bgcolor: 'rgba(11,82,112,.035)', border: '1px solid rgba(11,82,112,.07)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 10.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 850 }}>Listing purposes</Typography>
            <Typography sx={{ mt: .35, fontSize: 12.5, fontWeight: 750 }} noWrap>{purposes}</Typography>
          </Box>
          <ArrowForwardRounded sx={{ color: visual.accent, fontSize: 18, flex: '0 0 auto' }} />
        </Stack>
      </Box>
    </CardContent>
  </Card>;
}

function collectionCardVisual(resource: string, row: any) {
  const key = String(row.key || row.name || row.category || '').toLowerCase();
  const visuals: Record<string, { icon: any; accent: string; tint: string; gradient: string }> = {
    'landlord-plans': key.includes('enterprise')
      ? { icon: WorkspacePremiumRounded, accent: '#6D3EA5', tint: '#F1E9FB', gradient: 'linear-gradient(135deg, #5A2F92 0%, #A77BD2 100%)' }
      : key.includes('business')
        ? { icon: BusinessRounded, accent: '#9A6115', tint: '#FFF2DD', gradient: 'linear-gradient(135deg, #9A6115 0%, #E5AD49 100%)' }
        : key.includes('professional')
          ? { icon: StorefrontRounded, accent: '#0B5270', tint: '#E4F3F7', gradient: 'linear-gradient(135deg, #0B5270 0%, #3C9EB5 100%)' }
          : { icon: HomeRounded, accent: '#28704F', tint: '#E6F5EC', gradient: 'linear-gradient(135deg, #28704F 0%, #6CBF8C 100%)' },
    'area-units': { icon: StraightenRounded, accent: '#28704F', tint: '#E6F5EC', gradient: 'linear-gradient(135deg, #28704F 0%, #6CBF8C 100%)' },
    'seo-pages': { icon: SearchRounded, accent: '#0B5270', tint: '#E4F3F7', gradient: 'linear-gradient(135deg, #0B5270 0%, #3C9EB5 100%)' },
    'home-carousel': { icon: SlideshowRounded, accent: '#8A3D56', tint: '#FBE9F0', gradient: 'linear-gradient(135deg, #8A3D56 0%, #D8849D 100%)' },
    'home-sections': { icon: ViewQuiltRounded, accent: '#68439A', tint: '#F0E9FB', gradient: 'linear-gradient(135deg, #68439A 0%, #A582D3 100%)' },
  };
  return visuals[resource] || { icon: CategoryRounded, accent: '#41566A', tint: '#EAF0F5', gradient: 'linear-gradient(135deg, #41566A 0%, #7B93A8 100%)' };
}

function cardImageUrl(row: any) {
  const content = typeof row.content === 'string' ? (() => {
    try { return JSON.parse(row.content); } catch { return {}; }
  })() : row.content;
  const candidates = [
    row.imageUrl, row.mobileImageUrl, row.ogImageUrl, row.thumbnailUrl, row.coverImageUrl,
    row.image, row.heroImageUrl, content?.imageUrl, content?.image, content?.heroImageUrl,
  ];
  return candidates.find((value) => typeof value === 'string' && (/^https:\/\//i.test(value) || value.startsWith('/'))) || '';
}

function collectionCardSubtitle(resource: string, row: any) {
  if (resource === 'landlord-plans') return `${sentence(String(row.billingCycle || (Number(row.prices?.yearly || 0) > 0 ? 'yearly' : 'monthly')))} billing plan`;
  if (resource === 'seo-pages') return row.path || 'Route metadata and search visibility';
  if (resource === 'home-carousel') return `${sentence(String(row.audience || 'all'))} audience · responsive hero content`;
  if (resource === 'home-sections') return `${sentence(String(row.type || 'custom'))} homepage section`;
  if (resource === 'area-units') return row.symbol ? `Conversion unit · ${row.symbol}` : 'Regional area conversion unit';
  return 'Managed configuration';
}

function displayCardValue(value: any) {
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (Array.isArray(value)) return value.length ? value.join(' · ') : '—';
  if (value && typeof value === 'object') return 'Configured';
  return String(value ?? '—');
}

function PremiumCollectionCard({ definition, row, onEdit, onRemove, clickToEdit = false }: { definition: CollectionDefinition; row: any; onEdit: () => void; onRemove: () => void; clickToEdit?: boolean }) {
  const visual = collectionCardVisual(definition.resource, row);
  const Icon = visual.icon;
  const image = cardImageUrl(row);
  const title = row.title || row.name || row.label || row.path || row.key || 'Untitled record';
  const metadata = definition.columns.slice(1).filter((column) => column !== 'active').slice(0, 5);
  const hasActive = definition.columns.includes('active') || row.active !== undefined;
  const active = row.active !== false;
  const openFromCard = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    onEdit();
  };
  const openFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!clickToEdit || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onEdit();
  };

  return <Card variant="outlined" sx={{
    height: '100%', overflow: 'hidden', position: 'relative', borderRadius: 4,
    borderColor: 'rgba(11,82,112,.12)', background: 'linear-gradient(145deg, #FFFFFF 0%, #F9FCFD 100%)',
    boxShadow: '0 10px 28px rgba(15, 42, 52, .06)', cursor: clickToEdit ? 'pointer' : 'default',
    transition: 'transform .22s ease, box-shadow .22s ease, border-color .22s ease',
    '&:hover': { transform: 'translateY(-4px)', borderColor: `${visual.accent}55`, boxShadow: `0 18px 38px ${visual.accent}22` },
    '&:focus-visible': { outline: `3px solid ${visual.accent}55`, outlineOffset: 2 },
  }} onClick={clickToEdit ? openFromCard : undefined} onKeyDown={clickToEdit ? openFromKeyboard : undefined} role={clickToEdit ? 'button' : undefined} tabIndex={clickToEdit ? 0 : undefined} aria-label={clickToEdit ? `Edit ${title} landlord subscription plan` : undefined}>
    <Box sx={{ height: 7, background: visual.gradient }} />
    {image && <Box sx={{ height: 108, position: 'relative', overflow: 'hidden', bgcolor: visual.tint }}>
      <Box component="img" src={image} alt="" loading="lazy" sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', transition: 'transform .35s ease', '.MuiCard-root:hover &': { transform: 'scale(1.04)' } }} />
      <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 35%, ${visual.accent}B8 100%)` }} />
      <Box sx={{ position: 'absolute', left: 16, bottom: 12, width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 2.5, color: '#fff', bgcolor: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.45)', backdropFilter: 'blur(8px)' }}><Icon sx={{ fontSize: 21 }} /></Box>
    </Box>}
    <CardContent sx={{ p: { xs: 2, sm: 2.4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
        <Stack direction="row" spacing={1.4} alignItems="center" sx={{ minWidth: 0 }}>
          {!image && <Box sx={{ width: 48, height: 48, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 3, color: visual.accent, bgcolor: visual.tint, boxShadow: `inset 0 0 0 1px ${visual.accent}18` }}><Icon sx={{ fontSize: 25 }} /></Box>}
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={950} sx={{ fontSize: 17, lineHeight: 1.15, letterSpacing: '-.02em' }} noWrap>{title}</Typography>
            <Typography color="text.secondary" sx={{ mt: .45, fontSize: 11.5 }} noWrap>{collectionCardSubtitle(definition.resource, row)}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={.25} sx={{ flex: '0 0 auto', mt: -.4, mr: -.7 }}>
          <IconButton size="small" title="Edit record" onClick={(event) => { event.stopPropagation(); onEdit(); }} sx={{ color: '#0B5270', '&:hover': { bgcolor: '#E4F3F7' } }}><EditRounded fontSize="small" /></IconButton>
          <IconButton size="small" title="Delete record" onClick={(event) => { event.stopPropagation(); onRemove(); }} sx={{ color: '#C2413B', '&:hover': { bgcolor: '#FDECEA' } }}><DeleteRounded fontSize="small" /></IconButton>
        </Stack>
      </Stack>
      <Divider sx={{ my: 1.8, borderColor: 'rgba(15,42,52,.08)' }} />
      <Stack direction="row" flexWrap="wrap" useFlexGap gap={.75}>
        {metadata.map((column) => <Chip key={column} size="small" label={`${sentence(column.split('.').at(-1) || column)} · ${displayCardValue(get(row, column))}`} sx={{ bgcolor: visual.tint, color: visual.accent, border: 'none', fontWeight: 800, maxWidth: '100%', '& .MuiChip-label': { px: 1.1, overflow: 'hidden', textOverflow: 'ellipsis' } }} />)}
        {hasActive && <Chip size="small" label={active ? 'Active' : 'Inactive'} sx={{ bgcolor: active ? '#E8F7EF' : '#F3F4F6', color: active ? '#23734A' : '#64748B', border: 'none', fontWeight: 800, '& .MuiChip-label': { px: 1.1 } }} />}
      </Stack>
      <Box sx={{ mt: 1.7, p: 1.25, borderRadius: 2.5, bgcolor: 'rgba(11,82,112,.035)', border: '1px solid rgba(11,82,112,.07)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 850 }}>{clickToEdit ? 'Click anywhere to edit plan' : image ? 'Visual asset connected' : 'Configuration status'}</Typography>
          {clickToEdit ? <ArrowForwardRounded sx={{ color: visual.accent, fontSize: 18 }} /> : <SortRounded sx={{ color: visual.accent, fontSize: 18 }} />}
        </Stack>
      </Box>
  </CardContent>
  </Card>;
}

function planLimitValue(row: any, path: string) {
  const value = get(row, path);
  if (value === undefined || value === null || value === '') return '—';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString('en-IN') : String(value);
}

function LandlordPlanAccordion({ row, onEdit, onRemove }: { row: any; onEdit: () => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const title = row.name || row.key || 'Untitled landlord plan';
  const cycle = Number(row.prices?.yearly || 0) > 0 && Number(row.prices?.monthly || 0) === 0 ? 'yearly' : 'monthly';
  const price = Number(row.prices?.[cycle] || 0);
  const visual = collectionCardVisual('landlord-plans', row);
  const Icon = visual.icon;
  const limitGroups = [
    ['Properties', 'limits.properties'], ['Buildings', 'limits.buildings'], ['Apartments', 'limits.apartments'],
    ['Rooms', 'limits.rooms'], ['Beds', 'limits.beds'], ['Public listings', 'limits.publicListings'],
    ['Active tenants', 'limits.activeTenants'], ['Vault storage (MB)', 'limits.storageMB'],
  ];
  const features = [
    ['API access', Boolean(row.features?.apiAccess)], ['Priority support', Boolean(row.features?.prioritySupport)],
  ];

  return <Accordion expanded={expanded} onChange={(_, next) => setExpanded(next)} disableGutters sx={{
    overflow: 'hidden', border: '1px solid rgba(11,82,112,.14)', borderRadius: '18px !important',
    background: 'linear-gradient(145deg, #FFFFFF 0%, #F8FCFD 100%)', boxShadow: expanded ? '0 18px 42px rgba(11,82,112,.13)' : '0 8px 24px rgba(15,42,52,.06)',
    transition: 'box-shadow .22s ease, border-color .22s ease', '&:before': { display: 'none' }, '&:hover': { borderColor: `${visual.accent}66` },
  }}>
    <AccordionSummary expandIcon={<ExpandMoreRounded sx={{ color: visual.accent }} />} sx={{ px: { xs: 1.8, sm: 2.4 }, py: 1, minHeight: 84, '&.Mui-expanded': { minHeight: 84 }, '& .MuiAccordionSummary-content': { my: 1.2, minWidth: 0 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ minWidth: 0 }}>
          <Box sx={{ width: 48, height: 48, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 3, color: visual.accent, bgcolor: visual.tint, boxShadow: `inset 0 0 0 1px ${visual.accent}20` }}><Icon sx={{ fontSize: 25 }} /></Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={950} noWrap sx={{ fontSize: { xs: 15, sm: 17 }, letterSpacing: '-.02em' }}>{title}</Typography>
            <Stack direction="row" spacing={.7} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: .55 }}>
              <Chip size="small" label={`₹${price.toLocaleString('en-IN')} / ${cycle === 'yearly' ? 'year' : 'month'}`} sx={{ bgcolor: visual.tint, color: visual.accent, fontWeight: 850, border: 'none' }} />
              <Chip size="small" label={row.active === false ? 'Inactive' : 'Active'} sx={{ bgcolor: row.active === false ? '#F3F4F6' : '#E8F7EF', color: row.active === false ? '#64748B' : '#23734A', fontWeight: 800, border: 'none' }} />
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={.4} sx={{ flex: '0 0 auto' }} onClick={(event) => event.stopPropagation()}>
          <IconButton size="small" title="Edit landlord subscription plan" aria-label={`Edit ${title} landlord subscription plan`} onClick={onEdit} sx={{ color: '#0B5270', '&:hover': { bgcolor: '#E4F3F7' } }}><EditRounded fontSize="small" /></IconButton>
          <IconButton size="small" title="Delete landlord subscription plan" aria-label={`Delete ${title} landlord subscription plan`} onClick={onRemove} sx={{ color: '#C2413B', '&:hover': { bgcolor: '#FDECEA' } }}><DeleteRounded fontSize="small" /></IconButton>
        </Stack>
      </Stack>
    </AccordionSummary>
    <AccordionDetails sx={{ px: { xs: 1.8, sm: 2.4 }, pb: 2.4, pt: 0 }}>
      <Divider sx={{ mb: 2, borderColor: 'rgba(15,42,52,.08)' }} />
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, height: '100%', borderRadius: 3, borderColor: `${visual.accent}22`, bgcolor: `${visual.tint}55` }}>
            <Typography fontWeight={900}>Capacity limits</Typography>
            <Typography color="text.secondary" fontSize={12} sx={{ mt: .35, mb: 1.5 }}>The maximum resources available to landlords on this plan.</Typography>
            <Grid container spacing={1}>
              {limitGroups.map(([label, path]) => <Grid size={{ xs: 6, sm: 3 }} key={path}><Box sx={{ p: 1.1, height: '100%', borderRadius: 2.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}><Typography color="text.secondary" fontSize={10.5} fontWeight={800}>{label}</Typography><Typography fontWeight={950} sx={{ mt: .25, color: visual.accent }}>{planLimitValue(row, path)}</Typography></Box></Grid>)}
            </Grid>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, height: '100%', borderRadius: 3, borderColor: 'divider' }}>
            <Typography fontWeight={900}>Plan features</Typography>
            <Stack spacing={1.1} sx={{ mt: 1.5 }}>
              {features.map(([label, enabled]) => <Stack direction="row" justifyContent="space-between" alignItems="center" key={String(label)}><Typography fontSize={12.5}>{label}</Typography><Chip size="small" label={enabled ? 'Included' : 'Not included'} color={enabled ? 'success' : 'default'} variant={enabled ? 'filled' : 'outlined'} /></Stack>)}
              <Divider />
              <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontSize={12.5}>Billing cycle</Typography><Typography fontWeight={850}>{sentence(cycle)}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontSize={12.5}>Plan key</Typography><Typography fontSize={11.5} fontWeight={750} color="text.secondary" sx={{ wordBreak: 'break-all', textAlign: 'right', ml: 2 }}>{row.key || 'Generated on save'}</Typography></Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
        <Button variant="outlined" startIcon={<DeleteRounded />} color="error" onClick={onRemove}>Delete plan</Button>
        <Button variant="contained" startIcon={<EditRounded />} onClick={onEdit}>Edit and update plan</Button>
      </Stack>
    </AccordionDetails>
  </Accordion>;
}

function ResourceCollectionEditor({ definition }: { definition: CollectionDefinition }) {
  const actions = useActionDialog();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<{ row?: any } | null>(null);
  const [form, setForm] = useState<FormShape>({});

  async function load() {
    setLoading(true); setError('');
    try { setRows((await getResource(definition.resource, { limit: 100 })).data); }
    catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [definition.resource]);

  function open(row?: any) {
    const next: FormShape = {};
    definition.fields.forEach((field) => {
      const value = get(row || {}, field.key);
      next[field.key] = field.type === 'array' && Array.isArray(value) ? value.join(', ')
        : field.type === 'json' && value ? JSON.stringify(value, null, 2)
          : value ?? (field.type === 'boolean' ? false : '');
    });
    if (definition.resource === 'landlord-plans') {
      const monthly = Number(get(row || {}, 'prices.monthly') || 0);
      const yearly = Number(get(row || {}, 'prices.yearly') || 0);
      next.billingCycle = yearly > 0 && monthly === 0 ? 'yearly' : 'monthly';
      next.price = row ? String(next.billingCycle === 'yearly' ? yearly : monthly) : '';
    }
    setForm(next); setDialog({ row });
  }

  async function save() {
    try {
      const payload: FormShape = {};
      definition.fields.forEach((field) => {
        if (definition.resource === 'landlord-plans' && (field.key === 'billingCycle' || field.key === 'price')) return;
        let value = form[field.key];
        if (field.type === 'number') value = value === '' ? undefined : Number(value);
        if (field.type === 'boolean') value = Boolean(value);
        if (field.type === 'array') value = String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
        if (field.type === 'json' && typeof value === 'string' && value.trim()) value = JSON.parse(value);
        if ((field.type === 'image' && value === '' && dialog?.row) || (value !== '' && value !== undefined)) set(payload, field.key, value);
      });
      if (definition.resource === 'landlord-plans') {
        const billingCycle = form.billingCycle === 'yearly' ? 'yearly' : 'monthly';
        const price = Number(form.price);
        if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a valid non-negative number');
        set(payload, `prices.${billingCycle}`, price);
        set(payload, `prices.${billingCycle === 'yearly' ? 'monthly' : 'yearly'}`, 0);
        if (!dialog?.row) {
          const generatedKey = String(form.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          if (!generatedKey) throw new Error('Plan name must contain letters or numbers');
          payload.key = generatedKey;
        }
      }
      dialog?.row ? await updateResource(definition.resource, dialog.row._id, payload) : await createResource(definition.resource, payload);
      setDialog(null); await load();
    } catch (caught) { setError((caught as Error).message); }
  }

  async function remove(row: any) {
    if (!await actions.askConfirmation(`Delete ${row.title || row.name || row.label || row.key}?`, { title: 'Delete record', danger: true })) return;
    try { await deleteResource(definition.resource, row._id); await load(); }
    catch (caught) { setError((caught as Error).message); }
  }

  const hasRegionalSelector = definition.fields.some((field) => field.key === 'region.country');

  return <Stack spacing={2}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
      <Box><Typography variant="h6" fontWeight={900}>{definition.title}</Typography><Typography color="text.secondary" fontSize={13}>{definition.description}</Typography></Box>
      <Stack direction="row" spacing={1}><Button startIcon={<RefreshRounded />} onClick={load}>Refresh</Button><Button variant="contained" startIcon={<AddRounded />} onClick={() => open()}>Add</Button></Stack>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {loading ? <CircularProgress /> : definition.resource === 'landlord-plans' ? <Stack spacing={1.4}>{rows.map((row) => <LandlordPlanAccordion key={row._id} row={row} onEdit={() => open(row)} onRemove={() => remove(row)} />)}</Stack> : <Grid container spacing={1.8}>{rows.map((row) => <Grid size={{ xs: 12, md: 6, xl: 4 }} key={row._id}>{definition.resource === 'property-type-configs'
      ? <PropertyTypeCard row={row} onEdit={() => open(row)} onRemove={() => remove(row)} />
      : <PremiumCollectionCard definition={definition} row={row} clickToEdit={definition.resource === 'landlord-plans'} onEdit={() => open(row)} onRemove={() => remove(row)} />}</Grid>)}</Grid>}
    {!loading && !rows.length && <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed' }}><Typography fontWeight={800}>No records yet</Typography></Paper>}
    {actions.dialogs}
    <ProfessionalDialog open={Boolean(dialog)} onClose={() => setDialog(null)} fullWidth maxWidth="md">
      <DialogTitle fontWeight={900}>{dialog?.row ? 'Edit' : 'Add'} {definition.title}</DialogTitle>
      <DialogContent dividers><Grid container spacing={2}>
        {hasRegionalSelector && <Grid size={{ xs: 12 }}><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}><LocationFields value={{ country: form['region.country'], state: form['region.state'], city: form['region.city'] }} onChange={(next) => setForm((old) => ({ ...old, 'region.country': next.country || '', 'region.state': next.state || '', 'region.city': next.city || '' }))} /></Box></Grid>}
        {definition.fields.map((field) => {
          if (hasRegionalSelector && ['region.country', 'region.state', 'region.city'].includes(field.key)) return null;
          return <Grid size={{ xs: 12, sm: field.type === 'textarea' || field.type === 'json' ? 12 : 6 }} key={field.key}>
            {field.type === 'image' ? <AssetUpload label={field.label} value={form[field.key] || ''} allowManualInput={false} helper={field.helper} onChange={(value) => setForm((old) => ({ ...old, [field.key]: value }))} /> : field.type === 'boolean' ? <FormControlLabel control={<Switch checked={Boolean(form[field.key])} onChange={(_, checked) => setForm((old) => ({ ...old, [field.key]: checked }))} />} label={field.label} />
              : <TextField fullWidth size="small" select={field.type === 'select'} multiline={field.type === 'textarea' || field.type === 'json'} rows={field.type === 'json' ? 7 : field.type === 'textarea' ? 3 : undefined} type={field.type === 'number' ? 'number' : 'text'} required={field.required} label={field.label} value={form[field.key] ?? ''} onChange={(event) => setForm((old) => ({ ...old, [field.key]: event.target.value }))}>{field.options?.map((option) => <MenuItem key={option} value={option}>{sentence(option)}</MenuItem>)}</TextField>}
          </Grid>;
        })}
      </Grid></DialogContent>
      <DialogActions><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="contained" startIcon={<SaveRounded />} onClick={save}>Save</Button></DialogActions>
    </ProfessionalDialog>
  </Stack>;
}

function DesignColourControl({ label, value, onChange, helper }: { label: string; value: string; onChange: (value: string) => void; helper?: string }) {
  return <Stack spacing={.75}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Box component="input" aria-label={`${label} picker`} type="color" value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value.toUpperCase())} sx={{ width: 42, height: 38, p: .25, cursor: 'pointer', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }} />
      <TextField fullWidth size="small" label={label} value={value} inputProps={{ maxLength: 7, style: { textTransform: 'uppercase' } }} onChange={(event) => onChange(event.target.value.toUpperCase())} />
    </Stack>
    {helper && <Typography color="text.secondary" sx={{ fontSize: 11.3 }}>{helper}</Typography>}
  </Stack>;
}

function DesignNumberControl({ label, value, onChange, min, max, step = 1, helper }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number; helper?: string }) {
  return <TextField fullWidth size="small" type="number" label={label} value={value} onChange={(event) => onChange(Number(event.target.value))} inputProps={{ min, max, step }} helperText={helper || `${min}–${max}`} />;
}

function DesignStudioAdministration({ settings, setSettings }: { settings: FormShape; setSettings: Dispatch<SetStateAction<FormShape>> }) {
  const design = normaliseDesignSystem(settings.design);
  const update = (path: string, value: unknown) => setSettings((current) => {
    const next = JSON.parse(JSON.stringify(normaliseDesignSystem(current.design)));
    set(next, path, value);
    return { ...current, design: normaliseDesignSystem(next) };
  });
  const selectOptions = (options: string[]) => options.map((option) => <MenuItem key={option} value={option}>{sentence(option)}</MenuItem>);
  const applyPreset = (preset: string) => setSettings((current) => ({ ...current, design: designPreset(preset) }));
  const updateIconColour = (value: string) => setSettings((current) => {
    const next = JSON.parse(JSON.stringify(normaliseDesignSystem(current.design)));
    next.colors.icon = value;
    next.icons.color = value;
    return { ...current, design: normaliseDesignSystem(next) };
  });

  return <Stack spacing={3}>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'flex-start' }}>
      <Box><Stack direction="row" spacing={1} alignItems="center"><PaletteRounded color="primary"/><Typography variant="h6" fontWeight={900}>Application Design Studio</Typography></Stack><Typography color="text.secondary" fontSize={13} sx={{ mt: .65, maxWidth: 760 }}>Control the published visual system for cards, modals, navigation, buttons, inputs and icons. Every value is bounded and saved as safe design tokens, never raw CSS.</Typography></Box>
      <Button variant="outlined" startIcon={<RestartAltRounded />} onClick={() => applyPreset('secureasset')}>Restore SecureAsset default</Button>
    </Stack>
    <Alert severity="info">This editor stages a complete, live-ready design system. Select a preset or tune individual values, then use <b>Publish site settings</b> to apply it across the public site and authenticated workspace.</Alert>

    <Card variant="outlined"><CardContent sx={{ p: { xs: 2, md: 2.5 } }}><Stack spacing={2}><Box><Typography fontWeight={900}>Design presets</Typography><Typography color="text.secondary" fontSize={12.5}>Start with a professionally balanced preset, then make it yours.</Typography></Box><Grid container spacing={1.25}>{DESIGN_PRESETS.map((preset) => <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={preset.key}><Button fullWidth variant={design.preset === preset.key ? 'contained' : 'outlined'} onClick={() => applyPreset(preset.key)} sx={{ minHeight: 84, justifyContent: 'flex-start', textAlign: 'left', alignItems: 'flex-start', p: 1.5 }}><Stack spacing={.4}><Typography component="span" fontWeight={850}>{preset.label}</Typography><Typography component="span" sx={{ fontSize: 11, fontWeight: 500, opacity: .82, whiteSpace: 'normal' }}>{preset.description}</Typography></Stack></Button></Grid>)}</Grid></Stack></CardContent></Card>

    <Card variant="outlined"><CardContent sx={{ p: { xs: 2, md: 2.5 } }}><Stack spacing={2.25}><Box><Typography fontWeight={900}>Brand colours</Typography><Typography color="text.secondary" fontSize={12.5}>These tokens flow through every MUI surface and component state.</Typography></Box><Grid container spacing={2}>{[
      ['appBackground', 'Application background'], ['paper', 'Surface / paper'], ['textPrimary', 'Primary text'], ['textSecondary', 'Secondary text'], ['border', 'Border'], ['navigation', 'Header & modal header'], ['navigationText', 'Header text'], ['primary', 'Primary action'], ['secondary', 'Secondary action'], ['success', 'Accept / success'], ['submit', 'Submit / olive green'], ['edit', 'Edit / orange'], ['danger', 'Cancel / reject / danger'], ['icon', 'Icon accent'],
    ].map(([key, label]) => <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={key}><DesignColourControl label={label} value={design.colors[key]} onChange={(value) => key === 'icon' ? updateIconColour(value) : update(`colors.${key}`, value)} helper={key === 'navigation' ? 'Default: #0B5270. Also used on modal headers.' : key === 'submit' ? 'Keeps form submissions olive green.' : undefined} /></Grid>)}</Grid></Stack></CardContent></Card>

    <Grid container spacing={2.25}>
      <Grid size={{ xs: 12, xl: 6 }}><Card variant="outlined" sx={{ height: '100%' }}><CardContent sx={{ p: { xs: 2, md: 2.5 } }}><Stack spacing={2.25}><Box><Typography fontWeight={900}>Typography & density</Typography><Typography color="text.secondary" fontSize={12.5}>Scale reading comfort without changing page content.</Typography></Box><Grid container spacing={2}><Grid size={{ xs: 12 }}><TextField fullWidth size="small" label="Application font" value={OPEN_SANS_FONT_NAME} helperText="Open Sans is enforced across all application surfaces." InputProps={{ readOnly: true }} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Base font size" value={design.typography.baseSize} onChange={(value) => update('typography.baseSize', value)} min={12} max={20} helper="12–20 px" /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" label="Heading weight" value="400" helperText="Regular Open Sans for consistent page titles." InputProps={{ readOnly: true }} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Line height" value={design.typography.lineHeight} onChange={(value) => update('typography.lineHeight', value)} min={1.2} max={2} step={.05} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" select label="Information density" value={design.layout.density} onChange={(event) => update('layout.density', event.target.value)}>{selectOptions(['compact', 'comfortable', 'spacious'])}</TextField></Grid></Grid></Stack></CardContent></Card></Grid>
      <Grid size={{ xs: 12, xl: 6 }}><Card variant="outlined" sx={{ height: '100%' }}><CardContent sx={{ p: { xs: 2, md: 2.5 } }}><Stack spacing={2.25}><Box><Typography fontWeight={900}>Layout & resize</Typography><Typography color="text.secondary" fontSize={12.5}>Resize the global frame, workspace navigation and content rhythm.</Typography></Box><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Header height" value={design.layout.appBarHeight} onChange={(value) => update('layout.appBarHeight', value)} min={56} max={96} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Sidebar width" value={design.layout.sidebarWidth} onChange={(value) => update('layout.sidebarWidth', value)} min={220} max={420} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Collapsed sidebar" value={design.layout.collapsedSidebarWidth} onChange={(value) => update('layout.collapsedSidebarWidth', value)} min={64} max={120} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Content max width" value={design.layout.contentMaxWidth} onChange={(value) => update('layout.contentMaxWidth', value)} min={960} max={1920} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Desktop page padding" value={design.layout.pagePadding} onChange={(value) => update('layout.pagePadding', value)} min={12} max={56} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Mobile page padding" value={design.layout.mobilePagePadding} onChange={(value) => update('layout.mobilePagePadding', value)} min={10} max={32} /></Grid></Grid></Stack></CardContent></Card></Grid>
    </Grid>

    <Grid container spacing={2.25}>
      <Grid size={{ xs: 12, xl: 7 }}><Card variant="outlined" sx={{ height: '100%' }}><CardContent sx={{ p: { xs: 2, md: 2.5 } }}><Stack spacing={2.25}><Box><Typography fontWeight={900}>Borders, radii & component shape</Typography><Typography color="text.secondary" fontSize={12.5}>Tune the exact surfaces that make an application feel premium: cards, fields, navigation and modal dialogs.</Typography></Box><Grid container spacing={2}><Grid size={{ xs: 12, sm: 4 }}><DesignNumberControl label="Global border width" value={design.borders.width} onChange={(value) => update('borders.width', value)} min={0} max={4} /></Grid><Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth size="small" select label="Border style" value={design.borders.style} onChange={(event) => update('borders.style', event.target.value)}>{selectOptions(['solid', 'dashed', 'dotted'])}</TextField></Grid><Grid size={{ xs: 12, sm: 4 }}><DesignNumberControl label="Modal border width" value={design.borders.modalBorderWidth} onChange={(value) => update('borders.modalBorderWidth', value)} min={0} max={4} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Cards & tables radius" value={design.borders.cardRadius} onChange={(value) => update('borders.cardRadius', value)} min={0} max={40} helper="0 keeps cards square" /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Buttons radius" value={design.borders.buttonRadius} onChange={(value) => update('borders.buttonRadius', value)} min={0} max={40} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Inputs radius" value={design.borders.inputRadius} onChange={(value) => update('borders.inputRadius', value)} min={0} max={32} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Navigation & menus radius" value={design.borders.navigationRadius} onChange={(value) => update('borders.navigationRadius', value)} min={0} max={32} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Modal radius" value={design.borders.modalRadius} onChange={(value) => update('borders.modalRadius', value)} min={0} max={32} helper="Default 0 keeps popup modals plain" /></Grid></Grid></Stack></CardContent></Card></Grid>
      <Grid size={{ xs: 12, xl: 5 }}><Card variant="outlined" sx={{ height: '100%' }}><CardContent sx={{ p: { xs: 2, md: 2.5 } }}><Stack spacing={2.25}><Box><Typography fontWeight={900}>Depth, icons & motion</Typography><Typography color="text.secondary" fontSize={12.5}>Keep visual hierarchy clear while avoiding a generic software look.</Typography></Box><Grid container spacing={2}><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" select label="Card shadow" value={design.shadows.card} onChange={(event) => update('shadows.card', event.target.value)}>{selectOptions(['none', 'subtle', 'soft', 'raised', 'floating'])}</TextField></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" select label="Modal shadow" value={design.shadows.modal} onChange={(event) => update('shadows.modal', event.target.value)}>{selectOptions(['none', 'soft', 'raised', 'floating'])}</TextField></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" select label="Navigation shadow" value={design.shadows.navigation} onChange={(event) => update('shadows.navigation', event.target.value)}>{selectOptions(['none', 'subtle', 'soft'])}</TextField></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth size="small" select label="Button shadow" value={design.shadows.button} onChange={(event) => update('shadows.button', event.target.value)}>{selectOptions(['none', 'subtle', 'soft'])}</TextField></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Global icon size" value={design.icons.size} onChange={(value) => update('icons.size', value)} min={14} max={32} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Navigation icon size" value={design.icons.navSize} onChange={(value) => update('icons.navSize', value)} min={14} max={28} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Card padding" value={design.effects.cardPadding} onChange={(value) => update('effects.cardPadding', value)} min={12} max={48} /></Grid><Grid size={{ xs: 12, sm: 6 }}><DesignNumberControl label="Button height" value={design.effects.buttonHeight} onChange={(value) => update('effects.buttonHeight', value)} min={32} max={64} /></Grid></Grid><Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><FormControlLabel control={<Switch checked={design.effects.enableHoverLift} onChange={(_, checked) => update('effects.enableHoverLift', checked)} />} label="Lift interactive controls on hover" /><FormControlLabel control={<Switch checked={design.effects.enableGlassNavigation} onChange={(_, checked) => update('effects.enableGlassNavigation', checked)} />} label="Use glass effect in navigation" /><FormControlLabel control={<Switch checked={design.icons.rounded} onChange={(_, checked) => update('icons.rounded', checked)} />} label="Round icon buttons" /></Stack></Stack></CardContent></Card></Grid>
    </Grid>

    <Card variant="outlined" sx={{ overflow: 'hidden' }}><Box sx={{ bgcolor: design.colors.navigation, color: design.colors.navigationText, px: { xs: 2, md: 2.5 }, py: 1.4 }}><Stack direction="row" spacing={1} alignItems="center"><TuneRounded/><Typography fontWeight={900}>Staged design preview</Typography><Chip size="small" label="Preview only until published" sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,.16)', color: 'inherit' }} /></Stack></Box><CardContent sx={{ p: { xs: 2, md: 2.5 }, bgcolor: design.colors.appBackground }}><Grid container spacing={2}><Grid size={{ xs: 12, md: 5 }}><Paper elevation={0} sx={{ p: `${design.effects.cardPadding}px`, bgcolor: design.colors.paper, color: design.colors.textPrimary, border: `${design.borders.width}px ${design.borders.style} ${design.colors.border}`, borderRadius: `${design.borders.cardRadius}px`, boxShadow: design.shadows.card === 'none' ? 'none' : design.shadows.card === 'floating' ? '0 24px 60px rgba(15,35,40,.18)' : design.shadows.card === 'raised' ? '0 16px 36px rgba(15,35,40,.14)' : '0 8px 24px rgba(15,35,40,.08)' }}><Typography fontWeight={design.typography.headingWeight}>Property performance</Typography><Typography sx={{ mt: .5, color: design.colors.textSecondary, fontSize: design.typography.baseSize }}>A card surface, table and form field will inherit these tokens.</Typography><Box sx={{ mt: 2, p: 1.25, border: `${design.borders.width}px ${design.borders.style} ${design.colors.border}`, borderRadius: `${design.borders.inputRadius}px`, color: design.colors.textSecondary, fontSize: 13 }}>Search properties or tenants…</Box><Stack direction="row" spacing={1} sx={{ mt: 2 }}><Button variant="contained" sx={{ bgcolor: design.colors.submit, borderRadius: `${design.borders.buttonRadius}px`, minHeight: `${design.effects.buttonHeight}px`, '&:hover': { bgcolor: design.colors.submit } }}>Submit</Button><Button className="sa-edit-button" sx={{ bgcolor: design.colors.edit, borderRadius: `${design.borders.buttonRadius}px`, minHeight: `${design.effects.buttonHeight}px`, '&:hover': { bgcolor: design.colors.edit } }}>Edit</Button></Stack></Paper></Grid><Grid size={{ xs: 12, md: 7 }}><Paper elevation={0} sx={{ overflow: 'hidden', bgcolor: design.colors.paper, color: design.colors.textPrimary, border: `${design.borders.modalBorderWidth}px ${design.borders.style} ${design.colors.border}`, borderRadius: `${design.borders.modalRadius}px`, boxShadow: design.shadows.modal === 'none' ? 'none' : '0 20px 48px rgba(15,35,40,.18)' }}><Box sx={{ px: 2, py: 1.3, bgcolor: design.colors.navigation, color: design.colors.navigationText, fontWeight: design.typography.headingWeight }}>Example modal header</Box><Stack spacing={1.2} sx={{ p: 2 }}><Typography fontWeight={800}>Review payment</Typography><Typography sx={{ color: design.colors.textSecondary, fontSize: 13 }}>This demonstrates the published dialog header, border, radius and action colours.</Typography><Stack direction="row" justifyContent="flex-end" spacing={1}><Button sx={{ color: design.colors.danger, borderRadius: `${design.borders.buttonRadius}px` }}>Cancel</Button><Button variant="contained" sx={{ bgcolor: design.colors.success, borderRadius: `${design.borders.buttonRadius}px`, '&:hover': { bgcolor: design.colors.success } }}>Accept payment</Button></Stack></Stack></Paper></Grid></Grid></CardContent></Card>
  </Stack>;
}


function Fast2SmsAdministration(){
  const empty:Fast2SmsSettings={enabled:false,endpoint:'https://www.fast2sms.com/dev/bulkV2',route:'dlt',senderId:'SECAST',messageId:'204251',variablesTemplate:'{otp}',scheduleTime:'',whatsappEnabled:false,whatsappEndpoint:'https://www.fast2sms.com/dev/whatsapp',whatsappPhoneNumberId:'1202480702956271',whatsappTemplates:[],authorizationConfigured:false,status:'unconfigured',lastError:''};
  const [form,setForm]=useState<Fast2SmsSettings>(empty);const [authorization,setAuthorization]=useState('');const [testMobile,setTestMobile]=useState('');const [testTemplate,setTestTemplate]=useState('rent_reminder');const [testVariables,setTestVariables]=useState('');const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  async function load(){setLoading(true);setError('');try{const result=(await getFast2SmsSettings()).data;setForm({...empty,...result,whatsappTemplates:result.whatsappTemplates||[]});setTestTemplate((current)=>result.whatsappTemplates?.some((item)=>item.key===current)?current:(result.whatsappTemplates?.[0]?.key||'rent_reminder'));}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  async function save(){setSaving(true);setError('');setMessage('');try{const result=await updateFast2SmsSettings({enabled:form.enabled,endpoint:form.endpoint,route:form.route,senderId:form.senderId,messageId:form.messageId,variablesTemplate:form.variablesTemplate,scheduleTime:form.scheduleTime,whatsappEnabled:form.whatsappEnabled,whatsappEndpoint:form.whatsappEndpoint,whatsappPhoneNumberId:form.whatsappPhoneNumberId,authorization:authorization||undefined});setForm({...empty,...result.data,whatsappTemplates:result.data.whatsappTemplates||[]});setAuthorization('');setMessage('Fast2SMS configuration saved.');}catch(e){setError((e as Error).message);}finally{setSaving(false);}}
  async function test(){setSaving(true);setError('');setMessage('');try{const result=await testFast2SmsSettings(testMobile);setMessage(result.message||'Test OTP sent.');await load();}catch(e){setError((e as Error).message);}finally{setSaving(false);}}
  async function testWhatsApp(){setSaving(true);setError('');setMessage('');try{const variables=testVariables.split('|').map((value)=>value.trim()).filter(Boolean);const result=await testFast2SmsSettings(testMobile,'123456',testTemplate,variables);setMessage(result.message||'WhatsApp template sent.');await load();}catch(e){setError((e as Error).message);}finally{setSaving(false);}}
  const selectedTemplate=form.whatsappTemplates?.find((item)=>item.key===testTemplate);
  if(loading)return <Box sx={{py:8,display:'grid',placeItems:'center'}}><CircularProgress/></Box>;
  return <Stack spacing={3}><Box><Typography variant="h6" fontWeight={900}>Fast2SMS notifications</Typography><Typography color="text.secondary" fontSize={13}>OTP delivery and the seven approved WhatsApp Business templates are controlled here. The authorization key is encrypted before storage and is never returned to the browser.</Typography></Box>{error&&<Alert severity="error">{error}</Alert>}{message&&<Alert severity="success">{message}</Alert>}<Stack direction="row" spacing={1} flexWrap="wrap"><Chip label={`Status: ${form.status||'unconfigured'}`} color={form.status==='healthy'?'success':form.status==='error'?'error':'default'}/><Chip label={form.authorizationConfigured?'Authorization configured':'Authorization missing'} color={form.authorizationConfigured?'success':'warning'}/>{form.lastCheckedAt&&<Chip label={`Last checked: ${new Date(form.lastCheckedAt).toLocaleString()}`} variant="outlined"/>}</Stack>{form.lastError&&<Alert severity="warning">Last provider error: {form.lastError}</Alert>}<Card variant="outlined"><CardContent><Stack spacing={2}><Typography fontWeight={900}>Mobile OTP</Typography><FormControlLabel control={<Switch checked={form.enabled} onChange={(_,checked)=>setForm((old)=>({...old,enabled:checked}))}/>} label="Enable Fast2SMS OTP delivery"/><Grid container spacing={2}><Grid size={{xs:12}}><TextField fullWidth label="SMS API endpoint" value={form.endpoint} onChange={(e)=>setForm((old)=>({...old,endpoint:e.target.value}))}/></Grid><Grid size={{xs:12,md:4}}><TextField fullWidth label="Route" value={form.route} onChange={(e)=>setForm((old)=>({...old,route:e.target.value}))}/></Grid><Grid size={{xs:12,md:4}}><TextField fullWidth label="Sender ID" value={form.senderId} onChange={(e)=>setForm((old)=>({...old,senderId:e.target.value.toUpperCase()}))}/></Grid><Grid size={{xs:12,md:4}}><TextField fullWidth label="DLT message/template ID" value={form.messageId} onChange={(e)=>setForm((old)=>({...old,messageId:e.target.value}))}/></Grid><Grid size={{xs:12,md:6}}><TextField fullWidth type="password" label={form.authorizationConfigured?'New authorization key (leave blank to keep current)':'Fast2SMS authorization key'} value={authorization} onChange={(e)=>setAuthorization(e.target.value)} helperText="Enter the complete key from Fast2SMS, not a masked value."/></Grid><Grid size={{xs:12,md:6}}><TextField fullWidth label="Schedule time (optional)" value={form.scheduleTime} onChange={(e)=>setForm((old)=>({...old,scheduleTime:e.target.value}))}/></Grid><Grid size={{xs:12}}><TextField fullWidth label="SMS variables_values template" value={form.variablesTemplate} onChange={(e)=>setForm((old)=>({...old,variablesTemplate:e.target.value}))} helperText="Use {otp} for the six-digit OTP and {name} for the account name. Separate multiple DLT variables with |."/></Grid></Grid><Stack direction="row" spacing={1}><Button variant="contained" startIcon={<SaveRounded/>} disabled={saving} onClick={save}>{saving?'Saving…':'Save configuration'}</Button><Button startIcon={<RefreshRounded/>} onClick={load}>Refresh</Button></Stack><Divider/><Typography fontWeight={850}>Send test OTP</Typography><Stack direction={{xs:'column',sm:'row'}} spacing={1}><TextField label="Test mobile number" value={testMobile} onChange={(e)=>setTestMobile(e.target.value.replace(/\D/g,'').slice(0,12))}/><Button variant="outlined" disabled={saving||!form.enabled} onClick={test}>Send test OTP</Button></Stack></Stack></CardContent></Card><Card variant="outlined"><CardContent><Stack spacing={2}><Box><Typography fontWeight={900}>Approved WhatsApp Business templates</Typography><Typography color="text.secondary" fontSize={13}>These IDs and variable order are locked to the approved Fast2SMS workbook. Business events select them automatically; administrators do not enter message IDs manually.</Typography></Box><Grid container spacing={1.25}>{(form.whatsappTemplates||[]).map((template)=><Grid size={{xs:12,md:6}} key={template.key}><Paper variant="outlined" sx={{p:1.5,height:'100%'}}><Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={850} sx={{wordBreak:'break-word'}}>{template.key}</Typography><Chip size="small" label={`ID ${template.messageId}`} sx={{ml:'auto'}}/></Stack><Typography fontSize={12} color="text.secondary" sx={{mt:.5}}>{template.description}</Typography><Typography fontSize={12} sx={{mt:.75}}>Variables: {template.variables.join(' · ')}</Typography></Paper></Grid>)}</Grid><Divider/><FormControlLabel control={<Switch checked={form.whatsappEnabled} onChange={(_,checked)=>setForm((old)=>({...old,whatsappEnabled:checked}))}/>} label="Enable Fast2SMS WhatsApp transactional delivery"/><Grid container spacing={2}><Grid size={{xs:12,md:7}}><TextField fullWidth label="WhatsApp API endpoint" value={form.whatsappEndpoint} onChange={(e)=>setForm((old)=>({...old,whatsappEndpoint:e.target.value}))}/></Grid><Grid size={{xs:12,md:5}}><TextField fullWidth label="WhatsApp phone number ID" value={form.whatsappPhoneNumberId} onChange={(e)=>setForm((old)=>({...old,whatsappPhoneNumberId:e.target.value}))}/></Grid></Grid><Typography fontWeight={850}>Send test WhatsApp template</Typography><Grid container spacing={2}><Grid size={{xs:12,md:4}}><TextField fullWidth select label="Approved template" value={testTemplate} onChange={(e)=>setTestTemplate(e.target.value)}>{(form.whatsappTemplates||[]).map((template)=><MenuItem key={template.key} value={template.key}>{template.key}</MenuItem>)}</TextField></Grid><Grid size={{xs:12,md:8}}><TextField fullWidth label="variables_values (pipe separated)" value={testVariables} onChange={(e)=>setTestVariables(e.target.value)} helperText={selectedTemplate?`Enter ${selectedTemplate.variableCount} value(s) in order: ${selectedTemplate.variables.join(' | ')}`:'Select a template'}/></Grid></Grid><Stack direction={{xs:'column',sm:'row'}} spacing={1}><Button variant="outlined" disabled={saving||!form.whatsappEnabled||!testMobile||!selectedTemplate} onClick={testWhatsApp}>Send test WhatsApp</Button><Typography color="text.secondary" fontSize={12} sx={{alignSelf:'center'}}>Use a real recipient mobile only after Fast2SMS approval and opt-in.</Typography></Stack></Stack></CardContent></Card></Stack>;
}

function RazorpayAdministration(){
  const [form,setForm]=useState({keyId:'',secret:'',upiId:'',upiName:'SecureAsset',upiQrUrl:'',configured:false}); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState('');
  async function load(){setLoading(true);try{setForm({...form,...(await getRazorpaySettings()).data,secret:''});}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  async function save(){setSaving(true);setError('');try{const {keyId,secret,upiId,upiName,upiQrUrl}=form;const result=await updateRazorpaySettings({keyId,secret,upiId,upiName,upiQrUrl});setForm({...form,...result.data,secret:''});setMessage('Razorpay and UPI settings saved securely.');}catch(e){setError((e as Error).message);}finally{setSaving(false);}}
  if(loading)return <Box sx={{py:8,display:'grid',placeItems:'center'}}><CircularProgress/></Box>;
  return <Stack spacing={2.5}><Box><Typography variant="h6" fontWeight={900}>Razorpay and Manual UPI</Typography><Typography color="text.secondary" fontSize={13}>The merchant secret is encrypted in MongoDB and never returned to the browser. Razorpay subscriptions activate only after signature verification; UPI subscriptions remain pending until admin approval.</Typography></Box>{error&&<Alert severity="error">{error}</Alert>}{message&&<Alert severity="success">{message}</Alert>}<Card variant="outlined"><CardContent><Grid container spacing={2}><Grid size={{xs:12,md:6}}><TextField fullWidth label="Razorpay merchant / key ID" value={form.keyId} onChange={(e)=>setForm({...form,keyId:e.target.value})} /></Grid><Grid size={{xs:12,md:6}}><TextField fullWidth type="password" label="Razorpay key secret" value={form.secret} onChange={(e)=>setForm({...form,secret:e.target.value})} helperText="Leave blank to keep the current encrypted secret." /></Grid><Grid size={{xs:12,md:6}}><TextField fullWidth label="UPI ID" value={form.upiId} onChange={(e)=>setForm({...form,upiId:e.target.value})} /></Grid><Grid size={{xs:12,md:6}}><TextField fullWidth label="UPI display name" value={form.upiName} onChange={(e)=>setForm({...form,upiName:e.target.value})} /></Grid><Grid size={{xs:12}}><TextField fullWidth label="UPI QR image URL (optional)" value={form.upiQrUrl} onChange={(e)=>setForm({...form,upiQrUrl:e.target.value})} /></Grid></Grid><Button sx={{mt:2}} variant="contained" startIcon={<SaveRounded/>} disabled={saving} onClick={save}>{saving?'Saving…':'Save payment settings'}</Button></CardContent></Card></Stack>;
}

function MapAdministration({ onSaved }: { onSaved: () => Promise<void> | void }) {
  const empty: MapsSettings = {
    enabled: false, provider: 'google', publicApiKey: '', publicApiKeyConfigured: false,
    serverApiKeyConfigured: false, geocodingApiKeyConfigured: false, directionsApiKeyConfigured: false, placesApiKeyConfigured: false,
    routesApiKeyConfigured: false, elevationApiKeyConfigured: false, roadsApiKeyConfigured: false, addressValidationApiKeyConfigured: false,
    groundingLiteApiKeyConfigured: false, navigationConnectConfigured: false, routeOptimizationConfigured: false, streetViewPublishConfigured: false,
    navigationEnabled: true, locationPickerEnabled: true, reverseGeocodeEnabled: true, directionsEnabled: true, serverRoutesEnabled: true,
    routesEnabled: true, placesEnabled: true, placesUiKitEnabled: true, addressValidationEnabled: true, elevationEnabled: true, roadsEnabled: true,
    routeOptimizationEnabled: false, navigationConnectEnabled: false, groundingLiteEnabled: false, streetViewPublishEnabled: false, useTraffic: true,
    routeRefreshSeconds: 10, locationUpdateSeconds: 5, maxRouteWaypoints: 25, cloudProjectId: '', regionCode: 'IN', languageCode: 'en-US', units: 'METRIC',
    navigationConnectAndroidAppId: '', navigationConnectIosAppId: '', mapId: '', defaultLatitude: 20.5937, defaultLongitude: 78.9629, defaultZoom: 15, travelMode: 'DRIVING', status: 'unconfigured', lastError: '',
  };
  const [form, setForm] = useState<MapsSettings>(empty);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { const [result, status] = await Promise.all([getMapsSettings(), getMapsPlatformStatus().catch(() => null)]); setForm({ ...empty, ...result.data, ...(status?.data || {}) }); }
    catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await updateMapsSettings({
        enabled: Boolean(form.enabled), provider: 'google', publicApiKey: form.publicApiKey,
        ...Object.fromEntries(Object.entries(secrets).map(([key, value]) => [key, value || undefined])),
        navigationEnabled: Boolean(form.navigationEnabled), locationPickerEnabled: Boolean(form.locationPickerEnabled),
        reverseGeocodeEnabled: Boolean(form.reverseGeocodeEnabled), directionsEnabled: Boolean(form.directionsEnabled), serverRoutesEnabled: Boolean(form.serverRoutesEnabled),
        routesEnabled: Boolean(form.routesEnabled), placesEnabled: Boolean(form.placesEnabled), placesUiKitEnabled: Boolean(form.placesUiKitEnabled), addressValidationEnabled: Boolean(form.addressValidationEnabled), elevationEnabled: Boolean(form.elevationEnabled), roadsEnabled: Boolean(form.roadsEnabled), routeOptimizationEnabled: Boolean(form.routeOptimizationEnabled), navigationConnectEnabled: Boolean(form.navigationConnectEnabled), groundingLiteEnabled: Boolean(form.groundingLiteEnabled), streetViewPublishEnabled: Boolean(form.streetViewPublishEnabled), useTraffic: Boolean(form.useTraffic),
        routeRefreshSeconds: Number(form.routeRefreshSeconds), locationUpdateSeconds: Number(form.locationUpdateSeconds), maxRouteWaypoints: Number(form.maxRouteWaypoints), cloudProjectId: String(form.cloudProjectId || ''), regionCode: String(form.regionCode || 'IN'), languageCode: String(form.languageCode || 'en-US'), units: form.units || 'METRIC', navigationConnectAndroidAppId: String(form.navigationConnectAndroidAppId || ''), navigationConnectIosAppId: String(form.navigationConnectIosAppId || ''),
        mapId: String(form.mapId || ''), defaultLatitude: Number(form.defaultLatitude), defaultLongitude: Number(form.defaultLongitude),
        defaultZoom: Number(form.defaultZoom), travelMode: form.travelMode,
      });
      setForm({ ...empty, ...result.data }); setSecrets({});
      setMessage('Maps & Navigation settings saved securely.');
      await onSaved();
    } catch (caught) { setError((caught as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  return <Stack spacing={2.5}>
    <Box><Typography variant="h6" fontWeight={900}>Maps & Navigation management</Typography><Typography color="text.secondary" fontSize={13}>Enterprise Google Maps Platform controls for exact property pins, server-side Routes, live GPS, Places, Address Validation, Elevation, Roads, route optimization, Navigation Connect, Grounding Lite and Street View publishing. Secret credentials are encrypted in MongoDB and never returned to the browser.</Typography></Box>
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
    <Stack direction="row" spacing={1} flexWrap="wrap"><Chip label={`Status: ${form.status || 'unconfigured'}`} color={form.status === 'configured' || form.status === 'healthy' ? 'success' : form.status === 'degraded' ? 'warning' : 'default'} /><Chip label={form.publicApiKeyConfigured ? 'Browser key configured' : 'Browser key missing'} color={form.publicApiKeyConfigured ? 'success' : 'warning'} /><Chip label={form.routesApiKeyConfigured ? 'Routes API ready' : 'Routes key missing'} color={form.routesApiKeyConfigured ? 'success' : 'warning'} /><Chip label={form.placesApiKeyConfigured ? 'Places API ready' : 'Places key missing'} color={form.placesApiKeyConfigured ? 'success' : 'warning'} /><Chip label={form.addressValidationApiKeyConfigured ? 'Address validation ready' : 'Address validation key missing'} color={form.addressValidationApiKeyConfigured ? 'success' : 'warning'} /><Chip label={form.roadsApiKeyConfigured ? 'Roads API ready' : 'Roads key missing'} color={form.roadsApiKeyConfigured ? 'success' : 'warning'} /></Stack>
    {form.lastError && <Alert severity="warning">Last map provider error: {form.lastError}</Alert>}
    <Card variant="outlined"><CardContent><Stack spacing={2}>
      <Typography fontWeight={900}>Provider and feature switches</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth select label="Map provider" value="google" disabled helperText="Google Maps Platform is used without a silent provider fallback."><MenuItem value="google">Google Maps Platform</MenuItem></TextField></Grid>
        <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Google Maps browser / JavaScript API key" value={form.publicApiKey} onChange={(event) => setForm((old) => ({ ...old, publicApiKey: event.target.value }))} helperText={`Used by the property pin picker and live route map. Restrict this AIza key to ${typeof window !== 'undefined' ? `${window.location.origin}/*` : 'your approved HTTPS web origins'}.`} /></Grid>
      </Grid>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap"><FormControlLabel control={<Switch checked={Boolean(form.enabled)} onChange={(_, checked) => setForm((old) => ({ ...old, enabled: checked }))} />} label="Enable maps platform" /><FormControlLabel control={<Switch checked={Boolean(form.locationPickerEnabled)} onChange={(_, checked) => setForm((old) => ({ ...old, locationPickerEnabled: checked }))} />} label="Enable exact property pinning" /><FormControlLabel control={<Switch checked={Boolean(form.navigationEnabled)} onChange={(_, checked) => setForm((old) => ({ ...old, navigationEnabled: checked }))} />} label="Enable live navigation" /><FormControlLabel control={<Switch checked={Boolean(form.reverseGeocodeEnabled)} onChange={(_, checked) => setForm((old) => ({ ...old, reverseGeocodeEnabled: checked }))} />} label="Enable address auto-fill" /><FormControlLabel control={<Switch checked={Boolean(form.directionsEnabled)} onChange={(_, checked) => setForm((old) => ({ ...old, directionsEnabled: checked }))} />} label="Enable route directions" /><FormControlLabel control={<Switch checked={Boolean(form.serverRoutesEnabled)} onChange={(_, checked) => setForm((old) => ({ ...old, serverRoutesEnabled: checked }))} />} label="Use secured server Routes API" /></Stack>
    </Stack></CardContent></Card>
    <Card variant="outlined"><CardContent><Stack spacing={2}>
      <Typography fontWeight={900}>Google service credentials</Typography>
      <Alert severity="info">Enable the Google Cloud services you use: Maps JavaScript API, Routes API, Places API / Places UI Kit, Address Validation API, Elevation API, Roads API, Route Optimization API, Navigation Connect API, Maps Grounding Lite API and Street View Publish API. Attach billing and use HTTP-referrer restrictions only for the browser key; use server restrictions or OAuth for backend services. Leave a secret field blank to keep its current encrypted value.</Alert>
      <Grid container spacing={2}>
        {([
          ['serverApiKey', 'Server API key (legacy compatibility)', 'Encrypted backend-only compatibility credential; dedicated service keys are recommended for production.'],
          ['geocodingApiKey', 'Geocoding API key', 'Encrypted; used for address auto-fill.'],
          ['directionsApiKey', 'Directions API key (legacy)', 'Encrypted compatibility key; new live routes use Routes API.'],
          ['routesApiKey', 'Routes API key', 'Encrypted; used by the secure route and route-matrix endpoints.'],
          ['placesApiKey', 'Places API (New) key', 'Encrypted; used for autocomplete, search and place details.'],
          ['addressValidationApiKey', 'Address Validation API key', 'Encrypted; validates and standardizes entered property addresses.'],
          ['elevationApiKey', 'Maps Elevation API key', 'Encrypted; used for terrain/elevation-aware field data.'],
          ['roadsApiKey', 'Roads API key', 'Encrypted; used to snap GPS traces and read road metadata.'],
          ['groundingLiteApiKey', 'Maps Grounding Lite API key', 'Encrypted; sent only to Google’s MCP endpoint.'],
          ['navigationConnectAccessToken', 'Navigation Connect OAuth token', 'Encrypted short-lived token; use ADC/service integration for production rotation.'],
          ['routeOptimizationAccessToken', 'Route Optimization OAuth token', 'Encrypted short-lived token; OAuth is required by this API.'],
          ['streetViewAccessToken', 'Street View Publish OAuth token', 'Encrypted OAuth token with streetview.publish scope.'],
        ] as const).map(([key, label, helper]) => <Grid size={{ xs: 12, md: 6 }} key={key}><TextField fullWidth type="password" label={label} value={secrets[key] || ''} onChange={(event) => setSecrets((old) => ({ ...old, [key]: event.target.value }))} helperText={helper} /></Grid>)}
      </Grid>
    </Stack></CardContent></Card>
    <Card variant="outlined"><CardContent><Stack spacing={2}><Typography fontWeight={900}>Google service switches</Typography><Grid container spacing={1.2}>{([
      ['routesEnabled', 'Routes API'], ['placesEnabled', 'Places API (New)'], ['placesUiKitEnabled', 'Places UI Kit'], ['addressValidationEnabled', 'Address Validation API'], ['elevationEnabled', 'Maps Elevation API'], ['roadsEnabled', 'Roads API'], ['routeOptimizationEnabled', 'Route Optimization API'], ['navigationConnectEnabled', 'Navigation Connect API'], ['groundingLiteEnabled', 'Maps Grounding Lite'], ['streetViewPublishEnabled', 'Street View Publish API'], ['useTraffic', 'Live traffic-aware routing'],
    ] as const).map(([key, label]) => <Grid size={{ xs: 12, sm: 6, md: 4 }} key={key}><FormControlLabel control={<Switch checked={Boolean(form[key])} onChange={(_, checked) => setForm((old) => ({ ...old, [key]: checked }))} />} label={label} /></Grid>)}</Grid><Grid container spacing={2}><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Google Cloud project ID or number" value={form.cloudProjectId || ''} onChange={(event) => setForm((old) => ({ ...old, cloudProjectId: event.target.value }))} helperText="Route Optimization accepts a project ID or number; Navigation Connect requires the numeric project number." /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Region code" value={form.regionCode || 'IN'} onChange={(event) => setForm((old) => ({ ...old, regionCode: event.target.value.toUpperCase() }))} /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Language code" value={form.languageCode || 'en-US'} onChange={(event) => setForm((old) => ({ ...old, languageCode: event.target.value }))} /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Navigation Connect Android app ID" value={form.navigationConnectAndroidAppId || ''} onChange={(event) => setForm((old) => ({ ...old, navigationConnectAndroidAppId: event.target.value }))} /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Navigation Connect iOS app ID" value={form.navigationConnectIosAppId || ''} onChange={(event) => setForm((old) => ({ ...old, navigationConnectIosAppId: event.target.value }))} /></Grid></Grid></Stack></CardContent></Card>
    <Card variant="outlined"><CardContent><Stack spacing={2}>
      <Typography fontWeight={900}>Road map and navigation defaults</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Default latitude" type="number" value={form.defaultLatitude} onChange={(event) => setForm((old) => ({ ...old, defaultLatitude: Number(event.target.value) }))} inputProps={{ min: -90, max: 90, step: 'any' }} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Default longitude" type="number" value={form.defaultLongitude} onChange={(event) => setForm((old) => ({ ...old, defaultLongitude: Number(event.target.value) }))} inputProps={{ min: -180, max: 180, step: 'any' }} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Default zoom" type="number" value={form.defaultZoom} onChange={(event) => setForm((old) => ({ ...old, defaultZoom: Number(event.target.value) }))} inputProps={{ min: 1, max: 22, step: 1 }} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth select label="Default travel mode" value={form.travelMode} onChange={(event) => setForm((old) => ({ ...old, travelMode: event.target.value as MapsSettings['travelMode'] }))}><MenuItem value="DRIVING">Driving</MenuItem><MenuItem value="WALKING">Walking</MenuItem><MenuItem value="BICYCLING">Bicycling</MenuItem><MenuItem value="TRANSIT">Transit</MenuItem></TextField></Grid>
        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Route refresh seconds" type="number" value={form.routeRefreshSeconds} onChange={(event) => setForm((old) => ({ ...old, routeRefreshSeconds: Number(event.target.value) }))} inputProps={{ min: 5, max: 120 }} helperText="Keeps live traffic updates bounded and predictable." /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="GPS update seconds" type="number" value={form.locationUpdateSeconds} onChange={(event) => setForm((old) => ({ ...old, locationUpdateSeconds: Number(event.target.value) }))} inputProps={{ min: 1, max: 60 }} /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Maximum route waypoints" type="number" value={form.maxRouteWaypoints} onChange={(event) => setForm((old) => ({ ...old, maxRouteWaypoints: Number(event.target.value) }))} inputProps={{ min: 0, max: 25 }} /></Grid>
        <Grid size={{ xs: 12 }}><TextField fullWidth label="Google Cloud Map ID (optional)" value={form.mapId} onChange={(event) => setForm((old) => ({ ...old, mapId: event.target.value }))} helperText="Set this when your Google Cloud map style uses a managed Map ID." /></Grid>
      </Grid>
      <Stack direction="row" spacing={1}><Button variant="contained" startIcon={<SaveRounded />} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Maps & Navigation'}</Button><Button startIcon={<RefreshRounded />} onClick={load} disabled={saving}>Refresh</Button></Stack>
    </Stack></CardContent></Card>
  </Stack>;
}

export default function SiteAdministrationPage(){
  const location = useLocation();
  const [tab,setTab]=useState(() => location.pathname.endsWith('/integration-settings') ? 4 : location.pathname.endsWith('/design-studio') ? 3 : 0);const [settings,setSettings]=useState<FormShape>({});const [settingsId,setSettingsId]=useState('');const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [saved,setSaved]=useState('');const {refresh}=useSite();
  async function load(){setLoading(true);try{const rows=(await getResource('site-settings',{limit:1})).data;const row=rows[0]||{};setSettings(row);setSettingsId(row._id||'');}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
  useEffect(()=>{load();},[]);
  async function saveSettings(){try{const payload=synchroniseLogoSources({...settings},'site');delete payload._id;delete payload.createdAt;delete payload.updatedAt;delete payload.__v;settingsId?await updateResource('site-settings',settingsId,payload):await createResource('site-settings',payload);setSaved('Site settings published');await load();await refresh();}catch(e){setError((e as Error).message);}}
  const tabs=useMemo(()=>['Site Identity','Footer & Legal Pages','SMS / WhatsApp','Razorpay & UPI','Maps & Navigation',...definitions.map((item)=>item.title)],[]);
  if(loading)return <Box sx={{py:16,display:'grid',placeItems:'center'}}><CircularProgress/></Box>;
  return <Box sx={{px:{xs:2,sm:3,lg:4},pb:6}}><Stack direction={{xs:'column',md:'row'}} justifyContent="space-between" spacing={2} mb={3}><Box><Typography variant="h4" fontWeight={950}>{location.pathname.endsWith('/design-studio') ? 'Advanced Design Studio' : 'Site & Marketplace Administration'}</Typography><Typography color="text.secondary">{location.pathname.endsWith('/design-studio') ? 'Design every page, component, token and navigation state with a responsive visual editor.' : 'Publish branding, SEO, design tokens, homepage content, property types, area units and subscription plans directly from MongoDB.'}</Typography></Box>{(tab===0||tab===1)&&<Button variant="contained" startIcon={<SaveRounded/>} onClick={saveSettings}>Publish site settings</Button>}</Stack>
  {error&&<Alert severity="error" onClose={()=>setError('')} sx={{mb:2}}>{error}</Alert>}{saved&&<Alert severity="success" onClose={()=>setSaved('')} sx={{mb:2}}>{saved}</Alert>}
  <Paper variant="outlined" sx={{borderRadius:4,overflow:'hidden'}}><Tabs value={tab} onChange={(_,value)=>setTab(value)} variant="scrollable" scrollButtons="auto" sx={{px:2,borderBottom:'1px solid',borderColor:'divider'}}>{tabs.map((label)=><Tab key={label} label={label}/>)}</Tabs><Box sx={{p:{xs:2,md:3}}}>{tab===0?<Stack spacing={3}><Box><Typography variant="h6" fontWeight={900}>Brand and identity</Typography><Typography color="text.secondary" fontSize={13}>These values drive the navigation logo, browser metadata, footer, colours and public pages.</Typography></Box><Grid container spacing={2}>{siteFields.filter(([key])=>!['logoUrl','logoLightUrl','faviconUrl','defaultOgImageUrl'].includes(key)).map(([key,label])=><Grid size={{xs:12,md:key==='description'||key==='tagline'||key==='contact.address'?12:6}} key={key}><TextField fullWidth size="small" multiline={key==='description'||key==='tagline'||key==='contact.address'} rows={key==='description'?4:undefined} label={label} value={key==='authentication.features' && Array.isArray(get(settings,key)) ? get(settings,key).join(', ') : get(settings,key)??''} onChange={(event)=>setSettings((old)=>set({...old},key,key==='authentication.features'?event.target.value.split(',').map((item)=>item.trim()).filter(Boolean):event.target.value))} type={key.includes('Color')?'color':'text'}/></Grid>)}</Grid><Divider/><Typography variant="h6" fontWeight={900}>Brand assets</Typography><Grid container spacing={2}>{[['logoUrl','Primary logo'],['logoLightUrl','Light logo'],['faviconUrl','Favicon'],['defaultOgImageUrl','Social image']].map(([key,label])=><Grid size={{xs:12,md:6}} key={key}><AssetUpload label={label} value={get(settings,key)} onChange={(value)=>setSettings((old)=>set({...old},key,value))}/></Grid>)}</Grid><Divider/><Stack direction="row" gap={3} flexWrap="wrap"><FormControlLabel control={<Switch checked={Boolean(get(settings,'homepage.heroEnabled'))} onChange={(_,value)=>setSettings((old)=>set({...old},'homepage.heroEnabled',value))}/>} label="Homepage hero"/><FormControlLabel control={<Switch checked={Boolean(get(settings,'homepage.featuredPropertiesEnabled'))} onChange={(_,value)=>setSettings((old)=>set({...old},'homepage.featuredPropertiesEnabled',value))}/>} label="Featured properties"/><FormControlLabel control={<Switch checked={Boolean(get(settings,'homepage.featuredSurveyorsEnabled'))} onChange={(_,value)=>setSettings((old)=>set({...old},'homepage.featuredSurveyorsEnabled',value))}/>} label="Featured surveyors"/><FormControlLabel control={<Switch checked={Boolean(get(settings,'homepage.statsEnabled'))} onChange={(_,value)=>setSettings((old)=>set({...old},'homepage.statsEnabled',value))}/>} label="Homepage statistics"/><FormControlLabel control={<Switch checked={Boolean(get(settings,'maintenance.enabled'))} onChange={(_,value)=>setSettings((old)=>set({...old},'maintenance.enabled',value))}/>} label="Maintenance mode"/><FormControlLabel control={<Switch checked={get(settings,'authentication.allowRegistration')!==false} onChange={(_,value)=>setSettings((old)=>set({...old},'authentication.allowRegistration',value))}/>} label="Allow registration"/><FormControlLabel control={<Switch checked={get(settings,'authentication.allowPasswordLogin')!==false} onChange={(_,value)=>setSettings((old)=>set({...old},'authentication.allowPasswordLogin',value))}/>} label="Allow password login"/><FormControlLabel control={<Switch checked={get(settings,'authentication.allowOtpLogin')!==false} onChange={(_,value)=>setSettings((old)=>set({...old},'authentication.allowOtpLogin',value))}/>} label="Allow demo accounts"/></Stack></Stack>:tab===1?<FooterAdministration settings={settings} setSettings={setSettings}/>:tab===2?<Fast2SmsAdministration/>:tab===3?<RazorpayAdministration/>:tab===4?<MapAdministration onSaved={async()=>{await load();await refresh();}}/>:<CollectionEditor definition={definitions[tab-5]}/>}</Box></Paper></Box>;
}
