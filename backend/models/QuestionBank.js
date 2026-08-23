import mongoose from 'mongoose';

// Answer-mechanic taxonomy for the assessment platform. MCQ/MSQ/TrueFalse/FillBlank/
// Subjective are auto-gradable or seller-graded; Coding/SQL/Debugging/OutputBased
// require code execution (Judge0). Aptitude/Logical Reasoning/Verbal/Case Studies from
// the product spec are SUBJECT DOMAINS, not separate answer mechanics — an aptitude
// question is still answered as MCQ/MSQ/FillBlank, so they live in PracticeTest.subject
// (see SUBJECTS in seller/PracticeTests.jsx) rather than here.
export const QUESTION_TYPES = [
    'MCQ', 'MSQ', 'TrueFalse', 'FillBlank', 'Subjective',
    'Coding', 'SQL', 'Debugging', 'OutputBased'
];

const optionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false }
}, { _id: true });

// One sample/hidden test case for Coding/SQL/Debugging/OutputBased questions.
// Hidden cases are stored here but must never be serialized to students or reports —
// every read path that can reach students/sellers-other-than-owner must strip them.
const testCaseSchema = new mongoose.Schema({
    input: { type: String, default: '' },
    expectedOutput: { type: String, default: '' },
    explanation: { type: String, default: '' }
}, { _id: true });

const codingProblemSchema = new mongoose.Schema({
    languages: [{ type: String }], // e.g. ['python3', 'javascript', 'java', 'cpp']
    starterCode: { type: Map, of: String, default: {} }, // language -> starter source
    sampleTestCases: [testCaseSchema], // visible to students
    hiddenTestCases: [testCaseSchema], // never sent to the client; pass/fail only
    scoringMode: { type: String, enum: ['all_or_nothing', 'proportional'], default: 'proportional' }
}, { _id: false });

const questionBankSchema = new mongoose.Schema({
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: QUESTION_TYPES, required: true },
    questionText: { type: String, required: true },
    image: { type: String, default: '' },

    // MCQ / MSQ / TrueFalse
    options: {
        type: [optionSchema],
        validate: {
            validator: function (v) {
                if (!['MCQ', 'MSQ', 'TrueFalse'].includes(this.type)) return true;
                return v.length >= 2 && v.length <= 6;
            },
            message: 'Questions must have between 2 and 6 options'
        }
    },

    // FillBlank
    acceptedAnswers: [{ type: String }], // case-insensitive/trimmed match against any entry

    // Subjective — guideline only, never auto-scored
    rubric: { type: String, default: '' },

    // Coding / Debugging / OutputBased
    codingProblem: { type: codingProblemSchema, default: undefined },

    // SQL
    sqlSchema: { type: String, default: '' }, // DDL + seed data text shown to the student

    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    skillTags: [{ type: String }],
    companyTags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
    roleTags: [{ type: String }],

    marks: { type: Number, default: 1 },
    negativeMarks: { type: Number, default: 0 },
    explanation: { type: String, default: '' },

    isApproved: { type: Boolean, default: false }, // admin moderation gate
    usageCount: { type: Number, default: 0 } // incremented when referenced by a published test
}, { timestamps: true });

questionBankSchema.index({ seller: 1, type: 1 });
questionBankSchema.index({ skillTags: 1 });
questionBankSchema.index({ companyTags: 1 });

const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);
export default QuestionBank;
