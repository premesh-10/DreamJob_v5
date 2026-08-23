import mongoose from 'mongoose';

const rewardRedemptionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reward: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true },
    rewardTitleSnapshot: { type: String, required: true }, // preserved even if the reward is later edited/deleted
    pointsSpent: { type: Number, required: true },
    // coupon/subscription_days are fulfilled instantly by the system; physical_gift/platform_perk
    // need an admin to actually act (ship something, grant access manually) before 'fulfilled'.
    status: { type: String, enum: ['pending', 'fulfilled', 'rejected'], default: 'pending' },
    couponCodeIssued: { type: String, default: null },
    fulfillmentNote: { type: String, default: '' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
}, { timestamps: true });

const RewardRedemption = mongoose.model('RewardRedemption', rewardRedemptionSchema);
export default RewardRedemption;
