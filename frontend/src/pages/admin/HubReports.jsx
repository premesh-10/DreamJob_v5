import { useState, useEffect } from 'react';
import api from '../../lib/api';

function AdminHubReports() {
    const [status, setStatus] = useState('pending');
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchReports = async () => {
        setLoading(true);
        try { const { data } = await api.get('/experiences/admin/reports', { params: { status } }); setReports(data.data || []); }
        catch (e) { console.error(e); } finally { setLoading(false); }
    };
    useEffect(() => { fetchReports(); }, [status]);

    const resolve = async (id, action) => {
        const resolutionNote = action === 'remove' ? (window.prompt('Resolution note (optional):') || '') : '';
        if (action === 'remove' && !window.confirm('This will remove the reported content and penalize the author. Continue?')) return;
        try { await api.put(`/experiences/admin/reports/${id}`, { action, resolutionNote }); fetchReports(); }
        catch (err) { alert(err.response?.data?.message || 'Failed to resolve report'); }
    };

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Interview Hub — Moderation</h1>
                    <p className="text-slate-500">Review reported experiences and comments</p>
                </div>

                <div className="flex gap-2">
                    {['pending', 'actioned', 'dismissed'].map(s => (
                        <button key={s} onClick={() => setStatus(s)} className={`px-3.5 py-2 rounded-full text-xs font-semibold capitalize ${status === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{s}</button>
                    ))}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : reports.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">No {status} reports.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {reports.map(r => (
                                <div key={r._id} className="p-5 flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 capitalize">{r.targetType}</span>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">{r.reason}</span>
                                        </div>
                                        <p className="text-sm text-slate-700">{r.details || <span className="text-slate-400">No additional details provided.</span>}</p>
                                        <p className="text-xs text-slate-400 mt-1">Reported by {r.reporter?.name} ({r.reporter?.email}) • Target ID: {r.targetId} • {new Date(r.createdAt).toLocaleString()}</p>
                                        {r.resolutionNote && <p className="text-xs text-slate-500 mt-1">Resolution: {r.resolutionNote}</p>}
                                    </div>
                                    {status === 'pending' && (
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button onClick={() => resolve(r._id, 'dismiss')} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200">Dismiss</button>
                                            <button onClick={() => resolve(r._id, 'remove')} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">Remove Content</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}

export default AdminHubReports;
