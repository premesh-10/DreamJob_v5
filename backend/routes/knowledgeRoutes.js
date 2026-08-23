import express from 'express';
import { protect, optionalProtect, authorize } from '../middleware/authMiddleware.js';
import { handleKnowledgeCoverUpload } from '../middleware/uploadMiddleware.js';
import {
    listArticles, getArticleBySlug, searchArticles, getAuthorArticles,
    getMyArticles, getMyBookmarks, createArticle, updateArticle, submitArticle,
    deleteArticle, uploadCoverImage, toggleFollowAuthor,
    adminListArticles, adminGetStats, adminApproveArticle, adminRejectArticle,
    adminToggleFeatured, adminToggleEditorsPick, adminDeleteArticle,
    getKnowledgeCategories, getPopularTags,
} from '../controllers/knowledgeController.js';
import {
    recordView, toggleLike, toggleBookmark,
    listComments, addComment, editComment, deleteComment, toggleCommentLike,
} from '../controllers/knowledgeEngagementController.js';

const router = express.Router();
const ADMIN_ROLES = ['admin', 'super_admin', 'moderator'];

// ── Public discovery ──────────────────────────────────────────────────────────
router.get('/', optionalProtect, listArticles);
router.get('/search', optionalProtect, searchArticles);
router.get('/categories', getKnowledgeCategories);
router.get('/tags', getPopularTags);
router.get('/authors/:userId', optionalProtect, getAuthorArticles);
router.get('/article/:slug', optionalProtect, getArticleBySlug);

// ── Auth: my content ──────────────────────────────────────────────────────────
router.get('/my-articles', protect, getMyArticles);
router.get('/my-bookmarks', protect, getMyBookmarks);

// ── Auth: article CRUD ────────────────────────────────────────────────────────
router.post('/', protect, createArticle);
router.put('/:id', protect, updateArticle);
router.post('/:id/submit', protect, submitArticle);
router.delete('/:id', protect, deleteArticle);

// ── Auth: cover image upload ──────────────────────────────────────────────────
router.post('/upload/cover', protect, handleKnowledgeCoverUpload, uploadCoverImage);

// ── Auth: social ──────────────────────────────────────────────────────────────
router.post('/authors/:userId/follow', protect, toggleFollowAuthor);

// ── Engagement ────────────────────────────────────────────────────────────────
router.post('/:id/view', optionalProtect, recordView);
router.post('/:id/like', protect, toggleLike);
router.post('/:id/bookmark', protect, toggleBookmark);

// ── Comments ──────────────────────────────────────────────────────────────────
router.get('/:id/comments', optionalProtect, listComments);
router.post('/:id/comments', protect, addComment);
router.put('/:id/comments/:cid', protect, editComment);
router.delete('/:id/comments/:cid', protect, deleteComment);
router.post('/:id/comments/:cid/like', protect, toggleCommentLike);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/articles', protect, authorize(...ADMIN_ROLES), adminListArticles);
router.get('/admin/stats', protect, authorize(...ADMIN_ROLES), adminGetStats);
router.post('/admin/:id/approve', protect, authorize(...ADMIN_ROLES), adminApproveArticle);
router.post('/admin/:id/reject', protect, authorize(...ADMIN_ROLES), adminRejectArticle);
router.post('/admin/:id/feature', protect, authorize(...ADMIN_ROLES), adminToggleFeatured);
router.post('/admin/:id/editors-pick', protect, authorize(...ADMIN_ROLES), adminToggleEditorsPick);
router.delete('/admin/:id', protect, authorize(...ADMIN_ROLES), adminDeleteArticle);

export default router;
