import mongoose from 'mongoose';

// Own collection (not embedded on WebinarSession) — chat volume is unbounded and queried
// independently after the session ends (e.g. moderation review), unlike the bounded
// participants[]/waitingRoom[] arrays that are always read alongside the live session.
const webinarChatMessageSchema = new mongoose.Schema({
    webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'WebinarSession', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['host', 'co-host', 'moderator', 'speaker', 'attendee', 'platform_admin'], required: true },
    text: { type: String, required: true, maxlength: 2000 },
    scope: { type: String, enum: ['public', 'private'], default: 'public' },
    recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

webinarChatMessageSchema.index({ session: 1, createdAt: 1 });
webinarChatMessageSchema.index({ session: 1, scope: 1, recipientUser: 1 });

const WebinarChatMessage = mongoose.model('WebinarChatMessage', webinarChatMessageSchema);
export default WebinarChatMessage;
