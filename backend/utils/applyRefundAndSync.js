import Booking from '../models/Booking.js';
import { refundPayment } from './refund.js';

/**
 * Wraps refundPayment() and follows up with the status sync it doesn't do on
 * its own — Booking.paymentStatus and the InterviewSession's cancellation
 * record. Every interview-refund call site must go through this (cancellation,
 * dispute resolution, admin overrides) — refundPayment() should never be
 * called bare for interviews, otherwise "if a refund is processed, status
 * should automatically update" silently doesn't happen.
 */
export async function applyRefundAndSync({ booking, session = null, amount, note }) {
    const result = await refundPayment({
        userId: booking.user,
        type: 'interview',
        itemId: booking.interview,
        amount,
        note,
    });

    if (result.success) {
        await Booking.findByIdAndUpdate(booking._id, { $set: { paymentStatus: 'refunded' } });
        if (session) {
            session.cancellation.refundIssued = true;
            await session.save();
        }
    }

    return result;
}
