import mongoose from 'mongoose';

// A Test Series bundles multiple existing PracticeTest docs into one
// purchasable/orderable prep package (e.g. "30-Day SDE Interview Prep").
// It never duplicates test content — just references PracticeTest by id, in
// a seller-defined order. Mirrors PracticeTest's pricing/schedule/publish
// shape so the seller authoring UI and admin moderation feel consistent.
const seriesTestRefSchema = new mongoose.Schema({
    practiceTest: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTest', required: true },
    order: { type: Number, default: 0 }
}, { _id: true });

const testSeriesSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, default: '' },
    tags: [{ type: String }],

    tests: [seriesTestRefSchema],

    assessmentCategory: {
        type: String,
        enum: ['Topic-wise', 'Company-wise', 'Role-wise', 'Skill-wise', 'Difficulty-wise', 'Full-length Mock', 'Company-Specific Pattern'],
        default: 'Topic-wise'
    },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    targetRole: { type: String, default: '' },

    // Model + UI only for v1 — real paywall enforcement (blocking attempt-start
    // on an unpaid series) is a deliberate fast-follow, not wired up yet.
    pricing: {
        isFree: { type: Boolean, default: true },
        price: { type: Number, default: 0 }
    },

    schedule: {
        availableFrom: { type: Date, default: null },
        availableUntil: { type: Date, default: null }
    },

    // Awarded once a student completes (passes) every test in the series —
    // reuses the same CertificateTemplate model as a single PracticeTest.
    certificate: {
        enabled: { type: Boolean, default: false },
        templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'CertificateTemplate', default: null }
    },

    isPublished: { type: Boolean, default: false }
}, { timestamps: true });

testSeriesSchema.index({ seller: 1, isPublished: 1 });

const TestSeries = mongoose.model('TestSeries', testSeriesSchema);
export default TestSeries;
