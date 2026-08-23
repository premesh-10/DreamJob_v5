import mongoose from 'mongoose';

const pointsTransactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    points: { type: Number, required: true }, // can be negative (redemption spend, moderation penalty)
    reason: {
        type: String,
        enum: [
            'experience_submitted', 'experience_liked', 'experience_featured', 'experience_removed_penalty',
            'comment_posted', 'comment_liked',
            'reward_redeemed', 'admin_adjustment',
            'practice_test_completed', 'practice_test_passed', 'practice_test_perfect_score',
            'coding_challenge_solved', 'badge_earned',
            'article_published', 'article_liked', 'article_featured', 'article_editors_pick', 'article_removed_penalty'
        ],
        required: true
    },
    refType: { type: String, enum: ['experience', 'comment', 'reward', 'practiceTest', 'article', null], default: null },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    description: { type: String, default: '' },
}, { timestamps: true });

const PointsTransaction = mongoose.model('PointsTransaction', pointsTransactionSchema);
export default PointsTransaction;
