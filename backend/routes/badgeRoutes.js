import express from 'express';
import { getAllActiveBadges, getMyBadges } from '../controllers/badgeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getAllActiveBadges);
router.get('/mine', protect, getMyBadges);

export default router;
