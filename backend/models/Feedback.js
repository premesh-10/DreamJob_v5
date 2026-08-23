import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['course', 'interview', 'platform'],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    review: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['general', 'bug', 'feature_request', 'content_quality', 'ui_ux', 'payment'],
        default: 'general'
    },

    // ── Public visibility controls ─────────────────────────────────────────────
    isHidden: {
        type: Boolean,
        default: false      // admin can hide a review
    },
    isReported: {
        type: Boolean,
        default: false
    },
    reportedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    reportReason: {
        type: String,
        default: ''
    }
    // ──────────────────────────────────────────────────────────────────────────

}, { timestamps: true });

const Feedback = mongoose.model('Feedback', feedbackSchema);
export default Feedback;
