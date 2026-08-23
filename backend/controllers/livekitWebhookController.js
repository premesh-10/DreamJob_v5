import path from 'path';
import InterviewSession from '../models/InterviewSession.js';
import Booking from '../models/Booking.js';
import Interview from '../models/Interview.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import { webhookReceiver, isLiveKitConfigured } from '../utils/livekit.js';
import { storageProvider } from '../utils/storage.js';
import { maybeStartRecording } from './recordingController.js';
import { applyRefundAndSync } from '../utils/applyRefundAndSync.js';
import { sendNoShowNotice } from '../utils/interviewMailTemplates.js';
import { logAudit } from '../utils/auditLog.js';
import { processWebinarEvent } from './webinarWebhookHandlers.js';

function resolveRole(session, identity) {
    if (identity === session.candidate.toString()) return 'candidate';
    if (identity === session.interviewer.toString()) return 'interviewer';
    // Any other identity that reached the room was admin-granted — token
    // minting (getJoinToken) already restricts who can obtain a token at all.
    return 'admin';
}

async function handleRoomStarted(session, room) {
    session.roomStatus = 'active';
    if (room?.sid) session.roomSid = room.sid;
    await session.save();
    await maybeStartRecording(session);
}

async function handleParticipantJoined(session, participant) {
    if (!participant?.identity) return;
    const role = resolveRole(session, participant.identity);
    const settings = await Settings.getSettings();
    const now = new Date();
    const isLate = now > new Date(session.scheduledStart.getTime() + settings.lateJoinThresholdMinutes * 60000);
    const priorJoins = session.participantLogs.filter(p => p.user?.toString() === participant.identity).length;

    session.participantLogs.push({
        user: participant.identity,
        role,
        joinedAt: now,
        isLate,
        reconnectCount: priorJoins,
    });

    if (role === 'candidate') session.attendance.candidateJoined = true;
    if (role === 'interviewer') session.attendance.interviewerJoined = true;
    if (!session.actualStart) session.actualStart = now;
    if (session.completionStatus === 'not_started') session.completionStatus = 'in_progress';
    if (session.roomStatus !== 'active') session.roomStatus = 'active';

    session.markModified('participantLogs');
    await session.save();
}

async function handleParticipantLeft(session, participant) {
    if (!participant?.identity) return;
    const openLog = [...session.participantLogs].reverse().find(p => p.user?.toString() === participant.identity && !p.leftAt);
    if (openLog) {
        openLog.leftAt = new Date();
        session.markModified('participantLogs');
        await session.save();
    }
}

// Exported so interviewSessionController.endSession can run the same
// end-of-room bookkeeping synchronously, without waiting on a webhook that
// may be delayed (or, without real LiveKit credentials configured, never
// arrive at all in dev).
export async function handleRoomFinished(session) {
    const now = new Date();
    session.roomStatus = 'ended';
    session.actualEnd = now;
    if (session.actualStart) {
        session.durationSeconds = Math.max(0, Math.round((now - session.actualStart) / 1000));
    }

    const { interviewerJoined, candidateJoined } = session.attendance;

    if (interviewerJoined && candidateJoined) {
        session.completionStatus = 'awaiting_feedback';
        await session.save();
        return;
    }

    // At least one side no-showed — concrete, decisive policy for every
    // remaining combination (including neither side ever joining, which is
    // just as resolvable as a one-sided no-show: the candidate paid for a
    // session that never happened, so they're owed a refund either way):
    // any outcome other than "candidate alone no-showed" gets the candidate
    // a full automatic refund; candidate no-show => interviewer keeps the
    // (already-credited) payment.
    const noShowParty = !interviewerJoined && !candidateJoined ? 'both' : (interviewerJoined ? 'candidate' : 'interviewer');
    session.attendance.noShow = noShowParty;
    session.completionStatus = 'no_show';
    await session.save();

    try {
        const booking = await Booking.findById(session.booking);
        if (!booking) return;

        let refundNote = '';
        let refundAmount = 0;
        let refundIssued = false;
        if (noShowParty !== 'candidate' && booking.amountPaid > 0) {
            refundAmount = booking.amountPaid;
            const result = await applyRefundAndSync({
                booking, session,
                amount: booking.amountPaid,
                note: 'Automatic full refund — interviewer no-show',
            });
            refundIssued = result.success;
            refundNote = result.success
                ? `You have been automatically refunded ₹${booking.amountPaid.toFixed(2)} in full.`
                : 'A refund was due but could not be initiated automatically — our team will process it manually.';
        }
        booking.status = 'cancelled';
        await booking.save();

        const [candidate, interviewer, interview] = await Promise.all([
            User.findById(session.candidate).select('name email'),
            User.findById(session.interviewer).select('name email'),
            Interview.findById(session.interview).select('domain'),
        ]);
        if (candidate && interviewer) {
            await sendNoShowNotice({ session, domain: interview?.domain || 'Mock Interview', candidate, interviewer, noShowParty, refundNote });
        }

        await logAudit({ actor: null, action: 'interview_session.no_show', targetType: 'InterviewSession', targetId: session._id, metadata: { noShowParty, refundAmount, refundIssued } });
    } catch (err) {
        console.error(`[No-show] Failed to process no-show fallout for session ${session._id}:`, err.message);
    }
}

async function handleEgressEnded(session, egressInfo) {
    if (!egressInfo) return;
    session.recording.egressId = egressInfo.egressId || session.recording.egressId;

    const fileResult = egressInfo.fileResults?.[0];
    if (!fileResult?.location) {
        session.recording.status = 'failed';
        await session.save();
        return;
    }

    session.recording.status = 'processing';
    await session.save();

    try {
        const ext = path.extname(fileResult.filename || '') || '.mp4';
        const relativePath = await storageProvider.saveFromUrl(fileResult.location, {
            folder: session.booking.toString(),
            filename: `recording-${session._id}${ext}`,
        });
        session.recording.status = 'ready';
        session.recording.filePath = relativePath;
        // LiveKit reports file duration in nanoseconds; best-effort convert to seconds.
        session.recording.durationSeconds = fileResult.duration ? Math.round(Number(fileResult.duration) / 1e9) : 0;
        await session.save();
    } catch (err) {
        console.error(`[Recording] Failed to fetch egress output for session ${session._id}:`, err.message);
        session.recording.status = 'failed';
        await session.save();
        await logAudit({ actor: null, action: 'interview_session.recording_failed', targetType: 'InterviewSession', targetId: session._id, metadata: { stage: 'egress_fetch', error: err.message } });
    }
}

async function processEvent(event) {
    const roomName = event.room?.name;
    if (!roomName) return;

    // Dispatch by room-name prefix — webinar-* rooms (Phase 4) and interview-* rooms use
    // distinct, non-colliding naming conventions and entirely separate handler sets (webinars
    // have no recording/no-show/refund concepts).
    if (roomName.startsWith('webinar-')) {
        return processWebinarEvent(event);
    }

    let session;
    if (event.id) {
        // Atomically claim this exact event id against the session — if LiveKit
        // redelivers the same event (network retry, server restart), the second
        // delivery finds its id already present and is dropped here instead of
        // double-logging attendance or re-running no-show/refund logic.
        session = await InterviewSession.findOneAndUpdate(
            { roomName, processedWebhookEventIds: { $ne: event.id } },
            { $push: { processedWebhookEventIds: event.id } },
            { new: true }
        );
        if (!session) return;
    } else {
        session = await InterviewSession.findOne({ roomName });
        if (!session) return;
    }

    switch (event.event) {
        case 'room_started': return handleRoomStarted(session, event.room);
        case 'participant_joined': return handleParticipantJoined(session, event.participant);
        case 'participant_left': return handleParticipantLeft(session, event.participant);
        case 'room_finished': return handleRoomFinished(session);
        case 'egress_started':
            session.recording.status = 'recording';
            session.recording.egressId = event.egressInfo?.egressId || session.recording.egressId;
            return session.save();
        case 'egress_ended': return handleEgressEnded(session, event.egressInfo);
        default: return;
    }
}

// @desc    LiveKit server webhook — drives real attendance, room lifecycle,
//          and recording state. Trust model mirrors the Cashfree webhook:
//          signature-verified, no auth middleware.
// @route   POST /api/v1/livekit/webhook
// @access  Public (signature-verified)
export const handleLiveKitWebhook = async (req, res) => {
    if (!isLiveKitConfigured) {
        return res.status(503).json({ message: 'LiveKit is not configured' });
    }

    let event;
    try {
        const authHeader = req.headers['authorize'];
        event = await webhookReceiver.receive(req.rawBody || '', authHeader);
    } catch (err) {
        console.error('[LiveKit Webhook] Signature verification failed:', err.message);
        return res.status(401).json({ message: 'Invalid webhook signature' });
    }

    try {
        await processEvent(event);
    } catch (err) {
        console.error(`[LiveKit Webhook] Processing error for event "${event.event}":`, err.message);
    }

    // Always ack 200 after successful verification — a bug in our processing
    // logic should not trigger LiveKit's retry storm.
    res.status(200).json({ received: true });
};
