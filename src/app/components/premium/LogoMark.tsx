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
export function LogoMark({ light = false }: { light?: boolean }) {
  const { data } = useSite();
  const settings = data.settings || {};
  const logoUrl = resolveSiteLogoUrl(settings, light);
  const [failedLogoUrl, setFailedLogoUrl] = useState('');
  const name = settings.shortTitle || settings.siteTitle || 'SecureAsset';
  const textColor = light ? '#ffffff' : '#12382d';
  const markBg = light ? 'rgba(255,255,255,.14)' : '#12382d';
  const markFg = light ? '#ffffff' : '#ffffff';
  const canRenderImage = Boolean(logoUrl) && failedLogoUrl !== logoUrl;

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
        gap: 1.15,
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
            maxWidth: 230,
            height: 'auto',
            maxHeight: 66,
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
              width: 34,
              height: 34,
              flex: '0 0 34px',
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
                width: 14,
                height: 14,
                border: `2px solid ${markFg}`,
                borderRadius: '4px 4px 6px 6px',
                transform: 'rotate(45deg)',
              }}
            />
          </Box>
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
        </>
      )}
    </Box>
  );
}
