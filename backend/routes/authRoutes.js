import express from 'express';
import { register, login, getMe, logout, refreshToken } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', logout);
router.post('/refresh', refreshToken);

export default router;
