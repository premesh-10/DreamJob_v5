import express from 'express';
import {
    createExperience, getExperiences, getExperience, updateExperience, deleteExperience,
    toggleLikeExperience, toggleBookmark, getMyBookmarks,
    addComment, getComments, deleteComment, toggleLikeComment,
    reportContent, toggleFeatureExperience,
    getLeaderboard, getTopQuestions, getMyGamificationProfile,
    adminGetReports, adminResolveReport,
} from '../controllers/interviewExperienceController.js';
import { protect, authorize, optionalProtect } from '../middleware/authMiddleware.js';

import { requireFeature } from '../middleware/featureFlagMiddleware.js';
const router = express.Router();
router.use(requireFeature('hubEnabled'));
const adminRoles = ['admin', 'super_admin', 'moderator'];

// ── Static GET routes — must come before the generic GET /:id ──────────────────
router.get('/leaderboard', getLeaderboard);
router.get('/top-questions', getTopQuestions);
router.get('/me/bookmarks', protect, getMyBookmarks);
router.get('/me/gamification', protect, getMyGamificationProfile);

// ── Admin moderation ────────────────────────────────────────────────────────────
router.get('/admin/reports', protect, authorize(...adminRoles), adminGetReports);
router.put('/admin/reports/:id', protect, authorize(...adminRoles), adminResolveReport);

// ── Comments (top-level paths to avoid nesting under a single experience) ──────
router.delete('/comments/:commentId', protect, deleteComment);
router.post('/comments/:commentId/like', protect, toggleLikeComment);

// ── Reporting ───────────────────────────────────────────────────────────────────
router.post('/report', protect, reportContent);

// ── Collection ──────────────────────────────────────────────────────────────────
router.get('/', getExperiences);
router.post('/', protect, createExperience);

// ── Single experience ───────────────────────────────────────────────────────────
router.get('/:id', optionalProtect, getExperience);
router.put('/:id', protect, updateExperience);
router.delete('/:id', protect, deleteExperience);
router.put('/:id/feature', protect, authorize(...adminRoles), toggleFeatureExperience);

router.post('/:id/like', protect, toggleLikeExperience);
router.post('/:id/bookmark', protect, toggleBookmark);

router.get('/:id/comments', getComments);
router.post('/:id/comments', protect, addComment);

export default router;
