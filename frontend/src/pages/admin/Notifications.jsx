import { useState, useEffect } from 'react';
import api from '../../lib/api';

const typeIcons = { info: 'ℹ️', warning: '⚠️', success: '✅', alert: '🔔' };
const typeColors = { info: 'bg-blue-100 text-blue-700', warning: 'bg-yellow-100 text-yellow-700', success: 'bg-emerald-100 text-emerald-700', alert: 'bg-red-100 text-red-700' };
const roleColors = { all: 'bg-slate-100 text-slate-700', user: 'bg-sky-100 text-sky-700', seller: 'bg-indigo-100 text-indigo-700', admin: 'bg-purple-100 text-purple-700' };

function ConfirmDialog({ message, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <p className="text-slate-800 font-semibold text-center">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-sm">Cancel</button>
                    <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition text-sm">Confirm</button>
                </div>
            </div>
        </div>
    );
}

function AdminNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ title: '', message: '', targetRole: 'all', type: 'info' });
    const [sending, setSending] = useState(false);
    const [msg, setMsg] = useState('');
    const [confirm, setConfirm] = useState(null);

    const fetchNotifications = async () => {
        setLoading(true);
        api.get('/admin/notifications').then(r => setNotifications(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
    };
    useEffect(() => { fetchNotifications(); }, []);

    const send = async e => {
        e.preventDefault(); setSending(true); setMsg('');
        try {
            await api.post('/admin/notifications', form);
            setForm({ title: '', message: '', targetRole: 'all', type: 'info' });
            setMsg('Notification sent!');
            fetchNotifications();
        } catch { setMsg('Failed to send'); }
        finally { setSending(false); }
    };

    const del = (id) => {
        setConfirm({
            message: 'Delete this notification? It will be removed for all recipients.',
            onConfirm: async () => {
                setConfirm(null);
                try {
                    await api.delete(`/admin/notifications/${id}`);
                    fetchNotifications();
                } catch { alert('Failed to delete'); }
            },
        });
    };

    const clearAll = () => {
        setConfirm({
            message: `Delete all ${notifications.length} notification${notifications.length !== 1 ? 's' : ''}? This will remove them for all recipients and cannot be undone.`,
            onConfirm: async () => {
                setConfirm(null);
                try {
                    await Promise.all(notifications.map(n => api.delete(`/admin/notifications/${n._id}`)));
                    fetchNotifications();
                } catch { alert('Failed to clear all notifications'); }
            },
        });
    };

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
                    <p className="text-slate-500">Broadcast messages to users, sellers, or everyone</p>
                </div>

                {/* Send form */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">📢 Send New Notification</h2>
                    {msg && <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${msg.includes('Failed') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{msg}</div>}
                    <form onSubmit={send} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title</label>
                                <input type="text" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} required placeholder="Notification title"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target</label>
                                    <select value={form.targetRole} onChange={e=>setForm(p=>({...p,targetRole:e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
                                        {['all','user','seller','admin'].map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type</label>
                                    <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
                                        {['info','warning','success','alert'].map(t=><option key={t} value={t}>{typeIcons[t]} {t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Message</label>
                                <textarea value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} required rows={3} placeholder="Notification message..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                            </div>
                        </div>
                        <button type="submit" disabled={sending} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-60 hover:bg-blue-700 transition">
                            {sending ? 'Sending...' : '📤 Send Notification'}
                        </button>
                    </form>
                </div>

                {/* History */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-800">Sent Notifications ({notifications.length})</h2>
                        {!loading && notifications.length > 0 && (
                            <button
                                onClick={clearAll}
                                className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition"
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                    {loading ? <div className="text-center py-10 text-slate-400">Loading...</div>
                    : notifications.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
                            <span className="text-4xl">🔔</span><p className="mt-2 text-sm">No notifications sent yet</p>
                        </div>
                    ) : notifications.map(n => (
                        <div key={n._id} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start justify-between gap-4 hover:shadow-sm transition">
                            <div className="flex items-start gap-3">
                                <span className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${typeColors[n.type]}`}>{typeIcons[n.type]}</span>
                                <div>
                                    <p className="font-bold text-slate-900">{n.title}</p>
                                    <p className="text-slate-500 text-sm mt-0.5">{n.message}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${roleColors[n.targetRole]}`}>→ {n.targetRole}</span>
                                        <span className="text-slate-400 text-xs">{new Date(n.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => del(n._id)}
                                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition"
                                title="Delete notification"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {confirm && (
                <ConfirmDialog
                    message={confirm.message}
                    onConfirm={confirm.onConfirm}
                    onCancel={() => setConfirm(null)}
                />
            )}

        </>
    );
}
export default AdminNotifications;
