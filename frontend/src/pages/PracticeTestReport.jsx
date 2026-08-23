import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import html2pdf from 'html2pdf.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function formatTime(secs) {
    if (!secs) return '0s';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatDate(d) {
    return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const accuracyColor = (pct) => (pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444');

function AccuracyBarChart({ data, labelKey = 'key' }) {
    if (!data || data.length === 0) return null;
    return (
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 42)}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis type="category" dataKey={labelKey} width={110} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v, _n, p) => [`${v}% (${p.payload.correct}/${p.payload.total})`, 'Accuracy']} />
                <Bar dataKey="accuracy" radius={[0, 6, 6, 0]}>
                    {data.map((d, i) => <Cell key={i} fill={accuracyColor(d.accuracy)} />)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

function QuestionCard({ q, index }) {
    const hasOptions = Array.isArray(q.options);
    const isExecutionType = ['Coding', 'SQL', 'Debugging', 'OutputBased'].includes(q.type);

    return (
        <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${q.isCorrect ? 'border-emerald-100' : 'border-red-100'}`}>
            <div className={`px-6 py-3 flex items-center justify-between border-b ${q.isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 ${q.isCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                        {q.isCorrect ? '✓' : '✗'}
                    </span>
                    <span className="font-bold text-slate-700 text-sm">Q{index + 1}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">{q.type}</span>
                </div>
                <span className="text-xs font-bold text-slate-500">{q.marksAwarded}/{q.marksAvailable} marks</span>
            </div>

            <div className="p-6">
                {q.questionText && <p className="text-base font-medium text-slate-800 mb-5 leading-relaxed">{q.questionText}</p>}

                {hasOptions && (
                    <div className="space-y-2.5">
                        {q.options.map((opt) => {
                            const isCorrectPicked = opt.isCorrect && opt.wasSelected;
                            const isMissedCorrect = opt.isCorrect && !opt.wasSelected;
                            const isWrongPicked = !opt.isCorrect && opt.wasSelected;
                            let style = 'border-slate-200 bg-slate-50/50 text-slate-600';
                            let badge = null;
                            if (isCorrectPicked) { style = 'border-emerald-400 bg-emerald-50 text-emerald-800'; badge = <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">✓ Your Answer</span>; }
                            else if (isMissedCorrect) { style = 'border-emerald-300 border-dashed bg-emerald-50/50 text-emerald-700'; badge = <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">✓ Correct</span>; }
                            else if (isWrongPicked) { style = 'border-red-400 bg-red-50 text-red-800'; badge = <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex-shrink-0">✗ Your Answer</span>; }
                            return (
                                <div key={opt._id} className={`flex items-center gap-3 p-3.5 rounded-xl border-2 ${style}`}>
                                    <span className="flex-1 text-sm">{opt.text}</span>
                                    {badge}
                                </div>
                            );
                        })}
                    </div>
                )}

                {q.type === 'FillBlank' && q.submittedAnswer !== undefined && (
                    <div className="space-y-1.5 text-sm">
                        <p><span className="font-semibold text-slate-700">Your answer:</span> {q.submittedAnswer || <span className="italic text-slate-400">blank</span>}</p>
                        {!q.isCorrect && q.acceptedAnswers?.length > 0 && <p className="text-emerald-700"><span className="font-semibold">Accepted:</span> {q.acceptedAnswers.join(', ')}</p>}
                    </div>
                )}

                {q.type === 'Subjective' && q.submittedAnswer !== undefined && (
                    <div className="space-y-1.5 text-sm">
                        <p className="font-semibold text-slate-700">Your answer:</p>
                        <p className="text-slate-600 bg-slate-50 rounded-lg p-2.5">{q.submittedAnswer || <span className="italic text-slate-400">blank</span>}</p>
                        {q.pendingManualGrading ? <p className="text-amber-700 italic">Awaiting manual grading</p> : q.gradingFeedback ? <p className="text-violet-700"><span className="font-semibold">Feedback:</span> {q.gradingFeedback}</p> : null}
                    </div>
                )}

                {isExecutionType && (
                    <div className="text-sm space-y-1">
                        <p><span className="font-semibold text-slate-700">Status:</span> {q.status || '—'}</p>
                        {q.totalCount > 0 && <p><span className="font-semibold text-slate-700">Test cases:</span> {q.passedCount}/{q.totalCount} passed</p>}
                        {q.language && <p className="text-slate-500 text-xs">Language: {q.language}</p>}
                    </div>
                )}

                {q.explanation && (
                    <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-100 flex gap-3">
                        <span className="text-lg flex-shrink-0">💡</span>
                        <div>
                            <h4 className="font-bold text-sm text-amber-900 mb-1">Explanation</h4>
                            <p className="text-sm text-amber-800 leading-relaxed">{q.explanation}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function PracticeTestReport() {
    const { id, attemptId } = useParams();
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all'); // all | correct | incorrect

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const res = await api.get(`/practice-tests/${id}/attempts/${attemptId}`);
                setReportData(res.data.data);
            } catch (err) {
                setError(err?.response?.data?.message || 'Failed to load report');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [id, attemptId]);

    if (loading) {
        return <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
    }

    if (error || !reportData) {
        return (
                    <div className="text-center py-20">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></div>
                    <p className="text-slate-600 font-semibold text-lg">{error || 'Report not found'}</p>
                    <div className="flex gap-3 justify-center mt-4">
                        <Link to="/reports" className="text-violet-600 hover:underline">← My Reports</Link>
                        <Link to={`/practice-tests/${id}`} className="text-violet-600 hover:underline">Test Details</Link>
                    </div>
                </div>
    
        );
    }

    const {
        attempt, test, revealAnswersInReport, questionResults,
        sectionBreakdown, skillBreakdown, difficultyBreakdown, typeBreakdown,
        codingExecutionSummary, proctoringSummary, percentile, recommendations
    } = reportData;

    const downloadPDF = () => {
        const element = document.getElementById('report-content');
        const opt = {
            margin: 0.5,
            filename: `${test.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    };

    const correctCount = questionResults.filter(q => q.isCorrect).length;
    const incorrectCount = questionResults.length - correctCount;

    const filteredQuestions = questionResults.filter(q => {
        if (filter === 'correct') return q.isCorrect;
        if (filter === 'incorrect') return !q.isCorrect;
        return true;
    });

    const hasProctoringActivity = proctoringSummary && (
        proctoringSummary.tabSwitches > 0 || proctoringSummary.fullscreenExits > 0 ||
        proctoringSummary.copyPasteAttempts > 0 || proctoringSummary.devtoolsHeuristicTriggers > 0
    );

    return (
        <>
            <div className="max-w-4xl mx-auto space-y-6 py-6">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Link to="/reports" className="hover:text-violet-600 transition">📊 My Reports</Link>
                    <span>/</span>
                    <Link to={`/practice-tests/${id}`} className="hover:text-violet-600 transition truncate">{test.title}</Link>
                    <span>/</span>
                    <span className="text-slate-800 font-medium">Attempt #{attempt.attemptNumber}</span>
                </div>

                <div className="flex justify-end">
                    <button onClick={downloadPDF} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 transition flex items-center gap-2">
                        <span>⬇️</span> Download Report
                    </button>
                </div>

                <div id="report-content" className="space-y-6">
                    {/* Scoreboard Card */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className={`h-2 ${attempt.passed ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-red-400 to-rose-500'}`} />
                        <div className="p-8">
                            <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                                <div>
                                    <h1 className="text-2xl font-black text-slate-900">Performance Report</h1>
                                    <p className="text-slate-500 text-sm mt-1">{test.title} • {test.subject}</p>
                                    {attempt.completedAt && <p className="text-xs text-slate-400 mt-0.5">Submitted on {formatDate(attempt.completedAt)}</p>}
                                </div>
                                <span className={`px-4 py-2 rounded-xl font-black text-sm ${attempt.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {attempt.passed ? '✓ PASSED' : '✗ FAILED'}
                                </span>
                            </div>

                            <div className="mb-6">
                                <div className="flex items-center justify-between text-sm font-semibold text-slate-600 mb-2">
                                    <span>Score: {attempt.score} / {attempt.totalMarks}</span>
                                    <span className={`font-black text-lg ${attempt.passed ? 'text-emerald-600' : 'text-red-600'}`}>{attempt.percentage}%</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-1000 ${attempt.passed ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-red-400 to-rose-500'}`} style={{ width: `${attempt.percentage}%` }} />
                                </div>
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>0%</span>
                                    <span className="text-slate-500">Passing: {test.passingScore}%</span>
                                    <span>100%</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                                    <p className="text-2xl font-black text-emerald-700">{correctCount}</p>
                                    <p className="text-xs font-semibold text-emerald-600 mt-1">✓ Correct</p>
                                </div>
                                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
                                    <p className="text-2xl font-black text-red-700">{incorrectCount}</p>
                                    <p className="text-xs font-semibold text-red-600 mt-1">✗ Incorrect</p>
                                </div>
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
                                    <p className="text-2xl font-black text-blue-700">{formatTime(attempt.timeTaken)}</p>
                                    <p className="text-xs font-semibold text-blue-600 mt-1">⏱ Time</p>
                                </div>
                                <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-center">
                                    <p className="text-2xl font-black text-violet-700">{percentile !== null ? `${percentile}th` : '—'}</p>
                                    <p className="text-xs font-semibold text-violet-600 mt-1">Percentile</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section breakdown */}
                    {sectionBreakdown?.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <h2 className="font-bold text-slate-900 mb-3">Section Breakdown</h2>
                            <AccuracyBarChart data={sectionBreakdown.map(s => ({ key: s.name, accuracy: s.accuracy, correct: s.correct, total: s.total }))} />
                        </div>
                    )}

                    {/* Skill / difficulty / type breakdown */}
                    {(skillBreakdown?.length > 0 || difficultyBreakdown?.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {skillBreakdown?.length > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                    <h2 className="font-bold text-slate-900 mb-3">Accuracy by Skill</h2>
                                    <AccuracyBarChart data={skillBreakdown} />
                                </div>
                            )}
                            {difficultyBreakdown?.length > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                    <h2 className="font-bold text-slate-900 mb-3">Accuracy by Difficulty</h2>
                                    <AccuracyBarChart data={difficultyBreakdown} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Coding execution summary */}
                    {codingExecutionSummary && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <h2 className="font-bold text-slate-900 mb-3">Coding Questions</h2>
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="bg-slate-50 rounded-xl p-3"><p className="text-xl font-black text-slate-800">{codingExecutionSummary.questionsAttempted}</p><p className="text-xs text-slate-500">Attempted</p></div>
                                <div className="bg-slate-50 rounded-xl p-3"><p className="text-xl font-black text-slate-800">{codingExecutionSummary.avgPassRate}%</p><p className="text-xs text-slate-500">Avg. Pass Rate</p></div>
                                <div className="bg-slate-50 rounded-xl p-3"><p className="text-sm font-bold text-slate-800 truncate">{codingExecutionSummary.languages.join(', ') || '—'}</p><p className="text-xs text-slate-500">Languages</p></div>
                            </div>
                        </div>
                    )}

                    {/* Proctoring summary */}
                    {hasProctoringActivity && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                            <h2 className="font-bold text-amber-900 mb-3">Activity Log (best-effort, not a guarantee of misconduct)</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
                                <div><p className="font-black text-amber-800">{proctoringSummary.tabSwitches}</p><p className="text-xs text-amber-600">Tab switches</p></div>
                                <div><p className="font-black text-amber-800">{proctoringSummary.fullscreenExits}</p><p className="text-xs text-amber-600">Fullscreen exits</p></div>
                                <div><p className="font-black text-amber-800">{proctoringSummary.copyPasteAttempts}</p><p className="text-xs text-amber-600">Copy/paste attempts</p></div>
                                <div><p className="font-black text-amber-800">{proctoringSummary.devtoolsHeuristicTriggers}</p><p className="text-xs text-amber-600">Devtools heuristic hits</p></div>
                            </div>
                        </div>
                    )}

                    {/* Recommendations */}
                    {recommendations?.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
                            <h2 className="font-bold text-indigo-900 mb-3">💡 Recommendations</h2>
                            <ul className="space-y-1.5 text-sm text-indigo-800 list-disc list-inside">
                                {recommendations.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                        </div>
                    )}

                    {/* Questions Section */}
                    <div className="space-y-4">
                        {!revealAnswersInReport ? (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
                                The seller hasn't enabled detailed question review for this test — only your score and analytics above are shown. ({correctCount} correct, {incorrectCount} incorrect out of {questionResults.length})
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <h2 className="text-xl font-bold text-slate-900">
                                        Detailed Analysis
                                        <span className="text-slate-400 font-normal text-sm ml-2">({filteredQuestions.length} of {questionResults.length})</span>
                                    </h2>
                                    <div className="flex bg-slate-100 rounded-xl p-1 gap-1 text-xs font-bold">
                                        {[
                                            { key: 'all', label: `All (${questionResults.length})` },
                                            { key: 'correct', label: `✓ ${correctCount}` },
                                            { key: 'incorrect', label: `✗ ${incorrectCount}` },
                                        ].map(f => (
                                            <button key={f.key} onClick={() => setFilter(f.key)}
                                                className={`px-3 py-1.5 rounded-lg transition ${filter === f.key ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {filteredQuestions.map((q, idx) => <QuestionCard key={q._id} q={q} index={questionResults.indexOf(q)} />)}
                            </>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex gap-3 pb-4">
                    <Link to="/reports" className="flex-1 py-3 text-center bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition text-sm">← All Reports</Link>
                    <Link to={`/practice-tests/${id}`} className="flex-1 py-3 text-center bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition text-sm">Back to Test</Link>
                </div>
            </div>

        </>
    );
}

export default PracticeTestReport;
