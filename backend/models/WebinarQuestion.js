import mongoose from 'mongoose';

const webinarQuestionSchema = new mongoose.Schema({
    webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'WebinarSession', required: true },
    askedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 1000 },
    isAnonymous: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'answered', 'dismissed'], default: 'pending' },
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Kept in sync on each vote (rather than recomputed via $size on every sort) for fast
    // "most-upvoted first" queue ordering in the host's Q&A panel.
    upvoteCount: { type: Number, default: 0 },
    answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    answerText: { type: String, default: '' },
    answeredAt: { type: Date, default: null },
}, { timestamps: true });

webinarQuestionSchema.index({ session: 1, status: 1 });

const WebinarQuestion = mongoose.model('WebinarQuestion', webinarQuestionSchema);
export default WebinarQuestion;
