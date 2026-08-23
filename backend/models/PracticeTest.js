import mongoose from 'mongoose';
import { QUESTION_TYPES } from './QuestionBank.js';

// ── Option Schema ─────────────────────────────────────────────────────────────
const optionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false }
}, { _id: true });

// ── Question Schema (legacy inline-mode; maintenance-only — new content should be
// authored via QuestionBank + sections instead, see below) ─────────────────────
const questionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    type: {
        type: String,
        enum: QUESTION_TYPES, // widened for symmetry with QuestionBank; inline UI still only adds MCQ/MSQ
        required: true
    },
    options: {
        type: [optionSchema],
        validate: {
            validator: function (v) { return v.length >= 2 && v.length <= 5; },
            message: 'Questions must have between 2 and 5 options'
        }
    },
    // Per-question timer (seller-configurable, 0 = no timer)
    timeLimit: { type: Number, default: 0 }, // seconds; 0 = no per-question timer
    explanation: { type: String, default: '' }, // shown after answering
    marks: { type: Number, default: 1 },
    order: { type: Number, default: 0 },
    image: { type: String, default: '' } // optional question image path
}, { _id: true });

// ── Answer Schema (within attempt) ───────────────────────────────────────────
const answerSchema = new mongoose.Schema({
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    selectedOptions: [{ type: mongoose.Schema.Types.ObjectId }], // option _ids selected
    isCorrect: { type: Boolean, default: false },
    timeTaken: { type: Number, default: 0 }, // seconds taken for this question
    marksAwarded: { type: Number, default: 0 }
}, { _id: false });

// ── Section Schema (new question-bank-backed authoring path) ──────────────────
// A test with sections.length > 0 is in "section mode" and is rendered/scored by
// resolving questionRefs against QuestionBank. A test with sections === [] is in
// legacy "flat mode" and keeps using the inline questions[] field above untouched.
const questionRefSchema = new mongoose.Schema({
    questionBank: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank', required: true },
    overrideMarks: { type: Number, default: null }, // null = use QuestionBank.marks
    overrideNegativeMarks: { type: Number, default: null },
    order: { type: Number, default: 0 }
}, { _id: true });

const sectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    timeLimit: { type: Number, default: 0 }, // minutes; 0 = no section-wise timer
    questionRefs: [questionRefSchema],
    questionSelectionMode: { type: String, enum: ['fixed', 'random'], default: 'fixed' },
    randomCount: { type: Number, default: 0 }, // used when questionSelectionMode === 'random'
    randomFromTags: [{ type: String }] // skillTags to sample from when selection is random
}, { _id: true });

// ── Attempt Schema (embedded) ─────────────────────────────────────────────────
const attemptSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    attemptNumber: { type: Number, default: 1 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    answers: [answerSchema],
    timeTaken: { type: Number, default: 0 } // total seconds taken
}, { _id: true, timestamps: false });

// ── Practice Test Schema ──────────────────────────────────────────────────────
const practiceTestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, required: true },
    description: { type: String, default: '' },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Optional link to a course
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    
    // Tags for discoverability
    tags: [{ type: String }],
    
    // ── Timer Settings (all seller-configurable) ───────────────────────────
    // Overall test timer (0 = no overall timer)
    timeLimit: { type: Number, default: 0 }, // minutes; 0 = unlimited
    // Whether questions have individual timers (controlled per-question in questionSchema)
    hasPerQuestionTimer: { type: Boolean, default: false },
    
    // ── Re-take Policy ────────────────────────────────────────────────────
    // 0 = unlimited re-takes
    maxAttempts: { type: Number, default: 0 }, // 0 = unlimited
    
    // ── Scoring ───────────────────────────────────────────────────────────
    passingScore: { type: Number, default: 60 }, // percentage
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    showResultsImmediately: { type: Boolean, default: true },
    
    // ── Status ────────────────────────────────────────────────────────────
    isPublished: { type: Boolean, default: false },
    
    // ── Content ───────────────────────────────────────────────────────────
    // Legacy inline questions (flat mode). New tests should use sections below.
    questions: [questionSchema],

    // Section-based content (question-bank-backed). Empty array = legacy flat mode.
    sections: [sectionSchema],

    // ── Classification (topic-wise / company-wise / role-wise / etc.) ──────
    assessmentCategory: {
        type: String,
        enum: ['Topic-wise', 'Company-wise', 'Role-wise', 'Skill-wise', 'Difficulty-wise', 'Full-length Mock', 'Company-Specific Pattern'],
        default: 'Topic-wise'
    },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    targetRole: { type: String, default: '' },

    // ── Negative marking (platform default; per-question override lives on QuestionBank) ──
    negativeMarking: {
        enabled: { type: Boolean, default: false },
        perWrongAnswer: { type: Number, default: 0 }
    },

    // ── Security & proctoring config — all default to today's actual (unrestricted) behavior ──
    security: {
        allowTabSwitch: { type: Boolean, default: true },
        maxTabSwitches: { type: Number, default: 0 }, // 0 = unlimited
        onLimitExceeded: { type: String, enum: ['warn_only', 'auto_submit', 'terminate'], default: 'warn_only' },
        requireFullscreen: { type: Boolean, default: false },
        disableCopyPaste: { type: Boolean, default: false },
        disableRightClick: { type: Boolean, default: false },
        disableTextSelection: { type: Boolean, default: false },
        proctoringEnabled: { type: Boolean, default: false },
        proctoringDisclosureText: { type: String, default: '' },
        // If false (default), downloadable/online reports never include question/answer
        // content — only the Seller/Administrator can opt a test into revealing them.
        revealAnswersInReport: { type: Boolean, default: false }
    },

    // ── Certificate ──────────────────────────────────────────────────────
    certificate: {
        enabled: { type: Boolean, default: false },
        templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'CertificateTemplate', default: null },
        minScoreForCertificate: { type: Number, default: 0 } // percentage
    },

    // ── Pricing (model + UI only for v1; paywall enforcement is a fast-follow) ──
    pricing: {
        isFree: { type: Boolean, default: true },
        price: { type: Number, default: 0 }
    },

    // ── Scheduling window ────────────────────────────────────────────────
    schedule: {
        availableFrom: { type: Date, default: null },
        availableUntil: { type: Date, default: null }
    },

    allowResume: { type: Boolean, default: true },
    allowCalculator: { type: Boolean, default: false },

    // Embedded attempts (for quick stats; full attempts in PracticeTestAttempt collection)
    // We store only summary attempts here for performance

    // ── Stats (denormalized for quick display) ─────────────────────────────
    totalAttempts: { type: Number, default: 0 },
    avgScore: { type: Number, default: 0 },
    passRate: { type: Number, default: 0 } // percentage

}, { timestamps: true });

// Virtual: total marks
practiceTestSchema.virtual('totalMarks').get(function () {
    return this.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
});

const PracticeTest = mongoose.model('PracticeTest', practiceTestSchema);
export default PracticeTest;
