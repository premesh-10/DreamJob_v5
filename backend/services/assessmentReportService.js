import QuestionBank from '../models/QuestionBank.js';
import PracticeTestAttempt from '../models/PracticeTestAttempt.js';

const OPTION_BACKED_TYPES = ['MCQ', 'MSQ', 'TrueFalse'];
const EXECUTION_TYPES = ['Coding', 'SQL', 'Debugging', 'OutputBased'];

// Sole place in the codebase allowed to shape report-facing answer data. The
// hard rule: a downloadable/viewable report must never contain question text,
// answer options, hidden test cases, or correct answers unless the test's
// `security.revealAnswersInReport` flag is explicitly set by the Seller/Admin.
// That check happens HERE, before any answer-bearing field is read off the
// question doc — never as a later filter on an already-built payload.
// Hidden test case content is never included by this function regardless of
// the reveal flag — there is no flag that exposes it.
function buildQuestionResult(answer, questionDoc, reveal) {
    const base = {
        _id: answer.questionId,
        type: answer.type,
        isCorrect: answer.isCorrect,
        marksAwarded: answer.marksAwarded,
        marksAvailable: answer.marksAvailable,
        negativeMarksDeducted: answer.negativeMarksDeducted || 0,
        timeTaken: answer.timeTaken || 0
    };

    if (EXECUTION_TYPES.includes(answer.type) && answer.codeSubmission) {
        base.language = answer.codeSubmission.language;
        base.status = answer.codeSubmission.status;
        base.passedCount = answer.codeSubmission.testCaseResults?.filter(t => t.passed).length || 0;
        base.totalCount = answer.codeSubmission.testCaseResults?.length || 0;
    }

    if (!reveal) return base;

    base.questionText = answer.questionText;
    base.explanation = questionDoc?.explanation || '';

    if (OPTION_BACKED_TYPES.includes(answer.type) && questionDoc?.options) {
        base.options = questionDoc.options.map(o => ({
            _id: o._id, text: o.text, isCorrect: o.isCorrect,
            wasSelected: (answer.selectedOptions || []).map(s => s.toString()).includes(o._id.toString())
        }));
    } else if (answer.type === 'FillBlank') {
        base.submittedAnswer = answer.fillBlankAnswerText;
        base.acceptedAnswers = questionDoc?.acceptedAnswers || [];
    } else if (answer.type === 'Subjective') {
        base.submittedAnswer = answer.subjectiveAnswerText;
        base.rubric = questionDoc?.rubric || '';
        base.pendingManualGrading = answer.pendingManualGrading;
        base.gradingFeedback = answer.gradingFeedback;
    }

    return base;
}

// Used right at submit time (immediate result), before the full attempt
// report below is ever requested. `qMap` keys are stringified question ids
// mapped to either a QuestionBank doc (section mode) or a PracticeTest
// embedded question subdoc (legacy flat mode) — both expose the same
// `.options/.explanation/.acceptedAnswers/.rubric` shape we read here.
export function buildImmediateResultPayload(test, processedAnswers, qMap) {
    if (!test.showResultsImmediately) return undefined;
    const reveal = !!test.security?.revealAnswersInReport;
    return processedAnswers.map(a => buildQuestionResult(a, qMap[a.questionId.toString()], reveal));
}

const accuracyEntries = (statsMap) => Object.entries(statsMap).map(([key, v]) => ({
    key, correct: v.correct, total: v.total, accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0
}));

const bumpStat = (map, key, isCorrect) => {
    if (!key) return;
    if (!map[key]) map[key] = { correct: 0, total: 0 };
    map[key].total += 1;
    if (isCorrect) map[key].correct += 1;
};

// Full attempt report for the "My Reports" detail view — the gate is applied
// internally so every caller automatically gets leak-safe data regardless of
// the test's reveal setting.
export async function buildAttemptReport(test, attempt) {
    const reveal = !!test.security?.revealAnswersInReport;
    const isSectionMode = attempt.presentedQuestions.length > 0;

    let qMap = {};
    if (isSectionMode) {
        const questionDocs = await QuestionBank.find({ _id: { $in: attempt.presentedQuestions.map(p => p.questionBank) } })
            .select('explanation options acceptedAnswers rubric skillTags difficulty type');
        qMap = Object.fromEntries(questionDocs.map(q => [q._id.toString(), q]));
    } else {
        qMap = Object.fromEntries(test.questions.map(q => [q._id.toString(), q]));
    }

    const questionResults = attempt.answers.map(a => buildQuestionResult(a, qMap[a.questionId.toString()], reveal));

    // ── Section breakdown (section-mode only) ──────────────────────────────
    let sectionBreakdown = [];
    if (isSectionMode) {
        const sectionNames = Object.fromEntries(test.sections.map(s => [s._id.toString(), s.name]));
        const bySection = {};
        attempt.presentedQuestions.forEach(p => {
            const key = p.sectionId?.toString() || 'none';
            if (!bySection[key]) bySection[key] = { sectionId: p.sectionId, name: sectionNames[key] || 'Section', marksAvailable: 0, marksAwarded: 0, correct: 0, total: 0 };
            const ans = attempt.answers.find(a => a.questionId.toString() === p.questionBank.toString());
            bySection[key].marksAvailable += p.marks;
            bySection[key].marksAwarded += ans?.marksAwarded || 0;
            bySection[key].total += 1;
            if (ans?.isCorrect) bySection[key].correct += 1;
        });
        sectionBreakdown = Object.values(bySection).map(s => ({
            ...s,
            accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
            percentage: s.marksAvailable > 0 ? Math.round((s.marksAwarded / s.marksAvailable) * 100) : 0
        }));
    }

    // ── Skill / difficulty / type breakdown — joins QuestionBank for tags
    // only (skillTags/difficulty/type), never questionText/options/etc. ────
    const skillStats = {}, difficultyStats = {}, typeStats = {};
    attempt.answers.forEach(a => {
        const q = qMap[a.questionId.toString()];
        (q?.skillTags || []).forEach(tag => bumpStat(skillStats, tag, a.isCorrect));
        bumpStat(difficultyStats, q?.difficulty, a.isCorrect);
        bumpStat(typeStats, a.type, a.isCorrect);
    });

    // ── Coding execution summary — pass/fail counts and languages only ──────
    const codingAnswers = attempt.answers.filter(a => EXECUTION_TYPES.includes(a.type) && a.codeSubmission);
    const codingExecutionSummary = codingAnswers.length === 0 ? null : {
        questionsAttempted: codingAnswers.length,
        languages: [...new Set(codingAnswers.map(a => a.codeSubmission.language).filter(Boolean))],
        avgPassRate: Math.round(codingAnswers.reduce((sum, a) => {
            const total = a.codeSubmission.testCaseResults?.length || 0;
            const passed = a.codeSubmission.testCaseResults?.filter(t => t.passed).length || 0;
            return sum + (total > 0 ? (passed / total) * 100 : 0);
        }, 0) / codingAnswers.length)
    };

    // ── Proctoring summary — counts only ────────────────────────────────────
    const p = attempt.proctoring || {};
    const proctoringSummary = {
        tabSwitches: (p.tabSwitchEvents || []).filter(e => e.action === 'switch_away').length,
        fullscreenExits: (p.fullscreenExitEvents || []).length,
        copyPasteAttempts: (p.copyPasteAttempts || []).length,
        devtoolsHeuristicTriggers: (p.devtoolsHeuristicTriggers || []).length,
        focusLostDurationMs: p.focusLostDurationMs || 0,
        autoSubmittedDueToViolation: !!p.autoSubmittedDueToViolation,
        terminatedDueToViolation: !!p.terminatedDueToViolation
    };

    // ── Percentile vs other completed attempts on the same test ────────────
    const otherAttempts = await PracticeTestAttempt.find({ practiceTest: test._id, status: 'completed', _id: { $ne: attempt._id } }).select('percentage');
    let percentile = null;
    if (otherAttempts.length > 0) {
        const lower = otherAttempts.filter(o => o.percentage < attempt.percentage).length;
        percentile = Math.round((lower / otherAttempts.length) * 100);
    }

    // ── Rule-based recommendations — derived purely from the stats above ───
    const recommendations = [];
    accuracyEntries(skillStats).filter(s => s.accuracy < 50 && s.total >= 2).forEach(s => {
        recommendations.push(`Your accuracy in "${s.key}" was only ${s.accuracy}% (${s.correct}/${s.total}) — consider revisiting this topic.`);
    });
    if (proctoringSummary.tabSwitches > 0) {
        recommendations.push(`You switched tabs ${proctoringSummary.tabSwitches} time(s) during this attempt — minimizing distractions may help with focus and timing.`);
    }
    if (attempt.timeTaken > 0 && attempt.answers.length > 0) {
        const avgTimePerQ = attempt.timeTaken / attempt.answers.length;
        const slowCount = attempt.answers.filter(a => a.timeTaken > avgTimePerQ * 2).length;
        if (slowCount > 0) {
            recommendations.push(`You spent significantly longer than average on ${slowCount} question(s) — timed practice on similar questions can help with speed.`);
        }
    }
    if (recommendations.length === 0 && attempt.percentage >= test.passingScore) {
        recommendations.push('Solid performance — no major weak areas detected in this attempt.');
    }

    return {
        attempt: {
            _id: attempt._id, attemptNumber: attempt.attemptNumber, score: attempt.score, totalMarks: attempt.totalMarks,
            percentage: attempt.percentage, passed: attempt.passed, negativeMarksDeducted: attempt.negativeMarksDeducted,
            timeTaken: attempt.timeTaken, startedAt: attempt.startedAt, completedAt: attempt.completedAt, status: attempt.status
        },
        test: { title: test.title, subject: test.subject, passingScore: test.passingScore },
        revealAnswersInReport: reveal,
        questionResults,
        sectionBreakdown,
        skillBreakdown: accuracyEntries(skillStats),
        difficultyBreakdown: accuracyEntries(difficultyStats),
        typeBreakdown: accuracyEntries(typeStats),
        codingExecutionSummary,
        proctoringSummary,
        percentile,
        recommendations
    };
}
