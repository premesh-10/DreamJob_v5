import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

const STATUS_COLORS = {
    pending: 'bg-amber-100 text-amber-700',
    under_review: 'bg-indigo-100 text-indigo-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    dismissed: 'bg-slate-100 text-slate-600',
};

function Disputes() {
    const [disputes, setDisputes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/disputes/mine');
                setDisputes(data.data || []);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load disputes');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <>
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">My Disputes</h1>
                    <p className="text-slate-500 text-sm">Issues raised on your mock interviews and their resolution status.</p>
                </div>

                {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

                {loading ? (
                    <div className="p-10 text-center text-slate-400">Loading...</div>
                ) : disputes.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                        No disputes raised yet. You can report an issue from the post-interview feedback form, or from your{' '}
                        <Link to="/history" className="text-indigo-600 hover:underline">Purchase History</Link>.
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                        {disputes.map(d => (
                            <div key={d._id} className="p-5 space-y-2">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800">{d.session?.interview?.domain || 'Mock Interview'}</span>
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 capitalize">{d.category.replace('_', ' ')}</span>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[d.status] || 'bg-slate-100 text-slate-600'}`}>
                                        {d.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600">{d.description}</p>
                                <p className="text-xs text-slate-400">
                                    Raised by {d.raisedBy?.name} against {d.against?.name} • {new Date(d.createdAt).toLocaleString()}
                                </p>
                                {d.status === 'resolved' && (
                                    <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm">
                                        <p><strong>Outcome:</strong> <span className="capitalize">{d.resolution.faultDetermination.replace('_', ' ')}</span></p>
                                        {d.resolution.refundAmount > 0 && (
                                            <p>Refund: ₹{d.resolution.refundAmount.toFixed(2)} {d.resolution.refundIssued ? '(issued)' : '(pending manual processing)'}</p>
                                        )}
                                        {d.resolution.note && <p className="text-slate-500 mt-1">{d.resolution.note}</p>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </>
    );
}

export default Disputes;
