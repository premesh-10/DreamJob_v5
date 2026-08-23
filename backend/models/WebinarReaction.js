import mongoose from 'mongoose';

// Deliberately lossy/ephemeral — only an aggregate engagement count is ever needed, never
// per-reaction history, so this is the one engagement collection that's TTL-indexed rather
// than kept indefinitely like chat/Q&A/polls.
const webinarReactionSchema = new mongoose.Schema({
    webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'WebinarSession', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

webinarReactionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const WebinarReaction = mongoose.model('WebinarReaction', webinarReactionSchema);
export default WebinarReaction;
