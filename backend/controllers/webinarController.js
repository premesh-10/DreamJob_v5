import Webinar from '../models/Webinar.js';
import WebinarRegistration from '../models/WebinarRegistration.js';
import Seller from '../models/Seller.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import { refundPayment } from '../utils/refund.js';
import { sendRegistrationConfirmation, sendWaitlistNotice, sendWaitlistPromotion, sendCancellationNotice } from '../utils/webinarMailTemplates.js';
import { getScheduleWindow } from '../utils/webinarSchedule.js';
import { createWebinarRoom } from '../utils/livekit.js';
import { findOrCreateWebinarSession } from './webinarSessionController.js';
import { storageProvider } from '../utils/storage.js';
import { storageConfig } from '../config/storage.js';
import { logAudit } from '../utils/auditLog.js';
import path from 'path';

const buildResourceFilePath = (file) => storageProvider.getPublicUrl(`${storageConfig.uploadsDir}/webinar-resources/${file.filename}`);

export const ADMIN_ROLES = ['admin', 'super_admin', 'moderator', 'finance_admin', 'support_admin'];

// ── Helper ─────────────────────────────────────────────────────────────────────
// Strip meetingLink from public webinar data (only revealed to registered users)
const publicView = (w, userId) => {
    const json = w.toJSON();
    const isRegistered = userId && w.registeredUsers.some(id => id.toString() === userId.toString());
    return {
        ...json,
        // Only expose meeting link if user is registered (or webinar completed with recording)
        meetingLink: isRegistered ? json.meetingLink : undefined,
        isRegistered: !!isRegistered,
        isOnWaitlist: userId ? w.waitlist.some(id => id.toString() === userId.toString()) : false,
        // Resources marked visibleBeforeLive are previewable pre-registration; the rest only
        // reveal once registered (same gating model as meetingLink above).
        resources: isRegistered ? json.resources : (json.resources || []).filter(r => r.visibleBeforeLive),
    };
};

// Auto-compute status based on date + time + duration (without overriding manual 'cancelled')
const computeStatus = (webinar) => {
    if (webinar.status === 'cancelled') return 'cancelled';
    const now = new Date();
    const { start, end } = getScheduleWindow(webinar);
    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'live';
    return 'completed';
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC / USER endpoints
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get all active webinars
// @route   GET /api/v1/webinars
// @access  Public
export const getWebinars = async (req, res, next) => {
    try {
        const webinars = await Webinar.find({ isActive: true, lifecycleStatus: 'published' })
            .populate('seller', 'name email')
            .sort({ date: 1 });

        // Batch auto-update statuses without blocking the response
        const updates = [];
        const userId = req.user?.id;
        const enriched = webinars
            .map(w => {
                const computed = computeStatus(w);
                if (computed !== w.status && w.status !== 'cancelled') {
                    updates.push(Webinar.findByIdAndUpdate(w._id, { status: computed }));
                }
                return { ...publicView(w, userId), status: computed };
            })
            .filter(w => w.status !== 'completed');
        if (updates.length) Promise.all(updates).catch(() => {});

        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single webinar
// @route   GET /api/v1/webinars/:id
// @access  Public
export const getWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id)
            .populate('seller', 'name email');

        if (!webinar) return res.status(404).json({ success: false, message: 'Webinar not found' });

        // Draft/pending-approval webinars are only visible to their owner or an admin —
        // everyone else gets a 404 (no info leak about unpublished content).
        if (webinar.lifecycleStatus !== 'published') {
            const isOwner = req.user && webinar.seller._id.toString() === req.user.id;
            const isAdmin = req.user && ADMIN_ROLES.includes(req.user.role);
            if (!isOwner && !isAdmin) {
                return res.status(404).json({ success: false, message: 'Webinar not found' });
            }
        }

        const computed = computeStatus(webinar);
        if (computed !== webinar.status && webinar.status !== 'cancelled') {
            await Webinar.findByIdAndUpdate(webinar._id, { status: computed });
        }

        const userId = req.user?.id;
        res.status(200).json({
            success: true,
            data: { ...publicView(webinar, userId), status: computed }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Register for a webinar (handles free + paid + waitlist)
// @route   POST /api/v1/webinars/:id/register
// @access  Private
export const registerForWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        const computed = computeStatus(webinar);
        if (!webinar.isActive || webinar.status === 'cancelled') {
            return res.status(400).json({ message: 'This webinar is not available for registration' });
        }
        if (computed === 'completed') {
            return res.status(400).json({ message: 'This webinar has already ended' });
        }

        const userId = req.user.id;
        const alreadyRegistered = webinar.registeredUsers.some(id => id.toString() === userId);
        if (alreadyRegistered) return res.status(400).json({ message: 'You are already registered for this webinar' });

        const alreadyOnWaitlist = webinar.waitlist.some(id => id.toString() === userId);
        if (alreadyOnWaitlist) return res.status(400).json({ message: 'You are already on the waitlist' });

        const seatsLeft = webinar.seatCapacity - webinar.registeredUsers.length;
        // approvalStatus is recorded for future moderation workflows but doesn't gate access
        // yet — no per-attendee approve/reject endpoint exists in this phase.
        const approvalStatus = webinar.settings?.registration?.requiresApproval ? 'pending' : 'auto_approved';

        // ── WAITLIST ─────────────────────────────────────────────────────────────
        if (seatsLeft <= 0) {
            webinar.waitlist.push(userId);
            webinar.waitlistedCount = webinar.waitlist.length;
            await webinar.save();
            await WebinarRegistration.create({
                webinar: webinar._id,
                user: userId,
                status: 'waitlisted',
                waitlistPosition: webinar.waitlist.length,
                approvalStatus,
            });
            if (webinar.settings?.notifications?.inAppNotifications !== false) {
                const { start } = getScheduleWindow(webinar);
                sendWaitlistNotice({ webinar, start, recipient: req.user, waitlistPosition: webinar.waitlist.length }).catch(err =>
                    console.error('[Webinar] sendWaitlistNotice failed:', err.message));
            }
            return res.status(200).json({
                success: true,
                message: 'No seats available. You have been added to the waitlist.',
                status: 'waitlisted',
                waitlistPosition: webinar.waitlist.length
            });
        }

        // ── PAYMENT ──────────────────────────────────────────────────────────────
        // Paid webinars must go through Cashfree checkout — not this endpoint
        let amountPaid = 0;
        if (webinar.price > 0) {
            return res.status(400).json({
                message: 'Paid webinars must be registered via the payment gateway.',
                requiresPayment: true,
                amount: webinar.price,
            });
        }

        webinar.registeredUsers.push(userId);
        webinar.registrationCount = webinar.registeredUsers.length;
        await webinar.save();
        const registration = await WebinarRegistration.create({
            webinar: webinar._id,
            user: userId,
            status: 'registered',
            approvalStatus,
            calendarUid: `webinar-reg-${webinar._id}-${userId}@dreamjob`,
        });

        if (webinar.settings?.notifications?.confirmationEmail !== false) {
            const { start, end } = getScheduleWindow(webinar);
            sendRegistrationConfirmation({
                webinar, start, end, recipient: req.user,
                calendarUid: registration.calendarUid,
                settings: webinar.settings?.notifications || {},
            }).catch(err => console.error('[Webinar] sendRegistrationConfirmation failed:', err.message));
        }

        res.status(200).json({
            success: true,
            message: 'Successfully registered! Your meeting link is now available.',
            status: 'registered',
            amountPaid,
            meetingLink: webinar.meetingLink,
            seatsLeft: Math.max(0, webinar.seatCapacity - webinar.registeredUsers.length)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Unregister from a webinar (promotes waitlist users, issues refund)
// @route   DELETE /api/v1/webinars/:id/register
// @access  Private
export const unregisterFromWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        const userId = req.user.id;

        // Check waitlist first
        const wlIdx = webinar.waitlist.findIndex(id => id.toString() === userId);
        if (wlIdx !== -1) {
            webinar.waitlist.splice(wlIdx, 1);
            webinar.waitlistedCount = webinar.waitlist.length;
            await webinar.save();
            await WebinarRegistration.findOneAndUpdate(
                { webinar: webinar._id, user: userId },
                { status: 'cancelled' }
            );
            return res.status(200).json({ success: true, message: 'Removed from waitlist' });
        }

        const idx = webinar.registeredUsers.findIndex(id => id.toString() === userId);
        if (idx === -1) return res.status(400).json({ message: 'You are not registered for this webinar' });

        webinar.registeredUsers.splice(idx, 1);

        // ── REFUND if paid — real Cashfree refund against the original order ─────
        const payment = webinar.payments.find(p => p.user.toString() === userId);
        let refundResult = null;
        if (payment && payment.amount > 0) {
            refundResult = await refundPayment({
                userId,
                type: 'webinar',
                itemId: webinar._id,
                amount: payment.amount,
                note: `Refund for webinar cancellation: ${webinar.name}`,
            });
            if (!refundResult.success) {
                console.error(`[Webinar] Refund failed for user ${userId} on webinar ${webinar._id}:`, refundResult.error.message);
            }
            webinar.payments = webinar.payments.filter(p => p.user.toString() !== userId);
        }

        await WebinarRegistration.findOneAndUpdate(
            { webinar: webinar._id, user: userId },
            { status: 'cancelled' }
        );

        // ── PROMOTE next waitlist user ──────────────────────────────────────────
        let promotedUserId = null;
        if (webinar.waitlist.length > 0) {
            promotedUserId = webinar.waitlist.shift();
            webinar.registeredUsers.push(promotedUserId);
            webinar.waitlistedCount = webinar.waitlist.length;
        }

        webinar.registrationCount = webinar.registeredUsers.length;
        await webinar.save();

        if (promotedUserId) {
            const calendarUid = `webinar-reg-${webinar._id}-${promotedUserId}@dreamjob`;
            const promotedRegistration = await WebinarRegistration.findOneAndUpdate(
                { webinar: webinar._id, user: promotedUserId },
                { status: 'registered', waitlistPosition: null, calendarUid },
                { new: true }
            );
            if (webinar.settings?.notifications?.confirmationEmail !== false) {
                const promotedUser = await User.findById(promotedUserId).select('name email');
                if (promotedUser) {
                    const { start, end } = getScheduleWindow(webinar);
                    sendWaitlistPromotion({
                        webinar, start, end, recipient: promotedUser,
                        calendarUid: promotedRegistration?.calendarUid || calendarUid,
                        settings: webinar.settings?.notifications || {},
                    }).catch(err => console.error('[Webinar] sendWaitlistPromotion failed:', err.message));
                }
            }
        }

        let message = 'Successfully unregistered.';
        if (payment?.amount > 0) {
            message = refundResult?.success
                ? 'Unregistered. Your refund has been initiated and will reflect in your original payment method shortly.'
                : 'Unregistered, but we could not initiate your refund automatically. Our support team has been notified and will process it manually.';
        }

        res.status(200).json({ success: true, message });
    } catch (error) {
        next(error);
    }
};

// @desc    Get webinars the current user is registered for or on waitlist
// @route   GET /api/v1/webinars/my-registrations
// @access  Private
export const getMyRegistrations = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const registered = await Webinar.find({ registeredUsers: userId })
            .populate('seller', 'name email')
            .sort({ date: 1 });

        const waitlisted = await Webinar.find({ waitlist: userId })
            .populate('seller', 'name email')
            .sort({ date: 1 });

        const toView = (w, type) => {
            const computed = computeStatus(w);
            return {
                ...publicView(w, userId),
                status: computed,
                registrationType: type
            };
        };

        res.status(200).json({
            success: true,
            data: {
                registered: registered.map(w => toView(w, 'registered')),
                waitlisted: waitlisted.map(w => toView(w, 'waitlisted'))
            }
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// SELLER endpoints
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Create a webinar (optionally as a draft via lifecycleStatus: 'draft')
// @route   POST /api/v1/webinars
// @access  Private/Seller
export const createWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.create({ ...req.body, seller: req.user.id });
        res.status(201).json({ success: true, data: webinar });
    } catch (error) {
        next(error);
    }
};

// @desc    Duplicate an existing webinar as a new draft (registrations/room/counters reset)
// @route   POST /api/v1/webinars/:id/duplicate
// @access  Private/Seller or Admin
export const duplicateWebinar = async (req, res, next) => {
    try {
        const source = await Webinar.findById(req.params.id);
        if (!source) return res.status(404).json({ message: 'Webinar not found' });

        if (source.seller.toString() !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const clone = source.toObject();
        delete clone._id;
        delete clone.createdAt;
        delete clone.updatedAt;
        delete clone.__v;
        // Must stay genuinely absent (not explicit null) — Webinar.roomName has a sparse
        // unique index, and an explicit null would collide with every other null-roomName doc.
        delete clone.roomName;

        Object.assign(clone, {
            name: `${source.name} (Copy)`,
            registeredUsers: [],
            waitlist: [],
            payments: [],
            registrationCount: 0,
            waitlistedCount: 0,
            attendedCount: 0,
            roomStatus: 'not_created',
            lifecycleStatus: 'draft',
            status: 'upcoming',
            cancellationReason: '',
            refundIssued: false,
        });

        const duplicate = await Webinar.create(clone);
        res.status(201).json({ success: true, data: duplicate });
    } catch (error) {
        next(error);
    }
};

// Auto-provisions the LiveKit room + WebinarSession on a transition to published — shared by
// publishWebinar and adminApproveWebinar (both move a webinar into 'published'). Failures here
// are logged but never block the caller's save — matches the existing interview-room
// degrade-gracefully guarantee (publish/approve succeeds, the room self-heals lazily on first
// join-token request).
async function provisionWebinarRoomIfNeeded(webinar) {
    if (webinar.roomName) return;
    try {
        webinar.roomName = `webinar-${webinar._id}`;
        const room = await createWebinarRoom(webinar.roomName);
        webinar.roomStatus = 'active';
        const session = await findOrCreateWebinarSession(webinar);
        session.roomSid = room?.sid || session.roomSid;
        session.roomStatus = 'active';
        await session.save();
    } catch (err) {
        console.error(`[Webinar] Room provisioning failed for ${webinar._id}:`, err.message);
        webinar.roomStatus = 'not_created';
    }
}

// @desc    Publish a draft/cancelled webinar — routes through moderation if platform
//          settings require it; otherwise goes live immediately
// @route   PATCH /api/v1/webinars/:id/publish
// @access  Private/Seller or Admin
export const publishWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        if (webinar.seller.toString() !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (webinar.lifecycleStatus === 'published') {
            return res.status(400).json({ message: 'Webinar is already published' });
        }

        const settings = await Settings.getSettings();
        // Admins publishing directly always bypass moderation — only seller-authored
        // publishes are gated, mirroring how every other admin override works in this codebase.
        const needsApproval = settings.webinar?.moderationRequiresApproval && !ADMIN_ROLES.includes(req.user.role);

        webinar.lifecycleStatus = needsApproval ? 'pending_approval' : 'published';

        if (!needsApproval) await provisionWebinarRoomIfNeeded(webinar);

        await webinar.save();

        res.status(200).json({
            success: true,
            message: needsApproval ? 'Submitted for admin approval.' : 'Webinar published.',
            data: webinar,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Revert a webinar to draft (only while it has no registrations yet)
// @route   PATCH /api/v1/webinars/:id/draft
// @access  Private/Seller or Admin
export const draftWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        if (webinar.seller.toString() !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (webinar.registeredUsers.length > 0 || webinar.waitlist.length > 0) {
            return res.status(400).json({ message: 'Cannot move a webinar back to draft once it has registrations. Cancel it instead.' });
        }

        webinar.lifecycleStatus = 'draft';
        await webinar.save();

        res.status(200).json({ success: true, data: webinar });
    } catch (error) {
        next(error);
    }
};

// @desc    Get seller's own webinars with full stats
// @route   GET /api/v1/webinars/seller/mine
// @access  Private/Seller
export const getMyWebinars = async (req, res, next) => {
    try {
        const webinars = await Webinar.find({ seller: req.user.id }).sort({ date: -1 });

        const enriched = webinars.map(w => {
            const computed = computeStatus(w);
            return {
                ...w.toJSON(),
                status: computed,
                revenue: w.payments.reduce((sum, p) => sum + (p.amount || 0), 0),
            };
        });

        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
        next(error);
    }
};

// @desc    Get attendee list for a seller's webinar
// @route   GET /api/v1/webinars/:id/attendees
// @access  Private/Seller
export const getAttendees = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id)
            .populate('registeredUsers', 'name email')
            .populate('waitlist', 'name email');

        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        if (webinar.seller.toString() !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // WebinarRegistration is the system of record from Phase 1 onward — fall back to the
        // legacy embedded arrays only for webinars that predate the cutover and were never
        // backfilled by scripts/migrateWebinarRegistrations.js.
        const registrations = await WebinarRegistration.find({ webinar: webinar._id })
            .populate('user', 'name email');

        if (registrations.length > 0) {
            return res.status(200).json({
                success: true,
                data: {
                    registeredUsers: registrations.filter(r => r.status === 'registered' || r.status === 'attended').map(r => ({
                        ...r.user.toObject(), registrationId: r._id, attendance: r.attendance, approvalStatus: r.approvalStatus,
                    })),
                    waitlist: registrations.filter(r => r.status === 'waitlisted').sort((a, b) => (a.waitlistPosition || 0) - (b.waitlistPosition || 0)).map(r => ({
                        ...r.user.toObject(), registrationId: r._id, waitlistPosition: r.waitlistPosition,
                    })),
                    seatCapacity: webinar.seatCapacity,
                    seatsLeft: webinar.seatsLeft,
                }
            });
        }

        res.status(200).json({
            success: true,
            data: {
                registeredUsers: webinar.registeredUsers,
                waitlist: webinar.waitlist,
                seatCapacity: webinar.seatCapacity,
                seatsLeft: webinar.seatsLeft
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update seller's own webinar
// @route   PUT /api/v1/webinars/:id
// @access  Private/Seller
export const updateWebinar = async (req, res, next) => {
    try {
        let webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        if (webinar.seller.toString() !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized to update this webinar' });
        }

        // Sellers cannot change price after registrations exist
        if (req.body.price !== undefined && webinar.registeredUsers.length > 0 && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(400).json({ message: 'Cannot change price after users have registered' });
        }

        webinar = await Webinar.findByIdAndUpdate(req.params.id, req.body, {
            new: true, runValidators: true
        });

        res.status(200).json({ success: true, data: webinar });
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel a webinar and refund all paid registrations
// @route   PATCH /api/v1/webinars/:id/cancel
// @access  Private/Seller or Admin
export const cancelWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        if (webinar.seller.toString() !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (webinar.status === 'cancelled') {
            return res.status(400).json({ message: 'Webinar is already cancelled' });
        }

        // Issue real Cashfree refunds for all paid registrations
        const paidRegistrations = webinar.payments.filter(p => p.amount > 0);
        const refundResults = await Promise.all(paidRegistrations.map(p => refundPayment({
            userId: p.user,
            type: 'webinar',
            itemId: webinar._id,
            amount: p.amount,
            note: `Refund: Webinar "${webinar.name}" was cancelled`,
        })));

        const failedRefunds = refundResults.filter(r => !r.success);
        if (failedRefunds.length > 0) {
            failedRefunds.forEach(r => console.error(`[Webinar] Refund failed during cancellation of ${webinar._id}:`, r.error.message));
        }

        webinar.status = 'cancelled';
        webinar.cancellationReason = req.body.reason || 'Cancelled by organizer';
        webinar.refundIssued = paidRegistrations.length > 0 && failedRefunds.length === 0;
        webinar.isActive = false;
        await webinar.save();

        // Notify everyone registered or waitlisted — best-effort, never blocks the response.
        const notifyIds = [...webinar.registeredUsers, ...webinar.waitlist];
        if (notifyIds.length > 0) {
            const { start } = getScheduleWindow(webinar);
            User.find({ _id: { $in: notifyIds } }).select('name email').then(recipients => {
                Promise.allSettled(recipients.map(recipient => sendCancellationNotice({
                    webinar, start, recipient, reason: webinar.cancellationReason,
                    refundNote: webinar.payments.some(p => p.user.toString() === recipient._id.toString())
                        ? 'A refund has been initiated to your original payment method.' : null,
                }))).catch(() => {});
            }).catch(err => console.error('[Webinar] Failed to load recipients for cancellation notice:', err.message));
        }

        let message = 'Webinar cancelled.';
        if (paidRegistrations.length > 0) {
            message += failedRefunds.length === 0
                ? ' Refunds have been initiated for all paid registrants.'
                : ` Refunds initiated for ${paidRegistrations.length - failedRefunds.length}/${paidRegistrations.length} paid registrants — the rest need manual follow-up.`;
        }

        res.status(200).json({ success: true, message, data: webinar });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a webinar
// @route   DELETE /api/v1/webinars/:id
// @access  Private/Seller or Admin
export const deleteWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        if (webinar.seller.toString() !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized to delete this webinar' });
        }

        if (webinar.registeredUsers.length > 0) {
            return res.status(400).json({ message: 'Cannot delete a webinar with registered users. Cancel it first.' });
        }

        await webinar.deleteOne();
        res.status(200).json({ success: true, message: 'Webinar deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Add a downloadable/pre-live resource to a webinar
// @route   POST /api/v1/webinars/:id/resources
// @access  Private/Seller or Admin
export const addResource = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        if (webinar.seller.toString() !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        webinar.resources.push({
            title: req.body.title || req.file.originalname,
            filePath: buildResourceFilePath(req.file),
            fileType: path.extname(req.file.originalname).replace('.', '').toLowerCase() || 'pdf',
            downloadable: req.body.downloadable !== undefined ? req.body.downloadable === 'true' || req.body.downloadable === true : (webinar.settings?.resources?.downloadableByDefault ?? true),
            visibleBeforeLive: req.body.visibleBeforeLive === 'true' || req.body.visibleBeforeLive === true,
        });
        await webinar.save();

        res.status(200).json({ success: true, data: webinar, message: 'Resource added' });
    } catch (error) {
        next(error);
    }
};

// @desc    Remove a resource from a webinar
// @route   DELETE /api/v1/webinars/:id/resources/:resourceId
// @access  Private/Seller or Admin
export const removeResource = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });

        if (webinar.seller.toString() !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        webinar.resources = webinar.resources.filter(r => r._id.toString() !== req.params.resourceId);
        await webinar.save();

        res.status(200).json({ success: true, data: webinar });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN endpoints
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Get ALL webinars for admin with full stats
// @route   GET /api/v1/admin/webinars
// @access  Private/Admin
export const adminGetAllWebinars = async (req, res, next) => {
    try {
        const webinars = await Webinar.find()
            .populate('seller', 'name email')
            .sort({ createdAt: -1 });

        const enriched = webinars.map(w => ({
            ...w.toJSON(),
            status: computeStatus(w),
            revenue: w.payments.reduce((sum, p) => sum + (p.amount || 0), 0),
        }));

        res.status(200).json({ success: true, count: enriched.length, data: enriched });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle fields (isActive, isFeatured, status, meetingLink, recordingUrl)
// @route   PATCH /api/v1/admin/webinars/:id/toggle
// @access  Private/Admin
export const adminToggleWebinar = async (req, res, next) => {
    try {
        const { field, value } = req.body;
        const allowed = ['isActive', 'isFeatured', 'status', 'meetingLink', 'recordingUrl'];
        if (!allowed.includes(field)) return res.status(400).json({ message: 'Invalid field' });

        const webinar = await Webinar.findByIdAndUpdate(
            req.params.id,
            { [field]: value },
            { new: true, runValidators: true }
        ).populate('seller', 'name email');

        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });
        res.status(200).json({ success: true, data: webinar });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin full update
// @route   PUT /api/v1/admin/webinars/:id
// @access  Private/Admin
export const adminUpdateWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findByIdAndUpdate(req.params.id, req.body, {
            new: true, runValidators: true
        }).populate('seller', 'name email');
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });
        res.status(200).json({ success: true, data: webinar });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin cancel with refunds
// @route   PATCH /api/v1/admin/webinars/:id/cancel
// @access  Private/Admin
export const adminCancelWebinar = cancelWebinar;   // reuse same logic

// @desc    Approve a webinar awaiting moderation review and publish it
// @route   PATCH /api/v1/admin/webinars/:id/approve
// @access  Private/Admin
export const adminApproveWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });
        if (webinar.lifecycleStatus !== 'pending_approval') {
            return res.status(400).json({ message: 'Only webinars pending approval can be approved' });
        }

        webinar.lifecycleStatus = 'published';
        await provisionWebinarRoomIfNeeded(webinar);
        await webinar.save();

        await logAudit({ actor: req.user._id, action: 'webinar.admin.approved', targetType: 'Webinar', targetId: webinar._id, req });

        res.status(200).json({ success: true, message: 'Webinar approved and published.', data: webinar });
    } catch (error) {
        next(error);
    }
};

// @desc    Reject a webinar awaiting moderation review — reverts it to draft
// @route   PATCH /api/v1/admin/webinars/:id/reject
// @access  Private/Admin
export const adminRejectWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });
        if (webinar.lifecycleStatus !== 'pending_approval') {
            return res.status(400).json({ message: 'Only webinars pending approval can be rejected' });
        }

        webinar.lifecycleStatus = 'draft';
        await webinar.save();

        await logAudit({ actor: req.user._id, action: 'webinar.admin.rejected', targetType: 'Webinar', targetId: webinar._id, metadata: { reason: req.body.reason || '' }, req });

        res.status(200).json({ success: true, message: 'Webinar rejected — reverted to draft.', data: webinar });
    } catch (error) {
        next(error);
    }
};

// @desc    Admin delete
// @route   DELETE /api/v1/admin/webinars/:id
// @access  Private/Admin
export const adminDeleteWebinar = async (req, res, next) => {
    try {
        const webinar = await Webinar.findById(req.params.id);
        if (!webinar) return res.status(404).json({ message: 'Webinar not found' });
        await webinar.deleteOne();
        res.status(200).json({ success: true, message: 'Webinar deleted by admin' });
    } catch (error) {
        next(error);
    }
};
