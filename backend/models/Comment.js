import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    experience: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewExperience', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    likesCount: { type: Number, default: 0 },
    status: { type: String, enum: ['visible', 'removed'], default: 'visible' },
}, { timestamps: true });

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
