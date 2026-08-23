import mongoose from 'mongoose';
import webinarSettingsSchema from './schemas/webinarSettingsSchema.js';

const speakerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    title: { type: String, default: '' },
    bio: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    isGuest: { type: Boolean, default: false },
    linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: true });

const resourceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    filePath: { type: String, required: true },
    fileType: { type: String, default: '' },
    downloadable: { type: Boolean, default: true },
    visibleBeforeLive: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now },
    downloadCount: { type: Number, default: 0 },
}, { _id: true });

const webinarSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a webinar name'],
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // ── Schedule ────────────────────────────────────────────────────────────────
    date: {
        type: Date,
        required: [true, 'Please provide a webinar date']
    },
    time: {
        type: String,       // stored as "HH:MM" (24-hour), displayed in local TZ on frontend
        required: [true, 'Please provide a webinar time']
    },
    timezone: {
        type: String,
        default: 'Asia/Kolkata'
    },
    duration: {
        type: Number,       // in minutes
        required: [true, 'Please provide duration in minutes'],
        min: 1
    },
    numberOfDays: {
        type: Number,
        default: 1,
        min: 1
    },
    // ── Seats ───────────────────────────────────────────────────────────────────
    seatCapacity: {
        type: Number,
        required: [true, 'Please provide seat capacity'],
        min: 1
    },
    registeredUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // Waitlist: users who want a seat if one opens up
    waitlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // ── Pricing ─────────────────────────────────────────────────────────────────
    price: {
        type: Number,
        default: 0
    },
    // Tracks who paid and how much (for refunds on cancellation)
    payments: [{
        user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        amount: { type: Number, default: 0 }
    }],
    // ── Media ───────────────────────────────────────────────────────────────────
    thumbnail: {
        type: String,
        default: ''
    },
    // Hidden from unregistered users; revealed after registration
    meetingLink: {
        type: String,
        default: ''
    },
    // Visible to all once completed
    recordingUrl: {
        type: String,
        default: ''
    },
    // ── Classification ──────────────────────────────────────────────────────────
    category: {
        type: String,
        default: 'General'
    },
    tags: [String],
    language: {
        type: String,
        default: 'English'
    },
    level: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced', 'All Levels'],
        default: 'All Levels'
    },
    // ── Admin Controls ──────────────────────────────────────────────────────────
    isActive: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['upcoming', 'live', 'completed', 'cancelled'],
        default: 'upcoming'
    },
    // Reason for cancellation (shown to registered users)
    cancellationReason: {
        type: String,
        default: ''
    },
    // Whether refunds were issued on cancellation
    refundIssued: {
        type: Boolean,
        default: false
    },

    // ── Rich authoring fields (additive — all optional, no behavior change until set) ──────
    bannerImage: { type: String, default: '' },
    speakers: { type: [speakerSchema], default: [] },
    visibility: { type: String, enum: ['public', 'private', 'unlisted'], default: 'public' },
    registrationDeadline: { type: Date, default: null },
    prerequisites: { type: [String], default: [] },
    resources: { type: [resourceSchema], default: [] },

    // Links to the 4 real existing features + Company. "Roadmaps"/"Preparation Bundles" were
    // explicitly dropped from scope — those modules don't exist in this codebase.
    relatedCompanies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
    relatedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    relatedPracticeTests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTest' }],
    relatedInterviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Interview' }],
    relatedInterviewExperiences: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InterviewExperience' }],
    relatedJobRoles: { type: [String], default: [] },
    relatedSkills: { type: [String], default: [] },

    // Authoring lifecycle — deliberately separate from the time-derived `status` enum above
    // (computeStatus() in the controller is untouched). Defaults to 'published' so every
    // pre-existing webinar's behavior is unchanged.
    lifecycleStatus: {
        type: String,
        enum: ['draft', 'pending_approval', 'published', 'cancelled'],
        default: 'published'
    },

    // ── LiveKit room (Phase 3/4 wire this up; fields exist now so Phase 0 is a single,
    // complete additive migration) ──────────────────────────────────────────────────────────
    // No default — must stay genuinely absent (not explicit null) so the sparse unique index
    // below only applies to webinars that actually have a room, not to every unset webinar.
    roomName: { type: String },
    roomStatus: { type: String, enum: ['not_created', 'scheduled', 'active', 'ended'], default: 'not_created' },

    // Per-webinar settings — see backend/models/schemas/webinarSettingsSchema.js
    settings: { type: webinarSettingsSchema, default: () => ({}) },

    // Denormalized counters for fast analytics reads, kept in sync from Phase 1 onward.
    // Named distinctly from the seatsLeft/waitlistCount/registeredCount virtuals below
    // (which stay array-length-derived and are kept permanently as a defensive fallback)
    // to avoid a Mongoose virtual/path name collision.
    registrationCount: { type: Number, default: 0 },
    waitlistedCount: { type: Number, default: 0 },
    attendedCount: { type: Number, default: 0 },
}, { timestamps: true });

webinarSchema.index({ roomName: 1 }, { unique: true, sparse: true });

// ── Virtuals ────────────────────────────────────────────────────────────────────
webinarSchema.virtual('seatsLeft').get(function () {
    return Math.max(0, this.seatCapacity - (this.registeredUsers?.length || 0));
});

webinarSchema.virtual('waitlistCount').get(function () {
    return this.waitlist?.length || 0;
});

webinarSchema.virtual('registeredCount').get(function () {
    return this.registeredUsers?.length || 0;
});

webinarSchema.set('toJSON',   { virtuals: true });
webinarSchema.set('toObject', { virtuals: true });

const Webinar = mongoose.model('Webinar', webinarSchema);
export default Webinar;
