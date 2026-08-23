import { useState, useEffect } from 'react';
import api from '../../lib/api';

const STATUS_COLORS = {
    not_started: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-indigo-100 text-indigo-700',
    awaiting_feedback: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    disputed: 'bg-orange-100 text-orange-700',
    no_show: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
};

function AdminInterviewSessions() {
    const [sessions, setSessions] = useState([]);
    const [completionStatus, setCompletionStatus] = useState('');
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/interview-sessions', { params: { completionStatus: completionStatus || undefined, page, limit: 25 } });
            setSessions(data.data || []);
            setPages(data.pages || 1);
            setTotal(data.total || 0);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    useEffect(() => { fetchSessions(); }, [completionStatus, page]);

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Interview Activity Log</h1>
                    <p className="text-slate-500">{total} sessions — attendance and completion status across the platform</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {['', 'not_started', 'in_progress', 'awaiting_feedback', 'completed', 'disputed', 'no_show', 'cancelled'].map(s => (
                        <button key={s} onClick={() => { setCompletionStatus(s); setPage(1); }}
                            className={`px-3.5 py-2 rounded-full text-xs font-semibold capitalize ${completionStatus === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                            {s ? s.replace('_', ' ') : 'All'}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : sessions.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">No sessions found.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-slate-500 border-b border-slate-100">{['Interview','Candidate','Interviewer','Scheduled','Attendance','Duration','Status'].map(h=><th key={h} className="p-4 font-medium">{h}</th>)}</tr></thead>
                            <tbody className="divide-y divide-slate-50">
                                {sessions.map(s => (
                                    <tr key={s._id} className="hover:bg-slate-50">
                                        <td className="p-4 font-medium text-slate-800">{s.interview?.domain || '—'}</td>
                                        <td className="p-4 text-slate-600">{s.candidate?.name}</td>
                                        <td className="p-4 text-slate-600">{s.interviewer?.name}</td>
                                        <td className="p-4 text-slate-500">{new Date(s.scheduledStart).toLocaleString()}</td>
                                        <td className="p-4 text-xs">
                                            <span className={s.attendance?.candidateJoined ? 'text-emerald-600' : 'text-slate-400'}>{s.attendance?.candidateJoined ? '✓' : '✗'} Candidate</span>
                                            {' • '}
                                            <span className={s.attendance?.interviewerJoined ? 'text-emerald-600' : 'text-slate-400'}>{s.attendance?.interviewerJoined ? '✓' : '✗'} Interviewer</span>
                                            {s.attendance?.noShow && <div className="text-red-500 mt-0.5">No-show: {s.attendance.noShow}</div>}
                                        </td>
                                        <td className="p-4 text-slate-500">{s.durationSeconds ? `${Math.round(s.durationSeconds / 60)}m` : '—'}</td>
                                        <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${STATUS_COLORS[s.completionStatus] || 'bg-slate-100 text-slate-600'}`}>{s.completionStatus.replace('_', ' ')}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {pages > 1 && (
                    <div className="flex items-center justify-center gap-3">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm disabled:opacity-40">← Prev</button>
                        <span className="text-sm text-slate-500">Page {page} of {pages}</span>
                        <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm disabled:opacity-40">Next →</button>
                    </div>
                )}
            </div>

        </>
    );
}

export default AdminInterviewSessions;
