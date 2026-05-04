/**
 * fetchCache.ts — Lightweight in-memory cache for API GET responses.
 *
 * Prevents redundant re-fetches during React StrictMode double-mount
 * and rapid navigation (back/forward). Each key has a configurable
 * stale time — if the cached value is within the stale window, the
 * cached value is returned immediately without a network call.
 *
 * Not a full React Query replacement — intentionally minimal.
 */

type CacheEntry<T> = { data: T; ts: number };

const _store = new Map<string, CacheEntry<unknown>>();

/**
 * Return cached data if fresh, otherwise call `fetcher`, cache the result,
 * and return it.
 *
 * @param key    Unique cache key (e.g. "dashboard:subjects")
 * @param fetcher Async function that fetches the data
 * @param staleMs How long (ms) a cached value is considered fresh (default 60 000)
 */
export async function cachedGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  staleMs = 60_000,
): Promise<T> {
  const entry = _store.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() - entry.ts < staleMs) {
    return entry.data;
  }

  const data = await fetcher();
  _store.set(key, { data, ts: Date.now() });
  return data;
}

/**
 * Invalidate one or all cache entries.
 * Called on logout to clear stale user-specific data.
 */
export function clearCache(key?: string) {
  if (key) _store.delete(key);
  else _store.clear();
}
