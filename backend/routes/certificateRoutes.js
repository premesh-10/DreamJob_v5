import express from 'express';
import { getMyCertificates, mintCertificateToken } from '../controllers/certificateController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/mine', protect, getMyCertificates);
router.get('/:id/token', protect, mintCertificateToken);

export default router;
