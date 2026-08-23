import jwt from 'jsonwebtoken';
import { getSiteSettings } from '../utils/siteSettingsCache.js';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

// These URL prefixes are never blocked by maintenance mode.
const EXEMPT_PREFIXES = [
    '/api/v1/auth',          // Login must always work
    '/api/v1/admin',         // Admin panel API
    '/api/v1/settings',      // Public settings endpoint
    '/uploads',              // Static file uploads
];

function isExempt(url) {
    const path = url.split('?')[0]; // Strip query string
    return EXEMPT_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
}

function extractRoleFromRequest(req) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.role ?? null;
    } catch {
        return null; // Expired / invalid token — treat as unauthenticated
    }
}

export async function maintenanceCheck(req, res, next) {
    if (isExempt(req.originalUrl)) return next();

    const site = await getSiteSettings();
    if (!site.maintenanceMode) return next();

    // Maintenance is ON. Admins may still use the platform.
    const role = extractRoleFromRequest(req);
    if (role && ADMIN_ROLES.has(role)) return next();

    return res.status(503).json({
        success: false,
        maintenance: true,
        message: site.maintenanceMessage || "We're currently performing scheduled maintenance. We'll be back shortly.",
    });
}
