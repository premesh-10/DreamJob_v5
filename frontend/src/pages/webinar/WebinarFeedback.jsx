import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';

function StarPicker({ value, onChange }) {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    type="button"
                    key={n}
                    onClick={() => onChange(n)}
                    className={`text-3xl leading-none ${n <= value ? 'text-amber-400' : 'text-slate-600'} hover:text-amber-300`}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

function WebinarFeedback() {
    const { webinarId } = useParams();
    const navigate = useNavigate();
    const { user } = useSelector(s => s.auth);

    const [webinar, setWebinar] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [rating, setRating] = useState(0);
    const [comments, setComments] = useState('');

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        (async () => {
            try {
                const [webinarRes, sessionRes] = await Promise.all([
                    api.get(`/webinars/${webinarId}`),
                    api.get(`/webinar-sessions/webinar/${webinarId}`),
                ]);
                setWebinar(webinarRes.data.data);
                setSessionId(sessionRes.data.data._id);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load webinar');
            } finally {
                setLoading(false);
            }
        })();
    }, [user, webinarId]);

    const submit = async (e) => {
        e.preventDefault();
        if (!rating) { setError('Please give a star rating'); return; }
        setSubmitting(true);
        setError('');
        try {
            await api.post(`/webinar-sessions/${sessionId}/feedback`, { rating, comments });
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

    if (error && !webinar) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
                <p className="text-red-400">{error}</p>
                <Link to="/webinars" className="text-indigo-400 hover:underline">← Back to Webinars</Link>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 text-center px-6">
                <p className="text-2xl">✅</p>
                <p className="text-xl font-semibold">Thanks for your feedback!</p>
                <p className="text-slate-400 max-w-sm">Your rating helps the host improve future webinars.</p>
                <Link to="/webinars" className="text-indigo-400 hover:underline mt-2">← Back to Webinars</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white py-10 px-4">
            <form onSubmit={submit} className="max-w-lg mx-auto bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
                <div>
                    <h1 className="text-lg font-bold">How was the webinar?</h1>
                    <p className="text-sm text-slate-400">{webinar?.name}</p>
                </div>

                {error && <div className="p-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg text-sm">{error}</div>}

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Overall rating</label>
                    <StarPicker value={rating} onChange={setRating} />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Comments (optional)</label>
                    <textarea
                        value={comments}
                        onChange={e => setComments(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        placeholder="What did you think?"
                    />
                </div>

                <button type="submit" disabled={submitting} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold disabled:opacity-60">
                    {submitting ? 'Submitting…' : 'Submit Feedback'}
                </button>

                <Link to="/webinars" className="block text-center text-sm text-slate-500 hover:text-slate-300">Skip for now</Link>
            </form>
        </div>
    );
}

export default WebinarFeedback;
