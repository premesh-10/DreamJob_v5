import mongoose from 'mongoose';
import InterviewExperience from '../models/InterviewExperience.js';
import Company from '../models/Company.js';
import Comment from '../models/Comment.js';
import Like from '../models/Like.js';
import Bookmark from '../models/Bookmark.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import PointsTransaction from '../models/PointsTransaction.js';
import { findOrCreateCompany } from './companyController.js';
import { awardPoints, POINTS_RULES, getLevelProgress, LEVELS } from '../utils/gamification.js';

const DIFFICULTY_LABELS = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

const publicAuthor = (user) => user && {
    _id: user._id, name: user.name, profilePic: user.profilePic,
    hubLevel: user.hubLevel, contributionPoints: user.contributionPoints,
};

// ── Recompute a company's cached stats from its published experiences ──────────
async function recomputeCompanyStats(companyId) {
    const experiences = await InterviewExperience.find({ company: companyId, status: 'published' })
        .select('result overallDifficulty rounds');

    const roundTypeCounts = {};
    let difficultySum = 0;
    let selectedCount = 0, rejectedCount = 0, pendingCount = 0;

    experiences.forEach(exp => {
        if (exp.result === 'Selected') selectedCount += 1;
        else if (exp.result === 'Rejected') rejectedCount += 1;
        else pendingCount += 1;
        difficultySum += exp.overallDifficulty || 0;
        (exp.rounds || []).forEach(r => {
            const key = r.roundType === 'Custom' ? (r.customRoundType || 'Custom') : r.roundType;
            roundTypeCounts[key] = (roundTypeCounts[key] || 0) + 1;
        });
    });

    await Company.findByIdAndUpdate(companyId, {
        $set: {
            'stats.totalExperiences': experiences.length,
            'stats.selectedCount': selectedCount,
            'stats.rejectedCount': rejectedCount,
            'stats.pendingCount': pendingCount,
            'stats.avgDifficulty': experiences.length ? Math.round((difficultySum / experiences.length) * 10) / 10 : 0,
            'stats.roundTypeCounts': roundTypeCounts,
        },
    });
}

// ── Derive search tags from round types + concepts, for the text index ─────────
function deriveTags(body) {
    const tags = new Set();
    (body.rounds || []).forEach(r => {
        if (r.roundType) tags.add(r.roundType);
        (r.conceptsDiscussed || []).forEach(c => tags.add(c));
    });
    if (body.jobRole) tags.add(body.jobRole);
    return Array.from(tags);
}

// @desc    Create an interview experience
// @route   POST /api/v1/experiences
// @access  Private
export const createExperience = async (req, res, next) => {
    try {
        const body = req.body;
        if (!body.companyName) return res.status(400).json({ message: 'Company name is required' });
        if (!body.acceptedTerms) return res.status(400).json({ message: 'You must accept the contributor terms before submitting' });
        if (!Array.isArray(body.rounds) || body.rounds.length === 0) {
            return res.status(400).json({ message: 'Please add at least one interview round' });
        }

        const company = await findOrCreateCompany(body.companyName, req.user.id);

        const experience = await InterviewExperience.create({
            user: req.user.id,
            company: company._id,
            companyNameRaw: body.companyName.trim(),
            jobRole: body.jobRole,
            experienceLevel: body.experienceLevel,
            interviewDate: body.interviewDate,
            interviewMode: body.interviewMode,
            applicationSource: body.applicationSource,
            sourceOther: body.sourceOther || '',
            result: body.result,
            overallDifficulty: body.overallDifficulty,
            overallExperienceText: body.overallExperienceText,
            rounds: body.rounds,
            resourcesShared: body.resourcesShared || [],
            mistakesToAvoid: body.mistakesToAvoid || '',
            adviceForFutureCandidates: body.adviceForFutureCandidates || '',
            acceptedTerms: true,
            tags: deriveTags(body),
        });

        await recomputeCompanyStats(company._id);
        await awardPoints(req.user.id, POINTS_RULES.experience_submitted, 'experience_submitted', {
            refType: 'experience', refId: experience._id, description: `Submitted experience for ${company.name}`,
        });

        res.status(201).json({ success: true, data: experience });
    } catch (error) {
        next(error);
    }
};

// @desc    List/search/filter interview experiences
// @route   GET /api/v1/experiences
// @access  Public
export const getExperiences = async (req, res, next) => {
    try {
        const {
            company, jobRole, experienceLevel, interviewMode, result,
            minDifficulty, maxDifficulty, search, sort, page = 1, limit = 20,
        } = req.query;

        const query = { status: 'published' };
        if (company && mongoose.Types.ObjectId.isValid(company)) query.company = company;
        if (jobRole) query.jobRole = { $regex: jobRole, $options: 'i' };
        if (experienceLevel) query.experienceLevel = experienceLevel;
        if (interviewMode) query.interviewMode = interviewMode;
        if (result) query.result = result;
        if (minDifficulty || maxDifficulty) {
            query.overallDifficulty = {};
            if (minDifficulty) query.overallDifficulty.$gte = Number(minDifficulty);
            if (maxDifficulty) query.overallDifficulty.$lte = Number(maxDifficulty);
        }
        if (search) {
            query.$or = [
                { companyNameRaw: { $regex: search, $options: 'i' } },
                { jobRole: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } },
            ];
        }

        let sortSpec = { createdAt: -1 };
        if (sort === 'popular') sortSpec = { likesCount: -1, createdAt: -1 };
        if (sort === 'mostViewed') sortSpec = { viewCount: -1 };

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(50, Number(limit));

        const [experiences, total] = await Promise.all([
            InterviewExperience.find(query)
                .populate('user', 'name profilePic hubLevel')
                .populate('company', 'name slug logo')
                .sort(sortSpec)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            InterviewExperience.countDocuments(query),
        ]);

        res.status(200).json({
            success: true,
            count: experiences.length,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            data: experiences,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get a single experience (increments view count)
// @route   GET /api/v1/experiences/:id
// @access  Public
export const getExperience = async (req, res, next) => {
    try {
        const experience = await InterviewExperience.findByIdAndUpdate(
            req.params.id,
            { $inc: { viewCount: 1 } },
            { new: true }
        )
            .populate('user', 'name profilePic hubLevel contributionPoints')
            .populate('company', 'name slug logo linkedResources');

        if (!experience || experience.status === 'removed') {
            return res.status(404).json({ message: 'Experience not found' });
        }

        let viewerHasLiked = false, viewerHasBookmarked = false;
        if (req.user) {
            const [like, bookmark] = await Promise.all([
                Like.findOne({ user: req.user.id, targetType: 'experience', targetId: experience._id }),
                Bookmark.findOne({ user: req.user.id, experience: experience._id }),
            ]);
            viewerHasLiked = !!like;
            viewerHasBookmarked = !!bookmark;
        }

        res.status(200).json({ success: true, data: experience, viewerHasLiked, viewerHasBookmarked });
    } catch (error) {
        next(error);
    }
};

// @desc    Update an experience (owner or admin)
// @route   PUT /api/v1/experiences/:id
// @access  Private
export const updateExperience = async (req, res, next) => {
    try {
        const experience = await InterviewExperience.findById(req.params.id);
        if (!experience) return res.status(404).json({ message: 'Experience not found' });

        const adminRoles = ['admin', 'super_admin', 'moderator'];
        if (experience.user.toString() !== req.user.id && !adminRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized to edit this experience' });
        }

        const editableFields = [
            'jobRole', 'experienceLevel', 'interviewDate', 'interviewMode', 'applicationSource', 'sourceOther',
            'result', 'overallDifficulty', 'overallExperienceText', 'rounds', 'resourcesShared',
            'mistakesToAvoid', 'adviceForFutureCandidates',
        ];
        editableFields.forEach(field => {
            if (req.body[field] !== undefined) experience[field] = req.body[field];
        });
        if (req.body.rounds) experience.tags = deriveTags(req.body);

        await experience.save();
        await recomputeCompanyStats(experience.company);

        res.status(200).json({ success: true, data: experience });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete an experience (owner or admin)
// @route   DELETE /api/v1/experiences/:id
// @access  Private
export const deleteExperience = async (req, res, next) => {
    try {
        const experience = await InterviewExperience.findById(req.params.id);
        if (!experience) return res.status(404).json({ message: 'Experience not found' });

        const adminRoles = ['admin', 'super_admin', 'moderator'];
        if (experience.user.toString() !== req.user.id && !adminRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized to delete this experience' });
        }

        await Promise.all([
            Comment.deleteMany({ experience: experience._id }),
            Like.deleteMany({ targetType: 'experience', targetId: experience._id }),
            Bookmark.deleteMany({ experience: experience._id }),
        ]);
        const companyId = experience.company;
        await experience.deleteOne();
        await recomputeCompanyStats(companyId);

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle like on an experience
// @route   POST /api/v1/experiences/:id/like
// @access  Private
export const toggleLikeExperience = async (req, res, next) => {
    try {
        const experience = await InterviewExperience.findById(req.params.id);
        if (!experience) return res.status(404).json({ message: 'Experience not found' });

        const existing = await Like.findOne({ user: req.user.id, targetType: 'experience', targetId: experience._id });

        let liked;
        if (existing) {
            await existing.deleteOne();
            experience.likesCount = Math.max(0, experience.likesCount - 1);
            liked = false;
            if (experience.user.toString() !== req.user.id) {
                await awardPoints(experience.user, -POINTS_RULES.experience_liked, 'experience_liked', {
                    refType: 'experience', refId: experience._id, description: 'Like removed',
                });
            }
        } else {
            await Like.create({ user: req.user.id, targetType: 'experience', targetId: experience._id });
            experience.likesCount += 1;
            liked = true;
            if (experience.user.toString() !== req.user.id) {
                await awardPoints(experience.user, POINTS_RULES.experience_liked, 'experience_liked', {
                    refType: 'experience', refId: experience._id, description: 'Received a like',
                });
            }
        }
        await experience.save();

        res.status(200).json({ success: true, liked, likesCount: experience.likesCount });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle bookmark on an experience
// @route   POST /api/v1/experiences/:id/bookmark
// @access  Private
export const toggleBookmark = async (req, res, next) => {
    try {
        const experience = await InterviewExperience.findById(req.params.id);
        if (!experience) return res.status(404).json({ message: 'Experience not found' });

        const existing = await Bookmark.findOne({ user: req.user.id, experience: experience._id });
        let bookmarked;
        if (existing) {
            await existing.deleteOne();
            experience.bookmarksCount = Math.max(0, experience.bookmarksCount - 1);
            bookmarked = false;
        } else {
            await Bookmark.create({ user: req.user.id, experience: experience._id });
            experience.bookmarksCount += 1;
            bookmarked = true;
        }
        await experience.save();

        res.status(200).json({ success: true, bookmarked, bookmarksCount: experience.bookmarksCount });
    } catch (error) {
        next(error);
    }
};

// @desc    Get my bookmarked experiences
// @route   GET /api/v1/experiences/me/bookmarks
// @access  Private
export const getMyBookmarks = async (req, res, next) => {
    try {
        const bookmarks = await Bookmark.find({ user: req.user.id }).sort({ createdAt: -1 });
        const experienceIds = bookmarks.map(b => b.experience);
        const experiences = await InterviewExperience.find({ _id: { $in: experienceIds }, status: { $ne: 'removed' } })
            .populate('company', 'name slug logo')
            .populate('user', 'name profilePic');
        res.status(200).json({ success: true, count: experiences.length, data: experiences });
    } catch (error) {
        next(error);
    }
};

// @desc    Add a comment to an experience
// @route   POST /api/v1/experiences/:id/comments
// @access  Private
export const addComment = async (req, res, next) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ message: 'Comment text is required' });

        const experience = await InterviewExperience.findById(req.params.id);
        if (!experience) return res.status(404).json({ message: 'Experience not found' });

        const comment = await Comment.create({ experience: experience._id, user: req.user.id, text: text.trim() });
        experience.commentsCount += 1;
        await experience.save();

        await awardPoints(req.user.id, POINTS_RULES.comment_posted, 'comment_posted', {
            refType: 'comment', refId: comment._id, description: `Commented on an experience for ${experience.companyNameRaw}`,
        });

        const populated = await Comment.findById(comment._id).populate('user', 'name profilePic hubLevel');
        res.status(201).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

// @desc    List comments for an experience
// @route   GET /api/v1/experiences/:id/comments
// @access  Public
export const getComments = async (req, res, next) => {
    try {
        const comments = await Comment.find({ experience: req.params.id, status: 'visible' })
            .populate('user', 'name profilePic hubLevel')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: comments.length, data: comments });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a comment (owner or admin)
// @route   DELETE /api/v1/experiences/comments/:commentId
// @access  Private
export const deleteComment = async (req, res, next) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        const adminRoles = ['admin', 'super_admin', 'moderator'];
        if (comment.user.toString() !== req.user.id && !adminRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized to delete this comment' });
        }

        await Like.deleteMany({ targetType: 'comment', targetId: comment._id });
        await InterviewExperience.findByIdAndUpdate(comment.experience, { $inc: { commentsCount: -1 } });
        await comment.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle like on a comment
// @route   POST /api/v1/experiences/comments/:commentId/like
// @access  Private
export const toggleLikeComment = async (req, res, next) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        const existing = await Like.findOne({ user: req.user.id, targetType: 'comment', targetId: comment._id });
        let liked;
        if (existing) {
            await existing.deleteOne();
            comment.likesCount = Math.max(0, comment.likesCount - 1);
            liked = false;
            if (comment.user.toString() !== req.user.id) {
                await awardPoints(comment.user, -POINTS_RULES.comment_liked, 'comment_liked', { refType: 'comment', refId: comment._id });
            }
        } else {
            await Like.create({ user: req.user.id, targetType: 'comment', targetId: comment._id });
            comment.likesCount += 1;
            liked = true;
            if (comment.user.toString() !== req.user.id) {
                await awardPoints(comment.user, POINTS_RULES.comment_liked, 'comment_liked', { refType: 'comment', refId: comment._id });
            }
        }
        await comment.save();

        res.status(200).json({ success: true, liked, likesCount: comment.likesCount });
    } catch (error) {
        next(error);
    }
};

// @desc    Report an experience, comment, webinar, or a participant within a webinar
// @route   POST /api/v1/experiences/report
// @access  Private
// Body for 'WebinarParticipant': { targetType, targetId: <reported user id>, webinar: <webinar id>, reason, details }
export const reportContent = async (req, res, next) => {
    try {
        const { targetType, targetId, webinar: webinarId, reason, details } = req.body;
        if (!['experience', 'comment', 'Webinar', 'WebinarParticipant'].includes(targetType)) {
            return res.status(400).json({ message: 'Invalid targetType' });
        }
        if (!reason) return res.status(400).json({ message: 'Reason is required' });

        if (targetType === 'experience' || targetType === 'comment') {
            const Model = targetType === 'experience' ? InterviewExperience : Comment;
            const target = await Model.findById(targetId);
            if (!target) return res.status(404).json({ message: 'Content not found' });
        } else if (targetType === 'Webinar') {
            const { default: Webinar } = await import('../models/Webinar.js');
            const target = await Webinar.findById(targetId);
            if (!target) return res.status(404).json({ message: 'Webinar not found' });
        } else {
            // WebinarParticipant — targetId is the reported user's id, webinarId scopes which webinar.
            if (!webinarId) return res.status(400).json({ message: 'webinar is required when reporting a participant' });
            const { default: Webinar } = await import('../models/Webinar.js');
            const target = await Webinar.findById(webinarId);
            if (!target) return res.status(404).json({ message: 'Webinar not found' });
        }

        const report = await Report.create({
            reporter: req.user.id, targetType, targetId, reason, details: details || '',
            webinar: targetType === 'WebinarParticipant' ? webinarId : (targetType === 'Webinar' ? targetId : null),
        });
        res.status(201).json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle "featured" on an experience (Admin)
// @route   PUT /api/v1/experiences/:id/feature
// @access  Private/Admin
export const toggleFeatureExperience = async (req, res, next) => {
    try {
        const experience = await InterviewExperience.findById(req.params.id);
        if (!experience) return res.status(404).json({ message: 'Experience not found' });

        experience.isFeatured = !experience.isFeatured;
        await experience.save();

        if (experience.isFeatured) {
            await awardPoints(experience.user, POINTS_RULES.experience_featured, 'experience_featured', {
                refType: 'experience', refId: experience._id, description: 'Experience featured by admin',
            });
        }

        res.status(200).json({ success: true, data: experience });
    } catch (error) {
        next(error);
    }
};

// @desc    Top contributors leaderboard
// @route   GET /api/v1/experiences/leaderboard?window=all|monthly&limit=10
// @access  Public
export const getLeaderboard = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;
        const users = await User.find({ contributionPoints: { $gt: 0 } })
            .select('name profilePic contributionPoints hubLevel')
            .sort({ contributionPoints: -1 })
            .limit(Math.min(100, Number(limit)));

        const data = users.map(u => ({ ...u.toObject(), ...getLevelProgress(u.contributionPoints) }));
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// @desc    Most frequently asked interview questions (optionally scoped to a company)
// @route   GET /api/v1/experiences/top-questions?company=<id>&limit=15
// @access  Public
export const getTopQuestions = async (req, res, next) => {
    try {
        const { company, limit = 15 } = req.query;
        const match = { status: 'published' };
        if (company && mongoose.Types.ObjectId.isValid(company)) match.company = new mongoose.Types.ObjectId(company);

        const results = await InterviewExperience.aggregate([
            { $match: match },
            { $unwind: '$rounds' },
            { $unwind: '$rounds.questionsAsked' },
            { $group: { _id: '$rounds.questionsAsked', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: Math.min(50, Number(limit)) },
        ]);

        res.status(200).json({ success: true, data: results.map(r => ({ question: r._id, count: r.count })) });
    } catch (error) {
        next(error);
    }
};

// @desc    My gamification profile — points, level progress, badges, recent activity
// @route   GET /api/v1/experiences/me/gamification
// @access  Private
export const getMyGamificationProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('name profilePic contributionPoints hubLevel');
        const [experienceCount, commentCount, recentTransactions] = await Promise.all([
            InterviewExperience.countDocuments({ user: req.user.id, status: { $ne: 'removed' } }),
            Comment.countDocuments({ user: req.user.id, status: 'visible' }),
            PointsTransaction.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(25),
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...getLevelProgress(user.contributionPoints),
                name: user.name,
                profilePic: user.profilePic,
                badges: LEVELS.filter(l => user.contributionPoints >= l.minPoints).map(l => l.name),
                experienceCount,
                commentCount,
                recentTransactions,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ── Admin moderation ────────────────────────────────────────────────────────────

// @desc    List content reports (Admin)
// @route   GET /api/v1/experiences/admin/reports?status=pending
// @access  Private/Admin
export const adminGetReports = async (req, res, next) => {
    try {
        const { status = 'pending' } = req.query;
        const reports = await Report.find({ status }).populate('reporter', 'name email').populate('webinar', 'name').sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: reports.length, data: reports });
    } catch (error) {
        next(error);
    }
};

// @desc    Action a report — dismiss or remove the underlying content (Admin)
// @route   PUT /api/v1/experiences/admin/reports/:id
// @access  Private/Admin
// Body: { action: 'dismiss' | 'remove', resolutionNote }
export const adminResolveReport = async (req, res, next) => {
    try {
        const { action, resolutionNote } = req.body;
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Report not found' });

        if (action === 'remove') {
            if (report.targetType === 'experience' || report.targetType === 'comment') {
                const Model = report.targetType === 'experience' ? InterviewExperience : Comment;
                const target = await Model.findById(report.targetId);
                if (target) {
                    target.status = 'removed';
                    await target.save();
                    await awardPoints(target.user, POINTS_RULES.experience_removed_penalty, 'experience_removed_penalty', {
                        refType: report.targetType, refId: target._id, description: `Content removed after report: ${report.reason}`,
                    });
                    if (report.targetType === 'experience') await recomputeCompanyStats(target.company);
                }
            } else if (report.targetType === 'Webinar') {
                // "Remove" for a webinar means deactivating it from public view — its `status`
                // enum (upcoming/live/completed/cancelled) has no 'removed' value, so isActive
                // is the correct lever here (mirrors adminToggleWebinar's existing field).
                const { default: Webinar } = await import('../models/Webinar.js');
                await Webinar.findByIdAndUpdate(report.targetId, { isActive: false });
            } else if (report.targetType === 'WebinarParticipant') {
                // Kick the reported user from the live room right now, if they're still connected
                // — there's no standalone WebinarParticipant model to "remove"; report.webinar
                // scopes which session to act on, report.targetId is the offending user's id.
                const { default: WebinarSession } = await import('../models/WebinarSession.js');
                const { removeParticipantFromRoom } = await import('../utils/livekit.js');
                const { broadcastToWebinarRoom } = await import('../utils/webinarBroadcast.js');

                const session = await WebinarSession.findOne({ webinar: report.webinar });
                if (session) {
                    const identity = report.targetId.toString();
                    try {
                        await removeParticipantFromRoom(session.roomName, identity);
                    } catch (err) {
                        console.error(`[Report] Failed to remove webinar participant ${identity}:`, err.message);
                    }
                    const entry = [...session.participants].reverse().find(p => p.identity === identity && p.connectionState === 'connected');
                    if (entry) {
                        entry.connectionState = 'disconnected';
                        entry.leftAt = new Date();
                        session.markModified('participants');
                        await session.save();
                    }
                    broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'removed' }, [identity]);
                }
            }
            report.status = 'actioned';
        } else {
            report.status = 'dismissed';
        }

        const { logAudit } = await import('../utils/auditLog.js');
        await logAudit({
            actor: req.user._id, action: `report.${action === 'remove' ? 'actioned' : 'dismissed'}`,
            targetType: 'Report', targetId: report._id, metadata: { reportTargetType: report.targetType, reportTargetId: report.targetId }, req,
        });

        report.reviewedBy = req.user.id;
        report.reviewedAt = new Date();
        report.resolutionNote = resolutionNote || '';
        await report.save();

        res.status(200).json({ success: true, data: report });
    } catch (error) {
        next(error);
    }
};
