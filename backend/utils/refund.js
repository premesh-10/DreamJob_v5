import { v4 as uuidv4 } from 'uuid';
import { cashfree } from '../config/cashfree.js';
import PaymentOrder from '../models/PaymentOrder.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import { revokeSubscription } from './subscription.js';

/**
 * refundPayment
 * ─────────────────────────────────────────────────────────────────────────────
 * Issues a real refund via Cashfree's Refund API against the original order,
 * so money actually returns to the customer's card/UPI/bank — not an internal
 * wallet (there is no working wallet ledger in this system).
 *
 * Refunds are asynchronous on Cashfree's side: this call only *initiates* the
 * refund. Final status (SUCCESS/FAILED) arrives later via REFUND_STATUS_WEBHOOK
 * and is synced onto PaymentOrder.refunds[].status by paymentController.webhook.
 *
 * @param {string} userId
 * @param {'course'|'interview'|'webinar'|'subscription'} type
 * @param {string} itemId
 * @param {number} amount    — amount to refund (capped to what's left unrefunded)
 * @param {string} note
 * @returns {{ success: boolean, refund?: object, error?: Error }}
 */
export async function refundPayment({ userId, type, itemId, amount, note }) {
    const order = await PaymentOrder.findOne({
        user: userId, type, itemId: itemId || null, processed: true,
    }).sort({ createdAt: -1 });

    if (!order) {
        return { success: false, error: new Error('Original payment order not found — cannot issue an automatic refund') };
    }

    const refundId = `RF_${uuidv4().replace(/-/g, '').substring(0, 24)}`;

    // Compute "amount already refunded" and reserve this refund's amount in a
    // single atomic pipeline update, instead of read-compute-then-write. Two
    // concurrent refund attempts on the same order (e.g. a cancellation and a
    // dispute-resolution refund racing on the same booking) would otherwise
    // both read the same stale "amount remaining" and both reserve the full
    // amount before either commits — this closes that window by letting
    // MongoDB serialize the two single-document writes.
    const reserved = await PaymentOrder.findOneAndUpdate(
        { _id: order._id },
        [
            {
                $set: {
                    __alreadyRefunded: {
                        $sum: {
                            $map: {
                                input: { $filter: { input: '$refunds', cond: { $not: { $in: ['$$this.status', ['FAILED', 'CANCELLED']] } } } },
                                as: 'r',
                                in: '$$r.amount',
                            },
                        },
                    },
                },
            },
            {
                $set: {
                    __refundable: {
                        $let: {
                            vars: { raw: { $min: [amount, { $subtract: ['$amount', '$__alreadyRefunded'] }] } },
                            in: { $cond: [{ $gt: ['$$raw', 0] }, { $round: ['$$raw', 2] }, 0] },
                        },
                    },
                },
            },
            {
                $set: {
                    refunds: {
                        $cond: [
                            { $gt: ['$__refundable', 0] },
                            { $concatArrays: ['$refunds', [{ refundId, cfRefundId: null, amount: '$__refundable', status: 'PENDING', note: note || '', createdAt: '$$NOW' }]] },
                            '$refunds',
                        ],
                    },
                },
            },
            { $unset: ['__alreadyRefunded', '__refundable'] },
        ],
        { returnDocument: 'after', updatePipeline: true }
    );

    const reservedEntry = reserved.refunds.find(r => r.refundId === refundId);
    if (!reservedEntry) {
        return { success: false, error: new Error('Nothing left to refund on this order') };
    }
    const refundableAmount = reservedEntry.amount;

    try {
        const response = await cashfree.PGOrderCreateRefund(order.cashfreeOrderId, {
            refund_amount: refundableAmount,
            refund_id: refundId,
            refund_note: note || 'Refund issued',
        });
        const refundData = response.data;

        await PaymentOrder.updateOne(
            { _id: order._id, 'refunds.refundId': refundId },
            {
                $set: {
                    'refunds.$.status': refundData.refund_status || 'PENDING',
                    'refunds.$.cfRefundId': refundData.cf_refund_id != null ? String(refundData.cf_refund_id) : null,
                },
            }
        );

        // Distinct cashfreeOrderId suffix — the original order's debit Transaction already
        // owns the bare cashfreeOrderId under Transaction's unique sparse index.
        await Transaction.create({
            user: userId,
            type: 'credit',
            amount: refundableAmount,
            description: note || `Refund for order ${order.cashfreeOrderId}`,
            status: refundData.refund_status === 'SUCCESS' ? 'completed' : 'pending',
            cashfreeOrderId: `${order.cashfreeOrderId}#refund#${refundId}`,
        });

        // If this was a subscription refund, immediately revoke the subscription so the
        // user loses benefits right away — don't wait for the async REFUND_STATUS_WEBHOOK.
        if (type === 'subscription') {
            try {
                await revokeSubscription(userId);
                await Notification.create({
                    title: 'Subscription Refunded & Cancelled',
                    message: `Your subscription refund of ₹${refundableAmount.toFixed(2)} has been initiated. Your subscription has been cancelled immediately. All data and progress are preserved.`,
                    targetUser: userId,
                    type: 'warning',
                });
                console.log(`[Refund] Subscription revoked for user ${userId} following refund initiation.`);
            } catch (revokeErr) {
                console.error(`[Refund] ⚠️ Refund succeeded but subscription revocation failed for user ${userId}:`, revokeErr.message);
            }
        }

        console.log(`[Refund] Initiated ₹${refundableAmount} refund (${refundId}) for order ${order.cashfreeOrderId} | status=${refundData.refund_status}`);
        return { success: true, refund: refundData };

    } catch (err) {
        // Cashfree call failed — release the reservation so this balance isn't
        // permanently locked out by a refund that never actually happened.
        await PaymentOrder.updateOne(
            { _id: order._id, 'refunds.refundId': refundId },
            { $set: { 'refunds.$.status': 'FAILED' } }
        );
        const message = err.response?.data?.message || err.message;
        console.error(`[Refund] ❌ Failed to create Cashfree refund for order ${order.cashfreeOrderId}:`, message);
        return { success: false, error: new Error(message) };
    }
}
