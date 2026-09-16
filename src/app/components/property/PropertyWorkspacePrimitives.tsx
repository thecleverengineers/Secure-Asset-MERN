import type { ReactNode } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';

type PropertyDataBlockProps = {
  label: string;
  value: ReactNode;
  full?: boolean;
};

type PropertySectionHeaderProps = {
  title: string;
  description?: ReactNode;
  count: number;
  action?: ReactNode;
};

type PropertyContextBannerProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  visibility?: ReactNode;
  reference?: ReactNode;
  location?: ReactNode;
  insights?: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
  marker?: string;
};

/**
 * Standardises the dense label/value treatment used by property information.
 * It keeps values easy to scan on a phone, while desktop sections can still
 * use a three-column grid without changing the information hierarchy.
 */
export function PropertyDataBlock({ label, value, full = false }: PropertyDataBlockProps) {
  return <Box
    data-secureasset-property-data-block="property-data-block-v154"
    sx={{
      minWidth: 0,
      p: { xs: 1.35, sm: 1.55 },
      borderRadius: { xs: 2, sm: 2.5 },
      border: '1px solid',
      borderColor: 'rgba(11,82,112,.12)',
      bgcolor: { xs: '#FFFFFF', sm: 'transparent' },
      gridColumn: full ? '1 / -1' : undefined,
    }}
  >
    <Typography color="text.secondary" sx={{ fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.075em', lineHeight: 1.35 }}>
      {label}
    </Typography>
    <Typography sx={{ mt: .48, color: '#152225', fontSize: { xs: 13.5, sm: 14 }, fontWeight: 780, lineHeight: 1.48, whiteSpace: full ? 'pre-wrap' : 'normal', wordBreak: 'break-word' }}>
      {value}
    </Typography>
  </Box>;
}

/** Shared heading for a property data group, including its visible field count. */
export function PropertySectionHeader({ title, description, count, action }: PropertySectionHeaderProps) {
  return <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.25}>
    <Box sx={{ minWidth: 0 }}>
      <Typography component="h2" sx={{ color: '#152225', fontWeight: 920, fontSize: { xs: 16, sm: 18 }, letterSpacing: '-.02em', lineHeight: 1.25 }}>
        {title}
      </Typography>
      {description && <Typography color="text.secondary" sx={{ mt: .42, fontSize: 12.25, lineHeight: 1.5 }}>{description}</Typography>}
    </Box>
    <Stack direction="row" alignItems="center" gap={.75} sx={{ flex: '0 0 auto' }}>
      <Chip size="small" label={`${count} field${count === 1 ? '' : 's'}`} variant="outlined" sx={{ borderColor: 'rgba(11,82,112,.23)', color: '#0B5270', bgcolor: '#F5FBFC', fontWeight: 850 }} />
      {action}
    </Stack>
  </Stack>;
}

/**
 * The record context remains visible at the start of a property workspace.
 * It deliberately uses the established deep teal/navy palette rather than a
 * new colour family, and collapses safely into a single-column mobile layout.
 */
export function PropertyContextBanner({
  eyebrow = 'Property record',
  title,
  description,
  status,
  visibility,
  reference,
  location,
  insights = [],
  actions,
  marker = 'property-context-banner-v154',
}: PropertyContextBannerProps) {
  return <Box
    data-secureasset-property-context-banner={marker}
    sx={{
      position: 'relative',
      overflow: 'hidden',
      mb: 2,
      px: { xs: 1.8, sm: 2.5, md: 3 },
      py: { xs: 2, sm: 2.5 },
      borderRadius: { xs: 3, sm: 4 },
      color: '#FFFFFF',
      background: 'linear-gradient(135deg, #0B5270 0%, #083D52 58%, #0F172A 100%)',
      boxShadow: '0 16px 34px rgba(8,61,82,.18)',
      '&::after': {
        content: '""', position: 'absolute', width: 260, height: 260, right: -118, top: -152, borderRadius: '50%',
        bgcolor: 'rgba(255,255,255,.10)', pointerEvents: 'none',
      },
      '& .MuiButton-outlined': { color: '#FFFFFF', borderColor: 'rgba(255,255,255,.60)', '&:hover': { borderColor: '#FFFFFF', bgcolor: 'rgba(255,255,255,.12)' } },
      '& .MuiButton-contained': { color: '#0B5270', bgcolor: '#FFFFFF', '&:hover': { bgcolor: '#EAF5F7' } },
      '& .MuiOutlinedInput-root': { color: '#FFFFFF', bgcolor: 'rgba(255,255,255,.10)', '& fieldset': { borderColor: 'rgba(255,255,255,.48)' }, '&:hover fieldset': { borderColor: '#FFFFFF' }, '&.Mui-focused fieldset': { borderColor: '#FFFFFF' } },
      '& .MuiInputLabel-root, & .MuiSvgIcon-root': { color: 'rgba(255,255,255,.82)' },
    }}
  >
    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={{ xs: 1.8, lg: 3 }} sx={{ position: 'relative', zIndex: 1 }}>
      <Box sx={{ minWidth: 0, maxWidth: 800 }}>
        <Typography sx={{ color: 'rgba(255,255,255,.72)', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>{eyebrow}</Typography>
        <Typography component="h1" sx={{ mt: .5, color: '#FFFFFF', fontSize: { xs: 23, sm: 29, md: 34 }, fontWeight: 950, lineHeight: 1.1, letterSpacing: '-.035em', wordBreak: 'break-word' }}>{title}</Typography>
        {description && <Typography sx={{ mt: .8, color: 'rgba(255,255,255,.80)', fontSize: { xs: 12.5, sm: 13.5 }, lineHeight: 1.56 }}>{description}</Typography>}
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={.75} sx={{ mt: 1.35 }}>
          {status && <Chip size="small" label={status} sx={{ color: '#FFFFFF', bgcolor: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.32)', fontWeight: 850 }} />}
          {visibility && <Chip size="small" label={visibility} variant="outlined" sx={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,.44)', fontWeight: 800 }} />}
          {reference && <Chip size="small" label={reference} variant="outlined" sx={{ color: 'rgba(255,255,255,.92)', borderColor: 'rgba(255,255,255,.30)', fontWeight: 750 }} />}
          {location && <Chip size="small" label={location} variant="outlined" sx={{ color: 'rgba(255,255,255,.92)', borderColor: 'rgba(255,255,255,.30)', fontWeight: 750, maxWidth: '100%' }} />}
        </Stack>
        {insights.length > 0 && <Box sx={{ mt: 1.65, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: `repeat(${Math.min(Math.max(insights.length, 2), 4)}, minmax(0, 1fr))` }, gap: .75 }}>
          {insights.map((insight) => <Box key={insight.label} sx={{ minWidth: 0, px: 1.05, py: .9, borderRadius: 2, bgcolor: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.16)' }}>
            <Typography sx={{ color: 'rgba(255,255,255,.68)', fontSize: 9.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '.06em' }}>{insight.label}</Typography>
            <Typography noWrap sx={{ mt: .18, color: '#FFFFFF', fontSize: 13.5, fontWeight: 900 }}>{insight.value}</Typography>
          </Box>)}
        </Box>}
      </Box>
      {actions && <Stack direction={{ xs: 'column', sm: 'row' }} gap={.8} flexWrap="wrap" useFlexGap sx={{ alignSelf: { lg: 'flex-end' }, flexShrink: 0, width: { xs: '100%', lg: 'auto' }, '& > .MuiButton-root, & > .MuiFormControl-root, & > .MuiTextField-root': { width: { xs: '100%', sm: 'auto' }, minHeight: 40 } }}>
        {actions}
      </Stack>}
    </Stack>
  </Box>;
}
