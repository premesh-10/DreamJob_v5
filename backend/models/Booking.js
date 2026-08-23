import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Type of booking — interview or course purchase
    type: {
        type: String,
        enum: ['interview', 'course'],
        default: 'interview'
    },
    // For interview bookings
    interview: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interview'
    },
    slot: {
        type: mongoose.Schema.Types.ObjectId
    },
    // For course bookings
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    },
    // The seller who receives the payment
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    enrollmentType: {
        type: String,
        enum: ['subscription', 'purchase'],
        default: 'purchase'
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
        default: 'confirmed'
    },
    meetingLink: {
        type: String
    },
    // Back-reference to the LiveKit operational record for this booking
    // (set once at session-creation time) — avoids an extra query on every
    // bookings-list fetch.
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InterviewSession',
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'free'],
        default: 'paid'
    },
    amountPaid: {
        type: Number,
        default: 0
    },
    rating: {
        type: Number,
        default: 0
    },

    // Denormalized copy of PaymentOrder.orderId — set once at fulfilment, immutable.
    // Stored here so bookings-list queries never need a join to surface the Order ID.
    orderId: {
        type: String,
        default: null,
        index: true,
        sparse: true,
    },
}, {
    timestamps: true
});

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
