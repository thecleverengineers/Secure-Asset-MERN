import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

type CompactPageToolbarProps = {
  title?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  marker?: string;
};

/**
 * A quiet operational toolbar for app workspaces. Unlike PageHeader, this
 * intentionally has no full-width surface, colour treatment, or decorative
 * hero shape. Page actions stay immediately available without taking over the
 * page before the actual data workspace begins.
 */
export default function CompactPageToolbar({ title, description, meta, actions, marker = 'compact-v153' }: CompactPageToolbarProps) {
  return <Stack
    data-secureasset-compact-page-toolbar={marker}
    direction={{ xs: 'column', md: 'row' }}
    alignItems={{ md: 'center' }}
    justifyContent="space-between"
    gap={1.25}
    sx={{ mb: 2, pb: 1.35, borderBottom: '1px solid', borderColor: 'divider' }}
  >
    {(title || description || meta) && <Box sx={{ minWidth: 0 }}>
      {title && <Typography component="h1" sx={{ fontSize: { xs: 18, md: 20 }, lineHeight: 1.2, fontWeight: 900, letterSpacing: '-.02em' }}>{title}</Typography>}
      {description && <Typography color="text.secondary" sx={{ mt: title ? .38 : 0, fontSize: 12.5, lineHeight: 1.5 }}>{description}</Typography>}
      {meta && <Box sx={{ mt: .75 }}>{meta}</Box>}
    </Box>}
    {actions && <Stack direction="row" gap={.8} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0, alignItems: 'center' }}>{actions}</Stack>}
  </Stack>;
}
