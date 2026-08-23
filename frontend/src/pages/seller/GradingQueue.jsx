import { useState, useEffect } from 'react';
import api from '../../lib/api';

function GradeModal({ item, onClose, onGraded }) {
    const [marks, setMarks] = useState('');
    const [feedback, setFeedback] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (marks === '' || Number(marks) < 0) return setError('Enter marks to award');
        setLoading(true);
        try {
            await api.patch(`/grading/attempts/${item.attemptId}/questions/${item.questionId}`, {
                marksAwarded: Number(marks), feedback
            });
            onGraded();
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to grade');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Grade Subjective Answer</h2>
                        <p className="text-sm text-slate-500">{item.test.title} • {item.user?.name}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1.5">Question</p>
                        <p className="text-sm text-slate-800 bg-slate-50 rounded-xl p-3">{item.questionText}</p>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1.5">Student's Answer</p>
                        <p className="text-sm text-slate-800 bg-violet-50 rounded-xl p-3 whitespace-pre-wrap">{item.subjectiveAnswerText || <span className="italic text-slate-400">No answer submitted</span>}</p>
                    </div>
                    {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Marks Awarded <span className="text-slate-400 font-normal">(out of {item.marksAvailable})</span></label>
                            <input type="number" value={marks} onChange={e => setMarks(e.target.value)} min="0" max={item.marksAvailable} step="0.5"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Feedback <span className="text-slate-400 font-normal">(optional, shown to student)</span></label>
                            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-violet-500 outline-none resize-none" />
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200">Cancel</button>
                            <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-60">
                                {loading ? 'Saving...' : 'Submit Grade'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

function GradingQueue() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [gradingItem, setGradingItem] = useState(null);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/grading/pending');
            setItems(data.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchPending(); }, []);

    return (
        <>
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Grading Queue</h1>
                    <p className="text-slate-500 mt-1">{items.length} subjective answer{items.length !== 1 ? 's' : ''} awaiting manual grading</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : items.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                        <span className="text-6xl">✍️</span>
                        <p className="text-slate-600 font-semibold mt-4 text-lg">All caught up!</p>
                        <p className="text-slate-400 text-sm mt-1">No subjective answers are waiting for grading.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map(item => (
                            <div key={`${item.attemptId}-${item.questionId}`} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{item.test.title}</span>
                                        <span className="text-xs text-slate-400">{item.user?.name} ({item.user?.email})</span>
                                        <span className="text-xs text-slate-400">{new Date(item.completedAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-800 line-clamp-2">{item.questionText}</p>
                                </div>
                                <button onClick={() => setGradingItem(item)}
                                    className="flex-shrink-0 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
                                    Grade
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {gradingItem && (
                <GradeModal item={gradingItem} onClose={() => setGradingItem(null)} onGraded={fetchPending} />
            )}

        </>
    );
}

export default GradingQueue;
