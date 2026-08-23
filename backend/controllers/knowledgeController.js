import mongoose from 'mongoose';
import KnowledgeArticle from '../models/KnowledgeArticle.js';
import KnowledgeLike from '../models/KnowledgeLike.js';
import KnowledgeBookmark from '../models/KnowledgeBookmark.js';
import KnowledgeFollow from '../models/KnowledgeFollow.js';
import KnowledgeComment from '../models/KnowledgeComment.js';
import Notification from '../models/Notification.js';
import { awardPoints, POINTS_RULES } from '../utils/gamification.js';
import { logAudit } from '../utils/auditLog.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSlug(title) {
    const base = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
        .substring(0, 80);
    const suffix = Math.random().toString(36).substring(2, 7);
    return `${base}-${suffix}`;
}

function calcReadingStats(content) {
    const text = content.replace(/```[\s\S]*?```/g, '').replace(/[#*`~\[\]()\->|!]/g, '').trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
    return { wordCount, readingTimeMinutes };
}

function calcTrendScore(a) {
    return (a.viewCount || 0) + (a.likeCount || 0) * 3 + (a.bookmarkCount || 0) * 5 + (a.commentCount || 0) * 2;
}

const ADMIN_ROLES = ['admin', 'super_admin', 'moderator'];

// ── Public: list articles ─────────────────────────────────────────────────────

export const listArticles = async (req, res, next) => {
    try {
        const {
            page = 1, limit = 12,
            sort = 'newest',          // newest | trending | most_liked | most_viewed | most_bookmarked
            category, tag,
            featured, editorsPick,
        } = req.query;

        const filter = { status: 'published', visibility: 'public' };
        if (category) filter.category = category;
        if (tag) filter.tags = tag;
        if (featured === 'true') filter.isFeatured = true;
        if (editorsPick === 'true') filter.isEditorsPick = true;

        const sortMap = {
            newest:          { publishedAt: -1 },
            trending:        { trendScore: -1, publishedAt: -1 },
            most_liked:      { likeCount: -1, publishedAt: -1 },
            most_viewed:     { viewCount: -1, publishedAt: -1 },
            most_bookmarked: { bookmarkCount: -1, publishedAt: -1 },
        };
        const sortObj = sortMap[sort] || sortMap.newest;

        const skip = (Number(page) - 1) * Number(limit);
        const [articles, total] = await Promise.all([
            KnowledgeArticle.find(filter)
                .select('-content')
                .populate('author', 'name profilePic hubLevel contributionPoints')
                .sort(sortObj)
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            KnowledgeArticle.countDocuments(filter),
        ]);

        // Attach per-user signals if authenticated
        let likedIds = new Set();
        let bookmarkedIds = new Set();
        if (req.user) {
            const ids = articles.map(a => a._id);
            const [likes, bookmarks] = await Promise.all([
                KnowledgeLike.find({ user: req.user._id, article: { $in: ids } }).select('article').lean(),
                KnowledgeBookmark.find({ user: req.user._id, article: { $in: ids } }).select('article').lean(),
            ]);
            likedIds = new Set(likes.map(l => l.article.toString()));
            bookmarkedIds = new Set(bookmarks.map(b => b.article.toString()));
        }

        const enriched = articles.map(a => ({
            ...a,
            isLiked: likedIds.has(a._id.toString()),
            isBookmarked: bookmarkedIds.has(a._id.toString()),
        }));

        res.json({ articles: enriched, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) { next(error); }
};

// ── Public: get article by slug ───────────────────────────────────────────────

export const getArticleBySlug = async (req, res, next) => {
    try {
        const article = await KnowledgeArticle.findOne({ slug: req.params.slug })
            .populate('author', 'name profilePic hubLevel contributionPoints bio role identityVerified')
            .populate('moderatedBy', 'name')
            .lean();

        if (!article) return res.status(404).json({ message: 'Article not found' });

        const isAuthor = req.user && article.author._id.toString() === req.user._id.toString();
        const isAdmin = req.user && ADMIN_ROLES.includes(req.user.role);

        if (article.status !== 'published' && !isAuthor && !isAdmin) {
            return res.status(404).json({ message: 'Article not found' });
        }

        // Attach per-user engagement signals
        let isLiked = false, isBookmarked = false, isFollowingAuthor = false;
        if (req.user) {
            const [like, bookmark, follow] = await Promise.all([
                KnowledgeLike.findOne({ user: req.user._id, article: article._id }),
                KnowledgeBookmark.findOne({ user: req.user._id, article: article._id }),
                KnowledgeFollow.findOne({ follower: req.user._id, author: article.author._id }),
            ]);
            isLiked = !!like;
            isBookmarked = !!bookmark;
            isFollowingAuthor = !!follow;
        }

        // Author follower count
        const authorFollowerCount = await KnowledgeFollow.countDocuments({ author: article.author._id });

        res.json({ article: { ...article, isLiked, isBookmarked, isFollowingAuthor }, authorFollowerCount });
    } catch (error) { next(error); }
};

// ── Public: search articles ───────────────────────────────────────────────────

export const searchArticles = async (req, res, next) => {
    try {
        const { q, page = 1, limit = 12, category, tag } = req.query;
        if (!q || q.trim().length < 2) return res.json({ articles: [], total: 0 });

        const filter = {
            status: 'published',
            visibility: 'public',
            $text: { $search: q.trim() },
        };
        if (category) filter.category = category;
        if (tag) filter.tags = tag;

        const skip = (Number(page) - 1) * Number(limit);
        const [articles, total] = await Promise.all([
            KnowledgeArticle.find(filter, { score: { $meta: 'textScore' } })
                .select('-content')
                .populate('author', 'name profilePic hubLevel')
                .sort({ score: { $meta: 'textScore' }, publishedAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            KnowledgeArticle.countDocuments(filter),
        ]);

        res.json({ articles, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) { next(error); }
};

// ── Public: get articles by author ───────────────────────────────────────────

export const getAuthorArticles = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 12 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const filter = { author: userId, status: 'published', visibility: 'public' };
        const [articles, total, followersCount, followingCount] = await Promise.all([
            KnowledgeArticle.find(filter)
                .select('-content')
                .sort({ publishedAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            KnowledgeArticle.countDocuments(filter),
            KnowledgeFollow.countDocuments({ author: userId }),
            KnowledgeFollow.countDocuments({ follower: userId }),
        ]);

        // Total stats for the author
        const authorObjId = new mongoose.Types.ObjectId(userId);
        const stats = await KnowledgeArticle.aggregate([
            { $match: { author: authorObjId, status: 'published' } },
            { $group: { _id: null, totalViews: { $sum: '$viewCount' }, totalLikes: { $sum: '$likeCount' }, totalArticles: { $sum: 1 } } },
        ]);

        let isFollowing = false;
        if (req.user) {
            const follow = await KnowledgeFollow.findOne({ follower: req.user._id, author: userId });
            isFollowing = !!follow;
        }

        res.json({ articles, total, totalPages: Math.ceil(total / Number(limit)), stats: stats[0] || {}, followersCount, followingCount, isFollowing });
    } catch (error) { next(error); }
};

// ── Auth: list my articles ────────────────────────────────────────────────────

export const getMyArticles = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 12 } = req.query;
        const filter = { author: req.user._id };
        if (status) filter.status = status;
        const skip = (Number(page) - 1) * Number(limit);

        const [articles, total] = await Promise.all([
            KnowledgeArticle.find(filter)
                .select('-content')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            KnowledgeArticle.countDocuments(filter),
        ]);

        res.json({ articles, total, totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) { next(error); }
};

// ── Auth: my bookmarks ────────────────────────────────────────────────────────

export const getMyBookmarks = async (req, res, next) => {
    try {
        const { page = 1, limit = 12 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const [bookmarks, total] = await Promise.all([
            KnowledgeBookmark.find({ user: req.user._id })
                .populate({
                    path: 'article',
                    select: '-content',
                    populate: { path: 'author', select: 'name profilePic hubLevel' },
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            KnowledgeBookmark.countDocuments({ user: req.user._id }),
        ]);
        const articles = bookmarks.filter(b => b.article).map(b => ({ ...b.article, bookmarkedAt: b.createdAt }));
        res.json({ articles, total, totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) { next(error); }
};

// ── Auth: create article ──────────────────────────────────────────────────────

export const createArticle = async (req, res, next) => {
    try {
        const { title, content, excerpt, category, tags, visibility, seoTitle, seoDescription, coverImage } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ message: 'Title is required' });
        if (!content || !content.trim()) return res.status(400).json({ message: 'Content is required' });

        const { wordCount, readingTimeMinutes } = calcReadingStats(content);
        const slug = generateSlug(title);
        const parsedTags = Array.isArray(tags) ? tags.slice(0, 10) : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10) : []);

        const article = await KnowledgeArticle.create({
            title: title.trim(),
            slug,
            content: content.trim(),
            excerpt: excerpt?.trim() || content.trim().replace(/[#*`>~\[\]!|]/g, '').substring(0, 250),
            coverImage: coverImage || '',
            author: req.user._id,
            category: category || '',
            tags: parsedTags,
            visibility: visibility || 'public',
            seoTitle: seoTitle || '',
            seoDescription: seoDescription || '',
            status: 'draft',
            wordCount,
            readingTimeMinutes,
        });

        res.status(201).json({ article });
    } catch (error) { next(error); }
};

// ── Auth: update article ──────────────────────────────────────────────────────

export const updateArticle = async (req, res, next) => {
    try {
        const article = await KnowledgeArticle.findById(req.params.id);
        if (!article) return res.status(404).json({ message: 'Article not found' });

        const isAdmin = ADMIN_ROLES.includes(req.user.role);
        if (article.author.toString() !== req.user._id.toString() && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const allowedFields = ['title', 'content', 'excerpt', 'coverImage', 'category', 'tags', 'visibility', 'seoTitle', 'seoDescription'];
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) article[field] = req.body[field];
        }

        if (req.body.tags) {
            article.tags = Array.isArray(req.body.tags)
                ? req.body.tags.slice(0, 10)
                : req.body.tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
        }

        if (req.body.content) {
            const { wordCount, readingTimeMinutes } = calcReadingStats(req.body.content);
            article.wordCount = wordCount;
            article.readingTimeMinutes = readingTimeMinutes;
        }

        // Reset to pending_review if a published article is edited significantly
        if (article.status === 'published' && req.body.content && !isAdmin) {
            // Keep published — authors can fix typos without losing published status
        }

        await article.save();
        res.json({ article });
    } catch (error) { next(error); }
};

// ── Auth: submit for review (publish) ────────────────────────────────────────

export const submitArticle = async (req, res, next) => {
    try {
        const article = await KnowledgeArticle.findById(req.params.id);
        if (!article) return res.status(404).json({ message: 'Article not found' });
        if (article.author.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
        if (!['draft', 'rejected'].includes(article.status)) return res.status(400).json({ message: 'Article cannot be submitted from its current status' });
        if (!article.title || !article.content || article.content.trim().length < 100) {
            return res.status(400).json({ message: 'Article must have a title and at least 100 characters of content before submitting' });
        }

        article.status = 'pending_review';
        article.rejectionReason = '';
        await article.save();

        res.json({ message: 'Article submitted for review', article });
    } catch (error) { next(error); }
};

// ── Auth: delete own article ──────────────────────────────────────────────────

export const deleteArticle = async (req, res, next) => {
    try {
        const article = await KnowledgeArticle.findById(req.params.id);
        if (!article) return res.status(404).json({ message: 'Article not found' });
        const isAdmin = ADMIN_ROLES.includes(req.user.role);
        if (article.author.toString() !== req.user._id.toString() && !isAdmin) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        await article.deleteOne();
        res.json({ message: 'Article deleted' });
    } catch (error) { next(error); }
};

// ── Auth: upload cover image ──────────────────────────────────────────────────

export const uploadCoverImage = async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
        const url = `/uploads/knowledge/${req.file.filename}`;
        res.json({ url });
    } catch (error) { next(error); }
};

// ── Auth: toggle follow author ────────────────────────────────────────────────

export const toggleFollowAuthor = async (req, res, next) => {
    try {
        const { userId } = req.params;
        if (userId === req.user._id.toString()) return res.status(400).json({ message: 'Cannot follow yourself' });

        const existing = await KnowledgeFollow.findOne({ follower: req.user._id, author: userId });
        if (existing) {
            await existing.deleteOne();
            return res.json({ following: false });
        }
        await KnowledgeFollow.create({ follower: req.user._id, author: userId });
        res.json({ following: true });
    } catch (error) { next(error); }
};

// ── Admin: list all articles ──────────────────────────────────────────────────

export const adminListArticles = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20, q } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (q) filter.$text = { $search: q };

        const skip = (Number(page) - 1) * Number(limit);
        const [articles, total] = await Promise.all([
            KnowledgeArticle.find(filter)
                .select('-content')
                .populate('author', 'name email profilePic role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            KnowledgeArticle.countDocuments(filter),
        ]);
        res.json({ articles, total, totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) { next(error); }
};

// ── Admin: get stats ──────────────────────────────────────────────────────────

export const adminGetStats = async (req, res, next) => {
    try {
        const [total, published, pending, featured, editorsPick] = await Promise.all([
            KnowledgeArticle.countDocuments(),
            KnowledgeArticle.countDocuments({ status: 'published' }),
            KnowledgeArticle.countDocuments({ status: 'pending_review' }),
            KnowledgeArticle.countDocuments({ isFeatured: true, status: 'published' }),
            KnowledgeArticle.countDocuments({ isEditorsPick: true, status: 'published' }),
        ]);
        res.json({ total, published, pending, featured, editorsPick });
    } catch (error) { next(error); }
};

// ── Admin: approve article ────────────────────────────────────────────────────

export const adminApproveArticle = async (req, res, next) => {
    try {
        const article = await KnowledgeArticle.findById(req.params.id);
        if (!article) return res.status(404).json({ message: 'Article not found' });

        article.status = 'published';
        article.publishedAt = article.publishedAt || new Date();
        article.moderatedBy = req.user._id;
        article.moderatedAt = new Date();
        article.rejectionReason = '';
        await article.save();

        // Award points to the author (once per article)
        if (!article.rewardPointsAwarded) {
            await awardPoints(article.author, POINTS_RULES.article_published, 'article_published', {
                refType: 'article', refId: article._id,
                description: `Article published: "${article.title}"`,
            });
            article.rewardPointsAwarded = true;
            await article.save();
        }

        // Notify the author
        await Notification.create({
            title: 'Article Approved',
            message: `Your article "${article.title}" has been approved and is now live!`,
            targetUser: article.author,
            type: 'success',
        });

        logAudit({ actor: req.user._id, action: 'knowledge.article.approved', targetType: 'KnowledgeArticle', targetId: article._id, req });
        res.json({ message: 'Article approved and published', article });
    } catch (error) { next(error); }
};

// ── Admin: reject article ─────────────────────────────────────────────────────

export const adminRejectArticle = async (req, res, next) => {
    try {
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ message: 'Rejection reason is required' });

        const article = await KnowledgeArticle.findById(req.params.id);
        if (!article) return res.status(404).json({ message: 'Article not found' });

        article.status = 'rejected';
        article.rejectionReason = reason;
        article.moderatedBy = req.user._id;
        article.moderatedAt = new Date();
        await article.save();

        await Notification.create({
            title: 'Article Needs Revision',
            message: `Your article "${article.title}" requires changes. Reason: ${reason}`,
            targetUser: article.author,
            type: 'warning',
        });

        logAudit({ actor: req.user._id, action: 'knowledge.article.rejected', targetType: 'KnowledgeArticle', targetId: article._id, metadata: { reason }, req });
        res.json({ message: 'Article rejected', article });
    } catch (error) { next(error); }
};

// ── Admin: toggle featured ────────────────────────────────────────────────────

export const adminToggleFeatured = async (req, res, next) => {
    try {
        const article = await KnowledgeArticle.findById(req.params.id);
        if (!article) return res.status(404).json({ message: 'Article not found' });

        const wasNotFeatured = !article.isFeatured;
        article.isFeatured = !article.isFeatured;
        await article.save();

        if (wasNotFeatured && article.status === 'published') {
            await awardPoints(article.author, POINTS_RULES.article_featured, 'article_featured', {
                refType: 'article', refId: article._id,
                description: `Article featured: "${article.title}"`,
            });
            await Notification.create({
                title: 'Article Featured!',
                message: `Congratulations! Your article "${article.title}" has been featured on the Knowledge Hub.`,
                targetUser: article.author,
                type: 'success',
            });
        }

        logAudit({ actor: req.user._id, action: 'knowledge.article.featured_toggled', targetType: 'KnowledgeArticle', targetId: article._id, metadata: { isFeatured: article.isFeatured }, req });
        res.json({ isFeatured: article.isFeatured });
    } catch (error) { next(error); }
};

// ── Admin: toggle editor's pick ───────────────────────────────────────────────

export const adminToggleEditorsPick = async (req, res, next) => {
    try {
        const article = await KnowledgeArticle.findById(req.params.id);
        if (!article) return res.status(404).json({ message: 'Article not found' });

        const wasNotPick = !article.isEditorsPick;
        article.isEditorsPick = !article.isEditorsPick;
        await article.save();

        if (wasNotPick && article.status === 'published') {
            await awardPoints(article.author, POINTS_RULES.article_editors_pick, 'article_editors_pick', {
                refType: 'article', refId: article._id,
                description: `Editor's Pick: "${article.title}"`,
            });
            await Notification.create({
                title: "Editor's Pick!",
                message: `Your article "${article.title}" has been selected as an Editor's Pick!`,
                targetUser: article.author,
                type: 'success',
            });
        }

        logAudit({ actor: req.user._id, action: 'knowledge.article.editors_pick_toggled', targetType: 'KnowledgeArticle', targetId: article._id, metadata: { isEditorsPick: article.isEditorsPick }, req });
        res.json({ isEditorsPick: article.isEditorsPick });
    } catch (error) { next(error); }
};

// ── Admin: force delete ───────────────────────────────────────────────────────

export const adminDeleteArticle = async (req, res, next) => {
    try {
        const article = await KnowledgeArticle.findById(req.params.id);
        if (!article) return res.status(404).json({ message: 'Article not found' });

        if (article.status === 'published') {
            await awardPoints(article.author, POINTS_RULES.article_removed_penalty, 'article_removed_penalty', {
                refType: 'article', refId: article._id,
                description: `Article removed by moderator: "${article.title}"`,
            });
        }

        logAudit({ actor: req.user._id, action: 'knowledge.article.admin_deleted', targetType: 'KnowledgeArticle', targetId: article._id, metadata: { title: article.title }, req });
        await article.deleteOne();
        res.json({ message: 'Article deleted' });
    } catch (error) { next(error); }
};

// ── Public: get list of categories in use ────────────────────────────────────

export const getKnowledgeCategories = async (req, res, next) => {
    try {
        const categories = await KnowledgeArticle.aggregate([
            { $match: { status: 'published', category: { $ne: '' } } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
        ]);
        res.json({ categories: categories.map(c => ({ name: c._id, count: c.count })) });
    } catch (error) { next(error); }
};

// ── Public: get popular tags ──────────────────────────────────────────────────

export const getPopularTags = async (req, res, next) => {
    try {
        const tags = await KnowledgeArticle.aggregate([
            { $match: { status: 'published', tags: { $not: { $size: 0 } } } },
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 30 },
        ]);
        res.json({ tags: tags.map(t => ({ name: t._id, count: t.count })) });
    } catch (error) { next(error); }
};
