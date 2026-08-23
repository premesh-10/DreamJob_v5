import express from 'express';
import {
    getRewards, redeemReward, getMyRedemptions,
    adminCreateReward, adminUpdateReward, adminDeleteReward,
    adminGetRedemptions, adminProcessRedemption,
} from '../controllers/rewardController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { handleCompanyLogoUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();
const adminRoles = ['admin', 'super_admin', 'moderator'];

// ── User ──────────────────────────────────────────────────────────────────────
router.get('/', getRewards);
router.get('/me/redemptions', protect, getMyRedemptions);
router.post('/:id/redeem', protect, redeemReward);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/redemptions', protect, authorize(...adminRoles), adminGetRedemptions);
router.put('/admin/redemptions/:id', protect, authorize(...adminRoles), adminProcessRedemption);
router.post('/', protect, authorize(...adminRoles), handleCompanyLogoUpload, adminCreateReward);
router.put('/:id', protect, authorize(...adminRoles), handleCompanyLogoUpload, adminUpdateReward);
router.delete('/:id', protect, authorize(...adminRoles), adminDeleteReward);

export default router;
