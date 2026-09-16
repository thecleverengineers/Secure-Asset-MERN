const MAX_SCAN_DIMENSION = 3200;
const PNG_MIME_TYPE = 'image/png';
export const SCAN_ENHANCER_PROFILE = 'ai-document-premium-v1';

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

function percentile(histogram: Uint32Array, total: number, ratio: number) {
  const target = Math.max(0, Math.min(total - 1, Math.round(total * ratio)));
  let seen = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value];
    if (seen > target) return value;
  }
  return histogram.length - 1;
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function localBackground(canvas: HTMLCanvasElement, width: number, height: number) {
  const sampleCanvas = document.createElement('canvas');
  const sampleWidth = Math.max(32, Math.ceil(width / 24));
  const sampleHeight = Math.max(32, Math.ceil(height / 24));
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!sampleContext) return null;
  sampleContext.imageSmoothingEnabled = true;
  sampleContext.imageSmoothingQuality = 'high';
  try { sampleContext.filter = 'blur(2px)'; } catch { /* Older browsers still get the downsampled illumination map. */ }
  sampleContext.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
  return { data: sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data, width: sampleWidth, height: sampleHeight };
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
    } catch {
      // Fall through to the Image decoder for browsers that cannot create a bitmap
      // from a camera File object.
    }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The captured document image could not be read'));
      image.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, dispose: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    // PNG is lossless, so the cleaned scan keeps the original document detail
    // without adding another JPEG compression pass.
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The cleaned document image could not be created')), PNG_MIME_TYPE);
  });
}

/**
 * Cleans a camera page locally before it reaches the protected vault. The
 * routine estimates the document illumination field, removes shadows and
 * colour casts, reconstructs clean paper tone, protects coloured stamps and
 * signatures, applies adaptive local contrast plus a restrained edge sharpen,
 * and returns a lossless PNG. It never sends the uncleaned camera image to
 * the server and does not claim to recover detail that was never captured by
 * the camera.
 */
export async function enhanceScannedPage(file: File, onProgress?: (percent: number) => void): Promise<File> {
  if (!['image/jpeg', 'image/png'].includes(file.type)) return file;
  onProgress?.(5);
  const decoded = await decodeImage(file);
  onProgress?.(18);
  const scale = Math.min(1, MAX_SCAN_DIMENSION / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    decoded.dispose();
    throw new Error('Your browser cannot process this document image');
  }

  try {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded.source, 0, 0, width, height);
    onProgress?.(30);
    const source = context.getImageData(0, 0, width, height);
    const total = width * height;
    const histogram = new Uint32Array(256);
    const luminance = new Uint8Array(total);
    const illumination = localBackground(canvas, width, height);
    const colourfulness = { total: 0 };
    onProgress?.(44);

    for (let pixel = 0; pixel < total; pixel += 1) {
      const offset = pixel * 4;
      const value = clamp((source.data[offset] * 0.299) + (source.data[offset + 1] * 0.587) + (source.data[offset + 2] * 0.114));
      luminance[pixel] = value;
      histogram[value] += 1;
      colourfulness.total += Math.max(source.data[offset], source.data[offset + 1], source.data[offset + 2]) - Math.min(source.data[offset], source.data[offset + 1], source.data[offset + 2]);
    }

    const low = percentile(histogram, total, 0.02);
    const high = Math.max(low + 32, percentile(histogram, total, 0.985));
    const range = Math.max(32, high - low);
    const mean = luminance.reduce((sum, value) => sum + value, 0) / Math.max(total, 1);
    const gamma = mean < 108 ? 0.72 : mean < 145 ? 0.84 : mean > 215 ? 1.08 : 1;
    const enhanced = new Uint8ClampedArray(total);

    for (let pixel = 0; pixel < total; pixel += 1) {
      const y = Math.floor(pixel / width);
      const x = pixel - (y * width);
      const sampleX = Math.min((illumination?.width || 1) - 1, Math.floor(x * (illumination?.width || 1) / width));
      const sampleY = Math.min((illumination?.height || 1) - 1, Math.floor(y * (illumination?.height || 1) / height));
      const sampleOffset = ((sampleY * (illumination?.width || 1)) + sampleX) * 4;
      const background = illumination ? Math.max(32, clamp((illumination.data[sampleOffset] * 0.299) + (illumination.data[sampleOffset + 1] * 0.587) + (illumination.data[sampleOffset + 2] * 0.114))) : 220;
      const localRatio = luminance[pixel] / background;
      const localNormalised = Math.max(0, Math.min(1, (localRatio - 0.06) / 0.94));
      const globalNormalised = Math.max(0, Math.min(1, (luminance[pixel] - low) / range));
      let value = (255 * Math.pow(localNormalised, gamma) * 0.72) + (255 * Math.pow(globalNormalised, gamma) * 0.28);
      if (value > 247) value = 255;
      enhanced[pixel] = clamp(value);
    }
    onProgress?.(68);

    // A small unsharp mask improves photographed text while avoiding harsh
    // halos around signatures, seals and coloured document marks.
    const sharpened = new Uint8ClampedArray(enhanced);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const pixel = y * width + x;
        const neighbours = enhanced[pixel - width - 1] + enhanced[pixel - width] + enhanced[pixel - width + 1]
          + enhanced[pixel - 1] + enhanced[pixel + 1]
          + enhanced[pixel + width - 1] + enhanced[pixel + width] + enhanced[pixel + width + 1];
        sharpened[pixel] = clamp(enhanced[pixel] + ((enhanced[pixel] - (neighbours / 8)) * 0.34));
      }
    }

    for (let pixel = 0; pixel < total; pixel += 1) {
      const offset = pixel * 4;
      const originalLuma = Math.max(1, luminance[pixel]);
      const ratio = sharpened[pixel] / originalLuma;
      const y = Math.floor(pixel / width);
      const x = pixel - (y * width);
      const sampleX = Math.min((illumination?.width || 1) - 1, Math.floor(x * (illumination?.width || 1) / width));
      const sampleY = Math.min((illumination?.height || 1) - 1, Math.floor(y * (illumination?.height || 1) / height));
      const sampleOffset = ((sampleY * (illumination?.width || 1)) + sampleX) * 4;
      const backgroundMean = illumination ? (illumination.data[sampleOffset] + illumination.data[sampleOffset + 1] + illumination.data[sampleOffset + 2]) / 3 : 220;
      const castCorrection = illumination ? 0.52 : 0;
      const chromaWeight = (colourfulness.total / Math.max(total, 1)) > 26 ? 0.76 : 0.58;
      const red = source.data[offset] + ((backgroundMean - (illumination?.data[sampleOffset] || backgroundMean)) * castCorrection);
      const green = source.data[offset + 1] + ((backgroundMean - (illumination?.data[sampleOffset + 1] || backgroundMean)) * castCorrection);
      const blue = source.data[offset + 2] + ((backgroundMean - (illumination?.data[sampleOffset + 2] || backgroundMean)) * castCorrection);
      // Preserve chroma for stamps, seals and signatures while correcting the
      // paper illumination field toward a clean neutral document tone.
      source.data[offset] = clamp(sharpened[pixel] + ((red - originalLuma) * ratio * chromaWeight));
      source.data[offset + 1] = clamp(sharpened[pixel] + ((green - originalLuma) * ratio * chromaWeight));
      source.data[offset + 2] = clamp(sharpened[pixel] + ((blue - originalLuma) * ratio * chromaWeight));
      source.data[offset + 3] = 255;
    }
    onProgress?.(86);
    context.putImageData(source, 0, 0);
    const blob = await canvasToBlob(canvas);
    onProgress?.(100);
    const stem = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'scanned-document';
    return new File([blob], `${stem}-clean.png`, { type: PNG_MIME_TYPE, lastModified: Date.now() });
  } finally {
    decoded.dispose();
  }
}
