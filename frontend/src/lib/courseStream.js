const STREAM_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

// Mints a short-lived token for a protected course file (chapter video,
// chapter PDF, or course resource) and returns the full streaming URL.
// Uses the normal `api` axios instance so the Authorization header is sent
// correctly — the resulting URL itself needs no header (the token carries
// the authorization), which is what lets it be used in <video src>/<a href>.
export async function mintStreamUrl(api, courseId, type, itemId) {
    const { data } = await api.get(`/courses/${courseId}/stream-token`, { params: { type, itemId } });
    return `${STREAM_BASE}${data.streamUrl}`;
}
