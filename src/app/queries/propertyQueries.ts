import { getPropertyById, getPublicPropertyStructure } from '../services/api';

export async function fetchPublicProperty(id: string) {
  const [basic, structure] = await Promise.all([getPropertyById(id), getPublicPropertyStructure(id)]);
  return { listing: basic.data, structure: structure.data };
}

export function publicPropertyQueryOptions(id: string) {
  return {
    queryKey: ['public-property', id] as const,
    queryFn: () => fetchPublicProperty(id),
    enabled: Boolean(id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  };
}

export async function fetchPublicRentalUnit(id: string) {
  const structure = await getPublicPropertyStructure(id);
  return { listing: structure.data?.property || null, structure: structure.data };
}

export function publicRentalUnitQueryOptions(id: string) {
  return {
    queryKey: ['public-rental-unit', id] as const,
    queryFn: () => fetchPublicRentalUnit(id),
    enabled: Boolean(id),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  };
}
