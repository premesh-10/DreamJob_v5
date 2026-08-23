import { useState, useEffect } from 'react';
import api from '../../lib/api';
import ExportButtons from '../../components/ExportButtons';

const typeConfig = {
    platform: { icon: '🌐', badge: 'bg-slate-100 text-slate-700', label: 'Platform' },
    course:   { icon: '📚', badge: 'bg-blue-100 text-blue-700',   label: 'Course' },
    interview: { icon: '🎙️', badge: 'bg-purple-100 text-purple-700', label: 'Interview' },
};

const categoryLabels = {
    general: '💬 General',
    bug: '🐛 Bug Report',
    feature_request: '✨ Feature Request',
    content_quality: '📚 Content Quality',
    ui_ux: '🎨 UI/UX',
    payment: '💳 Payment',
};

function StarDisplay({ rating }) {
    if (!rating) return <span className="text-slate-400 text-xs">No rating</span>;
    return (
        <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(s => (
                <span key={s} className={`text-sm ${s <= rating ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
            ))}
            <span className="text-xs text-slate-500 ml-1">{rating}/5</span>
        </div>
    );
}

function AdminFeedback() {
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        api.get('/admin/feedback')
            .then(r => setFeedback(r.data.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = feedback
        .filter(f => tab === 'all' || f.type === tab)
        .filter(f =>
            !search ||
            f.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
            f.review?.toLowerCase().includes(search.toLowerCase()) ||
            f.category?.toLowerCase().includes(search.toLowerCase())
        );

    const tabs = [
        { id: 'all', label: 'All', count: feedback.length },
        { id: 'platform', label: '🌐 Platform', count: feedback.filter(f => f.type === 'platform').length },
        { id: 'course', label: '📚 Course', count: feedback.filter(f => f.type === 'course').length },
        { id: 'interview', label: '🎙️ Interview', count: feedback.filter(f => f.type === 'interview').length },
    ];

    const avgRating = feedback.filter(f => f.rating).length > 0
        ? (feedback.filter(f => f.rating).reduce((s, f) => s + f.rating, 0) / feedback.filter(f => f.rating).length).toFixed(1)
        : null;

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Feedback & Reviews</h1>
                        <p className="text-slate-500">User-submitted platform feedback, course ratings, and interview reviews</p>
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search feedback..."
                            className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm"
                        />
                        <ExportButtons
                            data={filtered}
                            filename="Feedback_Report"
                            columns={[
                                { header: 'Type', key: 'type' },
                                { header: 'User', key: 'user', format: (v) => v?.name || 'Anonymous' },
                                { header: 'Email', key: 'user', format: (v) => v?.email || '' },
                                { header: 'Category', key: 'category' },
                                { header: 'Rating', key: 'rating', format: (v) => v ? `${v}/5` : 'N/A' },
                                { header: 'Feedback', key: 'review' },
                                { header: 'Date', key: 'createdAt', format: (v) => new Date(v).toLocaleDateString() },
                            ]}
                        />
                    </div>
                </div>

                {/* Summary cards */}
                {!loading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Feedback', value: feedback.length, icon: '💬', color: 'from-blue-500 to-blue-600' },
                            { label: 'Platform Reports', value: feedback.filter(f => f.type === 'platform').length, icon: '🌐', color: 'from-slate-600 to-slate-700' },
                            { label: 'Course Ratings', value: feedback.filter(f => f.type === 'course').length, icon: '📚', color: 'from-emerald-500 to-emerald-600' },
                            { label: 'Avg Rating', value: avgRating ? `${avgRating} ★` : 'N/A', icon: '⭐', color: 'from-amber-500 to-amber-600' },
                        ].map(c => (
                            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white shadow-lg`}>
                                <div className="text-2xl mb-2">{c.icon}</div>
                                <p className="text-white/70 text-xs font-medium">{c.label}</p>
                                <p className="text-3xl font-black mt-1">{c.value}</p>
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
                            <p className="text-slate-400 text-sm">Loading feedback...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <span className="text-5xl block mb-3">💬</span>
                            <p className="font-semibold text-slate-600">No feedback yet</p>
                            <p className="text-sm mt-1">User feedback will appear here once submitted</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        {['Type', 'User', 'Category', 'Target', 'Rating', 'Feedback', 'Date'].map(h => (
                                            <th key={h} className="px-5 py-4 text-slate-500 font-medium">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map(f => {
                                        const tc = typeConfig[f.type] || typeConfig.platform;
                                        return (
                                            <tr key={f._id} className="hover:bg-slate-50 transition align-top">
                                                <td className="px-5 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${tc.badge}`}>
                                                        {tc.icon} {tc.label}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="font-semibold text-slate-800">{f.user?.name || 'Anonymous'}</p>
                                                    <p className="text-xs text-slate-400">{f.user?.email}</p>
                                                </td>
                                                <td className="px-5 py-4 text-slate-600 text-xs">
                                                    {categoryLabels[f.category] || f.category || '—'}
                                                </td>
                                                <td className="px-5 py-4 text-slate-500 text-xs">
                                                    {f.targetName || (f.type === 'platform' ? 'DreamJob Platform' : '—')}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <StarDisplay rating={f.rating} />
                                                </td>
                                                <td className="px-5 py-4 max-w-sm">
                                                    <p className="text-slate-700 leading-relaxed text-sm line-clamp-3">{f.review}</p>
                                                </td>
                                                <td className="px-5 py-4 text-slate-400 text-xs whitespace-nowrap">
                                                    {new Date(f.createdAt).toLocaleDateString('en-US', {
                                                        month: 'short', day: 'numeric', year: 'numeric'
                                                    })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!loading && filtered.length > 0 && (
                        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                            Showing {filtered.length} of {feedback.length} submissions
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}

export default AdminFeedback;
