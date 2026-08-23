import jwt from 'jsonwebtoken';

// Short-lived signed token for streaming a recording via a plain <video> tag,
// which cannot send an Authorization header. The admin UI first calls the
// protected "mint" endpoint to get this token, then puts it in the <video> src
// query string against the separate unauthenticated streaming route below.
export function signRecordingStreamToken(sessionId, adminId) {
    return jwt.sign({ sessionId, adminId, scope: 'recording-stream' }, process.env.JWT_SECRET, { expiresIn: '2m' });
}

export function verifyRecordingStreamToken(token) {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.scope !== 'recording-stream') throw new Error('Invalid token scope');
    return payload;
}
