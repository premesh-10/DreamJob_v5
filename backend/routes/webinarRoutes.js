import express from 'express';
import {
    getWebinars,
    getWebinar,
    registerForWebinar,
    unregisterFromWebinar,
    getMyRegistrations,
    createWebinar,
    duplicateWebinar,
    publishWebinar,
    draftWebinar,
    getMyWebinars,
    getAttendees,
    updateWebinar,
    cancelWebinar,
    deleteWebinar,
    addResource,
    removeResource
} from '../controllers/webinarController.js';
import { getWebinarFeedbackSummary } from '../controllers/webinarEngagementController.js';
import { getSellerWebinarAnalytics } from '../controllers/webinarAnalyticsController.js';
import { protect, authorize, optionalProtect } from '../middleware/authMiddleware.js';
import { handleWebinarResourceUpload } from '../middleware/uploadMiddleware.js';

import { requireFeature } from '../middleware/featureFlagMiddleware.js';
const router = express.Router();
router.use(requireFeature('webinarsEnabled'));

const sellerRoles = ['seller', 'admin', 'super_admin'];

// ── Public (optionalProtect so owners/admins can preview their own draft webinars) ──────────
router.get('/', optionalProtect, getWebinars);
router.get('/:id', optionalProtect, getWebinar);

// ── Authenticated user ───────────────────────────────────────────────────────
router.get('/my-registrations', protect, getMyRegistrations);
router.post('/:id/register', protect, registerForWebinar);
router.delete('/:id/register', protect, unregisterFromWebinar);

// ── Seller ───────────────────────────────────────────────────────────────────
router.get('/seller/mine', protect, authorize(...sellerRoles), getMyWebinars);
router.get('/:id/attendees', protect, authorize(...sellerRoles), getAttendees);
router.post('/', protect, authorize(...sellerRoles), createWebinar);
router.post('/:id/duplicate', protect, authorize(...sellerRoles), duplicateWebinar);
router.patch('/:id/publish', protect, authorize(...sellerRoles), publishWebinar);
router.patch('/:id/draft', protect, authorize(...sellerRoles), draftWebinar);
router.put('/:id', protect, authorize(...sellerRoles), updateWebinar);
router.patch('/:id/cancel', protect, authorize(...sellerRoles), cancelWebinar);
router.delete('/:id', protect, authorize(...sellerRoles), deleteWebinar);
router.post('/:id/resources', protect, authorize(...sellerRoles), handleWebinarResourceUpload, addResource);
router.delete('/:id/resources/:resourceId', protect, authorize(...sellerRoles), removeResource);
router.get('/:webinarId/feedback-summary', protect, authorize(...sellerRoles), getWebinarFeedbackSummary);
router.get('/:id/analytics', protect, authorize(...sellerRoles), getSellerWebinarAnalytics);

export default router;
