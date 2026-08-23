import { v4 as uuidv4 } from 'uuid';
import Reward from '../models/Reward.js';
import RewardRedemption from '../models/RewardRedemption.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import PointsTransaction from '../models/PointsTransaction.js';
import { getLevelForPoints } from '../utils/gamification.js';
import { deleteUploadedFile } from '../middleware/uploadMiddleware.js';

const buildFilePath = (file, subfolder) => file ? `/uploads/${subfolder}/${file.filename}` : '';

// @desc    Browse the active reward catalog
// @route   GET /api/v1/rewards
// @access  Public
export const getRewards = async (req, res, next) => {
    try {
        const rewards = await Reward.find({ isActive: true }).sort({ pointsCost: 1 });
        res.status(200).json({ success: true, count: rewards.length, data: rewards });
    } catch (error) {
        next(error);
    }
};

// @desc    Redeem a reward with contribution points
// @route   POST /api/v1/rewards/:id/redeem
// @access  Private
export const redeemReward = async (req, res, next) => {
    try {
        const reward = await Reward.findById(req.params.id);
        if (!reward || !reward.isActive) return res.status(404).json({ message: 'Reward not found' });
        if (reward.stock !== null && reward.stock <= 0) return res.status(400).json({ message: 'This reward is out of stock' });

        // Atomically claim stock first (if limited) so two redeemers can't both grab the last unit.
        const stockFilter = reward.stock !== null ? { _id: reward._id, stock: { $gt: 0 } } : { _id: reward._id };
        const stockUpdate = reward.stock !== null
            ? { $inc: { stock: -1, redeemedCount: 1 } }
            : { $inc: { redeemedCount: 1 } };
        const claimedReward = await Reward.findOneAndUpdate(stockFilter, stockUpdate, { new: true });
        if (!claimedReward) return res.status(400).json({ message: 'This reward just went out of stock' });

        // Atomically claim the points — fails cleanly if the user doesn't have enough.
        const claimedUser = await User.findOneAndUpdate(
            { _id: req.user.id, contributionPoints: { $gte: reward.pointsCost } },
            { $inc: { contributionPoints: -reward.pointsCost } },
            { new: true }
        );
        if (!claimedUser) {
            // Roll back the stock claim — the redemption never happened.
            await Reward.findByIdAndUpdate(reward._id, reward.stock !== null
                ? { $inc: { stock: 1, redeemedCount: -1 } }
                : { $inc: { redeemedCount: -1 } });
            return res.status(400).json({ message: `Not enough points. You need ${reward.pointsCost}, you have ${req.user.contributionPoints || 0}.` });
        }
        claimedUser.hubLevel = getLevelForPoints(claimedUser.contributionPoints);
        await claimedUser.save();

        await PointsTransaction.create({
            user: req.user.id, points: -reward.pointsCost, reason: 'reward_redeemed',
            refType: 'reward', refId: reward._id, description: `Redeemed: ${reward.title}`,
        });

        // Instant fulfillment for digital rewards; everything else needs an admin to act.
        let status = 'pending';
        let couponCodeIssued = null;

        if (reward.type === 'coupon') {
            const code = `HUB${uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase()}`;
            await Coupon.create({
                code,
                discountType: reward.metadata?.discountType || 'percent',
                discountValue: reward.metadata?.discountValue || 10,
                maxUses: 1,
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                applicableTo: reward.metadata?.applicableTo || 'all',
            });
            couponCodeIssued = code;
            status = 'fulfilled';
        } else if (reward.type === 'subscription_days') {
            const days = Number(reward.metadata?.days) || 7;
            const user = await User.findById(req.user.id);
            const base = user.subscription?.validUntil && user.subscription.validUntil > new Date()
                ? user.subscription.validUntil
                : new Date();
            user.subscription.validUntil = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
            if (!user.subscription.plan || user.subscription.plan === 'None') {
                user.subscription.plan = reward.metadata?.fallbackPlan || 'Silver';
            }
            await user.save();
            status = 'fulfilled';
        }

        const redemption = await RewardRedemption.create({
            user: req.user.id,
            reward: reward._id,
            rewardTitleSnapshot: reward.title,
            pointsSpent: reward.pointsCost,
            status,
            couponCodeIssued,
        });

        res.status(201).json({
            success: true,
            data: redemption,
            remainingPoints: claimedUser.contributionPoints,
            message: status === 'fulfilled'
                ? 'Reward redeemed and fulfilled instantly!'
                : 'Reward redeemed! Our team will process and fulfill it shortly.',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    My redemption history
// @route   GET /api/v1/rewards/me/redemptions
// @access  Private
export const getMyRedemptions = async (req, res, next) => {
    try {
        const redemptions = await RewardRedemption.find({ user: req.user.id })
            .populate('reward', 'title image type')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: redemptions.length, data: redemptions });
    } catch (error) {
        next(error);
    }
};

// ── Admin: catalog management ───────────────────────────────────────────────────

// @desc    Create a reward (Admin)
// @route   POST /api/v1/rewards
// @access  Private/Admin
export const adminCreateReward = async (req, res, next) => {
    try {
        const { title, description, pointsCost, type, metadata, stock } = req.body;
        if (!title || !pointsCost || !type) return res.status(400).json({ message: 'title, pointsCost, and type are required' });

        const reward = await Reward.create({
            title, description, pointsCost, type,
            metadata: typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {}),
            stock: stock === undefined || stock === '' ? null : Number(stock),
            image: req.file ? buildFilePath(req.file, 'companies') : '',
            createdBy: req.user.id,
        });
        res.status(201).json({ success: true, data: reward });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a reward (Admin)
// @route   PUT /api/v1/rewards/:id
// @access  Private/Admin
export const adminUpdateReward = async (req, res, next) => {
    try {
        const reward = await Reward.findById(req.params.id);
        if (!reward) return res.status(404).json({ message: 'Reward not found' });

        const { title, description, pointsCost, type, metadata, stock, isActive } = req.body;
        if (title !== undefined) reward.title = title;
        if (description !== undefined) reward.description = description;
        if (pointsCost !== undefined) reward.pointsCost = pointsCost;
        if (type !== undefined) reward.type = type;
        if (metadata !== undefined) reward.metadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
        if (stock !== undefined) reward.stock = stock === '' ? null : Number(stock);
        if (isActive !== undefined) reward.isActive = isActive;

        if (req.file) {
            if (reward.image) deleteUploadedFile(reward.image);
            reward.image = buildFilePath(req.file, 'companies');
        }

        await reward.save();
        res.status(200).json({ success: true, data: reward });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a reward (Admin)
// @route   DELETE /api/v1/rewards/:id
// @access  Private/Admin
export const adminDeleteReward = async (req, res, next) => {
    try {
        const reward = await Reward.findById(req.params.id);
        if (!reward) return res.status(404).json({ message: 'Reward not found' });
        if (reward.image) deleteUploadedFile(reward.image);
        await reward.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};

// @desc    List redemptions (Admin) — for manual fulfillment of perks/gifts
// @route   GET /api/v1/rewards/admin/redemptions?status=pending
// @access  Private/Admin
export const adminGetRedemptions = async (req, res, next) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};
        const redemptions = await RewardRedemption.find(query)
            .populate('user', 'name email')
            .populate('reward', 'title type')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: redemptions.length, data: redemptions });
    } catch (error) {
        next(error);
    }
};

// @desc    Fulfill or reject a pending redemption (Admin) — rejecting refunds the points
// @route   PUT /api/v1/rewards/admin/redemptions/:id
// @access  Private/Admin
export const adminProcessRedemption = async (req, res, next) => {
    try {
        const { status, fulfillmentNote } = req.body;
        if (!['fulfilled', 'rejected'].includes(status)) return res.status(400).json({ message: 'status must be fulfilled or rejected' });

        const redemption = await RewardRedemption.findById(req.params.id);
        if (!redemption) return res.status(404).json({ message: 'Redemption not found' });
        if (redemption.status !== 'pending') return res.status(400).json({ message: 'This redemption was already processed' });

        if (status === 'rejected') {
            const user = await User.findByIdAndUpdate(
                redemption.user,
                { $inc: { contributionPoints: redemption.pointsSpent } },
                { new: true }
            );
            if (user) {
                user.hubLevel = getLevelForPoints(user.contributionPoints);
                await user.save();
            }
            await PointsTransaction.create({
                user: redemption.user, points: redemption.pointsSpent, reason: 'admin_adjustment',
                refType: 'reward', refId: redemption.reward, description: `Refund: redemption rejected — ${fulfillmentNote || ''}`,
            });
        }

        redemption.status = status;
        redemption.fulfillmentNote = fulfillmentNote || '';
        redemption.processedBy = req.user.id;
        redemption.processedAt = new Date();
        await redemption.save();

        res.status(200).json({ success: true, data: redemption });
    } catch (error) {
        next(error);
    }
};
