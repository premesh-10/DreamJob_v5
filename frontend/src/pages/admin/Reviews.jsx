import { useState, useEffect } from 'react';
import api from '../../lib/api';
import ExportButtons from '../../components/ExportButtons';

function StarDisplay({ rating }) {
    if (!rating) return <span className="text-slate-400 text-xs italic">No rating</span>;
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
                <span key={s} className={`text-sm ${s <= rating ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
            ))}
            <span className="text-xs text-slate-500 ml-1 font-medium">{rating}/5</span>
        </div>
    );
}

function AdminReviews() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');
    const [search, setSearch] = useState('');
    const [actionMsg, setActionMsg] = useState('');

    const fetchReviews = () => {
        setLoading(true);
        const url = tab === 'reported' ? '/admin/reviews?reported=true' : '/admin/reviews';
        api.get(url)
            .then(r => setReviews(r.data.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchReviews(); }, [tab]);

    const showMsg = (msg) => { setActionMsg(msg); setTimeout(() => setActionMsg(''), 3000); };

    const handleHide = async (id, isHidden) => {
        try {
            await api.patch(`/admin/reviews/${id}/hide`);
            showMsg(isHidden ? '✅ Review restored and visible' : '🙈 Review hidden from public');
            fetchReviews();
        } catch { showMsg('❌ Action failed'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Permanently delete this review? This cannot be undone.')) return;
        try {
            await api.delete(`/admin/reviews/${id}`);
            showMsg('🗑 Review permanently deleted');
            fetchReviews();
        } catch { showMsg('❌ Delete failed'); }
    };

    const filtered = reviews.filter(r =>
        !search ||
        r.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.review?.toLowerCase().includes(search.toLowerCase()) ||
        r.targetName?.toLowerCase().includes(search.toLowerCase())
    );

    const tabs = [
        { id: 'all', label: '📋 All Reviews', count: reviews.length },
        { id: 'reported', label: '🚩 Reported', count: reviews.filter(r => r.isReported).length },
    ];

    const typeStyles = {
        platform: 'bg-slate-100 text-slate-700',
        course: 'bg-blue-100 text-blue-700',
        interview: 'bg-purple-100 text-purple-700',
    };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Review Management</h1>
                        <p className="text-slate-500">Moderate user reviews and ratings across the platform</p>
                    </div>
                    <div className="flex gap-2">
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, content or target..."
                            className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72 shadow-sm" />
                        <ExportButtons
                            data={filtered}
                            filename="Reviews_Report"
                            columns={[
                                { header: 'User', key: 'user', format: (v) => v?.name || 'Unknown' },
                                { header: 'Email', key: 'user', format: (v) => v?.email || '' },
                                { header: 'Type', key: 'type' },
                                { header: 'Target', key: 'targetName', format: (v, row) => v || (row.type === 'platform' ? 'DreamJob' : '—') },
                                { header: 'Rating', key: 'rating', format: (v) => v ? `${v}/5` : 'N/A' },
                                { header: 'Review', key: 'review' },
                                { header: 'Status', key: 'isHidden', format: (v, row) => row.isReported ? 'Reported' : v ? 'Hidden' : 'Visible' },
                                { header: 'Date', key: 'createdAt', format: (v) => new Date(v).toLocaleDateString() },
                            ]}
                        />
                    </div>
                </div>

                {/* Action message toast */}
                {actionMsg && (
                    <div className="fixed top-4 right-4 z-50 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-xl text-sm font-medium animate-fade-in">
                        {actionMsg}
                    </div>
                )}

                {/* Summary cards */}
                {!loading && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Reviews', value: reviews.length, icon: '💬', color: 'from-blue-500 to-blue-600' },
                            { label: 'Reported', value: reviews.filter(r => r.isReported).length, icon: '🚩', color: 'from-red-500 to-red-600' },
                            { label: 'Hidden', value: reviews.filter(r => r.isHidden).length, icon: '🙈', color: 'from-slate-500 to-slate-600' },
                            { label: 'Course Reviews', value: reviews.filter(r => r.type === 'course').length, icon: '📚', color: 'from-emerald-500 to-emerald-600' },
                        ].map(c => (
                            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white shadow-lg`}>
                                <div className="text-2xl mb-1">{c.icon}</div>
                                <p className="text-white/70 text-xs">{c.label}</p>
                                <p className="text-3xl font-black">{c.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                            {t.label} ({t.count})
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-slate-400 text-sm">Loading reviews...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <span className="text-5xl block mb-3">💬</span>
                            <p className="font-semibold text-slate-600">{tab === 'reported' ? 'No reported reviews' : 'No reviews yet'}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        {['User', 'Type', 'Target', 'Rating', 'Review', 'Status', 'Reports', 'Actions'].map(h => (
                                            <th key={h} className="px-4 py-4 text-slate-500 font-medium whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map(r => (
                                        <tr key={r._id} className={`hover:bg-slate-50 transition align-top ${r.isHidden ? 'opacity-60' : ''}`}>
                                            <td className="px-4 py-4">
                                                <p className="font-semibold text-slate-800">{r.user?.name || 'Unknown'}</p>
                                                <p className="text-xs text-slate-400">{r.user?.email}</p>
                                                <p className="text-xs text-slate-300 mt-0.5">{new Date(r.createdAt).toLocaleDateString()}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeStyles[r.type] || 'bg-slate-100 text-slate-600'}`}>
                                                    {r.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-slate-600 text-xs max-w-[120px]">
                                                <p className="truncate">{r.targetName || (r.type === 'platform' ? 'DreamJob' : '—')}</p>
                                            </td>
                                            <td className="px-4 py-4"><StarDisplay rating={r.rating} /></td>
                                            <td className="px-4 py-4 max-w-[200px]">
                                                <p className="text-slate-700 text-xs leading-relaxed line-clamp-3">{r.review}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="space-y-1">
                                                    {r.isHidden && <span className="block px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">Hidden</span>}
                                                    {r.isReported && <span className="block px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">Reported</span>}
                                                    {!r.isHidden && !r.isReported && <span className="block px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full text-xs font-bold">Visible</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {r.reportCount > 0 ? (
                                                    <div>
                                                        <span className="font-bold text-red-600">{r.reportCount}x</span>
                                                        {r.reportReason && <p className="text-xs text-slate-400 mt-0.5 max-w-[100px] truncate">{r.reportReason}</p>}
                                                    </div>
                                                ) : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleHide(r._id, r.isHidden)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${r.isHidden ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>
                                                        {r.isHidden ? '👁 Show' : '🙈 Hide'}
                                                    </button>
                                                    <button onClick={() => handleDelete(r._id)}
                                                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition">
                                                        🗑 Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!loading && filtered.length > 0 && (
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                            Showing {filtered.length} review{filtered.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}

export default AdminReviews;
