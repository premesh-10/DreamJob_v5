import express from 'express';
import InterviewSession from '../models/InterviewSession.js';
import { verifyRecordingStreamToken } from '../utils/recordingStreamToken.js';
import { streamStoredFileWithRange } from '../utils/rangeStream.js';

const router = express.Router();

// Deliberately NOT behind `protect` — a plain <video> tag can't send an
// Authorization header. Security comes from the short-lived signed token
// (minted only via the protected admin /recordings/:sessionId/stream-token
// endpoint) rather than the standard Bearer-auth middleware.
router.get('/:sessionId', async (req, res) => {
    try {
        const payload = verifyRecordingStreamToken(req.query.token || '');
        if (payload.sessionId !== req.params.sessionId) {
            return res.status(403).json({ message: 'Token does not match this recording' });
        }

        const session = await InterviewSession.findById(req.params.sessionId).select('recording');
        if (!session || session.recording.status !== 'ready' || !session.recording.filePath) {
            return res.status(404).json({ message: 'Recording is not available' });
        }

        streamStoredFileWithRange(req, res, session.recording.filePath);
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired streaming token' });
    }
});

export default router;
