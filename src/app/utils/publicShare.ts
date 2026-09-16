import { propertyNameSlug } from './propertyUrl';

export type PublicListingShareInput = {
  title: string;
  imageUrl?: string;
  url?: string;
};

function wasCancelled(error: unknown) {
  return typeof DOMException !== 'undefined'
    && error instanceof DOMException
    && error.name === 'AbortError';
}

function imageExtension(mimeType: string) {
  const extension = mimeType.split('/')[1]?.split(';')[0]?.trim().toLowerCase();
  return extension === 'jpeg' ? 'jpg' : extension || 'jpg';
}

/** Share a public property or room with its public image when the device supports file sharing. */
export async function sharePublicListing({ title, imageUrl, url }: PublicListingShareInput) {
  const shareTitle = String(title || 'SecureAsset listing').trim() || 'SecureAsset listing';
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = shareUrl ? `${shareTitle}\n${shareUrl}` : shareTitle;

  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareText);
    return false;
  }

  let imageFile: File | undefined;
  if (imageUrl) {
    try {
      const response = await fetch(imageUrl, { credentials: 'same-origin' });
      if (response.ok) {
        const blob = await response.blob();
        const mimeType = blob.type || 'image/jpeg';
        imageFile = new File(
          [blob],
          `secureasset-${propertyNameSlug(shareTitle)}.${imageExtension(mimeType)}`,
          { type: mimeType },
        );
      }
    } catch {
      imageFile = undefined;
    }
  }

  if (imageFile && (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [imageFile] }))) {
    try {
      await navigator.share({ title: shareTitle, text: shareText, files: [imageFile] });
      return true;
    } catch (error) {
      if (wasCancelled(error)) return false;
    }
  }

  try {
    await navigator.share({ title: shareTitle, text: shareTitle, url: shareUrl || undefined });
    return true;
  } catch (error) {
    if (wasCancelled(error)) return false;
    throw error;
  }
}
