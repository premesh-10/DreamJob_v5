import mongoose from 'mongoose';
import Course from '../models/Course.js';
import CourseReview from '../models/CourseReview.js';
import Enrollment from '../models/Enrollment.js';

/**
 * recomputeCourseRating — single source of truth for Course.rating/
 * totalReviews, via a Mongo aggregation instead of fetch-all-then-reduce-
 * in-JS. Shared by rateCourse/deleteReview below and the one-off migration
 * script (scripts/migrateCourseCatalog.js).
 */
export async function recomputeCourseRating(courseId, session = null) {
    const options = session ? { session } : {};
    const agg = await CourseReview.aggregate([
        { $match: { course: new mongoose.Types.ObjectId(courseId), isHidden: false } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ], options);

    const rating = agg.length > 0 ? Math.round(agg[0].avgRating * 10) / 10 : 0;
    const totalReviews = agg.length > 0 ? agg[0].count : 0;

    await Course.findByIdAndUpdate(courseId, { rating, totalReviews }, options);
    return { rating, totalReviews };
}

// Mirrors the session-with-fallback pattern established in utils/fulfillOrder.js
// (Atlas M0/M2/M5 don't support multi-document transactions).
async function createReviewWithSession(courseId, userId, rating, comment) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const [courseReview] = await CourseReview.create([{ course: courseId, user: userId, rating, comment }], { session });
        await recomputeCourseRating(courseId, session);
        await session.commitTransaction();
        return courseReview;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
}

async function createReviewWithoutSession(courseId, userId, rating, comment) {
    const courseReview = await CourseReview.create({ course: courseId, user: userId, rating, comment });
    await recomputeCourseRating(courseId);
    return courseReview;
}

// @desc    Submit a course review (rating + comment)
// @route   POST /api/v1/courses/:id/reviews  (also aliased at the legacy
//          POST /api/v1/courses/:id/rate path — same implementation)
// @access  Private (enrolled users or the course's own seller)
export const rateCourse = async (req, res, next) => {
    try {
        const { rating } = req.body;
        // Accept either `comment` (new field name) or `review` (the old
        // request body's field name) so the legacy /rate alias keeps working
        // with clients that still send the old shape.
        const commentText = (req.body.comment ?? req.body.review ?? '').trim();

        if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        if (commentText.length < 3) return res.status(400).json({ message: 'Please write a short review (min 3 characters)' });

        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const isOwner = course.seller.toString() === req.user.id;
        const isEnrolled = isOwner || !!(await Enrollment.findOne({ course: course._id, user: req.user.id, status: 'active' }));
        if (!isEnrolled) return res.status(403).json({ message: 'You must be enrolled to rate this course' });

        let courseReview;
        try {
            courseReview = await createReviewWithSession(course._id, req.user.id, Number(rating), commentText);
        } catch (err) {
            const isTransactionUnsupported = err.code === 20 || err.code === 263 || /Transaction|replica set|replication/i.test(err.message || '');
            if (isTransactionUnsupported) {
                courseReview = await createReviewWithoutSession(course._id, req.user.id, Number(rating), commentText);
            } else {
                throw err;
            }
        }

        const populated = await courseReview.populate('user', 'name');

        res.status(201).json({
            success: true,
            message: 'Review submitted!',
            data: populated,
        });
    } catch (error) {
        // The unique compound index on {course,user} is the real fix for the
        // old check-then-create duplicate-review race — this catches it
        // whichever creation path (session or fallback) raised it.
        if (error.code === 11000) {
            return res.status(400).json({ message: 'You have already reviewed this course. Delete your existing review to add a new one.' });
        }
        next(error);
    }
};

// @desc    Get public reviews for a course (paginated)
// @route   GET /api/v1/courses/:id/reviews
// @access  Public
export const getCourseReviews = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, Number(page) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(limit) || 10));

        const filter = { course: req.params.id, isHidden: false };
        const [reviews, total] = await Promise.all([
            CourseReview.find(filter)
                .populate('user', 'name')
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * pageSize)
                .limit(pageSize),
            CourseReview.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            count: reviews.length,
            total,
            page: pageNum,
            pages: Math.ceil(total / pageSize) || 1,
            data: reviews,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete own (or admin-moderated) course review
// @route   DELETE /api/v1/courses/:id/reviews/:reviewId
// @access  Private (own review, or admin/moderator)
export const deleteReview = async (req, res, next) => {
    try {
        const review = await CourseReview.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ message: 'Review not found' });

        const isOwner = review.user.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin', 'moderator'].includes(req.user.role);
        if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorised to delete this review' });

        const courseId = review.course;
        await review.deleteOne();
        await recomputeCourseRating(courseId);

        res.status(200).json({ success: true, message: 'Review deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Instructor reply to a review (new capability)
// @route   POST /api/v1/courses/:id/reviews/:reviewId/reply
// @access  Private (course's own seller, or admin)
export const replyToReview = async (req, res, next) => {
    try {
        const text = req.body.text?.trim();
        if (!text) return res.status(400).json({ message: 'Reply text is required' });

        const review = await CourseReview.findById(req.params.reviewId).populate('course', 'seller');
        if (!review) return res.status(404).json({ message: 'Review not found' });

        const isSeller = review.course.seller.toString() === req.user.id;
        if (!isSeller && !['admin', 'super_admin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Only the course instructor can reply to reviews' });
        }

        review.instructorReply = { text, repliedAt: new Date() };
        await review.save();

        res.status(200).json({ success: true, data: review });
    } catch (error) {
        next(error);
    }
};

// @desc    Report a review (new capability — dedup-checked, doesn't auto-hide)
// @route   POST /api/v1/courses/:id/reviews/:reviewId/report
// @access  Private
export const reportReview = async (req, res, next) => {
    try {
        const review = await CourseReview.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ message: 'Review not found' });

        if (review.reportedBy.map(String).includes(req.user.id)) {
            return res.status(400).json({ message: 'You have already reported this review' });
        }

        review.reportedBy.push(req.user.id);
        await review.save();

        res.status(200).json({ success: true, message: 'Review reported. Our team will review it shortly.' });
    } catch (error) {
        next(error);
    }
};
