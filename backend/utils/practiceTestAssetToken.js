import jwt from 'jsonwebtoken';

// Short-lived signed token for fetching a rendered certificate's HTML via a
// plain GET (no Authorization header available to an <iframe>/fetch-by-URL
// caller) — mirrors utils/courseStreamToken.js. Scoped to one
// server-resolved certificateId (never a client-supplied path), and only
// minted for the certificate's own owner — see certificateController.js.
export function signPracticeTestAssetToken(certificateId, userId) {
    return jwt.sign({ certificateId, userId, scope: 'practice-test-asset' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

export function verifyPracticeTestAssetToken(token) {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.scope !== 'practice-test-asset') throw new Error('Invalid token scope');
    return payload;
}
