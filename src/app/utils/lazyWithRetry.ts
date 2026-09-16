import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_KEY = 'secureasset_chunk_reload_count';
const CHUNK_RELOAD_QUERY = '__secureasset_chunk_retry';
const MAX_CHUNK_RELOADS = 2;

export function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /failed to fetch dynamically imported module|loading chunk|chunkloaderror|importing a module script failed/i.test(message);
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const module = await importer();
      try { window.sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* Storage can be disabled by browser policy. */ }
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has(CHUNK_RELOAD_QUERY)) {
          url.searchParams.delete(CHUNK_RELOAD_QUERY);
          window.history.replaceState(window.history.state, '', url);
        }
      } catch { /* The current page can still render when history is unavailable. */ }
      return module;
    } catch (error) {
      let retryCount = 0;
      try { retryCount = Number.parseInt(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0', 10) || 0; } catch { /* The URL marker remains durable for this reload. */ }
      if (isChunkLoadError(error) && retryCount < MAX_CHUNK_RELOADS) {
        const nextRetry = retryCount + 1;
        try { window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(nextRetry)); } catch { /* The URL marker remains durable for this reload. */ }
        try {
          const url = new URL(window.location.href);
          url.searchParams.set(CHUNK_RELOAD_QUERY, String(Date.now()));
          // A new URL forces a current, non-cacheable document response while
          // preserving the route the user was already using.
          window.location.replace(url.toString());
          return new Promise<{ default: T }>(() => {});
        } catch { /* A normal reload remains the final recovery path. */ }
        window.location.reload();
        return new Promise<{ default: T }>((_resolve, reject) => {
          window.setTimeout(() => reject(new Error('The latest application files could not be loaded. Reload the page again or return home.')), 8_000);
        });
      }
      throw error;
    }
  });
}
