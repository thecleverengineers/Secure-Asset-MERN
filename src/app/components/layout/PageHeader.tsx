import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  variant?: 'navigation' | 'plain';
};

/**
 * Shared authenticated-page heading. It keeps operational pages calm and
 * consistent while leaving each module free to provide its own actions.
 */
export default function PageHeader({ title, description, eyebrow = 'Workspace', actions, meta, variant = 'navigation' }: PageHeaderProps) {
  const plain = variant === 'plain';
  return <Box className="sa-page-header sa-surface-card" sx={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', p: { xs: 2.2, sm: 2.7, lg: 3.2 }, mb: { xs: 2, md: 2.75 }, minHeight: { md: 168 }, display: 'flex', alignItems: 'center', borderRadius: 0, background: plain ? 'background.paper' : 'var(--sa-navigation)', backgroundImage: plain ? 'linear-gradient(135deg, rgba(255,255,255,.98) 0%, rgba(242,249,247,.98) 62%, rgba(232,245,242,.96) 100%)' : 'linear-gradient(125deg, var(--sa-navigation) 0%, var(--sa-primary) 68%, #197869 145%)', color: plain ? 'text.primary' : 'var(--sa-navigation-text)', borderColor: plain ? 'divider' : 'rgba(255,255,255,.20)', '& .sa-page-kicker': { color: plain ? 'primary.main' : 'rgba(255,255,255,.78)' }, '& .MuiTypography-colorTextSecondary': { color: plain ? 'text.secondary' : 'rgba(255,255,255,.80)' }, '& .MuiChip-root': { color: plain ? 'text.primary' : 'var(--sa-navigation-text)', borderColor: plain ? 'rgba(10,96,122,.18)' : 'rgba(255,255,255,.38)', backgroundColor: plain ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.11)', backdropFilter: 'blur(10px)' }, '& .MuiButton-outlined': { color: plain ? 'primary.main' : 'var(--sa-navigation-text)', borderColor: plain ? 'rgba(10,96,122,.34)' : 'rgba(255,255,255,.50)', backgroundColor: plain ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.04)', '&:hover': { backgroundColor: plain ? 'rgba(10,96,122,.08)' : 'rgba(255,255,255,.14)', borderColor: plain ? 'primary.main' : 'var(--sa-navigation-text)' } }, '& .sa-light-button.MuiButton-contained, & .MuiButton-root.MuiButton-contained:not(.sa-submit-button):not(.sa-edit-button):not(.sa-accept-button):not(.sa-danger-button)': plain ? {} : { color: 'var(--sa-navigation) !important', backgroundColor: 'var(--sa-navigation-text) !important', borderColor: 'var(--sa-navigation-text) !important', boxShadow: '0 10px 24px rgba(0,0,0,.16)', '&:hover': { backgroundColor: '#EAF2F5 !important' } } }}>
    <Box sx={{ position: 'absolute', zIndex: -1, width: 270, height: 270, right: -88, top: -170, borderRadius: '50%', bgcolor: plain ? 'rgba(10,96,122,.075)' : 'rgba(255,255,255,.11)', pointerEvents: 'none' }} />
    <Box sx={{ position: 'absolute', zIndex: -1, width: 150, height: 150, right: { xs: -74, md: 190 }, bottom: -112, borderRadius: '50%', bgcolor: plain ? 'rgba(32,132,99,.075)' : 'rgba(255,255,255,.07)', pointerEvents: 'none' }} />
    <Box sx={{ position: 'absolute', left: 0, top: { xs: 28, md: 34 }, bottom: { xs: 28, md: 34 }, width: 4, borderRadius: '0 999px 999px 0', bgcolor: plain ? 'primary.main' : 'rgba(255,255,255,.78)' }} />
    <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" gap={{ xs: 2.2, md: 3 }} sx={{ position: 'relative', width: '100%' }}>
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && <Typography className="sa-page-kicker" sx={{ mb: .85 }}>{eyebrow}</Typography>}
        <Typography variant="h4" sx={{ fontSize: { xs: 24, sm: 27, lg: 30 }, maxWidth: 820 }}>{title}</Typography>
        {description && <Typography color="text.secondary" sx={{ mt: .8, maxWidth: 760, fontSize: { xs: 12.8, sm: 13.4 }, lineHeight: 1.65 }}>{description}</Typography>}
        {meta && <Box sx={{ mt: 1.25 }}>{meta}</Box>}
      </Box>
      {actions && <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0, alignItems: 'center', width: { xs: '100%', md: 'auto' }, '& .MuiButton-root': { flex: { xs: '1 1 150px', md: '0 0 auto' } } }}>{actions}</Stack>}
    </Stack>
  </Box>;
}
