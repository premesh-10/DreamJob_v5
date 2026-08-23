import mongoose from 'mongoose';

// Bounded, always read alongside the session — mirrors InterviewSession.participantLogs.
const webinarParticipantSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    identity: { type: String, required: true },
    role: { type: String, enum: ['host', 'co-host', 'moderator', 'speaker', 'attendee'], required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    isMuted: { type: Boolean, default: false },
    camDisabled: { type: Boolean, default: false },
    handRaised: { type: Boolean, default: false },
    handRaisedAt: { type: Date, default: null },
    connectionState: { type: String, enum: ['connected', 'disconnected'], default: 'connected' },
    reconnectCount: { type: Number, default: 0 },
}, { _id: false });

// Server-side admit state — genuinely new vs. the interview room, which has no waiting room.
const waitingRoomEntrySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['waiting', 'admitted', 'denied'], default: 'waiting' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
}, { _id: false });

// The live-room operational record for a webinar — mirrors InterviewSession's structural role
// but scaled from 2 fixed parties to N role-tiered participants. One session per webinar;
// multi-day webinars are treated as one continuous session in v1 (explicit scoping choice).
const webinarSessionSchema = new mongoose.Schema({
    webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, unique: true },

    roomName: { type: String, required: true, unique: true },
    roomSid: { type: String, default: null },
    roomStatus: { type: String, enum: ['scheduled', 'active', 'locked', 'ended'], default: 'scheduled' },

    actualStart: { type: Date, default: null },
    actualEnd: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },

    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coHosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    activeSpeakers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    locked: { type: Boolean, default: false },

    // Live runtime overrides of Webinar.settings.engagement, seeded at session creation;
    // the Host Control Panel (Phase 7) flips these mid-session via toggleFeature.
    featureToggles: {
        chatEnabled: { type: Boolean, default: true },
        privateChatEnabled: { type: Boolean, default: true },
        qaEnabled: { type: Boolean, default: true },
        pollsEnabled: { type: Boolean, default: true },
        quizzesEnabled: { type: Boolean, default: false },
        reactionsEnabled: { type: Boolean, default: true },
        raiseHandEnabled: { type: Boolean, default: true },
        screenShareAttendeesAllowed: { type: Boolean, default: false },
        announcementsEnabled: { type: Boolean, default: true },
    },

    participants: { type: [webinarParticipantSchema], default: [] },
    waitingRoom: { type: [waitingRoomEntrySchema], default: [] },

    peakConcurrentParticipants: { type: Number, default: 0 },
    totalHandRaises: { type: Number, default: 0 },
    spotlightedParticipant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

const WebinarSession = mongoose.model('WebinarSession', webinarSessionSchema);
export default WebinarSession;
