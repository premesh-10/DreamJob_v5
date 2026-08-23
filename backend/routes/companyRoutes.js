import express from 'express';
import {
    getCompanies, getTrendingCompanies, getCompany,
    adminCreateCompany, adminUpdateCompany, adminDeleteCompany,
    adminLinkResource, adminUnlinkResource,
} from '../controllers/companyController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { handleCompanyLogoUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();
const adminRoles = ['admin', 'super_admin', 'moderator'];

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', getCompanies);
router.get('/trending', getTrendingCompanies);
router.get('/:slug', getCompany);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.post('/', protect, authorize(...adminRoles), handleCompanyLogoUpload, adminCreateCompany);
router.put('/:id', protect, authorize(...adminRoles), handleCompanyLogoUpload, adminUpdateCompany);
router.delete('/:id', protect, authorize(...adminRoles), adminDeleteCompany);
router.post('/:id/resources', protect, authorize(...adminRoles), adminLinkResource);
router.delete('/:id/resources/:resourceId', protect, authorize(...adminRoles), adminUnlinkResource);

export default router;
