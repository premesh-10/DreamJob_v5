import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    iconUrl: { type: String, default: '' },
    criteria: {
        type: {
            type: String,
            enum: ['score_threshold', 'attempt_count', 'streak', 'category_mastery'],
            required: true
        },
        value: { type: Number, default: 0 }, // threshold/count/streak length
        category: { type: String, default: '' } // e.g. assessmentCategory or skillTag, for category_mastery
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Badge = mongoose.model('Badge', badgeSchema);
export default Badge;
