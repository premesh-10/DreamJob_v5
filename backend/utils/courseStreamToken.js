import jwt from 'jsonwebtoken';

// Short-lived signed token for streaming protected course media (chapter
// videos/PDFs, course resources) via plain <video>/<a> tags, which can't
// send an Authorization header. Mirrors utils/recordingStreamToken.js.
//
// Scoped to one resolved storage-relative path (never a client-supplied
// path) — the mint endpoint resolves the real path server-side from a
// courseId/chapterId/resourceId, so this token can never be used to read an
// arbitrary file. 6h expiry: long enough that a token minted at the start
// of a chapter survives pause/resume or a long binge-watch without
// mid-playback re-auth errors (the browser issues many Range requests per
// chapter, each independently verified), short enough to bound the value of
// a leaked link — the same tradeoff signed CDN URLs (S3/CloudFront) make.
export function signCourseStreamToken(relativePath, userId) {
    return jwt.sign({ path: relativePath, userId, scope: 'course-stream' }, process.env.JWT_SECRET, { expiresIn: '6h' });
}

export function verifyCourseStreamToken(token) {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.scope !== 'course-stream') throw new Error('Invalid token scope');
    return payload;
}
