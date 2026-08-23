import InterviewSession from '../models/InterviewSession.js';
import Booking from '../models/Booking.js';
import Interview from '../models/Interview.js';
import User from '../models/User.js';
import { createInterviewRoom } from './livekit.js';
import { sendBookingConfirmation } from './interviewMailTemplates.js';

/**
 * Creates the InterviewSession (LiveKit operational record) for a just-confirmed
 * booking, and back-links it onto the Booking. Called from both booking-confirmation
 * paths: interviewController.bookSlot (free/subscription) and fulfillOrder.js's
 * 'interview' case (paid via Cashfree).
 *
 * Room creation is best-effort: a transient LiveKit outage must never roll back
 * a successful slot claim / payment. If it fails here, `getJoinToken` (Phase 1
 * controller) lazily retries room creation on first join attempt.
 *
 * @param {object} booking   - the just-created Booking document (interview type)
 * @param {object} slot      - the embedded Interview.slots subdocument that was booked
 * @param {import('mongoose').ClientSession|null} dbSession - active transaction session, if any
 */
export async function createSessionForBooking(booking, slot, dbSession = null) {
    const opts = dbSession ? { session: dbSession } : {};
    const roomName = `interview-${booking._id}`;

    const [session] = await InterviewSession.create([{
        booking: booking._id,
        interview: booking.interview,
        slotId: booking.slot,
        candidate: booking.user,
        interviewer: booking.seller,
        roomName,
        scheduledStart: slot.startTime,
        scheduledEnd: slot.endTime,
    }], opts);

    await Booking.findByIdAndUpdate(booking._id, { $set: { session: session._id } }, opts);

    try {
        const room = await createInterviewRoom(roomName, {});
        session.roomSid = room?.sid || null;
        session.roomStatus = 'scheduled';
        await session.save(opts);
    } catch (err) {
        console.error(`[LiveKit] Room creation failed for booking ${booking._id} (will lazily retry on join):`, err.message);
    }

    // Confirmation email + ICS + in-app notification to both parties — never
    // lets a notification failure affect the booking/payment that already succeeded.
    try {
        const [candidate, interviewer, interview] = await Promise.all([
            User.findById(booking.user).select('name email'),
            User.findById(booking.seller).select('name email'),
            Interview.findById(booking.interview).select('domain'),
        ]);
        if (candidate && interviewer) {
            await sendBookingConfirmation({ session, domain: interview?.domain || 'Mock Interview', candidate, interviewer });
        }
    } catch (err) {
        console.error(`[Notifications] Failed to send booking confirmation for booking ${booking._id}:`, err.message);
    }

    return session;
}
