import Webinar from '../models/Webinar.js';
import WebinarSession from '../models/WebinarSession.js';
import { getCallerRole } from '../utils/webinarRoleResolver.js';

// Single chokepoint for every Host Control Panel route — resolves {session, webinar, role}
// once and attaches them to req so controllers don't repeat the lookup, mirroring the existing
// authorize() Express middleware factory pattern used everywhere else in this codebase.
export const requireHostTier = (allowedRoles) => async (req, res, next) => {
    try {
        const session = await WebinarSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Webinar session not found' });
        const webinar = await Webinar.findById(session.webinar);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        const role = await getCallerRole(session, webinar, req.user);
        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({ message: 'You do not have permission to perform this action' });
        }

        req.webinarSession = session;
        req.webinar = webinar;
        req.webinarRole = role;
        next();
    } catch (error) {
        next(error);
    }
};
