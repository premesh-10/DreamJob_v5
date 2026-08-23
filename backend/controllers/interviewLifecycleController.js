import InterviewSession from '../models/InterviewSession.js';
import Booking from '../models/Booking.js';
import Interview from '../models/Interview.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import { getCallerRole } from '../utils/sessionAccess.js';
import { endInterviewRoom } from '../utils/livekit.js';
import { applyRefundAndSync } from '../utils/applyRefundAndSync.js';
import { sendRescheduleNotice, sendCancellationNotice } from '../utils/interviewMailTemplates.js';
import { logAudit } from '../utils/auditLog.js';

const ACTIVE_STATUSES = ['not_started', 'in_progress', 'awaiting_feedback'];

// @desc    Propose/apply a reschedule to an existing open slot on the same
//          Interview profile (the interviewer can first add a fresh slot via
//          the existing addSlot endpoint, then reschedule into it — composing
//          existing primitives instead of a parallel "custom datetime" path).
// @route   PATCH /api/v1/interview-sessions/:sessionId/reschedule
// @access  Private (candidate or interviewer)
export const requestReschedule = async (req, res, next) => {
    try {
        const { newSlotId, reason } = req.body;
        if (!newSlotId) return res.status(400).json({ message: 'newSlotId is required' });

        const session = await InterviewSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Interview session not found' });

        const role = getCallerRole(session, req.user);
        if (!role) return res.status(403).json({ message: 'You are not authorized to reschedule this interview' });
        if (!ACTIVE_STATUSES.includes(session.completionStatus)) {
            return res.status(400).json({ message: `Cannot reschedule an interview that is ${session.completionStatus}` });
        }

        const interview = await Interview.findById(session.interview);
        if (!interview) return res.status(404).json({ message: 'Interview profile not found' });

        const newSlot = interview.slots.id(newSlotId);
        if (!newSlot) return res.status(404).json({ message: 'Target slot not found' });
        if (newSlot.isBooked) return res.status(409).json({ message: 'That slot is already booked' });

        // Atomically claim the new slot before freeing the old one.
        const claimed = await Interview.findOneAndUpdate(
            { _id: interview._id, 'slots._id': newSlotId, 'slots.isBooked': false },
            { $set: { 'slots.$.isBooked': true } }
        );
        if (!claimed) return res.status(409).json({ message: 'That slot was just booked by someone else' });

        const fromStart = session.scheduledStart;
        const fromEnd = session.scheduledEnd;
        const oldSlotId = session.slotId;
        session.rescheduleHistory.push({
            fromStart, fromEnd, toStart: newSlot.startTime, toEnd: newSlot.endTime,
            requestedBy: req.user._id, reason: reason || '', at: new Date(),
        });
        session.scheduledStart = newSlot.startTime;
        session.scheduledEnd = newSlot.endTime;
        session.slotId = newSlot._id;

        // Only free the old slot once the session itself has durably committed
        // to the new one — otherwise a failed save here would leave the old
        // slot free, the new slot claimed, and the session still pointing at
        // neither consistently (and the new slot permanently un-bookable).
        try {
            await session.save();
        } catch (err) {
            await Interview.updateOne(
                { _id: interview._id, 'slots._id': newSlotId },
                { $set: { 'slots.$.isBooked': false } }
            );
            throw err;
        }

        await Interview.updateOne(
            { _id: interview._id, 'slots._id': oldSlotId },
            { $set: { 'slots.$.isBooked': false } }
        );

        await Booking.findByIdAndUpdate(session.booking, { $set: { slot: newSlot._id } });

        const [candidate, interviewer] = await Promise.all([
            User.findById(session.candidate).select('name email'),
            User.findById(session.interviewer).select('name email'),
        ]);
        try {
            await sendRescheduleNotice({ session, domain: interview.domain, candidate, interviewer, sequence: session.rescheduleHistory.length });
        } catch (err) {
            console.error(`[Notifications] Reschedule notice failed for session ${session._id}:`, err.message);
        }

        await logAudit({ actor: req.user._id, action: 'interview_session.rescheduled', targetType: 'InterviewSession', targetId: session._id, metadata: { fromStart, toStart: newSlot.startTime }, req });

        res.status(200).json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel an interview — frees the slot, ends the room, and issues a
//          tiered refund (full vs partial, per Settings) only when money was
//          actually paid. Booking/session status is synced automatically.
// @route   PATCH /api/v1/interview-sessions/:sessionId/cancel
// @access  Private (candidate, interviewer, or admin)
export const cancelSession = async (req, res, next) => {
    try {
        const { reason } = req.body;
        const session = await InterviewSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ message: 'Interview session not found' });

        const role = getCallerRole(session, req.user);
        if (!role) return res.status(403).json({ message: 'You are not authorized to cancel this interview' });
        if (!ACTIVE_STATUSES.includes(session.completionStatus)) {
            return res.status(400).json({ message: `Cannot cancel an interview that is ${session.completionStatus}` });
        }

        const booking = await Booking.findById(session.booking);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        if (session.roomStatus === 'active') {
            try { await endInterviewRoom(session.roomName); } catch (err) { console.warn(`[LiveKit] endRoom failed during cancel for ${session.roomName}:`, err.message); }
        }

        await Interview.updateOne(
            { _id: session.interview, 'slots._id': session.slotId },
            { $set: { 'slots.$.isBooked': false } }
        );

        const settings = await Settings.getSettings();
        const hoursUntilStart = (new Date(session.scheduledStart) - new Date()) / (1000 * 60 * 60);
        const fullRefund = hoursUntilStart >= settings.cancellationFullRefundHoursBefore;
        const refundAmount = booking.amountPaid > 0
            ? Math.round((fullRefund ? booking.amountPaid : booking.amountPaid * settings.cancellationPartialRefundPercent / 100) * 100) / 100
            : 0;

        session.completionStatus = 'cancelled';
        session.cancellation = { cancelledBy: req.user._id, cancelledAt: new Date(), reason: reason || '', refundIssued: false };
        session.roomStatus = session.roomStatus === 'ended' ? 'ended' : 'expired';
        await session.save();

        booking.status = 'cancelled';
        await booking.save();

        let refundNote = '';
        let refundIssued = false;
        if (refundAmount > 0) {
            const refundResult = await applyRefundAndSync({
                booking, session,
                amount: refundAmount,
                note: `Interview cancelled by ${req.user.name}${reason ? `: ${reason}` : ''}`,
            });
            refundIssued = refundResult.success;
            refundNote = refundResult.success
                ? `A ${fullRefund ? 'full' : `${settings.cancellationPartialRefundPercent}%`} refund of ₹${refundAmount.toFixed(2)} has been initiated.`
                : 'A refund was due but could not be initiated automatically — our team will process it manually.';
        }

        const interview = await Interview.findById(session.interview).select('domain');
        const [candidate, interviewer] = await Promise.all([
            User.findById(session.candidate).select('name email'),
            User.findById(session.interviewer).select('name email'),
        ]);
        try {
            await sendCancellationNotice({ session, domain: interview?.domain || 'Mock Interview', candidate, interviewer, cancelledByName: req.user.name, refundNote });
        } catch (err) {
            console.error(`[Notifications] Cancellation notice failed for session ${session._id}:`, err.message);
        }

        await logAudit({ actor: req.user._id, action: 'interview_session.cancelled', targetType: 'InterviewSession', targetId: session._id, metadata: { refundAmount, refundIssued, reason }, req });

        res.status(200).json({ success: true, data: { completionStatus: session.completionStatus, refundAmount } });
    } catch (error) {
        next(error);
    }
};
