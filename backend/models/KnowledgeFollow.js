import mongoose from 'mongoose';

const knowledgeFollowSchema = new mongoose.Schema({
    follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

knowledgeFollowSchema.index({ follower: 1, author: 1 }, { unique: true });
knowledgeFollowSchema.index({ author: 1 });
knowledgeFollowSchema.index({ follower: 1 });

const KnowledgeFollow = mongoose.model('KnowledgeFollow', knowledgeFollowSchema);
export default KnowledgeFollow;
