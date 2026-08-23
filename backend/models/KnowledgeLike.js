import mongoose from 'mongoose';

const knowledgeLikeSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeArticle', required: true },
}, { timestamps: true });

knowledgeLikeSchema.index({ user: 1, article: 1 }, { unique: true });
knowledgeLikeSchema.index({ article: 1 });

const KnowledgeLike = mongoose.model('KnowledgeLike', knowledgeLikeSchema);
export default KnowledgeLike;
