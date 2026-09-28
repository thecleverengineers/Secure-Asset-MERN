import { Suspense, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import {
  AppBar, BottomNavigation, BottomNavigationAction, Box, Button, Container, Divider, Drawer,
  IconButton, Stack, Toolbar, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import SellRoundedIcon from '@mui/icons-material/SellRounded';
import EngineeringRoundedIcon from '@mui/icons-material/EngineeringRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import { LogoMark, resolveSiteLogoUrl } from './premium/LogoMark';
import { UniversalSearchDialog } from './public/UniversalSearch';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { normaliseDesignSystem } from '../designSystem';
import { safeRecordArray } from '../utils/runtimeData';

const publicIconByKey: Record<string, any> = {
  home: HomeRoundedIcon,
  properties: StorefrontRoundedIcon,
  surveyors: EngineeringRoundedIcon,
  pricing: SellRoundedIcon,
  about: InfoOutlinedIcon,
  contact: MailOutlineRoundedIcon,
};

const fallbackNavigation = [
  { key: 'home', label: 'Home', path: '/', icon: HomeRoundedIcon },
  { key: 'properties', label: 'Properties', path: '/marketplace', icon: StorefrontRoundedIcon },
  { key: 'surveyors', label: 'Surveyors', path: '/surveyors', icon: EngineeringRoundedIcon },
  { key: 'pricing', label: 'Pricing', path: '/pricing', icon: SellRoundedIcon },
  { key: 'about', label: 'About', path: '/about', icon: InfoOutlinedIcon },
  { key: 'contact', label: 'Contact', path: '/contact', icon: MailOutlineRoundedIcon },
];

type FooterLink = { label: string; path: string; external?: boolean };
type FooterGroup = { heading: string; links: FooterLink[] };

const defaultFooterGroups: FooterGroup[] = [
  { heading: 'Platform', links: [{ label: 'Marketplace', path: '/marketplace' }, { label: 'Pricing', path: '/pricing' }, { label: 'About SecureAsset', path: '/about' }] },
  { heading: 'Operations', links: [{ label: 'Rent automation', path: '/pricing' }, { label: 'Document vault', path: '/auth/login' }, { label: 'Surveyor marketplace', path: '/surveyors' }] },
  { heading: 'Access', links: [{ label: 'Secure login', path: '/auth/login' }, { label: 'Create account', path: '/auth/register' }, { label: 'Contact support', path: '/contact' }] },
];

const footerLink = (value: any): FooterLink | null => {
  const label = String(value?.label || '').trim();
  const path = String(value?.path || '').trim();
  return label && path ? { label, path, external: Boolean(value?.external) } : null;
};

export default function FrontLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user: currentUser } = useAuth();
  const { data: site, refresh: refreshSite } = useSite();
  const settings = site.settings || {};
  const canonicalLogoUrl = resolveSiteLogoUrl(settings);
  const faviconUrl = String(settings.faviconUrl || settings.design?.branding?.faviconUrl || '').trim();
  const design = useMemo(() => normaliseDesignSystem(settings.design), [settings.design]);
  const configuredNavigation = safeRecordArray(site.publicNavigation).filter((item) => String(item.key || '').trim() && String(item.path || '').trim());
  const configuredOrFallbackNavigation = configuredNavigation.length
    ? configuredNavigation.map((item: any) => ({ key: String(item.key), label: String(item.label || item.key), path: String(item.path), icon: publicIconByKey[item.key] || StorefrontRoundedIcon }))
    : fallbackNavigation;
  const nav = configuredOrFallbackNavigation.some((item) => item.path === '/' || item.key === 'home')
    ? configuredOrFallbackNavigation
    : [{ key: 'home', label: 'Home', path: '/', icon: HomeRoundedIcon }, ...configuredOrFallbackNavigation];
  const primary = design.colors?.primary || settings.brand?.primaryColor || '#0B5270';
  const headerColor = design.colors?.navigation || '#0B5270';
  const headerText = design.colors?.navigationText || '#FFFFFF';
  const footerBackground = '#0B5270';
  const navigationRadius = Number(design.borders?.navigationRadius ?? 12);
  const headerHeight = Number(design.layout?.appBarHeight ?? 72);
  const isAuthRoute = location.pathname.startsWith('/auth/') || location.pathname === '/login' || location.pathname === '/reset-password';
  useEffect(() => {
    const root = document.documentElement;
    const values: Record<string, string> = {
      '--sa-page-background': design.colors.appBackground,
      '--sa-page-surface': design.colors.paper,
      '--sa-page-max-width': `${design.layout.contentMaxWidth}px`,
      '--sa-page-padding': `${design.layout.pagePadding}px`,
      '--sa-page-card-radius': `${design.borders.cardRadius}px`,
      '--sa-page-button-radius': `${design.borders.buttonRadius}px`,
      '--sa-page-mobile-padding': `${design.layout.mobilePagePadding}px`,
      '--sa-page-tablet-padding': `${Math.max(design.layout.mobilePagePadding + 6, 20)}px`,
      '--sa-page-desktop-padding': `${design.layout.pagePadding}px`,
      '--sa-editor-grid-spacing': `${design.motion.gridSpacing}px`,
    };
    Object.entries(values).forEach(([key, value]) => root.style.setProperty(key, value));
    return () => Object.keys(values).forEach((key) => root.style.removeProperty(key));
  }, [design]);
  const isRegisterRoute = location.pathname === '/auth/register';
  const accountAction = currentUser
    ? { label: 'Dashboard', path: '/app/dashboard' }
    : isRegisterRoute || location.pathname === '/auth/reset-password' || location.pathname === '/reset-password'
      ? { label: 'Sign in', path: '/auth/login' }
      : { label: 'Create account', path: '/auth/register' };
  const configuredFooterGroups: FooterGroup[] = Array.isArray(settings.footer?.navigation)
    ? settings.footer.navigation.map((group: any) => ({
      heading: String(group?.heading || '').trim(),
      links: Array.isArray(group?.links) ? group.links.map(footerLink).filter(Boolean) as FooterLink[] : [],
    })).filter((group: FooterGroup) => group.heading && group.links.length)
    : [];
  const footerGroups = configuredFooterGroups.length ? configuredFooterGroups : defaultFooterGroups;
  const configuredLegalLinks = Array.isArray(settings.footer?.legalLinks)
    ? settings.footer.legalLinks.map(footerLink).filter(Boolean) as FooterLink[]
    : [];
  const cmsFooterLinks: FooterLink[] = Array.isArray((site as any).footerPages)
    ? (site as any).footerPages.map((page: any) => footerLink({
      label: page?.footer?.label || page?.title,
      path: page?.path,
    })).filter(Boolean) as FooterLink[]
    : [];
  const requiredLegalLinks: FooterLink[] = [
    { label: 'Terms and Conditions', path: '/terms-and-conditions' },
    { label: 'Privacy Policy', path: '/privacy-policy' },
    { label: 'Shipping Policy', path: '/shipping-policy' },
    { label: 'Cancellation and Refunds', path: '/cancellation-and-refunds' },
    { label: 'Contact Us', path: '/contact' },
  ];
  const reservedLegalPaths = new Set([
    '/terms-and-conditions', '/terms-of-service', '/privacy-policy', '/shipping-policy',
    '/cancellation-and-refunds', '/contact',
  ]);
  const configuredLegalExtensions = (Array.isArray((site as any).footerPages) ? cmsFooterLinks : configuredLegalLinks)
    .filter((item) => !reservedLegalPaths.has(item.path) && item.path !== '/callback' && item.label.toLowerCase() !== 'request a callback');
  const legalLinks: FooterLink[] = [...requiredLegalLinks, ...configuredLegalExtensions];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    refreshSite(location.pathname);
  }, [location.pathname, refreshSite]);

  useEffect(() => {
    const seo = site.seo || {};
    const defaults = settings.seo || {};
    const baseTitle = seo.title || defaults.defaultTitle || settings.siteTitle || 'SecureAsset';
    const template = defaults.titleTemplate || '%s';
    document.title = template.includes('%s') && baseTitle !== defaults.defaultTitle ? template.replace('%s', baseTitle) : baseTitle;

    const setMeta = (selector: string, attribute: 'name' | 'property', key: string, value?: string) => {
      let element = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!value) { element?.remove(); return; }
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, key);
        element.dataset.siteManaged = 'true';
        document.head.appendChild(element);
      }
      element.setAttribute('content', value);
    };
    const setLink = (rel: string, href?: string) => {
      let element = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!href) { if (element?.dataset.siteManaged === 'true') element.remove(); return; }
      if (!element) {
        element = document.createElement('link');
        element.rel = rel;
        element.dataset.siteManaged = 'true';
        document.head.appendChild(element);
      }
      element.href = href;
    };
    const canonicalBase = String(defaults.canonicalBaseUrl || '').replace(/\/$/, '');
    const canonical = seo.canonicalUrl || (canonicalBase ? `${canonicalBase}${location.pathname === '/' ? '' : location.pathname}` : window.location.href.split('#')[0].split('?')[0]);
    const description = seo.description || defaults.defaultDescription || settings.description;
    const image = seo.ogImageUrl || settings.defaultOgImageUrl;

    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[name="keywords"]', 'name', 'keywords', Array.isArray(seo.keywords || defaults.keywords) ? (seo.keywords || defaults.keywords).join(', ') : seo.keywords || defaults.keywords);
    setMeta('meta[name="robots"]', 'name', 'robots', seo.robots || defaults.robots || 'index,follow');
    setMeta('meta[name="google-site-verification"]', 'name', 'google-site-verification', defaults.googleSiteVerification);
    setMeta('meta[property="og:title"]', 'property', 'og:title', seo.ogTitle || baseTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', seo.ogDescription || description);
    setMeta('meta[property="og:image"]', 'property', 'og:image', image);
    setMeta('meta[property="og:type"]', 'property', 'og:type', seo.ogType || 'website');
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', seo.twitterCard || 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.ogTitle || baseTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.ogDescription || description);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
    setLink('canonical', canonical);
    setLink('icon', faviconUrl);

    const scriptId = 'site-json-ld';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    const structuredData = seo.structuredData || (canonicalBase ? {
      '@context': 'https://schema.org', '@type': 'Organization', name: settings.siteTitle || 'SecureAsset', url: canonicalBase,
      logo: canonicalLogoUrl || undefined, description: settings.description || undefined,
    } : null);
    if (structuredData) {
      if (!script) { script = document.createElement('script'); script.id = scriptId; script.type = 'application/ld+json'; document.head.appendChild(script); }
      script.textContent = JSON.stringify(structuredData);
    } else script?.remove();
  }, [site.seo, settings, location.pathname, canonicalLogoUrl, faviconUrl]);

  const activeMobile = useMemo(() => {
    if (location.pathname.startsWith('/marketplace')) return 'explore';
    if (location.pathname.startsWith('/wishlist') || location.pathname.startsWith('/app/wishlist')) return 'wishlist';
    if (location.pathname.startsWith('/app/documents')) return 'vault';
    if (location.pathname.startsWith('/app/profile')) return 'account';
    return 'home';
  }, [location.pathname]);

  const mobileBottomItems = [
    { key: 'home', label: 'Home', path: '/', iconUrl: 'https://img.icons8.com/fluency/48/home.png', accent: '#2563EB', hover: '#EFF6FF' },
    { key: 'explore', label: 'Explore', path: '/marketplace', iconUrl: 'https://img.icons8.com/fluency/48/compass.png', accent: '#F97316', hover: '#FFF7ED' },
    { key: 'wishlist', label: 'Wishlist', path: '/wishlist', iconUrl: 'data:image/png;base64,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', accent: '#EC4899', hover: '#FDF2F8' },
    { key: 'vault', label: 'Vault', path: currentUser ? '/app/documents' : '/auth/login', iconUrl: 'https://img.icons8.com/fluency/48/office-365-security--compliance.png', accent: '#059669', hover: '#ECFDF5' },
    { key: 'account', label: 'Account', path: currentUser ? '/app/profile' : '/auth/login', iconUrl: 'https://img.icons8.com/fluency/48/user-group-man-man--v1.png', accent: '#7C3AED', hover: '#F5F3FF' },
  ];

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  if (isAuthRoute) {
    return (
      <Box className="sa-auth-route-shell" sx={{ minHeight: '100dvh', bgcolor: '#03192a' }}>
        <Suspense fallback={null}><Outlet /></Suspense>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={scrolled ? 5 : 0}
        sx={{
          bgcolor: headerColor,
          color: headerText,
          borderBottom: '1px solid rgba(255,255,255,.1)',
          transition: 'box-shadow .25s ease, background-color .25s ease',
          zIndex: theme.zIndex.appBar,
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ minHeight: { xs: 60, md: headerHeight }, gap: { xs: 1, md: 2.5 } }}>
            <Box onClick={() => navigate('/')} sx={{ flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <LogoMark light />
            </Box>

            <Stack direction="row" spacing={{ md: 2.5, xl: 4 }} sx={{ display: { xs: 'none', lg: 'flex' }, flex: 1, justifyContent: 'center', minWidth: 0 }}>
              {nav.map((item) => {
                const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(`${item.path}/`));
                return (
                  <Button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    disableRipple
                    sx={{
                      color: active ? headerText : 'rgba(255,255,255,.72)', textTransform: 'none', fontWeight: active ? 850 : 650,
                      fontSize: 13, minWidth: 0, px: .5, whiteSpace: 'nowrap', position: 'relative',
                      '&::after': { content: '""', position: 'absolute', left: 4, right: 4, bottom: 5, height: 2, borderRadius: 2, bgcolor: active ? headerText : 'transparent' },
                      '&:hover': { bgcolor: 'transparent', color: headerText },
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Stack>

            <Stack direction="row" alignItems="center" spacing={{ xs: .5, sm: 1, md: 1.4 }} sx={{ ml: 'auto', flexShrink: 0 }}>
              <Button
                onClick={() => setSearchOpen(true)}
                startIcon={<SearchRoundedIcon />}
                sx={{
                  color: headerText, borderColor: 'rgba(255,255,255,.34)', borderRadius: navigationRadius, textTransform: 'none', fontWeight: 800,
                  minWidth: { xs: 42, sm: 110 }, px: { xs: 1.1, sm: 1.8 }, height: 40,
                  '& .MuiButton-startIcon': { m: { xs: 0, sm: '0 8px 0 -4px' } },
                  '&:hover': { borderColor: headerText, bgcolor: 'rgba(255,255,255,.08)' },
                }}
                variant="outlined"
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Search</Box>
              </Button>

              {currentUser ? (
                <Button
                  onClick={() => navigate('/app/dashboard')}
                  startIcon={<DashboardRoundedIcon />}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: headerText, textTransform: 'none', fontWeight: 800, borderRadius: navigationRadius }}
                >
                  Dashboard
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/auth/login')}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: headerText, textTransform: 'none', fontWeight: 800, borderRadius: navigationRadius }}
                >
                  Log in
                </Button>
              )}

              {!currentUser && (
                <Button
                  className="sa-light-button"
                  variant="contained"
                  onClick={() => navigate(accountAction.path)}
                  disableElevation
                  sx={{ display: { xs: 'none', sm: 'inline-flex' }, bgcolor: headerText, color: headerColor, borderRadius: navigationRadius, textTransform: 'none', fontWeight: 900, px: { sm: 1.6, lg: 2.4 }, '&:hover': { bgcolor: 'rgba(255,255,255,.92)' } }}
                >
                  {accountAction.label}
                </Button>
              )}

              <IconButton onClick={() => setOpen(true)} sx={{ display: { lg: 'none' }, color: headerText }} aria-label="Open navigation">
                <MenuRoundedIcon />
              </IconButton>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 380 }, bgcolor: headerColor, color: headerText } }}
      >
        <Stack sx={{ minHeight: '100%' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 3 }}>
            <LogoMark light />
            <IconButton onClick={() => setOpen(false)} sx={{ color: headerText }}><CloseRoundedIcon /></IconButton>
          </Stack>
          <Divider sx={{ borderColor: 'rgba(255,255,255,.1)' }} />
          <Stack spacing={.7} sx={{ p: 2, flex: 1 }}>
            {nav.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(`${item.path}/`));
              return (
                <Button
                  key={item.path}
                  onClick={() => go(item.path)}
                  startIcon={<Icon />}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none', color: headerText, bgcolor: active ? 'rgba(255,255,255,.13)' : 'transparent', borderRadius: navigationRadius, px: 2, py: 1.4, fontWeight: active ? 850 : 650 }}
                >
                  {item.label}
                </Button>
              );
            })}
            <Button onClick={() => { setOpen(false); setSearchOpen(true); }} startIcon={<SearchRoundedIcon />} sx={{ justifyContent: 'flex-start', textTransform: 'none', color: headerText, borderRadius: navigationRadius, px: 2, py: 1.4, fontWeight: 700 }}>
              Search everything
            </Button>
          </Stack>
          <Box sx={{ p: 3 }}>
            <Box sx={{ p: 2.5, borderRadius: 4, bgcolor: 'rgba(0,0,0,.16)', border: '1px solid rgba(255,255,255,.08)' }}>
              <Typography sx={{ fontWeight: 900 }}>Manage property with confidence</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,.66)', fontSize: 12.5, lineHeight: 1.6, mt: .7, mb: 2 }}>Access rentals, documents, surveys and trusted marketplace tools from one account.</Typography>
              <Button className="sa-light-button" fullWidth variant="contained" endIcon={<ArrowForwardRoundedIcon />} onClick={() => go(accountAction.path)} sx={{ bgcolor: headerText, color: headerColor, borderRadius: navigationRadius, textTransform: 'none', fontWeight: 900, '&:hover': { bgcolor: 'rgba(255,255,255,.92)' } }}>
                {currentUser ? 'Open dashboard' : accountAction.label}
              </Button>
            </Box>
          </Box>
        </Stack>
      </Drawer>

      <UniversalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

      <Box component="main" className="sa-reference-content" sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: { xs: '60px', md: `${headerHeight}px` }, pb: { xs: '72px', md: 0 } }}>
        <Suspense fallback={null}><Outlet /></Suspense>
      </Box>

      <Box component="footer" sx={{ bgcolor: footerBackground, color: '#f8fafc', pt: { xs: 8, md: 11 }, pb: { xs: 13, md: 6 }, mt: 'auto' }}>
        <Container maxWidth="xl">
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={8}>
            <Box sx={{ maxWidth: 360 }}>
              <Box sx={{ mb: 3 }}><LogoMark light /></Box>
              <Typography sx={{ color: 'rgba(255,255,255,.68)', fontSize: 13, lineHeight: 1.8, fontWeight: 500 }}>
                {settings.footer?.description || settings.description || settings.tagline || 'A premium property operating system for rentals, tenancy, surveys and secure records.'}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 5, sm: 9, md: 13 }}>
              {footerGroups.map((group) => (
                <Box key={group.heading}>
                  <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', mb: 2 }}>{group.heading}</Typography>
                  <Stack spacing={1.4}>{group.links.map((item) => <Box component="a" href={item.path} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined} key={`${item.label}-${item.path}`} sx={{ color: 'rgba(255,255,255,.58)', fontSize: 13, width: 'fit-content', transition: 'color .16s ease', '&:hover': { color: '#FFFFFF' } }}>{item.label}</Box>)}</Stack>
                </Box>
              ))}
            </Stack>
          </Stack>
          <Divider sx={{ my: 5, borderColor: 'rgba(255,255,255,.1)' }} />
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
            <Typography sx={{ color: 'rgba(255,255,255,.48)', fontSize: 12 }}>© {new Date().getFullYear()} {settings.siteTitle || 'SecureAsset'}. All rights reserved.</Typography>
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>{legalLinks.map((item) => <Box component="a" href={item.path} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer' : undefined} key={`${item.label}-${item.path}`} sx={{ color: 'rgba(255,255,255,.48)', fontSize: 12, '&:hover': { color: '#fff' } }}>{item.label}</Box>)}</Stack>
          </Stack>
        </Container>
      </Box>

      <BottomNavigation
        className="sa-app-bottom-navigation sa-global-mobile-bottom-navigation"
        showLabels
        value={activeMobile}
        onChange={(_event, value) => {
          const item = mobileBottomItems.find((candidate) => candidate.key === value);
          if (item) navigate(item.path);
        }}
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: 'calc(66px + env(safe-area-inset-bottom))',
          zIndex: theme.zIndex.appBar + 2,
          bgcolor: '#FFFFFF',
          borderRadius: 0,
          borderTop: '1px solid #EEF2F6',
          pb: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -6px 20px rgba(15, 23, 42, 0.07)',
          fontFamily: '"Open Sans", sans-serif',
          '& .MuiBottomNavigationAction-root': {
            position: 'relative',
            minWidth: 0,
            maxWidth: 'none',
            flex: 1,
            px: 0.5,
            pt: 0.75,
            pb: 0.45,
            borderRadius: '0 !important',
            fontFamily: '"Open Sans", sans-serif',
            transition: 'color .18s ease, background-color .18s ease',
            '&::after': {
              content: '""',
              position: 'absolute',
              left: '31%',
              right: '31%',
              bottom: 3,
              height: 3,
              borderRadius: 0,
              bgcolor: 'transparent',
              transition: 'background-color .18s ease',
            },
          },
          '& .MuiBottomNavigationAction-label': {
            mt: 0.1,
            fontFamily: '"Open Sans", sans-serif',
            fontSize: '10.5px',
            lineHeight: 1.15,
            fontWeight: 600,
            letterSpacing: 0,
            '&.Mui-selected': {
              fontSize: '10.5px',
              fontWeight: 600,
            },
          },
        }}
      >
        {mobileBottomItems.map((item) => (
          <BottomNavigationAction
            key={item.key}
            value={item.key}
            label={item.label}
            aria-label={item.label}
            icon={<Box component="img" src={item.iconUrl} alt="" aria-hidden="true" sx={{ width: 25, height: 25, objectFit: 'contain' }} />}
            sx={{
              color: activeMobile === item.key ? item.accent : '#334155',
              '&:hover': { color: item.accent, bgcolor: item.hover },
              '&.Mui-selected': { color: item.accent, bgcolor: item.hover },
              '&.Mui-selected::after': { bgcolor: item.accent },
              '& .MuiBottomNavigationAction-label': { color: 'inherit !important' },
            }}
          />
        ))}
      </BottomNavigation>
    </Box>
  );
}
