import Interview from '../models/Interview.js';
import Booking from '../models/Booking.js';
import Seller from '../models/Seller.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Settings from '../models/Settings.js';
import { createSessionForBooking } from '../utils/interviewSessionLifecycle.js';
import { applyRatingUpdate } from '../utils/interviewRating.js';

// @desc    Get all interview profiles (public listing)
// @route   GET /api/v1/interviews
// @access  Public
export const getInterviews = async (req, res, next) => {
    try {
        const { domain } = req.query;
        let query = {};
        if (domain) query.domain = { $regex: domain, $options: 'i' };

        // Only show interviewers who have completed identity verification —
        // no KYC infra exists, so this is the lightweight document-based gate
        // (see Seller.verification, approved via the admin console).
        const verifiedInterviewerIds = await Seller.find({ 'verification.status': 'verified' }).distinct('user');
        query.interviewer = { $in: verifiedInterviewerIds };

        const interviews = await Interview.find(query)
            .populate('interviewer', 'name experience qualification');

        // Hide slots that have already passed and were never booked — an expired
        // unbooked slot is no longer something a candidate can actually book.
        // Booked slots stay visible (they reflect a real, already-confirmed session).
        const now = new Date();
        const visibleInterviews = interviews.map(interview => {
            const obj = interview.toObject();
            obj.slots = obj.slots.filter(s => s.isBooked || new Date(s.startTime) > now);
            return obj;
        });

        res.status(200).json({
            success: true,
            count: visibleInterviews.length,
            data: visibleInterviews
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get the seller's own interview profile
// @route   GET /api/v1/interviews/mine
// @access  Private/Seller
export const getMyInterviewProfile = async (req, res, next) => {
    try {
        const interview = await Interview.findOne({ interviewer: req.user.id });
        res.status(200).json({
            success: true,
            data: interview || null
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create/Update Interview Profile (Seller)
// @route   POST /api/v1/interviews
// @access  Private/Seller
export const createOrUpdateInterviewProfile = async (req, res, next) => {
    try {
        const { domain, price, meetingMode } = req.body;

        let interview = await Interview.findOne({ interviewer: req.user.id });

        if (interview) {
            interview.domain = domain || interview.domain;
            interview.price = price !== undefined ? price : interview.price;
            interview.meetingMode = meetingMode || interview.meetingMode;
            await interview.save();
        } else {
            interview = await Interview.create({
                interviewer: req.user.id,
                domain,
                price,
                meetingMode
            });
        }

        res.status(200).json({
            success: true,
            data: interview
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add slot to interview profile — a LiveKit video room is auto-created
//          for each booking made against this slot, no manual link needed.
// @route   POST /api/v1/interviews/slots
// @access  Private/Seller
export const addSlot = async (req, res, next) => {
    try {
        const { startTime, endTime } = req.body;

        if (!startTime || !endTime) {
            return res.status(400).json({ message: 'Start time and end time are required' });
        }
        if (new Date(endTime) <= new Date(startTime)) {
            return res.status(400).json({ message: 'End time must be after start time' });
        }

        const interview = await Interview.findOne({ interviewer: req.user.id });
        if (!interview) {
            return res.status(404).json({ message: 'Interview profile not found. Please create your profile first.' });
        }

        interview.slots.push({ startTime, endTime });
        await interview.save();

        res.status(200).json({
            success: true,
            data: interview
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a slot from interview profile
// @route   DELETE /api/v1/interviews/slots/:slotId
// @access  Private/Seller
export const deleteSlot = async (req, res, next) => {
    try {
        const interview = await Interview.findOne({ interviewer: req.user.id });
        if (!interview) return res.status(404).json({ message: 'Interview profile not found' });

        const slot = interview.slots.id(req.params.slotId);
        if (!slot) return res.status(404).json({ message: 'Slot not found' });
        if (slot.isBooked) {
            return res.status(400).json({
                message: 'This slot has a confirmed booking and cannot be deleted directly. Cancel the booking first (which frees the slot and handles any refund), then delete it.',
            });
        }

        interview.slots.pull({ _id: req.params.slotId });
        await interview.save();

        res.status(200).json({ success: true, data: interview });
    } catch (error) {
        next(error);
    }
};

// @desc    Book a slot (User)
// @route   POST /api/v1/interviews/:id/book
// @access  Private
export const bookSlot = async (req, res, next) => {
    try {
        const { slotId } = req.body;
        const interviewId = req.params.id;

        const interview = await Interview.findById(interviewId).populate('interviewer', 'name _id');
        if (!interview) return res.status(404).json({ message: 'Interview not found' });

        const slot = interview.slots.id(slotId);
        if (!slot) return res.status(404).json({ message: 'Slot not found' });

        if (slot.isBooked) return res.status(400).json({ message: 'This slot is already booked' });
        if (new Date(slot.startTime) <= new Date()) {
            return res.status(400).json({ message: 'This slot has already passed and can no longer be booked' });
        }

        const user = await User.findById(req.user.id);

        if (!user.acceptedInterviewGuidelinesAt) {
            if (!req.body.acceptGuidelines) {
                return res.status(400).json({
                    message: 'You must agree to the Interview Conduct Guidelines before booking',
                    requiresGuidelinesAcceptance: true,
                });
            }
            user.acceptedInterviewGuidelinesAt = new Date();
            await user.save();
        }

        let amountPaid = 0;
        let paymentStatus = 'free';

        // Price is always taken from the DB, never the client — this endpoint only
        // ever handles genuinely free slots. Any priced slot (subscriber or not)
        // must go through Cashfree checkout, where the subscription discount (if
        // any) is applied server-side.
        if (interview.price > 0) {
            return res.status(400).json({
                message: 'Paid interviews must be booked via the payment gateway.',
                requiresPayment: true,
                amount: interview.price,
            });
        }
        amountPaid = 0;
        paymentStatus = 'free';

        // Atomically claim the slot — prevents two concurrent requests from both
        // passing the `slot.isBooked` check above and double-booking the same slot.
        const claimed = await Interview.findOneAndUpdate(
            { _id: interviewId, 'slots._id': slotId, 'slots.isBooked': false },
            { $set: { 'slots.$.isBooked': true } }
        );
        if (!claimed) {
            return res.status(409).json({ message: 'This slot was just booked by someone else. Please pick another slot.' });
        }

        let booking;
        try {
            booking = await Booking.create({
                user: req.user.id,
                type: 'interview',
                interview: interviewId,
                slot: slotId,
                seller: interview.interviewer._id,
                amountPaid,
                paymentStatus,
                status: 'confirmed'
            });

            await createSessionForBooking(booking, slot);
        } catch (err) {
            // The slot was already atomically claimed above — if creating the
            // booking/session fails, release the claim instead of leaving the
            // slot permanently locked with nothing booked against it.
            await Interview.updateOne(
                { _id: interviewId, 'slots._id': slotId },
                { $set: { 'slots.$.isBooked': false } }
            );
            if (booking) await Booking.findByIdAndDelete(booking._id);
            throw err;
        }

        res.status(201).json({
            success: true,
            data: booking
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Rate an interviewer (after booking)
// @route   POST /api/v1/interviews/:id/rate
// @access  Private
export const rateInterview = async (req, res, next) => {
    try {
        const { rating } = req.body; // 1-5
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        // Check user has a confirmed booking for this interview
        const booking = await Booking.findOne({
            user: req.user.id,
            interview: req.params.id,
            type: 'interview',
            status: { $in: ['confirmed', 'completed'] }
        });
        if (!booking) {
            return res.status(403).json({ message: 'You can only rate interviews you have booked' });
        }

        const interview = await Interview.findById(req.params.id);
        if (!interview) return res.status(404).json({ message: 'Interview not found' });

        applyRatingUpdate(interview, booking, rating);

        await interview.save();
        await booking.save();

        res.status(200).json({
            success: true,
            message: 'Rating submitted successfully',
            data: { rating: interview.ratings, totalReviews: interview.totalReviews }
        });
    } catch (error) {
        next(error);
    }
};

// Lazy status transition for interview bookings — a stop-gap until Phase 5's
// webhook-driven attendance fully replaces it. 'in-progress' is purely a
// time-window UX signal; 'completed' only fires after the no-show grace
// period so it doesn't race ahead of real attendance/completion-workflow data.
async function applyLazyInterviewStatusTransition(bookings) {
    const hasInterviewBookings = bookings.some(b => b.type === 'interview');
    if (!hasInterviewBookings) return;

    const settings = await Settings.getSettings();
    const now = new Date();
    for (const booking of bookings) {
        if (booking.type === 'interview' && (booking.status === 'confirmed' || booking.status === 'in-progress') && booking.interview && booking.interview.slots) {
            const slot = booking.interview.slots.find(s => s._id.toString() === booking.slot.toString());
            if (slot) {
                const start = new Date(slot.startTime);
                const end = new Date(slot.endTime);
                const gracedEnd = new Date(end.getTime() + settings.noShowGraceMinutes * 60000);
                if (now > gracedEnd && booking.status !== 'completed') {
                    booking.status = 'completed';
                    await booking.save();
                } else if (now >= start && now <= end && booking.status !== 'in-progress') {
                    booking.status = 'in-progress';
                    await booking.save();
                }
            }
        }
    }
}

// @desc    Get my bookings (User — interview + course)
// @route   GET /api/v1/interviews/bookings/me
// @access  Private
export const getMyBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find({ user: req.user.id })
            .populate({
                path: 'interview',
                populate: { path: 'interviewer', select: 'name' }
            })
            .populate('course', 'title thumbnail price category level')
            .populate('seller', 'name')
            .populate('session', 'roomStatus completionStatus scheduledStart scheduledEnd')
            .sort({ createdAt: -1 });

        await applyLazyInterviewStatusTransition(bookings);

        res.status(200).json({
            success: true,
            data: bookings
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get bookings for the seller's own interviews + course sales
// @route   GET /api/v1/interviews/bookings/seller
// @access  Private/Seller
export const getSellerBookings = async (req, res, next) => {
    try {
        const bookings = await Booking.find({ 
            seller: req.user.id,
            user: { $ne: req.user.id }
        })
            .populate('user', 'name email')
            .populate({
                path: 'interview',
                select: 'domain price meetingMode slots'
            })
            .populate('course', 'title price thumbnail')
            .populate('session', 'roomStatus completionStatus scheduledStart scheduledEnd')
            .sort({ createdAt: -1 });

        await applyLazyInterviewStatusTransition(bookings);

        res.status(200).json({
            success: true,
            data: bookings
        });
    } catch (error) {
        next(error);
    }
};
