import { Children, cloneElement, isValidElement, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box, Dialog as MuiDialog, DialogTitle as MuiDialogTitle, IconButton, Stack, Tooltip, Typography,
  useMediaQuery, useTheme, type DialogProps,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CropSquareRounded from '@mui/icons-material/CropSquareRounded';
import FilterNoneRounded from '@mui/icons-material/FilterNoneRounded';
import RemoveRounded from '@mui/icons-material/RemoveRounded';

type ProfessionalDialogProps = DialogProps & {
  professionalTitle?: ReactNode;
  professionalSubtitle?: ReactNode;
  enableMinimize?: boolean;
  enableMaximize?: boolean;
};

function isDialogTitleElement(element: any) {
  return element?.type === MuiDialogTitle || element?.type?.muiName === 'DialogTitle';
}

function extractTitle(children: ReactNode) {
  let title: ReactNode = null;
  const visit = (nodes: ReactNode): ReactNode => Children.map(nodes, (child) => {
    if (!isValidElement(child)) return child;
    if (!title && isDialogTitleElement(child)) {
      title = (child.props as any).children;
      return null;
    }
    const props = child.props as any;
    if (props?.children === undefined) return child;
    return cloneElement(child as any, undefined, visit(props.children));
  });
  return { title, content: visit(children) };
}

export default function ProfessionalDialog({
  children,
  professionalTitle,
  professionalSubtitle,
  enableMinimize = true,
  enableMaximize = true,
  onClose,
  open,
  fullScreen,
  PaperProps,
  sx,
  ...props
}: ProfessionalDialogProps) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [maximized, setMaximized] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!open) {
      setMaximized(false);
      setMinimized(false);
    }
  }, [open]);

  const extracted = useMemo(() => extractTitle(children), [children]);
  const title = professionalTitle || extracted.title || 'Window';
  const close = () => {
    setMaximized(false);
    setMinimized(false);
    onClose?.({}, 'escapeKeyDown');
  };

  return <MuiDialog
    {...props}
    open={open}
    onClose={onClose}
    fullScreen={Boolean(!minimized && (fullScreen || mobile || maximized))}
    hideBackdrop={minimized}
    disableAutoFocus={minimized}
    disableEnforceFocus={minimized}
    disableRestoreFocus={minimized}
    sx={[
      minimized ? {
        pointerEvents: 'none',
        '& .MuiDialog-container': { alignItems: 'flex-end', justifyContent: 'flex-end', p: 2, pointerEvents: 'none' },
        '& .MuiDialog-paper': { pointerEvents: 'auto' },
      } : {},
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
    PaperProps={{
      ...PaperProps,
      className: [PaperProps?.className, 'sa-professional-dialog-paper'].filter(Boolean).join(' '),
      sx: {
        overflow: 'hidden',
        maxHeight: minimized ? 'unset' : undefined,
        width: minimized ? { xs: 'calc(100vw - 24px)', sm: 380 } : undefined,
        minWidth: minimized ? 0 : undefined,
        m: minimized ? 0 : undefined,
        boxShadow: minimized ? 18 : undefined,
        ...(PaperProps?.sx as any),
        borderRadius: 'var(--sa-modal-radius) !important',
      },
    }}
  >
    <Stack
      direction="row"
      alignItems="center"
      gap={1}
      sx={{
        px: { xs: 1.5, sm: 2 }, py: 1.15,
        minHeight: 58,
        bgcolor: 'var(--sa-navigation)',
        color: 'var(--sa-navigation-text)',
        borderBottom: minimized ? 0 : '1px solid',
        borderColor: 'rgba(255,255,255,.24)',
        position: 'sticky', top: 0, zIndex: 5,
        '& .MuiIconButton-root': { color: 'var(--sa-navigation-text)', '&:hover': { bgcolor: 'rgba(255,255,255,.14)' } },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="div" noWrap sx={{ fontWeight: 900, fontSize: { xs: 15, sm: 16.5 } }}>{title}</Typography>
        {professionalSubtitle && !minimized && <Typography noWrap sx={{ color: 'rgba(255,255,255,.74)', fontSize: 11.5 }}>{professionalSubtitle}</Typography>}
      </Box>
      {enableMinimize && !mobile && <Tooltip title={minimized ? 'Restore' : 'Minimize'}>
        <IconButton size="small" onClick={() => { setMinimized((value) => !value); setMaximized(false); }} aria-label={minimized ? 'Restore dialog' : 'Minimize dialog'}>
          {minimized ? <FilterNoneRounded fontSize="small" /> : <RemoveRounded fontSize="small" />}
        </IconButton>
      </Tooltip>}
      {enableMaximize && !mobile && !minimized && <Tooltip title={maximized ? 'Restore size' : 'Maximize'}>
        <IconButton size="small" onClick={() => setMaximized((value) => !value)} aria-label={maximized ? 'Restore dialog size' : 'Maximize dialog'}>
          {maximized ? <FilterNoneRounded fontSize="small" /> : <CropSquareRounded fontSize="small" />}
        </IconButton>
      </Tooltip>}
      <Tooltip title="Close"><IconButton size="small" onClick={close} aria-label="Close dialog"><CloseRounded fontSize="small" /></IconButton></Tooltip>
    </Stack>
    {!minimized && extracted.content}
  </MuiDialog>;
}
