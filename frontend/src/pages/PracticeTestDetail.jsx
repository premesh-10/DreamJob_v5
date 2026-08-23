import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useSelector } from 'react-redux';

function PracticeTestDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await api.get(`/practice-tests/${id}`);
                setData(res.data.data);
            } catch (err) {
                setError(err?.response?.data?.message || 'Test not found');
            } finally { setLoading(false); }
        };
        fetch();
    }, [id]);

    const handleStart = () => {
        if (!user) { navigate('/login'); return; }
        navigate(`/practice-tests/${id}/quiz`);
    };

    if (loading) {
        return (
                    <div className="flex justify-center py-20">
                    <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
    
        );
    }

    if (error || !data) {
        return (
                    <div className="text-center py-20">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></div>
                    <p className="text-slate-600 font-semibold text-lg">{error || 'Test not found'}</p>
                    <Link to="/practice-tests" className="mt-4 inline-block text-violet-600 hover:underline">← Back to Practice Tests</Link>
                </div>
    
        );
    }

    const test = data;
    const myAttempts = data.myAttempts || [];
    const totalMarks = test.totalMarks || test.questions?.reduce((s, q) => s + (q.marks || 1), 0) || 0;
    const canAttempt = test.maxAttempts === 0 || myAttempts.filter(a => a.status === 'completed').length < test.maxAttempts;
    const bestAttempt = myAttempts.filter(a => a.status === 'completed').sort((a, b) => b.percentage - a.percentage)[0];
    const isSectionMode = test.sections?.length > 0;
    const security = test.security || {};
    const securityNotices = [];
    if (security.maxTabSwitches > 0) securityNotices.push(`Tab switching is limited to ${security.maxTabSwitches} time${security.maxTabSwitches !== 1 ? 's' : ''} — exceeding this will ${security.onLimitExceeded === 'terminate' ? 'end your attempt' : security.onLimitExceeded === 'auto_submit' ? 'auto-submit your test' : 'show a warning'}.`);
    if (security.requireFullscreen) securityNotices.push('This test must be taken in fullscreen mode.');
    if (security.disableCopyPaste) securityNotices.push('Copy, cut, and paste are restricted during this test.');
    if (security.disableRightClick) securityNotices.push('Right-click is disabled during this test.');
    if (security.disableTextSelection) securityNotices.push('Text selection is disabled during this test.');
    if (security.proctoringEnabled) securityNotices.push('Proctoring mode is enabled — browser focus, fullscreen, and tab-switch activity will be logged. This is best-effort monitoring and cannot detect every possible form of cheating.');

    return (
        <>
            <div className="max-w-4xl mx-auto space-y-6 py-4">
                {/* Back */}
                <Link to="/practice-tests" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition">
                    ← All Practice Tests
                </Link>

                {/* Hero Card */}
                <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 rounded-3xl p-8 text-white shadow-xl">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">{test.subject}</span>
                                {test.course && (
                                    <span className="bg-white/15 text-white/90 text-xs px-3 py-1 rounded-full">{test.course.title}</span>
                                )}
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black mb-2 leading-tight">{test.title}</h1>
                            {test.description && <p className="text-white/75 text-sm leading-relaxed max-w-xl">{test.description}</p>}
                        </div>
                        <button
                            onClick={handleStart}
                            disabled={!canAttempt || starting}
                            className={`flex-shrink-0 px-7 py-3.5 rounded-2xl font-bold text-base transition shadow-lg ${canAttempt ? 'bg-white text-violet-700 hover:bg-violet-50 hover:shadow-xl active:scale-95' : 'bg-white/20 text-white/50 cursor-not-allowed'}`}>
                            {starting ? 'Starting...' : canAttempt ? 'Start Test' : 'Max Attempts Reached'}
                        </button>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Questions', value: test.questionCount || test.questions?.length || 0, iconPath: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z', color: 'bg-violet-50 border-violet-200 text-violet-800' },
                        { label: 'Total Marks', value: totalMarks, iconPath: 'M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0 11.21 11.21 0 01-3.589 8.552m-.476-3.553A3.75 3.75 0 0112 10.5a3.75 3.75 0 01-3.476 3.747', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
                        { label: 'Time Limit', value: test.timeLimit > 0 ? `${test.timeLimit} min` : 'No limit', iconPath: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-blue-50 border-blue-200 text-blue-800' },
                        { label: 'Passing Score', value: `${test.passingScore}%`, iconPath: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                    ].map(s => (
                        <div key={s.label} className={`${s.color} border rounded-2xl p-4 text-center`}>
                            <div className="w-8 h-8 mx-auto mb-1"><svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d={s.iconPath} /></svg></div>
                            <p className="text-xl font-black">{s.value}</p>
                            <p className="text-xs font-medium opacity-60 mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Test Settings */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h2 className="font-bold text-slate-900 mb-4">Test Settings</h2>
                        <div className="space-y-3">
                            {[
                                { label: 'Attempts Allowed', value: test.maxAttempts === 0 ? 'Unlimited' : `${test.maxAttempts} attempt${test.maxAttempts !== 1 ? 's' : ''}` },
                                { label: 'Per-Question Timer', value: test.hasPerQuestionTimer ? 'Enabled' : 'Disabled' },
                                { label: 'Question Shuffle', value: test.shuffleQuestions ? 'Yes' : 'No' },
                                { label: 'Option Shuffle', value: test.shuffleOptions ? 'Yes' : 'No' },
                                { label: 'Show Results', value: test.showResultsImmediately ? 'After submission' : 'Later' },
                                { label: 'Negative Marking', value: test.negativeMarking?.enabled ? `-${test.negativeMarking.perWrongAnswer} per wrong answer` : 'Disabled' },
                                { label: 'Resume on Refresh', value: test.allowResume ? 'Allowed' : 'Not allowed' },
                                { label: 'Calculator', value: test.allowCalculator ? 'Available' : 'Not available' },
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                                    <span className="text-sm text-slate-500">{item.label}</span>
                                    <span className="text-sm font-semibold text-slate-800">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* My Attempts */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-slate-900">My Attempts</h2>
                            {bestAttempt && (
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${bestAttempt.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    Best: {bestAttempt.percentage}%
                                </span>
                            )}
                        </div>

                        {myAttempts.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 mx-auto mb-2 text-slate-300"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg></div>
                                <p className="text-slate-500 text-sm">You haven't taken this test yet.</p>
                                <button onClick={handleStart} disabled={!canAttempt}
                                    className="mt-3 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition">
                                    Take Test Now
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto">
                                {myAttempts.map((attempt, idx) => (
                                    <div key={attempt._id} className={`flex items-center gap-3 p-3 rounded-xl border ${attempt.passed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${attempt.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {attempt.percentage}%
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-800">Attempt #{attempt.attemptNumber || idx + 1}</span>
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${attempt.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                                                    {attempt.passed ? '✓ PASS' : '✗ FAIL'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {attempt.score}/{attempt.totalMarks} marks
                                                {attempt.timeTaken ? ` • ${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s` : ''}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                            <span className="text-xs text-slate-400">
                                                {new Date(attempt.createdAt).toLocaleDateString()}
                                            </span>
                                            {attempt.status === 'completed' && (
                                                <Link to={`/practice-tests/${test._id}/attempts/${attempt._id}`} className="text-xs font-bold text-violet-600 hover:text-violet-700 hover:underline">
                                                    View Report →
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {canAttempt && myAttempts.length > 0 && (
                            <button onClick={handleStart} className="w-full mt-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:shadow-md transition">
                                🔁 Retake Test
                            </button>
                        )}
                        {myAttempts.filter(a => a.status === 'completed').length > 0 && (
                            <Link to="/reports" className="block w-full mt-2 py-2.5 text-center text-sm font-semibold text-violet-600 hover:underline">
                                📊 View all reports →
                            </Link>
                        )}
                    </div>
                </div>

                {/* Section breakdown */}
                {isSectionMode && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h2 className="font-bold text-slate-900 mb-4">🗂️ Section Breakdown</h2>
                        <div className="space-y-2">
                            {test.sections.map((s, idx) => (
                                <div key={s._id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">{idx + 1}</span>
                                        <span className="text-sm font-semibold text-slate-800">{s.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                        <span>{s.questionRefs?.length || 0} question{s.questionRefs?.length !== 1 ? 's' : ''}</span>
                                        {s.timeLimit > 0 && <span>⏱️ {s.timeLimit} min</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Security & proctoring disclosure — shown before starting, per platform policy */}
                {securityNotices.length > 0 && (
                    <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
                        <h2 className="font-bold text-amber-900 mb-3">🔒 Security &amp; Proctoring Notice</h2>
                        <ul className="space-y-2 text-sm text-amber-800">
                            {securityNotices.map((notice, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                    <span className="mt-0.5">•</span>
                                    <span>{notice}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Tags */}
                {test.tags?.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-500 font-medium">Tags:</span>
                        {test.tags.map(tag => (
                            <span key={tag} className="text-sm bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{tag}</span>
                        ))}
                    </div>
                )}
            </div>

        </>
    );
}

export default PracticeTestDetail;
