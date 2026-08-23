/**
 * paymentController.js — Cashfree Payment Gateway Integration
 * ─────────────────────────────────────────────────────────────────────────────
 * Supports payment types: subscription | course | interview | webinar
 * All prices are fetched server-side from the DB — never trusted from client.
 *
 * Robustness features:
 *  ✅ Idempotent order processing via atomic findOneAndUpdate on PaymentOrder
 *  ✅ MongoDB session/transaction for multi-document writes (fallback for M0)
 *  ✅ Webhook signature ALWAYS verified (never skipped)
 *  ✅ Full webhook audit log stored in WebhookEvent collection
 *  ✅ PaymentOrder record created at checkout time for full audit trail
 *  ✅ Handles PAYMENT_SUCCESS, PAYMENT_FAILED, PAYMENT_PENDING, PAYMENT_USER_DROPPED,
 *     REFUND_STATUS, and ORDER_PAID webhook events
 *  ✅ verifyPayment uses the same fulfillOrder atomic utility as the webhook
 *  ✅ Blocks duplicate checkout sessions for the same item while one is pending
 *  ✅ Validates item availability (e.g. interview slot) before charging, not just after
 *  ✅ A periodic reconciliation sweep (utils/paymentReconciliation.js) catches orders
 *     that never reach a webhook or verify call (interrupted/abandoned transactions)
 *  ✅ Input sanitized — uses user.mobile (correct field name)
 */

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { cashfree } from '../config/cashfree.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Interview from '../models/Interview.js';
import Webinar from '../models/Webinar.js';
import PaymentOrder from '../models/PaymentOrder.js';
import WebhookEvent from '../models/WebhookEvent.js';
import { fulfillOrder } from '../utils/fulfillOrder.js';
import { applySubscriptionDiscount, hasActiveSubscription, revokeSubscription } from '../utils/subscription.js';
import { validateCouponForOrder } from '../utils/coupon.js';
import { logAudit } from '../utils/auditLog.js';
import Notification from '../models/Notification.js';

// How long a Cashfree order stays payable before it expires. Kept in sync with the
// order_expiry_time sent to Cashfree and the duplicate-active-order guard below.
const ORDER_EXPIRY_MINUTES = 25;

// ── Subscription Plan Prices (INR) ──────────────────────────────────────────
export const PLAN_PRICES_INR = {
    Silver: 999,
    Ruby: 1999,
    Platinum: 2999,
};

/**
 * sanitizePhone — ensures the phone number is valid for Cashfree.
 * Cashfree requires exactly 10 digits (Indian) e.g. 9090407368.
 * Handles: '+919090407368', '91 9090 407368', '9090-407-368', '9090407368'
 * Falls back to a safe placeholder if the number is missing or invalid.
 */
function sanitizePhone(phone) {
    if (!phone) return '9999999999';
    // Remove all non-digit characters (spaces, dashes, dots, parentheses)
    let digits = String(phone).replace(/\D/g, '');
    // Strip leading country code: +91 becomes 91 becomes nothing
    if (digits.length === 12 && digits.startsWith('91')) {
        digits = digits.slice(2);
    }
    // If it's exactly 10 digits and starts with 6-9, it's a valid Indian mobile
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
        return digits;
    }
    // Fallback — Cashfree accepts this as a valid placeholder
    return '9999999999';
}


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a Cashfree Order
// @route   POST /api/v1/payments/create-checkout-session
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a Cashfree Order for any product type
// @route   POST /api/v1/payments/create-checkout-session
// @access  Private
// Body: { type, plan?, itemId?, itemMeta?, couponCode? }
// ─────────────────────────────────────────────────────────────────────────────
export const createCheckoutSession = async (req, res, next) => {
    try {
        const { type, plan, itemId, itemMeta, couponCode } = req.body;

        if (!['subscription', 'course', 'interview', 'webinar'].includes(type)) {
            res.status(400);
            throw new Error('Invalid payment type. Must be: subscription | course | interview | webinar');
        }
        if (type !== 'subscription' && !mongoose.Types.ObjectId.isValid(itemId)) {
            res.status(400);
            throw new Error('A valid itemId is required for this payment type');
        }

        // ── 1. Look up user ──────────────────────────────────────────────────
        const user = await User.findById(req.user.id).select('name email mobile subscription acceptedInterviewGuidelinesAt');
        if (!user) { res.status(404); throw new Error('User not found'); }

        // ── 2. Determine price from DB (never trust client-sent amount) ───────
        let orderAmount;
        let orderNote;
        let resolvedItemId = itemId || null;

        if (type === 'subscription') {
            if (!plan || !PLAN_PRICES_INR[plan]) {
                res.status(400);
                throw new Error(`Invalid plan. Valid: ${Object.keys(PLAN_PRICES_INR).join(', ')}`);
            }
            // Block purchase when an active subscription already exists.
            // Use the fresh DB-fetched user (not req.user from token) to avoid stale state.
            if (hasActiveSubscription(user)) {
                return res.status(409).json({
                    success: false,
                    code: 'SUBSCRIPTION_ALREADY_ACTIVE',
                    message: 'You already have an active subscription. Only one active subscription is allowed at a time.',
                    data: {
                        plan: user.subscription.plan,
                        validUntil: user.subscription.validUntil,
                    },
                });
            }
            orderAmount = PLAN_PRICES_INR[plan];
            orderNote = `${plan} Subscription`;

        } else if (type === 'course') {
            const course = await Course.findById(itemId).select('title price seller enrolledUsers');
            if (!course) { res.status(404); throw new Error('Course not found'); }
            if (course.enrolledUsers.map(String).includes(req.user.id)) {
                res.status(400); throw new Error('You are already enrolled in this course');
            }
            if (!course.price || course.price <= 0) {
                res.status(400); throw new Error('This item is free — use direct enrollment instead of checkout');
            }
            orderAmount = applySubscriptionDiscount(course.price, user);
            orderNote = `Course: ${course.title}`;
            resolvedItemId = course._id;

        } else if (type === 'interview') {
            const interview = await Interview.findById(itemId).select('price interviewer slots');
            if (!interview) { res.status(404); throw new Error('Interview session not found'); }

            if (!user.acceptedInterviewGuidelinesAt) {
                if (!itemMeta?.acceptGuidelines) {
                    res.status(400);
                    throw new Error('You must agree to the Interview Conduct Guidelines before booking');
                }
                await User.findByIdAndUpdate(req.user.id, { acceptedInterviewGuidelinesAt: new Date() });
            }

            // A slot must be selected and still available — checked again atomically
            // at fulfilment time, but rejecting early here avoids charging a user
            // for a slot someone else has already taken.
            const slotId = itemMeta?.slotId;
            if (!slotId) { res.status(400); throw new Error('Please select a time slot before checkout'); }
            const slot = interview.slots.id(slotId);
            if (!slot) { res.status(404); throw new Error('Selected slot not found'); }
            if (slot.isBooked) { res.status(409); throw new Error('This slot has already been booked. Please pick another slot.'); }
            if (new Date(slot.startTime) <= new Date()) {
                res.status(400); throw new Error('This slot has already passed and can no longer be booked');
            }
            if (!interview.price || interview.price <= 0) {
                res.status(400); throw new Error('This item is free — use direct enrollment instead of checkout');
            }

            orderAmount = applySubscriptionDiscount(interview.price, user);
            orderNote = `Interview Booking`;
            resolvedItemId = interview._id;

        } else if (type === 'webinar') {
            const webinar = await Webinar.findById(itemId).select('name price seatCapacity registeredUsers isActive');
            if (!webinar) { res.status(404); throw new Error('Webinar not found'); }
            if (!webinar.isActive) { res.status(400); throw new Error('Webinar is not available'); }
            if (webinar.registeredUsers.map(String).includes(req.user.id)) {
                res.status(400); throw new Error('Already registered for this webinar');
            }
            if (!webinar.price || webinar.price <= 0) {
                res.status(400); throw new Error('This item is free — use direct enrollment instead of checkout');
            }
            orderAmount = webinar.price;
            orderNote = `Webinar: ${webinar.name}`;
            resolvedItemId = webinar._id;
        }

        // ── 2b. Apply a coupon (course/interview only — re-validated fully here,
        // never trusting any discount/finalAmount the client may have previewed) ──
        let appliedCouponCode = null;
        if (couponCode && (type === 'course' || type === 'interview')) {
            const applicableTo = type === 'course' ? 'courses' : 'interviews';
            try {
                const result = await validateCouponForOrder(couponCode, orderAmount, applicableTo);
                orderAmount = result.finalAmount;
                appliedCouponCode = result.coupon.code;
            } catch (err) {
                res.status(400);
                throw err;
            }
        }

        // ── 2c. Cashfree requires a positive order amount — a 100%-off coupon
        // stacked with a subscription discount could otherwise zero it out ──────
        orderAmount = Math.round(Number(orderAmount) * 100) / 100;
        if (!Number.isFinite(orderAmount)) {
            res.status(400);
            throw new Error('Invalid order amount');
        }
        if (orderAmount <= 0) orderAmount = 1;

        // ── 2d. Block duplicate orders — if the user already has an unexpired
        // unpaid order for the exact same item, don't create a second one ───────
        const expiryThreshold = new Date(Date.now() - ORDER_EXPIRY_MINUTES * 60 * 1000);
        const existingOrder = await PaymentOrder.findOne({
            user: req.user.id,
            type,
            itemId: resolvedItemId,
            ...(type === 'subscription' ? { plan } : {}),
            processed: false,
            orderStatus: { $in: ['ACTIVE', 'PENDING'] },
            createdAt: { $gte: expiryThreshold },
        }).sort({ createdAt: -1 });

        if (existingOrder) {
            res.status(409);
            const err = new Error('You already have a pending payment for this. Please complete it, or wait a few minutes for it to expire before trying again.');
            err.existingOrderId = existingOrder.cashfreeOrderId;
            throw err;
        }

        // ── 3. Generate unique Cashfree-compatible order ID ──────────────────
        const cashfreeOrderId = `DJ_${uuidv4().replace(/-/g, '').substring(0, 24)}`;

        // ── 4. Build Cashfree order request ──────────────────────────────────
        const orderRequest = {
            order_id: cashfreeOrderId,
            order_amount: orderAmount,
            order_currency: 'INR',
            order_note: orderNote,
            order_expiry_time: new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000).toISOString(),
            customer_details: {
                customer_id: req.user.id,
                customer_name: user.name || 'Customer',
                customer_email: user.email,
                customer_phone: sanitizePhone(user.mobile),
            },
            order_meta: {
                return_url: `${process.env.FRONTEND_URL}/payment-status?order_id={order_id}&type=${type}&plan=${plan || ''}&itemId=${resolvedItemId || ''}&amount=${orderAmount}`,
                notify_url: `${process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`}/api/v1/payments/webhook`,
            },
            order_tags: {
                userId: req.user.id,
                type,
                ...(plan && { plan }),
                ...(resolvedItemId && { itemId: String(resolvedItemId) }),
            },
        };

        // ── 5. Create order on Cashfree ───────────────────────────────────────
        const cfResponse = await cashfree.PGCreateOrder(orderRequest);
        const orderData = cfResponse.data;

        // ── 6. Persist a PaymentOrder record in our DB ───────────────────────
        await PaymentOrder.create({
            cashfreeOrderId: orderData.order_id,
            user: req.user.id,
            type,
            plan: plan || null,
            itemId: resolvedItemId,
            itemMeta: itemMeta || {},
            amount: orderAmount,
            orderStatus: 'ACTIVE',
            processed: false,
            couponCode: appliedCouponCode,
        });

        console.log(`[Payment] Order created: ${orderData.order_id} | user=${req.user.id} | type=${type} | ₹${orderAmount}`);

        res.status(200).json({
            paymentSessionId: orderData.payment_session_id,
            orderId: orderData.order_id,
            orderAmount: orderData.order_amount,
            orderCurrency: orderData.order_currency,
        });

    } catch (error) {
        // Surface Cashfree API errors with their original messages
        if (error.response?.data) {
            res.status(error.response.status || 500);
            return next(new Error(error.response.data.message || 'Cashfree API error'));
        }
        if (error.existingOrderId) {
            return res.status(409).json({ message: error.message, existingOrderId: error.existingOrderId });
        }
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Cashfree Webhook — receives real-time payment events
// @route   POST /api/v1/payments/webhook
// @access  Public (protected by signature verification)
// ─────────────────────────────────────────────────────────────────────────────
export const webhook = async (req, res) => {
    const signature  = req.headers['x-webhook-signature'];
    const timestamp  = req.headers['x-webhook-timestamp'];
    const rawBody    = req.rawBody;

    // ── 1. ALWAYS verify the signature — no exceptions ───────────────────────
    // If rawBody is missing, the express middleware in server.js is misconfigured.
    if (!signature || !timestamp || !rawBody) {
        console.error('[Webhook] Missing signature, timestamp, or rawBody. Check server.js middleware.');
        // Return 400 — Cashfree will NOT retry 4xx; this prevents noise for bad actors
        return res.status(400).json({ error: 'Missing webhook signature headers' });
    }

    let signatureVerified = false;
    try {
        cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
        signatureVerified = true;
    } catch (sigError) {
        console.error('[Webhook] ❌ Signature verification FAILED:', sigError.message);
        // Return 400 — definitely not a valid Cashfree event
        return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    // ── 2. Parse and log the event BEFORE any business logic ─────────────────
    const event     = req.body;
    const eventType = event?.type || 'UNKNOWN';
    const cfOrderId = event?.data?.order?.order_id || null;
    // Cashfree sends a unique ID per delivery in the payment or refund payload —
    // whichever is present — use it as the idempotency key for this webhook event.
    const eventId   = event?.data?.payment?.cf_payment_id
        ? `cf_payment_${event.data.payment.cf_payment_id}`
        : event?.data?.refund?.cf_refund_id
            ? `cf_refund_${event.data.refund.cf_refund_id}`
            : null;

    let webhookRecord;
    try {
        webhookRecord = await WebhookEvent.create({
            eventId,
            cashfreeOrderId: cfOrderId,
            eventType,
            payload: event,
            signatureVerified,
            processed: false,
        });
    } catch (dbErr) {
        // If the event was already logged (duplicate eventId), skip re-processing
        if (dbErr.code === 11000) {
            console.warn(`[Webhook] Duplicate event delivery for eventId=${eventId}. Skipping.`);
            return res.status(200).json({ received: true, status: 'duplicate' });
        }
        // Any other DB error — return 500 so Cashfree retries
        console.error('[Webhook] Failed to log event to DB:', dbErr.message);
        return res.status(500).json({ error: 'Internal error logging event' });
    }

    console.log(`[Webhook] Received: type=${eventType} | orderId=${cfOrderId} | eventId=${eventId}`);

    // ── 3. Handle the event ───────────────────────────────────────────────────
    try {
        switch (eventType) {

            case 'PAYMENT_SUCCESS_WEBHOOK': {
                if (!cfOrderId) {
                    console.error('[Webhook] PAYMENT_SUCCESS missing order_id in payload');
                    break;
                }

                // Attempt fulfilment — atomic and idempotent
                const { fulfilled, skipped, error: fulfillErr } = await fulfillOrder(cfOrderId, 'webhook');

                if (fulfillErr) {
                    // Return 500 — Cashfree will retry the webhook after a delay
                    await WebhookEvent.findByIdAndUpdate(webhookRecord._id, {
                        processingError: fulfillErr.message,
                    });
                    return res.status(500).json({ error: 'Payment fulfilment failed; will retry' });
                }

                if (skipped) {
                    console.log(`[Webhook] Order ${cfOrderId} already processed. Skipping.`);
                }

                // Persist Cashfree's payment transaction ID — this is the "Transaction ID"
                // shown in the purchase history and on invoices, distinct from our own
                // cashfreeOrderId which is the order-level identifier.
                const cfPaymentId = event?.data?.payment?.cf_payment_id
                    ? String(event.data.payment.cf_payment_id)
                    : null;
                if (cfPaymentId && cfOrderId) {
                    await PaymentOrder.findOneAndUpdate(
                        { cashfreeOrderId: cfOrderId },
                        { $set: { cfPaymentId } }
                    );
                }

                await WebhookEvent.findByIdAndUpdate(webhookRecord._id, { processed: true });
                break;
            }

            case 'PAYMENT_FAILED_WEBHOOK': {
                // Update the PaymentOrder status so we know it failed
                await PaymentOrder.findOneAndUpdate(
                    { cashfreeOrderId: cfOrderId },
                    { $set: { orderStatus: 'FAILED' } }
                );
                await WebhookEvent.findByIdAndUpdate(webhookRecord._id, { processed: true });
                console.log(`[Webhook] Payment FAILED for order ${cfOrderId}`);
                break;
            }

            case 'PAYMENT_PENDING_WEBHOOK': {
                await PaymentOrder.findOneAndUpdate(
                    { cashfreeOrderId: cfOrderId },
                    { $set: { orderStatus: 'PENDING' } }
                );
                await WebhookEvent.findByIdAndUpdate(webhookRecord._id, { processed: true });
                console.log(`[Webhook] Payment PENDING for order ${cfOrderId}`);
                break;
            }

            case 'ORDER_PAID': {
                // Alternative success event type used in some Cashfree SDK versions
                if (!cfOrderId) break;
                const { error: fulfillErr2 } = await fulfillOrder(cfOrderId, 'webhook');
                if (fulfillErr2) {
                    await WebhookEvent.findByIdAndUpdate(webhookRecord._id, {
                        processingError: fulfillErr2.message,
                    });
                    return res.status(500).json({ error: 'Payment fulfilment failed; will retry' });
                }
                await WebhookEvent.findByIdAndUpdate(webhookRecord._id, { processed: true });
                break;
            }

            case 'PAYMENT_USER_DROPPED_WEBHOOK': {
                // User closed/abandoned the payment page mid-transaction. The order
                // usually remains ACTIVE (retryable) until it expires, so we just log
                // this — the reconciliation sweep / next verify call will catch the
                // final outcome. Recorded here mainly for support visibility.
                console.log(`[Webhook] Payment USER_DROPPED for order ${cfOrderId} — user can retry before expiry.`);
                await WebhookEvent.findByIdAndUpdate(webhookRecord._id, { processed: true });
                break;
            }

            case 'REFUND_STATUS_WEBHOOK': {
                // Refunds are async on Cashfree's side — sync the final status onto
                // the matching entry in PaymentOrder.refunds[].
                const refundData = event?.data?.refund;
                if (cfOrderId && refundData?.refund_id) {
                    await PaymentOrder.findOneAndUpdate(
                        { cashfreeOrderId: cfOrderId, 'refunds.refundId': refundData.refund_id },
                        {
                            $set: {
                                'refunds.$.status': refundData.refund_status || 'PENDING',
                                'refunds.$.cfRefundId': refundData.cf_refund_id != null ? String(refundData.cf_refund_id) : null,
                            },
                        }
                    );
                    console.log(`[Webhook] Refund ${refundData.refund_id} for order ${cfOrderId} → ${refundData.refund_status}`);
                }
                await WebhookEvent.findByIdAndUpdate(webhookRecord._id, { processed: true });
                break;
            }

            default:
                // Log unhandled event types for visibility — do not error
                console.log(`[Webhook] Unhandled event type: ${eventType}. Logged and acknowledged.`);
                await WebhookEvent.findByIdAndUpdate(webhookRecord._id, { processed: true });
                break;
        }

        // ── 4. Always acknowledge to prevent unnecessary retries for handled events ──
        return res.status(200).json({ received: true });

    } catch (error) {
        console.error(`[Webhook] Unhandled error processing event ${eventType}:`, error.message);
        // Return 500 — Cashfree will retry this webhook
        await WebhookEvent.findByIdAndUpdate(webhookRecord._id, {
            processingError: error.message,
        }).catch(() => {}); // non-blocking
        return res.status(500).json({ error: 'Internal processing error' });
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Verify payment status after Cashfree redirects user to the app
// @route   GET /api/v1/payments/verify/:orderId
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const verifyPayment = async (req, res, next) => {
    try {
        const { orderId } = req.params;

        if (!orderId || typeof orderId !== 'string') {
            res.status(400);
            throw new Error('A valid order ID is required');
        }

        console.log(`[Verify] ── Starting verification for order: ${orderId} | user: ${req.user.id}`);

        // ── 1. Security: confirm this order belongs to the calling user ───────
        const localOrder = await PaymentOrder.findOne({ cashfreeOrderId: orderId });
        if (!localOrder) {
            console.error(`[Verify] ❌ Order not found in DB: ${orderId}`);
            res.status(404);
            throw new Error('Order not found');
        }
        if (localOrder.user.toString() !== req.user.id) {
            console.error(`[Verify] ❌ User mismatch: order owner=${localOrder.user} caller=${req.user.id}`);
            res.status(403);
            throw new Error('Forbidden: This order does not belong to you');
        }

        console.log(`[Verify] ✅ Order found | type=${localOrder.type} | plan=${localOrder.plan} | processed=${localOrder.processed}`);

        // ── 2. If already processed, return the cached status (no API call needed) ─
        if (localOrder.processed) {
            console.log(`[Verify] Order ${orderId} already processed. Returning cached PAID.`);
            return res.status(200).json({
                isPaid: true,
                orderStatus: 'PAID',
                orderId: localOrder.cashfreeOrderId,
                orderAmount: localOrder.amount,
                alreadyProcessed: true,
            });
        }

        // ── 3. Fetch real-time status from Cashfree ───────────────────────────
        const cfResponse = await cashfree.PGFetchOrder(orderId);
        const orderData = cfResponse.data;
        const isPaid = orderData.order_status === 'PAID';

        // ── 4. If paid, attempt atomic fulfilment ─────────────────────────────
        if (isPaid) {
            // NOTE: Do NOT update orderStatus here before calling fulfillOrder.
            // fulfillOrder's idempotency claim requires { processed: false } — it sets
            // orderStatus='PAID' atomically as part of the claim itself.
            const { skipped, error: fulfillErr } = await fulfillOrder(orderId, 'verify');

            if (fulfillErr) {
                // Fulfilment failed — return 500 so the frontend can retry
                res.status(500);
                throw fulfillErr;
            }

            if (skipped) {
                console.log(`[Verify] Order ${orderId} was already processed (likely by webhook).`);
            }

            return res.status(200).json({
                isPaid: true,
                orderStatus: orderData.order_status,
                paymentStatus: 'SUCCESS',
                orderId: orderData.order_id,
                orderAmount: orderData.order_amount,
            });
        }

        // Order-level order_status has no "processing" state of its own (Cashfree
        // only exposes ACTIVE/PAID/EXPIRED/TERMINATED/TERMINATION_REQUESTED here) —
        // an in-flight UPI/netbanking payment still shows the order as ACTIVE. To
        // tell "still processing, don't let the user pay again" apart from "user
        // never attempted / backed out", fetch the latest individual payment attempt.
        let paymentStatus = 'NOT_ATTEMPTED';
        try {
            const paymentsRes = await cashfree.PGOrderFetchPayments(orderId);
            const attempts = paymentsRes.data || [];
            if (attempts.length > 0) {
                const latest = [...attempts].sort(
                    (a, b) => new Date(b.payment_time || 0) - new Date(a.payment_time || 0)
                )[0];
                paymentStatus = latest.payment_status || 'NOT_ATTEMPTED';
                // Persist cfPaymentId for any successful attempt even on non-PAID paths —
                // the webhook may not have fired yet (or may never fire in test environments).
                if (latest.cf_payment_id && latest.payment_status === 'SUCCESS') {
                    await PaymentOrder.findOneAndUpdate(
                        { cashfreeOrderId: orderId, cfPaymentId: null },
                        { $set: { cfPaymentId: String(latest.cf_payment_id) } }
                    );
                }
            }
        } catch (fetchErr) {
            console.warn(`[Verify] Could not fetch payment attempts for ${orderId}:`, fetchErr.response?.data?.message || fetchErr.message);
        }

        // Update local order status to reflect what Cashfree says about the order itself.
        const knownStatuses = ['ACTIVE', 'PAID', 'EXPIRED', 'TERMINATED', 'TERMINATION_REQUESTED'];
        if (knownStatuses.includes(orderData.order_status)) {
            await PaymentOrder.findOneAndUpdate(
                { cashfreeOrderId: orderId },
                { $set: { orderStatus: orderData.order_status } }
            );
        } else {
            console.warn(`[Verify] Unrecognized Cashfree order_status "${orderData.order_status}" for order ${orderId} — leaving local status unchanged.`);
        }

        return res.status(200).json({
            isPaid: false,
            orderStatus: orderData.order_status,
            paymentStatus,
            orderId: orderData.order_id,
            orderAmount: orderData.order_amount,
        });

    } catch (error) {
        if (error.response?.data) {
            res.status(error.response.status || 500);
            return next(new Error(error.response.data.message || 'Cashfree API error'));
        }
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get payment history for the authenticated user
// @route   GET /api/v1/payments/orders
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getMyOrders = async (req, res, next) => {
    try {
        const orders = await PaymentOrder.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('transaction', 'amount description status createdAt');

        res.status(200).json({ data: orders });
    } catch (error) {
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get fresh subscription status for the authenticated user
// @route   GET /api/v1/payments/subscription/status
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getSubscriptionStatus = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('subscription');
        const isActive = hasActiveSubscription(user);
        const sub = user.subscription || {};
        const daysRemaining = isActive && sub.validUntil
            ? Math.max(0, Math.ceil((new Date(sub.validUntil) - new Date()) / (1000 * 60 * 60 * 24)))
            : 0;
        res.status(200).json({
            success: true,
            data: {
                plan: sub.plan || 'None',
                validUntil: sub.validUntil || null,
                isActive,
                daysRemaining,
            },
        });
    } catch (error) { next(error); }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Cancel the authenticated user's active subscription immediately
// @route   POST /api/v1/payments/subscription/cancel
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const cancelSubscription = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('subscription name email');
        if (!hasActiveSubscription(user)) {
            return res.status(400).json({ success: false, message: 'No active subscription to cancel.' });
        }

        const { plan, validUntil } = user.subscription;
        await revokeSubscription(req.user.id);

        await logAudit({
            actor: req.user._id,
            action: 'subscription.cancelled',
            targetType: 'User',
            targetId: req.user._id,
            metadata: { plan, validUntil, cancelledBy: 'user' },
            req,
        });

        // In-app notification so the user sees it in their notification centre
        await Notification.create({
            title: 'Subscription Cancelled',
            message: `Your ${plan} subscription has been cancelled. You will no longer receive subscription discounts. Your data and progress are fully preserved.`,
            targetUser: req.user._id,
            type: 'warning',
        });

        res.status(200).json({
            success: true,
            message: 'Your subscription has been cancelled. Access to subscription benefits has ended immediately.',
        });
    } catch (error) { next(error); }
};
