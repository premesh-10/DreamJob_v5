import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../lib/api';

const PENDING_STATUSES = ['not_started', 'in_progress'];
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 10; // ~30s — covers the brief gap between disconnect and the
                       // backend's end-of-room bookkeeping landing, without
                       // waiting anywhere near the cron sweep's ~30min worst case.

function StarPicker({ label, value, onChange }) {
    return (
        <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                    <button
                        type="button"
                        key={n}
                        onClick={() => onChange(n)}
                        className={`text-2xl leading-none ${n <= value ? 'text-amber-400' : 'text-slate-600'} hover:text-amber-300`}
                    >
                        ★
                    </button>
                ))}
            </div>
        </div>
    );
}

function InterviewFeedback() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);

    const [session, setSession] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [pollCount, setPollCount] = useState(0);
    const pollTimerRef = useRef(null);

    const [overallRating, setOverallRating] = useState(0);
    const [technicalRating, setTechnicalRating] = useState(0);
    const [communicationRating, setCommunicationRating] = useState(0);
    const [problemSolvingRating, setProblemSolvingRating] = useState(0);
    const [recommendation, setRecommendation] = useState('yes');
    const [comments, setComments] = useState('');
    const [issueReported, setIssueReported] = useState(false);
    const [issueDescription, setIssueDescription] = useState('');

    const fetchSession = async () => {
        const { data } = await api.get(`/interview-sessions/${sessionId}`);
        setSession(data.data);
        setRole(data.role);
        return data.data;
    };

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        (async () => {
            try {
                await fetchSession();
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load interview session');
            } finally {
                setLoading(false);
            }
        })();
        return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
    }, [user, sessionId]);

    // The room may disconnect (tab close, the built-in leave control, a flaky
    // connection) slightly before the backend's end-of-room bookkeeping has
    // actually landed. Rather than show a feedback form that's guaranteed to
    // be rejected with a confusing 400, poll briefly until completionStatus
    // moves out of the pending states.
    useEffect(() => {
        if (!session || !PENDING_STATUSES.includes(session.completionStatus)) return;
        if (pollCount >= MAX_POLLS) return;
        pollTimerRef.current = setTimeout(async () => {
            try {
                await fetchSession();
            } catch { /* transient — next tick or manual retry recovers */ }
            setPollCount(c => c + 1);
        }, POLL_INTERVAL_MS);
        return () => clearTimeout(pollTimerRef.current);
    }, [session, pollCount]);

    const alreadySubmitted = session && role && (role === 'interviewer' ? session.interviewerFeedback : session.candidateFeedback);
    const otherPartyName = role === 'candidate' ? (session?.interviewer?.name || 'the interviewer') : (session?.candidate?.name || 'the candidate');
    const isPending = session && PENDING_STATUSES.includes(session.completionStatus);
    const isBlocked = session && ['cancelled', 'no_show'].includes(session.completionStatus);

    const submit = async (e) => {
        e.preventDefault();
        if (!overallRating) { setError('Please give an overall rating'); return; }
        if (issueReported && !issueDescription.trim()) { setError('Please describe the issue you experienced'); return; }
        setSubmitting(true);
        setError('');
        try {
            const payload = {
                overallRating,
                comments,
                issueReported,
                issueDescription: issueReported ? issueDescription : undefined,
                ...(role === 'interviewer' ? { technicalRating, communicationRating, problemSolvingRating, recommendation } : {}),
            };
            await api.post(`/interview-sessions/${sessionId}/feedback`, payload);
            setSubmitted(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>;
    }

    if (error && !session) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
                <p className="text-red-400">{error}</p>
                <Link to="/history" className="text-indigo-400 hover:underline">← Back to Purchase History</Link>
            </div>
        );
    }

    if (role !== 'interviewer' && role !== 'candidate') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
                <p className="text-red-400">You are not authorized to leave feedback for this interview</p>
                <Link to="/history" className="text-indigo-400 hover:underline">← Back to Purchase History</Link>
            </div>
        );
    }

    if (isBlocked) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 text-center px-6">
                <p className="text-xl font-semibold capitalize">This interview was marked as {session.completionStatus.replace('_', ' ')}</p>
                <p className="text-slate-400 max-w-sm">Feedback isn't collected for this outcome. If you believe this is incorrect, please raise a dispute from your bookings page.</p>
                <Link to="/history" className="text-indigo-400 hover:underline mt-2">← Back to Purchase History</Link>
            </div>
        );
    }

    if (isPending) {
        const timedOut = pollCount >= MAX_POLLS;
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 text-center px-6">
                {!timedOut && <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
                <p className="text-xl font-semibold">{timedOut ? "This is taking longer than expected" : 'Wrapping up your session…'}</p>
                <p className="text-slate-400 max-w-sm">
                    {timedOut
                        ? "We're still finalizing this interview. Feedback will become available shortly — check back from Purchase History in a few minutes, or tap below to check again now."
                        : "Just a moment while we finalize the interview before you can leave feedback."}
                </p>
                {timedOut && (
                    <button
                        onClick={() => { setPollCount(0); fetchSession().catch(() => {}); }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold text-sm"
                    >
                        Check again
                    </button>
                )}
                <Link to="/history" className="text-indigo-400 hover:underline mt-2">← Back to Purchase History</Link>
            </div>
        );
    }

    if (submitted || alreadySubmitted) {
        const bothDone = session.completionStatus === 'completed' || session.completionStatus === 'disputed';
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 text-center px-6">
                {bothDone ? (
                    <>
                        <p className="text-2xl">✅</p>
                        <p className="text-xl font-semibold">
                            {session.completionStatus === 'disputed' ? 'Feedback submitted — dispute opened' : 'Feedback complete'}
                        </p>
                        <p className="text-slate-400 max-w-sm">
                            {session.completionStatus === 'disputed'
                                ? 'Our team has been notified and will review this interview.'
                                : 'Thanks for helping keep interviews high quality.'}
                        </p>
                    </>
                ) : (
                    <>
                        <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xl font-semibold">Thanks! Waiting for {otherPartyName}</p>
                        <p className="text-slate-400 max-w-sm">Your feedback has been recorded. This interview will be marked complete once {otherPartyName} submits theirs too.</p>
                    </>
                )}
                <Link to="/history" className="text-indigo-400 hover:underline mt-2">← Back to Purchase History</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white py-10 px-4">
            <form onSubmit={submit} className="max-w-lg mx-auto bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
                <div>
                    <h1 className="text-lg font-bold">How was your interview?</h1>
                    <p className="text-sm text-slate-400">with {otherPartyName} — {session.interview?.domain}</p>
                </div>

                {error && <div className="p-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg text-sm">{error}</div>}

                <StarPicker label="Overall rating" value={overallRating} onChange={setOverallRating} />

                {role === 'interviewer' && (
                    <>
                        <StarPicker label="Technical skills" value={technicalRating} onChange={setTechnicalRating} />
                        <StarPicker label="Communication" value={communicationRating} onChange={setCommunicationRating} />
                        <StarPicker label="Problem solving" value={problemSolvingRating} onChange={setProblemSolvingRating} />
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Would you recommend this candidate?</label>
                            <select value={recommendation} onChange={e => setRecommendation(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                                <option value="yes">Yes</option>
                                <option value="maybe">Maybe</option>
                                <option value="no">No</option>
                            </select>
                        </div>
                    </>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Comments</label>
                    <textarea
                        value={comments}
                        onChange={e => setComments(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        placeholder="Anything you'd like to share..."
                    />
                </div>

                <div className="border-t border-slate-700 pt-4">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input type="checkbox" checked={issueReported} onChange={e => setIssueReported(e.target.checked)} className="rounded" />
                        I'd like to report an issue with this interview
                    </label>
                    {issueReported && (
                        <textarea
                            value={issueDescription}
                            onChange={e => setIssueDescription(e.target.value)}
                            rows={3}
                            className="w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            placeholder="Describe what happened — this will open a dispute for our team to review."
                        />
                    )}
                </div>

                <button type="submit" disabled={submitting} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold disabled:opacity-60">
                    {submitting ? 'Submitting…' : 'Submit Feedback'}
                </button>
            </form>
        </div>
    );
}

export default InterviewFeedback;
