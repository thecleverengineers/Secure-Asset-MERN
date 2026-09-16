import { useCallback, useMemo, useRef, useState } from 'react';
import { Button, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import ProfessionalDialog from './ProfessionalDialog';

type DialogState = {
  mode: 'confirm' | 'prompt';
  title: string;
  message: string;
  label?: string;
  value?: string;
  danger?: boolean;
};

export function useActionDialog() {
  const [state, setState] = useState<DialogState | null>(null);
  const resolver = useRef<((value: unknown) => void) | null>(null);

  const close = useCallback((value: boolean | string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  }, []);

  const askConfirmation = useCallback((message: string, options: { title?: string; danger?: boolean } = {}) => new Promise<boolean>((resolve) => {
    resolver.current = (value) => resolve(Boolean(value));
    setState({ mode: 'confirm', title: options.title || 'Confirm action', message, danger: options.danger });
  }), []);

  const askText = useCallback((message: string, options: { title?: string; label?: string; initialValue?: string } = {}) => new Promise<string | null>((resolve) => {
    resolver.current = (value) => resolve(typeof value === 'string' ? value : null);
    setState({ mode: 'prompt', title: options.title || 'Provide details', message, label: options.label || 'Value', value: options.initialValue || '' });
  }), []);

  const dialogs = useMemo(() => <ProfessionalDialog open={Boolean(state)} onClose={() => close(state?.mode === 'confirm' ? false : null)} fullWidth maxWidth="xs">
    <DialogTitle>{state?.title}</DialogTitle>
    <DialogContent>
      <DialogContentText sx={{ mb: state?.mode === 'prompt' ? 2 : 0 }}>{state?.message}</DialogContentText>
      {state?.mode === 'prompt' && <TextField autoFocus fullWidth label={state.label} value={state.value || ''} onChange={(event) => setState((old) => old ? { ...old, value: event.target.value } : old)} multiline minRows={2} />}
    </DialogContent>
    <DialogActions>
      <Button className="sa-danger-button" variant="outlined" onClick={() => close(state?.mode === 'confirm' ? false : null)}>Cancel</Button>
      <Button className={state?.danger ? 'sa-danger-button' : 'sa-accept-button'} variant="contained" onClick={() => close(state?.mode === 'confirm' ? true : state?.value || '')}>{state?.mode === 'confirm' ? 'Confirm' : 'Continue'}</Button>
    </DialogActions>
  </ProfessionalDialog>, [state, close]);

  return { askConfirmation, askText, dialogs };
}
