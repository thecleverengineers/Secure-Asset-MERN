import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
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
  { heading: 'Operations', links: [{ label: 'Rent automation', path: '/pricing' }, { label: 'Document vault', path: '/login' }, { label: 'Surveyor marketplace', path: '/surveyors' }] },
  { heading: 'Access', links: [{ label: 'Secure login', path: '/login' }, { label: 'Create account', path: '/login?mode=register' }, { label: 'Contact support', path: '/contact' }] },
];

const footerLink = (value: any): FooterLink | null => {
  const label = String(value?.label || '').trim();
  const path = String(value?.path || '').trim();
  return label && path ? { label, path, external: Boolean(value?.external) } : null;
};

function configuredBottomIcon(design: any, key: string, fallback: ReactNode) {
  const source = String(design?.iconAssets?.bottomAppBar?.[key] || '').trim();
  return source ? <Box component="img" src={source} alt="" aria-hidden="true" sx={{ width: design.bottomAppBar.iconSize, height: design.bottomAppBar.iconSize, objectFit: 'contain' }} /> : fallback;
}

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
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/reset-password';
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
  const isRegisterRoute = location.pathname === '/login' && new URLSearchParams(location.search).get('mode') === 'register';
  const accountAction = currentUser
    ? { label: 'Dashboard', path: '/app/dashboard' }
    : isRegisterRoute || location.pathname === '/reset-password'
      ? { label: 'Sign in', path: '/login' }
      : { label: 'Create account', path: '/login?mode=register' };
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
  const legalLinks: FooterLink[] = configuredLegalLinks.length ? configuredLegalLinks : [
    { label: 'Privacy Policy', path: settings.legal?.privacyUrl || '/privacy-policy' },
    { label: 'Terms of Service', path: settings.legal?.termsUrl || '/terms-of-service' },
    { label: settings.footer?.callback?.label || 'Request a callback', path: settings.footer?.callback?.path || '/callback' },
  ];
  const callbackLink = footerLink(settings.footer?.callback) || legalLinks.find((item) => item.path === '/callback') || { label: 'Request a callback', path: '/callback' };

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
    if (currentUser?.role === 'tenant') {
      if (location.pathname.startsWith('/app/documents')) return 'vault';
      if (location.pathname.startsWith('/wishlist') || location.pathname.startsWith('/app/wishlist')) return 'wishlist';
      if (location.pathname.startsWith('/marketplace')) return 'explore';
      if (location.pathname.startsWith('/app/profile')) return 'profile';
      return 'home';
    }
    if (!currentUser) {
      if (location.pathname.startsWith('/wishlist')) return 'wishlist';
      if (location.pathname.startsWith('/marketplace')) return 'explore';
      if (isAuthRoute) return 'login';
      return 'home';
    }
    if (location.pathname.startsWith('/app/documents')) return 'vault';
    if (location.pathname.startsWith('/marketplace')) return 'property';
    if (location.pathname.startsWith('/app/profile')) return 'account';
    return 'home';
  }, [currentUser, isAuthRoute, location.pathname]);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

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
                  onClick={() => navigate('/login')}
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
        <Outlet />
      </Box>

      <Box component="footer" sx={{ bgcolor: footerBackground, color: '#f8fafc', pt: { xs: 8, md: 11 }, pb: { xs: 13, md: 6 }, mt: 'auto' }}>
        <Container maxWidth="xl">
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={8}>
            <Box sx={{ maxWidth: 360 }}>
              <Box sx={{ mb: 3 }}><LogoMark light /></Box>
              <Typography sx={{ color: 'rgba(255,255,255,.68)', fontSize: 13, lineHeight: 1.8, fontWeight: 500 }}>
                {settings.footer?.description || settings.description || settings.tagline || 'A premium property operating system for rentals, tenancy, surveys and secure records.'}
              </Typography>
              {callbackLink?.path && <Button component="a" href={callbackLink.path} target={callbackLink.external ? '_blank' : undefined} rel={callbackLink.external ? 'noreferrer' : undefined} endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 3, p: 0, minWidth: 0, color: '#fff', fontWeight: 900, textTransform: 'none', '&:hover': { bgcolor: 'transparent', color: '#fff' } }}>{callbackLink.label}</Button>}
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
            const paths: Record<string, string> = currentUser?.role === 'tenant'
              ? { home: '/', explore: '/marketplace', vault: '/app/documents', wishlist: '/wishlist', profile: '/app/profile' }
              : currentUser
                ? { home: '/', vault: '/app/documents', property: '/marketplace', account: '/app/profile' }
                : { home: '/', explore: '/marketplace', wishlist: '/wishlist', login: '/login' };
            if (paths[value]) navigate(paths[value]);
          }}
          sx={{
            position: 'fixed', left: 0, right: 0, bottom: 0, height: `calc(${design.bottomAppBar.height}px + env(safe-area-inset-bottom))`, zIndex: theme.zIndex.appBar + 2,
            borderTop: '1px solid', borderColor: 'divider', borderRadius: 0, bgcolor: design.bottomAppBar.background, opacity: design.bottomAppBar.opacity, pb: 'env(safe-area-inset-bottom)', backdropFilter: design.bottomAppBar.blur ? `blur(${design.bottomAppBar.blur}px)` : 'none', boxShadow: design.bottomAppBar.shadow === 'none' ? 'none' : '0 -12px 32px rgba(15,23,42,.12)',
            '& .MuiBottomNavigationAction-root': { minWidth: 0, px: design.bottomAppBar.itemGap, color: design.bottomAppBar.inactiveColor, '&.Mui-selected': { color: design.bottomAppBar.activeColor } },
            '& .MuiBottomNavigationAction-label': { fontSize: design.bottomAppBar.labelSize, fontWeight: 750 },
          }}
        >
          {currentUser?.role === 'tenant' ? <>
            <BottomNavigationAction value="home" label="Home" onClick={() => navigate('/')} icon={configuredBottomIcon(design, 'home', <HomeRoundedIcon />)} />
            <BottomNavigationAction value="explore" label="Explore" onClick={() => navigate('/marketplace')} icon={configuredBottomIcon(design, 'explore', <ExploreRoundedIcon />)} />
            <BottomNavigationAction value="vault" label="Vault" onClick={() => navigate('/app/documents')} icon={configuredBottomIcon(design, 'vault', <FolderRoundedIcon />)} />
            <BottomNavigationAction value="wishlist" label="Wishlist" onClick={() => navigate('/wishlist')} icon={configuredBottomIcon(design, 'wishlist', <FavoriteBorderRoundedIcon />)} />
            <BottomNavigationAction value="profile" label="Profile" onClick={() => navigate('/app/profile')} icon={configuredBottomIcon(design, 'profile', <PersonRoundedIcon />)} />
          </> : !currentUser ? <>
            <BottomNavigationAction value="home" label="Home" onClick={() => navigate('/')} icon={configuredBottomIcon(design, 'home', <HomeRoundedIcon />)} />
            <BottomNavigationAction value="explore" label="Explore" onClick={() => navigate('/marketplace')} icon={configuredBottomIcon(design, 'explore', <ExploreRoundedIcon />)} />
            <BottomNavigationAction value="wishlist" label="Wishlist" onClick={() => navigate('/wishlist')} icon={configuredBottomIcon(design, 'wishlist', <FavoriteBorderRoundedIcon />)} />
            <BottomNavigationAction value="login" label="Login" onClick={() => navigate('/login')} icon={configuredBottomIcon(design, 'login', <LoginRoundedIcon />)} />
          </> : <>
            <BottomNavigationAction value="home" label="Home" icon={configuredBottomIcon(design, 'home', <HomeRoundedIcon />)} />
            <BottomNavigationAction value="vault" label="Vault" icon={configuredBottomIcon(design, 'vault', <FolderRoundedIcon />)} />
            <BottomNavigationAction value="property" label="Property" icon={configuredBottomIcon(design, 'property', <StorefrontRoundedIcon />)} />
            <BottomNavigationAction value="account" label="Account" icon={configuredBottomIcon(design, 'account', <PersonRoundedIcon />)} />
          </>}
        </BottomNavigation>
    </Box>
  );
}
