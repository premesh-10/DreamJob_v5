import WebinarSession from '../models/WebinarSession.js';
import WebinarRegistration from '../models/WebinarRegistration.js';
import Webinar from '../models/Webinar.js';
import { issueWebinarCertificateIfEligible } from '../services/certificateService.js';

// Approximate role classification for attendance/analytics logging only — NOT a security
// boundary. The real access-control decision already happened at token-mint time via
// webinarRoleResolver.getCallerRole + generateWebinarToken's per-role grant; this is just
// "what do we record in the roster for this identity," so defaulting unknown identities to
// 'attendee' is acceptable (a platform_admin observer showing as 'attendee' in the roster log
// doesn't grant them anything they didn't already have).
function classifyParticipantRole(session, identity) {
    if (session.hostId?.toString() === identity) return 'host';
    if ((session.coHosts || []).some(id => id.toString() === identity)) return 'co-host';
    if ((session.moderators || []).some(id => id.toString() === identity)) return 'moderator';
    if ((session.activeSpeakers || []).some(id => id.toString() === identity)) return 'speaker';
    return 'attendee';
}

export async function handleWebinarRoomStarted(session, room) {
    session.roomStatus = 'active';
    if (room?.sid) session.roomSid = room.sid;
    if (!session.actualStart) session.actualStart = new Date();
    await session.save();
}

export async function handleWebinarParticipantJoined(session, participant) {
    if (!participant?.identity) return;
    const identity = participant.identity;
    const role = classifyParticipantRole(session, identity);
    const now = new Date();

    const priorJoins = session.participants.filter(p => p.identity === identity).length;
    session.participants.push({
        user: identity,
        identity,
        role,
        joinedAt: now,
        connectionState: 'connected',
        reconnectCount: priorJoins,
    });

    const currentlyConnected = session.participants.filter(p => p.connectionState === 'connected').length;
    session.peakConcurrentParticipants = Math.max(session.peakConcurrentParticipants || 0, currentlyConnected);

    if (!session.actualStart) session.actualStart = now;
    if (session.roomStatus !== 'active') session.roomStatus = 'active';

    session.markModified('participants');
    await session.save();

    if (role === 'attendee') {
        try {
            await WebinarRegistration.findOneAndUpdate(
                { webinar: session.webinar, user: identity },
                { $set: { 'attendance.joinedAt': now, 'attendance.attended': true } }
            );
        } catch (err) {
            console.error(`[Webinar Webhook] Failed to update attendance for ${identity}:`, err.message);
        }
    }
}

export async function handleWebinarParticipantLeft(session, participant) {
    if (!participant?.identity) return;
    const identity = participant.identity;
    const now = new Date();

    const openEntry = [...session.participants].reverse().find(p => p.identity === identity && p.connectionState === 'connected');
    if (openEntry) {
        openEntry.connectionState = 'disconnected';
        openEntry.leftAt = now;
        session.markModified('participants');
        await session.save();
    }

    try {
        const registration = await WebinarRegistration.findOne({ webinar: session.webinar, user: identity });
        if (registration && registration.attendance.joinedAt) {
            const sessionDuration = Math.max(0, Math.round((now - registration.attendance.joinedAt) / 1000));
            registration.attendance.leftAt = now;
            registration.attendance.durationSeconds = (registration.attendance.durationSeconds || 0) + sessionDuration;
            await registration.save();
        }
    } catch (err) {
        console.error(`[Webinar Webhook] Failed to update attendance on leave for ${identity}:`, err.message);
    }
}

// Exported so the Host Control Panel's "End Webinar" action (Phase 7) can run the same
// end-of-room bookkeeping synchronously, without waiting on a webhook that may be delayed.
export async function handleWebinarRoomFinished(session) {
    const now = new Date();
    session.roomStatus = 'ended';
    session.actualEnd = now;
    if (session.actualStart) {
        session.durationSeconds = Math.max(0, Math.round((now - session.actualStart) / 1000));
    }
    // Anyone still marked connected never got an explicit participant_left event —
    // finalize their session.participants entry AND their registration's attendance
    // duration here so it isn't lost.
    const stillConnected = session.participants.filter(p => p.connectionState === 'connected');
    stillConnected.forEach(p => {
        p.connectionState = 'disconnected';
        p.leftAt = now;
    });
    session.markModified('participants');
    await session.save();

    for (const p of stillConnected) {
        if (p.role !== 'attendee') continue;
        try {
            const registration = await WebinarRegistration.findOne({ webinar: session.webinar, user: p.identity });
            if (registration?.attendance?.joinedAt) {
                const sessionDuration = Math.max(0, Math.round((now - registration.attendance.joinedAt) / 1000));
                registration.attendance.leftAt = now;
                registration.attendance.durationSeconds = (registration.attendance.durationSeconds || 0) + sessionDuration;
                await registration.save();
            }
        } catch (err) {
            console.error(`[Webinar Webhook] Failed to finalize attendance for ${p.identity}:`, err.message);
        }
    }

    try {
        const webinar = await Webinar.findById(session.webinar);
        if (webinar) {
            const attendedRegistrations = await WebinarRegistration.find({ webinar: webinar._id, 'attendance.attended': true });
            for (const registration of attendedRegistrations) {
                await issueWebinarCertificateIfEligible(webinar, registration).catch(err =>
                    console.error(`[Webinar Webhook] Certificate issuance failed for ${registration.user}:`, err.message)
                );
            }
        }
    } catch (err) {
        console.error('[Webinar Webhook] Certificate issuance pass failed:', err.message);
    }
}

async function processWebinarEvent(event) {
    const roomName = event.room?.name;
    if (!roomName) return;

    const session = await WebinarSession.findOne({ roomName });
    if (!session) return;

    switch (event.event) {
        case 'room_started': return handleWebinarRoomStarted(session, event.room);
        case 'participant_joined': return handleWebinarParticipantJoined(session, event.participant);
        case 'participant_left': return handleWebinarParticipantLeft(session, event.participant);
        case 'room_finished': return handleWebinarRoomFinished(session);
        default: return;
    }
}

export { processWebinarEvent };
