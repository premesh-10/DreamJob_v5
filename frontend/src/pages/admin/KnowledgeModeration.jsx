import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

const STATUS_TABS = [
    { key: 'pending_review', label: 'Pending Review' },
    { key: 'published', label: 'Published' },
    { key: 'rejected', label: 'Rejected' },
    { key: '', label: 'All' },
];

const STATUS_STYLE = {
    draft: 'bg-slate-100 text-slate-600',
    pending_review: 'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    archived: 'bg-slate-100 text-slate-500',
};

function formatDate(d) {
    return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}

export default function KnowledgeModeration() {
    const [articles, setArticles] = useState([]);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('pending_review');
    const [searchQ, setSearchQ] = useState('');
    const [acting, setActing] = useState(null);
    const [rejectModal, setRejectModal] = useState(null); // { id, title }
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        api.get('/knowledge/admin/stats').then(r => setStats(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        setLoading(true);
        const params = { limit: 50 };
        if (statusFilter) params.status = statusFilter;
        if (searchQ) params.q = searchQ;
        api.get('/knowledge/admin/articles', { params })
            .then(r => { setArticles(r.data.articles); setTotal(r.data.total); })
            .finally(() => setLoading(false));
    }, [statusFilter, searchQ]);

    const handleApprove = async (id) => {
        setActing(id + '-approve');
        try {
            await api.post(`/knowledge/admin/${id}/approve`);
            setArticles(prev => prev.map(a => a._id === id ? { ...a, status: 'published' } : a));
            setStats(s => ({ ...s, pending: Math.max(0, (s.pending || 0) - 1), published: (s.published || 0) + 1 }));
        } catch (e) { alert(e.response?.data?.message || 'Failed'); } finally { setActing(null); }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) return;
        const { id } = rejectModal;
        setActing(id + '-reject');
        try {
            await api.post(`/knowledge/admin/${id}/reject`, { reason: rejectReason.trim() });
            setArticles(prev => prev.map(a => a._id === id ? { ...a, status: 'rejected', rejectionReason: rejectReason } : a));
            setStats(s => ({ ...s, pending: Math.max(0, (s.pending || 0) - 1) }));
            setRejectModal(null);
            setRejectReason('');
        } catch (e) { alert(e.response?.data?.message || 'Failed'); } finally { setActing(null); }
    };

    const handleFeature = async (id, current) => {
        setActing(id + '-feature');
        try {
            await api.post(`/knowledge/admin/${id}/feature`);
            setArticles(prev => prev.map(a => a._id === id ? { ...a, isFeatured: !current } : a));
        } catch { } finally { setActing(null); }
    };

    const handleEditorsPick = async (id, current) => {
        setActing(id + '-ep');
        try {
            await api.post(`/knowledge/admin/${id}/editors-pick`);
            setArticles(prev => prev.map(a => a._id === id ? { ...a, isEditorsPick: !current } : a));
        } catch { } finally { setActing(null); }
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Delete "${title}"? This will apply a points penalty to the author.`)) return;
        setActing(id + '-delete');
        try {
            await api.delete(`/knowledge/admin/${id}`);
            setArticles(prev => prev.filter(a => a._id !== id));
        } catch { } finally { setActing(null); }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="page-title">Knowledge Moderation</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Review, approve, and manage community articles</p>
                </div>
                <Link to="/knowledge" target="_blank" className="btn-secondary text-sm px-4 py-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
                    View Hub
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                {[
                    { label: 'Total Articles', value: stats.total || 0, color: 'text-slate-900' },
                    { label: 'Published', value: stats.published || 0, color: 'text-emerald-600' },
                    { label: 'Pending Review', value: stats.pending || 0, color: 'text-amber-600', urgent: stats.pending > 0 },
                    { label: 'Featured', value: stats.featured || 0, color: 'text-amber-500' },
                    { label: "Editor's Picks", value: stats.editorsPick || 0, color: 'text-emerald-500' },
                ].map(s => (
                    <div key={s.label} className={`card p-4 ${s.urgent ? 'border-amber-200 bg-amber-50' : ''}`}>
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    {STATUS_TABS.map(t => (
                        <button key={t.key} onClick={() => setStatusFilter(t.key)}
                            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${statusFilter === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <input
                    type="text"
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="Search by title or content..."
                    className="input-field text-sm py-2 flex-1 max-w-xs"
                />
            </div>

            {/* Articles table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : articles.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                    <p className="text-lg font-semibold mb-1">{statusFilter === 'pending_review' ? '🎉 Queue is empty' : 'No articles found'}</p>
                    {statusFilter === 'pending_review' && <p className="text-sm">All pending articles have been reviewed.</p>}
                </div>
            ) : (
                <div className="space-y-3">
                    {articles.map(a => {
                        const av = a.author?.profilePic
                            ? (a.author.profilePic.startsWith('http') ? a.author.profilePic : `${API_BASE}${a.author.profilePic}`)
                            : null;
                        return (
                            <div key={a._id} className="card p-5">
                                <div className="flex items-start gap-4 flex-wrap">
                                    {/* Author + info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[a.status]}`}>
                                                {a.status.replace('_', ' ')}
                                            </span>
                                            {a.category && <span className="text-xs text-slate-400">{a.category}</span>}
                                            {a.isFeatured && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">⭐ Featured</span>}
                                            {a.isEditorsPick && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">✓ Pick</span>}
                                        </div>

                                        <Link to={`/knowledge/article/${a.slug}`} target="_blank"
                                            className="font-bold text-slate-900 hover:text-primary-600 transition-colors text-[15px] block mb-1.5">
                                            {a.title}
                                        </Link>

                                        <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                                                    {av ? <img src={av} className="w-full h-full object-cover" alt={a.author?.name} /> :
                                                        <span className="text-[9px] font-bold text-slate-500 flex items-center justify-center h-full">{a.author?.name?.charAt(0)}</span>}
                                                </div>
                                                <span>{a.author?.name}</span>
                                                <span className="text-slate-300">·</span>
                                                <span>{a.author?.email}</span>
                                            </div>
                                            <span>·</span>
                                            <span>Submitted {formatDate(a.updatedAt)}</span>
                                            <span>·</span>
                                            <span>{a.readingTimeMinutes} min · {a.wordCount} words</span>
                                        </div>

                                        {a.excerpt && (
                                            <p className="text-[13px] text-slate-500 line-clamp-2">{a.excerpt}</p>
                                        )}

                                        {a.rejectionReason && (
                                            <p className="text-xs text-red-600 mt-1.5 bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100">
                                                Rejection reason: {a.rejectionReason}
                                            </p>
                                        )}

                                        {a.status === 'published' && (
                                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                                <span>{a.viewCount} views</span>
                                                <span>{a.likeCount} likes</span>
                                                <span>{a.commentCount} comments</span>
                                                <span>{a.bookmarkCount} saves</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex flex-col gap-2 flex-shrink-0 min-w-[160px]">
                                        {a.status === 'pending_review' && (
                                            <>
                                                <button onClick={() => handleApprove(a._id)} disabled={!!acting}
                                                    className="text-sm px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-colors disabled:opacity-60 w-full">
                                                    {acting === a._id + '-approve' ? '...' : '✓ Approve'}
                                                </button>
                                                <button onClick={() => { setRejectModal({ id: a._id, title: a.title }); setRejectReason(''); }}
                                                    disabled={!!acting}
                                                    className="text-sm px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 font-medium transition-colors disabled:opacity-60 w-full">
                                                    ✗ Reject
                                                </button>
                                            </>
                                        )}

                                        {a.status === 'published' && (
                                            <>
                                                <button onClick={() => handleFeature(a._id, a.isFeatured)} disabled={!!acting}
                                                    className={`text-sm px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-60 w-full ${a.isFeatured ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'}`}>
                                                    {acting === a._id + '-feature' ? '...' : a.isFeatured ? '★ Unfeature' : '☆ Feature'}
                                                </button>
                                                <button onClick={() => handleEditorsPick(a._id, a.isEditorsPick)} disabled={!!acting}
                                                    className={`text-sm px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-60 w-full ${a.isEditorsPick ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}>
                                                    {acting === a._id + '-ep' ? '...' : a.isEditorsPick ? "✓ Remove Pick" : "✓ Editor's Pick"}
                                                </button>
                                            </>
                                        )}

                                        <button onClick={() => handleDelete(a._id, a.title)} disabled={!!acting}
                                            className="text-sm px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 font-medium transition-colors disabled:opacity-60 w-full">
                                            {acting === a._id + '-delete' ? '...' : 'Delete'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Reject modal */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setRejectModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="font-bold text-slate-900 text-lg mb-1">Reject Article</h2>
                        <p className="text-sm text-slate-500 mb-4 truncate">"{rejectModal.title}"</p>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Rejection Reason (required)</label>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Explain what needs to be improved so the author can revise and resubmit..."
                            rows={4}
                            className="input-field w-full resize-none text-sm"
                        />
                        <p className="text-xs text-slate-400 mt-1 mb-5">This will be sent to the author as feedback.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setRejectModal(null)} className="flex-1 btn-secondary py-2.5">Cancel</button>
                            <button onClick={handleReject} disabled={!rejectReason.trim() || !!acting}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
                                {acting ? 'Rejecting...' : 'Reject Article'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
