import mongoose from 'mongoose';

const rewardSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    pointsCost: { type: Number, required: true, min: 1 },
    type: {
        type: String,
        enum: ['coupon', 'subscription_days', 'platform_perk', 'physical_gift', 'digital_perk'],
        required: true
    },
    // Type-specific fulfillment data, e.g. { discountPercent: 20 } for coupons,
    // { days: 7 } for subscription_days, { perkDetails: '...' } for perks/gifts.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    stock: { type: Number, default: null }, // null = unlimited
    redeemedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const Reward = mongoose.model('Reward', rewardSchema);
export default Reward;
