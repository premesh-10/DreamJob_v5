import express from 'express';
import {
    getApplications, getApplication, createApplication, updateApplication, deleteApplication,
    addStage, updateStage, deleteStage,
    addPrepNote,
    uploadDocument, deleteDocument,
    setFollowUp,
    getUpcoming
} from '../controllers/jobApplicationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { handleApplicationDocUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

// ── Dashboard widget — must come before /:id to avoid being captured as an id
router.get('/upcoming', getUpcoming);

// ── Application CRUD
router.get('/', getApplications);
router.post('/', createApplication);
router.get('/:id', getApplication);
router.put('/:id', updateApplication);
router.delete('/:id', deleteApplication);

// ── Interview stages
router.post('/:id/stages', addStage);
router.put('/:id/stages/:stageId', updateStage);
router.delete('/:id/stages/:stageId', deleteStage);

// ── Prep notes / questions asked
router.post('/:id/notes', addPrepNote);

// ── Documents
router.post('/:id/documents', handleApplicationDocUpload, uploadDocument);
router.delete('/:id/documents/additional/:docId', deleteDocument);
router.delete('/:id/documents/:docType', deleteDocument);

// ── Recruiter follow-up
router.put('/:id/follow-up', setFollowUp);

export default router;
