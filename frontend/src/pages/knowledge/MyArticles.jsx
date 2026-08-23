import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';

const STATUS_TABS = [
    { key: '', label: 'All' },
    { key: 'draft', label: 'Drafts' },
    { key: 'pending_review', label: 'In Review' },
    { key: 'published', label: 'Published' },
    { key: 'rejected', label: 'Rejected' },
];

function formatDate(d) {
    return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

const STATUS_STYLE = {
    draft: 'bg-slate-100 text-slate-600',
    pending_review: 'bg-amber-100 text-amber-700',
    published: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    archived: 'bg-slate-100 text-slate-500',
};
const STATUS_LABEL = {
    draft: 'Draft', pending_review: 'In Review', published: 'Published', rejected: 'Rejected', archived: 'Archived',
};

export default function MyArticles() {
    const { user } = useSelector(s => s.auth);
    const navigate = useNavigate();
    const [articles, setArticles] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [deleting, setDeleting] = useState(null);
    const [submitPending, setSubmitPending] = useState(null);

    useEffect(() => {
        setLoading(true);
        api.get('/knowledge/my-articles', { params: { status: statusFilter || undefined, limit: 50 } })
            .then(r => { setArticles(r.data.articles); setTotal(r.data.total); })
            .finally(() => setLoading(false));
    }, [statusFilter]);

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
        setDeleting(id);
        try {
            await api.delete(`/knowledge/${id}`);
            setArticles(prev => prev.filter(a => a._id !== id));
        } catch { } finally { setDeleting(null); }
    };

    const handleSubmit = async (id) => {
        setSubmitPending(id);
        try {
            await api.post(`/knowledge/${id}/submit`);
            setArticles(prev => prev.map(a => a._id === id ? { ...a, status: 'pending_review' } : a));
        } catch (e) {
            alert(e.response?.data?.message || 'Could not submit');
        } finally { setSubmitPending(null); }
    };

    if (!user) return null;

    const totalViews = articles.filter(a => a.status === 'published').reduce((s, a) => s + (a.viewCount || 0), 0);
    const totalLikes = articles.filter(a => a.status === 'published').reduce((s, a) => s + (a.likeCount || 0), 0);
    const publishedCount = articles.filter(a => a.status === 'published').length;

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="page-title">My Articles</h1>
                    <p className="text-slate-500 text-sm mt-0.5">{total} total articles</p>
                </div>
                <Link to="/knowledge/write" className="btn-primary flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                    New Article
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Published', value: publishedCount, icon: '📄', color: 'text-emerald-600' },
                    { label: 'Total Views', value: totalViews.toLocaleString(), icon: '👁️', color: 'text-blue-600' },
                    { label: 'Total Likes', value: totalLikes.toLocaleString(), icon: '❤️', color: 'text-rose-600' },
                    { label: 'In Review', value: articles.filter(a => a.status === 'pending_review').length, icon: '⏳', color: 'text-amber-600' },
                ].map(s => (
                    <div key={s.label} className="card p-4">
                        <p className="text-2xl mb-1">{s.icon}</p>
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-5">
                {STATUS_TABS.map(t => (
                    <button key={t.key} onClick={() => setStatusFilter(t.key)}
                        className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${statusFilter === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {t.label}
                        {t.key && articles.filter(a => a.status === t.key).length > 0 && (
                            <span className="ml-1.5 text-xs opacity-60">({articles.filter(a => a.status === t.key).length})</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Articles list */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="card p-5 animate-pulse flex gap-4">
                            <div className="w-24 h-16 bg-slate-200 rounded-xl flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 rounded w-3/4" />
                                <div className="h-3 bg-slate-200 rounded w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : articles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-center">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-slate-100">
                        <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                    </div>
                    <p className="font-semibold text-slate-600 mb-1">No articles yet</p>
                    <p className="text-sm text-slate-400 mb-4">Start writing and share your knowledge with the community</p>
                    <Link to="/knowledge/write" className="btn-primary text-sm px-5 py-2">Write First Article</Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {articles.map(a => (
                        <div key={a._id} className="card p-5 flex items-start gap-4 group">
                            {a.coverImage && (
                                <img
                                    src={a.coverImage.startsWith('http') ? a.coverImage : `${import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000'}${a.coverImage}`}
                                    alt={a.title}
                                    className="w-24 h-16 object-cover rounded-xl flex-shrink-0"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[a.status]}`}>
                                                {STATUS_LABEL[a.status]}
                                            </span>
                                            {a.category && <span className="text-xs text-slate-400">{a.category}</span>}
                                            <span className="text-xs text-slate-400">{a.readingTimeMinutes} min read</span>
                                        </div>
                                        <Link to={a.status === 'published' ? `/knowledge/article/${a.slug}` : '#'}
                                            className="font-semibold text-slate-900 text-[15px] leading-snug hover:text-primary-600 transition-colors block truncate">
                                            {a.title}
                                        </Link>
                                        {a.status === 'rejected' && a.rejectionReason && (
                                            <p className="text-xs text-red-600 mt-1">Rejection reason: {a.rejectionReason}</p>
                                        )}
                                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                            <span>Updated {formatDate(a.updatedAt)}</span>
                                            {a.status === 'published' && (
                                                <>
                                                    <span>·</span>
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                                                        {a.viewCount}
                                                    </span>
                                                    <span>·</span>
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"/></svg>
                                                        {a.likeCount}
                                                    </span>
                                                    <span>·</span>
                                                    <span>{a.commentCount} comments</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {['draft', 'rejected'].includes(a.status) && (
                                            <button onClick={() => handleSubmit(a._id)} disabled={submitPending === a._id}
                                                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-medium transition-colors disabled:opacity-60">
                                                {submitPending === a._id ? '...' : 'Submit for Review'}
                                            </button>
                                        )}
                                        <Link to={`/knowledge/edit/${a._id}`}
                                            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors">
                                            Edit
                                        </Link>
                                        <button onClick={() => handleDelete(a._id, a.title)} disabled={deleting === a._id}
                                            className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-medium transition-colors disabled:opacity-60">
                                            {deleting === a._id ? '...' : 'Delete'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
