import mongoose from 'mongoose';

// Admin-managed course category taxonomy — replaces the previously
// hardcoded frontend list. Course.category stays a plain String (validated
// against this collection at the controller layer) rather than an ObjectId
// ref, to avoid populate() everywhere for what is fundamentally a label.
const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
}, {
    timestamps: true,
});

categorySchema.index({ isActive: 1, order: 1 });

const Category = mongoose.model('Category', categorySchema);
export default Category;
