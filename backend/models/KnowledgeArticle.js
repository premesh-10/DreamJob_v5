import mongoose from 'mongoose';

const knowledgeArticleSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, trim: true, maxlength: 600, default: '' },
    content: { type: String, required: true, default: '' },
    coverImage: { type: String, default: '' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, trim: true, default: '' },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 50 }],
    status: {
        type: String,
        enum: ['draft', 'pending_review', 'published', 'rejected', 'archived'],
        default: 'draft',
        index: true,
    },
    visibility: { type: String, enum: ['public', 'unlisted'], default: 'public' },
    isFeatured: { type: Boolean, default: false, index: true },
    isEditorsPick: { type: Boolean, default: false },
    scheduledPublishAt: { type: Date, default: null },
    // Denormalized engagement counters for O(1) sort/list queries
    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    // Pre-computed trending score: views + likes*3 + bookmarks*5 + comments*2
    trendScore: { type: Number, default: 0, index: true },
    // Content metadata
    readingTimeMinutes: { type: Number, default: 1 },
    wordCount: { type: Number, default: 0 },
    // SEO
    seoTitle: { type: String, default: '' },
    seoDescription: { type: String, default: '' },
    // Rewards/moderation
    rewardPointsAwarded: { type: Boolean, default: false },
    rejectionReason: { type: String, default: '' },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
}, { timestamps: true });

// Full-text search across title, excerpt, content, and tags
knowledgeArticleSchema.index({ title: 'text', excerpt: 'text', content: 'text', tags: 'text' });
// Common listing queries
knowledgeArticleSchema.index({ status: 1, publishedAt: -1 });
knowledgeArticleSchema.index({ author: 1, status: 1, createdAt: -1 });
knowledgeArticleSchema.index({ category: 1, status: 1, publishedAt: -1 });
knowledgeArticleSchema.index({ isFeatured: 1, status: 1, publishedAt: -1 });
knowledgeArticleSchema.index({ isEditorsPick: 1, status: 1, publishedAt: -1 });
knowledgeArticleSchema.index({ tags: 1, status: 1 });

const KnowledgeArticle = mongoose.model('KnowledgeArticle', knowledgeArticleSchema);
export default KnowledgeArticle;
