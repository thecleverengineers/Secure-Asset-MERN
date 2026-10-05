import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useSite } from '../../context/SiteContext';

const nonEmptyString = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** Resolve the administrator's canonical logo across every application shell. */
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

/**
 * Brand-safe logo renderer.
 *
 * CMS logos are preferred, but Render's ephemeral filesystem can invalidate
 * older /site-assets URLs after a deploy. A failed image therefore falls back
 * immediately to a vector/text mark rendered by React itself. This keeps every
 * shell usable and prevents the browser's broken-image icon/alt text from ever
 * becoming the visible brand.
 */
export function LogoMark({ light = false, compact = false, headerLarge = false, appShellLarge = false, fallbackIconOnly = false, forceFallback = false }: { light?: boolean; compact?: boolean; headerLarge?: boolean; appShellLarge?: boolean; fallbackIconOnly?: boolean; forceFallback?: boolean }) {
  const { data } = useSite();
  const settings = data.settings || {};
  const logoUrl = resolveSiteLogoUrl(settings, light);
  const [failedLogoUrl, setFailedLogoUrl] = useState('');
  const name = settings.shortTitle || settings.siteTitle || 'SecureAsset';
  const textColor = light ? '#ffffff' : '#12382d';
  const markBg = light ? 'rgba(255,255,255,.14)' : '#12382d';
  const markFg = light ? '#ffffff' : '#ffffff';
  const canRenderImage = !forceFallback && Boolean(logoUrl) && failedLogoUrl !== logoUrl;

  useEffect(() => {
    if (!logoUrl) setFailedLogoUrl('');
  }, [logoUrl]);

  return (
    <Box
      className="sa-brand-logo-mark"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: appShellLarge ? 0 : headerLarge ? .8 : compact ? .7 : 1.15,
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {canRenderImage ? (
        <Box
          component="img"
          src={logoUrl}
          alt=""
          aria-label={`${name} logo`}
          onError={() => setFailedLogoUrl(logoUrl)}
          sx={{
            width: 'auto',
            width: appShellLarge ? 210 : 'auto',
            maxWidth: appShellLarge ? 210 : headerLarge ? 92 : compact ? 72 : 230,
            height: appShellLarge ? 230 : 'auto',
            maxHeight: appShellLarge ? 230 : headerLarge ? 30 : compact ? 22 : 66,
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
          }}
        />
      ) : (
        <>
          <Box
            aria-hidden="true"
            sx={{
              width: appShellLarge ? 210 : headerLarge ? 30 : compact ? 24 : 34,
              height: appShellLarge ? 230 : headerLarge ? 30 : compact ? 24 : 34,
              flex: appShellLarge ? '0 0 210px' : headerLarge ? '0 0 30px' : compact ? '0 0 24px' : '0 0 34px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: markBg,
              border: light ? '1px solid rgba(255,255,255,.28)' : '1px solid rgba(18,56,45,.08)',
              borderRadius: '10px',
              boxShadow: light ? 'none' : '0 5px 14px rgba(18,56,45,.10)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: appShellLarge ? 84 : headerLarge ? 12 : compact ? 10 : 14,
                height: appShellLarge ? 84 : headerLarge ? 12 : compact ? 10 : 14,
                border: `2px solid ${markFg}`,
                borderRadius: '4px 4px 6px 6px',
                transform: 'rotate(45deg)',
              }}
            />
          </Box>
          {!compact && !fallbackIconOnly && (
            <Typography
              component="span"
              sx={{
                color: textColor,
                fontWeight: 850,
                fontSize: '1.08rem',
                lineHeight: 1,
                letterSpacing: '-.035em',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              {String(name).replace(/SecureAsset/g, 'Secure Asset')}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
