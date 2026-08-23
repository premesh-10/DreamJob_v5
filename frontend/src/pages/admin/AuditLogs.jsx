import { useState, useEffect } from 'react';
import api from '../../lib/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

function AdminAuditLogs() {
    const [logs, setLogs] = useState([]);
    const [action, setAction] = useState('');
    const [targetType, setTargetType] = useState('');
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/audit-logs', { params: { action: action || undefined, targetType: targetType || undefined, page, limit: 50 } });
            setLogs(data.data || []);
            setPages(data.pages || 1);
            setTotal(data.total || 0);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    useEffect(() => { fetchLogs(); }, [page]);
    const search = (e) => { e.preventDefault(); setPage(1); fetchLogs(); };

    return (
        <>
            <div className="max-w-5xl mx-auto space-y-6">
                <AdminPageHeader
                    icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    iconBg="from-slate-600 to-indigo-700"
                    title="Audit Log"
                    subtitle={`${total} recorded high-stakes actions across the platform`}
                />

                <form onSubmit={search} className="flex gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[220px]">
                        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input value={action} onChange={e => setAction(e.target.value)} placeholder="Search action (e.g. dispute.resolved)"
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white shadow-sm" />
                    </div>
                    <select value={targetType} onChange={e => setTargetType(e.target.value)}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                        <option value="">All target types</option>
                        <option value="InterviewSession">InterviewSession</option>
                        <option value="Dispute">Dispute</option>
                        <option value="Seller">Seller</option>
                        <option value="Settings">Settings</option>
                    </select>
                    <button type="submit"
                        className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm">
                        Search
                    </button>
                </form>

                <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="p-16 flex flex-col items-center gap-3 text-slate-400">
                            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Loading audit entries...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-16 text-center text-slate-400">
                            <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            No matching audit entries.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {logs.map(l => (
                                <div key={l._id} className="p-4 flex items-start justify-between gap-4 flex-wrap hover:bg-slate-50/50 transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">{l.action}</span>
                                            {l.targetType && <span className="text-xs px-2 py-0.5 rounded-md bg-primary-50 text-primary-600 border border-primary-100 font-medium">{l.targetType}</span>}
                                        </div>
                                        <p className="text-sm text-slate-500">
                                            {l.actor?.name ? <span className="font-medium text-slate-700">{l.actor.name}</span> : 'System'}
                                            {l.actor?.email && <span className="text-slate-400"> ({l.actor.email})</span>}
                                            {l.targetId && <span className="text-slate-400 font-mono text-xs ml-1">&rarr; {l.targetId}</span>}
                                        </p>
                                        {l.metadata && Object.keys(l.metadata).length > 0 && (
                                            <p className="text-xs text-slate-400 mt-1 font-mono truncate">{JSON.stringify(l.metadata)}</p>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {pages > 1 && (
                    <div className="flex items-center justify-center gap-3">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition shadow-sm">
                            Previous
                        </button>
                        <span className="text-sm text-slate-500">Page {page} of {pages}</span>
                        <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition shadow-sm">
                            Next
                        </button>
                    </div>
                )}
            </div>

        </>
    );
}

export default AdminAuditLogs;
