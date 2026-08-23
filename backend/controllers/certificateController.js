import IssuedCertificate from '../models/IssuedCertificate.js';
import { renderCertificateHtml } from '../services/certificateService.js';
import { signPracticeTestAssetToken, verifyPracticeTestAssetToken } from '../utils/practiceTestAssetToken.js';

// @desc    List the logged-in student's earned certificates
// @route   GET /api/v1/certificates/mine
// @access  Private
export const getMyCertificates = async (req, res, next) => {
    try {
        const certificates = await IssuedCertificate.find({ user: req.user.id })
            .populate('practiceTest', 'title subject')
            .populate('testSeries', 'title')
            .populate('webinar', 'name')
            .populate('course', 'title')
            .sort({ issuedAt: -1 });

        res.status(200).json({ success: true, count: certificates.length, data: certificates });
    } catch (error) {
        next(error);
    }
};

// @desc    Mint a short-lived token for viewing/rendering one of the
//          student's own certificates (owner-checked here, before the token
//          is ever issued — the token itself carries no further auth).
// @route   GET /api/v1/certificates/:id/token
// @access  Private
export const mintCertificateToken = async (req, res, next) => {
    try {
        const certificate = await IssuedCertificate.findById(req.params.id);
        if (!certificate) return res.status(404).json({ message: 'Certificate not found' });
        if (certificate.user.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

        const token = signPracticeTestAssetToken(certificate._id.toString(), req.user.id);
        res.status(200).json({ success: true, token });
    } catch (error) {
        next(error);
    }
};

// @desc    Render a certificate's HTML given a valid asset token. Mounted
//          directly (not under /certificates) so the route has no :id param
//          for a client-supplied id to ever collide with — the token itself
//          is the only source of which certificate to render.
// @route   GET /api/v1/certificate-stream?token=<jwt>
// @access  Public (token is the auth)
export const streamCertificate = async (req, res, next) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(401).json({ message: 'Missing token' });

        const payload = verifyPracticeTestAssetToken(token);
        const certificate = await IssuedCertificate.findById(payload.certificateId);
        if (!certificate || certificate.user.toString() !== payload.userId) {
            return res.status(404).json({ message: 'Certificate not found' });
        }

        const html = await renderCertificateHtml(certificate);
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};
