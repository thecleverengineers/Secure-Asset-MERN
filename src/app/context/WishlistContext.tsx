import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { addWishlistItem, getWishlist, removeWishlistItem, syncWishlistItems } from '../services/api';
import type { Property, WishlistItem, WishlistListingKind } from '../services/types';

const STORAGE_KEY = 'secureasset:wishlist:v1';
const MAX_GUEST_ITEMS = 100;

type WishlistContextValue = {
  items: WishlistItem[];
  count: number;
  loading: boolean;
  error: string;
  isWishlisted: (listingId: string, listingKind?: WishlistListingKind) => boolean;
  toggle: (listing: Property) => Promise<void>;
  remove: (listingId: string, listingKind?: WishlistListingKind) => Promise<void>;
  clear: () => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

function listingKind(value: any): WishlistListingKind { return value?.listingKind === 'space' ? 'space' : 'property'; }

function readGuestWishlist(): WishlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.listingId === 'string' && item.listing).slice(0, MAX_GUEST_ITEMS);
  } catch { return []; }
}

function writeGuestWishlist(items: WishlistItem[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_GUEST_ITEMS))); } catch { /* private browsing may disable storage */ }
}

function clearGuestWishlist() {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* storage is optional */ }
}

function asWishlistItem(listing: Property): WishlistItem {
  const value: any = listing;
  return {
    listingId: String(value?._id || value?.propertyId || ''),
    listingKind: listingKind(value),
    listing: value,
  };
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const tenantAccount = user?.role === 'tenant';
  const [items, setItems] = useState<WishlistItem[]>(() => readGuestWishlist());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const guestItems = readGuestWishlist();
    setError('');
    if (!tenantAccount) {
      setItems(guestItems);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    const hydrate = async () => {
      try {
        const response = guestItems.length
          ? await syncWishlistItems(guestItems.map((item) => ({ listingId: item.listingId, listingKind: item.listingKind })))
          : await getWishlist();
        if (!active) return;
        setItems(response.data || []);
        if (guestItems.length) clearGuestWishlist();
      } catch (loadError) {
        if (!active) return;
        setItems(guestItems);
        setError(loadError instanceof Error ? loadError.message : 'Wishlist could not be synchronised.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void hydrate();
    return () => { active = false; };
  }, [tenantAccount, user?._id]);

  const isWishlisted = useCallback((listingId: string, kind: WishlistListingKind = 'property') => items.some((item) => item.listingId === String(listingId) && item.listingKind === kind), [items]);

  const toggle = useCallback(async (listing: Property) => {
    const entry = asWishlistItem(listing);
    if (!entry.listingId) return;
    const found = items.some((item) => item.listingId === entry.listingId && item.listingKind === entry.listingKind);
    const previous = items;
    const next = found
      ? items.filter((item) => !(item.listingId === entry.listingId && item.listingKind === entry.listingKind))
      : [entry, ...items].slice(0, MAX_GUEST_ITEMS);
    setItems(next);
    setError('');
    if (!tenantAccount) { writeGuestWishlist(next); return; }
    try {
      if (found) await removeWishlistItem(entry.listingId, entry.listingKind);
      else await addWishlistItem(entry.listingId, entry.listingKind);
    } catch (toggleError) {
      setItems(previous);
      setError(toggleError instanceof Error ? toggleError.message : 'Wishlist update failed.');
    }
  }, [items, tenantAccount]);

  const remove = useCallback(async (listingId: string, kind: WishlistListingKind = 'property') => {
    const previous = items;
    const next = items.filter((item) => !(item.listingId === String(listingId) && item.listingKind === kind));
    setItems(next);
    setError('');
    if (!tenantAccount) { writeGuestWishlist(next); return; }
    try { await removeWishlistItem(String(listingId), kind); }
    catch (removeError) {
      setItems(previous);
      setError(removeError instanceof Error ? removeError.message : 'Wishlist update failed.');
    }
  }, [items, tenantAccount]);

  const clear = useCallback(async () => {
    const previous = items;
    setItems([]);
    setError('');
    if (!tenantAccount) { clearGuestWishlist(); return; }
    const results = await Promise.allSettled(previous.map((item) => removeWishlistItem(item.listingId, item.listingKind)));
    if (results.some((result) => result.status === 'rejected')) {
      setItems(previous);
      setError('Some wishlist items could not be removed.');
    }
  }, [items, tenantAccount]);

  const value = useMemo<WishlistContextValue>(() => ({ items, count: items.length, loading, error, isWishlisted, toggle, remove, clear }), [clear, error, isWishlisted, items, loading, remove, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error('useWishlist must be used inside WishlistProvider');
  return value;
}
