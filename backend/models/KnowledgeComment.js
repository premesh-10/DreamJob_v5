import mongoose from 'mongoose';

const knowledgeCommentSchema = new mongoose.Schema({
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeArticle', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeComment', default: null },
    likeCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

knowledgeCommentSchema.index({ article: 1, parentComment: 1, createdAt: 1 });
knowledgeCommentSchema.index({ author: 1 });

const KnowledgeComment = mongoose.model('KnowledgeComment', knowledgeCommentSchema);
export default KnowledgeComment;
