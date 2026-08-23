import express from 'express';
import {
    getAnalytics, getUsers, toggleBlockUser, updateUserRole,
    getAdminSellers, getAdminPayments, getAdminCourses, toggleCoursePublished, adminDeleteCourse, adminDeleteChapter,
    adminApproveChapter, adminApproveResource, adminRejectCourseRequest, adminRejectChapterRequest,
    getAdminCategories, createCategoryAdmin, updateCategoryAdmin, deactivateCategoryAdmin,
    getAdminInterviews,
    getAdminBookings,
    getAdminDisputes, resolveDispute,
    getAdminVerificationRequests, processVerification,
    getAdminRecordings, getRecordingStreamToken, getAdminAttendanceLogs, getAdminAuditLogs,
    getAdminWallet,
    getAdminSubscriptions, revokeUserSubscription,
    getAdminCoupons, createCoupon, toggleCoupon, deleteCoupon,
    getAdminFeedback,
    getAdminNotifications, sendNotification, deleteNotification,
    getAdminReports,
    getSecurityLogs,
    getAdminSettings, updateAdminSettings,
    getSiteSettings, updateSiteSettings,
    getAdminReviews, hideReview, deleteAdminReview
} from '../controllers/adminController.js';
import {
    adminGetAllWebinars, adminToggleWebinar, adminUpdateWebinar, adminDeleteWebinar, adminCancelWebinar,
    adminApproveWebinar, adminRejectWebinar
} from '../controllers/webinarController.js';
import {
    getAdminPlatformWebinarAnalytics, getSellerWebinarAnalytics, getAdminWebinarReports
} from '../controllers/webinarAnalyticsController.js';
import {
    adminGetAllPracticeTests, adminTogglePracticeTestPublish,
    adminDeletePracticeTest, adminGetTestAttempts
} from '../controllers/practiceTestController.js';
import {
    adminGetPendingQuestions, adminApproveQuestion, adminDeleteQuestion
} from '../controllers/questionBankController.js';
import {
    adminGetAllSeries, adminToggleSeriesPublish, adminDeleteSeries
} from '../controllers/testSeriesController.js';
import {
    adminGetAllBadges, adminCreateBadge, adminUpdateBadge, adminDeleteBadge
} from '../controllers/badgeController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All admin routes are protected
router.use(protect);
router.use(authorize('admin', 'super_admin', 'moderator', 'finance_admin', 'support_admin'));

// ── Dashboard
router.get('/analytics', getAnalytics);

// ── Users
router.get('/users', getUsers);
router.patch('/users/:id/block', toggleBlockUser);
router.patch('/users/:id/role', authorize('admin', 'super_admin'), updateUserRole);

// ── Sellers
router.get('/sellers', getAdminSellers);

// ── Interviewer Verification
router.get('/verifications', getAdminVerificationRequests);
router.patch('/verifications/:sellerId', processVerification);

// ── Courses
router.get('/courses', getAdminCourses);
router.patch('/courses/:id/publish', toggleCoursePublished);
router.patch('/courses/:id/reject', adminRejectCourseRequest);
router.delete('/courses/:id', adminDeleteCourse);
router.delete('/courses/:id/chapters/:chapterId', adminDeleteChapter);
router.get('/courses/:id', getAdminCourses);
router.patch('/courses/:id/chapters/:chapterId/approve', adminApproveChapter);
router.patch('/courses/:id/chapters/:chapterId/reject', adminRejectChapterRequest);
router.patch('/courses/:id/resources/:resourceId/approve', adminApproveResource);

// ── Categories
router.get('/categories', getAdminCategories);
router.post('/categories', authorize('admin', 'super_admin'), createCategoryAdmin);
router.put('/categories/:id', authorize('admin', 'super_admin'), updateCategoryAdmin);
router.delete('/categories/:id', authorize('admin', 'super_admin'), deactivateCategoryAdmin);

// ── Interviews
router.get('/interviews', getAdminInterviews);

// ── Payments / Transactions
router.get('/payments', getAdminPayments);

// ── Bookings
router.get('/bookings', getAdminBookings);

// ── Disputes
router.get('/disputes', getAdminDisputes);
router.patch('/disputes/:id/resolve', resolveDispute);

// ── Interview Sessions (recordings / attendance)
router.get('/recordings', getAdminRecordings);
router.get('/recordings/:sessionId/stream-token', getRecordingStreamToken);
router.get('/interview-sessions', getAdminAttendanceLogs);

// ── Audit Log
router.get('/audit-logs', getAdminAuditLogs);

// ── Wallet
router.get('/wallet', getAdminWallet);

// ── Subscriptions
router.get('/subscriptions', getAdminSubscriptions);
router.delete('/subscriptions/:userId', revokeUserSubscription);

// ── Coupons
router.get('/coupons', getAdminCoupons);
router.post('/coupons', createCoupon);
router.patch('/coupons/:id/toggle', toggleCoupon);
router.delete('/coupons/:id', deleteCoupon);

// ── Feedback
router.get('/feedback', getAdminFeedback);

// ── Notifications
router.get('/notifications', getAdminNotifications);
router.post('/notifications', sendNotification);
router.delete('/notifications/:id', deleteNotification);

// ── Reports
router.get('/reports', getAdminReports);

// ── Security
router.get('/security', getSecurityLogs);

// ── Mock Interview Settings
router.get('/settings', getAdminSettings);
router.put('/settings', authorize('admin', 'super_admin'), updateAdminSettings);

// ── Site / System Settings
router.get('/site-settings', getSiteSettings);
router.put('/site-settings', authorize('admin', 'super_admin'), updateSiteSettings);

// ── Review Management
router.get('/reviews', getAdminReviews);
router.patch('/reviews/:id/hide', hideReview);
router.delete('/reviews/:id', deleteAdminReview);

// ── Webinars
router.get('/webinars', adminGetAllWebinars);
router.get('/webinars/analytics', getAdminPlatformWebinarAnalytics);
router.get('/webinars/reports', getAdminWebinarReports);
router.get('/webinars/:id/analytics', getSellerWebinarAnalytics);
router.put('/webinars/:id', adminUpdateWebinar);
router.patch('/webinars/:id/toggle', adminToggleWebinar);
router.patch('/webinars/:id/approve', adminApproveWebinar);
router.patch('/webinars/:id/reject', adminRejectWebinar);
router.patch('/webinars/:id/cancel', adminCancelWebinar);
router.delete('/webinars/:id', adminDeleteWebinar);

// ── Practice Tests
router.get('/practice-tests', adminGetAllPracticeTests);
router.patch('/practice-tests/:id/publish', adminTogglePracticeTestPublish);
router.delete('/practice-tests/:id', adminDeletePracticeTest);
router.get('/practice-tests/:id/attempts', adminGetTestAttempts);

router.get('/question-bank/pending', adminGetPendingQuestions);
router.patch('/question-bank/:id/approve', adminApproveQuestion);
router.delete('/question-bank/:id', adminDeleteQuestion);

router.get('/test-series', adminGetAllSeries);
router.patch('/test-series/:id/publish', adminToggleSeriesPublish);
router.delete('/test-series/:id', adminDeleteSeries);

router.get('/badges', adminGetAllBadges);
router.post('/badges', adminCreateBadge);
router.put('/badges/:id', adminUpdateBadge);
router.delete('/badges/:id', adminDeleteBadge);

export default router;
