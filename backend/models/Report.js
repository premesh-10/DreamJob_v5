import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['experience', 'comment', 'Webinar', 'WebinarParticipant', 'KnowledgeArticle', 'KnowledgeComment'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    // Only set for targetType:'WebinarParticipant' — scopes which webinar/session the reported
    // participant (targetId = the reported user's id) was in, since there's no standalone
    // WebinarParticipant model to look up otherwise.
    webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', default: null },
    reason: {
        type: String,
        enum: [
            'Confidential Info', 'NDA Violation', 'Misleading', 'Abusive', 'Plagiarized', 'Spam', 'Other',
            // Live-session-appropriate reasons, added for webinar abuse reports (Phase 9 wires these up).
            'Harassment', 'Inappropriate Behavior', 'Disruptive Conduct',
        ],
        required: true
    },
    details: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'reviewed', 'actioned', 'dismissed'], default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '' },
}, { timestamps: true });

const Report = mongoose.model('Report', reportSchema);
export default Report;
