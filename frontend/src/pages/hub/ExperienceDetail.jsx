import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
import RecommendedPracticeTests from '../../components/practicetests/RecommendedPracticeTests';

const DIFFICULTY_LABELS = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];
const REPORT_REASONS = ['Confidential Info', 'NDA Violation', 'Misleading', 'Abusive', 'Plagiarized', 'Spam', 'Other'];

function ReportModal({ targetType, targetId, onClose, onReported }) {
    const [reason, setReason] = useState(REPORT_REASONS[0]);
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        setSubmitting(true); setError('');
        try {
            await api.post('/experiences/report', { targetType, targetId, reason, details });
            onReported();
            onClose();
        } catch (err) { setError(err.response?.data?.message || 'Failed to submit report'); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Report Content</h3>
                <label className="text-sm font-medium text-slate-700">Reason</label>
                <select value={reason} onChange={e => setReason(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3">
                    {REPORT_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
                <label className="text-sm font-medium text-slate-700">Details (optional)</label>
                <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                <div className="flex gap-3 mt-4">
                    <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm">Cancel</button>
                    <button onClick={submit} disabled={submitting} className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">{submitting ? 'Submitting...' : 'Submit Report'}</button>
                </div>
            </div>
        </div>
    );
}

function ExperienceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useSelector(s => s.auth);

    const [exp, setExp] = useState(null);
    const [liked, setLiked] = useState(false);
    const [bookmarked, setBookmarked] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [reportTarget, setReportTarget] = useState(null);
    const [flashMsg, setFlashMsg] = useState('');
    const [loading, setLoading] = useState(true);

    const flash = (msg) => { setFlashMsg(msg); setTimeout(() => setFlashMsg(''), 3000); };

    const fetchAll = async () => {
        try {
            const [expRes, commentsRes] = await Promise.all([
                api.get(`/experiences/${id}`),
                api.get(`/experiences/${id}/comments`),
            ]);
            setExp(expRes.data.data);
            setLiked(expRes.data.viewerHasLiked);
            setBookmarked(expRes.data.viewerHasBookmarked);
            setComments(commentsRes.data.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, [id]);

    const requireAuth = () => { if (!user) { navigate('/login'); return false; } return true; };

    const toggleLike = async () => {
        if (!requireAuth()) return;
        const { data } = await api.post(`/experiences/${id}/like`);
        setLiked(data.liked);
        setExp(e => ({ ...e, likesCount: data.likesCount }));
    };

    const toggleBookmark = async () => {
        if (!requireAuth()) return;
        const { data } = await api.post(`/experiences/${id}/bookmark`);
        setBookmarked(data.bookmarked);
        setExp(e => ({ ...e, bookmarksCount: data.bookmarksCount }));
    };

    const sharePost = async () => {
        const url = window.location.href;
        if (navigator.share) {
            navigator.share({ title: `Interview experience at ${exp.company?.name}`, url }).catch(() => {});
        } else {
            await navigator.clipboard.writeText(url);
            flash('Link copied to clipboard!');
        }
    };

    const submitComment = async (e) => {
        e.preventDefault();
        if (!requireAuth() || !commentText.trim()) return;
        const { data } = await api.post(`/experiences/${id}/comments`, { text: commentText });
        setComments(c => [data.data, ...c]);
        setExp(e => ({ ...e, commentsCount: e.commentsCount + 1 }));
        setCommentText('');
    };

    const likeComment = async (commentId) => {
        if (!requireAuth()) return;
        const { data } = await api.post(`/experiences/comments/${commentId}/like`);
        setComments(cs => cs.map(c => c._id === commentId ? { ...c, likesCount: data.likesCount } : c));
    };

    const deleteComment = async (commentId) => {
        if (!window.confirm('Delete this comment?')) return;
        await api.delete(`/experiences/comments/${commentId}`);
        setComments(cs => cs.filter(c => c._id !== commentId));
        setExp(e => ({ ...e, commentsCount: Math.max(0, e.commentsCount - 1) }));
    };

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
    if (!exp) return <div className="text-center py-20 text-slate-500">Experience not found.</div>;

    const resultColor = { Selected: 'bg-emerald-100 text-emerald-700', Rejected: 'bg-red-100 text-red-700', Pending: 'bg-amber-100 text-amber-700' }[exp.result];
    const isOwner = user && exp.user?._id === user._id;
    const sortedRounds = [...(exp.rounds || [])].sort((a, b) => a.order - b.order);

    return (
        <>
            <div className="max-w-4xl mx-auto space-y-6">
                <Link to={`/interview-hub/companies/${exp.company?.slug}`} className="text-sm text-slate-500 hover:text-slate-800">← Back to {exp.company?.name}</Link>

                {flashMsg && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-medium text-sm">{flashMsg}</div>}

                {/* Header */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{exp.jobRole} @ {exp.company?.name}</h1>
                            <p className="text-sm text-slate-500 mt-1">{exp.experienceLevel} • {exp.interviewMode} • via {exp.applicationSource === 'Other' ? exp.sourceOther : exp.applicationSource}</p>
                            <p className="text-xs text-slate-400 mt-1">Interviewed on {new Date(exp.interviewDate).toLocaleDateString()} • Difficulty: {exp.overallDifficulty}/5 ({DIFFICULTY_LABELS[exp.overallDifficulty]})</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${resultColor}`}>{exp.result}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">{exp.user?.name?.charAt(0)?.toUpperCase()}</div>
                        <div>
                            <p className="text-sm font-medium text-slate-800">{exp.user?.name || 'Anonymous'}</p>
                            <p className="text-xs text-slate-400">{exp.user?.hubLevel} • {exp.user?.contributionPoints} pts</p>
                        </div>
                        {isOwner && <Link to={`/interview-hub/submit?edit=${exp._id}`} className="ml-auto text-xs text-slate-500 hover:text-slate-800 font-medium">Edit</Link>}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 p-3">
                    <button onClick={toggleLike} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${liked ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{liked ? '❤️' : '🤍'} {exp.likesCount}</button>
                    <button onClick={toggleBookmark} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${bookmarked ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{bookmarked ? '🔖' : '📑'} Bookmark</button>
                    <button onClick={sharePost} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition">🔗 Share</button>
                    <span className="text-xs text-slate-400">👁️ {exp.viewCount} views</span>
                    {user && !isOwner && (
                        <button onClick={() => setReportTarget({ type: 'experience', id: exp._id })} className="ml-auto text-xs text-slate-400 hover:text-red-500">🚩 Report</button>
                    )}
                </div>

                {/* Overview */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-3">Interview Process</h2>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{exp.overallExperienceText}</p>
                </div>

                {/* Rounds */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-900">Interview Rounds ({sortedRounds.length})</h2>
                    {sortedRounds.map((r, i) => (
                        <div key={r._id || i} className="bg-white rounded-2xl border border-slate-200 p-5">
                            <h3 className="font-semibold text-slate-900 mb-3">Round {i + 1}: {r.roundType === 'Custom' ? r.customRoundType : r.roundType}</h3>
                            {r.questionsAsked?.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs font-semibold text-slate-500 mb-1">Questions Asked</p>
                                    <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">{r.questionsAsked.map((q, qi) => <li key={qi}>{q}</li>)}</ul>
                                </div>
                            )}
                            {r.codingProblems?.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs font-semibold text-slate-500 mb-1">Coding Problems</p>
                                    <div className="space-y-2">
                                        {r.codingProblems.map((p, pi) => (
                                            <div key={pi} className="p-2.5 bg-slate-50 rounded-lg text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-slate-800">{p.title}</span>
                                                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">{p.difficulty}</span>
                                                </div>
                                                {p.description && <p className="text-slate-600 text-xs mt-1">{p.description}</p>}
                                                {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="text-primary-600 text-xs hover:underline">View problem →</a>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {r.conceptsDiscussed?.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs font-semibold text-slate-500 mb-1">Concepts Discussed</p>
                                    <div className="flex flex-wrap gap-1.5">{r.conceptsDiscussed.map((c, ci) => <span key={ci} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{c}</span>)}</div>
                                </div>
                            )}
                            {r.preparationTips && (
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 mb-1">Preparation Tips</p>
                                    <p className="text-sm text-slate-700">{r.preparationTips}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Auto-matched practice tests for this company/role */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <RecommendedPracticeTests company={exp.company?._id} role={exp.jobRole}
                        title="📝 Practice for this role" emptyHint="No matching practice tests yet." />
                </div>

                {/* Resources / mistakes / advice */}
                {exp.resourcesShared?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-3">📚 Shared Resources</h2>
                        <div className="space-y-2">
                            {exp.resourcesShared.map((r, i) => (
                                <a key={i} href={r.url} target="_blank" rel="noreferrer" className="block p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
                                    <p className="text-sm font-medium text-primary-600">{r.title} ↗</p>
                                    {r.description && <p className="text-xs text-slate-500">{r.description}</p>}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
                {exp.mistakesToAvoid && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-3">⚠️ Mistakes to Avoid</h2>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{exp.mistakesToAvoid}</p>
                    </div>
                )}
                {exp.adviceForFutureCandidates && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-3">💡 Advice for Future Candidates</h2>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{exp.adviceForFutureCandidates}</p>
                    </div>
                )}

                {/* Comments */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Comments ({exp.commentsCount})</h2>
                    <form onSubmit={submitComment} className="flex gap-2 mb-5">
                        <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={user ? 'Add a helpful comment...' : 'Log in to comment'} disabled={!user}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 outline-none disabled:bg-slate-50" />
                        <button type="submit" disabled={!user} className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50">Post</button>
                    </form>
                    <div className="space-y-3">
                        {comments.map(c => (
                            <div key={c._id} className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">{c.user?.name?.charAt(0)?.toUpperCase()}</div>
                                <div className="flex-1">
                                    <div className="bg-slate-50 rounded-xl p-3">
                                        <p className="text-sm font-medium text-slate-800">{c.user?.name} <span className="text-xs text-slate-400 font-normal">{c.user?.hubLevel}</span></p>
                                        <p className="text-sm text-slate-700 mt-0.5">{c.text}</p>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 ml-1">
                                        <button onClick={() => likeComment(c._id)} className="text-xs text-slate-400 hover:text-rose-500">👍 {c.likesCount}</button>
                                        <span className="text-xs text-slate-300">{new Date(c.createdAt).toLocaleDateString()}</span>
                                        {user && (user._id === c.user?._id) && <button onClick={() => deleteComment(c._id)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>}
                                        {user && user._id !== c.user?._id && <button onClick={() => setReportTarget({ type: 'comment', id: c._id })} className="text-xs text-slate-400 hover:text-red-500">Report</button>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {reportTarget && (
                <ReportModal targetType={reportTarget.type} targetId={reportTarget.id} onClose={() => setReportTarget(null)} onReported={() => flash('Thanks — our team will review this.')} />
            )}

        </>
    );
}

export default ExperienceDetail;
