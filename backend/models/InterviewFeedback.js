import mongoose from 'mongoose';

// Structured two-sided post-interview evaluation. Distinct from the older
// single 1-5 `Booking.rating` / `Feedback` (type:'interview'), which remain
// untouched for backward-compatible aggregate display.
const interviewFeedbackSchema = new mongoose.Schema({
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['interviewer', 'candidate'], required: true },

    // Interviewer evaluating the candidate
    technicalRating: { type: Number, min: 1, max: 5, default: null },
    communicationRating: { type: Number, min: 1, max: 5, default: null },
    problemSolvingRating: { type: Number, min: 1, max: 5, default: null },
    overallRating: { type: Number, min: 1, max: 5, required: true },
    recommendation: { type: String, enum: ['strong_yes', 'yes', 'maybe', 'no', 'strong_no', null], default: null },
    comments: { type: String, default: '' },

    // Candidate evaluating the interviewer / session
    issueReported: { type: Boolean, default: false },
    issueDescription: { type: String, default: '' },
}, {
    timestamps: true
});

const InterviewFeedback = mongoose.model('InterviewFeedback', interviewFeedbackSchema);
export default InterviewFeedback;
