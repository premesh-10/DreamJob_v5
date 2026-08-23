import { useState, useEffect } from 'react';
import api from '../../lib/api';

function ResolveForm({ dispute, onClose, onDone }) {
    const [faultDetermination, setFaultDetermination] = useState('unresolved');
    const [refundAmount, setRefundAmount] = useState(0);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const maxRefund = dispute.booking?.amountPaid || 0;

    const submit = async () => {
        setSaving(true);
        setError('');
        try {
            await api.patch(`/admin/disputes/${dispute._id}/resolve`, { faultDetermination, refundAmount: Number(refundAmount), note });
            onDone();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resolve dispute');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Resolve Dispute</h3>
                {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fault determination</label>
                    <select value={faultDetermination} onChange={e => setFaultDetermination(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                        <option value="interviewer">Interviewer at fault</option>
                        <option value="candidate">Candidate at fault</option>
                        <option value="platform">Platform issue</option>
                        <option value="none">No fault found</option>
                        <option value="unresolved">Unresolved / inconclusive</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Refund amount (₹) — paid: ₹{maxRefund.toFixed(2)}</label>
                    <input type="number" min="0" max={maxRefund} step="0.01" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Note to both parties</label>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2 pt-2">
                    <button onClick={onClose} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold">Cancel</button>
                    <button onClick={submit} disabled={saving} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
                        {saving ? 'Saving…' : 'Confirm Resolution'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function AdminDisputes() {
    const [status, setStatus] = useState('pending');
    const [disputes, setDisputes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [resolveTarget, setResolveTarget] = useState(null);

    const fetchDisputes = async () => {
        setLoading(true);
        try { const { data } = await api.get('/admin/disputes', { params: { status } }); setDisputes(data.data || []); }
        catch (e) { console.error(e); } finally { setLoading(false); }
    };
    useEffect(() => { fetchDisputes(); }, [status]);

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Interview Disputes</h1>
                    <p className="text-slate-500">Review and resolve disputes raised on mock interviews</p>
                </div>

                <div className="flex gap-2">
                    {['pending', 'under_review', 'resolved', 'dismissed'].map(s => (
                        <button key={s} onClick={() => setStatus(s)} className={`px-3.5 py-2 rounded-full text-xs font-semibold capitalize ${status === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{s.replace('_', ' ')}</button>
                    ))}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : disputes.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">No {status.replace('_', ' ')} disputes.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {disputes.map(d => (
                                <div key={d._id} className="p-5 flex items-start justify-between gap-4 flex-wrap">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 capitalize">{d.category.replace('_', ' ')}</span>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{d.session?.interview?.domain || 'Mock Interview'}</span>
                                            {d.session?.recording?.status === 'ready' && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">🎥 Recording available</span>}
                                        </div>
                                        <p className="text-sm text-slate-700">{d.description}</p>
                                        <p className="text-xs text-slate-400">
                                            Raised by {d.raisedBy?.name} ({d.raisedByRole}) against {d.against?.name} • Paid ₹{(d.booking?.amountPaid || 0).toFixed(2)} • {new Date(d.createdAt).toLocaleString()}
                                        </p>
                                        {d.status === 'resolved' && (
                                            <p className="text-xs text-slate-500">
                                                Resolved: <span className="capitalize">{d.resolution.faultDetermination.replace('_', ' ')}</span>
                                                {d.resolution.refundAmount > 0 && ` • Refund ₹${d.resolution.refundAmount.toFixed(2)} ${d.resolution.refundIssued ? '(issued)' : '(pending)'}`}
                                                {d.resolution.note && ` • "${d.resolution.note}"`}
                                            </p>
                                        )}
                                    </div>
                                    {['pending', 'under_review'].includes(d.status) && (
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button onClick={() => setResolveTarget(d)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">Resolve</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {resolveTarget && (
                <ResolveForm dispute={resolveTarget} onClose={() => setResolveTarget(null)}
                    onDone={() => { setResolveTarget(null); fetchDisputes(); }} />
            )}

        </>
    );
}

export default AdminDisputes;
