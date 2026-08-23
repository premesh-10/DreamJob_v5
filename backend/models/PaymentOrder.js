import mongoose from 'mongoose';

/**
 * PaymentOrder — tracks every Cashfree order created by the system.
 *
 * Why this exists:
 *  - Audit trail: every payment attempt is recorded, not just successful ones.
 *  - Reconciliation: if a user pays but never returns, the order is still here.
 *  - Idempotency gatekeeper: the `processed` flag is set atomically via
 *    findOneAndUpdate so no two code paths can ever process the same order twice.
 */
const paymentOrderSchema = new mongoose.Schema({
    // Cashfree's order_id — must be globally unique
    cashfreeOrderId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    // Reference to the user who initiated the payment
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },

    // Payment purpose: 'subscription' | 'course' | 'interview' | 'webinar'
    type: {
        type: String,
        enum: ['subscription', 'course', 'interview', 'webinar'],
        required: true,
    },

    // Subscription plan (only for type='subscription')
    plan: {
        type: String,
        enum: ['Silver', 'Ruby', 'Platinum', null],
        default: null,
    },

    // The ID of the product being purchased (course/interview/webinar)
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },

    // Extra metadata for product purchases (e.g. slotId for interviews)
    itemMeta: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },

    // Coupon redeemed against this order, if any — usedCount is only incremented
    // once the order is actually fulfilled (see utils/coupon.js#redeemCoupon),
    // never at checkout-creation time, since not every session completes.
    couponCode: {
        type: String,
        default: null,
    },

    // Order amount in INR
    amount: {
        type: Number,
        required: true,
    },

    // Cashfree's order lifecycle status.
    // ACTIVE/PAID/EXPIRED/PENDING/TERMINATED/TERMINATION_REQUESTED mirror real Cashfree
    // order_status values; FAILED/CANCELLED/USER_DROPPED are derived from webhook event types
    // (Cashfree's payment-level events) for clearer reporting in our own UI.
    orderStatus: {
        type: String,
        enum: ['ACTIVE', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED', 'PENDING', 'TERMINATED', 'TERMINATION_REQUESTED', 'USER_DROPPED'],
        default: 'ACTIVE',
    },

    /**
     * processed — the critical idempotency flag.
     * Set atomically to `true` the FIRST time we fulfil this order.
     * Any subsequent webhook/verify call gets `null` back and bails out.
     */
    processed: {
        type: Boolean,
        default: false,
        index: true,
    },

    processedAt: { type: Date, default: null },
    processedBy: {
        type: String,
        enum: ['webhook', 'verify', null],
        default: null,
    },

    // Linked transaction record (set when fulfilled)
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        default: null,
    },

    // Refund attempts issued against this order (an order can be partially refunded
    // multiple times — e.g. webinar seat cancellation). Status is synced via
    // REFUND_STATUS_WEBHOOK since Cashfree processes refunds asynchronously.
    refunds: [{
        refundId: { type: String, required: true },
        cfRefundId: { type: String, default: null },
        amount: { type: Number, required: true },
        status: {
            type: String,
            enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'ONHOLD'],
            default: 'PENDING',
        },
        note: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
    }],

    // DreamJob-generated sequential Order ID (set once at fulfilment time, immutable).
    // Format: PRX{TYPE_CODE}ID{YYYYMMDD}{7-digit-seq}
    // e.g. PRXCID202607010000001 (course), PRXMID202607010000002 (interview)
    orderId: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
    },

    // Sequential invoice number assigned at the same time as orderId.
    // Format: INV-{YYYYMM}-{7-digit-seq}  e.g. INV-202607-0000001
    invoiceNumber: {
        type: String,
        unique: true,
        sparse: true,
    },

    // Cashfree's internal payment transaction ID (cf_payment_id from webhook/API).
    // This is the "Transaction ID" surfaced in the UI — distinct from cashfreeOrderId
    // which is our own order-level ID sent to Cashfree at checkout creation time.
    cfPaymentId: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

const PaymentOrder = mongoose.model('PaymentOrder', paymentOrderSchema);
export default PaymentOrder;
