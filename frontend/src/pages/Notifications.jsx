import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

const typeConfig = {
    info:    { iconPath: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z', iconColor: 'text-blue-600', iconBg: 'bg-blue-100', bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
    warning: { iconPath: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z', iconColor: 'text-amber-600', iconBg: 'bg-amber-100', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
    success: { iconPath: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
    alert:   { iconPath: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z', iconColor: 'text-red-600', iconBg: 'bg-red-100', bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
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

function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirm, setConfirm] = useState(null);
    const { user } = useSelector(state => state.auth);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
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
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="page-title">Notifications</h1>
                        <p className="text-slate-500 text-sm mt-0.5">
                            {loading ? 'Loading…' : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                    {!loading && notifications.length > 0 && (
                        <button
                            onClick={clearAll}
                            className="text-sm font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-4 py-2.5 rounded-xl transition-colors"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <span className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                            </svg>
                        </div>
                        <p className="text-lg font-semibold text-slate-700">All caught up!</p>
                        <p className="text-slate-400 mt-1.5 text-sm max-w-xs mx-auto">No notifications right now. We'll let you know when something happens.</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {notifications.map(n => {
                            const config = typeConfig[n.type] || typeConfig.info;
                            return (
                                <div
                                    key={n._id}
                                    className={`${config.bg} ${config.border} border rounded-2xl p-4 sm:p-5 flex gap-4 transition-shadow hover:shadow-sm`}
                                >
                                    <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center ${config.iconBg}`}>
                                        <svg className={`w-5 h-5 ${config.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                            <path strokeLinecap="round" strokeLinejoin="round" d={config.iconPath} />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`font-semibold text-sm ${config.text}`}>{n.title}</p>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 capitalize ${config.badge}`}>
                                                {n.type}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 mt-1 text-sm leading-relaxed">{n.message}</p>
                                        <p className="text-slate-400 text-xs mt-2">{formatTime(n.createdAt)}</p>
                                    </div>
                                    <button
                                        onClick={() => dismiss(n._id)}
                                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        title="Remove"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!loading && (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl text-slate-500 text-sm flex gap-3 items-start">
                        <svg className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                        </svg>
                        <p>Notifications are sent by platform admins targeted to <strong className="text-slate-600">all users</strong> and your account type <strong className="text-slate-600 capitalize">({user?.role})</strong>.</p>
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

export default Notifications;
