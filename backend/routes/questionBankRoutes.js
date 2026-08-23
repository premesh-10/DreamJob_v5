import express from 'express';
import {
    getMyQuestions,
    getQuestionById,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    cloneQuestion,
    bulkImportQuestions
} from '../controllers/questionBankController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('seller', 'admin', 'super_admin'));

router.get('/mine', getMyQuestions);
router.post('/bulk-import', bulkImportQuestions);
router.post('/', createQuestion);
router.get('/:id', getQuestionById);
router.put('/:id', updateQuestion);
router.delete('/:id', deleteQuestion);
router.post('/:id/clone', cloneQuestion);

export default router;
