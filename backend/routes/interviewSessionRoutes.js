import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getSessionForBooking, getSessionById, getJoinToken, endSession, submitFeedback } from '../controllers/interviewSessionController.js';
import { giveConsent, getRecordingStream } from '../controllers/recordingController.js';
import { requestReschedule, cancelSession } from '../controllers/interviewLifecycleController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Prevent join-token spam/fraud (e.g. scripted token harvesting) — a genuine
// participant never needs more than a handful of tokens per minute.
const joinTokenRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
    message: { message: 'Too many join requests. Please wait a minute and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/booking/:bookingId', protect, getSessionForBooking);
router.get('/:sessionId', protect, getSessionById);
router.post('/:sessionId/token', protect, joinTokenRateLimit, getJoinToken);
router.post('/:sessionId/end', protect, endSession);
router.post('/:sessionId/consent', protect, giveConsent);
router.get('/:sessionId/recording', protect, getRecordingStream);
router.patch('/:sessionId/reschedule', protect, requestReschedule);
router.patch('/:sessionId/cancel', protect, cancelSession);
router.post('/:sessionId/feedback', protect, submitFeedback);

export default router;
