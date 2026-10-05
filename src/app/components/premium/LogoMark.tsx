import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useSite } from '../../context/SiteContext';

const nonEmptyString = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** Resolve the administrator's uploaded canonical logo across every shell. */
export function resolveSiteLogoUrl(settings: Record<string, any> = {}, light = false) {
  return [
    ...(light ? [settings.logoLightUrl, settings.design?.branding?.logoLightUrl, settings.brand?.logoLightUrl] : []),
    settings.logoUrl,
    settings.design?.branding?.logoUrl,
    settings.brand?.logoUrl,
    settings.logoLightUrl,
    settings.design?.branding?.logoLightUrl,
  ].map(nonEmptyString).find(Boolean) || '';
}

type LogoMarkProps = {
  light?: boolean;
  compact?: boolean;
  headerLarge?: boolean;
  appShellLarge?: boolean;
  fallbackIconOnly?: boolean;
  forceFallback?: boolean;
  appShellVariant?: 'mobileHeader' | 'desktopSidebar';
};

/**
 * Uploaded-logo-only renderer.
 *
 * There is deliberately no generated icon or text fallback. Brand logo uploads
 * are persisted by Site Administration as data URLs so they survive Render
 * deployments without depending on ephemeral /site-assets files.
 */
export function LogoMark({
  light = false,
  compact = false,
  headerLarge = false,
  appShellLarge = false,
  appShellVariant,
}: LogoMarkProps) {
  const { data } = useSite();
  const settings = data.settings || {};
  const logoUrl = resolveSiteLogoUrl(settings, light);
  const [failedLogoUrl, setFailedLogoUrl] = useState('');

  const isMobileHeader = appShellVariant === 'mobileHeader';
  const isDesktopSidebar = appShellVariant === 'desktopSidebar';
  const imageMaxWidth = isMobileHeader ? 120 : isDesktopSidebar ? 160 : appShellLarge ? 210 : headerLarge ? 92 : compact ? 72 : 230;
  const imageMaxHeight = isMobileHeader ? 34 : isDesktopSidebar ? 42 : appShellLarge ? 230 : headerLarge ? 30 : compact ? 22 : 66;
  const canRenderImage = Boolean(logoUrl) && failedLogoUrl !== logoUrl;

  useEffect(() => {
    if (failedLogoUrl && failedLogoUrl !== logoUrl) setFailedLogoUrl('');
  }, [logoUrl, failedLogoUrl]);

  if (!canRenderImage) return null;

  return (
    <Box
      className="sa-brand-logo-mark"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      <Box
        component="img"
        src={logoUrl}
        alt=""
        aria-label="Secure Asset logo"
        onError={() => setFailedLogoUrl(logoUrl)}
        sx={{
          width: 'auto',
          maxWidth: imageMaxWidth,
          height: 'auto',
          maxHeight: imageMaxHeight,
          objectFit: 'contain',
          objectPosition: 'left center',
          display: 'block',
        }}
      />
    </Box>
  );
}
