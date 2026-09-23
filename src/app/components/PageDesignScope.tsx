import { useEffect, useMemo, type ReactNode } from 'react';
import { useSite } from '../context/SiteContext';
import { normaliseDesignSystem } from '../designSystem';

/**
 * Applies the shared reference styling to routes that deliberately render
 * outside FrontLayout/AppShell (for example secure public-drive links).
 */
export default function PageDesignScope({ children }: { children: ReactNode }) {
  const { data: { settings } } = useSite();
  const design = useMemo(() => normaliseDesignSystem(settings?.design), [settings?.design]);

  useEffect(() => {
    const root = document.documentElement;
    const values: Record<string, string> = {
      '--sa-page-background': design.colors.appBackground,
      '--sa-page-surface': design.colors.paper,
      '--sa-page-max-width': `${design.layout.contentMaxWidth}px`,
      '--sa-page-padding': `${design.layout.pagePadding}px`,
      '--sa-page-card-radius': `${design.borders.cardRadius}px`,
      '--sa-page-button-radius': `${design.borders.buttonRadius}px`,
      '--sa-page-mobile-padding': `${design.layout.mobilePagePadding}px`,
      '--sa-page-tablet-padding': `${Math.max(design.layout.mobilePagePadding + 6, 20)}px`,
      '--sa-page-desktop-padding': `${design.layout.pagePadding}px`,
      '--sa-editor-grid-spacing': `${design.motion.gridSpacing}px`,
    };
    Object.entries(values).forEach(([key, value]) => root.style.setProperty(key, value));
    return () => Object.keys(values).forEach((key) => root.style.removeProperty(key));
  }, [design]);

  return <div className="sa-reference-content">{children}</div>;
}
