import { RoomServiceClient, AccessToken, EgressClient, WebhookReceiver, TrackType, TrackSource } from 'livekit-server-sdk';

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

export const isLiveKitConfigured = Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);

if (!isLiveKitConfigured) {
    console.warn('[LiveKit] LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET are not set. ' +
        'Mock Interview video rooms will not be created until these are configured — ' +
        'booking/payment flows are unaffected.');
}

// These clients throw lazily (on first real RPC call) if mis/un-configured,
// which is fine — we never want a LiveKit outage/misconfig to crash the
// whole server at boot, only to degrade the interview-room feature itself.
export const roomService = isLiveKitConfigured
    ? new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    : null;

export const egressClient = isLiveKitConfigured
    ? new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    : null;

export const webhookReceiver = isLiveKitConfigured
    ? new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    : null;

/**
 * Idempotent — LiveKit's createRoom returns the existing room if one with
 * this name is already active, so this is safe to call as a lazy/self-heal
 * fallback as well as at booking-confirmation time.
 */
export async function createInterviewRoom(roomName, { emptyTimeoutSec = 600, maxParticipants = 4 } = {}) {
    if (!roomService) throw new Error('LiveKit is not configured (LIVEKIT_URL/API_KEY/API_SECRET missing)');
    return roomService.createRoom({
        name: roomName,
        emptyTimeout: emptyTimeoutSec,
        maxParticipants,
    });
}

export async function endInterviewRoom(roomName) {
    if (!roomService) throw new Error('LiveKit is not configured (LIVEKIT_URL/API_KEY/API_SECRET missing)');
    return roomService.deleteRoom(roomName);
}

/**
 * Mints a short-lived (default 10 min) room-join token.
 * Admins join as silent, non-publishing observers (moderation only) —
 * enforced here at the grant level, not just hidden in the UI.
 */
export async function generateInterviewToken({ roomName, identity, name, role, ttlMinutes = 10 }) {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        throw new Error('LiveKit is not configured (LIVEKIT_API_KEY/API_SECRET missing)');
    }
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity,
        name,
        ttl: `${ttlMinutes}m`,
    });

    if (role === 'admin') {
        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: false,
            canPublishData: false,
            canSubscribe: true,
            hidden: true,
        });
    } else {
        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });
    }

    return at.toJwt();
}

// ─────────────────────────────────────────────────────────────────────────────
// Webinar (1 host + N attendees, role-tiered) — siblings to the interview
// functions above, not replacements. See backend/utils/webinarRoleResolver.js
// for how a caller's role string is derived before being passed in here.
// ─────────────────────────────────────────────────────────────────────────────

export async function createWebinarRoom(roomName, { emptyTimeoutSec = 600, maxParticipants = 500 } = {}) {
    if (!roomService) throw new Error('LiveKit is not configured (LIVEKIT_URL/API_KEY/API_SECRET missing)');
    return roomService.createRoom({
        name: roomName,
        emptyTimeout: emptyTimeoutSec,
        maxParticipants,
    });
}

export async function endWebinarRoom(roomName) {
    if (!roomService) throw new Error('LiveKit is not configured (LIVEKIT_URL/API_KEY/API_SECRET missing)');
    return roomService.deleteRoom(roomName);
}

// Six role tiers. platform_admin is a hidden, non-publishing observer — distinct from host,
// which is the actual webinar owner/seller. Moderators don't publish A/V by default (they're
// moderation-only unless separately promoted to speaker), matching the Host Control Panel's
// "moderatorsCanMuteOthers"-style permission model rather than auto-granting them a mic.
export const WEBINAR_ROLE_GRANTS = {
    host:           { canPublish: true,  canPublishData: true,  canSubscribe: true, hidden: false },
    'co-host':      { canPublish: true,  canPublishData: true,  canSubscribe: true, hidden: false },
    moderator:      { canPublish: false, canPublishData: true,  canSubscribe: true, hidden: false },
    speaker:        { canPublish: true,  canPublishData: true,  canSubscribe: true, hidden: false },
    attendee:       { canPublish: false, canPublishData: true,  canSubscribe: true, hidden: false },
    platform_admin: { canPublish: false, canPublishData: false, canSubscribe: true, hidden: true },
};

/**
 * Mints a short-lived role-scoped webinar join token. Unlike the fixed-at-mint-time interview
 * scheme, webinar permissions can change live post-mint via updateParticipantPermission below
 * (e.g. attendee promoted to speaker) — the token's initial grant only matters for the first
 * connection; MongoDB (WebinarSession.participants[].role) is the actual source of truth for
 * "what role does this person currently have," re-applied via updateParticipant on promotion.
 */
export async function generateWebinarToken({ roomName, identity, name, role, ttlMinutes = 10 }) {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
        throw new Error('LiveKit is not configured (LIVEKIT_API_KEY/API_SECRET missing)');
    }
    const grant = WEBINAR_ROLE_GRANTS[role];
    if (!grant) throw new Error(`Unknown webinar role: ${role}`);

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity,
        name,
        ttl: `${ttlMinutes}m`,
    });
    at.addGrant({ room: roomName, roomJoin: true, ...grant });
    return at.toJwt();
}

// Applies a new permission set to an already-connected participant without requiring a
// reconnect — this is what makes live promote/demote (Phase 7) possible. permissionPatch is
// any subset of {canPublish, canPublishData, canSubscribe, hidden}.
export async function updateParticipantPermission(roomName, identity, permissionPatch) {
    if (!roomService) throw new Error('LiveKit is not configured (LIVEKIT_URL/API_KEY/API_SECRET missing)');
    return roomService.updateParticipant(roomName, identity, { permission: permissionPatch });
}

export async function muteParticipantTrack(roomName, identity, trackSid, muted = true) {
    if (!roomService) throw new Error('LiveKit is not configured (LIVEKIT_URL/API_KEY/API_SECRET missing)');
    return roomService.mutePublishedTrack(roomName, identity, trackSid, muted);
}

export async function removeParticipantFromRoom(roomName, identity) {
    if (!roomService) throw new Error('LiveKit is not configured (LIVEKIT_URL/API_KEY/API_SECRET missing)');
    return roomService.removeParticipant(roomName, identity);
}

// mutePublishedTrack needs a trackSid, which the Host Control Panel doesn't track — this
// looks the participant's currently-published tracks up live and mutes/unmutes every track of
// the given kind ('audio' = mic, 'video' = camera). Returns the number of tracks affected (0 if
// the participant currently has no track of that kind published, which is a normal, non-error
// outcome — e.g. muting someone whose mic was never turned on).
export async function setParticipantMediaMuted(roomName, identity, kind, muted = true) {
    if (!roomService) throw new Error('LiveKit is not configured (LIVEKIT_URL/API_KEY/API_SECRET missing)');
    const participant = await roomService.getParticipant(roomName, identity);
    const targetType = kind === 'video' ? TrackType.VIDEO : TrackType.AUDIO;
    const tracks = (participant?.tracks || []).filter(t => t.type === targetType);
    await Promise.all(tracks.map(t => roomService.mutePublishedTrack(roomName, identity, t.sid, muted)));
    return tracks.length;
}

// Grants/revokes screen-share publish rights without otherwise changing the participant's
// existing camera/mic publish grant — e.g. letting an attendee (canPublish:false) share their
// screen without turning them into a full audio/video publisher.
export async function setScreenSharePermission(roomName, identity, baseGrant, allowed) {
    if (!roomService) throw new Error('LiveKit is not configured (LIVEKIT_URL/API_KEY/API_SECRET missing)');
    const camMicSources = baseGrant.canPublish ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [];
    const canPublishSources = allowed
        ? [...camMicSources, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
        : camMicSources;
    return roomService.updateParticipant(roomName, identity, {
        permission: { ...baseGrant, canPublish: baseGrant.canPublish || allowed, canPublishSources },
    });
}
