import type { ImgHTMLAttributes, CSSProperties } from 'react';
import { optimizedImageUrl, responsiveImageSrcSet, supportsResponsiveImageTransform } from '../../utils/optimizedImage';

type OptimizedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'width' | 'height' | 'loading'> & {
  src: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  loading?: 'eager' | 'lazy';
};

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  sizes = '100vw',
  priority = false,
  loading,
  style,
  ...props
}: OptimizedImageProps) {
  const transformable = supportsResponsiveImageTransform(src);
  const imageStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    ...style,
  };

  return (
    <picture style={{ display: 'block', width: '100%', height: '100%' }}>
      {transformable && <source type="image/avif" srcSet={responsiveImageSrcSet(src, 'avif')} sizes={sizes} />}
      {transformable && <source type="image/webp" srcSet={responsiveImageSrcSet(src, 'webp')} sizes={sizes} />}
      <img
        {...props}
        src={transformable ? optimizedImageUrl(src, width, 'original') : src}
        srcSet={transformable ? responsiveImageSrcSet(src, 'webp') : undefined}
        sizes={transformable ? sizes : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={loading || (priority ? 'eager' : 'lazy')}
        decoding="async"
        style={imageStyle}
      />
    </picture>
  );
}
