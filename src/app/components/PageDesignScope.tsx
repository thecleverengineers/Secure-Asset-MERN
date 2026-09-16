import { useEffect, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useSite } from '../context/SiteContext';
import { matchesDesignPath, normaliseDesignSystem } from '../designSystem';

/**
 * Applies the published page token scope to routes that deliberately render
 * outside FrontLayout/AppShell (for example secure public-drive links).
 * It renders no UI and keeps the same bounded CSS-variable contract as the
 * two application shells.
 */
export default function PageDesignScope({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: { settings } } = useSite();
  const design = useMemo(() => normaliseDesignSystem(settings?.design), [settings?.design]);
  const pageDesign = design.pageDesigns.find((page) => page.enabled && matchesDesignPath(page.path, location.pathname));

  useEffect(() => {
    const root = document.documentElement;
    const values: Record<string, string> = {
      '--sa-page-background': pageDesign?.background || design.colors.appBackground,
      '--sa-page-surface': pageDesign?.surface || design.colors.paper,
      '--sa-page-max-width': `${pageDesign?.maxWidth || design.layout.contentMaxWidth}px`,
      '--sa-page-padding': `${pageDesign?.padding ?? design.layout.pagePadding}px`,
      '--sa-page-card-radius': `${pageDesign?.cardRadius ?? design.borders.cardRadius}px`,
      '--sa-page-button-radius': `${pageDesign?.buttonRadius ?? design.borders.buttonRadius}px`,
      '--sa-page-mobile-padding': `${pageDesign?.mobile.padding ?? design.layout.mobilePagePadding}px`,
      '--sa-page-tablet-padding': `${pageDesign?.tablet.padding ?? Math.max(design.layout.mobilePagePadding + 6, 20)}px`,
      '--sa-page-desktop-padding': `${pageDesign?.desktop.padding ?? design.layout.pagePadding}px`,
      '--sa-editor-grid-spacing': `${design.motion.gridSpacing}px`,
    };
    Object.entries(values).forEach(([key, value]) => root.style.setProperty(key, value));
    return () => Object.keys(values).forEach((key) => root.style.removeProperty(key));
  }, [design, pageDesign]);

  return <>{children}</>;
}
