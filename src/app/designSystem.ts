export type ButtonToken = {
  background: string;
  text: string;
  border: string;
  hoverBackground: string;
  hoverText: string;
  activeBackground: string;
  disabledBackground: string;
  disabledText: string;
  focusRing: string;
  gradient: string;
  widthMode: 'auto' | 'fixed' | 'full';
  minWidth: number;
  height: number;
  paddingX: number;
  paddingY: number;
  iconGap: number;
  radius: number;
  fontSize: number;
  fontWeight: number;
  shadow: 'none' | 'subtle' | 'soft';
  iconPosition: 'start' | 'end';
  animation: 'none' | 'lift' | 'scale' | 'glow';
};

export type NavigationDesignItem = {
  key: string;
  label: string;
  path: string;
  icon: string;
  section: string;
  order: number;
  enabled: boolean;
  mobilePrimary: boolean;
  placement: 'sidebar' | 'header' | 'bottom' | 'both';
  badge: string;
  roles: string[];
  loginRequired: boolean;
  external: boolean;
  parentKey: string;
};

export type PageDesignToken = {
  key: string;
  label: string;
  path: string;
  enabled: boolean;
  background: string;
  surface: string;
  headerVariant: 'default' | 'minimal' | 'hero';
  footerVariant: 'default' | 'minimal' | 'hidden';
  maxWidth: number;
  padding: number;
  cardRadius: number;
  buttonRadius: number;
  density: 'compact' | 'comfortable' | 'spacious';
  desktop: { columns: number; gap: number; padding: number };
  tablet: { columns: number; gap: number; padding: number };
  mobile: { columns: number; gap: number; padding: number };
};
export type IconAssetMap = Record<string, string>;

export type ComponentVariantToken = { key: string; background: string; text: string; border: string; opacity: number; scale: number };
export type ComponentMasterToken = { enabled: boolean; radius: number; height: number; padding: number; shadow: 'none' | 'subtle' | 'soft'; variants: ComponentVariantToken[] };
export type CanvasLayerStyleToken = {
  backgroundColor: string;
  backgroundImage: string;
  overlayColor: string;
  opacity: number;
  color: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: 'none' | 'solid' | 'dashed' | 'dotted';
  borderRadius: number;
  boxShadow: 'none' | 'subtle' | 'soft' | 'raised' | 'floating';
  padding: number;
  margin: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textAlign: 'left' | 'center' | 'right';
  display: 'block' | 'flex' | 'grid';
  flexDirection: 'row' | 'column';
  justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  gap: number;
  widthMode: 'fixed' | 'auto' | 'fill';
  heightMode: 'fixed' | 'auto' | 'fill';
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  position: 'absolute' | 'relative' | 'fixed' | 'sticky';
  overflow: 'visible' | 'hidden' | 'clip';
  objectFit: 'cover' | 'contain' | 'fill';
  objectPosition: 'center' | 'top' | 'right' | 'bottom' | 'left';
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
  frame: 'none' | 'section' | 'card' | 'modal' | 'toolbar';
  erased: boolean;
};
export type CanvasLayerToken = { id: string; pageKey: string; type: string; label: string; x: number; y: number; width: number; height: number; zIndex: number; visible: boolean; locked: boolean; parentId: string; component: string; dataBinding: string; interaction: string; style: CanvasLayerStyleToken };

export const OPEN_SANS_FONT_NAME = 'Open Sans';
export const OPEN_SANS_FONT_FAMILY = '"Open Sans", Arial, sans-serif';

export const DEFAULT_CANVAS_LAYER_STYLE: CanvasLayerStyleToken = {
  backgroundColor: '#FFFFFF', backgroundImage: '', overlayColor: '', opacity: 1, color: '#152225', borderColor: '#E6E9E6',
  borderWidth: 1, borderStyle: 'solid', borderRadius: 12, boxShadow: 'subtle', padding: 16, margin: 0, fontSize: 14,
  fontFamily: OPEN_SANS_FONT_NAME, fontWeight: 700, textAlign: 'left', display: 'flex', flexDirection: 'column',
  justifyContent: 'center', alignItems: 'stretch', gap: 8, widthMode: 'fixed', heightMode: 'fixed', minWidth: 0, maxWidth: 1920,
  minHeight: 0, maxHeight: 1200, position: 'absolute', overflow: 'hidden', objectFit: 'cover', objectPosition: 'center',
  cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0, frame: 'card', erased: false,
};

export type DesignSystem = {
  preset: string;
  colors: Record<string, string>;
  typography: { fontFamily: string; baseSize: number; headingWeight: number; lineHeight: number };
  layout: { density: 'compact' | 'comfortable' | 'spacious'; contentMaxWidth: number; appBarHeight: number; sidebarWidth: number; collapsedSidebarWidth: number; pagePadding: number; mobilePagePadding: number };
  borders: { width: number; style: 'solid' | 'dashed' | 'dotted'; cardRadius: number; buttonRadius: number; inputRadius: number; navigationRadius: number; modalRadius: number; modalBorderWidth: number };
  shadows: { card: 'none' | 'subtle' | 'soft' | 'raised' | 'floating'; modal: 'none' | 'soft' | 'raised' | 'floating'; navigation: 'none' | 'subtle' | 'soft'; button: 'none' | 'subtle' | 'soft' };
  icons: { size: number; navSize: number; color: string; rounded: boolean };
  effects: { enableHoverLift: boolean; enableGlassNavigation: boolean; cardPadding: number; buttonHeight: number };
  branding: { primary: string; secondary: string; accent: string; logoUrl: string; logoLightUrl: string; faviconUrl: string; fontFamily: string };
  buttons: Record<'primary' | 'secondary' | 'submit' | 'edit' | 'accept' | 'danger' | 'outlined', ButtonToken>;
  bottomAppBar: { enabled: boolean; background: string; textColor: string; activeColor: string; inactiveColor: string; indicatorColor: string; activeIndicator: 'pill' | 'line' | 'none'; height: number; iconSize: number; labelSize: number; itemGap: number; radius: number; shadow: 'none' | 'subtle' | 'soft' | 'floating'; blur: number; opacity: number; position: 'fixed' | 'floating'; safeArea: number; desktopVisible: boolean; mobileVisible: boolean };
  iconLibrary: { style: 'outline' | 'filled' | 'rounded' | 'sharp' | 'two-tone'; tone: 'monochrome' | 'colorful'; defaultColor: string; size: number; strokeWidth: number; opacity: number; favorites: string[]; recent: string[] };
  iconAssets: { globalShare: string; bottomAppBar: IconAssetMap; quickAccess: IconAssetMap };
  navigation: NavigationDesignItem[];
  pageDesigns: PageDesignToken[];
  componentLibrary: Record<string, ComponentMasterToken>;
  profiles: { public: string; authentication: string; dashboard: string; admin: string; theme: 'light' | 'dark' | 'high-contrast' | 'campaign' };
  motion: { duration: number; easing: 'standard' | 'emphasized' | 'spring'; reducedMotion: boolean; gridSpacing: number; zIndexBase: number };
  canvas: { snapToGrid: boolean; rulers: boolean; guides: boolean; gridSize: number; zoom: number; layers: CanvasLayerToken[] };
};

export const DEFAULT_DESIGN_SYSTEM: DesignSystem = {
  preset: 'secureasset',
  colors: {
    appBackground: '#F7F7F5', paper: '#FFFFFF', textPrimary: '#152225', textSecondary: '#68777A', border: '#E6E9E6',
    navigation: '#0B5270', navigationText: '#FFFFFF', primary: '#0B5270', secondary: '#E46F4F', success: '#238062',
    submit: '#66752D', edit: '#D97706', danger: '#C74343', icon: '#0B5270',
  },
  typography: { fontFamily: OPEN_SANS_FONT_NAME, baseSize: 14, headingWeight: 850, lineHeight: 1.5 },
  layout: { density: 'comfortable', contentMaxWidth: 1580, appBarHeight: 76, sidebarWidth: 286, collapsedSidebarWidth: 86, pagePadding: 32, mobilePagePadding: 16 },
  borders: { width: 1, style: 'solid', cardRadius: 18, buttonRadius: 12, inputRadius: 13, navigationRadius: 12, modalRadius: 0, modalBorderWidth: 0 },
  shadows: { card: 'none', modal: 'floating', navigation: 'none', button: 'subtle' },
  icons: { size: 20, navSize: 18, color: '#0B5270', rounded: true },
  effects: { enableHoverLift: true, enableGlassNavigation: true, cardPadding: 24, buttonHeight: 40 },
  branding: { primary: '#0B5270', secondary: '#0F172A', accent: '#238062', logoUrl: '', logoLightUrl: '', faviconUrl: '', fontFamily: OPEN_SANS_FONT_NAME },
  buttons: {
    primary: { background: '#0B5270', text: '#FFFFFF', border: '#0B5270', hoverBackground: '#083C51', hoverText: '#FFFFFF', activeBackground: '#062F40', disabledBackground: '#B9C7C9', disabledText: '#6C7B7E', focusRing: '#0B5270', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 780, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    secondary: { background: '#E46F4F', text: '#FFFFFF', border: '#E46F4F', hoverBackground: '#B84F36', hoverText: '#FFFFFF', activeBackground: '#963D2B', disabledBackground: '#D8B4AA', disabledText: '#81594F', focusRing: '#E46F4F', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 780, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    submit: { background: '#66752D', text: '#FFFFFF', border: '#66752D', hoverBackground: '#4F5B22', hoverText: '#FFFFFF', activeBackground: '#3C451A', disabledBackground: '#C8CDB1', disabledText: '#687044', focusRing: '#66752D', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 800, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    edit: { background: '#D97706', text: '#FFFFFF', border: '#D97706', hoverBackground: '#B45309', hoverText: '#FFFFFF', activeBackground: '#92400E', disabledBackground: '#E6C39A', disabledText: '#8A6A43', focusRing: '#D97706', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 800, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    accept: { background: '#238062', text: '#FFFFFF', border: '#238062', hoverBackground: '#15614A', hoverText: '#FFFFFF', activeBackground: '#104A39', disabledBackground: '#B4CEC5', disabledText: '#5F796F', focusRing: '#238062', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 800, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    danger: { background: '#C74343', text: '#FFFFFF', border: '#C74343', hoverBackground: '#A12D2D', hoverText: '#FFFFFF', activeBackground: '#7E2222', disabledBackground: '#E1B6B6', disabledText: '#875F5F', focusRing: '#C74343', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 800, shadow: 'subtle', iconPosition: 'start', animation: 'lift' },
    outlined: { background: '#FFFFFF', text: '#0B5270', border: '#0B5270', hoverBackground: '#EAF2F4', hoverText: '#083C51', activeBackground: '#D6E6EB', disabledBackground: '#F0F3F3', disabledText: '#8A999C', focusRing: '#0B5270', gradient: '', widthMode: 'auto', minWidth: 0, height: 40, paddingX: 16, paddingY: 9, iconGap: 8, radius: 12, fontSize: 13, fontWeight: 780, shadow: 'none', iconPosition: 'start', animation: 'none' },
  },
  bottomAppBar: { enabled: true, background: '#FFFFFF', textColor: '#68777A', activeColor: '#0B5270', inactiveColor: '#68777A', indicatorColor: '#0B5270', activeIndicator: 'line', height: 66, iconSize: 22, labelSize: 10.5, itemGap: 2, radius: 0, shadow: 'soft', blur: 12, opacity: 0.96, position: 'fixed', safeArea: 12, desktopVisible: false, mobileVisible: true },
  iconLibrary: { style: 'rounded', tone: 'monochrome', defaultColor: '#0B5270', size: 20, strokeWidth: 1.8, opacity: 1, favorites: [], recent: [] },
  iconAssets: { globalShare: '', bottomAppBar: {}, quickAccess: {} },
  navigation: [],
  pageDesigns: [],
  componentLibrary: Object.fromEntries(['button', 'card', 'input', 'modal', 'alert', 'table', 'header', 'sidebar', 'bottom-app-bar', 'tabs', 'dropdown', 'badge', 'profile', 'empty-state', 'loading'].map((key) => [key, { enabled: true, radius: 12, height: 40, padding: 16, shadow: 'none', variants: [] }])),
  profiles: { public: 'secureasset', authentication: 'secureasset', dashboard: 'secureasset', admin: 'secureasset', theme: 'light' },
  motion: { duration: 160, easing: 'standard', reducedMotion: false, gridSpacing: 8, zIndexBase: 1000 },
  canvas: { snapToGrid: true, rulers: true, guides: true, gridSize: 8, zoom: 1, layers: [] },
};

const colorPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const gradientPattern = /^(?:linear|radial)-gradient\([#0-9a-fA-F(),.%\s-]+\)$/;
const number = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback;
};
const decimal = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
const color = (value: unknown, fallback: string) => {
  if (typeof value !== 'string' || !colorPattern.test(value.trim())) return fallback;
  const token = value.trim();
  return token.length === 4 ? `#${token.slice(1).split('').map((part) => `${part}${part}`).join('')}` : token;
};
const imageAsset = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const token = value.trim();
  return token.length <= 500 && (!token || /^(?:https?:\/\/|\/)/i.test(token)) ? token : fallback;
};
const gradient = (value: unknown, fallback: string) => typeof value === 'string' && value.length <= 240 && (!value || gradientPattern.test(value.trim())) ? value.trim() : fallback;
const option = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) => allowed.includes(value as T) ? value as T : fallback;

export function normaliseDesignSystem(input?: Record<string, any> | null): DesignSystem {
  const source = input || {};
  const colors = source.colors || {};
  const typography = source.typography || {};
  const layout = source.layout || {};
  const borders = source.borders || {};
  const shadows = source.shadows || {};
  const icons = source.icons || {};
  const effects = source.effects || {};
  const branding = source.branding || {};
  const defaultButton = DEFAULT_DESIGN_SYSTEM.buttons.primary;
  const buttonSource = source.buttons || {};
  const buttonKeys = ['primary', 'secondary', 'submit', 'edit', 'accept', 'danger', 'outlined'] as const;
  const normaliseButton = (value: any, fallback: ButtonToken): ButtonToken => ({
    ...fallback,
    ...(value || {}),
    background: color(value?.background, fallback.background), text: color(value?.text, fallback.text), border: color(value?.border, fallback.border),
    hoverBackground: color(value?.hoverBackground, fallback.hoverBackground), hoverText: color(value?.hoverText, fallback.hoverText), activeBackground: color(value?.activeBackground, fallback.activeBackground),
    disabledBackground: color(value?.disabledBackground, fallback.disabledBackground), disabledText: color(value?.disabledText, fallback.disabledText), focusRing: color(value?.focusRing, fallback.focusRing),
    gradient: gradient(value?.gradient, fallback.gradient),
    widthMode: option(value?.widthMode, ['auto', 'fixed', 'full'] as const, fallback.widthMode), minWidth: number(value?.minWidth, fallback.minWidth, 0, 640), height: number(value?.height, fallback.height, 28, 88),
    paddingX: number(value?.paddingX, fallback.paddingX, 0, 48), paddingY: number(value?.paddingY, fallback.paddingY, 0, 32), iconGap: number(value?.iconGap, fallback.iconGap, 0, 24), radius: number(value?.radius, fallback.radius, 0, 40),
    fontSize: number(value?.fontSize, fallback.fontSize, 10, 24), fontWeight: number(value?.fontWeight, fallback.fontWeight, 400, 900), shadow: option(value?.shadow, ['none', 'subtle', 'soft'] as const, fallback.shadow),
    iconPosition: option(value?.iconPosition, ['start', 'end'] as const, fallback.iconPosition), animation: option(value?.animation, ['none', 'lift', 'scale', 'glow'] as const, fallback.animation),
  });
  const navigation = Array.isArray(source.navigation) ? source.navigation.slice(0, 120).map((entry: any, index: number) => ({
    key: typeof entry?.key === 'string' ? entry.key.slice(0, 64) : `custom-${index + 1}`, label: typeof entry?.label === 'string' ? entry.label.slice(0, 80) : `Menu item ${index + 1}`,
    path: typeof entry?.path === 'string' ? entry.path.slice(0, 240) : '/app/dashboard', icon: typeof entry?.icon === 'string' ? entry.icon.slice(0, 80) : 'DashboardRounded',
    section: typeof entry?.section === 'string' ? entry.section.slice(0, 48) : 'workspace', order: number(entry?.order, index * 10, 0, 9999), enabled: entry?.enabled !== false,
    mobilePrimary: Boolean(entry?.mobilePrimary), placement: option(entry?.placement, ['sidebar', 'header', 'bottom', 'both'] as const, 'sidebar'), badge: typeof entry?.badge === 'string' ? entry.badge.slice(0, 24) : '',
    roles: Array.isArray(entry?.roles) ? entry.roles.filter((role: any) => typeof role === 'string').slice(0, 8) : [], loginRequired: entry?.loginRequired !== false, external: Boolean(entry?.external), parentKey: typeof entry?.parentKey === 'string' ? entry.parentKey.slice(0, 64) : '',
  })) : [];
  const pageDesigns = Array.isArray(source.pageDesigns) ? source.pageDesigns.slice(0, 400).map((page: any, index: number): PageDesignToken => ({
    key: typeof page?.key === 'string' ? page.key.slice(0, 64) : `page-${index + 1}`, label: typeof page?.label === 'string' ? page.label.slice(0, 96) : `Page ${index + 1}`, path: typeof page?.path === 'string' ? page.path.slice(0, 240) : '/app/dashboard', enabled: page?.enabled !== false,
    background: color(page?.background, DEFAULT_DESIGN_SYSTEM.colors.appBackground), surface: color(page?.surface, DEFAULT_DESIGN_SYSTEM.colors.paper), headerVariant: option(page?.headerVariant, ['default', 'minimal', 'hero'] as const, 'default'), footerVariant: option(page?.footerVariant, ['default', 'minimal', 'hidden'] as const, 'default'),
    maxWidth: number(page?.maxWidth, DEFAULT_DESIGN_SYSTEM.layout.contentMaxWidth, 640, 1920), padding: number(page?.padding, DEFAULT_DESIGN_SYSTEM.layout.pagePadding, 0, 96), cardRadius: number(page?.cardRadius, DEFAULT_DESIGN_SYSTEM.borders.cardRadius, 0, 40), buttonRadius: number(page?.buttonRadius, DEFAULT_DESIGN_SYSTEM.borders.buttonRadius, 0, 40), density: option(page?.density, ['compact', 'comfortable', 'spacious'] as const, 'comfortable'),
    desktop: { columns: number(page?.desktop?.columns, 12, 1, 24), gap: number(page?.desktop?.gap, 24, 0, 96), padding: number(page?.desktop?.padding, 32, 0, 96) }, tablet: { columns: number(page?.tablet?.columns, 8, 1, 16), gap: number(page?.tablet?.gap, 20, 0, 72), padding: number(page?.tablet?.padding, 24, 0, 72) }, mobile: { columns: number(page?.mobile?.columns, 4, 1, 8), gap: number(page?.mobile?.gap, 16, 0, 48), padding: number(page?.mobile?.padding, 16, 0, 48) },
  })) : [];
  const componentLibrary = { ...DEFAULT_DESIGN_SYSTEM.componentLibrary, ...(source.componentLibrary || {}) } as Record<string, ComponentMasterToken>;
  Object.keys(componentLibrary).forEach((key) => { const value = componentLibrary[key] || {}; componentLibrary[key] = { enabled: value.enabled !== false, radius: number(value.radius, 12, 0, 40), height: number(value.height, 40, 20, 120), padding: number(value.padding, 16, 0, 64), shadow: option(value.shadow, ['none', 'subtle', 'soft'] as const, 'subtle'), variants: Array.isArray(value.variants) ? value.variants.slice(0, 12).map((variant: any, index: number) => ({ key: typeof variant?.key === 'string' ? variant.key.slice(0, 32) : `variant-${index + 1}`, background: color(variant?.background, DEFAULT_DESIGN_SYSTEM.colors.paper), text: color(variant?.text, DEFAULT_DESIGN_SYSTEM.colors.textPrimary), border: color(variant?.border, DEFAULT_DESIGN_SYSTEM.colors.border), opacity: decimal(variant?.opacity, 1, 0.2, 1), scale: decimal(variant?.scale, 1, 0.8, 1.2) })) : [] }; });
  const bottomAppBar = source.bottomAppBar || {};
  const iconLibrary = source.iconLibrary || {};
  const iconAssets = source.iconAssets || {};
  const normaliseAssetMap = (value: unknown): IconAssetMap => {
    const sourceMap = value instanceof Map ? Object.fromEntries(value.entries()) : (value && typeof value === 'object' ? value : {});
    return Object.fromEntries(Object.entries(sourceMap).slice(0, 48).map(([key, asset]) => [String(key).slice(0, 80), imageAsset(asset)]).filter(([, asset]) => asset));
  };
  const motion = source.motion || {};
  const canvas = source.canvas || {};
  const layers = Array.isArray(canvas.layers) ? canvas.layers.slice(0, 1600).map((layer: any, index: number): CanvasLayerToken => {
    const style = layer?.style || {};
    const styleOption = <T extends string>(value: unknown, allowed: readonly T[], fallback: T) => option(value, allowed, fallback);
    return {
      id: typeof layer?.id === 'string' ? layer.id.slice(0, 64) : `layer-${index + 1}`, pageKey: typeof layer?.pageKey === 'string' ? layer.pageKey.slice(0, 64) : 'dashboard',
      type: typeof layer?.type === 'string' ? layer.type.slice(0, 32) : 'component', label: typeof layer?.label === 'string' ? layer.label.slice(0, 96) : `Layer ${index + 1}`,
      x: number(layer?.x, 40, -2000, 4000), y: number(layer?.y, index * 60, -2000, 4000), width: number(layer?.width, 320, 40, 1920), height: number(layer?.height, 120, 24, 1200), zIndex: number(layer?.zIndex, index, 0, 9999),
      visible: layer?.visible !== false, locked: Boolean(layer?.locked), parentId: typeof layer?.parentId === 'string' ? layer.parentId.slice(0, 64) : '', component: typeof layer?.component === 'string' ? layer.component.slice(0, 64) : 'card',
      dataBinding: typeof layer?.dataBinding === 'string' ? layer.dataBinding.slice(0, 160) : '', interaction: typeof layer?.interaction === 'string' ? layer.interaction.slice(0, 160) : '',
      style: {
        ...DEFAULT_CANVAS_LAYER_STYLE, ...style,
        backgroundColor: color(style.backgroundColor, DEFAULT_CANVAS_LAYER_STYLE.backgroundColor) === '#152225' && layer?.component === 'footer' ? '#0B5270' : color(style.backgroundColor, DEFAULT_CANVAS_LAYER_STYLE.backgroundColor), backgroundImage: imageAsset(style.backgroundImage), overlayColor: color(style.overlayColor, DEFAULT_CANVAS_LAYER_STYLE.overlayColor),
        opacity: decimal(style.opacity, 1, .2, 1), color: color(style.color, DEFAULT_CANVAS_LAYER_STYLE.color), borderColor: color(style.borderColor, DEFAULT_CANVAS_LAYER_STYLE.borderColor), borderWidth: number(style.borderWidth, 1, 0, 4),
        borderStyle: styleOption(style.borderStyle, ['none', 'solid', 'dashed', 'dotted'] as const, DEFAULT_CANVAS_LAYER_STYLE.borderStyle), borderRadius: number(style.borderRadius, 12, 0, 80),
        boxShadow: styleOption(style.boxShadow, ['none', 'subtle', 'soft', 'raised', 'floating'] as const, DEFAULT_CANVAS_LAYER_STYLE.boxShadow), padding: number(style.padding, 16, 0, 120), margin: number(style.margin, 0, -120, 120),
        fontSize: number(style.fontSize, 14, 10, 64), fontFamily: OPEN_SANS_FONT_NAME, fontWeight: number(style.fontWeight, 700, 400, 900),
        textAlign: styleOption(style.textAlign, ['left', 'center', 'right'] as const, DEFAULT_CANVAS_LAYER_STYLE.textAlign), display: styleOption(style.display, ['block', 'flex', 'grid'] as const, DEFAULT_CANVAS_LAYER_STYLE.display), flexDirection: styleOption(style.flexDirection, ['row', 'column'] as const, DEFAULT_CANVAS_LAYER_STYLE.flexDirection),
        justifyContent: styleOption(style.justifyContent, ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] as const, DEFAULT_CANVAS_LAYER_STYLE.justifyContent), alignItems: styleOption(style.alignItems, ['flex-start', 'center', 'flex-end', 'stretch'] as const, DEFAULT_CANVAS_LAYER_STYLE.alignItems), gap: number(style.gap, 8, 0, 96),
        widthMode: styleOption(style.widthMode, ['fixed', 'auto', 'fill'] as const, DEFAULT_CANVAS_LAYER_STYLE.widthMode), heightMode: styleOption(style.heightMode, ['fixed', 'auto', 'fill'] as const, DEFAULT_CANVAS_LAYER_STYLE.heightMode), minWidth: number(style.minWidth, 0, 0, 1920), maxWidth: number(style.maxWidth, 1920, 40, 1920), minHeight: number(style.minHeight, 0, 0, 1200), maxHeight: number(style.maxHeight, 1200, 24, 1200),
        position: styleOption(style.position, ['absolute', 'relative', 'fixed', 'sticky'] as const, DEFAULT_CANVAS_LAYER_STYLE.position), overflow: styleOption(style.overflow, ['visible', 'hidden', 'clip'] as const, DEFAULT_CANVAS_LAYER_STYLE.overflow), objectFit: styleOption(style.objectFit, ['cover', 'contain', 'fill'] as const, DEFAULT_CANVAS_LAYER_STYLE.objectFit), objectPosition: styleOption(style.objectPosition, ['center', 'top', 'right', 'bottom', 'left'] as const, DEFAULT_CANVAS_LAYER_STYLE.objectPosition),
        cropTop: number(style.cropTop, 0, 0, 100), cropRight: number(style.cropRight, 0, 0, 100), cropBottom: number(style.cropBottom, 0, 0, 100), cropLeft: number(style.cropLeft, 0, 0, 100), frame: styleOption(style.frame, ['none', 'section', 'card', 'modal', 'toolbar'] as const, DEFAULT_CANVAS_LAYER_STYLE.frame), erased: Boolean(style.erased),
      },
    };
  }) : [];
  return {
    preset: typeof source.preset === 'string' ? source.preset : DEFAULT_DESIGN_SYSTEM.preset,
    colors: Object.fromEntries(Object.entries(DEFAULT_DESIGN_SYSTEM.colors).map(([key, fallback]) => [key, color(colors[key], fallback)])),
    typography: {
      fontFamily: OPEN_SANS_FONT_NAME,
      baseSize: number(typography.baseSize, DEFAULT_DESIGN_SYSTEM.typography.baseSize, 12, 20),
      headingWeight: number(typography.headingWeight, DEFAULT_DESIGN_SYSTEM.typography.headingWeight, 600, 900),
      lineHeight: decimal(typography.lineHeight, DEFAULT_DESIGN_SYSTEM.typography.lineHeight, 1.2, 2),
    },
    layout: {
      density: option(layout.density, ['compact', 'comfortable', 'spacious'] as const, DEFAULT_DESIGN_SYSTEM.layout.density),
      contentMaxWidth: number(layout.contentMaxWidth, DEFAULT_DESIGN_SYSTEM.layout.contentMaxWidth, 960, 1920),
      appBarHeight: number(layout.appBarHeight, DEFAULT_DESIGN_SYSTEM.layout.appBarHeight, 56, 96),
      sidebarWidth: number(layout.sidebarWidth, DEFAULT_DESIGN_SYSTEM.layout.sidebarWidth, 220, 420),
      collapsedSidebarWidth: number(layout.collapsedSidebarWidth, DEFAULT_DESIGN_SYSTEM.layout.collapsedSidebarWidth, 64, 120),
      pagePadding: number(layout.pagePadding, DEFAULT_DESIGN_SYSTEM.layout.pagePadding, 12, 56),
      mobilePagePadding: number(layout.mobilePagePadding, DEFAULT_DESIGN_SYSTEM.layout.mobilePagePadding, 10, 32),
    },
    borders: {
      width: number(borders.width, DEFAULT_DESIGN_SYSTEM.borders.width, 0, 4),
      style: option(borders.style, ['solid', 'dashed', 'dotted'] as const, DEFAULT_DESIGN_SYSTEM.borders.style),
      cardRadius: number(borders.cardRadius, DEFAULT_DESIGN_SYSTEM.borders.cardRadius, 0, 40),
      buttonRadius: number(borders.buttonRadius, DEFAULT_DESIGN_SYSTEM.borders.buttonRadius, 0, 40),
      inputRadius: number(borders.inputRadius, DEFAULT_DESIGN_SYSTEM.borders.inputRadius, 0, 32),
      navigationRadius: number(borders.navigationRadius, DEFAULT_DESIGN_SYSTEM.borders.navigationRadius, 0, 32),
      modalRadius: number(borders.modalRadius, DEFAULT_DESIGN_SYSTEM.borders.modalRadius, 0, 32),
      modalBorderWidth: number(borders.modalBorderWidth, DEFAULT_DESIGN_SYSTEM.borders.modalBorderWidth, 0, 4),
    },
    shadows: {
      card: option(shadows.card, ['none', 'subtle', 'soft', 'raised', 'floating'] as const, DEFAULT_DESIGN_SYSTEM.shadows.card),
      modal: option(shadows.modal, ['none', 'soft', 'raised', 'floating'] as const, DEFAULT_DESIGN_SYSTEM.shadows.modal),
      navigation: option(shadows.navigation, ['none', 'subtle', 'soft'] as const, DEFAULT_DESIGN_SYSTEM.shadows.navigation),
      button: option(shadows.button, ['none', 'subtle', 'soft'] as const, DEFAULT_DESIGN_SYSTEM.shadows.button),
    },
    icons: {
      size: number(icons.size, DEFAULT_DESIGN_SYSTEM.icons.size, 14, 32),
      navSize: number(icons.navSize, DEFAULT_DESIGN_SYSTEM.icons.navSize, 14, 28),
      color: color(icons.color, DEFAULT_DESIGN_SYSTEM.icons.color),
      rounded: typeof icons.rounded === 'boolean' ? icons.rounded : DEFAULT_DESIGN_SYSTEM.icons.rounded,
    },
    effects: {
      enableHoverLift: typeof effects.enableHoverLift === 'boolean' ? effects.enableHoverLift : DEFAULT_DESIGN_SYSTEM.effects.enableHoverLift,
      enableGlassNavigation: typeof effects.enableGlassNavigation === 'boolean' ? effects.enableGlassNavigation : DEFAULT_DESIGN_SYSTEM.effects.enableGlassNavigation,
      cardPadding: number(effects.cardPadding, DEFAULT_DESIGN_SYSTEM.effects.cardPadding, 12, 48),
      buttonHeight: number(effects.buttonHeight, DEFAULT_DESIGN_SYSTEM.effects.buttonHeight, 32, 64),
    },
    branding: { primary: color(branding.primary, DEFAULT_DESIGN_SYSTEM.branding.primary), secondary: color(branding.secondary, DEFAULT_DESIGN_SYSTEM.branding.secondary), accent: color(branding.accent, DEFAULT_DESIGN_SYSTEM.branding.accent), logoUrl: typeof branding.logoUrl === 'string' ? branding.logoUrl.slice(0, 500) : '', logoLightUrl: typeof branding.logoLightUrl === 'string' ? branding.logoLightUrl.slice(0, 500) : '', faviconUrl: typeof branding.faviconUrl === 'string' ? branding.faviconUrl.slice(0, 500) : '', fontFamily: OPEN_SANS_FONT_NAME },
    buttons: Object.fromEntries(buttonKeys.map((key) => [key, normaliseButton(buttonSource[key], DEFAULT_DESIGN_SYSTEM.buttons[key] || defaultButton)])) as DesignSystem['buttons'],
    bottomAppBar: { enabled: bottomAppBar.enabled !== false, background: color(bottomAppBar.background, DEFAULT_DESIGN_SYSTEM.bottomAppBar.background), textColor: color(bottomAppBar.textColor, DEFAULT_DESIGN_SYSTEM.bottomAppBar.textColor), activeColor: color(bottomAppBar.activeColor, DEFAULT_DESIGN_SYSTEM.bottomAppBar.activeColor), inactiveColor: color(bottomAppBar.inactiveColor, DEFAULT_DESIGN_SYSTEM.bottomAppBar.inactiveColor), indicatorColor: color(bottomAppBar.indicatorColor, DEFAULT_DESIGN_SYSTEM.bottomAppBar.indicatorColor), activeIndicator: option(bottomAppBar.activeIndicator, ['pill', 'line', 'none'] as const, DEFAULT_DESIGN_SYSTEM.bottomAppBar.activeIndicator), height: number(bottomAppBar.height, DEFAULT_DESIGN_SYSTEM.bottomAppBar.height, 48, 104), iconSize: number(bottomAppBar.iconSize, DEFAULT_DESIGN_SYSTEM.bottomAppBar.iconSize, 14, 36), labelSize: number(bottomAppBar.labelSize, DEFAULT_DESIGN_SYSTEM.bottomAppBar.labelSize, 8, 16), itemGap: number(bottomAppBar.itemGap, DEFAULT_DESIGN_SYSTEM.bottomAppBar.itemGap, 0, 24), radius: number(bottomAppBar.radius, DEFAULT_DESIGN_SYSTEM.bottomAppBar.radius, 0, 40), shadow: option(bottomAppBar.shadow, ['none', 'subtle', 'soft', 'floating'] as const, DEFAULT_DESIGN_SYSTEM.bottomAppBar.shadow), blur: number(bottomAppBar.blur, DEFAULT_DESIGN_SYSTEM.bottomAppBar.blur, 0, 32), opacity: decimal(bottomAppBar.opacity, DEFAULT_DESIGN_SYSTEM.bottomAppBar.opacity, 0.5, 1), position: option(bottomAppBar.position, ['fixed', 'floating'] as const, DEFAULT_DESIGN_SYSTEM.bottomAppBar.position), safeArea: number(bottomAppBar.safeArea, DEFAULT_DESIGN_SYSTEM.bottomAppBar.safeArea, 0, 48), desktopVisible: Boolean(bottomAppBar.desktopVisible), mobileVisible: bottomAppBar.mobileVisible !== false },
    iconLibrary: { style: option(iconLibrary.style, ['outline', 'filled', 'rounded', 'sharp', 'two-tone'] as const, DEFAULT_DESIGN_SYSTEM.iconLibrary.style), tone: option(iconLibrary.tone, ['monochrome', 'colorful'] as const, DEFAULT_DESIGN_SYSTEM.iconLibrary.tone), defaultColor: color(iconLibrary.defaultColor, DEFAULT_DESIGN_SYSTEM.iconLibrary.defaultColor), size: number(iconLibrary.size, DEFAULT_DESIGN_SYSTEM.iconLibrary.size, 12, 64), strokeWidth: decimal(iconLibrary.strokeWidth, DEFAULT_DESIGN_SYSTEM.iconLibrary.strokeWidth, 0.5, 4), opacity: decimal(iconLibrary.opacity, DEFAULT_DESIGN_SYSTEM.iconLibrary.opacity, 0.2, 1), favorites: Array.isArray(iconLibrary.favorites) ? iconLibrary.favorites.filter((name: any) => typeof name === 'string').slice(0, 100) : [], recent: Array.isArray(iconLibrary.recent) ? iconLibrary.recent.filter((name: any) => typeof name === 'string').slice(0, 100) : [] },
    iconAssets: { globalShare: imageAsset(iconAssets.globalShare), bottomAppBar: normaliseAssetMap(iconAssets.bottomAppBar), quickAccess: normaliseAssetMap(iconAssets.quickAccess) },
    navigation, pageDesigns, componentLibrary,
    profiles: { public: typeof source.profiles?.public === 'string' ? source.profiles.public.slice(0, 48) : DEFAULT_DESIGN_SYSTEM.profiles.public, authentication: typeof source.profiles?.authentication === 'string' ? source.profiles.authentication.slice(0, 48) : DEFAULT_DESIGN_SYSTEM.profiles.authentication, dashboard: typeof source.profiles?.dashboard === 'string' ? source.profiles.dashboard.slice(0, 48) : DEFAULT_DESIGN_SYSTEM.profiles.dashboard, admin: typeof source.profiles?.admin === 'string' ? source.profiles.admin.slice(0, 48) : DEFAULT_DESIGN_SYSTEM.profiles.admin, theme: option(source.profiles?.theme, ['light', 'dark', 'high-contrast', 'campaign'] as const, DEFAULT_DESIGN_SYSTEM.profiles.theme) },
    motion: { duration: number(motion.duration, DEFAULT_DESIGN_SYSTEM.motion.duration, 0, 1200), easing: option(motion.easing, ['standard', 'emphasized', 'spring'] as const, DEFAULT_DESIGN_SYSTEM.motion.easing), reducedMotion: Boolean(motion.reducedMotion), gridSpacing: number(motion.gridSpacing, DEFAULT_DESIGN_SYSTEM.motion.gridSpacing, 2, 64), zIndexBase: number(motion.zIndexBase, DEFAULT_DESIGN_SYSTEM.motion.zIndexBase, 0, 10000) },
    canvas: { snapToGrid: canvas.snapToGrid !== false, rulers: canvas.rulers !== false, guides: canvas.guides !== false, gridSize: number(canvas.gridSize, DEFAULT_DESIGN_SYSTEM.canvas.gridSize, 2, 64), zoom: decimal(canvas.zoom, DEFAULT_DESIGN_SYSTEM.canvas.zoom, .25, 2), layers },
  };
}

/** Match exact routes and the small route-pattern vocabulary used by the
 * application (colon parameters and a trailing wildcard). Query strings are
 * intentionally ignored because page designs style the rendered route, not a
 * particular filter state. */
export function matchesDesignPath(pattern: string, pathname: string): boolean {
  const clean = (value: string) => String(value || '').split('?')[0].replace(/\/+$/, '') || '/';
  const expected = clean(pattern);
  const actual = clean(pathname);
  if (expected === actual) return true;
  const expectedParts = expected.split('/').filter(Boolean);
  const actualParts = actual.split('/').filter(Boolean);
  if (expectedParts.length !== actualParts.length && expectedParts.at(-1) !== '*') return false;
  return expectedParts.every((part, index) => part === '*' || part.startsWith(':') || part === actualParts[index]);
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export const DESIGN_PRESETS: Array<{ key: string; label: string; description: string; design: DesignSystem }> = [
  { key: 'secureasset', label: 'SecureAsset', description: 'Professional, calm and operational by default.', design: clone(DEFAULT_DESIGN_SYSTEM) },
  { key: 'midnight', label: 'Midnight', description: 'Deep navigation and tighter premium surfaces.', design: normaliseDesignSystem({ ...DEFAULT_DESIGN_SYSTEM, preset: 'midnight', colors: { ...DEFAULT_DESIGN_SYSTEM.colors, navigation: '#102A43', primary: '#102A43', secondary: '#E76F51', appBackground: '#F4F7FA', icon: '#102A43' }, borders: { ...DEFAULT_DESIGN_SYSTEM.borders, cardRadius: 12, buttonRadius: 10 }, shadows: { ...DEFAULT_DESIGN_SYSTEM.shadows, card: 'raised', navigation: 'soft' } }) },
  { key: 'editorial', label: 'Editorial', description: 'High-contrast typography with refined square surfaces.', design: normaliseDesignSystem({ ...DEFAULT_DESIGN_SYSTEM, preset: 'editorial', colors: { ...DEFAULT_DESIGN_SYSTEM.colors, navigation: '#263238', primary: '#263238', secondary: '#B85C38', submit: '#5D6D35', icon: '#263238' }, typography: { ...DEFAULT_DESIGN_SYSTEM.typography, fontFamily: OPEN_SANS_FONT_NAME, headingWeight: 900 }, borders: { ...DEFAULT_DESIGN_SYSTEM.borders, cardRadius: 4, buttonRadius: 4, inputRadius: 4, navigationRadius: 4 }, shadows: { ...DEFAULT_DESIGN_SYSTEM.shadows, card: 'none', button: 'none' } }) },
  { key: 'soft', label: 'Soft', description: 'Rounded, welcoming cards for a hospitality-forward brand.', design: normaliseDesignSystem({ ...DEFAULT_DESIGN_SYSTEM, preset: 'soft', colors: { ...DEFAULT_DESIGN_SYSTEM.colors, navigation: '#176B87', primary: '#176B87', secondary: '#F28C6B', appBackground: '#F8FAFC', icon: '#176B87' }, borders: { ...DEFAULT_DESIGN_SYSTEM.borders, cardRadius: 28, buttonRadius: 18, inputRadius: 16, navigationRadius: 16, modalRadius: 18 }, shadows: { ...DEFAULT_DESIGN_SYSTEM.shadows, card: 'floating', navigation: 'soft' } }) },
  { key: 'compact', label: 'Compact', description: 'Dense, efficient controls for high-volume operations.', design: normaliseDesignSystem({ ...DEFAULT_DESIGN_SYSTEM, preset: 'compact', typography: { ...DEFAULT_DESIGN_SYSTEM.typography, baseSize: 13 }, layout: { ...DEFAULT_DESIGN_SYSTEM.layout, density: 'compact', appBarHeight: 64, sidebarWidth: 254, pagePadding: 22 }, borders: { ...DEFAULT_DESIGN_SYSTEM.borders, cardRadius: 8, buttonRadius: 8, inputRadius: 8, navigationRadius: 8 }, effects: { ...DEFAULT_DESIGN_SYSTEM.effects, cardPadding: 18, buttonHeight: 36 } }) },
];

export function designPreset(key: string) {
  return clone(DESIGN_PRESETS.find((preset) => preset.key === key)?.design || DEFAULT_DESIGN_SYSTEM);
}
