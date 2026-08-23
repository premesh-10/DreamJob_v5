import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema({
    amount: { type: Number, required: true },            // amount seller requested
    approvedAmount: { type: Number, default: null },     // amount admin actually pays out (null = full)
    refundedToSeller: { type: Boolean, default: true },  // if false, the difference went to admin wallet
    status: {
        type: String,
        enum: ['initiated', 'approval_in_progress', 'completed', 'rejected'],
        default: 'initiated'
    },
    type: {
        type: String,
        enum: ['withdrawal', 'admin_adjustment'],
        default: 'withdrawal'
    },
    bankDetails: {
        accountName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        bankName: { type: String, default: '' },
        ifsc: { type: String, default: '' }
    },
    adminNote: { type: String, default: '' },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date }
});

const sellerSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['applied', 'verifying', 'approved', 'rejected'],
        default: 'applied'
    },
    contentType: {
        type: String,
        required: true
    },
    targetedCourse: {
        type: String
    },
    // Profile info
    bio: {
        type: String,
        default: ''
    },
    expertise: {
        type: [String],
        default: []
    },
    socialLinks: {
        linkedin: { type: String, default: '' },
        github: { type: String, default: '' },
        website: { type: String, default: '' }
    },
    // Stats (updated whenever a course is purchased or interview is booked)
    earnings: {
        type: Number,
        default: 0
    },
    totalStudents: {
        type: Number,
        default: 0
    },
    totalCourses: {
        type: Number,
        default: 0
    },
    // Withdrawal history
    withdrawals: [withdrawalSchema],

    // Interviewer verification — gates whether this seller's Interview profile
    // is publicly listed for booking. Separate from `status` (general seller
    // approval) since a seller can sell courses without being an approved interviewer.
    verification: {
        status: {
            type: String,
            enum: ['unverified', 'pending', 'verified', 'rejected'],
            default: 'unverified'
        },
        idDocumentPath: { type: String, default: null },
        submittedAt: { type: Date, default: null },
        verifiedAt: { type: Date, default: null },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        rejectionReason: { type: String, default: '' }
    }
}, {
    timestamps: true
});

const Seller = mongoose.model('Seller', sellerSchema);
export default Seller;
