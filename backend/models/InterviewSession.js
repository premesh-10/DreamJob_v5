import mongoose from 'mongoose';

const participantLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['interviewer', 'candidate', 'admin'] },
    joinedAt: { type: Date },
    leftAt: { type: Date, default: null },
    isLate: { type: Boolean, default: false },
    reconnectCount: { type: Number, default: 0 },
}, { _id: false });

const rescheduleEntrySchema = new mongoose.Schema({
    fromStart: Date,
    fromEnd: Date,
    toStart: Date,
    toEnd: Date,
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, default: '' },
    at: { type: Date, default: Date.now },
}, { _id: false });

const documentRefSchema = new mongoose.Schema({
    name: String,
    filePath: String,
    uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

// The core operational record for a confirmed mock-interview booking — 1:1
// with a Booking. Booking stays the generic commerce record; everything
// LiveKit/attendance/recording/completion-specific lives here.
const interviewSessionSchema = new mongoose.Schema({
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    interview: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
    slotId: { type: mongoose.Schema.Types.ObjectId, required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    interviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // LiveKit room
    roomName: { type: String, required: true, unique: true },
    roomSid: { type: String, default: null },
    roomStatus: { type: String, enum: ['scheduled', 'active', 'ended', 'expired'], default: 'scheduled' },

    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    actualStart: { type: Date, default: null },
    actualEnd: { type: Date, default: null },

    // Attendance / join-leave logs (driven by LiveKit webhooks, Phase 2)
    participantLogs: [participantLogSchema],
    attendance: {
        interviewerJoined: { type: Boolean, default: false },
        candidateJoined: { type: Boolean, default: false },
        noShow: { type: String, enum: ['none', 'interviewer', 'candidate', 'both'], default: 'none' },
    },
    durationSeconds: { type: Number, default: 0 },

    // Recording (LiveKit Egress)
    recording: {
        consentGiven: { type: Boolean, default: false },
        consentBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        egressId: { type: String, default: null },
        status: { type: String, enum: ['none', 'recording', 'processing', 'ready', 'failed'], default: 'none' },
        filePath: { type: String, default: null },
        durationSeconds: { type: Number, default: 0 },
        // Hooks for future AI features — populated by a future async worker, not implemented now.
        transcriptStatus: { type: String, enum: ['not_requested', 'pending', 'ready', 'failed'], default: 'not_requested' },
        transcriptPath: { type: String, default: null },
        aiSummaryStatus: { type: String, enum: ['not_requested', 'pending', 'ready', 'failed'], default: 'not_requested' },
        aiSummary: { type: String, default: null },
    },

    // Pre-interview materials
    candidateDocuments: [documentRefSchema],
    interviewerResources: [documentRefSchema],

    // Completion workflow
    completionStatus: {
        type: String,
        enum: ['not_started', 'in_progress', 'awaiting_feedback', 'completed', 'disputed', 'no_show', 'cancelled'],
        default: 'not_started',
    },
    interviewerFeedback: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewFeedback', default: null },
    candidateFeedback: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewFeedback', default: null },

    rescheduleHistory: [rescheduleEntrySchema],
    cancellation: {
        cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        cancelledAt: { type: Date, default: null },
        reason: { type: String, default: '' },
        refundIssued: { type: Boolean, default: false },
    },

    // Dedup flags for the reminder cron — which reminder-hour windows have already fired.
    remindersSent: { type: [Number], default: [] },

    // LiveKit webhook event ids already processed for this session — LiveKit can
    // redeliver the same event (network retry, server restart), and without this
    // guard a redelivered participant_joined/room_finished would double-log
    // attendance or re-run no-show/refund logic.
    processedWebhookEventIds: { type: [String], default: [] },
}, {
    timestamps: true
});

interviewSessionSchema.index({ interviewer: 1, scheduledStart: 1 });
interviewSessionSchema.index({ candidate: 1, scheduledStart: 1 });

const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);
export default InterviewSession;
