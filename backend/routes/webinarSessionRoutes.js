import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getSessionForWebinar, requestAdmission, requestJoinToken } from '../controllers/webinarSessionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Same join-token spam guard as interviewSessionRoutes.js — a genuine attendee never needs
// more than a handful of tokens per minute.
const joinTokenRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
    message: { message: 'Too many join requests. Please wait a minute and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/webinar/:webinarId', protect, getSessionForWebinar);
router.post('/:sessionId/admission', protect, joinTokenRateLimit, requestAdmission);
router.post('/:sessionId/token', protect, joinTokenRateLimit, requestJoinToken);

export default router;
