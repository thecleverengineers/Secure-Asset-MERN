export function propertyNameSlug(value: unknown) {
  return String(value || 'property')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'property';
}

export function propertyOverviewPath(property: any) {
  if (property?.listingKind === 'space') return `/marketplace/${encodeURIComponent(String(property._id || ''))}`;
  const slug = property?.slug || property?.publicSlug || propertyNameSlug(property?.title || property?.name);
  return `/marketplace/property_overview/${encodeURIComponent(String(slug))}`;
}


export function propertyAllRoomsPath(property: any) {
  const slug = property?.slug || property?.publicSlug || propertyNameSlug(property?.title || property?.name);
  return `/all_rooms/${encodeURIComponent(String(slug))}`;
}
