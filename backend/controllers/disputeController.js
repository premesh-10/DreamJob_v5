import Dispute from '../models/Dispute.js';
import InterviewSession from '../models/InterviewSession.js';
import { getCallerRole } from '../utils/sessionAccess.js';
import { logAudit } from '../utils/auditLog.js';

// @desc    Get disputes the caller raised or is named against
// @route   GET /api/v1/disputes/mine
// @access  Private
export const getMyDisputes = async (req, res, next) => {
    try {
        const disputes = await Dispute.find({ $or: [{ raisedBy: req.user._id }, { against: req.user._id }] })
            .populate('raisedBy', 'name')
            .populate('against', 'name')
            .populate({ path: 'session', select: 'interview scheduledStart scheduledEnd completionStatus', populate: { path: 'interview', select: 'domain' } })
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: disputes });
    } catch (error) {
        next(error);
    }
};

// @desc    Manually raise a dispute against an interview session — for abuse/
//          issues noticed outside the post-interview feedback flow (which
//          already auto-creates a dispute via submitFeedback's issueReported flag).
// @route   POST /api/v1/disputes
// @access  Private (candidate or interviewer on the session)
export const createDispute = async (req, res, next) => {
    try {
        const { sessionId, category, description, requestedResolution } = req.body;
        if (!sessionId || !description) {
            return res.status(400).json({ message: 'sessionId and description are required' });
        }

        const session = await InterviewSession.findById(sessionId);
        if (!session) return res.status(404).json({ message: 'Interview session not found' });

        const role = getCallerRole(session, req.user);
        if (role !== 'candidate' && role !== 'interviewer') {
            return res.status(403).json({ message: 'Only the candidate or interviewer can raise a dispute for this interview' });
        }

        const existing = await Dispute.findOne({ session: session._id, raisedBy: req.user._id, status: { $in: ['pending', 'under_review'] } });
        if (existing) {
            return res.status(400).json({ message: 'You already have an open dispute for this interview' });
        }

        const against = role === 'interviewer' ? session.candidate : session.interviewer;
        const dispute = await Dispute.create({
            session: session._id,
            booking: session.booking,
            raisedBy: req.user._id,
            raisedByRole: role,
            against,
            category: category || 'other',
            description,
            requestedResolution: requestedResolution || 'refund',
        });

        if (!['disputed', 'resolved'].includes(session.completionStatus)) {
            session.completionStatus = 'disputed';
            await session.save();
        }

        await logAudit({ actor: req.user._id, action: 'dispute.created', targetType: 'Dispute', targetId: dispute._id, metadata: { sessionId: session._id }, req });

        res.status(201).json({ success: true, data: dispute });
    } catch (error) {
        next(error);
    }
};
