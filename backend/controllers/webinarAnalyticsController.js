import Webinar from '../models/Webinar.js';
import WebinarRegistration from '../models/WebinarRegistration.js';
import WebinarSession from '../models/WebinarSession.js';
import WebinarPoll from '../models/WebinarPoll.js';
import WebinarQuestion from '../models/WebinarQuestion.js';
import WebinarFeedback from '../models/WebinarFeedback.js';
import Report from '../models/Report.js';
import { ADMIN_ROLES } from './webinarController.js';

// @desc    Per-webinar analytics for the owning seller (or admin) — registrations, attendance,
//          engagement (polls/Q&A), ratings, revenue, resource downloads.
// @route   GET /api/v1/webinars/:id/analytics
// @access  Private/Seller (owner) or Admin
export const getSellerWebinarAnalytics = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });
        if (webinar.seller.toString() !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const [registrationStats, session, pollStats, qaStats, feedbackStats] = await Promise.all([
            WebinarRegistration.aggregate([
                { $match: { webinar: webinar._id } },
                { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$payment.amount' } } },
            ]),
            WebinarSession.findOne({ webinar: webinar._id }).select('peakConcurrentParticipants totalHandRaises roomStatus'),
            WebinarPoll.aggregate([
                { $match: { webinar: webinar._id, status: 'closed' } },
                { $group: { _id: null, avgParticipation: { $avg: '$participationRate' }, count: { $sum: 1 } } },
            ]),
            WebinarQuestion.aggregate([
                { $match: { webinar: webinar._id } },
                { $group: { _id: null, total: { $sum: 1 }, totalUpvotes: { $sum: '$upvoteCount' }, answered: { $sum: { $cond: [{ $eq: ['$status', 'answered'] }, 1, 0] } } } },
            ]),
            WebinarFeedback.aggregate([
                { $match: { webinar: webinar._id } },
                { $group: { _id: null, averageRating: { $avg: '$rating' }, count: { $sum: 1 } } },
            ]),
        ]);

        const byStatus = Object.fromEntries(registrationStats.map(r => [r._id, r.count]));
        const registrationCount = (byStatus.registered || 0) + (byStatus.attended || 0);
        const attendedCount = byStatus.attended || 0;
        const revenue = registrationStats.reduce((sum, r) => sum + (r.revenue || 0), 0);

        res.status(200).json({
            success: true,
            data: {
                registrationCount,
                waitlistedCount: byStatus.waitlisted || 0,
                attendedCount,
                attendanceRate: registrationCount > 0 ? Math.round((attendedCount / registrationCount) * 100) : 0,
                peakConcurrentParticipants: session?.peakConcurrentParticipants || 0,
                totalHandRaises: session?.totalHandRaises || 0,
                pollParticipationRate: Math.round(pollStats[0]?.avgParticipation || 0),
                pollCount: pollStats[0]?.count || 0,
                questionCount: qaStats[0]?.total || 0,
                questionUpvotes: qaStats[0]?.totalUpvotes || 0,
                questionsAnswered: qaStats[0]?.answered || 0,
                averageRating: Math.round((feedbackStats[0]?.averageRating || 0) * 10) / 10,
                feedbackCount: feedbackStats[0]?.count || 0,
                revenue,
                resourceDownloads: (webinar.resources || []).reduce((sum, r) => sum + (r.downloadCount || 0), 0),
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Platform-wide webinar analytics — totals, category breakdown, top webinars,
//          featured-vs-not performance comparison, most-active attendees.
// @route   GET /api/v1/admin/webinars/analytics
// @access  Private/Admin
export const getAdminPlatformWebinarAnalytics = async (req, res, next) => {
    try {
        const [totals, categoryBreakdown, topWebinars, featuredComparison, feedbackOverall, revenueAgg, mostActiveAttendees] = await Promise.all([
            Webinar.aggregate([
                { $group: { _id: null, totalWebinars: { $sum: 1 }, totalRegistrations: { $sum: '$registrationCount' }, totalAttended: { $sum: '$attendedCount' } } },
            ]),
            Webinar.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 }, registrations: { $sum: '$registrationCount' } } },
                { $sort: { count: -1 } },
            ]),
            Webinar.find().sort({ registrationCount: -1 }).limit(5).select('name registrationCount attendedCount category').populate('seller', 'name'),
            Webinar.aggregate([
                { $group: { _id: '$isFeatured', count: { $sum: 1 }, avgRegistrations: { $avg: '$registrationCount' }, avgAttended: { $avg: '$attendedCount' } } },
            ]),
            WebinarFeedback.aggregate([
                { $group: { _id: null, averageRating: { $avg: '$rating' }, count: { $sum: 1 } } },
            ]),
            WebinarRegistration.aggregate([
                { $group: { _id: null, totalRevenue: { $sum: '$payment.amount' } } },
            ]),
            WebinarRegistration.aggregate([
                { $match: { status: 'attended' } },
                { $group: { _id: '$user', attendedCount: { $sum: 1 } } },
                { $sort: { attendedCount: -1 } },
                { $limit: 5 },
                { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
                { $unwind: '$user' },
                { $project: { _id: 0, userId: '$_id', name: '$user.name', email: '$user.email', attendedCount: 1 } },
            ]),
        ]);

        res.status(200).json({
            success: true,
            data: {
                totalWebinars: totals[0]?.totalWebinars || 0,
                totalRegistrations: totals[0]?.totalRegistrations || 0,
                totalAttended: totals[0]?.totalAttended || 0,
                totalRevenue: revenueAgg[0]?.totalRevenue || 0,
                averageRating: Math.round((feedbackOverall[0]?.averageRating || 0) * 10) / 10,
                feedbackCount: feedbackOverall[0]?.count || 0,
                categoryBreakdown: categoryBreakdown.map(c => ({ category: c._id || 'Uncategorized', count: c.count, registrations: c.registrations })),
                topWebinars,
                featuredPerformance: featuredComparison.map(f => ({
                    featured: !!f._id, count: f.count,
                    avgRegistrations: Math.round(f.avgRegistrations || 0), avgAttended: Math.round(f.avgAttended || 0),
                })),
                mostActiveAttendees,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Abuse-report queue for webinars/webinar participants (read-only list — resolution
//          actions are wired up in a later moderation pass).
// @route   GET /api/v1/admin/webinars/reports?status=pending
// @access  Private/Admin
export const getAdminWebinarReports = async (req, res, next) => {
    try {
        const { status = 'pending' } = req.query;
        const reports = await Report.find({ status, targetType: { $in: ['Webinar', 'WebinarParticipant'] } })
            .populate('reporter', 'name email')
            .populate('webinar', 'name')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: reports.length, data: reports });
    } catch (error) {
        next(error);
    }
};
