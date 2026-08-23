import mongoose from 'mongoose';

// A single like, on either an experience or a comment (polymorphic via targetType).
// The unique compound index is the real duplicate-like guard — toggle logic in the
// controller is a convenience, this index is what makes it safe under concurrency.
const likeSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['experience', 'comment'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { timestamps: true });

likeSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });

const Like = mongoose.model('Like', likeSchema);
export default Like;
