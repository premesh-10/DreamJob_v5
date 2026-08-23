import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
import ArticleCard from '../../components/knowledge/ArticleCard';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

function levelColor(level) {
    return ({
        Explorer: 'bg-slate-100 text-slate-700',
        Trailblazer: 'bg-emerald-100 text-emerald-700',
        Achiever: 'bg-blue-100 text-blue-700',
        Expert: 'bg-violet-100 text-violet-700',
        Master: 'bg-amber-100 text-amber-700',
        Legend: 'bg-rose-100 text-rose-700',
        Guru: 'bg-indigo-100 text-indigo-700',
    }[level] || 'bg-slate-100 text-slate-700');
}

export default function AuthorProfile() {
    const { userId } = useParams();
    const { user } = useSelector(s => s.auth);
    const navigate = useNavigate();

    const [articles, setArticles] = useState([]);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState({});
    const [author, setAuthor] = useState(null);
    const [followersCount, setFollowersCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    useEffect(() => {
        setLoading(true);
        api.get(`/knowledge/authors/${userId}`)
            .then(r => {
                setArticles(r.data.articles);
                setTotal(r.data.total);
                setStats(r.data.stats || {});
                setFollowersCount(r.data.followersCount || 0);
                setIsFollowing(r.data.isFollowing || false);
            })
            .catch(() => navigate('/knowledge'))
            .finally(() => setLoading(false));

        // Also fetch the user profile
        api.get(`/users/${userId}`).then(r => setAuthor(r.data.user)).catch(() => {});
    }, [userId]);

    const handleFollow = async () => {
        if (!user) return navigate('/login');
        const was = isFollowing;
        setIsFollowing(!was);
        setFollowersCount(c => was ? c - 1 : c + 1);
        try { await api.post(`/knowledge/authors/${userId}/follow`); }
        catch { setIsFollowing(was); setFollowersCount(c => was ? c + 1 : c - 1); }
    };

    const loadMore = async () => {
        const next = page + 1;
        setPage(next);
        const r = await api.get(`/knowledge/authors/${userId}`, { params: { page: next } });
        setArticles(prev => [...prev, ...r.data.articles]);
    };

    const av = author?.profilePic
        ? (author.profilePic.startsWith('http') ? author.profilePic : `${API_BASE}${author.profilePic}`)
        : null;
    const isOwnProfile = user && user._id === userId;

    return (
        <div className="max-w-5xl mx-auto">
            {loading ? (
                <div className="flex items-center justify-center min-h-[40vh]">
                    <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* Author banner */}
                    <div className="card p-6 sm:p-8 mb-8 bg-gradient-to-br from-indigo-50 to-violet-50 border-primary-100">
                        <div className="flex items-start gap-5 flex-wrap">
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-primary-100 flex items-center justify-center flex-shrink-0 ring-4 ring-white shadow-md">
                                {av ? (
                                    <img src={av} alt={author?.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl font-black text-primary-700">{author?.name?.charAt(0) || '?'}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                            <h1 className="text-2xl font-black text-slate-900">{author?.name || 'Author'}</h1>
                                            {author?.hubLevel && (
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${levelColor(author.hubLevel)}`}>
                                                    {author.hubLevel}
                                                </span>
                                            )}
                                            {author?.identityVerified && (
                                                <span className="flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                                                    Verified
                                                </span>
                                            )}
                                        </div>
                                        {author?.experience && <p className="text-slate-500 text-sm mb-2">{author.experience}</p>}
                                        <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                                            <span><strong className="text-slate-800">{followersCount}</strong> followers</span>
                                            <span><strong className="text-slate-800">{stats.totalArticles || total}</strong> articles</span>
                                            <span><strong className="text-slate-800">{(stats.totalViews || 0).toLocaleString()}</strong> views</span>
                                            <span><strong className="text-slate-800">{author?.contributionPoints || 0}</strong> pts</span>
                                        </div>
                                    </div>

                                    {!isOwnProfile && (
                                        <button onClick={handleFollow}
                                            className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${isFollowing ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'}`}>
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Articles */}
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="section-title">Published Articles ({total})</h2>
                        <Link to="/knowledge" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">← Knowledge Hub</Link>
                    </div>

                    {articles.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z"/></svg>
                            No published articles yet
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {articles.map(a => <ArticleCard key={a._id} article={a} />)}
                            </div>
                            {articles.length < total && (
                                <div className="flex justify-center mt-8">
                                    <button onClick={loadMore} className="btn-secondary px-8 py-3">Load More</button>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
