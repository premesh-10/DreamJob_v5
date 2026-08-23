import mongoose from 'mongoose';

const bookmarkSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    experience: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewExperience', required: true },
}, { timestamps: true });

bookmarkSchema.index({ user: 1, experience: 1 }, { unique: true });

const Bookmark = mongoose.model('Bookmark', bookmarkSchema);
export default Bookmark;
