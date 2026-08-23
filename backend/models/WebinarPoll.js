import mongoose from 'mongoose';

const pollOptionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: true });

const webinarPollSchema = new mongoose.Schema({
    webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'WebinarSession', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true, maxlength: 500 },
    options: { type: [pollOptionSchema], validate: v => v.length >= 2 },
    isQuiz: { type: Boolean, default: false },
    correctOptionIndex: { type: Number, default: null },
    status: { type: String, enum: ['draft', 'open', 'closed'], default: 'draft' },
    openedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    // Snapshotted at close-time (distinctVoters / attendeeCountAtClose) rather than recomputed
    // later against a since-changed attendee count — participation rate should reflect the
    // audience that was actually present when the poll was live, not whoever's registered now.
    participationRate: { type: Number, default: null },
}, { timestamps: true });

webinarPollSchema.index({ session: 1, status: 1 });

const WebinarPoll = mongoose.model('WebinarPoll', webinarPollSchema);
export default WebinarPoll;
