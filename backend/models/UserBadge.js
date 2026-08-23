import mongoose from 'mongoose';

// Join table rather than embedding on User, so awarding a badge never touches the User document.
const userBadgeSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    badge: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', required: true },
    awardedAt: { type: Date, default: Date.now },
    refType: { type: String, default: '' }, // e.g. 'PracticeTestAttempt'
    refId: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { timestamps: true });

userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true }); // never award the same badge twice

const UserBadge = mongoose.model('UserBadge', userBadgeSchema);
export default UserBadge;
