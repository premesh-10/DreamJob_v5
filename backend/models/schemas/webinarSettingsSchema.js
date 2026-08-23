import mongoose from 'mongoose';

// Embedded as Webinar.settings. Ten named groups (registration/security/notifications/
// engagement/certificates/resources/visibility/payments/permissions/advanced), each with a
// UI-level "master toggle" (frontend-only) that flips its sub-booleans together — the schema
// itself stores granular booleans so partial states stay representable.
//
// Every leaf defaults to reproducing pre-rebuild behavior (no restrictions, no proctoring-
// equivalent gates, free chat/Q&A/polls, no certificates) with one deliberate exception:
// notifications.confirmationEmail defaults true, since shipping the new notification feature
// turned off everywhere would be a worse regression than opting every webinar into a purely
// additive confirmation email.
const webinarSettingsSchema = new mongoose.Schema({
    registration: {
        requiresApproval: { type: Boolean, default: false },
        capacityEnforced: { type: Boolean, default: true },
        waitlistEnabled: { type: Boolean, default: true },
        collectCustomFields: { type: [String], default: [] },
        closeAt: { type: Date, default: null },
    },
    security: {
        waitingRoomEnabled: { type: Boolean, default: false },
        joinBeforeHostMinutes: { type: Number, default: 15 },
        lateJoinAllowed: { type: Boolean, default: true },
        rejoinAllowed: { type: Boolean, default: true },
        roomLockable: { type: Boolean, default: true },
        domainRestriction: { type: [String], default: [] },
    },
    notifications: {
        confirmationEmail: { type: Boolean, default: true },
        calendarInvite: { type: Boolean, default: true },
        reminders: { type: [Number], default: [24, 1] },
        inAppNotifications: { type: Boolean, default: true },
    },
    engagement: {
        chatEnabled: { type: Boolean, default: true },
        privateChatEnabled: { type: Boolean, default: true },
        qaEnabled: { type: Boolean, default: true },
        pollsEnabled: { type: Boolean, default: true },
        quizzesEnabled: { type: Boolean, default: false },
        raiseHandEnabled: { type: Boolean, default: true },
        reactionsEnabled: { type: Boolean, default: true },
        announcementsEnabled: { type: Boolean, default: true },
    },
    certificates: {
        enabled: { type: Boolean, default: false },
        templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'CertificateTemplate', default: null },
        minAttendanceMinutesRequired: { type: Number, default: 0 },
    },
    resources: {
        downloadableByDefault: { type: Boolean, default: true },
        visibleBeforeLive: { type: Boolean, default: false },
    },
    visibility: {
        mode: { type: String, enum: ['public', 'private', 'unlisted'], default: 'public' },
        featuredEligible: { type: Boolean, default: true },
    },
    payments: {
        refundPolicy: { type: String, enum: ['full', 'partial', 'none'], default: 'full' },
        partialRefundPercent: { type: Number, default: 50 },
    },
    permissions: {
        speakersCanShareScreen: { type: Boolean, default: true },
        attendeesCanShareScreen: { type: Boolean, default: false },
        moderatorsCanMuteOthers: { type: Boolean, default: true },
        moderatorsCanAdmit: { type: Boolean, default: true },
    },
    advanced: {
        // Always false — no UI ever exposes turning this on. Webinar recording is out of scope.
        recordingEnabled: { type: Boolean, default: false },
        maxConcurrentParticipants: { type: Number, default: null },
        customCss: { type: String, default: '' },
    },
}, { _id: false });

export default webinarSettingsSchema;
