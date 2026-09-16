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
  return <Box className="sa-page-header sa-surface-card" sx={{ position: 'relative', overflow: 'hidden', p: { xs: 2, sm: 2.4, lg: 2.7 }, borderRadius: 0, mb: 2.35, background: plain ? 'background.paper' : 'var(--sa-navigation)', color: plain ? 'text.primary' : 'var(--sa-navigation-text)', borderColor: plain ? 'divider' : 'rgba(255,255,255,.20)', '& .sa-page-kicker': { color: plain ? 'primary.main' : 'rgba(255,255,255,.72)' }, '& .MuiTypography-colorTextSecondary': { color: plain ? 'text.secondary' : 'rgba(255,255,255,.78)' }, '& .MuiChip-root': { color: plain ? 'text.primary' : 'var(--sa-navigation-text)', borderColor: plain ? 'divider' : 'rgba(255,255,255,.38)', backgroundColor: plain ? 'background.default' : 'rgba(255,255,255,.10)' }, '& .MuiButton-outlined': { color: plain ? 'primary.main' : 'var(--sa-navigation-text)', borderColor: plain ? 'primary.main' : 'rgba(255,255,255,.50)', '&:hover': { backgroundColor: plain ? 'action.hover' : 'rgba(255,255,255,.12)', borderColor: plain ? 'primary.main' : 'var(--sa-navigation-text)' } }, '& .sa-light-button.MuiButton-contained, & .MuiButton-root.MuiButton-contained:not(.sa-submit-button):not(.sa-edit-button):not(.sa-accept-button):not(.sa-danger-button)': plain ? {} : { color: 'var(--sa-navigation) !important', backgroundColor: 'var(--sa-navigation-text) !important', borderColor: 'var(--sa-navigation-text) !important', '&:hover': { backgroundColor: '#EAF2F5 !important' } } }}>
    <Box sx={{ position: 'absolute', width: 230, height: 230, right: -92, top: -145, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.12)', pointerEvents: 'none' }} />
    <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'flex-end' }} justifyContent="space-between" gap={2} sx={{ position: 'relative' }}>
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && <Typography className="sa-page-kicker" sx={{ mb: .85 }}>{eyebrow}</Typography>}
        <Typography variant="h4">{title}</Typography>
        {description && <Typography color="text.secondary" sx={{ mt: .65, maxWidth: 740, fontSize: 13.3, lineHeight: 1.6 }}>{description}</Typography>}
        {meta && <Box sx={{ mt: 1.25 }}>{meta}</Box>}
      </Box>
      {actions && <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0, alignItems: 'center' }}>{actions}</Stack>}
    </Stack>
  </Box>;
}
