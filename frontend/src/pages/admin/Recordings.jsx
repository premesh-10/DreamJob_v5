import { useState, useEffect } from 'react';
import api from '../../lib/api';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

const STATUS_COLORS = {
    ready: 'bg-emerald-100 text-emerald-700',
    processing: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
};

function PlayerModal({ session, onClose }) {
    const [src, setSrc] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get(`/admin/recordings/${session._id}/stream-token`);
                setSrc(`${API_BASE}/api/v1/recording-stream/${session._id}?token=${data.data.token}`);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load recording');
            }
        })();
    }, [session._id]);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">{session.interview?.domain} — {session.candidate?.name} / {session.interviewer?.name}</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                </div>
                {error ? (
                    <p className="text-red-500 text-sm">{error}</p>
                ) : src ? (
                    <video src={src} controls className="w-full rounded-xl bg-black" style={{ maxHeight: '70vh' }} />
                ) : (
                    <div className="p-10 text-center text-slate-400">Loading player…</div>
                )}
                <p className="text-xs text-slate-400">Playback link expires in ~2 minutes for security — reopen this player if it stops working.</p>
            </div>
        </div>
    );
}

function AdminRecordings() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [playing, setPlaying] = useState(null);

    useEffect(() => {
        api.get('/admin/recordings').then(r => setSessions(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
    }, []);

    return (
        <>
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Interview Recordings</h1>
                    <p className="text-slate-500">Moderation-only library — every playback is audit-logged</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : sessions.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">No recordings yet.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead><tr className="text-left text-slate-500 border-b border-slate-100">{['Interview','Candidate','Interviewer','Date','Status',''].map(h=><th key={h} className="p-4 font-medium">{h}</th>)}</tr></thead>
                            <tbody className="divide-y divide-slate-50">
                                {sessions.map(s => (
                                    <tr key={s._id} className="hover:bg-slate-50">
                                        <td className="p-4 font-medium text-slate-800">{s.interview?.domain || '—'}</td>
                                        <td className="p-4 text-slate-600">{s.candidate?.name}</td>
                                        <td className="p-4 text-slate-600">{s.interviewer?.name}</td>
                                        <td className="p-4 text-slate-500">{new Date(s.scheduledStart).toLocaleDateString()}</td>
                                        <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${STATUS_COLORS[s.recording?.status] || 'bg-slate-100 text-slate-600'}`}>{s.recording?.status}</span></td>
                                        <td className="p-4">
                                            {s.recording?.status === 'ready' && (
                                                <button onClick={() => setPlaying(s)} className="text-indigo-600 hover:underline text-xs font-semibold">▶ Play</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {playing && <PlayerModal session={playing} onClose={() => setPlaying(null)} />}

        </>
    );
}

export default AdminRecordings;
