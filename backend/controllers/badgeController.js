import Badge from '../models/Badge.js';
import UserBadge from '../models/UserBadge.js';

// @desc    List the logged-in user's earned badges
// @route   GET /api/v1/badges/mine
// @access  Private
export const getMyBadges = async (req, res, next) => {
    try {
        const userBadges = await UserBadge.find({ user: req.user.id })
            .populate('badge', 'name description iconUrl')
            .sort({ awardedAt: -1 });

        res.status(200).json({ success: true, count: userBadges.length, data: userBadges });
    } catch (error) {
        next(error);
    }
};

// @desc    List all active badges (so students can see what's earnable)
// @route   GET /api/v1/badges
// @access  Public
export const getAllActiveBadges = async (req, res, next) => {
    try {
        const badges = await Badge.find({ isActive: true }).select('name description iconUrl criteria').sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: badges.length, data: badges });
    } catch (error) {
        next(error);
    }
};

// ── Admin CRUD ───────────────────────────────────────────────────────────────

// @desc    Admin: list all badges (active + inactive)
// @route   GET /api/v1/admin/badges
// @access  Private/Admin
export const adminGetAllBadges = async (req, res, next) => {
    try {
        const badges = await Badge.find().populate('createdBy', 'name').sort({ createdAt: -1 });
        const enriched = await Promise.all(badges.map(async (b) => ({
            ...b.toObject(),
            timesAwarded: await UserBadge.countDocuments({ badge: b._id })
        })));
        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: create a badge
// @route   POST /api/v1/admin/badges
// @access  Private/Admin
export const adminCreateBadge = async (req, res, next) => {
    try {
        const { name, description, iconUrl, criteria } = req.body;
        if (!name || !criteria?.type) return res.status(400).json({ message: 'name and criteria.type are required' });

        const badge = await Badge.create({
            name, description: description || '', iconUrl: iconUrl || '',
            criteria: { type: criteria.type, value: Number(criteria.value) || 0, category: criteria.category || '' },
            createdBy: req.user.id
        });
        res.status(201).json({ success: true, data: badge });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: update a badge
// @route   PUT /api/v1/admin/badges/:id
// @access  Private/Admin
export const adminUpdateBadge = async (req, res, next) => {
    try {
        const badge = await Badge.findById(req.params.id);
        if (!badge) return res.status(404).json({ message: 'Badge not found' });

        const { name, description, iconUrl, criteria, isActive } = req.body;
        if (name !== undefined) badge.name = name;
        if (description !== undefined) badge.description = description;
        if (iconUrl !== undefined) badge.iconUrl = iconUrl;
        if (criteria) badge.criteria = { type: criteria.type, value: Number(criteria.value) || 0, category: criteria.category || '' };
        if (isActive !== undefined) badge.isActive = isActive;

        await badge.save();
        res.status(200).json({ success: true, data: badge });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin: delete a badge (already-awarded UserBadge records are kept for history)
// @route   DELETE /api/v1/admin/badges/:id
// @access  Private/Admin
export const adminDeleteBadge = async (req, res, next) => {
    try {
        const badge = await Badge.findById(req.params.id);
        if (!badge) return res.status(404).json({ message: 'Badge not found' });

        await badge.deleteOne();
        res.status(200).json({ success: true, message: 'Badge deleted' });
    } catch (error) {
        next(error);
    }
};
