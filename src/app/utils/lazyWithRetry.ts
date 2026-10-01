import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_KEY = 'secureasset_chunk_reload_count';
const CHUNK_RELOAD_QUERY = '__secureasset_chunk_retry';
const MAX_CHUNK_RELOADS = 2;
const lazyImporters = new Set<() => Promise<{ default: ComponentType<any> }>>();
const warmedImporters = new Set<() => Promise<{ default: ComponentType<any> }>>();
let warmPromise: Promise<void> | null = null;

export function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /failed to fetch dynamically imported module|loading chunk|chunkloaderror|importing a module script failed/i.test(message);
}

/**
 * Warm every registered lazy route after the first screen has rendered.
 * Imported modules are cached by the browser/module loader, so subsequent
 * navigations resolve immediately instead of flashing an empty Suspense state.
 *
 * The registry is drained repeatedly because loading a parent route can
 * register additional nested lazy pages (for example ModulePage workspaces).
 */
export async function warmLazyModules(concurrency = 3) {
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    for (;;) {
      const pending = [...lazyImporters].filter((importer) => !warmedImporters.has(importer));
      if (!pending.length) break;
      for (let index = 0; index < pending.length; index += Math.max(1, concurrency)) {
        const batch = pending.slice(index, index + Math.max(1, concurrency));
        await Promise.allSettled(batch.map(async (importer) => {
          warmedImporters.add(importer);
          await importer();
        }));
      }
    }
  })().finally(() => { warmPromise = null; });
  return warmPromise;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  const registeredImporter = importer as () => Promise<{ default: ComponentType<any> }>;
  lazyImporters.add(registeredImporter);

  return lazy(async () => {
    try {
      const module = await importer();
      warmedImporters.add(registeredImporter);
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
