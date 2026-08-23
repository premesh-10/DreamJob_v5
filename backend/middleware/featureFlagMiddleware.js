import jwt from 'jsonwebtoken';
import { getSiteSettings } from '../utils/siteSettingsCache.js';

// Sellers and admins can always access their own content even when a feature
// is disabled for regular users (e.g. a seller can still manage their courses).
const PRIVILEGED_ROLES = new Set(['seller', 'admin', 'super_admin', 'moderator', 'finance_admin', 'support_admin']);

function extractRoleFromRequest(req) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.role ?? null;
    } catch {
        return null;
    }
}

/**
 * Middleware factory. Pass the Settings.site flag name (e.g. 'coursesEnabled').
 * Regular users are blocked when the flag is false; sellers/admins pass through.
 */
export function requireFeature(flagName) {
    return async (req, res, next) => {
        const site = await getSiteSettings();

        // Undefined / true → feature is on
        if (site[flagName] !== false) return next();

        // Feature is OFF — privileged roles still get access
        const role = extractRoleFromRequest(req);
        if (role && PRIVILEGED_ROLES.has(role)) return next();

        return res.status(503).json({
            success: false,
            featureDisabled: true,
            message: 'This feature is currently unavailable. Please check back later.',
        });
    };
}
