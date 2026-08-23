import mongoose from 'mongoose';

const webinarFeedbackSchema = new mongoose.Schema({
    webinar: { type: mongoose.Schema.Types.ObjectId, ref: 'Webinar', required: true, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'WebinarSession', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comments: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
});

webinarFeedbackSchema.index({ webinar: 1, user: 1 }, { unique: true });

const WebinarFeedback = mongoose.model('WebinarFeedback', webinarFeedbackSchema);
export default WebinarFeedback;
