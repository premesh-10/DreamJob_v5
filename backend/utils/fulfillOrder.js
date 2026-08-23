import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import PaymentOrder from '../models/PaymentOrder.js';
import Seller from '../models/Seller.js';
import Booking from '../models/Booking.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Interview from '../models/Interview.js';
import Webinar from '../models/Webinar.js';
import WebinarRegistration from '../models/WebinarRegistration.js';
import { createSessionForBooking } from './interviewSessionLifecycle.js';
import { redeemCoupon } from './coupon.js';
import { getScheduleWindow } from './webinarSchedule.js';
import { sendRegistrationConfirmation } from './webinarMailTemplates.js';
import { applyRefundAndSync } from './applyRefundAndSync.js';
import { sendBookingConflictRefundNotice } from './interviewMailTemplates.js';
import { logAudit } from './auditLog.js';
import { generateOrderId, generateInvoiceNumber } from './generateOrderId.js';

/**
 * fulfillOrder
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for fulfilling a confirmed Cashfree payment.
 * Supports: subscription | course | interview | webinar
 *
 * GUARANTEES:
 *  1. IDEMPOTENT — atomic findOneAndUpdate with { processed: false } ensures only
 *     one caller ever succeeds. Duplicates are ignored.
 *  2. FALLBACK — Atlas M0/M2/M5 don't support multi-document transactions.
 *     We try with a session, fall back to sequential writes if unsupported.
 *     Safe because idempotency is already guaranteed by the atomic claim.
 *
 * @param {string} cashfreeOrderId
 * @param {string} processedBy  'webhook' | 'verify'
 * @returns {{ fulfilled: boolean, skipped: boolean, error: Error | null }}
 */
export async function fulfillOrder(cashfreeOrderId, processedBy = 'webhook') {

    // ── Step 1: Atomically claim this order ─────────────────────────────────
    const order = await PaymentOrder.findOneAndUpdate(
        { cashfreeOrderId, processed: false },
        {
            $set: {
                processed: true,
                processedAt: new Date(),
                processedBy,
                orderStatus: 'PAID',
            },
        },
        { new: false }
    );

    if (!order) {
        // Already claimed by another caller — safe to skip
        return { fulfilled: false, skipped: true, error: null };
    }

    // ── Step 1b: Generate immutable Order ID + Invoice Number ────────────────
    // Done immediately after the atomic claim so the order is never left without
    // these identifiers even if the fulfilment step below fails and the claim is
    // reverted. The $inc counter is not rolled back on failure — that's acceptable
    // (a gap in the sequence is far preferable to a duplicate ID).
    try {
        const [newOrderId, newInvoiceNumber] = await Promise.all([
            generateOrderId(order.type),
            generateInvoiceNumber(),
        ]);
        await PaymentOrder.findByIdAndUpdate(order._id, {
            $set: { orderId: newOrderId, invoiceNumber: newInvoiceNumber },
        });
        order.orderId = newOrderId;
        order.invoiceNumber = newInvoiceNumber;
    } catch (idErr) {
        console.error(`[Payment] ⚠️  Order ID generation failed for ${cashfreeOrderId}:`, idErr.message);
        // Non-fatal — continue with fulfilment; orderId will be null and can be
        // backfilled by a support script. This preserves the revenue path.
    }

    // ── Step 2: Execute fulfilment (with session fallback) ───────────────────
    try {
        await runFulfilment(order, cashfreeOrderId, processedBy);
        await resolveInterviewSlotConflictIfAny(order);
        return { fulfilled: true, skipped: false, error: null };

    } catch (err) {
        const isTransactionUnsupported =
            err.code === 20 || err.code === 263 ||
            /Transaction|replica set|replication/i.test(err.message || '');

        if (isTransactionUnsupported) {
            console.warn(`[Payment] ⚠️  Sessions unsupported. Falling back to sequential writes for ${cashfreeOrderId}.`);
            try {
                await runFulfilmentWithoutSession(order, cashfreeOrderId);
                await resolveInterviewSlotConflictIfAny(order);
                return { fulfilled: true, skipped: false, error: null };
            } catch (fallbackErr) {
                await revertClaim(order);
                console.error(`[Payment] ❌ fulfillOrder (fallback) failed:`, fallbackErr.message);
                return { fulfilled: false, skipped: false, error: fallbackErr };
            }
        }

        await revertClaim(order);
        console.error(`[Payment] ❌ fulfillOrder failed:`, err.message);
        return { fulfilled: false, skipped: false, error: err };
    }
}

// Auto-refunds and notifies the candidate when applyFulfilment flagged a
// slot-conflict booking (order._interviewSlotConflictBookingId) — run after
// the transaction has committed, since it makes a real external Cashfree API
// call that must never be held inside a DB transaction. Best-effort: the
// payment is already genuinely fulfilled at this point (booking + transaction
// records exist), so a failure here is logged for manual follow-up rather
// than un-fulfilling anything.
async function resolveInterviewSlotConflictIfAny(order) {
    const bookingId = order._interviewSlotConflictBookingId;
    if (!bookingId) return;

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        const result = await applyRefundAndSync({
            booking,
            amount: booking.amountPaid,
            note: 'Automatic full refund — slot was claimed by a concurrent booking before this payment could be fulfilled',
        });
        booking.status = 'cancelled';
        await booking.save();

        const [interview, candidate] = await Promise.all([
            Interview.findById(booking.interview).select('domain'),
            User.findById(booking.user).select('name email'),
        ]);
        if (candidate) {
            const refundNote = result.success
                ? `You have been automatically refunded ₹${booking.amountPaid.toFixed(2)} in full.`
                : 'A refund was due but could not be initiated automatically — our support team will process it manually.';
            await sendBookingConflictRefundNotice({ candidate, domain: interview?.domain || 'Mock Interview', refundNote });
        }

        await logAudit({ actor: null, action: 'interview_booking.slot_conflict_refunded', targetType: 'Booking', targetId: booking._id, metadata: { refundIssued: result.success } });
    } catch (err) {
        console.error(`[Payment] Failed to auto-resolve slot-conflict booking ${bookingId}:`, err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
async function runFulfilment(order, cashfreeOrderId, processedBy) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const txRecord = await applyFulfilment(order, cashfreeOrderId, session);
        await PaymentOrder.findByIdAndUpdate(
            order._id,
            { $set: { transaction: txRecord[0]._id } },
            { session }
        );
        await session.commitTransaction();
        console.log(`[Payment] ✅ Order ${cashfreeOrderId} fulfilled via ${processedBy} | type=${order.type}`);
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
    await redeemCouponBestEffort(order);
}

async function runFulfilmentWithoutSession(order, cashfreeOrderId) {
    const txRecord = await applyFulfilment(order, cashfreeOrderId, null);
    await PaymentOrder.findByIdAndUpdate(order._id, { $set: { transaction: txRecord[0]._id } });
    console.log(`[Payment] ✅ Order ${cashfreeOrderId} fulfilled (no-session) | type=${order.type}`);
    await redeemCouponBestEffort(order);
}

// Coupon usedCount is pure bookkeeping at this point — money has already moved,
// so a failure here must never undo or fail the fulfilment itself.
async function redeemCouponBestEffort(order) {
    if (!order.couponCode) return;
    try {
        await redeemCoupon(order.couponCode);
    } catch (err) {
        console.error(`[Payment] Failed to mark coupon ${order.couponCode} as redeemed:`, err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core logic: applies the actual DB writes for each payment type
// ─────────────────────────────────────────────────────────────────────────────
async function applyFulfilment(order, cashfreeOrderId, session) {
    const opts = session ? { session } : {};

    switch (order.type) {

        // ── Subscription ─────────────────────────────────────────────────────
        case 'subscription': {
            const updatedUser = await User.findByIdAndUpdate(
                order.user,
                {
                    $set: {
                        'subscription.plan': order.plan,
                        'subscription.validUntil': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    },
                },
                { new: true, ...opts }
            );
            if (!updatedUser) throw new Error(`User ${order.user} not found during subscription fulfilment`);

            return Transaction.create([{
                user: order.user,
                type: 'debit',
                amount: order.amount,
                description: `${order.plan} Subscription Purchase`,
                status: 'completed',
                cashfreeOrderId,
            }], opts);
        }

        // ── Course Purchase ───────────────────────────────────────────────────
        case 'course': {
            const course = await Course.findById(order.itemId).session(session);
            if (!course) throw new Error(`Course ${order.itemId} not found during fulfilment`);

            // Guard against double-crediting: if the user somehow has two PAID orders
            // for the same course (e.g. two tabs both completing payment), only the
            // first one to reach here grants access / books / credits the seller.
            const alreadyEnrolled = course.enrolledUsers.includes(order.user);
            if (!alreadyEnrolled) {
                course.enrolledUsers.push(order.user);
                await course.save(opts);

                // Additive — Enrollment is the new source of truth for access/progress,
                // kept alongside enrolledUsers (not replacing it) per the non-destructive
                // rebuild rule. Guarded the same way enrolledUsers already is above.
                const existingEnrollment = await Enrollment.findOne({ course: course._id, user: order.user }).session(session);
                if (!existingEnrollment) {
                    await Enrollment.create([{ course: course._id, user: order.user, source: 'purchase', status: 'active' }], opts);
                    await Course.findByIdAndUpdate(course._id, { $inc: { enrollmentCount: 1 } }, opts);
                }

                await Booking.create([{
                    user: order.user,
                    type: 'course',
                    course: course._id,
                    seller: course.seller,
                    amountPaid: order.amount,
                    paymentStatus: 'paid',
                    enrollmentType: 'purchase',
                    status: 'confirmed',
                    orderId: order.orderId || null,
                }], opts);

                const sellerRecord = await Seller.findOne({ user: course.seller }).session(session);
                if (sellerRecord) {
                    sellerRecord.earnings += order.amount;
                    sellerRecord.totalStudents += 1;
                    await sellerRecord.save(opts);
                    // Distinct cashfreeOrderId suffix — the buyer's debit Transaction below
                    // already owns the bare cashfreeOrderId under Transaction's unique sparse index.
                    await Transaction.create([{
                        user: course.seller,
                        type: 'credit',
                        amount: order.amount,
                        description: `Earnings from course: ${course.title}`,
                        status: 'completed',
                        cashfreeOrderId: `${cashfreeOrderId}#credit`,
                    }], opts);
                }
            } else {
                console.warn(`[Payment] User ${order.user} already enrolled in course ${course._id} — skipping duplicate booking/earnings, payment will need a refund.`);
            }

            // Always record the user's debit so the payment itself is never lost,
            // even if access/booking/earnings were skipped as a duplicate above.
            return Transaction.create([{
                user: order.user,
                type: 'debit',
                amount: order.amount,
                description: `Course purchase: ${course.title}`,
                status: 'completed',
                cashfreeOrderId,
            }], opts);
        }

        // ── Interview Booking ─────────────────────────────────────────────────
        case 'interview': {
            const interview = await Interview.findById(order.itemId).session(session);
            if (!interview) throw new Error(`Interview ${order.itemId} not found during fulfilment`);

            const slotId = order.itemMeta?.slotId;
            let slot = slotId ? interview.slots.id(slotId) : null;
            let slotConflict = false;

            if (slot) {
                // Atomically claim the slot — createCheckoutSession already rejected
                // already-booked slots at checkout time, but a second payment racing
                // in at the same instant is still possible in theory. If the atomic
                // claim fails here, the slot was taken by another fulfilment first;
                // we still record the booking below (paymentStatus stays 'paid' since
                // money was genuinely charged) but mark it 'pending' so support can
                // see it needs manual resolution (reschedule or refund) instead of
                // silently double-booking the slot.
                const claim = await Interview.findOneAndUpdate(
                    { _id: interview._id, 'slots._id': slotId, 'slots.isBooked': false },
                    { $set: { 'slots.$.isBooked': true } },
                    opts
                );
                slotConflict = !claim;
                if (slotConflict) {
                    console.error(`[Payment] ⚠️ Slot ${slotId} on interview ${interview._id} was already booked when fulfilling order ${cashfreeOrderId}. Booking created as 'pending' for manual follow-up.`);
                }
            }

            const [booking] = await Booking.create([{
                user: order.user,
                type: 'interview',
                interview: interview._id,
                slot: slotId || null,
                seller: interview.interviewer,
                amountPaid: order.amount,
                paymentStatus: 'paid',
                meetingLink: slotConflict ? '' : (slot?.meetingLink || ''),
                status: slotConflict ? 'pending' : 'confirmed',
                orderId: order.orderId || null,
            }], opts);

            // Auto-create the LiveKit room/session now that the booking is genuinely
            // confirmed (never on a 'pending' slot-conflict booking — no session
            // until the conflict is resolved below).
            if (!slotConflict && slot) {
                await createSessionForBooking(booking, slot, session);
            }

            // Proof-of-payment identity signal for the candidate (decision #1 — no
            // KYC infra exists; a real charge is treated as an identity signal).
            await User.findByIdAndUpdate(order.user, { $set: { identityVerified: true } }, opts);

            // Credit seller earnings — never on a slot-conflict booking, since
            // that booking is about to be auto-refunded in full once this
            // transaction commits; the seller never actually delivers anything
            // against it.
            if (!slotConflict) {
                const sellerRecord = await Seller.findOne({ user: interview.interviewer }).session(session);
                if (sellerRecord) {
                    sellerRecord.earnings += order.amount;
                    await sellerRecord.save(opts);
                    // Distinct cashfreeOrderId suffix — the buyer's debit Transaction below
                    // already owns the bare cashfreeOrderId under Transaction's unique sparse index.
                    await Transaction.create([{
                        user: interview.interviewer,
                        type: 'credit',
                        amount: order.amount,
                        description: `Interview booking revenue`,
                        status: 'completed',
                        cashfreeOrderId: `${cashfreeOrderId}#credit`,
                    }], opts);
                }
            } else {
                // Stash for a post-commit auto-refund — issuing the actual Cashfree
                // refund call inside this DB transaction would hold it open against
                // an external HTTP round-trip, and a transaction abort after the
                // refund call succeeded would leave money refunded with no booking
                // record of it. Handled by fulfillOrder() after commit instead.
                order._interviewSlotConflictBookingId = booking._id;
            }

            return Transaction.create([{
                user: order.user,
                type: 'debit',
                amount: order.amount,
                description: `Interview booking`,
                status: 'completed',
                cashfreeOrderId,
            }], opts);
        }

        // ── Webinar Registration ──────────────────────────────────────────────
        case 'webinar': {
            const webinar = await Webinar.findById(order.itemId).session(session);
            if (!webinar) throw new Error(`Webinar ${order.itemId} not found during fulfilment`);

            const alreadyRegistered = webinar.registeredUsers.some(id => id.toString() === order.user.toString());
            if (!alreadyRegistered) {
                webinar.registeredUsers.push(order.user);
                webinar.payments.push({ user: order.user, amount: order.amount });
                webinar.registrationCount = webinar.registeredUsers.length;
                await webinar.save(opts);

                const calendarUid = `webinar-reg-${webinar._id}-${order.user}@dreamjob`;
                await WebinarRegistration.create([{
                    webinar: webinar._id,
                    user: order.user,
                    status: 'registered',
                    payment: { amount: order.amount, transactionRef: cashfreeOrderId },
                    approvalStatus: webinar.settings?.registration?.requiresApproval ? 'pending' : 'auto_approved',
                    calendarUid,
                }], opts);

                if (webinar.settings?.notifications?.confirmationEmail !== false) {
                    User.findById(order.user).select('name email').then(recipient => {
                        if (!recipient) return;
                        const { start, end } = getScheduleWindow(webinar);
                        return sendRegistrationConfirmation({
                            webinar, start, end, recipient, calendarUid,
                            settings: webinar.settings?.notifications || {},
                        });
                    }).catch(err => console.error('[Webinar] sendRegistrationConfirmation (paid) failed:', err.message));
                }

                const sellerRecord = await Seller.findOne({ user: webinar.seller }).session(session);
                if (sellerRecord) {
                    sellerRecord.earnings += order.amount;
                    await sellerRecord.save(opts);
                    // Distinct cashfreeOrderId suffix — the buyer's debit Transaction below
                    // already owns the bare cashfreeOrderId under Transaction's unique sparse index.
                    await Transaction.create([{
                        user: webinar.seller,
                        type: 'credit',
                        amount: order.amount,
                        description: `Webinar registration income: ${webinar.name}`,
                        status: 'completed',
                        cashfreeOrderId: `${cashfreeOrderId}#credit`,
                    }], opts);
                }
            } else {
                console.warn(`[Payment] User ${order.user} already registered for webinar ${webinar._id} — skipping duplicate registration/earnings, payment will need a refund.`);
            }

            return Transaction.create([{
                user: order.user,
                type: 'debit',
                amount: order.amount,
                description: `Webinar registration: ${webinar.name}`,
                status: 'completed',
                cashfreeOrderId,
            }], opts);
        }

        default:
            throw new Error(`Unknown order type: ${order.type}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
async function revertClaim(order) {
    await PaymentOrder.findByIdAndUpdate(order._id, {
        $set: { processed: false, processedAt: null, processedBy: null, orderStatus: 'ACTIVE' },
    }).catch(e => console.error('[Payment] Failed to revert claim:', e.message));
}
