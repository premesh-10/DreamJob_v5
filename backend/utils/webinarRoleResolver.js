import { ADMIN_ROLES } from './sessionAccess.js';
import WebinarRegistration from '../models/WebinarRegistration.js';

export const HOST_TIER = ['host', 'co-host'];
export const MODERATION_TIER = ['host', 'co-host', 'moderator'];

/**
 * Resolves the caller's relationship to a WebinarSession — the access-control chokepoint for
 * every webinar-session/host/engagement endpoint, generalizing sessionAccess.getCallerRole
 * from 2 fixed parties to N role-tiered participants.
 *
 * Priority order: host/co-host/moderator/speaker (explicit roles assigned on the session) >
 * platform_admin (global admin role — a hidden observer tier, distinct from host) > attendee
 * (a 'registered'/'attended' WebinarRegistration row) > null (no access). Explicit session
 * roles are checked first so a seller who happens to also hold an admin role still resolves
 * to 'host' for their own webinar rather than being downgraded to the observer tier.
 */
export async function getCallerRole(session, webinar, user) {
    const uid = user._id.toString();

    if (session.hostId?.toString() === uid) return 'host';
    if ((session.coHosts || []).some(id => id.toString() === uid)) return 'co-host';
    if ((session.moderators || []).some(id => id.toString() === uid)) return 'moderator';
    if ((session.activeSpeakers || []).some(id => id.toString() === uid)) return 'speaker';
    if (ADMIN_ROLES.includes(user.role)) return 'platform_admin';

    const registration = await WebinarRegistration.findOne({
        webinar: webinar._id,
        user: uid,
        status: { $in: ['registered', 'attended'] },
    });
    if (registration) return 'attendee';

    return null;
}
