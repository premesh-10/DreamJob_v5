import Webinar from '../models/Webinar.js';
import WebinarSession from '../models/WebinarSession.js';
import { createWebinarRoom, generateWebinarToken } from '../utils/livekit.js';
import { getCallerRole } from '../utils/webinarRoleResolver.js';
import { logAudit } from '../utils/auditLog.js';
import { getScheduleWindow } from '../utils/webinarSchedule.js';

// Shared by this controller and Phase 4's publishWebinar — one session per webinar,
// lazily created on first access. DB-only; does not itself touch LiveKit (room
// provisioning happens in requestJoinToken's self-heal path and in Phase 4's publish hook).
export async function findOrCreateWebinarSession(webinar) {
    let session = await WebinarSession.findOne({ webinar: webinar._id });
    if (session) return session;

    session = await WebinarSession.create({
        webinar: webinar._id,
        roomName: webinar.roomName || `webinar-${webinar._id}`,
        hostId: webinar.seller,
        featureToggles: {
            chatEnabled: webinar.settings?.engagement?.chatEnabled ?? true,
            privateChatEnabled: webinar.settings?.engagement?.privateChatEnabled ?? true,
            qaEnabled: webinar.settings?.engagement?.qaEnabled ?? true,
            pollsEnabled: webinar.settings?.engagement?.pollsEnabled ?? true,
            quizzesEnabled: webinar.settings?.engagement?.quizzesEnabled ?? false,
            reactionsEnabled: webinar.settings?.engagement?.reactionsEnabled ?? true,
            raiseHandEnabled: webinar.settings?.engagement?.raiseHandEnabled ?? true,
            screenShareAttendeesAllowed: webinar.settings?.permissions?.attendeesCanShareScreen ?? false,
            announcementsEnabled: webinar.settings?.engagement?.announcementsEnabled ?? true,
        },
    });
    return session;
}

// @desc    Get (lazily creating) the WebinarSession for a webinar — the access-control
//          chokepoint for the live room, mirroring getSessionForBooking's role for interviews.
// @route   GET /api/v1/webinar-sessions/webinar/:webinarId
// @access  Private
export const getSessionForWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.webinarId);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        const session = await findOrCreateWebinarSession(webinar);
        const role = await getCallerRole(session, webinar, req.user);
        if (!role) return res.status(403).json({ message: 'You are not authorized to view this webinar session' });

        res.status(200).json({ success: true, data: session, role });
    } catch (error) {
        next(error);
    }
};

// @desc    Register intent to join — for waiting-room-gated webinars this creates/returns a
//          'waiting' entry instead of a token, so the UI can show a distinct "waiting for
//          host" state; for everyone else it's an immediate no-op pass-through to 'admitted'.
// @route   POST /api/v1/webinar-sessions/:sessionId/admission
// @access  Private
export const requestAdmission = async (req, res, next) => {
    try {
        const session = await WebinarSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Webinar session not found' });
        const webinar = await Webinar.findById(session.webinar);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        const role = await getCallerRole(session, webinar, req.user);
        if (!role) return res.status(403).json({ message: 'You are not authorized to join this webinar' });

        const waitingRoomEnabled = !!webinar.settings?.security?.waitingRoomEnabled;
        if (!waitingRoomEnabled || role !== 'attendee') {
            return res.status(200).json({ success: true, data: { status: 'admitted' } });
        }

        const uid = req.user._id.toString();
        let entry = session.waitingRoom.find(e => e.user.toString() === uid);
        if (!entry) {
            session.waitingRoom.push({ user: req.user._id, requestedAt: new Date(), status: 'waiting' });
            await session.save();
            entry = session.waitingRoom.find(e => e.user.toString() === uid);
        }

        res.status(200).json({ success: true, data: { status: entry.status } });
    } catch (error) {
        next(error);
    }
};

// @desc    Mint a short-lived LiveKit join token for the caller, gated by role, lock state,
//          waiting-room admission, the configurable join-before-host window, late-join and
//          rejoin policy.
// @route   POST /api/v1/webinar-sessions/:sessionId/token
// @access  Private
export const requestJoinToken = async (req, res, next) => {
    try {
        const session = await WebinarSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Webinar session not found' });
        const webinar = await Webinar.findById(session.webinar);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        if (webinar.status === 'cancelled') {
            return res.status(400).json({ message: 'This webinar has been cancelled' });
        }

        const role = await getCallerRole(session, webinar, req.user);
        if (!role) return res.status(403).json({ message: 'You are not authorized to join this webinar' });

        const isElevated = ['host', 'co-host', 'moderator', 'speaker', 'platform_admin'].includes(role);
        const security = webinar.settings?.security || {};

        if (session.locked && !isElevated) {
            return res.status(403).json({ message: 'This webinar room is currently locked by the host' });
        }

        if (security.waitingRoomEnabled && role === 'attendee') {
            const uid = req.user._id.toString();
            const entry = session.waitingRoom.find(e => e.user.toString() === uid);
            if (!entry || entry.status !== 'admitted') {
                return res.status(202).json({ success: true, waiting: true, message: 'Waiting for the host to admit you.' });
            }
        }

        if (!isElevated) {
            const { start } = getScheduleWindow(webinar);
            const now = new Date();
            const windowStart = new Date(start.getTime() - (security.joinBeforeHostMinutes ?? 15) * 60000);

            if (now < windowStart) {
                return res.status(403).json({ message: 'You can only join starting from the configured join window before this webinar begins', windowStart });
            }
            if (security.lateJoinAllowed === false && now > start) {
                return res.status(403).json({ message: 'Late join is disabled for this webinar' });
            }
            if (security.rejoinAllowed === false) {
                const uid = req.user._id.toString();
                const hasLeftBefore = session.participants.some(p => p.user?.toString() === uid && p.leftAt);
                if (hasLeftBefore) return res.status(403).json({ message: 'Rejoining this webinar is disabled' });
            }
        }

        // Self-healing lazy room creation — publish-time provisioning (Phase 4) may not have
        // run yet, or may have failed without blocking the publish transition.
        if (!session.roomSid) {
            try {
                const room = await createWebinarRoom(session.roomName, {});
                session.roomSid = room?.sid || session.roomSid;
                if (session.roomStatus === 'scheduled') session.roomStatus = 'active';
                await session.save();
            } catch (err) {
                console.error(`[LiveKit] Lazy webinar room creation failed for session ${session._id}:`, err.message);
                return res.status(503).json({ message: 'Video service is temporarily unavailable. Please try again shortly.' });
            }
        }

        const token = await generateWebinarToken({
            roomName: session.roomName,
            identity: req.user._id.toString(),
            name: req.user.name,
            role,
        });

        await logAudit({
            actor: req.user._id,
            action: 'webinar_session.join_token_issued',
            targetType: 'WebinarSession',
            targetId: session._id,
            metadata: { role },
            req,
        });

        res.status(200).json({
            success: true,
            data: { token, roomName: session.roomName, liveKitUrl: process.env.LIVEKIT_URL || '', role },
        });
    } catch (error) {
        next(error);
    }
};
