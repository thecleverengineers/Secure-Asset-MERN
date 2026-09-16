const RESPONSIVE_WIDTHS = [320, 480, 640, 768, 1024, 1280, 1600] as const;

function parseUrl(source: string): URL | null {
  try {
    return new URL(source, 'https://secureasset.invalid');
  } catch {
    return null;
  }
}

export function supportsResponsiveImageTransform(source: string): boolean {
  const url = parseUrl(source);
  return Boolean(url && url.hostname === 'images.unsplash.com');
}

/**
 * Keep the image contract provider-aware. Unsplash can negotiate AVIF/WebP
 * and resize at the edge; private uploads are left untouched because their
 * signed URL and MIME type must remain authoritative.
 */
export function optimizedImageUrl(source: string, width: number, format: 'avif' | 'webp' | 'original' = 'webp'): string {
  if (!supportsResponsiveImageTransform(source) || format === 'original') return source;
  const url = parseUrl(source);
  if (!url) return source;
  url.searchParams.set('auto', 'format');
  url.searchParams.set('fit', 'crop');
  url.searchParams.set('w', String(Math.max(1, Math.round(width))));
  url.searchParams.set('q', '78');
  url.searchParams.set('fm', format);
  return url.toString();
}

export function responsiveImageSrcSet(source: string, format: 'avif' | 'webp' | 'original' = 'webp'): string {
  return RESPONSIVE_WIDTHS.map((width) => `${optimizedImageUrl(source, width, format)} ${width}w`).join(', ');
}

export { RESPONSIVE_WIDTHS };
