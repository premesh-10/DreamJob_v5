import express from 'express';
import {
    validateCoupon,
    deleteReview,
    reportReview,
    submitFeedback,
    getMyNotifications,
    getUnreadNotificationCount,
    markNotificationsRead,
    dismissNotification,
    clearAllNotifications
} from '../controllers/userFeaturesController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Coupon validation
router.post('/coupons/validate', protect, validateCoupon);

// Course reviews (rate/reviews) now live exclusively in courseRoutes.js,
// backed by CourseReview — see userFeaturesController.js for context.

// ── Review management
router.delete('/feedback/:id', protect, deleteReview);          // Own or admin
router.post('/feedback/:id/report', protect, reportReview);     // Any logged-in user

// ── Platform feedback
router.post('/feedback', protect, submitFeedback);

// ── User notifications
router.get('/notifications/me', protect, getMyNotifications);
router.get('/notifications/unread', protect, getUnreadNotificationCount);
router.patch('/notifications/read', protect, markNotificationsRead);
router.delete('/notifications', protect, clearAllNotifications);
router.delete('/notifications/:id', protect, dismissNotification);

export default router;
