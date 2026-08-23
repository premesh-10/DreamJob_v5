import InterviewSession from '../models/InterviewSession.js';
import Settings from '../models/Settings.js';
import { egressClient, isLiveKitConfigured } from '../utils/livekit.js';
import { streamStoredFileWithRange } from '../utils/rangeStream.js';
import { logAudit } from '../utils/auditLog.js';
import { getCallerRole } from '../utils/sessionAccess.js';

/**
 * Builds the LiveKit Egress S3-compatible output target from env vars.
 * LiveKit Cloud's Egress requires an S3/GCS/Azure destination — it cannot
 * write directly to our local filesystem. Returns null (recording skipped,
 * never crashes) until these are configured; works with any S3-compatible
 * bucket (AWS S3, Cloudflare R2, MinIO, etc.) once they are.
 */
function buildEgressFileOutput(session) {
    const bucket = process.env.EGRESS_S3_BUCKET;
    const accessKey = process.env.EGRESS_S3_ACCESS_KEY;
    const secret = process.env.EGRESS_S3_SECRET;
    if (!bucket || !accessKey || !secret) return null;

    return {
        filepath: `interview-recordings/${session.booking}/${session._id}.mp4`,
        s3: {
            accessKey,
            secret,
            bucket,
            region: process.env.EGRESS_S3_REGION || '',
            endpoint: process.env.EGRESS_S3_ENDPOINT || '',
            forcePathStyle: process.env.EGRESS_S3_FORCE_PATH_STYLE === 'true',
        },
    };
}

/**
 * Starts Egress recording once: recording is enabled, both required consents
 * are in (or consent isn't required), the room is live, and an egress output
 * target is actually configured. Safe to call repeatedly — no-ops once
 * recording has already started/finished for this session.
 */
export async function maybeStartRecording(session) {
    if (session.recording.status !== 'none') return;

    const settings = await Settings.getSettings();
    if (!settings.recordingEnabled) return;

    if (settings.recordingRequiresConsent) {
        const ids = session.recording.consentBy.map(id => id.toString());
        const candidateConsented = ids.includes(session.candidate.toString());
        const interviewerConsented = ids.includes(session.interviewer.toString());
        if (!candidateConsented || !interviewerConsented) return;
    }

    if (!isLiveKitConfigured || !egressClient) return;

    const fileOutput = buildEgressFileOutput(session);
    if (!fileOutput) {
        console.warn(`[Recording] Session ${session._id}: recording requested but no Egress storage target is configured (set EGRESS_S3_BUCKET/EGRESS_S3_ACCESS_KEY/EGRESS_S3_SECRET). Skipping recording.`);
        return;
    }

    try {
        const info = await egressClient.startRoomCompositeEgress(session.roomName, { file: fileOutput });
        session.recording.egressId = info?.egressId || null;
        session.recording.status = 'recording';
        session.recording.consentGiven = true;
        await session.save();
    } catch (err) {
        console.error(`[Recording] Failed to start egress for session ${session._id}:`, err.message);
        session.recording.status = 'failed';
        await session.save();
        // No interactive caller to report this to — surface it in the audit
        // trail so an admin reviewing the session notices the recording never
        // started, instead of silently discovering it's missing after the fact.
        await logAudit({ actor: null, action: 'interview_session.recording_failed', targetType: 'InterviewSession', targetId: session._id, metadata: { stage: 'egress_start', error: err.message } });
    }
}

// @desc    Give consent to be recorded — once both parties have consented
//          (or consent isn't required), recording starts automatically.
// @route   POST /api/v1/interview-sessions/:sessionId/consent
// @access  Private (candidate or interviewer only — admins don't consent)
export const giveConsent = async (req, res, next) => {
    try {
        const session = await InterviewSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Interview session not found' });

        const role = getCallerRole(session, req.user);
        if (role !== 'candidate' && role !== 'interviewer') {
            return res.status(403).json({ message: 'Only the candidate or interviewer can give recording consent' });
        }

        const already = session.recording.consentBy.some(id => id.toString() === req.user._id.toString());
        if (!already) {
            session.recording.consentBy.push(req.user._id);
            await session.save();
        }

        await maybeStartRecording(session);

        res.status(200).json({
            success: true,
            data: { recordingStatus: session.recording.status, consentCount: session.recording.consentBy.length },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Stream a ready recording — auth-gated proxy, never plain-static-served.
// @route   GET /api/v1/interview-sessions/:sessionId/recording
// @access  Private (interviewer always; candidate if policy permits; admin always)
export const getRecordingStream = async (req, res, next) => {
    try {
        const session = await InterviewSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Interview session not found' });

        const role = getCallerRole(session, req.user);
        if (!role) return res.status(403).json({ message: 'You are not authorized to view this recording' });

        const settings = await Settings.getSettings();
        if (role === 'candidate' && !settings.candidateCanViewOwnRecording) {
            return res.status(403).json({ message: 'Candidates are not permitted to view interview recordings on this platform' });
        }

        if (session.recording.status !== 'ready' || !session.recording.filePath) {
            return res.status(404).json({ message: 'Recording is not available' });
        }

        if (role !== 'interviewer') {
            // Audit every non-owner (candidate/admin) recording access — owner
            // (interviewer) access is routine and not separately logged.
            await logAudit({
                actor: req.user._id,
                action: 'recording.accessed',
                targetType: 'InterviewSession',
                targetId: session._id,
                metadata: { role },
                req,
            });
        }

        streamStoredFileWithRange(req, res, session.recording.filePath);
    } catch (error) {
        next(error);
    }
};
