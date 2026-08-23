import mongoose from 'mongoose';

/**
 * WebhookEvent — immutable log of every raw webhook payload received from Cashfree.
 *
 * Why this exists:
 *  - Debugging: you can replay any event manually if processing fails.
 *  - Audit: regulators / finance teams can see every event with timestamps.
 *  - Idempotency check: we can look up by eventId to see if an event was already received.
 */
const webhookEventSchema = new mongoose.Schema({
    // Cashfree's unique identifier for this specific webhook delivery
    // Stored as the idempotency key — prevents processing the same delivery twice
    eventId: {
        type: String,
        unique: true,
        sparse: true,   // some events may not have an ID
        index: true,
    },

    // Cashfree order ID this event is about
    cashfreeOrderId: {
        type: String,
        index: true,
    },

    // Cashfree event type e.g. PAYMENT_SUCCESS_WEBHOOK, PAYMENT_FAILED_WEBHOOK
    eventType: {
        type: String,
        required: true,
    },

    // Full raw payload from Cashfree (stored as-is for replay / audit)
    payload: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },

    // Signature verification result
    signatureVerified: {
        type: Boolean,
        default: false,
    },

    // Whether our business logic ran successfully for this event
    processed: {
        type: Boolean,
        default: false,
    },

    // Any error that occurred during processing
    processingError: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
export default WebhookEvent;
