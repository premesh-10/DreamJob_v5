import mongoose from 'mongoose';

/**
 * Enrollment — the source of truth for "is this user enrolled in this
 * course" and their learning progress. Layered alongside (not instead of)
 * Course.enrolledUsers, which is kept for backward compatibility — see
 * courseEnrollmentController.js. The unique compound index below is the
 * real fix for the double-enrollment race the old array-only check allowed.
 */
const enrollmentSchema = new mongoose.Schema({
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    source: {
        type: String,
        enum: ['purchase', 'subscription', 'free', 'owner', 'admin_grant'],
        required: true,
    },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    progress: {
        completedChapters: [{
            chapter: { type: mongoose.Schema.Types.ObjectId, required: true },
            completedAt: { type: Date, default: Date.now },
        }],
        lastAccessedChapter: { type: mongoose.Schema.Types.ObjectId, default: null },
        lastWatchedPosition: {
            chapter: { type: mongoose.Schema.Types.ObjectId, default: null },
            positionSeconds: { type: Number, default: 0 },
            updatedAt: { type: Date, default: null },
        },
        percentComplete: { type: Number, default: 0 },
        completedAt: { type: Date, default: null },
    },
    certificateEligible: { type: Boolean, default: false },
}, {
    timestamps: true,
});

enrollmentSchema.index({ course: 1, user: 1 }, { unique: true });
enrollmentSchema.index({ user: 1, status: 1 });
enrollmentSchema.index({ course: 1, status: 1 });

const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
export default Enrollment;
