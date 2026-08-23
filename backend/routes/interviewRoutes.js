import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
    getInterviews, getMyInterviewProfile, createOrUpdateInterviewProfile,
    addSlot, deleteSlot, bookSlot, getMyBookings, getSellerBookings, rateInterview
} from '../controllers/interviewController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

import { requireFeature } from '../middleware/featureFlagMiddleware.js';
const router = express.Router();
router.use(requireFeature('mockInterviewsEnabled'));

// Prevent booking-spam (abuse / accidental double-click double-submitting the
// same slot) — same pattern as paymentRoutes.js's checkoutRateLimit.
const bookSlotRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
    message: { message: 'Too many booking requests. Please wait a minute and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Public — browse interviewers
router.get('/', getInterviews);

// Seller — manage own interview profile
router.get('/mine', protect, getMyInterviewProfile);
router.post('/', protect, authorize('seller', 'admin', 'super_admin'), createOrUpdateInterviewProfile);
router.post('/slots', protect, authorize('seller', 'admin', 'super_admin'), addSlot);
router.delete('/slots/:slotId', protect, authorize('seller', 'admin', 'super_admin'), deleteSlot);

// Booking history
router.get('/bookings/me', protect, getMyBookings);            // user's own bookings
router.get('/bookings/seller', protect, authorize('seller', 'admin', 'super_admin'), getSellerBookings);    // seller's incoming bookings

// Book a slot
router.post('/:id/book', protect, bookSlotRateLimit, bookSlot);

// Rate an interviewer (after booking)
router.post('/:id/rate', protect, rateInterview);

export default router;
