import User from '../models/User.js';
import WebinarPoll from '../models/WebinarPoll.js';
import WebinarQuestion from '../models/WebinarQuestion.js';
import { getCallerRole } from '../utils/webinarRoleResolver.js';
import { broadcastToWebinarRoom } from '../utils/webinarBroadcast.js';
import { logAudit } from '../utils/auditLog.js';
import { handleWebinarRoomFinished } from './webinarWebhookHandlers.js';
import {
    WEBINAR_ROLE_GRANTS,
    updateParticipantPermission,
    setParticipantMediaMuted,
    removeParticipantFromRoom,
    setScreenSharePermission as setScreenShareGrant,
} from '../utils/livekit.js';

// Every action below follows the same authorize → apply via roomService → persist to
// WebinarSession → broadcast pattern. The broadcast is for UI reflection only — a client
// ignoring it can't undo anything, because the real grant/mute/removal already happened
// server-side before the broadcast ever fires (see webinarBroadcast.js).

function findConnectedParticipant(session, userId) {
    const uid = userId.toString();
    return [...session.participants].reverse().find(p => p.identity === uid && p.connectionState === 'connected');
}

async function applyLiveGrant(session, userId, role) {
    try {
        await updateParticipantPermission(session.roomName, userId.toString(), WEBINAR_ROLE_GRANTS[role]);
    } catch (err) {
        console.error(`[Webinar Host] Failed to apply live grant for ${userId} -> ${role}:`, err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Start / End / Lock
// ─────────────────────────────────────────────────────────────────────────────

export const startWebinar = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        session.roomStatus = 'active';
        if (!session.actualStart) session.actualStart = new Date();
        await session.save();

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'webinar_started' });
        await logAudit({ actor: req.user._id, action: 'webinar.host.started', targetType: 'WebinarSession', targetId: session._id, req });

        res.status(200).json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
};

// Broadcasts an 'ended' control message; clients disconnect themselves gracefully on receipt
// rather than being hard-cut via a LiveKit room deletion.
export const endWebinar = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        await handleWebinarRoomFinished(session);

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'webinar_ended' });
        await logAudit({ actor: req.user._id, action: 'webinar.host.ended', targetType: 'WebinarSession', targetId: session._id, req });

        res.status(200).json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
};

export const lockRoom = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        session.locked = true;
        await session.save();

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'room_locked' });
        await logAudit({ actor: req.user._id, action: 'webinar.host.room_locked', targetType: 'WebinarSession', targetId: session._id, req });

        res.status(200).json({ success: true, data: { locked: true } });
    } catch (error) {
        next(error);
    }
};

export const unlockRoom = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        session.locked = false;
        await session.save();

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'room_unlocked' });
        await logAudit({ actor: req.user._id, action: 'webinar.host.room_unlocked', targetType: 'WebinarSession', targetId: session._id, req });

        res.status(200).json({ success: true, data: { locked: false } });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Waiting room
// ─────────────────────────────────────────────────────────────────────────────

function checkAdmitPermission(req, res) {
    if (req.webinarRole === 'moderator' && req.webinar.settings?.permissions?.moderatorsCanAdmit === false) {
        res.status(403).json({ message: 'Moderators are not permitted to admit/deny participants for this webinar' });
        return false;
    }
    return true;
}

export const listWaitingRoom = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        await session.populate('waitingRoom.user', 'name email');
        const waiting = session.waitingRoom.filter(e => e.status === 'waiting');
        res.status(200).json({ success: true, data: waiting });
    } catch (error) {
        next(error);
    }
};

async function resolveWaitingEntry(req, res, status) {
    const { webinarSession: session } = req;
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ message: 'userId is required' }); return null; }

    const entry = session.waitingRoom.find(e => e.user.toString() === userId);
    if (!entry) { res.status(404).json({ message: 'No waiting-room entry found for this user' }); return null; }

    entry.status = status;
    entry.resolvedBy = req.user._id;
    entry.resolvedAt = new Date();
    session.markModified('waitingRoom');
    await session.save();
    return { session, userId };
}

export const admitParticipant = async (req, res, next) => {
    try {
        if (!checkAdmitPermission(req, res)) return;
        const result = await resolveWaitingEntry(req, res, 'admitted');
        if (!result) return;
        const { session, userId } = result;

        // Targeted low-latency push so the waiting client retries its token request immediately,
        // closing the polling-interval gap as an optimization — polling stays as the fallback.
        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'admitted' }, [userId]);
        await logAudit({ actor: req.user._id, action: 'webinar.host.participant_admitted', targetType: 'WebinarSession', targetId: session._id, metadata: { userId }, req });

        res.status(200).json({ success: true, data: { userId, status: 'admitted' } });
    } catch (error) {
        next(error);
    }
};

export const denyParticipant = async (req, res, next) => {
    try {
        if (!checkAdmitPermission(req, res)) return;
        const result = await resolveWaitingEntry(req, res, 'denied');
        if (!result) return;
        const { session, userId } = result;

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'denied' }, [userId]);
        await logAudit({ actor: req.user._id, action: 'webinar.host.participant_denied', targetType: 'WebinarSession', targetId: session._id, metadata: { userId }, req });

        res.status(200).json({ success: true, data: { userId, status: 'denied' } });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Remove / Mute / Camera
// ─────────────────────────────────────────────────────────────────────────────

export const removeParticipant = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: 'userId is required' });

        try {
            await removeParticipantFromRoom(session.roomName, userId);
        } catch (err) {
            console.error(`[Webinar Host] removeParticipant LiveKit call failed for ${userId}:`, err.message);
        }

        const entry = findConnectedParticipant(session, userId);
        if (entry) {
            entry.connectionState = 'disconnected';
            entry.leftAt = new Date();
            session.markModified('participants');
        }
        await session.save();

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'removed' }, [userId]);
        await logAudit({ actor: req.user._id, action: 'webinar.host.participant_removed', targetType: 'WebinarSession', targetId: session._id, metadata: { userId }, req });

        res.status(200).json({ success: true, data: { userId } });
    } catch (error) {
        next(error);
    }
};

function checkMutePermission(req, res) {
    if (req.webinarRole === 'moderator' && req.webinar.settings?.permissions?.moderatorsCanMuteOthers === false) {
        res.status(403).json({ message: 'Moderators are not permitted to mute participants for this webinar' });
        return false;
    }
    return true;
}

async function muteOrUnmute(req, res, next, muted) {
    try {
        if (!checkMutePermission(req, res)) return;
        const { webinarSession: session } = req;
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: 'userId is required' });

        try {
            await setParticipantMediaMuted(session.roomName, userId, 'audio', muted);
        } catch (err) {
            console.error(`[Webinar Host] mute call failed for ${userId}:`, err.message);
        }

        const entry = findConnectedParticipant(session, userId);
        if (entry) {
            entry.isMuted = muted;
            session.markModified('participants');
            await session.save();
        }

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: muted ? 'muted' : 'unmuted', userId });
        await logAudit({ actor: req.user._id, action: `webinar.host.participant_${muted ? 'muted' : 'unmuted'}`, targetType: 'WebinarSession', targetId: session._id, metadata: { userId }, req });

        res.status(200).json({ success: true, data: { userId, isMuted: muted } });
    } catch (error) {
        next(error);
    }
}

export const muteParticipant = (req, res, next) => muteOrUnmute(req, res, next, true);
export const unmuteParticipant = (req, res, next) => muteOrUnmute(req, res, next, false);

export const muteAll = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        const exemptIds = new Set([
            session.hostId?.toString(),
            ...session.coHosts.map(id => id.toString()),
            ...session.activeSpeakers.map(id => id.toString()),
        ]);
        const targets = session.participants.filter(p => p.connectionState === 'connected' && !exemptIds.has(p.identity));

        await Promise.all(targets.map(p =>
            setParticipantMediaMuted(session.roomName, p.identity, 'audio', true)
                .catch(err => console.error(`[Webinar Host] muteAll failed for ${p.identity}:`, err.message))
        ));

        targets.forEach(p => { p.isMuted = true; });
        session.markModified('participants');
        await session.save();

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'muted_all' });
        await logAudit({ actor: req.user._id, action: 'webinar.host.mute_all', targetType: 'WebinarSession', targetId: session._id, metadata: { count: targets.length }, req });

        res.status(200).json({ success: true, data: { mutedCount: targets.length } });
    } catch (error) {
        next(error);
    }
};

export const disableParticipantCam = async (req, res, next) => {
    try {
        if (!checkMutePermission(req, res)) return;
        const { webinarSession: session } = req;
        const { userId, disabled = true } = req.body;
        if (!userId) return res.status(400).json({ message: 'userId is required' });

        try {
            await setParticipantMediaMuted(session.roomName, userId, 'video', !!disabled);
        } catch (err) {
            console.error(`[Webinar Host] camera toggle failed for ${userId}:`, err.message);
        }

        const entry = findConnectedParticipant(session, userId);
        if (entry) {
            entry.camDisabled = !!disabled;
            session.markModified('participants');
            await session.save();
        }

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'cam_toggled', userId, disabled: !!disabled });
        await logAudit({ actor: req.user._id, action: 'webinar.host.camera_toggled', targetType: 'WebinarSession', targetId: session._id, metadata: { userId, disabled: !!disabled }, req });

        res.status(200).json({ success: true, data: { userId, camDisabled: !!disabled } });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Role promotion/demotion — co-host / moderator / speaker tiers are mutually exclusive,
// matching webinarRoleResolver's priority-ordered resolution.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_ARRAY_FIELD = { 'co-host': 'coHosts', moderator: 'moderators', speaker: 'activeSpeakers' };

async function assignRole(req, res, next, role) {
    try {
        const { webinarSession: session } = req;
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: 'userId is required' });

        Object.values(ROLE_ARRAY_FIELD).forEach(field => {
            session[field] = session[field].filter(id => id.toString() !== userId);
        });
        session[ROLE_ARRAY_FIELD[role]].push(userId);

        const participant = findConnectedParticipant(session, userId);
        if (participant) participant.role = role;
        session.markModified('participants');
        await session.save();

        await applyLiveGrant(session, userId, role);
        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'role_changed', userId, role });
        await logAudit({ actor: req.user._id, action: `webinar.host.${role.replace('-', '_')}_assigned`, targetType: 'WebinarSession', targetId: session._id, metadata: { userId }, req });

        res.status(200).json({ success: true, data: { userId, role } });
    } catch (error) {
        next(error);
    }
}

async function unassignRole(req, res, next, role) {
    try {
        const { webinarSession: session, webinar } = req;
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: 'userId is required' });

        session[ROLE_ARRAY_FIELD[role]] = session[ROLE_ARRAY_FIELD[role]].filter(id => id.toString() !== userId);

        const user = await User.findById(userId);
        const newRole = user ? await getCallerRole(session, webinar, user) : null;

        const participant = findConnectedParticipant(session, userId);
        if (participant && newRole) participant.role = newRole;
        session.markModified('participants');
        await session.save();

        if (newRole) await applyLiveGrant(session, userId, newRole);
        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'role_changed', userId, role: newRole });
        await logAudit({ actor: req.user._id, action: `webinar.host.${role.replace('-', '_')}_removed`, targetType: 'WebinarSession', targetId: session._id, metadata: { userId }, req });

        res.status(200).json({ success: true, data: { userId, role: newRole } });
    } catch (error) {
        next(error);
    }
}

export const assignCoHost = (req, res, next) => assignRole(req, res, next, 'co-host');
export const removeCoHost = (req, res, next) => unassignRole(req, res, next, 'co-host');
export const assignModerator = (req, res, next) => assignRole(req, res, next, 'moderator');
export const removeModerator = (req, res, next) => unassignRole(req, res, next, 'moderator');
export const promoteToSpeaker = (req, res, next) => assignRole(req, res, next, 'speaker');
export const demoteFromSpeaker = (req, res, next) => unassignRole(req, res, next, 'speaker');

// ─────────────────────────────────────────────────────────────────────────────
// Pin/spotlight, screen share, feature toggles
// ─────────────────────────────────────────────────────────────────────────────

// Pinning a tile for yourself is a local-only UI preference with no server state; spotlighting
// is the one variant that needs to be synced to everyone, so it's the only one with an endpoint.
export const spotlightParticipant = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        const { userId } = req.body;
        session.spotlightedParticipant = userId || null;
        await session.save();

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'spotlight_changed', userId: userId || null });
        await logAudit({ actor: req.user._id, action: 'webinar.host.spotlight_changed', targetType: 'WebinarSession', targetId: session._id, metadata: { userId: userId || null }, req });

        res.status(200).json({ success: true, data: { spotlightedParticipant: session.spotlightedParticipant } });
    } catch (error) {
        next(error);
    }
};

export const setScreenSharePermission = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        const { userId, allowed } = req.body;
        if (!userId) return res.status(400).json({ message: 'userId is required' });

        const entry = findConnectedParticipant(session, userId);
        const baseGrant = WEBINAR_ROLE_GRANTS[entry?.role] || WEBINAR_ROLE_GRANTS.attendee;

        try {
            await setScreenShareGrant(session.roomName, userId, baseGrant, !!allowed);
        } catch (err) {
            console.error(`[Webinar Host] screen-share permission failed for ${userId}:`, err.message);
        }

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'screen_share_permission', userId, allowed: !!allowed });
        await logAudit({ actor: req.user._id, action: 'webinar.host.screen_share_permission_changed', targetType: 'WebinarSession', targetId: session._id, metadata: { userId, allowed: !!allowed }, req });

        res.status(200).json({ success: true, data: { userId, allowed: !!allowed } });
    } catch (error) {
        next(error);
    }
};

const TOGGLEABLE_FEATURES = [
    'chatEnabled', 'privateChatEnabled', 'qaEnabled', 'pollsEnabled', 'quizzesEnabled',
    'reactionsEnabled', 'raiseHandEnabled', 'screenShareAttendeesAllowed', 'announcementsEnabled',
];

export const toggleFeature = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        const { feature, enabled } = req.body;
        if (!TOGGLEABLE_FEATURES.includes(feature)) {
            return res.status(400).json({ message: `Unknown feature toggle: ${feature}` });
        }

        session.featureToggles[feature] = !!enabled;
        session.markModified('featureToggles');
        await session.save();

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'feature_toggled', feature, enabled: !!enabled });
        await logAudit({ actor: req.user._id, action: 'webinar.host.feature_toggled', targetType: 'WebinarSession', targetId: session._id, metadata: { feature, enabled: !!enabled }, req });

        res.status(200).json({ success: true, data: session.featureToggles });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Roster search + live stats
// ─────────────────────────────────────────────────────────────────────────────

export const getRosterSearch = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        await session.populate('participants.user', 'name email');
        const { q } = req.query;
        let roster = session.participants;
        if (q) {
            const needle = q.toLowerCase();
            roster = roster.filter(p =>
                (p.user?.name || '').toLowerCase().includes(needle) ||
                (p.user?.email || '').toLowerCase().includes(needle)
            );
        }
        res.status(200).json({ success: true, data: roster });
    } catch (error) {
        next(error);
    }
};

export const getLiveStats = async (req, res, next) => {
    try {
        const { webinarSession: session } = req;
        const connected = session.participants.filter(p => p.connectionState === 'connected');
        const [openPollCount, pendingQuestionCount] = await Promise.all([
            WebinarPoll.countDocuments({ session: session._id, status: 'open' }),
            WebinarQuestion.countDocuments({ session: session._id, status: 'pending' }),
        ]);

        res.status(200).json({
            success: true,
            data: {
                connectedCount: connected.length,
                peakConcurrentParticipants: session.peakConcurrentParticipants,
                handsRaisedCount: connected.filter(p => p.handRaised).length,
                waitingRoomCount: session.waitingRoom.filter(e => e.status === 'waiting').length,
                openPollCount,
                pendingQuestionCount,
                locked: session.locked,
                roomStatus: session.roomStatus,
            },
        });
    } catch (error) {
        next(error);
    }
};
