import Webinar from '../models/Webinar.js';
import WebinarSession from '../models/WebinarSession.js';
import WebinarChatMessage from '../models/WebinarChatMessage.js';
import WebinarQuestion from '../models/WebinarQuestion.js';
import WebinarPoll from '../models/WebinarPoll.js';
import WebinarReaction from '../models/WebinarReaction.js';
import WebinarFeedback from '../models/WebinarFeedback.js';
import { getCallerRole, MODERATION_TIER } from '../utils/webinarRoleResolver.js';
import { broadcastToWebinarRoom } from '../utils/webinarBroadcast.js';

// Loads {session, webinar, role} for the caller, or returns null after writing the
// appropriate error response — every handler below starts with this single chokepoint.
async function loadContext(req, res) {
    const session = await WebinarSession.findById(req.params.sessionId);
    if (!session) { res.status(404).json({ message: 'Webinar session not found' }); return null; }
    const webinar = await Webinar.findById(session.webinar);
    if (!webinar) { res.status(404).json({ message: 'Webinar not found' }); return null; }
    const role = await getCallerRole(session, webinar, req.user);
    if (!role) { res.status(403).json({ message: 'You are not authorized to access this webinar' }); return null; }
    return { session, webinar, role };
}

// Gated by BOTH the publish-time default (webinar.settings.engagement.*) AND the live
// runtime override (session.featureToggles.*, seeded from settings at session creation and
// flippable mid-session by the host — Phase 7).
function isFeatureEnabled(webinar, session, key) {
    return (webinar.settings?.engagement?.[key] ?? true) && (session.featureToggles?.[key] ?? true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────────────────────────

export const postChatMessage = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session, webinar, role } = ctx;

        const { text, scope = 'public', recipientUser } = req.body;
        if (!text?.trim()) return res.status(400).json({ message: 'Message text is required' });

        const featureKey = scope === 'private' ? 'privateChatEnabled' : 'chatEnabled';
        if (!isFeatureEnabled(webinar, session, featureKey)) {
            return res.status(403).json({ message: `${scope === 'private' ? 'Private chat' : 'Chat'} is disabled for this webinar` });
        }
        if (scope === 'private' && !recipientUser) {
            return res.status(400).json({ message: 'recipientUser is required for a private message' });
        }

        const message = await WebinarChatMessage.create({
            webinar: webinar._id, session: session._id, sender: req.user._id, senderRole: role,
            text: text.trim(), scope, recipientUser: scope === 'private' ? recipientUser : null,
        });

        const destinationIdentities = scope === 'private'
            ? [req.user._id.toString(), recipientUser.toString()]
            : undefined;
        broadcastToWebinarRoom(session.roomName, 'webinar-engagement', {
            type: 'chat_message', message: { _id: message._id, sender: req.user._id, senderName: req.user.name, senderRole: role, text: message.text, scope, createdAt: message.createdAt },
        }, destinationIdentities);

        res.status(201).json({ success: true, data: message });
    } catch (error) {
        next(error);
    }
};

export const getChatHistory = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session } = ctx;

        const { before, limit = 50 } = req.query;
        const filter = {
            session: session._id, isDeleted: false,
            $or: [
                { scope: 'public' },
                { scope: 'private', recipientUser: req.user._id },
                { scope: 'private', sender: req.user._id },
            ],
        };
        if (before) filter.createdAt = { $lt: new Date(before) };

        const messages = await WebinarChatMessage.find(filter)
            .sort({ createdAt: -1 })
            .limit(Math.min(100, Number(limit) || 50))
            .populate('sender', 'name');

        res.status(200).json({ success: true, data: messages.reverse() });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Q&A
// ─────────────────────────────────────────────────────────────────────────────

export const askQuestion = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session, webinar } = ctx;

        if (!isFeatureEnabled(webinar, session, 'qaEnabled')) {
            return res.status(403).json({ message: 'Q&A is disabled for this webinar' });
        }
        const { text, isAnonymous = false } = req.body;
        if (!text?.trim()) return res.status(400).json({ message: 'Question text is required' });

        const question = await WebinarQuestion.create({
            webinar: webinar._id, session: session._id, askedBy: req.user._id, text: text.trim(), isAnonymous: !!isAnonymous,
        });

        broadcastToWebinarRoom(session.roomName, 'webinar-engagement', {
            type: 'question_asked',
            question: { _id: question._id, text: question.text, isAnonymous: question.isAnonymous, askedBy: isAnonymous ? null : req.user.name, upvoteCount: 0, createdAt: question.createdAt },
        });

        res.status(201).json({ success: true, data: question });
    } catch (error) {
        next(error);
    }
};

export const upvoteQuestion = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session } = ctx;

        const question = await WebinarQuestion.findOne({ _id: req.params.questionId, session: session._id });
        if (!question) return res.status(404).json({ message: 'Question not found' });

        const uid = req.user._id.toString();
        const alreadyUpvoted = question.upvotes.some(id => id.toString() === uid);
        if (alreadyUpvoted) {
            question.upvotes = question.upvotes.filter(id => id.toString() !== uid);
        } else {
            question.upvotes.push(req.user._id);
        }
        question.upvoteCount = question.upvotes.length;
        await question.save();

        broadcastToWebinarRoom(session.roomName, 'webinar-engagement', {
            type: 'question_upvoted', questionId: question._id, upvoteCount: question.upvoteCount,
        });

        res.status(200).json({ success: true, data: { upvoteCount: question.upvoteCount, upvoted: !alreadyUpvoted } });
    } catch (error) {
        next(error);
    }
};

export const answerQuestion = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session, role } = ctx;

        if (!MODERATION_TIER.includes(role)) {
            return res.status(403).json({ message: 'Only the host, co-host, or a moderator can answer questions' });
        }

        const { answerText, status = 'answered' } = req.body;
        const question = await WebinarQuestion.findOneAndUpdate(
            { _id: req.params.questionId, session: session._id },
            { status, answerText: answerText || '', answeredBy: req.user._id, answeredAt: new Date() },
            { new: true }
        );
        if (!question) return res.status(404).json({ message: 'Question not found' });

        broadcastToWebinarRoom(session.roomName, 'webinar-engagement', {
            type: 'question_answered', questionId: question._id, status: question.status, answerText: question.answerText,
        });

        res.status(200).json({ success: true, data: question });
    } catch (error) {
        next(error);
    }
};

// List endpoints so a newly-joined client can render current state immediately, rather than
// waiting for the next live broadcast (which only reaches already-connected clients).
export const getQuestions = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const questions = await WebinarQuestion.find({ session: ctx.session._id })
            .sort({ upvoteCount: -1, createdAt: 1 })
            .populate('askedBy', 'name');
        res.status(200).json({ success: true, data: questions });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Polls
// ─────────────────────────────────────────────────────────────────────────────

export const createPoll = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session, webinar, role } = ctx;

        if (!MODERATION_TIER.includes(role)) {
            return res.status(403).json({ message: 'Only the host, co-host, or a moderator can create polls' });
        }
        if (!isFeatureEnabled(webinar, session, 'pollsEnabled')) {
            return res.status(403).json({ message: 'Polls are disabled for this webinar' });
        }

        const { question, options, isQuiz = false, correctOptionIndex = null } = req.body;
        if (!question?.trim() || !Array.isArray(options) || options.length < 2) {
            return res.status(400).json({ message: 'A poll needs a question and at least 2 options' });
        }

        const poll = await WebinarPoll.create({
            webinar: webinar._id, session: session._id, createdBy: req.user._id,
            question: question.trim(), options: options.map(text => ({ text })), isQuiz: !!isQuiz, correctOptionIndex,
        });

        res.status(201).json({ success: true, data: poll });
    } catch (error) {
        next(error);
    }
};

export const openPoll = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session, role } = ctx;
        if (!MODERATION_TIER.includes(role)) {
            return res.status(403).json({ message: 'Only the host, co-host, or a moderator can open polls' });
        }

        const poll = await WebinarPoll.findOneAndUpdate(
            { _id: req.params.pollId, session: session._id },
            { status: 'open', openedAt: new Date() },
            { new: true }
        );
        if (!poll) return res.status(404).json({ message: 'Poll not found' });

        broadcastToWebinarRoom(session.roomName, 'webinar-engagement', {
            type: 'poll_opened',
            poll: { _id: poll._id, question: poll.question, options: poll.options.map(o => ({ _id: o._id, text: o.text })), isQuiz: poll.isQuiz },
        });

        res.status(200).json({ success: true, data: poll });
    } catch (error) {
        next(error);
    }
};

export const votePoll = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session } = ctx;

        const poll = await WebinarPoll.findOne({ _id: req.params.pollId, session: session._id });
        if (!poll) return res.status(404).json({ message: 'Poll not found' });
        if (poll.status !== 'open') return res.status(400).json({ message: 'This poll is not currently open' });

        const option = poll.options.find(o => o._id.toString() === req.body.optionId);
        if (!option) return res.status(400).json({ message: 'Invalid option' });

        const uid = req.user._id.toString();
        poll.options.forEach(o => { o.votes = o.votes.filter(id => id.toString() !== uid); });
        option.votes.push(req.user._id);
        await poll.save();

        const counts = poll.options.map(o => ({ _id: o._id, count: o.votes.length }));
        broadcastToWebinarRoom(session.roomName, 'webinar-engagement', { type: 'poll_vote_update', pollId: poll._id, counts });

        res.status(200).json({ success: true, data: { counts } });
    } catch (error) {
        next(error);
    }
};

export const closePoll = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session, role } = ctx;
        if (!MODERATION_TIER.includes(role)) {
            return res.status(403).json({ message: 'Only the host, co-host, or a moderator can close polls' });
        }

        const poll = await WebinarPoll.findOne({ _id: req.params.pollId, session: session._id });
        if (!poll) return res.status(404).json({ message: 'Poll not found' });

        const distinctVoters = new Set(poll.options.flatMap(o => o.votes.map(id => id.toString()))).size;
        const attendeeCountAtClose = session.participants.filter(p => p.role === 'attendee' && p.connectionState === 'connected').length;
        poll.status = 'closed';
        poll.closedAt = new Date();
        poll.participationRate = attendeeCountAtClose > 0 ? Math.round((distinctVoters / attendeeCountAtClose) * 100) : 0;
        await poll.save();

        const counts = poll.options.map(o => ({ _id: o._id, text: o.text, count: o.votes.length }));
        broadcastToWebinarRoom(session.roomName, 'webinar-engagement', { type: 'poll_closed', pollId: poll._id, counts, participationRate: poll.participationRate });

        res.status(200).json({ success: true, data: poll });
    } catch (error) {
        next(error);
    }
};

export const getPolls = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const polls = await WebinarPoll.find({ session: ctx.session._id }).sort({ createdAt: 1 });
        res.status(200).json({ success: true, data: polls });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Raise hand — embedded on WebinarSession.participants[] (1:1 with a currently-connected
// participant, read alongside the roster for the host's queue), not its own collection.
// ─────────────────────────────────────────────────────────────────────────────

export const setHandRaised = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session, webinar } = ctx;

        if (!isFeatureEnabled(webinar, session, 'raiseHandEnabled')) {
            return res.status(403).json({ message: 'Raise hand is disabled for this webinar' });
        }
        const raised = !!req.body.raised;
        const uid = req.user._id.toString();
        const entry = [...session.participants].reverse().find(p => p.identity === uid && p.connectionState === 'connected');
        if (!entry) return res.status(400).json({ message: 'You must be connected to the room to raise your hand' });

        entry.handRaised = raised;
        entry.handRaisedAt = raised ? new Date() : null;
        if (raised) session.totalHandRaises = (session.totalHandRaises || 0) + 1;
        session.markModified('participants');
        await session.save();

        broadcastToWebinarRoom(session.roomName, 'webinar-control', { type: 'hand_raised', userId: req.user._id, raised });

        res.status(200).json({ success: true, data: { raised } });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reactions — fire-and-forget, 202
// ─────────────────────────────────────────────────────────────────────────────

export const sendReaction = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session, webinar } = ctx;

        if (!isFeatureEnabled(webinar, session, 'reactionsEnabled')) {
            return res.status(403).json({ message: 'Reactions are disabled for this webinar' });
        }
        const { emoji } = req.body;
        if (!emoji) return res.status(400).json({ message: 'emoji is required' });

        res.status(202).json({ success: true });

        WebinarReaction.create({ webinar: webinar._id, session: session._id, user: req.user._id, emoji })
            .catch(err => console.error('[Webinar] Failed to persist reaction:', err.message));
        broadcastToWebinarRoom(session.roomName, 'webinar-engagement', { type: 'reaction', emoji, userId: req.user._id });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Feedback — one rating+comment per user per webinar, typically submitted on disconnect
// ─────────────────────────────────────────────────────────────────────────────

export const submitFeedback = async (req, res, next) => {
    try {
        const ctx = await loadContext(req, res);
        if (!ctx) return;
        const { session, webinar } = ctx;

        const { rating, comments = '' } = req.body;
        const numericRating = Number(rating);
        if (!numericRating || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ message: 'rating must be a number between 1 and 5' });
        }

        try {
            const feedback = await WebinarFeedback.create({
                webinar: webinar._id, session: session._id, user: req.user._id, rating: numericRating, comments,
            });
            return res.status(201).json({ success: true, data: feedback });
        } catch (err) {
            if (err.code === 11000) return res.status(400).json({ message: 'You have already submitted feedback for this webinar' });
            throw err;
        }
    } catch (error) {
        next(error);
    }
};

// @access  Seller (owner) or admin — surfaced on the seller analytics page (Phase 8)
export const getWebinarFeedbackSummary = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.webinarId);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        const isOwner = webinar.seller.toString() === req.user.id;
        const isAdmin = ['admin', 'super_admin', 'moderator', 'finance_admin', 'support_admin'].includes(req.user.role);
        if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Not authorized' });

        const [summary] = await WebinarFeedback.aggregate([
            { $match: { webinar: webinar._id } },
            { $group: { _id: null, averageRating: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]);
        const recentComments = await WebinarFeedback.find({ webinar: webinar._id, comments: { $ne: '' } })
            .sort({ submittedAt: -1 }).limit(20).populate('user', 'name');

        res.status(200).json({
            success: true,
            data: {
                averageRating: summary?.averageRating || 0,
                count: summary?.count || 0,
                recentComments,
            },
        });
    } catch (error) {
        next(error);
    }
};
