import express from 'express';
import { handleLiveKitWebhook } from '../controllers/livekitWebhookController.js';

const router = express.Router();

// No auth middleware — verified via LiveKit's webhook signature instead
// (same trust model as the Cashfree payment webhook).
router.post('/webhook', handleLiveKitWebhook);

export default router;
