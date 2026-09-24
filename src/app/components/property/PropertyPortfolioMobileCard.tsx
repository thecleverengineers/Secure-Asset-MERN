import type { MouseEvent } from 'react';
import { Box, Typography } from '@mui/material';
import PropertyPortfolioCard from './PropertyPortfolioCard';

type PropertyPortfolioMobileCardProps = {
  row: Record<string, any>;
  onOpen: () => void;
  onEdit?: () => void;
  onManageRooms?: () => void;
  onMore: (event: MouseEvent<HTMLButtonElement>) => void;
};

/** Touch-first two-column listing card with a prominent image and compact actions. */
export default function PropertyPortfolioMobileCard({ row, onOpen, onEdit, onManageRooms, onMore }: PropertyPortfolioMobileCardProps) {
  const title = String(row?.title || 'Untitled property');
  const handleEdit = (event?: MouseEvent<HTMLButtonElement>) => {
    if (!event || !onEdit) return;
    event.stopPropagation(); onEdit();
  };

  return <Box
    data-secureasset-property-mobile-card="portfolio-v154"
    aria-label={`Open ${title} details`}
    sx={{ minWidth: 0, '& .MuiCard-root': { height: '100%' } }}
  >
    <PropertyPortfolioCard row={row} onOpen={onOpen} onEdit={onEdit ? handleEdit : undefined} onManageRooms={onManageRooms} onMore={onMore} />
    <Typography component="span" sx={{ position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
      Open property. Price on request is shown when a listing does not have a price.
    </Typography>
  </Box>;
}
