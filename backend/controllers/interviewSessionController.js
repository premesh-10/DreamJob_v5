import InterviewSession from '../models/InterviewSession.js';
import InterviewFeedback from '../models/InterviewFeedback.js';
import Dispute from '../models/Dispute.js';
import Booking from '../models/Booking.js';
import Interview from '../models/Interview.js';
import Settings from '../models/Settings.js';
import { generateInterviewToken, createInterviewRoom, endInterviewRoom } from '../utils/livekit.js';
import { handleRoomFinished } from './livekitWebhookController.js';
import { logAudit } from '../utils/auditLog.js';
import { getCallerRole } from '../utils/sessionAccess.js';
import { applyRatingUpdate } from '../utils/interviewRating.js';

// @desc    Get the InterviewSession for a booking — this is the access-control
//          chokepoint that makes the meeting visible ONLY to the assigned
//          interviewer, the booked candidate, or an admin.
// @route   GET /api/v1/interview-sessions/booking/:bookingId
// @access  Private
export const getSessionForBooking = async (req, res, next) => {
    try {
        const session = await InterviewSession.findOne({ booking: req.params.bookingId })
            .populate('interview', 'domain price')
            .populate('candidate', 'name email')
            .populate('interviewer', 'name email');
        if (!session) return res.status(404).json({ message: 'Interview session not found' });

        const role = getCallerRole(session, req.user);
        if (!role) return res.status(403).json({ message: 'You are not authorized to view this interview session' });

        res.status(200).json({ success: true, data: session, role });
    } catch (error) {
        next(error);
    }
};

// @desc    Get the InterviewSession by its own id (used once the client already
//          has a sessionId, e.g. from getMyBookings/getSellerBookings)
// @route   GET /api/v1/interview-sessions/:sessionId
// @access  Private
export const getSessionById = async (req, res, next) => {
    try {
        const session = await InterviewSession.findById(req.params.sessionId)
            .populate('interview', 'domain price')
            .populate('candidate', 'name email')
            .populate('interviewer', 'name email');
        if (!session) return res.status(404).json({ message: 'Interview session not found' });

        const role = getCallerRole(session, req.user);
        if (!role) return res.status(403).json({ message: 'You are not authorized to view this interview session' });

        res.status(200).json({ success: true, data: session, role });
    } catch (error) {
        next(error);
    }
};

// @desc    Mint a short-lived LiveKit join token for the caller, only if they
//          are an authorized party AND the configurable join window allows it.
// @route   POST /api/v1/interview-sessions/:sessionId/token
// @access  Private
export const getJoinToken = async (req, res, next) => {
    try {
        const session = await InterviewSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Interview session not found' });

        const role = getCallerRole(session, req.user);
        if (!role) return res.status(403).json({ message: 'You are not authorized to join this interview' });

        if (['cancelled', 'no_show'].includes(session.completionStatus)) {
            return res.status(400).json({ message: 'This interview is cancelled and cannot be joined' });
        }

        // Submitting feedback (or a report, bundled into the same submission)
        // is this party's explicit "I'm done with this interview" signal — once
        // given, they can't rejoin the room, even if the other side hasn't
        // submitted yet and the session is still otherwise active/disputed.
        // The other party, who hasn't submitted, is unaffected by this check.
        const ownFeedback = role === 'candidate' ? session.candidateFeedback : role === 'interviewer' ? session.interviewerFeedback : null;
        if (ownFeedback) {
            return res.status(403).json({ message: 'You have already submitted feedback for this interview and cannot rejoin.' });
        }

        const settings = await Settings.getSettings();
        const now = new Date();
        const windowStart = new Date(session.scheduledStart.getTime() - settings.interviewJoinWindowMinutesBefore * 60000);
        const windowEnd = new Date(session.scheduledEnd.getTime() + settings.interviewJoinWindowMinutesAfterEnd * 60000);

        // Admins can drop in any time for moderation; candidate/interviewer are
        // gated by the configurable window.
        if (role !== 'admin' && (now < windowStart || now > windowEnd)) {
            return res.status(403).json({
                message: 'You can only join within the scheduled join window for this interview',
                windowStart,
                windowEnd,
            });
        }

        // Self-healing lazy room creation — payment/booking fulfilment never
        // blocks on LiveKit, so the room may not exist yet.
        if (!session.roomSid) {
            try {
                const room = await createInterviewRoom(session.roomName, {});
                session.roomSid = room?.sid || session.roomSid;
                await session.save();
            } catch (err) {
                console.error(`[LiveKit] Lazy room creation failed for session ${session._id}:`, err.message);
                return res.status(503).json({ message: 'Video service is temporarily unavailable. Please try again shortly.' });
            }
        }

        const token = await generateInterviewToken({
            roomName: session.roomName,
            identity: req.user._id.toString(),
            name: req.user.name,
            role,
        });

        // REST-side attendance fallback — do NOT rely solely on LiveKit's
        // participant_joined webhook to know someone showed up. Without a
        // reachable webhook URL (true for local/sandboxed setups, and a real
        // production risk if LiveKit's webhook isn't configured to point at
        // this server), attendance.*Joined would otherwise never flip true,
        // and a genuinely-completed interview would later get misclassified
        // as a no-show by handleRoomFinished — cancelling/refunding a booking
        // for an interview that actually happened. A successfully-issued
        // token to an authorized, in-window candidate/interviewer is itself
        // a verifiable "this person is joining" signal, independent of the
        // webhook. The webhook's own participantLogs/attendance writes are
        // unaffected and still run normally when it does fire.
        if (role === 'candidate' || role === 'interviewer') {
            const attendanceField = role === 'candidate' ? 'attendance.candidateJoined' : 'attendance.interviewerJoined';
            const update = { $set: { [attendanceField]: true } };
            if (!session.actualStart) update.$set.actualStart = now;
            if (session.completionStatus === 'not_started') update.$set.completionStatus = 'in_progress';
            await InterviewSession.updateOne({ _id: session._id }, update);
        }

        await logAudit({
            actor: req.user._id,
            action: 'interview_session.join_token_issued',
            targetType: 'InterviewSession',
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

// @desc    Either participant (or admin) ends the interview — disconnects the
//          LiveKit room and immediately runs end-of-room bookkeeping rather
//          than waiting on a webhook (which may be delayed or, without real
//          LiveKit credentials in dev, never arrive at all). Either side of a
//          1:1 call leaving is sufficient to end it for both — there's no
//          "let me kick the other person but keep going" case here.
// @route   POST /api/v1/interview-sessions/:sessionId/end
// @access  Private (candidate, interviewer, or admin)
export const endSession = async (req, res, next) => {
    try {
        const session = await InterviewSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Interview session not found' });

        const role = getCallerRole(session, req.user);
        if (!role) {
            return res.status(403).json({ message: 'You are not authorized to end this interview' });
        }

        if (session.roomStatus !== 'ended') {
            try {
                await endInterviewRoom(session.roomName);
            } catch (err) {
                console.warn(`[LiveKit] endRoom failed for ${session.roomName} (continuing with bookkeeping anyway):`, err.message);
            }
            await handleRoomFinished(session);
        }

        await logAudit({ actor: req.user._id, action: 'interview_session.ended', targetType: 'InterviewSession', targetId: session._id, req });

        res.status(200).json({ success: true, data: { completionStatus: session.completionStatus } });
    } catch (error) {
        next(error);
    }
};

// @desc    Submit structured post-interview feedback. The interview is only
//          marked "completed" once BOTH sides have submitted — and if either
//          side reports an issue, the session is auto-routed to the dispute
//          workflow instead of being marked completed.
// @route   POST /api/v1/interview-sessions/:sessionId/feedback
// @access  Private (candidate or interviewer)
export const submitFeedback = async (req, res, next) => {
    try {
        const session = await InterviewSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Interview session not found' });

        const role = getCallerRole(session, req.user);
        if (role !== 'candidate' && role !== 'interviewer') {
            return res.status(403).json({ message: 'Only the candidate or interviewer can submit feedback for this interview' });
        }
        if (!['awaiting_feedback', 'disputed'].includes(session.completionStatus)) {
            return res.status(400).json({ message: `Feedback cannot be submitted while the interview is ${session.completionStatus}` });
        }
        const feedbackField = role === 'interviewer' ? 'interviewerFeedback' : 'candidateFeedback';
        const otherFeedbackField = role === 'interviewer' ? 'candidateFeedback' : 'interviewerFeedback';
        if (session[feedbackField]) {
            return res.status(400).json({ message: 'You have already submitted feedback for this interview' });
        }

        const { overallRating, technicalRating, communicationRating, problemSolvingRating, recommendation, comments, issueReported, issueDescription } = req.body;
        if (!overallRating || overallRating < 1 || overallRating > 5) {
            return res.status(400).json({ message: 'overallRating must be between 1 and 5' });
        }

        const feedback = await InterviewFeedback.create({
            session: session._id,
            submittedBy: req.user._id,
            role,
            overallRating,
            technicalRating: role === 'interviewer' ? technicalRating : undefined,
            communicationRating: role === 'interviewer' ? communicationRating : undefined,
            problemSolvingRating: role === 'interviewer' ? problemSolvingRating : undefined,
            recommendation: role === 'interviewer' ? (recommendation || null) : null,
            comments: comments || '',
            issueReported: !!issueReported,
            issueDescription: issueReported ? (issueDescription || '') : '',
        });

        // Atomically claim this party's feedback slot, setting the disputed
        // status in the SAME write when an issue is reported. Doing both
        // fields in one single-document update (rather than feedback-field now,
        // status-flip later) closes the both-sides-submit-at-once race: MongoDB
        // serializes the two writes, so whichever request's update commits
        // second sees the other side's feedback field already present in its
        // own returned document, with no in-between window where the other
        // side's status hasn't caught up yet.
        const fieldUpdate = { [feedbackField]: feedback._id };
        if (issueReported) fieldUpdate.completionStatus = 'disputed';
        const updated = await InterviewSession.findOneAndUpdate(
            { _id: session._id, [feedbackField]: null },
            { $set: fieldUpdate },
            { new: true }
        );
        if (!updated) {
            await InterviewFeedback.findByIdAndDelete(feedback._id);
            return res.status(400).json({ message: 'You have already submitted feedback for this interview' });
        }

        if (issueReported) {
            // The post-interview "report an issue" flow can fire from either
            // side independently of the explicit createDispute endpoint, which
            // already guards against a duplicate open dispute — mirror that
            // guard here so two issue reports on the same session (one from
            // each party) don't create two separate disputes for the same thing.
            let dispute = await Dispute.findOne({ session: session._id, status: { $in: ['pending', 'under_review'] } });
            if (!dispute) {
                const against = role === 'interviewer' ? session.candidate : session.interviewer;
                dispute = await Dispute.create({
                    session: session._id,
                    booking: session.booking,
                    raisedBy: req.user._id,
                    raisedByRole: role,
                    against,
                    category: 'quality',
                    description: issueDescription || 'Issue reported via post-interview feedback',
                    requestedResolution: 'refund',
                });
                await logAudit({ actor: req.user._id, action: 'dispute.created', targetType: 'Dispute', targetId: dispute._id, metadata: { sessionId: session._id }, req });
            }
        } else if (updated[otherFeedbackField]) {
            // Both sides are now in — flip to completed, but only if the
            // session is still exactly where we expect (guards against a
            // concurrently-reported dispute or an admin cancellation that
            // already moved it out of 'awaiting_feedback').
            const completed = await InterviewSession.findOneAndUpdate(
                { _id: session._id, completionStatus: 'awaiting_feedback' },
                { $set: { completionStatus: 'completed' } },
                { new: true }
            );
            if (completed) {
                updated.completionStatus = 'completed';
                await Booking.findByIdAndUpdate(session.booking, { $set: { status: 'completed' } });

                // Public aggregate rating is candidate-rates-interviewer only (matches
                // the existing rateInterview semantics) — only fold in when the
                // candidate's feedback is the one carrying the public rating.
                const candidateFeedback = role === 'candidate' ? feedback : await InterviewFeedback.findById(updated.candidateFeedback);
                if (candidateFeedback) {
                    const [interview, booking] = await Promise.all([
                        Interview.findById(session.interview),
                        Booking.findById(session.booking),
                    ]);
                    if (interview && booking) {
                        applyRatingUpdate(interview, booking, candidateFeedback.overallRating);
                        await Promise.all([interview.save(), booking.save()]);
                    }
                }
            }
        }

        await logAudit({ actor: req.user._id, action: 'interview_session.feedback_submitted', targetType: 'InterviewSession', targetId: session._id, metadata: { role, issueReported: !!issueReported }, req });

        res.status(201).json({ success: true, data: { completionStatus: updated.completionStatus, feedback } });
    } catch (error) {
        next(error);
    }
};
