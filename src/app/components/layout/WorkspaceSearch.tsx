import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Box, Button, IconButton, InputBase, Tooltip } from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';

type WorkspaceSearchVariant = 'header' | 'dialog';

interface WorkspaceSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  variant?: WorkspaceSearchVariant;
  enableShortcut?: boolean;
}

/**
 * The authenticated workspace search is intentionally a small, shared surface.
 * Keeping it here makes the header and mobile search dialog visually consistent
 * without pulling the public marketplace autocomplete into the app shell.
 */
export default function WorkspaceSearch({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search properties, people or records…',
  autoFocus = false,
  variant = 'header',
  enableShortcut = true,
}: WorkspaceSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [isMac, setIsMac] = useState(false);
  const isHeader = variant === 'header';
  const canSubmit = value.trim().length >= 2;

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (typeof navigator !== 'undefined') setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  useEffect(() => {
    if (!isHeader || !enableShortcut || typeof window === 'undefined') return undefined;
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        event.preventDefault();
        if (valueRef.current) onChangeRef.current('');
        else inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [enableShortcut, isHeader]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onSubmit();
  };

  const clearSearch = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <Box
      component="form"
      role="search"
      aria-label="Search the SecureAsset workspace"
      aria-keyshortcuts={isHeader && enableShortcut ? 'Control+K Meta+K' : undefined}
      onSubmit={handleSubmit}
      sx={isHeader ? {
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        flex: { md: '1 1 330px', lg: '1 1 440px' },
        width: '100%',
        minWidth: 0,
        maxWidth: { md: 540, xl: 640 },
        minHeight: 48,
        px: .75,
        gap: .7,
        border: '1px solid rgba(255,255,255,.28)',
        borderRadius: 999,
        background: 'linear-gradient(135deg, rgba(255,255,255,.17), rgba(255,255,255,.085))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.14), 0 8px 22px rgba(2,31,43,.10)',
        transition: 'border-color .18s ease, box-shadow .18s ease, background .18s ease',
        '&:hover': {
          borderColor: 'rgba(255,255,255,.48)',
          background: 'linear-gradient(135deg, rgba(255,255,255,.20), rgba(255,255,255,.10))',
        },
        '&:focus-within': {
          borderColor: 'rgba(255,255,255,.92)',
          background: 'linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,.12))',
          boxShadow: '0 0 0 4px rgba(255,255,255,.14), inset 0 1px 0 rgba(255,255,255,.18), 0 10px 26px rgba(2,31,43,.16)',
        },
      } : {
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        minWidth: 0,
        minHeight: 58,
        px: 1,
        gap: .8,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3.5,
        boxShadow: '0 14px 38px rgba(15, 35, 40, .10)',
        transition: 'border-color .18s ease, box-shadow .18s ease',
        '&:hover': { borderColor: 'primary.main' },
        '&:focus-within': { borderColor: 'primary.main', boxShadow: '0 0 0 4px rgba(11,82,112,.12), 0 18px 44px rgba(15,35,40,.14)' },
      }}
    >
      <Box sx={{
        display: 'grid',
        placeItems: 'center',
        flex: '0 0 auto',
        width: isHeader ? 34 : 38,
        height: isHeader ? 34 : 38,
        borderRadius: '50%',
        bgcolor: isHeader ? 'rgba(255,255,255,.14)' : 'rgba(11,82,112,.09)',
        border: '1px solid',
        borderColor: isHeader ? 'rgba(255,255,255,.16)' : 'rgba(11,82,112,.12)',
      }}>
        <SearchRounded sx={{ fontSize: isHeader ? 18 : 20, color: isHeader ? 'rgba(255,255,255,.90)' : 'primary.main' }} />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center' }}>
        <InputBase
          inputRef={inputRef}
          autoFocus={autoFocus}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputProps={{
            'aria-label': 'Global workspace search',
            autoComplete: 'off',
            spellCheck: false,
          }}
          sx={{
            width: '100%',
            minWidth: 0,
            color: isHeader ? 'common.white' : 'text.primary',
            fontSize: isHeader ? { xs: 12.5, sm: 13.2 } : { xs: 14, sm: 15 },
            fontWeight: 650,
            letterSpacing: '-.01em',
            '& input': { minWidth: 0, py: isHeader ? .85 : 1.1 },
            '& input::placeholder': { color: isHeader ? 'rgba(255,255,255,.70)' : 'text.secondary', opacity: 1 },
            '& input::-webkit-search-cancel-button': { display: 'none' },
          }}
        />
      </Box>

      {value && (
        <Tooltip title="Clear search">
          <IconButton
            type="button"
            size="small"
            aria-label="Clear search"
            onClick={clearSearch}
            sx={{
              flex: '0 0 auto',
              width: 30,
              height: 30,
              color: isHeader ? 'rgba(255,255,255,.76)' : 'text.secondary',
              '&:hover': { bgcolor: isHeader ? 'rgba(255,255,255,.14)' : 'action.hover' },
            }}
          >
            <CloseRounded sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      )}

      {isHeader && (
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            display: { xs: 'none', sm: 'inline-flex' },
            alignItems: 'center',
            gap: .35,
            flex: '0 0 auto',
            px: .65,
            py: .4,
            border: '1px solid rgba(255,255,255,.28)',
            borderRadius: 1.5,
            color: 'rgba(255,255,255,.78)',
            bgcolor: 'rgba(0,35,49,.13)',
            fontSize: 10,
            fontWeight: 850,
            lineHeight: 1,
            letterSpacing: '.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {isMac ? '⌘ K' : 'Ctrl K'}
        </Box>
      )}

      {isHeader ? (
        <Tooltip title={canSubmit ? 'Search workspace' : 'Type at least two characters'}>
          <span>
            <IconButton
              type="submit"
              size="small"
              aria-label="Search workspace"
              disabled={!canSubmit}
              sx={{
                width: 34,
                height: 34,
                flex: '0 0 auto',
                color: '#0B5270',
                bgcolor: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(2,31,43,.12)',
                '&:hover': { bgcolor: '#F0F8FA', boxShadow: '0 6px 16px rgba(2,31,43,.18)' },
                '&.Mui-disabled': { color: 'rgba(255,255,255,.38)', bgcolor: 'rgba(255,255,255,.10)', boxShadow: 'none' },
              }}
            >
              <ArrowForwardRounded sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Button
          type="submit"
          variant="contained"
          disabled={!canSubmit}
          disableElevation
          sx={{ minWidth: 92, height: 42, borderRadius: 2.2, px: 2.2, fontWeight: 800, flex: '0 0 auto' }}
        >
          Search
        </Button>
      )}
    </Box>
  );
}
