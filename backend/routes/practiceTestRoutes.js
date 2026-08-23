import express from 'express';
import {
    getPublicPracticeTests,
    getMyPracticeTests,
    getPracticeTest,
    createPracticeTest,
    updatePracticeTest,
    deletePracticeTest,
    togglePracticeTestPublish,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    addSection,
    updateSection,
    deleteSection,
    reorderSections,
    addQuestionRefToSection,
    removeQuestionRefFromSection,
    convertToSections,
    startAttempt,
    resumeAttempt,
    autosaveAttempt,
    submitAttempt,
    recordViolation,
    runCode,
    submitCode,
    getCodeJobStatus,
    getAttemptResult,
    getMyAttempts,
    getAllMyAttempts,
    getRecommendedPracticeTests
} from '../controllers/practiceTestController.js';
import { protect, authorize, optionalProtect } from '../middleware/authMiddleware.js';

import { requireFeature } from '../middleware/featureFlagMiddleware.js';
const router = express.Router();
router.use(requireFeature('practiceTestsEnabled'));

// ── Public / User Routes ───────────────────────────────────────────────────────
router.get('/', getPublicPracticeTests);

// My attempts across all tests
router.get('/my-attempts/all', protect, getAllMyAttempts);

// Cross-feature recommendations (Company hub / Interview Experience / mock-interview booking)
router.get('/recommendations', getRecommendedPracticeTests);

// Seller's own tests
router.get('/mine', protect, authorize('seller', 'admin', 'super_admin'), getMyPracticeTests);

// ── Create / CRUD ─────────────────────────────────────────────────────────────
router.post('/', protect, authorize('seller', 'admin', 'super_admin'), createPracticeTest);

// Single test — no auth required (answers stripped for non-owners; attempt history only if logged in)
router.get('/:id', optionalProtect, getPracticeTest);
router.put('/:id', protect, authorize('seller', 'admin', 'super_admin'), updatePracticeTest);
router.delete('/:id', protect, authorize('seller', 'admin', 'super_admin'), deletePracticeTest);
router.patch('/:id/publish', protect, authorize('seller', 'admin', 'super_admin'), togglePracticeTestPublish);

// ── Questions ─────────────────────────────────────────────────────────────────
router.post('/:id/questions', protect, authorize('seller', 'admin', 'super_admin'), addQuestion);
router.put('/:id/questions/reorder', protect, authorize('seller', 'admin', 'super_admin'), reorderQuestions);
router.put('/:id/questions/:questionId', protect, authorize('seller', 'admin', 'super_admin'), updateQuestion);
router.delete('/:id/questions/:questionId', protect, authorize('seller', 'admin', 'super_admin'), deleteQuestion);

// ── Sections (question-bank-backed authoring) ──────────────────────────────────
router.post('/:id/convert-to-sections', protect, authorize('seller', 'admin', 'super_admin'), convertToSections);
router.post('/:id/sections', protect, authorize('seller', 'admin', 'super_admin'), addSection);
router.put('/:id/sections/reorder', protect, authorize('seller', 'admin', 'super_admin'), reorderSections);
router.put('/:id/sections/:sectionId', protect, authorize('seller', 'admin', 'super_admin'), updateSection);
router.delete('/:id/sections/:sectionId', protect, authorize('seller', 'admin', 'super_admin'), deleteSection);
router.post('/:id/sections/:sectionId/questions', protect, authorize('seller', 'admin', 'super_admin'), addQuestionRefToSection);
router.delete('/:id/sections/:sectionId/questions/:refId', protect, authorize('seller', 'admin', 'super_admin'), removeQuestionRefFromSection);

// ── Attempt Flow ──────────────────────────────────────────────────────────────
router.post('/:id/attempt/start', protect, startAttempt);
router.get('/:id/attempt/:attemptId/resume', protect, resumeAttempt);
router.patch('/:id/attempt/:attemptId/autosave', protect, autosaveAttempt);
router.post('/:id/attempt/:attemptId/submit', protect, submitAttempt);
router.post('/:id/attempt/:attemptId/violation', protect, recordViolation);
router.post('/:id/attempt/:attemptId/code/run', protect, runCode);
router.post('/:id/attempt/:attemptId/code/submit', protect, submitCode);
router.get('/:id/attempt/:attemptId/code/status/:jobId', protect, getCodeJobStatus);
router.get('/:id/attempts/:attemptId', protect, getAttemptResult);
router.get('/:id/my-attempts', protect, getMyAttempts);

export default router;
