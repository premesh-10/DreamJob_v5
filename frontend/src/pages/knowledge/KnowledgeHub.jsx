import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
import ArticleCard from '../../components/knowledge/ArticleCard';

const SORT_TABS = [
    { key: 'newest',          label: 'Newest' },
    { key: 'trending',        label: 'Trending' },
    { key: 'most_liked',      label: 'Most Liked' },
    { key: 'most_viewed',     label: 'Most Viewed' },
    { key: 'most_bookmarked', label: 'Bookmarked' },
];

const QUICK_FILTERS = [
    'Technology', 'Programming', 'JavaScript', 'Python', 'Java', 'System Design',
    'DSA', 'AI', 'Machine Learning', 'Web Development', 'DevOps', 'Cloud',
    'Interview Preparation', 'Career Guidance', 'Soft Skills',
];

export default function KnowledgeHub() {
    const { user } = useSelector(s => s.auth);
    const [searchParams, setSearchParams] = useSearchParams();

    const [articles, setArticles] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [featured, setFeatured] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [searchQ, setSearchQ] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState(null);

    const sort = searchParams.get('sort') || 'newest';
    const category = searchParams.get('category') || '';
    const tag = searchParams.get('tag') || '';

    const setParam = (key, value) => {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(key, value); else next.delete(key);
        next.delete('page');
        setSearchParams(next);
        setPage(1);
        setArticles([]);
    };

    const fetchArticles = useCallback(async (pg = 1, append = false) => {
        if (append) setLoadingMore(true); else setLoading(true);
        try {
            const params = { page: pg, limit: 12, sort };
            if (category) params.category = category;
            if (tag) params.tag = tag;
            if (searchParams.get('featured')) params.featured = 'true';
            if (searchParams.get('editorsPick')) params.editorsPick = 'true';
            const r = await api.get('/knowledge', { params });
            if (append) setArticles(prev => [...prev, ...r.data.articles]);
            else setArticles(r.data.articles);
            setTotal(r.data.total);
        } catch { /* silent */ } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [sort, category, tag, searchParams]);

    // Fetch featured + categories + tags once
    useEffect(() => {
        Promise.all([
            api.get('/knowledge', { params: { featured: 'true', limit: 3, sort: 'trending' } }),
            api.get('/knowledge/categories'),
            api.get('/knowledge/tags'),
        ]).then(([f, c, t]) => {
            setFeatured(f.data.articles);
            setCategories(c.data.categories);
            setTags(t.data.tags);
        }).catch(() => {});
    }, []);

    useEffect(() => { fetchArticles(1, false); }, [fetchArticles]);

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchArticles(nextPage, true);
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQ.trim() || searchQ.trim().length < 2) return;
        setSearching(true);
        try {
            const r = await api.get('/knowledge/search', { params: { q: searchQ.trim(), limit: 20 } });
            setSearchResults(r.data.articles);
        } catch { } finally { setSearching(false); }
    };

    const clearSearch = () => { setSearchResults(null); setSearchQ(''); };
    const hasMore = articles.length < total;

    return (
        <div className="max-w-7xl mx-auto">
            {/* ── Hero ──────────────────────────────────────────────────── */}
            <div className="relative rounded-3xl overflow-hidden mb-8 bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-8 md:p-12">
                <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #6d28d9 0%, transparent 50%), radial-gradient(circle at 80% 20%, #4338ca 0%, transparent 50%)' }} />
                <div className="relative">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 bg-white/10 backdrop-blur-sm text-white text-xs font-semibold rounded-full border border-white/20">Knowledge Hub</span>
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-full border border-amber-500/30">Community-Driven</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-3 tracking-tight">
                        Learn. Share. <span className="text-gradient bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">Grow Together.</span>
                    </h1>
                    <p className="text-indigo-200 text-[15px] md:text-lg max-w-2xl mb-8 leading-relaxed">
                        Community-curated articles on technology, careers, and professional growth. Written by practitioners, for practitioners.
                    </p>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
                        <div className="relative flex-1">
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                            <input
                                type="text"
                                value={searchQ}
                                onChange={e => { setSearchQ(e.target.value); if (!e.target.value) clearSearch(); }}
                                placeholder="Search articles, topics, technologies..."
                                className="w-full pl-12 pr-4 py-3.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white placeholder-indigo-300 focus:outline-none focus:border-white/40 focus:bg-white/15 text-[15px] transition-all"
                            />
                        </div>
                        <button type="submit" disabled={searching}
                            className="px-6 py-3.5 bg-white text-indigo-900 font-semibold rounded-2xl hover:bg-indigo-50 transition-colors flex-shrink-0 disabled:opacity-60">
                            {searching ? 'Searching...' : 'Search'}
                        </button>
                    </form>

                    {user && (
                        <Link to="/knowledge/write" className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-xl transition-colors text-[14px]">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                            Write an Article
                        </Link>
                    )}
                </div>
            </div>

            {/* ── Search Results ─────────────────────────────────────────── */}
            {searchResults !== null && (
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="section-title">Search results for "{searchQ}" <span className="text-slate-400 font-normal">({searchResults.length})</span></h2>
                        <button onClick={clearSearch} className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Clear search</button>
                    </div>
                    {searchResults.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
                            <p className="font-medium">No articles found</p>
                            <p className="text-sm mt-1">Try different keywords</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {searchResults.map(a => <ArticleCard key={a._id} article={a} />)}
                        </div>
                    )}
                </div>
            )}

            {searchResults === null && (
                <div className="flex gap-8">
                    {/* ── Main feed ──────────────────────────────────────── */}
                    <div className="flex-1 min-w-0">
                        {/* Featured spotlight */}
                        {featured.length > 0 && !category && !tag && sort === 'newest' && (
                            <div className="mb-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                    </div>
                                    <h2 className="section-title">Featured Articles</h2>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {featured.map(a => <ArticleCard key={a._id} article={a} />)}
                                </div>
                            </div>
                        )}

                        {/* Sort tabs + active filter banner */}
                        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                {SORT_TABS.map(t => (
                                    <button
                                        key={t.key}
                                        onClick={() => setParam('sort', t.key)}
                                        className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${sort === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            {(category || tag) && (
                                <div className="flex items-center gap-2">
                                    {category && (
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-[13px] font-medium border border-primary-100">
                                            {category}
                                            <button onClick={() => setParam('category', '')} className="hover:text-red-500 transition-colors">×</button>
                                        </span>
                                    )}
                                    {tag && (
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-[13px] font-medium border border-violet-100">
                                            #{tag}
                                            <button onClick={() => setParam('tag', '')} className="hover:text-red-500 transition-colors">×</button>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Articles grid */}
                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {[...Array(9)].map((_, i) => (
                                    <div key={i} className="card animate-pulse">
                                        <div className="h-44 bg-slate-200 rounded-t-2xl" />
                                        <div className="p-5 space-y-3">
                                            <div className="h-3 bg-slate-200 rounded w-1/3" />
                                            <div className="h-5 bg-slate-200 rounded" />
                                            <div className="h-4 bg-slate-200 rounded w-3/4" />
                                            <div className="h-4 bg-slate-200 rounded w-1/2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : articles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-center">
                                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-slate-100">
                                    <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z"/></svg>
                                </div>
                                <p className="font-semibold text-slate-600 mb-1">No articles yet</p>
                                <p className="text-sm text-slate-400 mb-4">Be the first to share knowledge in this area</p>
                                {user && <Link to="/knowledge/write" className="btn-primary text-sm px-5 py-2">Write First Article</Link>}
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {articles.map(a => <ArticleCard key={a._id} article={a} />)}
                                </div>
                                {hasMore && (
                                    <div className="flex justify-center mt-8">
                                        <button onClick={loadMore} disabled={loadingMore}
                                            className="btn-secondary px-8 py-3 flex items-center gap-2">
                                            {loadingMore ? (
                                                <><div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />Loading...</>
                                            ) : `Load More (${total - articles.length} remaining)`}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── Sidebar ─────────────────────────────────────────── */}
                    <aside className="hidden xl:flex flex-col gap-5 w-72 flex-shrink-0">
                        {/* Write CTA */}
                        {user ? (
                            <div className="card p-5 bg-gradient-to-br from-primary-50 to-violet-50 border-primary-100">
                                <h3 className="font-bold text-slate-900 mb-1">Share Your Knowledge</h3>
                                <p className="text-[13px] text-slate-500 mb-4">Earn rewards for every quality article you publish.</p>
                                <Link to="/knowledge/write" className="btn-primary w-full text-center text-sm py-2.5 flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"/></svg>
                                    Write an Article
                                </Link>
                            </div>
                        ) : (
                            <div className="card p-5">
                                <h3 className="font-bold text-slate-900 mb-1">Join the Community</h3>
                                <p className="text-[13px] text-slate-500 mb-4">Sign in to write articles, like, bookmark, and comment.</p>
                                <Link to="/login" className="btn-primary w-full text-center text-sm py-2.5">Sign In</Link>
                            </div>
                        )}

                        {/* Browse Categories */}
                        {categories.length > 0 && (
                            <div className="card p-5">
                                <h3 className="section-title mb-3">Browse Categories</h3>
                                <div className="space-y-1">
                                    {categories.slice(0, 12).map(c => (
                                        <button
                                            key={c.name}
                                            onClick={() => setParam('category', c.name)}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-colors text-left ${category === c.name ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <span>{c.name}</span>
                                            <span className="text-xs text-slate-400">{c.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Popular Tags */}
                        {tags.length > 0 && (
                            <div className="card p-5">
                                <h3 className="section-title mb-3">Popular Tags</h3>
                                <div className="flex flex-wrap gap-2">
                                    {tags.slice(0, 20).map(t => (
                                        <button
                                            key={t.name}
                                            onClick={() => setParam('tag', t.name)}
                                            className={`px-2.5 py-1 text-[12px] rounded-full transition-colors ${tag === t.name ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-primary-50 hover:text-primary-600'}`}
                                        >
                                            #{t.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Filters */}
                        <div className="card p-5">
                            <h3 className="section-title mb-3">Quick Explore</h3>
                            <div className="space-y-1">
                                <button onClick={() => { setParam('featured', 'true'); setParam('editorsPick', ''); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-amber-50 hover:text-amber-700 transition-colors text-left">
                                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                    Featured Articles
                                </button>
                                <button onClick={() => { setParam('editorsPick', 'true'); setParam('featured', ''); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left">
                                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"/></svg>
                                    Editor's Picks
                                </button>
                                {user && (
                                    <Link to="/knowledge/bookmarks" className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-slate-600 hover:bg-slate-50 transition-colors">
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"/></svg>
                                        My Bookmarks
                                    </Link>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
