import { DataPacket_Kind } from 'livekit-server-sdk';
import { roomService, isLiveKitConfigured } from './livekit.js';

/**
 * Server-initiated data-channel broadcast — the one authoritative emission point for a given
 * engagement event, always called *after* the corresponding REST handler has already
 * persisted the change to MongoDB. This is deliberately not a client-broadcast design: a
 * client can't fire this before its own write is durable, so there's no race where a UI
 * update arrives ahead of (or instead of) the record it's describing.
 *
 * Failures are caught and logged, never thrown — a LiveKit outage must not fail the REST
 * response that already persisted the real data; the next poll/refetch on any client recovers.
 *
 * @param {string} roomName
 * @param {string} topic - 'webinar-engagement' for attendee-facing events, 'webinar-control' for host actions
 * @param {object} payload - JSON-serializable
 * @param {string[]} [destinationIdentities] - scope delivery to specific identities (e.g. private chat)
 */
export async function broadcastToWebinarRoom(roomName, topic, payload, destinationIdentities) {
    if (!isLiveKitConfigured) return;
    try {
        const data = new TextEncoder().encode(JSON.stringify(payload));
        await roomService.sendData(roomName, data, DataPacket_Kind.RELIABLE, {
            topic,
            ...(destinationIdentities ? { destinationIdentities } : {}),
        });
    } catch (err) {
        console.error(`[Webinar Broadcast] sendData failed for room ${roomName}, topic ${topic}:`, err.message);
    }
}
