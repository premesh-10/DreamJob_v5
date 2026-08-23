import Course from '../models/Course.js';
import Booking from '../models/Booking.js';
import Notification from '../models/Notification.js';
import Feedback from '../models/Feedback.js';
import { validateCouponForOrder } from '../utils/coupon.js';

// ─── Coupon Validation ────────────────────────────────────────────────────────

// @desc    Validate a coupon code (preview only — does not redeem/increment usage;
//          actual redemption happens server-side at checkout/fulfilment time)
// @route   POST /api/v1/coupons/validate
// @access  Private
export const validateCoupon = async (req, res, next) => {
    try {
        const { code, orderAmount, applicableTo } = req.body;
        const { coupon, discount, finalAmount } = await validateCouponForOrder(code, orderAmount, applicableTo);

        res.status(200).json({
            success: true,
            message: 'Coupon applied successfully!',
            data: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                discount,
                finalAmount,
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ─── Course Rating & Review ───────────────────────────────────────────────────

// @desc    Rate + review a course (enrolled users only, one review per user per course)
// @route   POST /api/v1/courses/:id/rate
// @access  Private
// Course reviews (rateCourse/getCourseReviews) moved to
// courseReviewController.js, now backed by the dedicated CourseReview model
// (unique compound index fixes the old duplicate-review race; rating
// recompute is now a Mongo aggregation instead of fetch-all-then-reduce).
// Historical course-type Feedback rows are preserved (copied forward by
// scripts/migrateCourseCatalog.js, not deleted) and remain deletable/
// reportable below — deleteReview/reportReview stay generic across all
// Feedback types (interview/platform/legacy-course).

// @desc    Delete own review
// @route   DELETE /api/v1/feedback/:id
// @access  Private (own review only)
export const deleteReview = async (req, res, next) => {
    try {
        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) return res.status(404).json({ message: 'Review not found' });

        const isOwner = feedback.user.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user.role);
        if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorised to delete this review' });

        const targetId = feedback.targetId;
        const type     = feedback.type;

        await feedback.deleteOne();

        // Recompute course rating if it was a course review
        if (type === 'course' && targetId) {
            const course = await Course.findById(targetId);
            if (course) {
                const allReviews = await Feedback.find({ type: 'course', targetId, isHidden: false });
                course.rating = allReviews.length > 0
                    ? allReviews.reduce((s, f) => s + (f.rating || 0), 0) / allReviews.length
                    : 0;
                course.totalReviews = allReviews.length;
                await course.save();
            }
        }

        res.status(200).json({ success: true, message: 'Review deleted' });
    } catch (error) { next(error); }
};

// @desc    Report a review
// @route   POST /api/v1/feedback/:id/report
// @access  Private
export const reportReview = async (req, res, next) => {
    try {
        const { reason } = req.body;
        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) return res.status(404).json({ message: 'Review not found' });

        // Prevent duplicate reports from same user
        if (feedback.reportedBy.map(u => u.toString()).includes(req.user.id)) {
            return res.status(400).json({ message: 'You have already reported this review' });
        }

        feedback.reportedBy.push(req.user.id);
        feedback.isReported = true;
        if (reason) feedback.reportReason = reason;
        await feedback.save();

        res.status(200).json({ success: true, message: 'Review reported. Our team will review it shortly.' });
    } catch (error) { next(error); }
};

// ─── Platform Feedback ────────────────────────────────────────────────────────

// @desc    Submit platform feedback
// @route   POST /api/v1/feedback
// @access  Private
export const submitFeedback = async (req, res, next) => {
    try {
        const { type = 'platform', targetId, rating, review, category } = req.body;
        if (!review || review.trim().length < 5) return res.status(400).json({ message: 'Feedback must be at least 5 characters' });

        const feedback = await Feedback.create({
            user: req.user.id,
            type,
            targetId: targetId || null,
            rating: rating ? Number(rating) : null,
            review: review.trim(),
            category: category || 'general'
        });

        res.status(201).json({ success: true, message: 'Thank you for your feedback!', data: feedback });
    } catch (error) { next(error); }
};

// ─── User Notifications ───────────────────────────────────────────────────────

// @desc    Get notifications for the current user (based on role)
// @route   GET /api/v1/notifications/me
// @access  Private
export const getMyNotifications = async (req, res, next) => {
    try {
        const role = req.user.role;
        const dismissed = req.user.dismissedNotifications || [];
        const notifications = await Notification.find({
            _id: { $nin: dismissed },
            $or: [
                { targetRole: { $in: ['all', role] }, targetUser: { $exists: false } },
                { targetRole: { $in: ['all', role] }, targetUser: null },
                { targetUser: req.user.id }
            ]
        }).sort({ createdAt: -1 }).limit(50);

        res.status(200).json({ success: true, count: notifications.length, data: notifications });
    } catch (error) { next(error); }
};

// @desc    Check if user has unread notifications
// @route   GET /api/v1/notifications/unread
// @access  Private
export const getUnreadNotificationCount = async (req, res, next) => {
    try {
        const role = req.user.role;
        const lastSeen = req.user.lastSeenNotifications || new Date(0);
        
        const count = await Notification.countDocuments({
            createdAt: { $gt: lastSeen },
            $or: [
                { targetRole: { $in: ['all', role] }, targetUser: { $exists: false } },
                { targetRole: { $in: ['all', role] }, targetUser: null },
                { targetUser: req.user.id }
            ]
        });

        res.status(200).json({ success: true, hasUnread: count > 0, count });
    } catch (error) { next(error); }
};

// @desc    Mark notifications as read
// @route   PATCH /api/v1/notifications/read
// @access  Private
export const markNotificationsRead = async (req, res, next) => {
    try {
        req.user.lastSeenNotifications = new Date();
        await req.user.save({ validateBeforeSave: false });
        res.status(200).json({ success: true, message: 'Notifications marked as read' });
    } catch (error) { next(error); }
};

// @desc    Dismiss a single notification (user-side hide, not a DB delete)
// @route   DELETE /api/v1/notifications/:id
// @access  Private
export const dismissNotification = async (req, res, next) => {
    try {
        const id = req.params.id;
        if (!req.user.dismissedNotifications.includes(id)) {
            req.user.dismissedNotifications.push(id);
            await req.user.save({ validateBeforeSave: false });
        }
        res.status(200).json({ success: true });
    } catch (error) { next(error); }
};

// @desc    Dismiss all currently visible notifications for the user
// @route   DELETE /api/v1/notifications
// @access  Private
export const clearAllNotifications = async (req, res, next) => {
    try {
        const role = req.user.role;
        const dismissed = req.user.dismissedNotifications || [];
        const visible = await Notification.find({
            _id: { $nin: dismissed },
            $or: [
                { targetRole: { $in: ['all', role] }, targetUser: { $exists: false } },
                { targetRole: { $in: ['all', role] }, targetUser: null },
                { targetUser: req.user.id }
            ]
        }).select('_id');
        const ids = visible.map(n => n._id);
        req.user.dismissedNotifications.push(...ids);
        await req.user.save({ validateBeforeSave: false });
        res.status(200).json({ success: true });
    } catch (error) { next(error); }
};
