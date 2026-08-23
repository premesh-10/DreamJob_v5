import mongoose from 'mongoose';

// Admin-curated prep material linked to a company (optionally scoped to a job role).
// Internal resources point at existing collections via resourceType+resourceId;
// 'External' resources are just a label + URL (e.g. a blog post or YouTube video).
const linkedResourceSchema = new mongoose.Schema({
    resourceType: {
        type: String,
        enum: ['Course', 'PracticeTest', 'Interview', 'Webinar', 'External'],
        required: true
    },
    resourceId: { type: mongoose.Schema.Types.ObjectId, default: null }, // refPath resolved by resourceType
    title: { type: String, required: true },
    url: { type: String, default: '' }, // only for 'External'
    jobRole: { type: String, default: '' }, // optional scoping, e.g. "SDE-1"
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now }
});

const companySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true },
    logo: { type: String, default: '' },
    industry: { type: String, default: '' },
    website: { type: String, default: '' },
    description: { type: String, default: '' },
    // Alternate spellings users might type ("Google" vs "Google India") that should
    // resolve to this same company when matching on submission.
    aliases: [{ type: String, lowercase: true }],

    isVerified: { type: Boolean, default: false }, // admin has reviewed/cleaned this profile
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null if seeded by admin

    linkedResources: [linkedResourceSchema],

    // Cached aggregate stats — recomputed whenever an experience under this company
    // is created/updated/removed (see interviewExperienceController.recomputeCompanyStats).
    stats: {
        totalExperiences: { type: Number, default: 0 },
        selectedCount: { type: Number, default: 0 },
        rejectedCount: { type: Number, default: 0 },
        pendingCount: { type: Number, default: 0 },
        avgDifficulty: { type: Number, default: 0 },
        roundTypeCounts: { type: mongoose.Schema.Types.Mixed, default: {} }, // { "Technical Round": 12, ... }
    },
}, { timestamps: true });

companySchema.virtual('selectionRate').get(function () {
    if (!this.stats?.totalExperiences) return 0;
    const decided = this.stats.selectedCount + this.stats.rejectedCount;
    if (!decided) return 0;
    return Math.round((this.stats.selectedCount / decided) * 100);
});

companySchema.set('toJSON', { virtuals: true });
companySchema.set('toObject', { virtuals: true });

const Company = mongoose.model('Company', companySchema);
export default Company;
