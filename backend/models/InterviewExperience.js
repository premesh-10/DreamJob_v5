import mongoose from 'mongoose';

const ROUND_TYPES = [
    'Online Assessment', 'Technical Round', 'Machine Coding', 'System Design',
    'Behavioral', 'HR', 'Final Round', 'Group Discussion', 'Custom'
];

export const roundSchema = new mongoose.Schema({
    order: { type: Number, default: 0 },
    roundType: { type: String, enum: ROUND_TYPES, required: true },
    customRoundType: { type: String, default: '' },
    questionsAsked: [{ type: String }],
    codingProblems: [{
        title: { type: String, required: true },
        description: { type: String, default: '' },
        link: { type: String, default: '' },
        difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    }],
    conceptsDiscussed: [{ type: String }],
    preparationTips: { type: String, default: '' },
});

const resourceLinkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    url: { type: String, required: true },
    description: { type: String, default: '' },
});

const interviewExperienceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    companyNameRaw: { type: String, required: true }, // as typed by the contributor, for display/audit

    jobRole: { type: String, required: true },
    experienceLevel: { type: String, enum: ['Internship', 'Fresher', 'Experienced'], required: true },
    interviewDate: { type: Date, required: true },
    interviewMode: { type: String, enum: ['Online', 'Offline'], default: 'Online' },
    applicationSource: {
        type: String,
        enum: ['LinkedIn', 'Referral', 'Company Website', 'Naukri', 'Indeed', 'Campus', 'Other'],
        default: 'Company Website'
    },
    sourceOther: { type: String, default: '' },
    result: { type: String, enum: ['Selected', 'Rejected', 'Pending'], required: true },
    // 1=Very Easy .. 5=Very Hard
    overallDifficulty: { type: Number, min: 1, max: 5, required: true },

    overallExperienceText: { type: String, required: true }, // narrative of the full process
    rounds: [roundSchema],

    resourcesShared: [resourceLinkSchema],
    mistakesToAvoid: { type: String, default: '' },
    adviceForFutureCandidates: { type: String, default: '' },

    acceptedTerms: { type: Boolean, required: true },

    status: {
        type: String,
        enum: ['published', 'under_review', 'removed'],
        default: 'published',
        index: true
    },
    isFeatured: { type: Boolean, default: false },

    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    bookmarksCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },

    tags: [{ type: String, index: true }], // derived from roundType/concepts for search
}, { timestamps: true });

interviewExperienceSchema.index({ companyNameRaw: 'text', jobRole: 'text', overallExperienceText: 'text' });

const InterviewExperience = mongoose.model('InterviewExperience', interviewExperienceSchema);
export default InterviewExperience;
