import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

const typeConfig = {
    info:    { icon: 'ℹ️', bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700' },
    warning: { icon: '⚠️', bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
    success: { icon: '✅', bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    alert:   { icon: '🚨', bg: 'bg-red-50',      border: 'border-red-200',    text: 'text-red-700',     badge: 'bg-red-100 text-red-700' },
};

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

function SellerNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirm, setConfirm] = useState(null);
    const { user } = useSelector(state => state.auth);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) { navigate('/seller/login'); return; }
        api.get('/notifications/me')
            .then(r => setNotifications(r.data.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));

        api.patch('/notifications/read').catch(console.error);
    }, [user, navigate]);

    const formatTime = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const dismiss = (id) => {
        setConfirm({
            message: 'Remove this notification?',
            onConfirm: async () => {
                setConfirm(null);
                await api.delete(`/notifications/${id}`).catch(console.error);
                setNotifications(prev => prev.filter(n => n._id !== id));
            },
        });
    };

    const clearAll = () => {
        setConfirm({
            message: `Clear all ${notifications.length} notification${notifications.length !== 1 ? 's' : ''}? This cannot be undone.`,
            onConfirm: async () => {
                setConfirm(null);
                await api.delete('/notifications').catch(console.error);
                setNotifications([]);
            },
        });
    };

    return (
        <>
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">Notifications</h1>
                        <p className="text-slate-500 mt-1">
                            {loading ? 'Loading...' : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {!loading && notifications.length > 0 && (
                            <button
                                onClick={clearAll}
                                className="px-4 py-2.5 text-sm font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition"
                            >
                                Clear All
                            </button>
                        )}
                        <div className="w-11 h-11 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl flex items-center justify-center text-xl shadow-sm border border-indigo-200">🔔</div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-6xl mb-4">🔔</div>
                        <p className="text-xl font-bold text-slate-800">All caught up!</p>
                        <p className="text-slate-500 mt-2 text-sm">You have no notifications right now. We'll let you know when something important happens.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {notifications.map(n => {
                            const config = typeConfig[n.type] || typeConfig.info;
                            return (
                                <div
                                    key={n._id}
                                    className={`${config.bg} ${config.border} border rounded-2xl p-5 flex gap-4 transition hover:shadow-sm`}
                                >
                                    <div className="text-2xl flex-shrink-0 mt-0.5">{config.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 flex-wrap">
                                            <p className={`font-bold text-base ${config.text}`}>{n.title}</p>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${config.badge}`}>
                                                {n.type}
                                            </span>
                                        </div>
                                        <p className="text-slate-700 mt-1.5 text-sm leading-relaxed">{n.message}</p>
                                        <p className="text-slate-400 text-xs mt-3 font-medium">{formatTime(n.createdAt)}</p>
                                    </div>
                                    <button
                                        onClick={() => dismiss(n._id)}
                                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition"
                                        title="Remove notification"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
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

export default SellerNotifications;
