import { useEffect, useState } from 'react';
import { Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded';
import { fetchTenantKycDocumentBlob } from '../../services/api';

export function tenantKycFileId(value: any): string {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
}

export default function TenantKycDocumentPreview({
  label,
  value,
  height = 142,
}: {
  label: string;
  value?: any;
  height?: number;
}) {
  const fileId = tenantKycFileId(value);
  const [url, setUrl] = useState('');
  const [mimeType, setMimeType] = useState(String(value?.mimeType || ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl('');
    setError('');
    setMimeType(String(value?.mimeType || ''));
    if (!fileId) return () => { active = false; };

    setLoading(true);
    fetchTenantKycDocumentBlob(fileId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setMimeType(blob.type || String(value?.mimeType || ''));
        setUrl(objectUrl);
      })
      .catch((cause) => { if (active) setError((cause as Error).message || 'Preview unavailable'); })
      .finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, value]);

  if (!fileId) {
    return <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2.5, minHeight: height, display: 'grid', placeItems: 'center', bgcolor: 'action.hover', p: 1.5 }}><Typography color="text.secondary" fontSize={12}>No document uploaded</Typography></Box>;
  }

  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf' || String(value?.extension || '').toLowerCase() === '.pdf';
  return <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, overflow: 'hidden', bgcolor: 'grey.100' }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.25, py: .75, bgcolor: 'background.paper' }}>
      <Typography fontSize={12} fontWeight={850} noWrap>{label}</Typography>
      {isPdf ? <PictureAsPdfRounded sx={{ fontSize: 17, color: 'error.main' }} /> : <DescriptionRounded sx={{ fontSize: 17, color: 'primary.main' }} />}
    </Stack>
    <Box sx={{ height, display: 'grid', placeItems: 'center', position: 'relative' }}>
      {loading && <CircularProgress size={24} />}
      {!loading && error && <Stack alignItems="center" spacing={.5} sx={{ px: 1.5, textAlign: 'center' }}><ErrorOutlineRounded color="error" /><Typography color="error" fontSize={11}>{error}</Typography></Stack>}
      {!loading && !error && url && isImage && <Box component="img" src={url} alt={label} sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', p: .5 }} />}
      {!loading && !error && url && isPdf && <Box component="iframe" title={label} src={url} sx={{ width: '100%', height: '100%', border: 0, bgcolor: 'white' }} />}
      {!loading && !error && url && !isImage && !isPdf && <Chip icon={<DescriptionRounded />} label="Document ready" size="small" color="primary" />}
    </Box>
  </Box>;
}
