import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import ArticleCard from '../../components/knowledge/ArticleCard';

export default function KnowledgeBookmarks() {
    const [articles, setArticles] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    useEffect(() => {
        setLoading(true);
        api.get('/knowledge/my-bookmarks', { params: { page, limit: 12 } })
            .then(r => {
                if (page === 1) setArticles(r.data.articles);
                else setArticles(prev => [...prev, ...r.data.articles]);
                setTotal(r.data.total);
            })
            .finally(() => setLoading(false));
    }, [page]);

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="page-title">My Bookmarks</h1>
                    <p className="text-slate-500 text-sm mt-0.5">{total} saved articles</p>
                </div>
                <Link to="/knowledge" className="btn-secondary text-sm px-4 py-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg>
                    Explore Articles
                </Link>
            </div>

            {loading && page === 1 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[...Array(6)].map((_, i) => <div key={i} className="card animate-pulse h-72" />)}
                </div>
            ) : articles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-center">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-slate-100">
                        <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"/></svg>
                    </div>
                    <p className="font-semibold text-slate-600 mb-1">No bookmarks yet</p>
                    <p className="text-sm text-slate-400 mb-4">Save articles to read later</p>
                    <Link to="/knowledge" className="btn-primary text-sm px-5 py-2">Browse Articles</Link>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {articles.map(a => (
                            <div key={a._id} className="relative">
                                <ArticleCard article={{ ...a, isBookmarked: true }} />
                                <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-slate-400 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm">
                                    <svg className="w-3 h-3 text-primary-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"/></svg>
                                    Saved {a.bookmarkedAt ? new Date(a.bookmarkedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                    {articles.length < total && (
                        <div className="flex justify-center mt-8">
                            <button onClick={() => setPage(p => p + 1)} disabled={loading}
                                className="btn-secondary px-8 py-3">
                                {loading ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
