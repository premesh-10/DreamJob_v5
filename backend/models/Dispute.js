import mongoose from 'mongoose';

// Booking-dispute model — kept separate from the community-content `Report`
// model since the shape (refund amounts, fault determination, session/
// recording linkage) doesn't fit Report's simpler moderation contract.
const disputeSchema = new mongoose.Schema({
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    raisedByRole: { type: String, enum: ['candidate', 'interviewer'], required: true },
    against: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
        type: String,
        enum: ['no_show', 'technical_issue', 'conduct', 'quality', 'billing', 'other'],
        required: true,
    },
    description: { type: String, required: true },
    requestedResolution: { type: String, enum: ['refund', 'reschedule', 'warning', 'none'], default: 'refund' },
    status: { type: String, enum: ['pending', 'under_review', 'resolved', 'dismissed'], default: 'pending', index: true },
    resolution: {
        faultDetermination: { type: String, enum: ['interviewer', 'candidate', 'platform', 'none', 'unresolved'], default: 'unresolved' },
        refundAmount: { type: Number, default: 0 },
        refundIssued: { type: Boolean, default: false },
        note: { type: String, default: '' },
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        resolvedAt: { type: Date, default: null },
    },
}, {
    timestamps: true
});

const Dispute = mongoose.model('Dispute', disputeSchema);
export default Dispute;
