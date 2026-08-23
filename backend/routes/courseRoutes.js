import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
    getCourses, getCourse, createCourse, updateCourse, deleteCourse,
    getMyCourses, getEnrolledCourses,
    addChapter, updateChapter, deleteChapter, uploadChapterPDF,
    addCourseResource, deleteCourseResource,
    reorderChapters, toggleCoursePublish,
    uploadCourseThumbnail,
    backfillChapterDurations,
    requestPublish, cancelPublishRequest, requestUnpublish, cancelUnpublishRequest,
    adminSetCourseStatus,
    getCategories, createCategory, updateCategory, deactivateCategory,
    getRelatedCourses, reprocessChapter,
} from '../controllers/courseController.js';
import {
    enrollCourse, checkCourseAccess, getProgress, updateProgress, saveVideoPosition, getMyEnrollments, mintCourseStreamToken,
    getWishlist, addToWishlist, removeFromWishlist,
} from '../controllers/courseEnrollmentController.js';
import {
    rateCourse, getCourseReviews, deleteReview, replyToReview, reportReview,
} from '../controllers/courseReviewController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { handleValidationErrors } from '../middleware/validation.js';
import {
    createCourseValidators, updateCourseValidators,
    rateCourseValidators, updateProgressValidators,
} from '../middleware/courseValidators.js';
import {
    handleThumbnailUpload,
    handleVideoUpload,
    handlePDFUpload,
    handleResourceUpload
} from '../middleware/uploadMiddleware.js';

import { requireFeature } from '../middleware/featureFlagMiddleware.js';
const router = express.Router();
router.use(requireFeature('coursesEnabled'));

// ── Rate Limiters ──────────────────────────────────────────────────────────
const enrollRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
    message: { message: 'Too many enrollment requests. Please wait a minute and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const reviewRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
    message: { message: 'Too many review requests. Please wait a minute and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', getCourses);
router.get('/categories', getCategories);
router.get('/mine', protect, getMyCourses);
router.get('/enrolled', protect, getEnrolledCourses);
router.get('/my-enrollments', protect, getMyEnrollments);
router.get('/wishlist', protect, getWishlist);

// ── Category Admin ────────────────────────────────────────────────────────────
router.post('/categories', protect, authorize('admin', 'super_admin'), createCategory);
router.put('/categories/:id', protect, authorize('admin', 'super_admin'), updateCategory);
router.delete('/categories/:id', protect, authorize('admin', 'super_admin'), deactivateCategory);

// ── Course CRUD (Seller/Admin) ─────────────────────────────────────────────────
// Note: createCourse supports multipart/form-data with optional thumbnail
router.post(
    '/',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    handleThumbnailUpload,
    createCourseValidators,
    handleValidationErrors,
    createCourse
);

router.put(
    '/:id',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    handleThumbnailUpload,
    updateCourseValidators,
    handleValidationErrors,
    updateCourse
);

router.delete('/:id', protect, authorize('seller', 'admin', 'super_admin'), deleteCourse);

// ── Thumbnail Upload ───────────────────────────────────────────────────────────
router.post(
    '/:id/thumbnail',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    handleThumbnailUpload,
    uploadCourseThumbnail
);

// ── Chapters ───────────────────────────────────────────────────────────────────
router.post(
    '/:id/chapters',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    handleVideoUpload,
    addChapter
);

router.put(
    '/:id/chapters/reorder',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    reorderChapters
);

router.put(
    '/:id/chapters/:chapterId',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    handleVideoUpload,
    updateChapter
);

router.delete(
    '/:id/chapters/:chapterId',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    deleteChapter
);

router.post(
    '/:id/chapters/:chapterId/reprocess',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    reprocessChapter
);

// Chapter PDF upload
router.post(
    '/:id/chapters/:chapterId/pdf',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    handlePDFUpload,
    uploadChapterPDF
);

// ── Course Resources ───────────────────────────────────────────────────────────
router.post(
    '/:id/resources',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    handleResourceUpload,
    addCourseResource
);

router.delete(
    '/:id/resources/:resourceId',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    deleteCourseResource
);

// ── Publish Workflow ──────────────────────────────────────────────────────────
// Legacy single-toggle endpoint — kept working as a backward-compatible alias.
router.patch(
    '/:id/publish',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    toggleCoursePublish
);

router.post('/:id/publish-request', protect, authorize('seller', 'admin', 'super_admin'), requestPublish);
router.post('/:id/publish-request/cancel', protect, authorize('seller', 'admin', 'super_admin'), cancelPublishRequest);
router.post('/:id/unpublish-request', protect, authorize('seller', 'admin', 'super_admin'), requestUnpublish);
router.post('/:id/unpublish-request/cancel', protect, authorize('seller', 'admin', 'super_admin'), cancelUnpublishRequest);
router.patch('/:id/status', protect, authorize('admin', 'super_admin'), adminSetCourseStatus);

// ── Enrollment (any authenticated user) ───────────────────────────────────────
router.post('/:id/enroll', protect, enrollRateLimiter, enrollCourse);
router.get('/:id/access', protect, checkCourseAccess);
router.get('/:id/stream-token', protect, mintCourseStreamToken);
router.get('/:id/progress', protect, getProgress);
router.put('/:id/progress/position', protect, saveVideoPosition);
router.patch('/:id/progress', protect, updateProgressValidators, handleValidationErrors, updateProgress);
router.get('/:id/related', getRelatedCourses);
router.post('/:id/wishlist', protect, addToWishlist);
router.delete('/:id/wishlist', protect, removeFromWishlist);

// ── Reviews ────────────────────────────────────────────────────────────────────
router.get('/:id/reviews', getCourseReviews);
router.post('/:id/reviews', protect, reviewRateLimiter, rateCourseValidators, handleValidationErrors, rateCourse);
router.delete('/:id/reviews/:reviewId', protect, deleteReview);
router.post('/:id/reviews/:reviewId/reply', protect, authorize('seller', 'admin', 'super_admin'), replyToReview);
router.post('/:id/reviews/:reviewId/report', protect, reportReview);

// Legacy review endpoint — kept working as a backward-compatible alias.
router.post('/:id/rate', protect, reviewRateLimiter, rateCourseValidators, handleValidationErrors, rateCourse);

// ── Backfill video durations using ffprobe (re-probe existing uploads) ─────────
// Sellers can fix their own courses; admins fix all
router.post(
    '/backfill-durations',
    protect,
    authorize('seller', 'admin', 'super_admin'),
    backfillChapterDurations
);

// ── Single course (public — must be last to avoid catching /mine /enrolled etc.)
router.get('/:idOrSlug', getCourse);

export default router;
