import Settings from '../models/Settings.js';

// In-memory cache with 30-second TTL to avoid a DB hit on every request.
let _cache = null;
let _expiresAt = 0;
const TTL_MS = 30_000;

export async function getSiteSettings() {
    if (_cache && Date.now() < _expiresAt) return _cache;
    try {
        const s = await Settings.getSettings();
        _cache = s.site?.toObject ? s.site.toObject() : (s.site || {});
        _expiresAt = Date.now() + TTL_MS;
    } catch {
        // On DB error return stale cache (or empty) so the server keeps running.
    }
    return _cache || {};
}

// Call this immediately after any PUT to /admin/site-settings so the next
// request picks up the new values without waiting for the TTL to expire.
export function invalidateSiteSettingsCache() {
    _expiresAt = 0;
}
