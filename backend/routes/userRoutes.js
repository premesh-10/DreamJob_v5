import express from 'express';
import { updateProfile, uploadProfilePic, removeProfilePic } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.put('/profile', protect, updateProfile);
router.post('/profile/avatar', protect, uploadProfilePic);
router.delete('/profile/avatar', protect, removeProfilePic);

export default router;
