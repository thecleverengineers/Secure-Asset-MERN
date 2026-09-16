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

export function LogoMark({ light = false }: { light?: boolean }) {
  const { data } = useSite();
  const settings = data.settings || {};
  const logoUrl = resolveSiteLogoUrl(settings, light);
  const name = settings.shortTitle || settings.siteTitle || 'SecureAsset';
  const textColor = light ? '#ffffff' : '#0f172a';
  const boxBg = light ? 'rgba(255, 255, 255, 0.15)' : '#0f172a';
  const boxBorder = light ? 'rgba(255, 255, 255, 0.3)' : 'transparent';
  const shapeBorder = '#ffffff';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      {logoUrl ? (
        <Box component="img" src={logoUrl} alt={`${name} logo`} sx={{ width: '100%', maxWidth: 186, height: 44, objectFit: 'contain', objectPosition: 'left center', display: 'block' }} />
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, bgcolor: boxBg, border: `1px solid ${boxBorder}`, position: 'relative', overflow: 'hidden', borderRadius: '6px' }}>
          <Box sx={{ position: 'absolute', width: '100%', height: '50%', top: 0, bgcolor: 'rgba(255,255,255,0.1)' }} />
          <Box sx={{ width: 10, height: 10, border: `1.5px solid ${shapeBorder}`, transform: 'rotate(45deg)', borderRadius: '2px' }} />
        </Box>
      )}
      {!logoUrl && <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '1.02rem', color: textColor, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{name}</Typography>}
    </Box>
  );
}
