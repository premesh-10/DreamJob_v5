import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

const chapterSchema = new mongoose.Schema({
    title: { type: String, required: true },
    // Legacy URL support (kept for backward compatibility)
    videoUrl: { type: String, default: '' },
    // New: uploaded file paths (relative to server, e.g. /uploads/videos/...)
    videoPath: { type: String, default: '' },
    videoSize: { type: Number, default: 0 }, // bytes
    videoMimeType: { type: String, default: '' },
    // PDF per chapter
    pdfPath: { type: String, default: '' },
    pdfTitle: { type: String, default: '' },
    pdfSize: { type: Number, default: 0 },
    duration: { type: Number, default: 0 }, // in seconds
    order: { type: Number, required: true },
    isFree: { type: Boolean, default: false },
    description: { type: String, default: '' },
    approvalStatus: { type: String, enum: ['approved', 'pending_add', 'pending_delete'], default: 'approved' },
    // Async video-duration extraction (utils/jobQueue.js) — 'ready' by default
    // so non-video chapters and pre-existing chapters never show as stuck
    // "processing" after this field was introduced.
    processingStatus: { type: String, enum: ['queued', 'ready', 'failed'], default: 'ready' }
});

const resourceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    filePath: { type: String, required: true },
    fileType: { type: String, default: 'pdf' }, // pdf, doc, ppt, etc.
    fileSize: { type: Number, default: 0 }, // bytes
    uploadedAt: { type: Date, default: Date.now },
    approvalStatus: { type: String, enum: ['approved', 'pending_add', 'pending_delete'], default: 'approved' }
});

const courseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    thumbnail: {
        type: String,
        default: ''
    },
    thumbnailPath: { type: String, default: '' }, // local upload path
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    price: { type: Number, default: 0 },

    // ── Legacy lifecycle/moderation fields — kept for backward compatibility,
    // mirrored from status/moderation below via syncLegacyCourseFields().
    // Not removed; new code should read status/moderation instead. ─────────
    isPublished: { type: Boolean, default: false },
    approvalStatus: {
        type: String,
        enum: ['draft', 'pending', 'approved', 'rejected', 'pending_unpublish', 'pending_delete'],
        default: 'draft'
    },

    // ── New lifecycle/moderation model — the source of truth going forward.
    // Separates "is this live" (status) from "what's awaiting admin action"
    // (moderation), which the single legacy enum above conflated. ──────────
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    moderation: {
        pending: { type: String, enum: ['none', 'publish', 'unpublish', 'delete', 'edit'], default: 'none' },
        rejectionReason: { type: String, default: '' },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        reviewedAt: { type: Date, default: null },
    },

    // Denormalized counter — the scalable replacement for sorting/displaying
    // by enrolledUsers.length (sorting by an array field doesn't work in
    // MongoDB). Maintained via atomic $inc only. enrolledUsers itself is
    // kept below for backward compatibility, not removed.
    enrollmentCount: { type: Number, default: 0 },

    // ── Multi-level support ────────────────────────────────────────────────────
    level: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced'],
        default: 'Beginner'
    },
    levels: {
        type: [String],
        enum: ['Beginner', 'Intermediate', 'Advanced'],
        default: ['Beginner']
    },
    // ──────────────────────────────────────────────────────────────────────────

    language: { type: String, default: 'English' },
    chapters: [chapterSchema],

    // Downloadable resources (PDFs, slides, etc.) for the whole course
    resources: [resourceSchema],

    // Linked Practice Tests
    practiceTests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTest' }],

    // Kept for backward compatibility (still pushed to on enroll) — Enrollment
    // is the new, scalable source of truth for access/progress. Not removed
    // since other reads may still depend on it.
    enrolledUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Ratings (aggregate)
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },

    // What students will learn (bullet points)
    whatYoullLearn: [{ type: String }],
    requirements: [{ type: String }],

    // Estimated duration in hours
    totalDuration: { type: Number, default: 0 },

    // Completion certificate config — seller opts-in per course
    certificate: {
        enabled: { type: Boolean, default: false },
        templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'CertificateTemplate', default: null },
    },

}, { timestamps: true });

courseSchema.index({ seller: 1, status: 1 });
courseSchema.index({ status: 1, category: 1 });
courseSchema.index({ status: 1, createdAt: -1 });
courseSchema.index({ 'moderation.pending': 1 });
// `language_override` must be repointed away from MongoDB's default field
// name 'language' — Course already has an unrelated `language` field (the
// course's spoken language, e.g. "Telugu"), which MongoDB's text index would
// otherwise try to use as a stemming-language override and fail on, since
// it isn't one of MongoDB's supported text-search languages.
courseSchema.index(
    { title: 'text', description: 'text', category: 'text' },
    { default_language: 'english', language_override: 'textIndexLanguage' }
);

// Explicit helper (called from controllers, not a pre-save hook, so
// create/update flows stay easy to test) — slugifies the title, appending
// -2, -3, ... on collision.
courseSchema.statics.generateUniqueSlug = async function (title, excludeId = null) {
    const base = slugify(title);
    let slug = base;
    let suffix = 2;
    // eslint-disable-next-line no-await-in-loop
    while (await this.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
        slug = `${base}-${suffix++}`;
    }
    return slug;
};

// Auto-sync legacy fields on every save that touches status/moderation,
// so no controller can accidentally skip the call.
courseSchema.pre('save', function () {
    if (this.isModified('status') || this.isModified('moderation')) {
        syncLegacyCourseFields(this);
    }
});

/**
 * syncLegacyCourseFields — mirrors the new status/moderation fields onto the
 * legacy isPublished/approvalStatus fields, using the same mapping the
 * one-time migration script used. Call this any time status/moderation
 * changes, so code that still reads the legacy fields keeps getting correct
 * values. Mutates the passed document in place; caller is responsible for
 * saving it.
 */
export function syncLegacyCourseFields(course) {
    course.isPublished = course.status === 'published';

    if (course.status === 'archived') {
        course.approvalStatus = 'draft'; // no legacy equivalent existed for archived
        return;
    }

    const pending = course.moderation?.pending || 'none';
    const hasRejection = !!course.moderation?.rejectionReason;

    if (pending === 'publish') course.approvalStatus = 'pending';
    else if (pending === 'unpublish') course.approvalStatus = 'pending_unpublish';
    else if (pending === 'delete') course.approvalStatus = 'pending_delete';
    else if (hasRejection) course.approvalStatus = 'rejected';
    else course.approvalStatus = course.status === 'published' ? 'approved' : 'draft';
}

const Course = mongoose.model('Course', courseSchema);
export default Course;
