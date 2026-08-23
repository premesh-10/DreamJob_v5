import mongoose from 'mongoose';

const knowledgeBookmarkSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeArticle', required: true },
}, { timestamps: true });

knowledgeBookmarkSchema.index({ user: 1, article: 1 }, { unique: true });
knowledgeBookmarkSchema.index({ user: 1, createdAt: -1 });
knowledgeBookmarkSchema.index({ article: 1 });

const KnowledgeBookmark = mongoose.model('KnowledgeBookmark', knowledgeBookmarkSchema);
export default KnowledgeBookmark;
