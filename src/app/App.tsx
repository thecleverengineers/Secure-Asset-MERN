import { Suspense, useEffect, useMemo, useState } from 'react';
import { RouterProvider } from 'react-router';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { ColorModeContext } from './context/ColorModeContext';
import { SiteProvider, useSite } from './context/SiteContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { normaliseDesignSystem, OPEN_SANS_FONT_FAMILY } from './designSystem';
import AppLoadingScreen from './components/shared/AppLoadingScreen';
import ApplicationErrorBoundary from './components/shared/ApplicationErrorBoundary';
import { WishlistProvider } from './context/WishlistContext';

const SHADOWS = {
  none: 'none',
  subtle: '0 4px 14px rgba(18, 34, 37, .07)',
  soft: '0 10px 30px rgba(18, 34, 37, .10)',
  raised: '0 16px 42px rgba(18, 34, 37, .15)',
  floating: '0 24px 80px rgba(18, 34, 37, .20)',
} as const;

const buttonTokenStyles = (token: any) => ({
  minHeight: token.height,
  minWidth: token.widthMode === 'fixed' ? token.minWidth || 120 : token.widthMode === 'full' ? '100%' : token.minWidth || undefined,
  padding: `${token.paddingY}px ${token.paddingX}px`,
  borderRadius: token.radius,
  fontSize: token.fontSize,
  fontWeight: token.fontWeight,
  color: token.text,
  borderColor: token.border,
  backgroundColor: token.background,
  ...(token.gradient ? { backgroundImage: token.gradient } : {}),
  boxShadow: token.shadow === 'soft' ? SHADOWS.soft : token.shadow === 'subtle' ? SHADOWS.subtle : 'none',
  '&:hover': { color: token.hoverText, backgroundColor: token.hoverBackground, borderColor: token.hoverBackground, ...(token.gradient ? { backgroundImage: token.gradient } : {}), transform: token.animation === 'lift' ? 'translateY(-1px)' : token.animation === 'scale' ? 'scale(1.02)' : 'none', boxShadow: token.animation === 'glow' ? `0 0 0 4px ${token.focusRing}2B` : undefined },
  '&:active': { backgroundColor: token.activeBackground },
  '&:focus-visible': { outline: `3px solid ${token.focusRing}55`, outlineOffset: 2 },
  '&.Mui-disabled': { backgroundColor: token.disabledBackground, color: token.disabledText, borderColor: token.disabledBackground, opacity: 1 },
});

function ThemedApplication() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    // Storage can be disabled by privacy mode, embedded browsers, or a
    // restrictive document policy. Theme preference must never prevent the
    // application shell from rendering.
    try {
      return window.localStorage.getItem('sa_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const { data } = useSite();
  const brand = data.settings?.brand || {};
  const design = useMemo(() => normaliseDesignSystem(data.settings?.design), [data.settings?.design]);
  const colors = design.colors;
  const profileTheme = design.profiles.theme;
  const dark = mode === 'dark' || profileTheme === 'dark';
  const highContrast = profileTheme === 'high-contrast';
  const appBackground = highContrast ? '#000000' : dark ? '#0E171B' : colors.appBackground;
  const paper = highContrast ? '#111111' : dark ? '#152126' : colors.paper;
  const textPrimary = highContrast ? '#FFFFFF' : dark ? '#F4F8F7' : colors.textPrimary;
  const textSecondary = highContrast ? '#FFFFFF' : dark ? '#A9B7B8' : colors.textSecondary;
  const divider = highContrast ? '#FFFFFF' : dark ? '#27353A' : colors.border;
  const cardShadow = 'none';
  const elevatedCardShadow = dark && design.shadows.card !== 'none'
    ? '0 12px 34px rgba(0,0,0,.20)'
    : SHADOWS[design.shadows.card];
  const modalShadow = dark && design.shadows.modal !== 'none' ? '0 24px 80px rgba(0,0,0,.45)' : SHADOWS[design.shadows.modal];
  const navigationShadow = design.shadows.navigation === 'soft' ? SHADOWS.soft : design.shadows.navigation === 'subtle' ? SHADOWS.subtle : 'none';
  const buttonShadow = design.shadows.button === 'soft' ? SHADOWS.subtle : 'none';
  // Filled actions with white labels share the application-header treatment.
  // Keep this at the theme boundary so dynamically rendered buttons receive
  // the same visual language without every page duplicating button colors.
  const headerFilledButtonStyles = {
    backgroundColor: `${colors.navigation} !important`,
    backgroundImage: 'none !important',
    color: '#FFFFFF !important',
    borderColor: `${colors.navigation} !important`,
    '&:hover': {
      backgroundColor: `${colors.navigation} !important`,
      backgroundImage: 'none !important',
      borderColor: `${colors.navigation} !important`,
      filter: 'brightness(.9)',
    },
    '&:active': { filter: 'brightness(.82)' },
    '&.Mui-disabled': {
      backgroundColor: `${colors.navigation} !important`,
      backgroundImage: 'none !important',
      borderColor: `${colors.navigation} !important`,
      color: '#FFFFFF !important',
      opacity: .52,
    },
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    const variables: Record<string, string> = {
      '--sa-app-background': appBackground,
      '--sa-paper': paper,
      '--sa-text-primary': textPrimary,
      '--sa-text-secondary': textSecondary,
      '--sa-border': divider,
      '--sa-navigation': colors.navigation,
      '--sa-navigation-text': colors.navigationText,
      '--sa-primary': colors.primary,
      '--sa-icon': colors.icon,
      '--sa-card-radius': `${design.borders.cardRadius}px`,
      '--sa-button-radius': `${design.borders.buttonRadius}px`,
      '--sa-input-radius': `${design.borders.inputRadius}px`,
      '--sa-navigation-radius': `${design.borders.navigationRadius}px`,
      '--sa-modal-radius': `${design.borders.modalRadius}px`,
      '--sa-content-max-width': `${design.layout.contentMaxWidth}px`,
      '--sa-bottom-appbar-background': colors.paper,
      '--sa-bottom-appbar-height': `${design.bottomAppBar.height}px`,
      '--sa-motion-duration': `${design.motion.duration}ms`,
      '--sa-motion-easing': design.motion.easing === 'spring' ? 'cubic-bezier(.2,.9,.2,1)' : design.motion.easing === 'emphasized' ? 'cubic-bezier(.2,.8,.2,1)' : 'ease',
      '--sa-brand-primary': design.branding.primary,
      '--sa-brand-accent': design.branding.accent,
    };
    Object.entries(variables).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
  }, [appBackground, colors.icon, colors.navigation, colors.navigationText, colors.primary, dark, design, divider, paper, textPrimary, textSecondary]);

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: colors.primary || brand.primaryColor || '#0B5270', dark: '#083C51', light: '#2E718C', contrastText: '#FFFFFF' },
      secondary: { main: colors.secondary || brand.secondaryColor || '#E46F4F', dark: '#B84F36', light: '#F4A18A', contrastText: '#FFFFFF' },
      success: { main: colors.success || brand.accentColor || '#238062', dark: '#15614A', light: '#54A98D', contrastText: '#FFFFFF' },
      warning: { main: '#B7791F', dark: '#8C5A11', light: '#D69E47' },
      error: { main: colors.danger, dark: '#A12D2D', light: '#E77B7B' },
      background: { default: appBackground, paper }, text: { primary: textPrimary, secondary: textSecondary }, divider,
      action: { hover: dark ? 'rgba(255,255,255,.055)' : `${colors.primary}0E`, selected: dark ? 'rgba(255,255,255,.09)' : `${colors.primary}17`, focus: dark ? 'rgba(255,255,255,.12)' : `${colors.primary}20` },
    },
    shape: { borderRadius: design.borders.cardRadius },
    typography: {
      fontFamily: OPEN_SANS_FONT_FAMILY, fontSize: design.typography.baseSize,
      fontWeightLight: 400, fontWeightRegular: 400, fontWeightMedium: 400, fontWeightBold: 400,
      h1: { fontSize: '2.375rem', fontWeight: 400, letterSpacing: 'normal', lineHeight: 1.08 },
      h2: { fontSize: '1.875rem', fontWeight: 400, letterSpacing: 'normal', lineHeight: 1.15 },
      h3: { fontSize: '1.5625rem', fontWeight: 400, letterSpacing: 'normal', lineHeight: 1.2 },
      h4: { fontSize: '1.375rem', fontWeight: 400, letterSpacing: 'normal', lineHeight: 1.25 },
      h5: { fontSize: '1.125rem', fontWeight: 400, letterSpacing: 'normal', lineHeight: 1.35 },
      h6: { fontSize: '1rem', fontWeight: 400, letterSpacing: 'normal', lineHeight: 1.4 },
      body1: { fontSize: '1rem', lineHeight: 1.5 }, body2: { fontSize: '.875rem', lineHeight: 1.5 },
      subtitle1: { fontWeight: 400 }, button: { textTransform: 'none', fontWeight: 400, letterSpacing: 'normal' },
    },
    components: {
      MuiCssBaseline: { styleOverrides: {
        html: { backgroundColor: appBackground, scrollBehavior: 'smooth', fontFamily: OPEN_SANS_FONT_FAMILY },
        body: { minWidth: 320, lineHeight: design.typography.lineHeight, fontFamily: OPEN_SANS_FONT_FAMILY, color: textPrimary },
        'body, body *': { fontFamily: `${OPEN_SANS_FONT_FAMILY} !important` },
        '::selection': { backgroundColor: dark ? `${colors.secondary}59` : `${colors.primary}2E` },
        ':focus-visible': { outline: `3px solid ${colors.primary}4D`, outlineOffset: 3 },
        '@media (prefers-reduced-motion: reduce)': { '*, *::before, *::after': { animationDuration: '0.01ms !important', animationIterationCount: '1 !important', transitionDuration: '0.01ms !important', scrollBehavior: 'auto !important' } },
      } },
      MuiButton: { styleOverrides: { root: {
        borderRadius: design.borders.buttonRadius, boxShadow: buttonShadow, minHeight: design.effects.buttonHeight, paddingInline: 17, fontWeight: 400,
        transition: 'transform .18s ease, box-shadow .18s ease, background-color .18s ease, border-color .18s ease',
        '&.sa-primary-button': buttonTokenStyles(design.buttons.primary),
        '&.sa-secondary-button': buttonTokenStyles(design.buttons.secondary),
        '&.sa-outlined-button': buttonTokenStyles(design.buttons.outlined),
        '&.sa-submit-button': buttonTokenStyles(design.buttons.submit),
        '&.sa-edit-button': buttonTokenStyles(design.buttons.edit),
        '&.sa-accept-button': buttonTokenStyles(design.buttons.accept),
        '&.sa-danger-button': buttonTokenStyles(design.buttons.danger),
        '&.MuiButton-contained:not(.sa-light-button), &.sa-primary-button:not(.MuiButton-outlined):not(.sa-light-button), &.sa-secondary-button:not(.MuiButton-outlined):not(.sa-light-button), &.sa-submit-button:not(.MuiButton-outlined):not(.sa-light-button), &.sa-edit-button:not(.MuiButton-outlined):not(.sa-light-button), &.sa-accept-button:not(.MuiButton-outlined):not(.sa-light-button), &.sa-danger-button:not(.MuiButton-outlined):not(.sa-light-button)': headerFilledButtonStyles,
      }, contained: { boxShadow: buttonShadow, '&:hover': design.effects.enableHoverLift ? { boxShadow: design.shadows.button === 'none' ? 'none' : SHADOWS.soft, transform: 'translateY(-1px)' } : undefined }, outlined: { borderWidth: design.borders.width || 1, '&:hover': { borderWidth: design.borders.width || 1, backgroundColor: dark ? 'rgba(255,255,255,.06)' : `${colors.primary}0E` } } } },
      MuiIconButton: { styleOverrides: { root: { borderRadius: design.icons.rounded ? design.borders.buttonRadius : 0, color: colors.icon, transition: 'background-color .18s ease, transform .18s ease, box-shadow .18s ease', '&:hover': design.effects.enableHoverLift ? { transform: 'translateY(-1px)' } : undefined, '&.sa-edit-icon-button': { color: colors.edit, backgroundColor: `${colors.edit}1A`, '&:hover': { color: '#FFFFFF', backgroundColor: colors.edit } } } } },
      MuiSvgIcon: { styleOverrides: { root: { fontSize: design.icons.size } } },
      MuiTextField: { defaultProps: { variant: 'outlined' } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: design.borders.inputRadius, backgroundColor: dark ? '#19262C' : colors.paper, transition: 'box-shadow .16s ease, border-color .16s ease', '& .MuiOutlinedInput-notchedOutline': { borderColor: dark ? '#34454B' : divider, borderWidth: design.borders.width || 1, borderStyle: design.borders.style }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: dark ? '#5A7376' : '#A5B8B4' }, '&.Mui-focused': { boxShadow: dark ? `0 0 0 3px ${colors.success}29` : `0 0 0 3px ${colors.primary}1A` } } } },
      MuiInputLabel: { styleOverrides: { root: { fontWeight: 650, fontSize: 13 } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 750, letterSpacing: '-.01em' }, sizeSmall: { height: 25, fontSize: 11.5 } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', borderRadius: design.borders.cardRadius, borderColor: divider } } },
      MuiCard: { styleOverrides: { root: { borderRadius: design.borders.cardRadius, backgroundImage: 'none', overflow: 'hidden', boxShadow: elevatedCardShadow, border: `${design.borders.width}px ${design.borders.style} ${divider}`, transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease', '&.sa-interactive-card:hover': { transform: 'translateY(-3px)', boxShadow: dark ? '0 18px 42px rgba(0,0,0,.26)' : SHADOWS.soft, borderColor: `${colors.primary}52` } } } },
      MuiTableContainer: { styleOverrides: { root: { borderRadius: design.borders.cardRadius, boxShadow: cardShadow } } },
      MuiTableHead: { styleOverrides: { root: { backgroundColor: dark ? '#1A292E' : '#F7F9F7' } } },
      MuiTableCell: { styleOverrides: { head: { color: dark ? '#AFC0C2' : '#587074', fontSize: 11.5, fontWeight: 820, letterSpacing: '.035em', textTransform: 'uppercase', borderBottomColor: divider }, root: { borderBottomColor: dark ? '#243338' : '#EEF0EE', paddingTop: design.layout.density === 'compact' ? 10 : 14, paddingBottom: design.layout.density === 'compact' ? 10 : 14 } } },
      MuiTableRow: { styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: dark ? 'rgba(255,255,255,.035)' : `${colors.primary}09` } } } },
      MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3 } } },
      MuiTab: { styleOverrides: { root: { minHeight: 52, fontWeight: 750, textTransform: 'none' } } },
      MuiAppBar: { styleOverrides: { root: { borderRadius: 0, backgroundColor: colors.navigation, color: colors.navigationText, boxShadow: navigationShadow } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: design.borders.modalRadius, border: `${design.borders.modalBorderWidth}px ${design.borders.style} ${divider}`, boxShadow: modalShadow } } },
      MuiDialogTitle: { styleOverrides: { root: { backgroundColor: colors.navigation, color: colors.navigationText, fontWeight: 900 } } },
      MuiDialogActions: { styleOverrides: { root: { '& > .MuiButton-text:first-of-type': { color: colors.danger } } } },
      MuiPopover: { styleOverrides: { paper: { borderRadius: design.borders.navigationRadius, boxShadow: navigationShadow || SHADOWS.soft } } },
      MuiDrawer: { styleOverrides: { paper: { borderRadius: 0 } } },
      MuiAutocomplete: { styleOverrides: { paper: { borderRadius: design.borders.navigationRadius } } },
      MuiMenu: { styleOverrides: { paper: { borderRadius: design.borders.navigationRadius, border: `${design.borders.width}px ${design.borders.style} ${divider}`, boxShadow: navigationShadow || SHADOWS.raised } } },
      MuiMenuItem: { styleOverrides: { root: { borderRadius: design.borders.navigationRadius, marginInline: 5, marginBlock: 2, fontSize: 13.5, fontWeight: 650 } } },
      MuiListItemButton: { styleOverrides: { root: { borderRadius: design.borders.navigationRadius } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 999, backgroundColor: dark ? '#26383D' : '#E9EFEC' }, bar: { borderRadius: 999 } } },
      MuiToggleButton: { styleOverrides: { root: { borderRadius: design.borders.buttonRadius, textTransform: 'none', fontWeight: 720, borderColor: dark ? '#34454B' : '#DCE3DE', '&.Mui-selected': { backgroundColor: dark ? `${colors.success}29` : `${colors.primary}1A` } } } },
      MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 9, padding: '7px 10px', fontSize: 11.5, fontWeight: 650, boxShadow: SHADOWS.subtle } } },
      MuiSkeleton: { defaultProps: { animation: 'wave' } },
    },
  }), [appBackground, brand.primaryColor, brand.secondaryColor, brand.accentColor, buttonShadow, cardShadow, colors, dark, design, divider, elevatedCardShadow, modalShadow, mode, navigationShadow, paper, textPrimary, textSecondary]);
  const colorMode = useMemo(() => ({ mode, toggle: () => setMode((current) => {
    const next = current === 'light' ? 'dark' : 'light';
    try { window.localStorage.setItem('sa_theme', next); } catch { /* preference storage is optional */ }
    return next;
  }) }), [mode]);
  return <ColorModeContext.Provider value={colorMode}><ThemeProvider theme={theme}><CssBaseline /><AuthProvider><WishlistProvider><RealtimeProvider><Suspense fallback={<AppLoadingScreen label="Loading the requested page…" />}><ApplicationErrorBoundary><RouterProvider router={router} /></ApplicationErrorBoundary></Suspense></RealtimeProvider></WishlistProvider></AuthProvider></ThemeProvider></ColorModeContext.Provider>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><SiteProvider><ThemedApplication /></SiteProvider></QueryClientProvider>;
}
