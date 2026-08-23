import mongoose from 'mongoose';
import { QUESTION_TYPES } from './QuestionBank.js';

// One test-case result for a Coding/SQL/Debugging/OutputBased answer. Hidden-case
// stdout/expected-output is intentionally NOT stored here — only pass/fail — so
// there is nothing to leak even if a report code path had a bug.
const testCaseResultSchema = new mongoose.Schema({
    passed: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false }
}, { _id: false });

const codeSubmissionSchema = new mongoose.Schema({
    language: { type: String, default: '' },
    code: { type: String, default: '' },
    judge0Token: { type: String, default: '' },
    stdout: { type: String, default: '' }, // sample-case output only
    stderr: { type: String, default: '' },
    status: { type: String, default: '' }, // e.g. 'Accepted', 'Wrong Answer', 'Runtime Error'
    executionTimeMs: { type: Number, default: 0 },
    memoryKb: { type: Number, default: 0 },
    testCaseResults: [testCaseResultSchema]
}, { _id: false });

// Detailed attempt record stored in a separate collection for scalability
const attemptAnswerSchema = new mongoose.Schema({
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    questionText: { type: String }, // snapshot at time of attempt
    type: { type: String, enum: QUESTION_TYPES },
    selectedOptions: [{ type: mongoose.Schema.Types.ObjectId }],
    correctOptions: [{ type: mongoose.Schema.Types.ObjectId }], // snapshot
    isCorrect: { type: Boolean, default: false },
    timeTaken: { type: Number, default: 0 }, // seconds
    marksAwarded: { type: Number, default: 0 },
    marksAvailable: { type: Number, default: 1 },
    negativeMarksDeducted: { type: Number, default: 0 },

    // FillBlank / Subjective
    fillBlankAnswerText: { type: String, default: '' },
    subjectiveAnswerText: { type: String, default: '' },
    pendingManualGrading: { type: Boolean, default: false },
    gradingFeedback: { type: String, default: '' },

    // Coding / SQL / Debugging / OutputBased
    codeSubmission: { type: codeSubmissionSchema, default: undefined }
}, { _id: false });

// One tab-switch / fullscreen-exit / copy-paste / devtools-heuristic violation event.
const violationEventSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const copyPasteAttemptSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    type: { type: String, enum: ['copy', 'cut', 'paste', 'rightclick'], required: true }
}, { _id: false });

const tabSwitchEventSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    action: { type: String, enum: ['switch_away', 'switch_back'], required: true }
}, { _id: false });

const practiceTestAttemptSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    practiceTest: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTest', required: true },
    attemptNumber: { type: Number, default: 1 },
    
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    
    // Scoring
    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    
    // Time taken in seconds
    timeTaken: { type: Number, default: 0 },

    // Per-section time taken (section-mode tests only)
    sectionTimings: [{
        sectionId: { type: mongoose.Schema.Types.ObjectId },
        timeTaken: { type: Number, default: 0 }
    }],

    negativeMarksDeducted: { type: Number, default: 0 },

    // Detailed answers
    answers: [attemptAnswerSchema],

    // Bookmarking / mark-for-review — persisted server-side so resume restores them
    bookmarkedQuestionIds: [{ type: mongoose.Schema.Types.ObjectId }],
    markedForReviewIds: [{ type: mongoose.Schema.Types.ObjectId }],
    lastAutoSavedAt: { type: Date, default: null },

    // Raw, unscored in-progress answer state from the last autosave — separate from
    // the final scored `answers[]` (which only exists after submit). Shape mirrors
    // whatever the client posts (varies per question type), so kept schemaless.
    draftAnswers: { type: mongoose.Schema.Types.Mixed, default: [] },

    // The exact question set shown to the student at attempt-start time (section-mode
    // tests only). Fixed here so random/shuffled selection is reproducible at submit
    // time and on resume, instead of being re-randomized.
    presentedQuestions: [{
        sectionId: { type: mongoose.Schema.Types.ObjectId },
        questionBank: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' },
        marks: { type: Number, default: 1 },
        negativeMarks: { type: Number, default: 0 },
        order: { type: Number, default: 0 }
    }],

    // ── Proctoring / security violation log ─────────────────────────────────
    proctoring: {
        tabSwitchEvents: [tabSwitchEventSchema],
        fullscreenExitEvents: [violationEventSchema],
        copyPasteAttempts: [copyPasteAttemptSchema],
        devtoolsHeuristicTriggers: [violationEventSchema],
        focusLostDurationMs: { type: Number, default: 0 },
        autoSubmittedDueToViolation: { type: Boolean, default: false },
        terminatedDueToViolation: { type: Boolean, default: false }
    },

    // Status
    status: {
        type: String,
        enum: ['in_progress', 'completed', 'timed_out', 'abandoned'],
        default: 'in_progress'
    }
}, { timestamps: true });

const PracticeTestAttempt = mongoose.model('PracticeTestAttempt', practiceTestAttemptSchema);
export default PracticeTestAttempt;
