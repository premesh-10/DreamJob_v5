import express from 'express';
import { getPendingSubjectiveGrading, gradeSubjectiveAnswer } from '../controllers/gradingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('seller', 'admin', 'super_admin'));

router.get('/pending', getPendingSubjectiveGrading);
router.patch('/attempts/:attemptId/questions/:questionId', gradeSubjectiveAnswer);

export default router;
