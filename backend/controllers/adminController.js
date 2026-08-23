import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Booking from '../models/Booking.js';
import Seller from '../models/Seller.js';
import Course, { syncLegacyCourseFields } from '../models/Course.js';
import Interview from '../models/Interview.js';
import Coupon from '../models/Coupon.js';
import Notification from '../models/Notification.js';
import Feedback from '../models/Feedback.js';
import PaymentOrder from '../models/PaymentOrder.js';
import Dispute from '../models/Dispute.js';
import InterviewSession from '../models/InterviewSession.js';
import Settings from '../models/Settings.js';
import { invalidateSiteSettingsCache } from '../utils/siteSettingsCache.js';
import AuditLog from '../models/AuditLog.js';
import { storageProvider } from '../utils/storage.js';
import { applyRefundAndSync } from '../utils/applyRefundAndSync.js';
import { signRecordingStreamToken } from '../utils/recordingStreamToken.js';
import { verifySellerForAdminGrant } from '../utils/sellerVerification.js';
import { sendDisputeUpdate } from '../utils/interviewMailTemplates.js';
import { logAudit } from '../utils/auditLog.js';
import { revokeSubscription, hasActiveSubscription } from '../utils/subscription.js';
import { invalidatePrefix } from '../utils/cache.js';
import {
    adminSetCourseStatus as setCourseStatus,
    getCategories as getCategoriesShared,
    createCategory as createCategoryShared,
    updateCategory as updateCategoryShared,
    deactivateCategory as deactivateCategoryShared,
} from './courseController.js';


// ─── Admin Interviews ──────────────────────────────────────────────────────────

// @desc    Get all interview profiles for admin
// @route   GET /api/v1/admin/interviews
// @access  Private/Admin
export const getAdminInterviews = async (req, res, next) => {
    try {
        const interviews = await Interview.find()
            .populate('interviewer', 'name email experience');

        const sellersByUser = await Seller.find({ user: { $in: interviews.map(iv => iv.interviewer?._id).filter(Boolean) } })
            .select('user verification').lean();
        const verificationByUserId = new Map(sellersByUser.map(s => [s.user.toString(), s.verification?.status || 'unverified']));

        // Enrich with booking counts, session/dispute counts, and verification status
        const enriched = await Promise.all(interviews.map(async (iv) => {
            const [bookingCount, sessionIds] = await Promise.all([
                Booking.countDocuments({ interview: iv._id, type: 'interview' }),
                InterviewSession.find({ interview: iv._id }).select('_id').lean(),
            ]);
            const disputeCount = await Dispute.countDocuments({ session: { $in: sessionIds.map(s => s._id) } });

            return {
                _id: iv._id,
                domain: iv.domain,
                price: iv.price,
                meetingMode: iv.meetingMode,
                ratings: iv.ratings,
                totalReviews: iv.totalReviews,
                interviewer: iv.interviewer,
                verificationStatus: iv.interviewer ? (verificationByUserId.get(iv.interviewer._id.toString()) || 'unverified') : 'unverified',
                totalSlots: iv.slots?.length || 0,
                availableSlots: iv.slots?.filter(s => !s.isBooked).length || 0,
                totalBookings: bookingCount,
                totalSessions: sessionIds.length,
                disputeCount,
                createdAt: iv.createdAt
            };
        }));

        res.status(200).json({
            success: true,
            count: enriched.length,
            data: enriched
        });
    } catch (error) {
        next(error);
    }
};

// ─── Analytics ────────────────────────────────────────────────────────────────

// @desc    Get platform analytics
// @route   GET /api/v1/admin/analytics
// @access  Private/Admin
export const getAnalytics = async (req, res, next) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalSellers = await User.countDocuments({ role: 'seller' });
        const totalCourses = await Course.countDocuments();
        const publishedCourses = await Course.countDocuments({ isPublished: true });

        const subscriptions = await User.find({ 'subscription.plan': { $ne: 'None' } });
        const activeSubscriptions = subscriptions.length;

        const paidBookings = await Booking.find({ paymentStatus: 'paid' });
        const courseRevenue = paidBookings.filter(b => b.type === 'course').reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);
        const interviewRevenue = paidBookings.filter(b => b.type === 'interview').reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);
        const totalRevenue = courseRevenue + interviewRevenue;

        const totalBookings = await Booking.countDocuments();
        const pendingSellers = await Seller.countDocuments({ status: { $in: ['applied', 'verifying'] } });

        // Recent 7-day revenue trend
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentRevenue = await Transaction.aggregate([
            { $match: { type: 'credit', status: 'completed', createdAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt isBlocked');

        res.status(200).json({
            success: true,
            data: {
                totalUsers,
                totalSellers,
                totalCourses,
                publishedCourses,
                activeSubscriptions,
                totalRevenue,
                courseRevenue,
                interviewRevenue,
                totalBookings,
                pendingSellers,
                recentRevenue,
                recentUsers
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─── Users ────────────────────────────────────────────────────────────────────

// @desc    Get all users
// @route   GET /api/v1/admin/users
export const getUsers = async (req, res, next) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (error) { next(error); }
};

// @desc    Block or Unblock User
// @route   PATCH /api/v1/admin/users/:id/block
export const toggleBlockUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        user.isBlocked = !user.isBlocked;
        await user.save({ validateBeforeSave: false });
        res.status(200).json({
            success: true,
            isBlocked: user.isBlocked,
            message: `User ${user.name} has been ${user.isBlocked ? 'blocked' : 'unblocked'}`
        });
    } catch (error) { next(error); }
};

// @desc    Update user role
// @route   PATCH /api/v1/admin/users/:id/role
export const updateUserRole = async (req, res, next) => {
    try {
        const { role } = req.body;
        const allowedRoles = ['user', 'seller', 'admin', 'super_admin', 'moderator', 'finance_admin', 'support_admin'];
        if (!allowedRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' });

        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: false }).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (role === 'seller') {
            const existingSeller = await Seller.findOne({ user: user._id });
            if (existingSeller) {
                if (existingSeller.status !== 'approved') {
                    existingSeller.status = 'approved';
                    await existingSeller.save();
                }
                await verifySellerForAdminGrant(existingSeller, req.user._id);
            } else {
                const newSeller = await Seller.create({
                    user: user._id,
                    status: 'approved',
                    contentType: 'Both'
                });
                await verifySellerForAdminGrant(newSeller, req.user._id);
            }
        } else if (role === 'user') {
            // Remove the seller profile entirely if they are demoted to a regular user
            await Seller.findOneAndDelete({ user: user._id });
        }

        res.status(200).json({ success: true, data: user });
    } catch (error) { next(error); }
};

// ─── Sellers ──────────────────────────────────────────────────────────────────

// @desc    Get Sellers with course count, earnings
// @route   GET /api/v1/admin/sellers
export const getAdminSellers = async (req, res, next) => {
    try {
        const sellers = await Seller.find()
            .populate('user', 'name email mobile createdAt')
            .sort({ createdAt: -1 });

        const sellerUserIds = sellers.map(s => s.user._id);
        
        const courseCounts = await Course.aggregate([
            { $match: { seller: { $in: sellerUserIds } } },
            { $group: { _id: '$seller', count: { $sum: 1 } } }
        ]);

        const courseCountMap = {};
        courseCounts.forEach(c => {
            courseCountMap[c._id.toString()] = c.count;
        });

        // Attach course count and earnings for each seller
        const enriched = sellers.map(s => {
            const sObj = s.toObject();
            
            const totalWithdrawn = s.withdrawals
                .filter(w => w.status === 'completed' && w.type === 'withdrawal')
                .reduce((sum, w) => sum + (w.approvedAmount !== null ? w.approvedAmount : w.amount), 0);
            
            sObj.lifetimeEarnings = s.earnings + totalWithdrawn;
            sObj.presentBalance = s.earnings;
            sObj.courseCount = courseCountMap[s.user._id.toString()] || 0;

            return sObj;
        });

        res.status(200).json({ success: true, data: enriched });
    } catch (error) { next(error); }
};

// @desc    Get interviewer identity-verification requests, optionally filtered
//          by status (defaults to 'pending' — the actionable queue)
// @route   GET /api/v1/admin/verifications
export const getAdminVerificationRequests = async (req, res, next) => {
    try {
        const status = req.query.status || 'pending';
        const sellers = await Seller.find({ 'verification.status': status })
            .populate('user', 'name email mobile')
            .populate('verification.verifiedBy', 'name')
            .sort({ 'verification.submittedAt': -1 });

        res.status(200).json({ success: true, count: sellers.length, data: sellers });
    } catch (error) { next(error); }
};

// @desc    Approve or reject an interviewer's identity-verification request —
//          this is the gate that makes their Interview profile publicly listed.
// @route   PATCH /api/v1/admin/verifications/:sellerId
export const processVerification = async (req, res, next) => {
    try {
        const { decision, rejectionReason } = req.body; // decision: 'verified' | 'rejected'
        if (!['verified', 'rejected'].includes(decision)) {
            return res.status(400).json({ message: 'decision must be "verified" or "rejected"' });
        }

        const seller = await Seller.findById(req.params.sellerId).populate('user', 'name email');
        if (!seller) return res.status(404).json({ message: 'Seller not found' });

        seller.verification.status = decision;
        seller.verification.verifiedAt = decision === 'verified' ? new Date() : null;
        seller.verification.verifiedBy = req.user._id;
        seller.verification.rejectionReason = decision === 'rejected' ? (rejectionReason || '') : '';
        await seller.save();

        if (seller.user) {
            await Notification.create({
                title: decision === 'verified' ? 'Identity verification approved' : 'Identity verification rejected',
                message: decision === 'verified'
                    ? 'Your interviewer identity has been verified. Your Mock Interview profile is now publicly listed for booking.'
                    : `Your identity verification was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''} Please resubmit your document.`,
                targetUser: seller.user._id,
                targetRole: 'user',
                type: decision === 'verified' ? 'success' : 'warning',
            });
        }

        await logAudit({ actor: req.user._id, action: 'verification.processed', targetType: 'Seller', targetId: seller._id, metadata: { decision }, req });

        res.status(200).json({ success: true, data: seller });
    } catch (error) { next(error); }
};

// ─── Payments ─────────────────────────────────────────────────────────────────

// @desc    Get all payment orders for admin — PaymentOrder records with orderId
// @route   GET /api/v1/admin/payments
export const getAdminPayments = async (req, res, next) => {
    try {
        const orders = await PaymentOrder.find({ processed: true })
            .populate('user', 'name email')
            .populate('transaction', 'amount description status')
            .sort({ createdAt: -1 })
            .limit(500);
        res.status(200).json({ success: true, data: orders });
    } catch (error) { next(error); }
};

// ─── Bookings ─────────────────────────────────────────────────────────────────

// @desc    Get all bookings (interviews + courses)
// @route   GET /api/v1/admin/bookings
export const getAdminBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find()
            .populate('user', 'name email')
            .populate('seller', 'name email')
            .populate({ path: 'interview', select: 'domain price meetingMode' })
            .populate('course', 'title price')
            .populate('session', 'roomStatus completionStatus attendance scheduledStart scheduledEnd actualStart actualEnd durationSeconds')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: bookings.length, data: bookings });
    } catch (error) { next(error); }
};

// ─── Disputes ─────────────────────────────────────────────────────────────────

// @desc    Get disputes for moderation, optionally filtered by status
// @route   GET /api/v1/admin/disputes
export const getAdminDisputes = async (req, res, next) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};

        const disputes = await Dispute.find(query)
            .populate('raisedBy', 'name email')
            .populate('against', 'name email')
            .populate({
                path: 'session',
                select: 'interview booking scheduledStart scheduledEnd completionStatus recording',
                populate: { path: 'interview', select: 'domain' },
            })
            .populate({ path: 'booking', select: 'amountPaid paymentStatus' })
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: disputes.length, data: disputes });
    } catch (error) { next(error); }
};

// @desc    Resolve a dispute — optionally issuing a refund via the shared
//          applyRefundAndSync wrapper, never refundPayment() bare.
// @route   PATCH /api/v1/admin/disputes/:id/resolve
export const resolveDispute = async (req, res, next) => {
    try {
        const { faultDetermination, refundAmount, note } = req.body;

        const dispute = await Dispute.findById(req.params.id).populate('raisedBy', 'name email').populate('against', 'name email');
        if (!dispute) return res.status(404).json({ message: 'Dispute not found' });
        if (dispute.status === 'resolved') return res.status(400).json({ message: 'This dispute has already been resolved' });

        const amount = Number(refundAmount) || 0;
        let refundIssued = false;

        if (amount > 0) {
            const booking = await Booking.findById(dispute.booking);
            if (!booking) return res.status(404).json({ message: 'Linked booking not found' });
            const session = await InterviewSession.findById(dispute.session);
            const result = await applyRefundAndSync({
                booking, session,
                amount,
                note: note || `Refund issued via dispute resolution (${dispute._id})`,
            });
            refundIssued = result.success;
        }

        dispute.status = 'resolved';
        dispute.resolution = {
            faultDetermination: faultDetermination || 'unresolved',
            refundAmount: amount,
            refundIssued,
            note: note || '',
            resolvedBy: req.user._id,
            resolvedAt: new Date(),
        };
        await dispute.save();

        await Promise.allSettled([dispute.raisedBy, dispute.against].filter(Boolean).map(recipient => sendDisputeUpdate({
            recipient,
            title: 'Your dispute has been resolved',
            message: `An admin has reviewed your dispute and reached a decision${amount > 0 ? ` — a refund of ₹${amount.toFixed(2)} ${refundIssued ? 'has been issued' : 'was due but could not be initiated automatically; our team will process it manually'}.` : '.'}${note ? ` Note: ${note}` : ''}`,
        })));

        await logAudit({
            actor: req.user._id,
            action: 'dispute.resolved',
            targetType: 'Dispute',
            targetId: dispute._id,
            metadata: { faultDetermination, refundAmount: amount, refundIssued },
            req,
        });

        res.status(200).json({ success: true, data: dispute });
    } catch (error) { next(error); }
};

// ─── Interview Sessions (recordings / attendance) ──────────────────────────────

// @desc    Library of ready recordings, for moderation-only playback
// @route   GET /api/v1/admin/recordings
export const getAdminRecordings = async (req, res, next) => {
    try {
        const sessions = await InterviewSession.find({ 'recording.status': { $in: ['ready', 'processing', 'failed'] } })
            .populate('candidate', 'name email')
            .populate('interviewer', 'name email')
            .populate('interview', 'domain')
            .select('candidate interviewer interview recording scheduledStart completionStatus')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: sessions.length, data: sessions });
    } catch (error) { next(error); }
};

// @desc    Mint a short-lived signed token for streaming a recording in a
//          plain <video> tag (which can't carry an Authorization header).
// @route   GET /api/v1/admin/recordings/:sessionId/stream-token
export const getRecordingStreamToken = async (req, res, next) => {
    try {
        const session = await InterviewSession.findById(req.params.sessionId).select('recording');
        if (!session) return res.status(404).json({ message: 'Interview session not found' });
        if (session.recording.status !== 'ready' || !session.recording.filePath) {
            return res.status(404).json({ message: 'Recording is not available' });
        }

        const token = signRecordingStreamToken(session._id.toString(), req.user._id.toString());

        await logAudit({ actor: req.user._id, action: 'recording.accessed', targetType: 'InterviewSession', targetId: session._id, metadata: { via: 'admin_console' }, req });

        res.status(200).json({ success: true, data: { token, expiresIn: 120 } });
    } catch (error) { next(error); }
};

// @desc    Paginated session activity log — attendance + completion status,
//          filterable, for the platform-activity admin surface.
// @route   GET /api/v1/admin/interview-sessions
export const getAdminAttendanceLogs = async (req, res, next) => {
    try {
        const { completionStatus, page = 1, limit = 25 } = req.query;
        const query = completionStatus ? { completionStatus } : {};
        const pageNum = Math.max(1, Number(page));
        const pageSize = Math.min(100, Number(limit));

        const [sessions, total] = await Promise.all([
            InterviewSession.find(query)
                .populate('candidate', 'name email')
                .populate('interviewer', 'name email')
                .populate('interview', 'domain')
                .select('candidate interviewer interview scheduledStart scheduledEnd actualStart actualEnd durationSeconds attendance completionStatus roomStatus')
                .sort({ scheduledStart: -1 })
                .skip((pageNum - 1) * pageSize)
                .limit(pageSize),
            InterviewSession.countDocuments(query),
        ]);

        res.status(200).json({ success: true, count: sessions.length, total, page: pageNum, pages: Math.ceil(total / pageSize), data: sessions });
    } catch (error) { next(error); }
};

// ─── Audit Log ──────────────────────────────────────────────────────────────────

// @desc    Paginated, searchable audit trail of high-stakes admin/system actions
// @route   GET /api/v1/admin/audit-logs
export const getAdminAuditLogs = async (req, res, next) => {
    try {
        const { action, targetType, page = 1, limit = 50 } = req.query;
        const query = {};
        if (action) query.action = { $regex: action, $options: 'i' };
        if (targetType) query.targetType = targetType;
        const pageNum = Math.max(1, Number(page));
        const pageSize = Math.min(200, Number(limit));

        const [logs, total] = await Promise.all([
            AuditLog.find(query)
                .populate('actor', 'name email')
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * pageSize)
                .limit(pageSize),
            AuditLog.countDocuments(query),
        ]);

        res.status(200).json({ success: true, count: logs.length, total, page: pageNum, pages: Math.ceil(total / pageSize), data: logs });
    } catch (error) { next(error); }
};

// ─── Courses ──────────────────────────────────────────────────────────────────

// @desc    Get Courses for Moderation (paginated; optional status/pending filters)
// @route   GET /api/v1/admin/courses
export const getAdminCourses = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, pending } = req.query;
        const pageNum = Math.max(1, Number(page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

        const filter = {};
        if (status) filter.status = status;
        if (pending) filter['moderation.pending'] = pending;

        const [courses, total] = await Promise.all([
            Course.find(filter)
                .populate('seller', 'name email')
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * pageSize)
                .limit(pageSize),
            Course.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            count: courses.length,
            total,
            page: pageNum,
            pages: Math.ceil(total / pageSize) || 1,
            data: courses,
        });
    } catch (error) { next(error); }
};

// @desc    Toggle course published status — thin delegate to courseController's
//          adminSetCourseStatus (single source of truth for status changes,
//          including its own audit logging and cache invalidation).
// @route   PATCH /api/v1/admin/courses/:id/publish
export const toggleCoursePublished = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        req.body = { ...req.body, status: course.status === 'published' ? 'draft' : 'published' };
        return setCourseStatus(req, res, next);
    } catch (error) { next(error); }
};

// @desc    Admin force-delete a course
// @route   DELETE /api/v1/admin/courses/:id
export const adminDeleteCourse = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        const reason = req.body.reason || req.query.reason || 'No reason provided';

        // Delete all uploaded files via the storage abstraction
        if (course.thumbnailPath) await storageProvider.delete(course.thumbnailPath);
        for (const ch of course.chapters) {
            if (ch.videoPath) await storageProvider.delete(ch.videoPath);
            if (ch.pdfPath) await storageProvider.delete(ch.pdfPath);
        }
        for (const r of course.resources) {
            if (r.filePath) await storageProvider.delete(r.filePath);
        }

        await Seller.findOneAndUpdate(
            { user: course.seller },
            { $inc: { totalCourses: -1 } }
        );

        const sellerId = course.seller;
        const courseId = course._id;
        const courseTitle = course.title;
        await course.deleteOne();

        await logAudit({ action: 'course.deleted', targetType: 'Course', targetId: courseId, metadata: { reason, title: courseTitle }, req });

        await Notification.create({
            title: 'Course Deleted by Admin',
            message: `Your course "${courseTitle}" was deleted by an admin. Reason: ${reason}`,
            targetRole: 'seller',
            targetUser: sellerId,
            type: 'alert',
            createdBy: req.user.id
        });

        res.status(200).json({ success: true, message: 'Course permanently deleted by admin' });
    } catch (error) { next(error); }
};

// @desc    Admin reject a course-level request (publish/unpublish/delete)
// @route   PATCH /api/v1/admin/courses/:id/reject
export const adminRejectCourseRequest = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        const reason = req.body.reason || req.query.reason || 'No reason provided';

        const pending = course.moderation?.pending || 'none';
        let requestType = '';
        if (pending === 'publish') {
            requestType = 'Publish Request';
            course.moderation.rejectionReason = reason;
        } else if (pending === 'unpublish') {
            requestType = 'Unpublish Request';
        } else if (pending === 'delete') {
            requestType = 'Deletion Request';
        } else {
            return res.status(400).json({ message: 'Course is not in a pending state' });
        }

        course.moderation.pending = 'none';
        course.moderation.reviewedBy = req.user.id;
        course.moderation.reviewedAt = new Date();
        syncLegacyCourseFields(course);
        await course.save();

        await logAudit({ action: 'course.request_rejected', targetType: 'Course', targetId: course._id, metadata: { requestType, reason }, req });

        await Notification.create({
            title: `Course ${requestType} Rejected`,
            message: `Your ${requestType.toLowerCase()} for the course "${course.title}" was rejected by an admin. Reason: ${reason}`,
            targetRole: 'seller',
            targetUser: course.seller,
            type: 'warning',
            createdBy: req.user.id
        });

        res.status(200).json({ success: true, course, message: `${requestType} rejected` });
    } catch (error) { next(error); }
};

// @desc    Admin force-delete a chapter/video
// @route   DELETE /api/v1/admin/courses/:id/chapters/:chapterId
export const adminDeleteChapter = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ message: 'Chapter not found' });

        const reason = req.body.reason || req.query.reason || 'No reason provided';
        const chapterTitle = chapter.title;

        if (chapter.videoPath) await storageProvider.delete(chapter.videoPath);
        if (chapter.pdfPath) await storageProvider.delete(chapter.pdfPath);
        course.chapters.pull(req.params.chapterId);

        await course.save();

        await logAudit({ action: 'course.chapter_deleted', targetType: 'Course', targetId: course._id, metadata: { reason, chapterTitle }, req });

        await Notification.create({
            title: 'Video Deleted by Admin',
            message: `A video/chapter "${chapterTitle}" in your course "${course.title}" was deleted by an admin. Reason: ${reason}`,
            targetRole: 'seller',
            targetUser: course.seller,
            type: 'alert',
            createdBy: req.user.id
        });

        res.status(200).json({ success: true, message: 'Chapter permanently deleted by admin', course });
    } catch (error) { next(error); }
};

// @desc    Admin reject a chapter-level request (add/delete)
// @route   PATCH /api/v1/admin/courses/:id/chapters/:chapterId/reject
export const adminRejectChapterRequest = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ message: 'Chapter not found' });

        const reason = req.body.reason || req.query.reason || 'No reason provided';
        let requestType = '';

        if (chapter.approvalStatus === 'pending_add') {
            // Remove the draft chapter entirely
            requestType = 'Chapter Addition';
            if (chapter.videoPath) await storageProvider.delete(chapter.videoPath);
            if (chapter.pdfPath) await storageProvider.delete(chapter.pdfPath);
            course.chapters.pull(chapter._id);
        } else if (chapter.approvalStatus === 'pending_delete') {
            requestType = 'Chapter Deletion';
            chapter.approvalStatus = 'approved';
        } else {
            return res.status(400).json({ message: 'Chapter is not in a pending state' });
        }

        await course.save();
        invalidatePrefix('courses:list:');

        await logAudit({ action: 'course.chapter_request_rejected', targetType: 'Course', targetId: course._id, metadata: { requestType, reason, chapterTitle: chapter.title }, req });

        await Notification.create({
            title: `${requestType} Rejected`,
            message: `Your ${requestType.toLowerCase()} request for chapter "${chapter.title}" in course "${course.title}" was rejected. Reason: ${reason}`,
            targetRole: 'seller',
            targetUser: course.seller,
            type: 'warning',
            createdBy: req.user.id
        });

        res.status(200).json({ success: true, course, message: `${requestType} rejected` });
    } catch (error) { next(error); }
};

// @desc    Admin approve chapter addition/deletion
// @route   PATCH /api/v1/admin/courses/:id/chapters/:chapterId/approve
export const adminApproveChapter = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const chapter = course.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ message: 'Chapter not found' });
        const chapterTitle = chapter.title;
        let action;

        if (chapter.approvalStatus === 'pending_add') {
            chapter.approvalStatus = 'approved';
            action = 'course.chapter_add_approved';
        } else if (chapter.approvalStatus === 'pending_delete') {
            if (chapter.videoPath) await storageProvider.delete(chapter.videoPath);
            if (chapter.pdfPath) await storageProvider.delete(chapter.pdfPath);
            course.chapters.pull(req.params.chapterId);
            action = 'course.chapter_delete_approved';
        } else {
            return res.status(400).json({ message: 'Chapter does not require approval' });
        }

        await course.save();
        invalidatePrefix('courses:list:');
        await logAudit({ action, targetType: 'Course', targetId: course._id, metadata: { chapterTitle }, req });
        res.status(200).json({ success: true, message: 'Chapter approved', course });
    } catch (error) { next(error); }
};

// @desc    Admin approve resource addition/deletion
// @route   PATCH /api/v1/admin/courses/:id/resources/:resourceId/approve
export const adminApproveResource = async (req, res, next) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });

        const resource = course.resources.id(req.params.resourceId);
        if (!resource) return res.status(404).json({ message: 'Resource not found' });
        const resourceTitle = resource.title;
        let action;

        if (resource.approvalStatus === 'pending_add') {
            resource.approvalStatus = 'approved';
            action = 'course.resource_add_approved';
        } else if (resource.approvalStatus === 'pending_delete') {
            await storageProvider.delete(resource.filePath);
            course.resources.pull(req.params.resourceId);
            action = 'course.resource_delete_approved';
        } else {
            return res.status(400).json({ message: 'Resource does not require approval' });
        }

        await course.save();
        invalidatePrefix('courses:list:');
        await logAudit({ action, targetType: 'Course', targetId: course._id, metadata: { resourceTitle }, req });
        res.status(200).json({ success: true, message: 'Resource approved', course });
    } catch (error) { next(error); }
};

// ─── Category Moderation (thin re-exports — grouped here for route
//     consistency with the rest of adminRoutes.js; canonical implementation
//     lives in courseController.js) ───────────────────────────────────────
export const getAdminCategories = getCategoriesShared;
export const createCategoryAdmin = createCategoryShared;
export const updateCategoryAdmin = updateCategoryShared;
export const deactivateCategoryAdmin = deactivateCategoryShared;

// ─── Admin Platform Financial Ledger ─────────────────────────────────────────

// @desc    Platform financial overview — all money the platform has received and paid out
// @route   GET /api/v1/admin/wallet
export const getAdminWallet = async (req, res, next) => {
    try {
        // ── Total Income: all successful Cashfree payments ────────────────────
        const incomeByType = await PaymentOrder.aggregate([
            { $match: { processed: true, orderStatus: 'PAID' } },
            { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);

        const incomeMap = {};
        let totalIncome = 0;
        for (const row of incomeByType) {
            incomeMap[row._id] = { total: row.total, count: row.count };
            totalIncome += row.total;
        }

        // ── Total Payouts: completed seller withdrawals ────────────────────────
        const payoutAgg = await Transaction.aggregate([
            { $match: { description: /Seller Withdrawal Payout/, status: 'completed', type: 'debit' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);
        const totalPayouts = payoutAgg[0]?.total || 0;
        const totalPayoutCount = payoutAgg[0]?.count || 0;

        // ── Pending Payouts: sum of all seller current earnings (not yet withdrawn) ─
        const pendingAgg = await Seller.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$earnings' } } }
        ]);
        const totalPendingPayouts = pendingAgg[0]?.total || 0;

        // ── Platform Net Balance: income the platform retains after payouts ────
        const platformNetBalance = totalIncome - totalPayouts;

        // ── Recent Transactions (last 50, all types) ──────────────────────────
        const recentTransactions = await Transaction.find()
            .populate('user', 'name email role')
            .sort({ createdAt: -1 })
            .limit(50);

        // ── Total order counts ────────────────────────────────────────────────
        const totalOrders = await PaymentOrder.countDocuments({ orderStatus: 'PAID' });
        const totalFailedOrders = await PaymentOrder.countDocuments({ orderStatus: { $in: ['FAILED', 'EXPIRED', 'CANCELLED'] } });

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalIncome,
                    totalPayouts,
                    totalPendingPayouts,
                    platformNetBalance,
                    totalOrders,
                    totalFailedOrders,
                },
                incomeBreakdown: {
                    subscription: incomeMap['subscription'] || { total: 0, count: 0 },
                    course: incomeMap['course'] || { total: 0, count: 0 },
                    interview: incomeMap['interview'] || { total: 0, count: 0 },
                    webinar: incomeMap['webinar'] || { total: 0, count: 0 },
                },
                payouts: {
                    totalPaid: totalPayouts,
                    count: totalPayoutCount,
                },
                recentTransactions,
            }
        });
    } catch (error) { next(error); }
};

// ─── Subscriptions ────────────────────────────────────────────────────────────

// @desc    Get all active subscriptions
// @route   GET /api/v1/admin/subscriptions
export const getAdminSubscriptions = async (req, res, next) => {
    try {
        const subscribers = await User.find({ 'subscription.plan': { $ne: 'None' } })
            .select('name email subscription createdAt')
            .sort({ 'subscription.validUntil': -1 });

        const planCounts = {
            Silver: subscribers.filter(u => u.subscription.plan === 'Silver').length,
            Ruby: subscribers.filter(u => u.subscription.plan === 'Ruby').length,
            Platinum: subscribers.filter(u => u.subscription.plan === 'Platinum').length
        };

        res.status(200).json({
            success: true,
            count: subscribers.length,
            planCounts,
            data: subscribers
        });
    } catch (error) { next(error); }
};

// @desc    Admin: forcibly revoke a user's active subscription
// @route   DELETE /api/v1/admin/subscriptions/:userId
export const revokeUserSubscription = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.userId).select('name email subscription');
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!hasActiveSubscription(user)) {
            return res.status(400).json({ message: 'This user has no active subscription to revoke.' });
        }

        const { plan, validUntil } = user.subscription;
        await revokeSubscription(user._id);

        await Notification.create({
            title: 'Subscription Revoked',
            message: `Your ${plan} subscription has been revoked by an administrator. Please contact support if you believe this is an error. All your data and progress remain intact.`,
            targetUser: user._id,
            type: 'alert',
        });

        await logAudit({
            actor: req.user._id,
            action: 'subscription.admin_revoked',
            targetType: 'User',
            targetId: user._id,
            metadata: { plan, validUntil, revokedBy: req.user._id },
            req,
        });

        res.status(200).json({ success: true, message: `Subscription revoked for ${user.name}.` });
    } catch (error) { next(error); }
};

// ─── Coupons ──────────────────────────────────────────────────────────────────

// @desc    Get all coupons
// @route   GET /api/v1/admin/coupons
export const getAdminCoupons = async (req, res, next) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: coupons });
    } catch (error) { next(error); }
};

// @desc    Create coupon
// @route   POST /api/v1/admin/coupons
export const createCoupon = async (req, res, next) => {
    try {
        const coupon = await Coupon.create({ ...req.body, createdBy: req.user.id });
        res.status(201).json({ success: true, data: coupon });
    } catch (error) { next(error); }
};

// @desc    Toggle coupon active status
// @route   PATCH /api/v1/admin/coupons/:id/toggle
export const toggleCoupon = async (req, res, next) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
        coupon.isActive = !coupon.isActive;
        await coupon.save();
        res.status(200).json({ success: true, data: coupon });
    } catch (error) { next(error); }
};

// @desc    Delete coupon
// @route   DELETE /api/v1/admin/coupons/:id
export const deleteCoupon = async (req, res, next) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Coupon deleted' });
    } catch (error) { next(error); }
};

// ─── Feedback ─────────────────────────────────────────────────────────────────

// @desc    Get all feedback/reviews (from bookings/courses)
// @route   GET /api/v1/admin/feedback
export const getAdminFeedback = async (req, res, next) => {
    try {
        const feedback = await Feedback.find()
            .populate('user', 'name email')
            .sort({ createdAt: -1 });

        // For course/interview feedback, try to enrich with target name
        const enriched = await Promise.all(feedback.map(async (f) => {
            let targetName = null;
            if (f.type === 'course' && f.targetId) {
                const course = await Course.findById(f.targetId).select('title');
                targetName = course?.title || null;
            } else if (f.type === 'interview' && f.targetId) {
                const interview = await Interview.findById(f.targetId).select('domain');
                targetName = interview?.domain || null;
            }
            return {
                _id: f._id,
                user: f.user,
                type: f.type,
                category: f.category,
                rating: f.rating,
                review: f.review,
                targetName,
                createdAt: f.createdAt
            };
        }));

        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) { next(error); }
};

// ─── Notifications ────────────────────────────────────────────────────────────

// @desc    Get all notifications
// @route   GET /api/v1/admin/notifications
export const getAdminNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find()
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: notifications });
    } catch (error) { next(error); }
};

// @desc    Send notification
// @route   POST /api/v1/admin/notifications
export const sendNotification = async (req, res, next) => {
    try {
        const { title, message, targetRole, type } = req.body;
        const notification = await Notification.create({
            title, message, targetRole, type, createdBy: req.user.id
        });
        res.status(201).json({ success: true, data: notification });
    } catch (error) { next(error); }
};

// @desc    Delete notification
// @route   DELETE /api/v1/admin/notifications/:id
export const deleteNotification = async (req, res, next) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Notification deleted' });
    } catch (error) { next(error); }
};

// ─── Reports ──────────────────────────────────────────────────────────────────

// @desc    Get platform reports / aggregated stats
// @route   GET /api/v1/admin/reports
export const getAdminReports = async (req, res, next) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Monthly revenue (last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const monthlyRevenue = await Transaction.aggregate([
            { $match: { type: 'credit', status: 'completed', createdAt: { $gte: twelveMonthsAgo } } },
            {
                $group: {
                    _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                    revenue: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // New users per month
        const monthlyUsers = await User.aggregate([
            { $match: { createdAt: { $gte: twelveMonthsAgo } } },
            {
                $group: {
                    _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Top selling courses — sorted by enrollmentCount (the denormalized
        // counter). Sorting by enrolledUsers directly does NOT sort by array
        // length in MongoDB, which was a confirmed pre-existing bug here.
        const topCourses = await Course.find({ isPublished: true })
            .select('title price enrollmentCount category')
            .sort({ enrollmentCount: -1 })
            .limit(10);

        // Summary numbers
        const totalRevenue = await Transaction.aggregate([
            { $match: { type: 'credit', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
        const newBookingsThisMonth = await Booking.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

        res.status(200).json({
            success: true,
            data: {
                monthlyRevenue,
                monthlyUsers,
                topCourses: topCourses.map(c => ({
                    _id: c._id,
                    title: c.title,
                    price: c.price,
                    students: c.enrollmentCount,
                    category: c.category
                })),
                summary: {
                    totalRevenue: totalRevenue[0]?.total || 0,
                    newUsersThisMonth,
                    newBookingsThisMonth
                }
            }
        });
    } catch (error) { next(error); }
};

// ─── Security ─────────────────────────────────────────────────────────────────

// @desc    Get security overview — blocked users, admin accounts
// @route   GET /api/v1/admin/security
export const getSecurityLogs = async (req, res, next) => {
    try {
        const blockedUsers = await User.find({ isBlocked: true })
            .select('name email role isBlocked createdAt')
            .sort({ updatedAt: -1 });

        const adminUsers = await User.find({
            role: { $in: ['admin', 'super_admin', 'moderator', 'finance_admin', 'support_admin'] }
        }).select('name email role createdAt');

        const recentRegistrations = await User.find()
            .sort({ createdAt: -1 })
            .limit(20)
            .select('name email role createdAt');

        res.status(200).json({
            success: true,
            data: {
                blockedUsers,
                adminUsers,
                recentRegistrations,
                summary: {
                    totalBlocked: blockedUsers.length,
                    totalAdmins: adminUsers.length
                }
            }
        });
    } catch (error) { next(error); }
};

// ─── Settings ─────────────────────────────────────────────────────────────────
// Real, persisted Settings singleton — every interview join-window/no-show/
// refund/recording check across the platform reads this same document via
// Settings.getSettings(), so this admin endpoint is the single source of truth
// (no redeploy needed to change platform behavior).

const SETTINGS_FIELDS = [
    'interviewJoinWindowMinutesBefore', 'interviewJoinWindowMinutesAfterEnd',
    'lateJoinThresholdMinutes', 'noShowGraceMinutes',
    'recordingEnabled', 'recordingRequiresConsent', 'candidateCanViewOwnRecording',
    'reminderHoursBefore', 'cancellationFullRefundHoursBefore', 'cancellationPartialRefundPercent',
    'webinar',
];

// @desc    Get platform settings (Mock Interview operational config)
// @route   GET /api/v1/admin/settings
export const getAdminSettings = async (req, res, next) => {
    try {
        const settings = await Settings.getSettings();
        res.status(200).json({ success: true, data: settings });
    } catch (error) { next(error); }
};

// @desc    Update platform settings — persists to the real Settings singleton
// @route   PUT /api/v1/admin/settings
export const updateAdminSettings = async (req, res, next) => {
    try {
        const update = {};
        for (const field of SETTINGS_FIELDS) {
            if (req.body[field] !== undefined) update[field] = req.body[field];
        }

        const existing = await Settings.getSettings();
        Object.assign(existing, update);
        await existing.save();

        await logAudit({ actor: req.user._id, action: 'settings.updated', targetType: 'Settings', targetId: existing._id, metadata: update, req });

        res.status(200).json({ success: true, message: 'Settings updated successfully', data: existing });
    } catch (error) { next(error); }
};

const SITE_SETTINGS_FIELDS = [
    'siteName', 'tagline', 'supportEmail', 'contactPhone',
    'coursesEnabled', 'practiceTestsEnabled', 'mockInterviewsEnabled', 'webinarsEnabled', 'hubEnabled', 'subscriptionsEnabled',
    'allowUserRegistrations', 'allowSellerRegistrations', 'allowGoogleLogin', 'requireEmailVerification',
    'autoApproveCourses', 'autoApproveWebinars', 'autoApproveExperiences', 'allowAnonymousReviews',
    'paymentMode', 'defaultCurrency', 'platformCommissionPercent',
    'emailNotificationsEnabled', 'smsNotificationsEnabled',
    'twitterUrl', 'linkedinUrl', 'instagramUrl', 'youtubeUrl',
    'termsUrl', 'privacyUrl',
    'maintenanceMode', 'maintenanceMessage',
];

// @desc    Get site/system settings
// @route   GET /api/v1/admin/site-settings
export const getSiteSettings = async (req, res, next) => {
    try {
        const settings = await Settings.getSettings();
        res.status(200).json({ success: true, data: settings.site });
    } catch (error) { next(error); }
};

// @desc    Update site/system settings
// @route   PUT /api/v1/admin/site-settings
export const updateSiteSettings = async (req, res, next) => {
    try {
        const dotUpdate = {};
        for (const field of SITE_SETTINGS_FIELDS) {
            if (req.body[field] !== undefined) dotUpdate[`site.${field}`] = req.body[field];
        }
        const settings = await Settings.findOneAndUpdate(
            {},
            { $set: dotUpdate },
            { new: true, upsert: true }
        );
        await logAudit({ actor: req.user._id, action: 'site_settings.updated', targetType: 'Settings', targetId: settings._id, metadata: dotUpdate, req });
        invalidateSiteSettingsCache(); // Flush cache so changes take effect within milliseconds
        res.status(200).json({ success: true, message: 'Site settings updated successfully', data: settings.site });
    } catch (error) { next(error); }
};

// ─── Admin Review Management ───────────────────────────────────────────────────

// @desc    Get all reviews (with reported ones flagged)
// @route   GET /api/v1/admin/reviews
export const getAdminReviews = async (req, res, next) => {
    try {
        const { reported } = req.query;
        const query = reported === 'true' ? { isReported: true } : {};
        const reviews = await Feedback.find(query)
            .populate('user', 'name email')
            .populate('reportedBy', 'name')
            .sort({ isReported: -1, createdAt: -1 });

        // Enrich with target name for courses
        const enriched = await Promise.all(reviews.map(async (f) => {
            let targetName = null;
            if (f.type === 'course' && f.targetId) {
                const course = await Course.findById(f.targetId).select('title');
                targetName = course?.title || null;
            }
            return {
                _id: f._id,
                user: f.user,
                type: f.type,
                category: f.category,
                rating: f.rating,
                review: f.review,
                isHidden: f.isHidden,
                isReported: f.isReported,
                reportedBy: f.reportedBy,
                reportReason: f.reportReason,
                reportCount: f.reportedBy?.length || 0,
                targetName,
                targetId: f.targetId,
                createdAt: f.createdAt
            };
        }));

        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) { next(error); }
};

// @desc    Toggle hide/show a review
// @route   PATCH /api/v1/admin/reviews/:id/hide
export const hideReview = async (req, res, next) => {
    try {
        const review = await Feedback.findById(req.params.id);
        if (!review) return res.status(404).json({ message: 'Review not found' });

        review.isHidden = !review.isHidden;
        review.isReported = false; // clear report flag if admin acts on it
        await review.save();

        // Recompute course rating if needed
        if (review.type === 'course' && review.targetId) {
            const course = await Course.findById(review.targetId);
            if (course) {
                const allReviews = await Feedback.find({ type: 'course', targetId: review.targetId, isHidden: false });
                course.rating = allReviews.length > 0 ? allReviews.reduce((s, f) => s + (f.rating || 0), 0) / allReviews.length : 0;
                course.totalReviews = allReviews.length;
                await course.save();
            }
        }

        res.status(200).json({ success: true, message: review.isHidden ? 'Review hidden from public' : 'Review restored', data: { isHidden: review.isHidden } });
    } catch (error) { next(error); }
};

// @desc    Hard delete a review (admin)
// @route   DELETE /api/v1/admin/reviews/:id
export const deleteAdminReview = async (req, res, next) => {
    try {
        const review = await Feedback.findById(req.params.id);
        if (!review) return res.status(404).json({ message: 'Review not found' });

        const targetId = review.targetId;
        const type = review.type;
        await review.deleteOne();

        if (type === 'course' && targetId) {
            const course = await Course.findById(targetId);
            if (course) {
                const allReviews = await Feedback.find({ type: 'course', targetId, isHidden: false });
                course.rating = allReviews.length > 0 ? allReviews.reduce((s, f) => s + (f.rating || 0), 0) / allReviews.length : 0;
                course.totalReviews = allReviews.length;
                await course.save();
            }
        }

        res.status(200).json({ success: true, message: 'Review permanently deleted' });
    } catch (error) { next(error); }
};

