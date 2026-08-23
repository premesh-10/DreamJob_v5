import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import useTabSwitchGuard from '../hooks/useTabSwitchGuard';
import useFullscreenGuard from '../hooks/useFullscreenGuard';
import useCopyPasteGuard from '../hooks/useCopyPasteGuard';
import useDevtoolsHeuristic from '../hooks/useDevtoolsHeuristic';
import useFocusGuard from '../hooks/useFocusGuard';
import ViolationWarningModal from '../components/practicetests/ViolationWarningModal';
import CodeEditor from '../components/practicetests/CodeEditor';

const STORAGE_PREFIX = 'practiceTestAttempt_';
const EXECUTION_TYPES = ['Coding', 'SQL', 'Debugging', 'OutputBased'];

// ── Timer component ───────────────────────────────────────────────────────────
function CircleTimer({ total, remaining, size = 56, color = '#7c3aed' }) {
    if (total <= 0) return null;
    const pct = remaining / total;
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const dash = circ * pct;
    const isLow = remaining <= 10;

    return (
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={5} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={isLow ? '#ef4444' : color}
                    strokeWidth={5}
                    strokeDasharray={`${dash} ${circ - dash}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.9s linear' }}
                />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center font-bold text-xs ${isLow ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>
                {remaining}
            </div>
        </div>
    );
}

// ── Minimal on-screen calculator (no eval — manual sequential ops only) ────────
function Calculator({ onClose }) {
    const [display, setDisplay] = useState('0');
    const [acc, setAcc] = useState(null);
    const [pendingOp, setPendingOp] = useState(null);

    const inputDigit = (d) => setDisplay(p => (p === '0' ? d : p + d));
    const inputDot = () => setDisplay(p => (p.includes('.') ? p : p + '.'));
    const clearAll = () => { setDisplay('0'); setAcc(null); setPendingOp(null); };

    const apply = (a, b, op) => {
        const x = parseFloat(a), y = parseFloat(b);
        if (op === '+') return x + y;
        if (op === '-') return x - y;
        if (op === '×') return x * y;
        if (op === '÷') return y === 0 ? 0 : x / y;
        return y;
    };

    const chooseOp = (op) => {
        if (acc === null) {
            setAcc(display);
        } else if (pendingOp) {
            setAcc(String(apply(acc, display, pendingOp)));
        }
        setPendingOp(op);
        setDisplay('0');
    };

    const equals = () => {
        if (acc === null || !pendingOp) return;
        setDisplay(String(apply(acc, display, pendingOp)));
        setAcc(null);
        setPendingOp(null);
    };

    return (
        <div className="fixed bottom-20 right-6 z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 w-64 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800">
                <span className="text-white text-sm font-semibold">Calculator</span>
                <button onClick={onClose} className="text-white/70 hover:text-white">✕</button>
            </div>
            <div className="px-4 py-3 bg-slate-900 text-right text-2xl font-mono text-white truncate">{display}</div>
            <div className="grid grid-cols-4 gap-1 p-2">
                {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '=', '+'].map(key => (
                    <button key={key}
                        onClick={() => {
                            if (/[0-9]/.test(key)) inputDigit(key);
                            else if (key === '.') inputDot();
                            else if (key === '=') equals();
                            else chooseOp(key);
                        }}
                        className={`py-2.5 rounded-lg text-sm font-semibold ${/[0-9.]/.test(key) ? 'bg-slate-100 hover:bg-slate-200 text-slate-800' : 'bg-violet-100 hover:bg-violet-200 text-violet-700'}`}>
                        {key}
                    </button>
                ))}
                <button onClick={clearAll} className="col-span-4 mt-1 py-2 rounded-lg text-sm font-semibold bg-red-50 hover:bg-red-100 text-red-600">Clear</button>
            </div>
        </div>
    );
}

// ── Per-type question input renderer ────────────────────────────────────────────
function QuestionInput({ question, answer, onSelectOption, onTextChange }) {
    const optionBacked = ['MCQ', 'MSQ', 'TrueFalse'].includes(question.type);

    if (optionBacked) {
        return (
            <div className="space-y-3">
                {question.options?.map((opt, oi) => {
                    const selected = answer.selectedOptionIds.includes(opt._id);
                    return (
                        <button key={opt._id}
                            onClick={() => onSelectOption(opt._id)}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${selected
                                ? 'border-violet-500 bg-violet-50 shadow-sm'
                                : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'}`}>
                            <div className={`w-6 h-6 ${question.type === 'MSQ' ? 'rounded-md' : 'rounded-full'} border-2 flex items-center justify-center flex-shrink-0 transition-all ${selected ? 'border-violet-600 bg-violet-600' : 'border-slate-300'}`}>
                                {selected && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                            <span className="text-xs font-bold text-slate-500 flex-shrink-0 w-4">{String.fromCharCode(65 + oi)}</span>
                            <span className={`text-sm leading-snug ${selected ? 'text-violet-900 font-medium' : 'text-slate-700'}`}>{opt.text}</span>
                        </button>
                    );
                })}
            </div>
        );
    }

    if (question.type === 'FillBlank') {
        return (
            <input value={answer.fillBlankAnswerText} onChange={e => onTextChange('fillBlankAnswerText', e.target.value)}
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-violet-400 outline-none text-base"
                placeholder="Type your answer..." />
        );
    }

    if (question.type === 'Subjective') {
        return (
            <textarea value={answer.subjectiveAnswerText} onChange={e => onTextChange('subjectiveAnswerText', e.target.value)} rows={8}
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:border-violet-400 outline-none text-base resize-none"
                placeholder="Write your answer here... (manually graded by the seller)" />
        );
    }

    return <p className="text-sm text-amber-600 italic">This question type isn't supported for answering yet.</p>;
}

// ── Result Screen ─────────────────────────────────────────────────────────────
function ResultScreen({ result, onRetake, test }) {
    const { score, totalMarks, percentage, passed, passingScore, questionResults, negativeMarksDeducted, hasPendingManualGrading, newlyAwardedBadges, certificateIssued } = result;
    const [showReview, setShowReview] = useState(false);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Score card */}
                <div className={`rounded-3xl p-8 text-center shadow-xl ${passed ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-slate-700 to-slate-900'} text-white`}>
                    <div className="text-6xl mb-4">{passed ? '🏆' : '📚'}</div>
                    <h2 className="text-3xl font-black mb-1">{passed ? 'Congratulations!' : 'Keep Practicing!'}</h2>
                    <p className="text-white/80 mb-6">{passed ? 'You passed the test!' : `You need ${passingScore}% to pass`}</p>

                    <div className="relative w-32 h-32 mx-auto mb-6">
                        <svg width="128" height="128" className="-rotate-90">
                            <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                            <circle cx="64" cy="64" r="56" fill="none"
                                stroke="white" strokeWidth="8"
                                strokeDasharray={`${(percentage / 100) * 2 * Math.PI * 56} ${2 * Math.PI * 56}`}
                                strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black">{percentage}%</span>
                            <span className="text-white/70 text-xs">{score}/{totalMarks}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-black">{score}</p>
                            <p className="text-white/70 text-xs">Score</p>
                        </div>
                        <div>
                            <p className="text-2xl font-black">{totalMarks}</p>
                            <p className="text-white/70 text-xs">Total</p>
                        </div>
                        <div>
                            <p className={`text-2xl font-black ${passed ? 'text-white' : 'text-red-300'}`}>{passed ? 'PASS' : 'FAIL'}</p>
                            <p className="text-white/70 text-xs">Result</p>
                        </div>
                    </div>

                    {negativeMarksDeducted > 0 && (
                        <p className="text-white/70 text-xs mt-4">➖ {negativeMarksDeducted} mark{negativeMarksDeducted !== 1 ? 's' : ''} deducted for negative marking</p>
                    )}
                </div>

                {hasPendingManualGrading && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
                        ✍️ One or more subjective answers in this attempt are awaiting manual grading by the seller. Your score will update once grading is complete.
                    </div>
                )}

                {newlyAwardedBadges?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 flex items-center gap-3">
                        <span className="text-2xl">🏆</span>
                        <div>
                            <p className="font-bold">New badge{newlyAwardedBadges.length > 1 ? 's' : ''} earned!</p>
                            <p>{newlyAwardedBadges.map(b => b.name).join(', ')} — see them under My Reports → Achievements.</p>
                        </div>
                    </div>
                )}

                {certificateIssued && (
                    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-sm text-violet-800 flex items-center gap-3">
                        <span className="text-2xl">🎓</span>
                        <div>
                            <p className="font-bold">Certificate issued!</p>
                            <p>Certificate {certificateIssued.certificateNumber} is ready under My Reports → Achievements.</p>
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-col gap-3">
                    {questionResults && questionResults.length > 0 && (
                        <button onClick={() => setShowReview(!showReview)}
                            className="w-full py-3.5 bg-white border-2 border-violet-200 text-violet-700 rounded-2xl font-semibold hover:bg-violet-50 transition">
                            {showReview ? 'Hide' : '📋 Review'} Answers
                        </button>
                    )}
                    <div className="flex gap-3">
                        {result?.attemptId && (
                            <Link to={`/reports`}
                                className="flex-1 py-3.5 text-center bg-slate-100 border-2 border-slate-200 text-slate-700 rounded-2xl font-semibold hover:bg-slate-200 transition">
                                📊 My Reports
                            </Link>
                        )}
                        {onRetake && (
                            <button onClick={onRetake}
                                className="flex-1 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl font-semibold hover:shadow-lg transition">
                                🔁 Retake Test
                            </button>
                        )}
                    </div>
                </div>

                <Link to="/practice-tests" className="block text-center text-slate-500 text-sm hover:text-violet-600 transition">
                    ← Back to all tests
                </Link>

                {/* Question review */}
                {showReview && questionResults && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-900 text-lg">Question Review</h3>
                        {questionResults.map((q, idx) => (
                            <div key={idx} className={`rounded-2xl border p-5 ${q.pendingManualGrading ? 'border-amber-200 bg-amber-50' : q.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                                <div className="flex items-start gap-3 mb-3">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${q.pendingManualGrading ? 'bg-amber-500 text-white' : q.isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {q.pendingManualGrading ? '?' : q.isCorrect ? '✓' : '✗'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{q.type}</span>
                                            <span className="text-xs text-slate-500">{q.marksAwarded}/{q.marksAvailable} marks</span>
                                            {q.negativeMarksDeducted > 0 && <span className="text-xs text-red-500">−{q.negativeMarksDeducted}</span>}
                                        </div>
                                        <p className="font-semibold text-slate-800 text-sm">{q.questionText}</p>
                                    </div>
                                </div>

                                {q.options && (
                                    <div className="space-y-1.5 ml-10">
                                        {q.options.map((opt, oi) => (
                                            <div key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${opt.isCorrect && opt.wasSelected ? 'bg-emerald-200 text-emerald-900 font-semibold' : opt.isCorrect ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : opt.wasSelected ? 'bg-red-200 text-red-900' : 'bg-white/60 text-slate-600'}`}>
                                                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs flex-shrink-0 ${opt.isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : opt.wasSelected ? 'border-red-400 bg-red-400 text-white' : 'border-slate-300'}`}>
                                                    {opt.isCorrect ? '✓' : opt.wasSelected ? '✗' : ''}
                                                </span>
                                                {opt.text}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {q.type === 'FillBlank' && (
                                    <div className="ml-10 space-y-1.5 text-sm">
                                        <p><span className="font-semibold text-slate-700">Your answer:</span> {q.submittedAnswer || <span className="italic text-slate-400">blank</span>}</p>
                                        {!q.isCorrect && q.acceptedAnswers?.length > 0 && (
                                            <p className="text-emerald-700"><span className="font-semibold">Accepted:</span> {q.acceptedAnswers.join(', ')}</p>
                                        )}
                                    </div>
                                )}

                                {['Coding', 'SQL', 'Debugging', 'OutputBased'].includes(q.type) && (
                                    <div className="ml-10 text-sm space-y-1">
                                        <p><span className="font-semibold text-slate-700">Status:</span> {q.status || 'Not submitted'}</p>
                                        {q.totalCount > 0 && <p><span className="font-semibold text-slate-700">Test cases:</span> {q.passedCount}/{q.totalCount} passed</p>}
                                        {q.language && <p className="text-slate-500 text-xs">Language: {q.language}</p>}
                                    </div>
                                )}

                                {q.type === 'Subjective' && (
                                    <div className="ml-10 space-y-1.5 text-sm">
                                        <p className="font-semibold text-slate-700">Your answer:</p>
                                        <p className="text-slate-600 bg-white/60 rounded-lg p-2.5">{q.submittedAnswer || <span className="italic text-slate-400">blank</span>}</p>
                                        {q.pendingManualGrading ? (
                                            <p className="text-amber-700 italic">Awaiting manual grading</p>
                                        ) : q.gradingFeedback ? (
                                            <p className="text-violet-700"><span className="font-semibold">Feedback:</span> {q.gradingFeedback}</p>
                                        ) : null}
                                    </div>
                                )}

                                {q.explanation && (
                                    <div className="ml-10 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                        <span className="font-semibold">💡 Explanation: </span>{q.explanation}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const emptyAnswer = () => ({ selectedOptionIds: [], fillBlankAnswerText: '', subjectiveAnswerText: '' });

// ── Main Quiz Page ─────────────────────────────────────────────────────────────
function PracticeTestQuiz() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [phase, setPhase] = useState('loading'); // loading | quiz | submitting | result | error
    const [testMeta, setTestMeta] = useState(null);
    const [sections, setSections] = useState([]); // [] for legacy flat mode
    const [flatQuestions, setFlatQuestions] = useState([]); // unified list, sectionId: null in legacy mode
    const [attemptId, setAttemptId] = useState(null);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState({}); // { questionId: { selectedOptionIds, fillBlankAnswerText, subjectiveAnswerText } }
    const [codeResults, setCodeResults] = useState({}); // { questionId: submittedResult } — Coding/SQL/Debugging/OutputBased
    const [bookmarked, setBookmarked] = useState(new Set());
    const [markedForReview, setMarkedForReview] = useState(new Set());
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [showCalculator, setShowCalculator] = useState(false);
    const [lockedSections, setLockedSections] = useState(new Set());
    const [lastSaved, setLastSaved] = useState(null);
    const [violationNotice, setViolationNotice] = useState(null);
    const [needsFullscreen, setNeedsFullscreen] = useState(false);

    const [overallTimeLeft, setOverallTimeLeft] = useState(0);
    const [overallTimerTotal, setOverallTimerTotal] = useState(0);
    const [sectionTimeLeft, setSectionTimeLeft] = useState({}); // { sectionId: secondsLeft }
    const [startedAt] = useState(Date.now());
    const overallIntervalRef = useRef(null);
    const sectionIntervalRef = useRef(null);
    const autosaveTimeoutRef = useRef(null);

    const storageKey = `${STORAGE_PREFIX}${id}`;

    const hydrateFromPayload = (payload, draft) => {
        const { test, questions: qs, sections: secs } = payload;
        setTestMeta(test);

        let flat = [];
        if (secs && secs.length > 0) {
            setSections(secs);
            flat = secs.flatMap(s => s.questions.map(q => ({ ...q, sectionId: s._id, sectionName: s.name })));
            const timers = {};
            secs.forEach(s => { if (s.timeLimit > 0) timers[s._id] = s.timeLimit * 60; });
            setSectionTimeLeft(timers);
        } else {
            setSections([]);
            flat = qs.map(q => ({ ...q, sectionId: null }));
        }
        setFlatQuestions(flat);

        if (test.timeLimit > 0) {
            setOverallTimeLeft(test.timeLimit * 60);
            setOverallTimerTotal(test.timeLimit * 60);
        }

        const initialAnswers = {};
        flat.forEach(q => { initialAnswers[q._id] = emptyAnswer(); });
        if (Array.isArray(draft?.draftAnswers)) {
            draft.draftAnswers.forEach(d => {
                if (initialAnswers[d.questionId]) {
                    initialAnswers[d.questionId] = {
                        selectedOptionIds: d.selectedOptionIds || [],
                        fillBlankAnswerText: d.fillBlankAnswerText || '',
                        subjectiveAnswerText: d.subjectiveAnswerText || ''
                    };
                }
            });
        }
        setAnswers(initialAnswers);
        if (draft?.bookmarkedQuestionIds) setBookmarked(new Set(draft.bookmarkedQuestionIds));
        if (draft?.markedForReviewIds) setMarkedForReview(new Set(draft.markedForReviewIds));
        if (Array.isArray(draft?.codeAnswers)) {
            setCodeResults(Object.fromEntries(draft.codeAnswers.map(c => [c.questionId, c])));
        }
    };

    const startQuiz = useCallback(async () => {
        setPhase('loading');
        try {
            const { data } = await api.post(`/practice-tests/${id}/attempt/start`);
            setAttemptId(data.data.attemptId);
            hydrateFromPayload(data.data, null);
            if (data.data.test.allowResume) {
                localStorage.setItem(storageKey, data.data.attemptId);
            } else {
                localStorage.removeItem(storageKey);
            }
            setPhase('quiz');
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not start the test. Please try again.');
            setPhase('error');
        }
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    // On mount: try to resume a saved in-progress attempt before starting a fresh one
    useEffect(() => {
        const savedAttemptId = localStorage.getItem(storageKey);
        if (!savedAttemptId) { startQuiz(); return; }

        (async () => {
            try {
                const { data } = await api.get(`/practice-tests/${id}/attempt/${savedAttemptId}/resume`);
                setAttemptId(savedAttemptId);
                hydrateFromPayload(data.data, data.data);
                setPhase('quiz');
            } catch {
                localStorage.removeItem(storageKey);
                startQuiz();
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Overall timer
    useEffect(() => {
        if (phase !== 'quiz' || overallTimerTotal <= 0) return;
        overallIntervalRef.current = setInterval(() => {
            setOverallTimeLeft(prev => {
                if (prev <= 1) { clearInterval(overallIntervalRef.current); handleAutoSubmit(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(overallIntervalRef.current);
    }, [phase, overallTimerTotal]); // eslint-disable-line react-hooks/exhaustive-deps

    const currentQ = flatQuestions[currentIdx];
    const currentSectionId = currentQ?.sectionId || null;

    // Section timer — only the current section's countdown ticks
    useEffect(() => {
        if (phase !== 'quiz' || !currentSectionId) return;
        clearInterval(sectionIntervalRef.current);
        if (!(currentSectionId in sectionTimeLeft) || lockedSections.has(currentSectionId)) return;

        sectionIntervalRef.current = setInterval(() => {
            setSectionTimeLeft(prev => {
                const remaining = prev[currentSectionId];
                if (remaining === undefined) return prev;
                if (remaining <= 1) {
                    clearInterval(sectionIntervalRef.current);
                    setLockedSections(p => new Set([...p, currentSectionId]));
                    advanceToNextUnlockedSection(currentSectionId);
                    return { ...prev, [currentSectionId]: 0 };
                }
                return { ...prev, [currentSectionId]: remaining - 1 };
            });
        }, 1000);
        return () => clearInterval(sectionIntervalRef.current);
    }, [phase, currentSectionId, lockedSections]); // eslint-disable-line react-hooks/exhaustive-deps

    const advanceToNextUnlockedSection = (fromSectionId) => {
        const sectionOrder = sections.map(s => s._id);
        const fromIdx = sectionOrder.indexOf(fromSectionId);
        const nextSectionId = sectionOrder.slice(fromIdx + 1).find(sId => !lockedSections.has(sId));
        if (!nextSectionId) { handleAutoSubmit(); return; }
        const firstIdx = flatQuestions.findIndex(q => q.sectionId === nextSectionId);
        if (firstIdx >= 0) setCurrentIdx(firstIdx);
        else handleAutoSubmit();
    };

    // Debounced autosave whenever answer/bookmark/review state changes
    useEffect(() => {
        if (phase !== 'quiz' || !attemptId || !testMeta?.allowResume) return;
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = setTimeout(() => {
            const draftAnswers = Object.entries(answers).map(([questionId, a]) => ({ questionId, ...a }));
            api.patch(`/practice-tests/${id}/attempt/${attemptId}/autosave`, {
                answers: draftAnswers,
                bookmarkedQuestionIds: Array.from(bookmarked),
                markedForReviewIds: Array.from(markedForReview)
            }).then(() => setLastSaved(new Date())).catch(() => {});
        }, 2500);
        return () => clearTimeout(autosaveTimeoutRef.current);
    }, [answers, bookmarked, markedForReview, phase, attemptId, testMeta, id]);

    const handleSelectOption = (questionId, optionId, type) => {
        setAnswers(prev => {
            const current = prev[questionId] || emptyAnswer();
            if (type === 'MSQ') {
                const has = current.selectedOptionIds.includes(optionId);
                return { ...prev, [questionId]: { ...current, selectedOptionIds: has ? current.selectedOptionIds.filter(i => i !== optionId) : [...current.selectedOptionIds, optionId] } };
            }
            return { ...prev, [questionId]: { ...current, selectedOptionIds: [optionId] } };
        });
    };

    const handleTextChange = (questionId, field, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: { ...(prev[questionId] || emptyAnswer()), [field]: value } }));
    };

    const isAnswered = (q) => {
        if (EXECUTION_TYPES.includes(q.type)) return !!codeResults[q._id];
        const a = answers[q._id];
        if (!a) return false;
        if (q.type === 'FillBlank') return a.fillBlankAnswerText.trim().length > 0;
        if (q.type === 'Subjective') return a.subjectiveAnswerText.trim().length > 0;
        return a.selectedOptionIds.length > 0;
    };

    const answeredCount = flatQuestions.filter(isAnswered).length;

    const handleAutoSubmit = useCallback(() => { submitAnswers(true); }, [answers, flatQuestions, attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

    const submitAnswers = async (autoSubmit = false) => {
        if (!autoSubmit && !window.confirm(`Submit test? You've answered ${answeredCount}/${flatQuestions.length} questions.`)) return;

        clearInterval(overallIntervalRef.current);
        clearInterval(sectionIntervalRef.current);
        setPhase('submitting');

        const timeTaken = Math.round((Date.now() - startedAt) / 1000);
        const formattedAnswers = flatQuestions.map(q => ({
            questionId: q._id,
            selectedOptionIds: answers[q._id]?.selectedOptionIds || [],
            fillBlankAnswerText: answers[q._id]?.fillBlankAnswerText || '',
            subjectiveAnswerText: answers[q._id]?.subjectiveAnswerText || '',
            timeTaken: 0
        }));

        try {
            const { data } = await api.post(`/practice-tests/${id}/attempt/${attemptId}/submit`, { answers: formattedAnswers, timeTaken });
            localStorage.removeItem(storageKey);
            setResult(data.data);
            setPhase('result');
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to submit. Please try again.');
            setPhase('error');
        }
    };

    const toggleBookmark = (qId) => setBookmarked(p => { const n = new Set(p); n.has(qId) ? n.delete(qId) : n.add(qId); return n; });
    const toggleReview = (qId) => setMarkedForReview(p => { const n = new Set(p); n.has(qId) ? n.delete(qId) : n.add(qId); return n; });

    // Reports a security/proctoring event to the server (which enforces tab-switch
    // policy authoritatively) and surfaces the resulting state via the shared modal.
    const postViolation = useCallback(async (category, action, extra = {}) => {
        if (phase !== 'quiz' || !attemptId) return;
        try {
            const { data } = await api.post(`/practice-tests/${id}/attempt/${attemptId}/violation`, { category, action, ...extra });
            if (data.finalized) {
                clearInterval(overallIntervalRef.current);
                clearInterval(sectionIntervalRef.current);
                localStorage.removeItem(storageKey);
                if (data.data) {
                    setResult(data.data);
                    setPhase('result');
                } else {
                    setViolationNotice({ category, ...data.violation });
                    setTimeout(() => navigate('/practice-tests'), 2500);
                }
                return;
            }
            if (category === 'tab_switch' && action !== 'switch_back') {
                setViolationNotice({ category, ...data.violation });
            } else if (category !== 'tab_switch' && category !== 'focus_lost') {
                setViolationNotice({ category, message: 'This action is restricted during this test.' });
            }
        } catch {
            // Non-fatal — proctoring is best-effort; a failed log call shouldn't block the test.
        }
    }, [phase, attemptId, id, navigate, storageKey]);

    const securityConfig = testMeta?.security || {};
    useTabSwitchGuard(
        phase === 'quiz' && (securityConfig.maxTabSwitches > 0 || securityConfig.allowTabSwitch === false),
        useCallback((action) => postViolation('tab_switch', action), [postViolation])
    );
    const { requestFullscreen } = useFullscreenGuard(
        phase === 'quiz' && !!securityConfig.requireFullscreen,
        useCallback(() => { setNeedsFullscreen(true); postViolation('fullscreen_exit'); }, [postViolation])
    );
    useCopyPasteGuard(
        {
            disableCopyPaste: phase === 'quiz' && !!securityConfig.disableCopyPaste,
            disableRightClick: phase === 'quiz' && !!securityConfig.disableRightClick,
            disableTextSelection: phase === 'quiz' && !!securityConfig.disableTextSelection
        },
        useCallback((type) => postViolation('copy_paste', null, { copyPasteType: type }), [postViolation])
    );
    useDevtoolsHeuristic(
        phase === 'quiz' && !!securityConfig.proctoringEnabled,
        useCallback(() => postViolation('devtools'), [postViolation])
    );
    useFocusGuard(
        phase === 'quiz' && !!securityConfig.proctoringEnabled,
        useCallback((durationMs) => postViolation('focus_lost', null, { focusLostDurationMs: durationMs }), [postViolation])
    );

    useEffect(() => {
        if (phase === 'quiz' && securityConfig.requireFullscreen && !document.fullscreenElement) {
            setNeedsFullscreen(true);
        }
    }, [phase, securityConfig.requireFullscreen]);

    const handleRetake = () => {
        setPhase('loading');
        setAnswers({}); setBookmarked(new Set()); setMarkedForReview(new Set());
        setCurrentIdx(0); setResult(null); setOverallTimeLeft(0); setSectionTimeLeft({}); setLockedSections(new Set());
        startQuiz();
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    // ── Render phases ──────────────────────────────────────────────────────────
    if (phase === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-violet-700 font-semibold">Preparing your test...</p>
                </div>
            </div>
        );
    }

    if (phase === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center max-w-sm">
                    <div className="text-6xl mb-4">❌</div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Oops!</h2>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <div className="flex gap-3 justify-center">
                        <Link to="/practice-tests" className="px-5 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50">← Back</Link>
                        <button onClick={startQuiz} className="px-5 py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700">Try Again</button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'submitting') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-violet-700 font-semibold">Calculating your score...</p>
                </div>
            </div>
        );
    }

    if (phase === 'result') {
        return <ResultScreen result={result} onRetake={testMeta?.maxAttempts === 0 ? handleRetake : null} test={testMeta} />;
    }

    // ── Quiz UI ────────────────────────────────────────────────────────────────
    const currentAnswer = answers[currentQ?._id] || emptyAnswer();
    const isSectionMode = sections.length > 0;
    const currentSectionTimeLeft = currentSectionId ? sectionTimeLeft[currentSectionId] : undefined;
    const currentSectionTimeTotal = currentSectionId ? (sections.find(s => s._id === currentSectionId)?.timeLimit || 0) * 60 : 0;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Top bar */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link to="/practice-tests" className="text-slate-400 hover:text-slate-600 transition">✕</Link>
                        <div>
                            <h1 className="font-bold text-slate-900 text-sm leading-none">{testMeta?.title}</h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {testMeta?.subject}
                                {lastSaved && <span className="ml-2 text-emerald-500">• Saved {lastSaved.toLocaleTimeString()}</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-medium hidden sm:block">
                            {answeredCount}/{flatQuestions.length} answered
                        </span>
                        {testMeta?.allowCalculator && (
                            <button onClick={() => setShowCalculator(p => !p)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm" title="Calculator">
                                🧮
                            </button>
                        )}
                        {overallTimerTotal > 0 && (
                            <div className={`flex items-center gap-1.5 font-mono text-sm font-bold px-3 py-1.5 rounded-xl ${overallTimeLeft < 60 ? 'text-red-600 bg-red-50 animate-pulse' : overallTimeLeft < 300 ? 'text-amber-600 bg-amber-50' : 'text-violet-600 bg-violet-50'}`}>
                                ⏱️ {formatTime(overallTimeLeft)}
                            </div>
                        )}
                        <button onClick={() => submitAnswers(false)}
                            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:shadow-md transition">
                            Submit
                        </button>
                    </div>
                </div>
            </div>

            {/* Section tabs */}
            {isSectionMode && (
                <div className="bg-white border-b border-slate-100 px-4 py-2">
                    <div className="max-w-5xl mx-auto flex items-center gap-2 overflow-x-auto">
                        {sections.map(s => {
                            const isActive = s._id === currentSectionId;
                            const isLocked = lockedSections.has(s._id);
                            return (
                                <button key={s._id} disabled={isLocked}
                                    onClick={() => { const idx = flatQuestions.findIndex(q => q.sectionId === s._id); if (idx >= 0) setCurrentIdx(idx); }}
                                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${isActive ? 'bg-violet-600 text-white' : isLocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-100 text-slate-600 hover:bg-violet-100'}`}>
                                    {s.name}{isLocked ? ' 🔒' : ''}
                                    {s.timeLimit > 0 && !isLocked && <span className="ml-1.5 opacity-80">{formatTime(sectionTimeLeft[s._id] ?? s.timeLimit * 60)}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Progress bar */}
            <div className="h-1 bg-slate-200">
                <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${((currentIdx + 1) / flatQuestions.length) * 100}%` }} />
            </div>

            <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 flex gap-6">
                {/* Main question area */}
                <div className="flex-1 min-w-0">
                    {currentQ && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="w-8 h-8 bg-violet-600 text-white rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">
                                        {currentIdx + 1}
                                    </span>
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">{currentQ.type}</span>
                                    <span className="text-xs text-slate-400">{currentQ.marks} mark{currentQ.marks !== 1 ? 's' : ''}</span>
                                    {testMeta?.negativeMarking?.enabled && <span className="text-xs text-red-400">negative marking applies</span>}
                                </div>
                                {currentSectionTimeTotal > 0 && (
                                    <CircleTimer total={currentSectionTimeTotal} remaining={currentSectionTimeLeft ?? currentSectionTimeTotal} />
                                )}
                            </div>

                            <p className="text-slate-900 text-lg font-medium leading-relaxed">{currentQ.questionText}</p>

                            {EXECUTION_TYPES.includes(currentQ.type) ? (
                                <CodeEditor
                                    testId={id}
                                    attemptId={attemptId}
                                    question={currentQ}
                                    submittedResult={codeResults[currentQ._id]}
                                    onSubmitted={(questionId, resultPayload) => setCodeResults(prev => ({ ...prev, [questionId]: resultPayload }))}
                                />
                            ) : (
                                <QuestionInput
                                    question={currentQ}
                                    answer={currentAnswer}
                                    onSelectOption={(optId) => handleSelectOption(currentQ._id, optId, currentQ.type)}
                                    onTextChange={(field, val) => handleTextChange(currentQ._id, field, val)}
                                />
                            )}

                            {/* Navigation */}
                            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                                <div className="flex gap-2">
                                    <button onClick={() => toggleBookmark(currentQ._id)}
                                        className={`px-3.5 py-2 rounded-xl border text-sm font-medium transition ${bookmarked.has(currentQ._id) ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>
                                        ⭐ {bookmarked.has(currentQ._id) ? 'Bookmarked' : 'Bookmark'}
                                    </button>
                                    <button onClick={() => toggleReview(currentQ._id)}
                                        className={`px-3.5 py-2 rounded-xl border text-sm font-medium transition ${markedForReview.has(currentQ._id) ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-amber-300'}`}>
                                        🔖 {markedForReview.has(currentQ._id) ? 'Marked' : 'Mark for Review'}
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                                        disabled={currentIdx === 0}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-slate-50 transition">
                                        ← Prev
                                    </button>
                                    {currentIdx < flatQuestions.length - 1 ? (
                                        <button onClick={() => setCurrentIdx(i => i + 1)}
                                            className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition">
                                            Next →
                                        </button>
                                    ) : (
                                        <button onClick={() => submitAnswers(false)}
                                            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:shadow-md transition">
                                            Finish Test ✓
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Question navigator sidebar */}
                <div className="w-56 flex-shrink-0 hidden md:block">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-6">
                        <h3 className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wide">Questions</h3>
                        <div className="grid grid-cols-5 gap-1.5 mb-4">
                            {flatQuestions.map((q, idx) => {
                                const answered = isAnswered(q);
                                const marked = markedForReview.has(q._id);
                                const bm = bookmarked.has(q._id);
                                const isCurrent = idx === currentIdx;
                                const locked = q.sectionId && lockedSections.has(q.sectionId);
                                return (
                                    <button key={q._id} onClick={() => !locked && setCurrentIdx(idx)} disabled={locked}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all relative ${isCurrent ? 'bg-violet-600 text-white scale-110 shadow-md' : locked ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : answered ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                        {idx + 1}
                                        {marked && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white" />}
                                        {bm && <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-violet-400 rounded-full border border-white" />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="space-y-1.5 text-xs">
                            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-violet-600 rounded" /><span className="text-slate-500">Current</span></div>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-emerald-100 border border-emerald-200 rounded" /><span className="text-slate-500">Answered ({answeredCount})</span></div>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-100 rounded" /><span className="text-slate-500">Unanswered ({flatQuestions.length - answeredCount})</span></div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-slate-100 rounded relative"><div className="w-2 h-2 bg-amber-400 rounded-full absolute -top-0.5 -right-0.5" /></div>
                                <span className="text-slate-500">Marked ({markedForReview.size})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-slate-100 rounded relative"><div className="w-2 h-2 bg-violet-400 rounded-full absolute -bottom-0.5 -right-0.5" /></div>
                                <span className="text-slate-500">Bookmarked ({bookmarked.size})</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}

            {violationNotice && (
                <ViolationWarningModal
                    violation={violationNotice}
                    onDismiss={() => setViolationNotice(null)}
                    onReenterFullscreen={() => { requestFullscreen(); setNeedsFullscreen(false); setViolationNotice(null); }}
                />
            )}

            {needsFullscreen && !violationNotice && (
                <div className="fixed inset-0 bg-slate-900/95 z-[65] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm text-center">
                        <div className="text-5xl mb-3">🖥️</div>
                        <h2 className="text-lg font-bold text-slate-900 mb-2">Fullscreen Required</h2>
                        <p className="text-sm text-slate-600 mb-5">This test must be taken in fullscreen mode. Click below to continue.</p>
                        <button onClick={() => { requestFullscreen(); setNeedsFullscreen(false); }}
                            className="w-full py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700">
                            Enter Fullscreen &amp; Continue
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PracticeTestQuiz;
