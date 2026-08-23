import mongoose from 'mongoose';

/**
 * CourseReview — dedicated course-review model, replacing the generic
 * Feedback{type:'course'} usage (which stays untouched for interview/
 * platform feedback). The unique compound index is the real fix for the
 * old check-then-create duplicate-review race condition.
 */
const courseReviewSchema = new mongoose.Schema({
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, minlength: 3 },
    helpfulVotes: { type: Number, default: 0 },
    instructorReply: {
        text: { type: String, default: '' },
        repliedAt: { type: Date, default: null },
    },
    isHidden: { type: Boolean, default: false },
    reportedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, {
    timestamps: true,
});

courseReviewSchema.index({ course: 1, user: 1 }, { unique: true });
courseReviewSchema.index({ course: 1, isHidden: 1, createdAt: -1 });

const CourseReview = mongoose.model('CourseReview', courseReviewSchema);
export default CourseReview;
