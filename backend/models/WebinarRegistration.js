import mongoose from 'mongoose';

// System-of-record for webinar registrations, replacing Webinar.registeredUsers[]/waitlist[]
// as the authoritative source from Phase 1 onward. The legacy embedded arrays on Webinar are
// kept and dual-written during the cutover window for backward-compat with any not-yet-updated
// read paths — see backend/scripts/migrateWebinarRegistrations.js for the one-time backfill.
const webinarRegistrationSchema = new mongoose.Schema({
    webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    status: {
        type: String,
        enum: ['registered', 'waitlisted', 'cancelled', 'attended', 'no_show'],
        default: 'registered',
    },
    registeredAt: { type: Date, default: Date.now },
    waitlistPosition: { type: Number, default: null },

    payment: {
        amount: { type: Number, default: 0 },
        transactionRef: { type: String, default: null },
    },

    approvalStatus: {
        type: String,
        enum: ['auto_approved', 'pending', 'approved', 'rejected'],
        default: 'auto_approved',
    },

    attendance: {
        joinedAt: { type: Date, default: null },
        leftAt: { type: Date, default: null },
        durationSeconds: { type: Number, default: 0 },
        attended: { type: Boolean, default: false },
    },

    // Dedup flags for the reminder cron — which reminder-hour windows have already fired.
    remindersSent: { type: [Number], default: [] },

    calendarUid: { type: String, default: null },
    certificateIssued: { type: Boolean, default: false },
    feedbackSubmitted: { type: Boolean, default: false },
    guidelinesAcceptedAt: { type: Date, default: null },
}, { timestamps: true });

webinarRegistrationSchema.index({ webinar: 1, user: 1 }, { unique: true });

const WebinarRegistration = mongoose.model('WebinarRegistration', webinarRegistrationSchema);
export default WebinarRegistration;
