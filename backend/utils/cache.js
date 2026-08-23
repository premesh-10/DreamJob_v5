/**
 * cache.js — in-memory, Map-based TTL cache. Free/local stand-in for a
 * real shared cache (Redis etc) — a future swap only needs to reimplement
 * get/set/del/getOrSet/invalidatePrefix behind this same module boundary.
 * Lazy eviction on read (no background sweep needed at this scale).
 */
const store = new Map();

function isExpired(entry) {
    return !entry || entry.expiresAt <= Date.now();
}

export function get(key) {
    const entry = store.get(key);
    if (isExpired(entry)) {
        store.delete(key);
        return undefined;
    }
    return entry.value;
}

export function set(key, value, ttlMs) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function del(key) {
    store.delete(key);
}

// Returns the cached value if fresh, else calls fetchFn, caches, and returns it.
export async function getOrSet(key, ttlMs, fetchFn) {
    const cached = get(key);
    if (cached !== undefined) return cached;
    const value = await fetchFn();
    set(key, value, ttlMs);
    return value;
}

// Deletes every key starting with `prefix` — used to bust the course-listing
// cache on any create/update/publish/delete, so admins/sellers see their own
// changes immediately rather than waiting out the TTL.
export function invalidatePrefix(prefix) {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key);
    }
}
