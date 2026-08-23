import KnowledgeArticle from '../models/KnowledgeArticle.js';
import KnowledgeLike from '../models/KnowledgeLike.js';
import KnowledgeBookmark from '../models/KnowledgeBookmark.js';
import KnowledgeComment from '../models/KnowledgeComment.js';
import KnowledgeCommentLike from '../models/KnowledgeCommentLike.js';
import { awardPoints, POINTS_RULES } from '../utils/gamification.js';

// ── Recalculate and save trend score ─────────────────────────────────────────

async function refreshTrendScore(articleId) {
    const a = await KnowledgeArticle.findById(articleId).select('viewCount likeCount bookmarkCount commentCount');
    if (!a) return;
    const score = (a.viewCount || 0) + (a.likeCount || 0) * 3 + (a.bookmarkCount || 0) * 5 + (a.commentCount || 0) * 2;
    await KnowledgeArticle.findByIdAndUpdate(articleId, { trendScore: score });
}

// ── Record a view ─────────────────────────────────────────────────────────────

export const recordView = async (req, res, next) => {
    try {
        const article = await KnowledgeArticle.findOne({ _id: req.params.id, status: 'published' });
        if (!article) return res.status(404).json({ message: 'Article not found' });
        await KnowledgeArticle.findByIdAndUpdate(article._id, { $inc: { viewCount: 1 } });
        refreshTrendScore(article._id).catch(() => {}); // fire-and-forget
        res.status(200).json({ ok: true });
    } catch (error) { next(error); }
};

// ── Toggle like ───────────────────────────────────────────────────────────────

export const toggleLike = async (req, res, next) => {
    try {
        const article = await KnowledgeArticle.findOne({ _id: req.params.id, status: 'published' });
        if (!article) return res.status(404).json({ message: 'Article not found' });

        const existing = await KnowledgeLike.findOne({ user: req.user._id, article: article._id });
        if (existing) {
            await existing.deleteOne();
            await KnowledgeArticle.findByIdAndUpdate(article._id, { $inc: { likeCount: -1 } });
            refreshTrendScore(article._id).catch(() => {});
            return res.json({ liked: false, likeCount: Math.max(0, article.likeCount - 1) });
        }

        await KnowledgeLike.create({ user: req.user._id, article: article._id });
        const updated = await KnowledgeArticle.findByIdAndUpdate(article._id, { $inc: { likeCount: 1 } }, { new: true });
        refreshTrendScore(article._id).catch(() => {});

        // Award points to the article author (not the liker) for receiving a like
        const authorId = article.author.toString();
        if (authorId !== req.user._id.toString()) {
            await awardPoints(authorId, POINTS_RULES.article_liked, 'article_liked', {
                refType: 'article', refId: article._id,
                description: `Like received on: "${article.title}"`,
            });
        }

        res.json({ liked: true, likeCount: updated.likeCount });
    } catch (error) { next(error); }
};

// ── Toggle bookmark ───────────────────────────────────────────────────────────

export const toggleBookmark = async (req, res, next) => {
    try {
        const article = await KnowledgeArticle.findOne({ _id: req.params.id, status: 'published' });
        if (!article) return res.status(404).json({ message: 'Article not found' });

        const existing = await KnowledgeBookmark.findOne({ user: req.user._id, article: article._id });
        if (existing) {
            await existing.deleteOne();
            await KnowledgeArticle.findByIdAndUpdate(article._id, { $inc: { bookmarkCount: -1 } });
            refreshTrendScore(article._id).catch(() => {});
            return res.json({ bookmarked: false });
        }

        await KnowledgeBookmark.create({ user: req.user._id, article: article._id });
        await KnowledgeArticle.findByIdAndUpdate(article._id, { $inc: { bookmarkCount: 1 } });
        refreshTrendScore(article._id).catch(() => {});
        res.json({ bookmarked: true });
    } catch (error) { next(error); }
};

// ── List comments ─────────────────────────────────────────────────────────────

export const listComments = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const article = await KnowledgeArticle.findById(req.params.id).select('_id status').lean();
        if (!article || article.status !== 'published') return res.status(404).json({ message: 'Article not found' });

        const [comments, total] = await Promise.all([
            KnowledgeComment.find({ article: article._id, parentComment: null, isDeleted: false })
                .populate('author', 'name profilePic hubLevel role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            KnowledgeComment.countDocuments({ article: article._id, parentComment: null, isDeleted: false }),
        ]);

        // Fetch up to 3 replies per top-level comment
        const commentsWithReplies = await Promise.all(comments.map(async (c) => {
            const replies = await KnowledgeComment.find({ article: article._id, parentComment: c._id, isDeleted: false })
                .populate('author', 'name profilePic hubLevel role')
                .sort({ createdAt: 1 })
                .limit(5)
                .lean();

            let likedIds = new Set();
            if (req.user) {
                const cids = [c._id, ...replies.map(r => r._id)];
                const likes = await KnowledgeCommentLike.find({ user: req.user._id, comment: { $in: cids } }).select('comment').lean();
                likedIds = new Set(likes.map(l => l.comment.toString()));
            }

            return {
                ...c,
                isLiked: likedIds.has(c._id.toString()),
                replies: replies.map(r => ({ ...r, isLiked: likedIds.has(r._id.toString()) })),
            };
        }));

        res.json({ comments: commentsWithReplies, total, totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) { next(error); }
};

// ── Add comment ───────────────────────────────────────────────────────────────

export const addComment = async (req, res, next) => {
    try {
        const { content, parentCommentId } = req.body;
        if (!content || !content.trim()) return res.status(400).json({ message: 'Comment cannot be empty' });
        if (content.trim().length > 2000) return res.status(400).json({ message: 'Comment too long (max 2000 chars)' });

        const article = await KnowledgeArticle.findOne({ _id: req.params.id, status: 'published' });
        if (!article) return res.status(404).json({ message: 'Article not found' });

        if (parentCommentId) {
            const parent = await KnowledgeComment.findOne({ _id: parentCommentId, article: article._id, isDeleted: false });
            if (!parent) return res.status(404).json({ message: 'Parent comment not found' });
            if (parent.parentComment) return res.status(400).json({ message: 'Cannot reply to a reply' });
        }

        const comment = await KnowledgeComment.create({
            article: article._id,
            author: req.user._id,
            content: content.trim(),
            parentComment: parentCommentId || null,
        });

        if (!parentCommentId) {
            await KnowledgeArticle.findByIdAndUpdate(article._id, { $inc: { commentCount: 1 } });
            refreshTrendScore(article._id).catch(() => {});
        }

        await comment.populate('author', 'name profilePic hubLevel role');
        res.status(201).json({ comment });
    } catch (error) { next(error); }
};

// ── Edit comment ──────────────────────────────────────────────────────────────

export const editComment = async (req, res, next) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) return res.status(400).json({ message: 'Content is required' });

        const comment = await KnowledgeComment.findOne({ _id: req.params.cid, article: req.params.id, isDeleted: false });
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        const ADMIN_ROLES = ['admin', 'super_admin', 'moderator'];
        if (comment.author.toString() !== req.user._id.toString() && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        comment.content = content.trim();
        await comment.save();
        res.json({ comment });
    } catch (error) { next(error); }
};

// ── Delete comment ────────────────────────────────────────────────────────────

export const deleteComment = async (req, res, next) => {
    try {
        const comment = await KnowledgeComment.findOne({ _id: req.params.cid, article: req.params.id, isDeleted: false });
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        const ADMIN_ROLES = ['admin', 'super_admin', 'moderator'];
        if (comment.author.toString() !== req.user._id.toString() && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        comment.isDeleted = true;
        comment.deletedAt = new Date();
        comment.deletedBy = req.user._id;
        await comment.save();

        // Only decrement top-level comment count
        if (!comment.parentComment) {
            await KnowledgeArticle.findByIdAndUpdate(req.params.id, { $inc: { commentCount: -1 } });
        }
        res.json({ message: 'Comment deleted' });
    } catch (error) { next(error); }
};

// ── Toggle comment like ───────────────────────────────────────────────────────

export const toggleCommentLike = async (req, res, next) => {
    try {
        const comment = await KnowledgeComment.findOne({ _id: req.params.cid, article: req.params.id, isDeleted: false });
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        const existing = await KnowledgeCommentLike.findOne({ user: req.user._id, comment: comment._id });
        if (existing) {
            await existing.deleteOne();
            await KnowledgeComment.findByIdAndUpdate(comment._id, { $inc: { likeCount: -1 } });
            return res.json({ liked: false });
        }

        await KnowledgeCommentLike.create({ user: req.user._id, comment: comment._id });
        await KnowledgeComment.findByIdAndUpdate(comment._id, { $inc: { likeCount: 1 } });
        res.json({ liked: true });
    } catch (error) { next(error); }
};
