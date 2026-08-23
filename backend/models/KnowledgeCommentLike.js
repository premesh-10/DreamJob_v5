import mongoose from 'mongoose';

const knowledgeCommentLikeSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeComment', required: true },
}, { timestamps: true });

knowledgeCommentLikeSchema.index({ user: 1, comment: 1 }, { unique: true });
knowledgeCommentLikeSchema.index({ comment: 1 });

const KnowledgeCommentLike = mongoose.model('KnowledgeCommentLike', knowledgeCommentLikeSchema);
export default KnowledgeCommentLike;
