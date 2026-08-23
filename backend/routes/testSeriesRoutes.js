import express from 'express';
import {
    getPublicSeries,
    getMySeries,
    getSeriesById,
    createSeries,
    updateSeries,
    deleteSeries,
    toggleSeriesPublish,
    addTestToSeries,
    removeTestFromSeries,
    reorderSeriesTests
} from '../controllers/testSeriesController.js';
import { protect, authorize, optionalProtect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getPublicSeries);
router.get('/mine', protect, authorize('seller', 'admin', 'super_admin'), getMySeries);
router.get('/:id', optionalProtect, getSeriesById);

router.post('/', protect, authorize('seller', 'admin', 'super_admin'), createSeries);
router.put('/:id', protect, authorize('seller', 'admin', 'super_admin'), updateSeries);
router.delete('/:id', protect, authorize('seller', 'admin', 'super_admin'), deleteSeries);
router.patch('/:id/publish', protect, authorize('seller', 'admin', 'super_admin'), toggleSeriesPublish);

router.post('/:id/tests', protect, authorize('seller', 'admin', 'super_admin'), addTestToSeries);
router.delete('/:id/tests/:refId', protect, authorize('seller', 'admin', 'super_admin'), removeTestFromSeries);
router.put('/:id/tests/reorder', protect, authorize('seller', 'admin', 'super_admin'), reorderSeriesTests);

export default router;
