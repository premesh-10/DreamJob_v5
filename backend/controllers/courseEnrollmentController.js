import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { hasActiveSubscription } from '../utils/subscription.js';
import { logAudit } from '../utils/auditLog.js';
import { signCourseStreamToken } from '../utils/courseStreamToken.js';
import { issueCourseCompletionCertificate } from '../services/certificateService.js';
import { sendMail } from '../utils/mailer.js';

const isAdminRole = (role) => role === 'admin' || role === 'super_admin';

const filterPendingAdd = (courseDoc) => {
    const c = typeof courseDoc.toObject === 'function' ? courseDoc.toObject() : courseDoc;
    if (c.chapters) c.chapters = c.chapters.filter(ch => ch.approvalStatus !== 'pending_add');
    if (c.resources) c.resources = c.resources.filter(r => r.approvalStatus !== 'pending_add');
    return c;
};

// @desc    Enroll in course
// @route   POST /api/v1/courses/:id/enroll
// @access  Private
export const enrollCourse = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id).populate('seller', 'name');
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const existingEnrollment = await Enrollment.findOne({ course: course._id, user: req.user.id, status: 'active' });
        if (existingEnrollment) {
            return res.status(400).json({ message: 'Already enrolled in this course' });
        }

        let amountPaid = 0;
        let paymentStatus = 'paid';
        const isCourseOwner = course.seller._id.toString() === req.user.id;
        let enrollmentType = 'purchase';
        let source = 'purchase';

        // Price is always taken from the DB, never the client — this endpoint
        // only ever handles genuinely free courses (or the owner's own course).
        // Any priced course must go through the Cashfree checkout flow, where
        // the subscription discount (if any) is applied server-side.
        if (isCourseOwner) {
            paymentStatus = 'free';
            amountPaid = 0;
            enrollmentType = 'purchase'; // Owners always have lifelong access
            source = 'owner';
        } else if (course.price > 0) {
            return res.status(400).json({
                message: 'Paid course purchases must be completed via the payment gateway.',
                requiresPayment: true,
                amount: course.price,
            });
        } else {
            amountPaid = 0;
            paymentStatus = 'free';
            source = 'free';
        }

        // The unique compound index on Enrollment{course,user} is the real
        // fix for the double-enrollment race the old array-only check
        // allowed — the findOne check above is just an early, friendly 400;
        // this catch is what actually guarantees correctness under concurrency.
        try {
            await Enrollment.create({ course: course._id, user: req.user.id, source, status: 'active' });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(400).json({ message: 'Already enrolled in this course' });
            }
            throw err;
        }

        // Single atomic write: inc the counter and add to legacy array together
        // so both can't diverge if the server crashes between two operations.
        await Course.findByIdAndUpdate(course._id, {
            $inc: { enrollmentCount: 1 },
            $addToSet: { enrolledUsers: req.user.id },
        });

        await Booking.create({
            user: req.user.id,
            type: 'course',
            course: course._id,
            seller: course.seller._id,
            amountPaid,
            paymentStatus,
            enrollmentType,
            status: 'confirmed'
        });

        await logAudit({ action: 'course.enrolled', targetType: 'Course', targetId: course._id, metadata: { source }, req });

        sendMail({
            to: req.user.email,
            subject: `You're enrolled in "${course.title}"`,
            html: `<h2 style="margin-top:0;color:#1e293b">Enrollment Confirmed!</h2>
                <p>Hi ${req.user.name},</p>
                <p>You&rsquo;ve successfully enrolled in <strong>${course.title}</strong>.</p>
                <p>Head back to the platform to start learning at your own pace.</p>`,
        }).catch(() => {});

        res.status(200).json({
            success: true,
            message: isCourseOwner
                ? 'Enrolled successfully (as course owner)'
                : 'Enrolled successfully'
        });
    } catch (error) {
        next(error);
    }
};

// getCourseAccess — single source of truth for "does this user have access
// to this course", shared by checkCourseAccess (below) and
// mintCourseStreamToken. Pure function, no req/res — easy to reuse.
export async function getCourseAccess(courseId, userId) {
    const course = await Course.findById(courseId);
    if (course && course.seller.toString() === userId) {
        return { hasAccess: true, method: 'purchase', validUntil: null }; // owner has full access equivalent to purchase
    }

    const bookings = await Booking.find({
        user: userId,
        course: courseId,
        type: 'course',
        status: 'confirmed'
    });

    if (!bookings || bookings.length === 0) {
        return { hasAccess: false, method: null, validUntil: null };
    }

    const purchaseBooking = bookings.find(b => b.enrollmentType === 'purchase');
    if (purchaseBooking) {
        return { hasAccess: true, method: 'purchase', validUntil: null };
    }

    const subscriptionBooking = bookings.find(b => b.enrollmentType === 'subscription');
    if (subscriptionBooking) {
        const user = await User.findById(userId).select('subscription');
        const isValid = hasActiveSubscription(user);
        return { hasAccess: isValid, method: 'subscription', validUntil: user.subscription.validUntil || null };
    }

    return { hasAccess: false, method: null, validUntil: null };
}

// @desc    Check user's access status for a course
// @route   GET /api/v1/courses/:id/access
// @access  Private
export const checkCourseAccess = async (req, res, next) => {
    try {
        const access = await getCourseAccess(req.params.id, req.user.id);
        res.status(200).json({ success: true, ...access });
    } catch (error) {
        next(error);
    }
};

// @desc    Get the calling user's progress for a course (new capability)
// @route   GET /api/v1/courses/:id/progress
// @access  Private
export const getProgress = async (req, res, next) => {
    try {
        const enrollment = await Enrollment.findOne({ course: req.params.id, user: req.user.id, status: 'active' });
        if (!enrollment) return res.status(404).json({ message: 'Not enrolled in this course' });
        res.status(200).json({ success: true, data: enrollment.progress });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark a chapter complete and recompute overall progress
// @route   PATCH /api/v1/courses/:id/progress
// @access  Private
export const updateProgress = async (req, res, next) => {
    try {
        const { chapterId } = req.body;

        const course = await Course.findById(req.params.id).select('chapters');
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const chapterExists = course.chapters.some(ch => ch._id.toString() === chapterId);
        if (!chapterExists) return res.status(404).json({ message: 'Chapter not found in this course' });

        const enrollment = await Enrollment.findOne({ course: req.params.id, user: req.user.id, status: 'active' });
        if (!enrollment) return res.status(403).json({ message: 'Not enrolled in this course' });

        const alreadyCompleted = enrollment.progress.completedChapters.some(c => c.chapter.toString() === chapterId);
        if (!alreadyCompleted) {
            enrollment.progress.completedChapters.push({ chapter: chapterId, completedAt: new Date() });
        }
        enrollment.progress.lastAccessedChapter = chapterId;

        const activeChapterIds = new Set(
            course.chapters
                .filter(ch => ch.approvalStatus !== 'pending_delete')
                .map(ch => ch._id.toString())
        );
        const totalChapters = activeChapterIds.size;
        const completedCount = enrollment.progress.completedChapters
            .filter(c => activeChapterIds.has(c.chapter.toString()))
            .length;
        enrollment.progress.percentComplete = totalChapters > 0
            ? Math.min(100, Math.round((completedCount / totalChapters) * 100))
            : 0;

        const justCompleted = enrollment.progress.percentComplete >= 100 && !enrollment.progress.completedAt;
        if (justCompleted) {
            enrollment.progress.completedAt = new Date();
            enrollment.certificateEligible = true;
        }

        await enrollment.save();

        if (justCompleted) {
            issueCourseCompletionCertificate(course, enrollment).catch(err =>
                console.error('[Progress] Certificate issuance failed:', err.message)
            );
        }

        res.status(200).json({ success: true, data: enrollment.progress });
    } catch (error) {
        next(error);
    }
};

// @desc    Save the user's playback position within a chapter (no completion)
// @route   PUT /api/v1/courses/:id/progress/position
// @access  Private
export const saveVideoPosition = async (req, res, next) => {
    try {
        const { chapterId, positionSeconds } = req.body;
        if (!chapterId || positionSeconds == null) {
            return res.status(400).json({ message: 'chapterId and positionSeconds are required' });
        }
        const enrollment = await Enrollment.findOne({ course: req.params.id, user: req.user.id, status: 'active' });
        if (!enrollment) return res.status(403).json({ message: 'Not enrolled in this course' });

        enrollment.progress.lastWatchedPosition = {
            chapter: chapterId,
            positionSeconds: Math.max(0, Number(positionSeconds)),
            updatedAt: new Date(),
        };
        enrollment.progress.lastAccessedChapter = chapterId;
        await enrollment.save();
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

// @desc    Get the calling user's enrolled courses, with progress — the new
//          Enrollment-backed equivalent of courseController.js's
//          getEnrolledCourses (kept working, queries the legacy array).
// @route   GET /api/v1/courses/my-enrollments
// @access  Private
export const getMyEnrollments = async (req, res, next) => {
    try {
        const enrollments = await Enrollment.find({ user: req.user.id, status: 'active' })
            .populate({ path: 'course', populate: { path: 'seller', select: 'name' } })
            .sort({ createdAt: -1 });

        const data = enrollments
            .filter(e => e.course) // guard against a dangling enrollment if its course was hard-deleted
            .map(e => ({
                ...filterPendingAdd(e.course),
                progress: e.progress,
                enrollmentSource: e.source,
            }));

        res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
        next(error);
    }
};

// @desc    Mint a short-lived token for streaming a protected course file
//          (chapter video, chapter PDF, or course resource) — the actual
//          bytes are served unauthenticated at GET /api/v1/course-stream
//          since a plain <video>/<a> tag can't send an Authorization header.
//          The relativePath is always resolved server-side from the
//          course/chapter/resource doc, never taken from the client.
// @route   GET /api/v1/courses/:id/stream-token?type=chapter-video|chapter-pdf|resource&itemId=...
// @access  Private
export const mintCourseStreamToken = async (req, res, next) => {
    try {
        const { type, itemId } = req.query;
        if (!['chapter-video', 'chapter-pdf', 'resource'].includes(type) || !itemId) {
            return res.status(400).json({ message: 'A valid type (chapter-video|chapter-pdf|resource) and itemId are required' });
        }

        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const isOwnerOrAdmin = course.seller.toString() === req.user.id || isAdminRole(req.user.role);

        let relativePath;
        let requiresFreeOrAccess = true;

        if (type === 'resource') {
            const resource = course.resources.id(itemId);
            if (!resource || !resource.filePath) return res.status(404).json({ message: 'Resource not found' });
            relativePath = resource.filePath;
        } else {
            const chapter = course.chapters.id(itemId);
            if (!chapter) return res.status(404).json({ message: 'Chapter not found' });
            relativePath = type === 'chapter-video' ? chapter.videoPath : chapter.pdfPath;
            if (!relativePath) return res.status(404).json({ message: 'File not found for this chapter' });
            requiresFreeOrAccess = !chapter.isFree; // free-preview chapters skip the access check below
        }

        if (!isOwnerOrAdmin && requiresFreeOrAccess) {
            const { hasAccess } = await getCourseAccess(course._id, req.user.id);
            if (!hasAccess) return res.status(403).json({ message: 'You do not have access to this content' });
        }

        const token = signCourseStreamToken(relativePath, req.user.id);
        res.status(200).json({ success: true, token, streamUrl: `/api/v1/course-stream?token=${token}` });
    } catch (error) {
        next(error);
    }
};

// @desc    Get the logged-in user's wishlist
// @route   GET /api/v1/courses/wishlist
// @access  Private
export const getWishlist = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id)
            .select('wishlist')
            .populate({ path: 'wishlist', select: 'title description thumbnailPath thumbnail price rating totalReviews enrollmentCount category seller slug', populate: { path: 'seller', select: 'name' } });
        res.status(200).json({ success: true, data: user?.wishlist || [] });
    } catch (error) { next(error); }
};

// @desc    Add a course to the wishlist (idempotent)
// @route   POST /api/v1/courses/:id/wishlist
// @access  Private
export const addToWishlist = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id).select('_id status');
        if (!course || course.status !== 'published') return res.status(404).json({ message: 'Course not found' });
        await User.findByIdAndUpdate(req.user.id, { $addToSet: { wishlist: course._id } });
        res.status(200).json({ success: true, message: 'Added to wishlist' });
    } catch (error) { next(error); }
};

// @desc    Remove a course from the wishlist
// @route   DELETE /api/v1/courses/:id/wishlist
// @access  Private
export const removeFromWishlist = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { $pull: { wishlist: req.params.id } });
        res.status(200).json({ success: true, message: 'Removed from wishlist' });
    } catch (error) { next(error); }
};
