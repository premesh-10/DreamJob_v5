import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
    postChatMessage, getChatHistory,
    askQuestion, upvoteQuestion, answerQuestion, getQuestions,
    createPoll, openPoll, votePoll, closePoll, getPolls,
    setHandRaised, sendReaction,
    submitFeedback,
} from '../controllers/webinarEngagementController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Looser than the join-token limiter (joinTokenRateLimit in webinarSessionRoutes.js) — these
// are normal, frequent, low-stakes interactions, not security-sensitive — this just caps
// outright spam/flood (a genuine attendee chatting or reacting a lot never needs 60+/min).
const engagementRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
    message: { message: 'Slow down — too many actions. Please wait a moment and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/:sessionId/chat', protect, engagementRateLimit, postChatMessage);
router.get('/:sessionId/chat', protect, getChatHistory);

router.get('/:sessionId/questions', protect, getQuestions);
router.post('/:sessionId/questions', protect, engagementRateLimit, askQuestion);
router.post('/:sessionId/questions/:questionId/upvote', protect, engagementRateLimit, upvoteQuestion);
router.patch('/:sessionId/questions/:questionId/answer', protect, answerQuestion);

router.get('/:sessionId/polls', protect, getPolls);
router.post('/:sessionId/polls', protect, createPoll);
router.patch('/:sessionId/polls/:pollId/open', protect, openPoll);
router.post('/:sessionId/polls/:pollId/vote', protect, engagementRateLimit, votePoll);
router.patch('/:sessionId/polls/:pollId/close', protect, closePoll);

router.patch('/:sessionId/hand', protect, engagementRateLimit, setHandRaised);
router.post('/:sessionId/reactions', protect, engagementRateLimit, sendReaction);

router.post('/:sessionId/feedback', protect, submitFeedback);

export default router;
