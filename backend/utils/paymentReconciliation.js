import cron from 'node-cron';
import { cashfree } from '../config/cashfree.js';
import PaymentOrder from '../models/PaymentOrder.js';
import { fulfillOrder } from './fulfillOrder.js';

// Mirrors ORDER_EXPIRY_MINUTES in paymentController.js — orders aren't worth checking
// until they've had a chance to actually expire on Cashfree's side.
const GRACE_MINUTES = 30;
const MAX_AGE_DAYS = 2; // stop polling orders older than this — they're long dead

/**
 * reconcileStaleOrders
 * ─────────────────────────────────────────────────────────────────────────────
 * Safety net for interrupted transactions that never reach our webhook or the
 * verify endpoint — e.g. the user closed the browser before Cashfree redirected
 * them back, or a webhook delivery was lost. Without this sweep, such orders
 * would stay ACTIVE/PENDING in our DB forever even though Cashfree has long
 * since resolved them (PAID, EXPIRED, TERMINATED...).
 */
async function reconcileStaleOrders() {
    const now = Date.now();
    const staleOrders = await PaymentOrder.find({
        processed: false,
        orderStatus: { $in: ['ACTIVE', 'PENDING'] },
        createdAt: {
            $lte: new Date(now - GRACE_MINUTES * 60 * 1000),
            $gte: new Date(now - MAX_AGE_DAYS * 24 * 60 * 60 * 1000),
        },
    }).limit(100);

    if (staleOrders.length === 0) return;
    console.log(`[Reconcile] Checking ${staleOrders.length} stale order(s)...`);

    for (const order of staleOrders) {
        try {
            const { data } = await cashfree.PGFetchOrder(order.cashfreeOrderId);

            if (data.order_status === 'PAID') {
                const { error } = await fulfillOrder(order.cashfreeOrderId, 'reconciliation');
                if (error) console.error(`[Reconcile] Failed to fulfil ${order.cashfreeOrderId}:`, error.message);
                else console.log(`[Reconcile] ✅ Fulfilled previously-missed order ${order.cashfreeOrderId}`);
            } else if (data.order_status !== order.orderStatus) {
                const knownStatuses = ['ACTIVE', 'PAID', 'EXPIRED', 'TERMINATED', 'TERMINATION_REQUESTED'];
                if (knownStatuses.includes(data.order_status)) {
                    await PaymentOrder.findOneAndUpdate(
                        { cashfreeOrderId: order.cashfreeOrderId },
                        { $set: { orderStatus: data.order_status } }
                    );
                    console.log(`[Reconcile] Order ${order.cashfreeOrderId} → ${data.order_status}`);
                }
            }
        } catch (err) {
            console.error(`[Reconcile] Error checking order ${order.cashfreeOrderId}:`, err.response?.data?.message || err.message);
        }
    }
}

export const startPaymentReconciliation = () => {
    // Every 10 minutes — frequent enough to catch interrupted payments quickly
    // without hammering Cashfree's API.
    cron.schedule('*/10 * * * *', () => {
        reconcileStaleOrders().catch(err => console.error('[Reconcile] Sweep failed:', err.message));
    });
    console.log('Payment reconciliation scheduler started (runs every 10 minutes)');
};
