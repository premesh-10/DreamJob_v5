import express from 'express';
import { getMyDisputes, createDispute } from '../controllers/disputeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/mine', protect, getMyDisputes);
router.post('/', protect, createDispute);

export default router;
