const MAX_DIMENSION = 2200;
const EDGE_SAMPLE_DEPTH = 10;

type Rgb = { r: number; g: number; b: number };

function averageBorder(data: Uint8ClampedArray, width: number, height: number): Rgb {
  let r = 0; let g = 0; let b = 0; let count = 0;
  const read = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    r += data[index]; g += data[index + 1]; b += data[index + 2]; count += 1;
  };
  const depth = Math.min(EDGE_SAMPLE_DEPTH, Math.max(1, Math.floor(Math.min(width, height) / 8)));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x < depth || y < depth || x >= width - depth || y >= height - depth) read(x, y);
    }
  }
  return { r: r / Math.max(count, 1), g: g / Math.max(count, 1), b: b / Math.max(count, 1) };
}

function colourDistance(r: number, g: number, b: number, reference: Rgb) {
  return Math.hypot(r - reference.r, g - reference.g, b - reference.b);
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the transparent signature image')), 'image/png');
  });
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    const ready = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The selected signature or stamp image could not be read'));
    });
    image.src = url;
    await ready;
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Converts a signature/stamp photographed on plain paper into a cropped,
 * transparent PNG. It intentionally works entirely in the browser, so the
 * unprocessed original never leaves the signer’s device.
 */
export async function makeSignatureBackgroundTransparent(file: File, label = 'signature'): Promise<File> {
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    throw new Error('Choose a PNG or JPG image of the signature or stamp/seal');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Signature or stamp/seal images must be 5 MB or smaller');
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Your browser cannot process this signature image');
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const background = averageBorder(imageData.data, width, height);
  let minX = width; let minY = height; let maxX = -1; let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const red = imageData.data[index];
      const green = imageData.data[index + 1];
      const blue = imageData.data[index + 2];
      const brightness = (red + green + blue) / 3;
      const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
      const distance = colourDistance(red, green, blue, background);
      // Light neutral paper and pixels close to the sampled paper border fade
      // out. Dark ink and coloured seals remain fully opaque.
      let alpha = imageData.data[index + 3];
      if (distance < 26 || (brightness > 236 && saturation < 38)) alpha = 0;
      else if (distance < 88 && brightness > 145) alpha = Math.round(alpha * ((distance - 26) / 62));
      imageData.data[index + 3] = alpha;
      if (alpha > 24) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('No visible signature or stamp/seal was found. Use a clear image on a plain, light background.');
  }
  context.putImageData(imageData, 0, 0);
  const padding = Math.max(18, Math.round(Math.min(width, height) * 0.035));
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(width - cropX, maxX - minX + (padding * 2) + 1);
  const cropHeight = Math.min(height - cropY, maxY - minY + (padding * 2) + 1);
  const output = document.createElement('canvas');
  output.width = cropWidth;
  output.height = cropHeight;
  const outputContext = output.getContext('2d');
  if (!outputContext) throw new Error('Your browser cannot crop this signature image');
  outputContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  const blob = await canvasToBlob(output);
  const fileStem = String(label || 'signature').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'signature';
  return new File([blob], `${fileStem}-transparent.png`, { type: 'image/png', lastModified: Date.now() });
}
