import express from 'express';
import { verifyCourseStreamToken } from '../utils/courseStreamToken.js';
import { streamStoredFileWithRange } from '../utils/rangeStream.js';

const router = express.Router();

// Deliberately NOT behind `protect` — a plain <video>/<a> tag can't send an
// Authorization header. Security comes from the short-lived signed token
// (minted only via the protected GET /courses/:id/stream-token endpoint)
// rather than the standard Bearer-auth middleware. Mirrors recordingStreamRoutes.js.
router.get('/', (req, res) => {
    try {
        const payload = verifyCourseStreamToken(req.query.token || '');
        streamStoredFileWithRange(req, res, payload.path);
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired streaming token' });
    }
});

export default router;
