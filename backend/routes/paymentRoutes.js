import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
    createCheckoutSession,
    webhook,
    verifyPayment,
    getMyOrders,
    getSubscriptionStatus,
    cancelSubscription,
} from '../controllers/paymentController.js';
import { getOrderDetails, downloadInvoice } from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Rate Limiters ──────────────────────────────────────────────────────────
// Prevent users from spamming checkout creation (abuse / accidental double-click)
const checkoutRateLimit = rateLimit({
    windowMs: 60 * 1000,   // 1-minute window
    max: 5,                 // max 5 checkout requests per user per minute
    // Per-user rate limiting (falls back to IPv6-safe IP key for unauthenticated)
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
    message: { message: 'Too many payment requests. Please wait a minute and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Verify endpoint: prevent polling abuse
const verifyRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
    message: { message: 'Too many verification requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── Routes ─────────────────────────────────────────────────────────────────

// Create a Cashfree order → returns paymentSessionId
router.post('/create-checkout-session', protect, checkoutRateLimit, createCheckoutSession);

// Cashfree webhook — raw body is captured in server.js for signature verification.
// No auth middleware: Cashfree calls this server-to-server; we verify via signature.
router.post('/webhook', webhook);

// Verify payment status after user is redirected back from Cashfree
router.get('/verify/:orderId', protect, verifyRateLimit, verifyPayment);

// Get authenticated user's payment order history
router.get('/orders', protect, getMyOrders);

// Order details by DreamJob Order ID (PRX...ID... format)
router.get('/orders/:orderId', protect, getOrderDetails);

// Download HTML invoice (open in new tab → browser prints to PDF)
router.get('/invoice/:orderId', protect, downloadInvoice);

// ── Subscription management ────────────────────────────────────────────────
// Fresh subscription status (always from DB, never from cached token state)
router.get('/subscription/status', protect, getSubscriptionStatus);
// User-initiated cancellation — revokes immediately, no refund
router.post('/subscription/cancel', protect, cancelSubscription);

export default router;
