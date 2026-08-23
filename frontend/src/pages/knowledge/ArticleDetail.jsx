import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
import ArticleMarkdown from '../../components/knowledge/ArticleMarkdown';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

function avatarSrc(user) {
    if (!user?.profilePic) return null;
    return user.profilePic.startsWith('http') ? user.profilePic : `${API_BASE}${user.profilePic}`;
}

function formatDate(d) {
    return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
}

// Extract headings from markdown for TOC
function extractTOC(content) {
    const lines = content.split('\n');
    const headings = [];
    for (const line of lines) {
        const m = line.match(/^(#{1,3})\s+(.+)/);
        if (m) {
            const level = m[1].length;
            const text = m[2].trim();
            const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            headings.push({ level, text, id });
        }
    }
    return headings;
}

export default function ArticleDetail() {
    const { slug } = useParams();
    const { user } = useSelector(s => s.auth);
    const navigate = useNavigate();

    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [bookmarked, setBookmarked] = useState(false);
    const [following, setFollowing] = useState(false);
    const [authorFollowers, setAuthorFollowers] = useState(0);
    const [comments, setComments] = useState([]);
    const [commentTotal, setCommentTotal] = useState(0);
    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState(null); // { id, authorName }
    const [submittingComment, setSubmittingComment] = useState(false);
    const [readProgress, setReadProgress] = useState(0);
    const [tocOpen, setTocOpen] = useState(false);
    const contentRef = useRef(null);

    useEffect(() => {
        setLoading(true);
        api.get(`/knowledge/article/${slug}`)
            .then(r => {
                setArticle(r.data.article);
                setLiked(r.data.article.isLiked);
                setLikeCount(r.data.article.likeCount);
                setBookmarked(r.data.article.isBookmarked);
                setFollowing(r.data.article.isFollowingAuthor);
                setAuthorFollowers(r.data.authorFollowerCount);
                // Record view
                api.post(`/knowledge/${r.data.article._id}/view`).catch(() => {});
            })
            .catch(() => setError('Article not found'))
            .finally(() => setLoading(false));
    }, [slug]);

    useEffect(() => {
        if (!article) return;
        api.get(`/knowledge/${article._id}/comments`).then(r => {
            setComments(r.data.comments);
            setCommentTotal(r.data.total);
        }).catch(() => {});
    }, [article]);

    // Reading progress bar
    useEffect(() => {
        const handler = () => {
            const el = contentRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const total = el.offsetHeight;
            const scrolled = Math.max(0, -rect.top);
            setReadProgress(Math.min(100, Math.round((scrolled / total) * 100)));
        };
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, [article]);

    const handleLike = async () => {
        if (!user) return navigate('/login');
        const wasLiked = liked;
        setLiked(!wasLiked);
        setLikeCount(c => wasLiked ? c - 1 : c + 1);
        try {
            await api.post(`/knowledge/${article._id}/like`);
        } catch {
            setLiked(wasLiked);
            setLikeCount(c => wasLiked ? c + 1 : c - 1);
        }
    };

    const handleBookmark = async () => {
        if (!user) return navigate('/login');
        const was = bookmarked;
        setBookmarked(!was);
        try { await api.post(`/knowledge/${article._id}/bookmark`); }
        catch { setBookmarked(was); }
    };

    const handleFollow = async () => {
        if (!user) return navigate('/login');
        const was = following;
        setFollowing(!was);
        setAuthorFollowers(c => was ? c - 1 : c + 1);
        try { await api.post(`/knowledge/authors/${article.author._id}/follow`); }
        catch { setFollowing(was); setAuthorFollowers(c => was ? c + 1 : c - 1); }
    };

    const submitComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        setSubmittingComment(true);
        try {
            const r = await api.post(`/knowledge/${article._id}/comments`, {
                content: commentText.trim(),
                parentCommentId: replyTo?.id || null,
            });
            if (replyTo) {
                setComments(prev => prev.map(c => c._id === replyTo.id
                    ? { ...c, replies: [...(c.replies || []), r.data.comment] }
                    : c));
            } else {
                setComments(prev => [r.data.comment, ...prev]);
                setCommentTotal(t => t + 1);
            }
            setCommentText('');
            setReplyTo(null);
        } catch { } finally { setSubmittingComment(false); }
    };

    const handleDeleteComment = async (articleId, cid, parentId) => {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await api.delete(`/knowledge/${articleId}/comments/${cid}`);
            if (parentId) {
                setComments(prev => prev.map(c => c._id === parentId
                    ? { ...c, replies: c.replies.filter(r => r._id !== cid) }
                    : c));
            } else {
                setComments(prev => prev.filter(c => c._id !== cid));
                setCommentTotal(t => Math.max(0, t - 1));
            }
        } catch { }
    };

    const handleCommentLike = async (articleId, cid, parentId) => {
        if (!user) return navigate('/login');
        try {
            const r = await api.post(`/knowledge/${articleId}/comments/${cid}/like`);
            const update = (c) => c._id === cid ? { ...c, likeCount: c.likeCount + (r.data.liked ? 1 : -1), isLiked: r.data.liked } : c;
            if (parentId) {
                setComments(prev => prev.map(c => c._id === parentId ? { ...c, replies: c.replies.map(update) } : c));
            } else {
                setComments(prev => prev.map(update));
            }
        } catch { }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
    if (error) return (
        <div className="text-center py-20">
            <p className="text-lg font-semibold text-slate-700 mb-2">{error}</p>
            <Link to="/knowledge" className="text-primary-600 hover:underline text-sm">← Back to Knowledge Hub</Link>
        </div>
    );
    if (!article) return null;

    const toc = extractTOC(article.content);
    const cover = article.coverImage
        ? (article.coverImage.startsWith('http') ? article.coverImage : `${API_BASE}${article.coverImage}`)
        : null;
    const isAuthor = user && article.author._id === user._id;
    const isAdmin = user && ['admin', 'super_admin', 'moderator'].includes(user.role);

    return (
        <div className="max-w-6xl mx-auto">
            {/* Reading progress */}
            <div className="fixed top-0 left-0 w-full h-0.5 bg-slate-100 z-50">
                <div className="h-full bg-gradient-to-r from-primary-500 to-violet-500 transition-all duration-150" style={{ width: `${readProgress}%` }} />
            </div>

            {/* Back nav */}
            <Link to="/knowledge" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/></svg>
                Knowledge Hub
            </Link>

            <div className="flex gap-10">
                {/* ── Article Content ──────────────────────────────────── */}
                <article className="flex-1 min-w-0">
                    {/* Status badges (non-published) */}
                    {article.status !== 'published' && (
                        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
                            article.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            article.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                            article.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' : ''
                        }`}>
                            {article.status === 'pending_review' && '⏳ This article is awaiting review'}
                            {article.status === 'draft' && '📝 Draft — only visible to you'}
                            {article.status === 'rejected' && `❌ Rejected: ${article.rejectionReason}`}
                        </div>
                    )}

                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                        {article.category && (
                            <Link to={`/knowledge?category=${encodeURIComponent(article.category)}`}
                                className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-semibold hover:bg-primary-100 transition-colors">
                                {article.category}
                            </Link>
                        )}
                        {article.isFeatured && <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">⭐ Featured</span>}
                        {article.isEditorsPick && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">✓ Editor's Pick</span>}
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight mb-4 tracking-tight">
                        {article.title}
                    </h1>

                    {/* Excerpt */}
                    {article.excerpt && (
                        <p className="text-slate-500 text-lg leading-relaxed mb-6 border-l-4 border-primary-200 pl-4">{article.excerpt}</p>
                    )}

                    {/* Author + meta row */}
                    <div className="flex items-center justify-between flex-wrap gap-4 mb-6 pb-6 border-b border-slate-100">
                        <Link to={`/knowledge/author/${article.author._id}`} className="flex items-center gap-3 group">
                            <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-primary-100 flex items-center justify-center ring-2 ring-primary-100 group-hover:ring-primary-300 transition-all">
                                {avatarSrc(article.author) ? (
                                    <img src={avatarSrc(article.author)} alt={article.author.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-bold text-primary-700 text-[15px]">{article.author.name?.charAt(0)}</span>
                                )}
                            </div>
                            <div>
                                <p className="text-[14px] font-semibold text-slate-800 group-hover:text-primary-600 transition-colors">{article.author.name}</p>
                                <p className="text-xs text-slate-400">{authorFollowers} followers</p>
                            </div>
                        </Link>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span>{formatDate(article.publishedAt || article.createdAt)}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
                                {article.readingTimeMinutes} min read
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                                {article.viewCount.toLocaleString()} views
                            </span>
                            {(isAuthor || isAdmin) && (
                                <Link to={`/knowledge/edit/${article._id}`} className="ml-2 text-primary-600 hover:text-primary-700 font-medium">Edit</Link>
                            )}
                        </div>
                    </div>

                    {/* Cover image */}
                    {cover && (
                        <div className="mb-8 rounded-2xl overflow-hidden shadow-md">
                            <img src={cover} alt={article.title} className="w-full max-h-[480px] object-cover" />
                        </div>
                    )}

                    {/* Article body */}
                    <div ref={contentRef}>
                        <ArticleMarkdown content={article.content} />
                    </div>

                    {/* Tags */}
                    {article.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-slate-100">
                            {article.tags.map(t => (
                                <Link key={t} to={`/knowledge?tag=${t}`}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-primary-50 hover:text-primary-600 text-slate-600 rounded-full text-[13px] transition-colors">
                                    #{t}
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Engagement bar */}
                    <div className="flex items-center gap-4 mt-8 pt-6 border-t border-slate-100">
                        <button onClick={handleLike}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium border ${liked ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'}`}>
                            <svg className="w-4.5 h-4.5" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"/>
                            </svg>
                            {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
                        </button>

                        <button onClick={handleBookmark}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium border ${bookmarked ? 'bg-primary-50 text-primary-600 border-primary-200 hover:bg-primary-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-primary-50 hover:text-primary-600 hover:border-primary-200'}`}>
                            <svg className="w-4.5 h-4.5" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"/>
                            </svg>
                            {bookmarked ? 'Saved' : 'Save'}
                        </button>

                        <button onClick={() => navigator.share ? navigator.share({ title: article.title, url: window.location.href }) : navigator.clipboard.writeText(window.location.href)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"/>
                            </svg>
                            Share
                        </button>
                    </div>

                    {/* Author card */}
                    <div className="mt-10 p-6 card">
                        <div className="flex items-start gap-4">
                            <Link to={`/knowledge/author/${article.author._id}`} className="flex-shrink-0">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-primary-100 flex items-center justify-center ring-2 ring-primary-50">
                                    {avatarSrc(article.author) ? (
                                        <img src={avatarSrc(article.author)} alt={article.author.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="font-bold text-primary-700 text-2xl">{article.author.name?.charAt(0)}</span>
                                    )}
                                </div>
                            </Link>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div>
                                        <Link to={`/knowledge/author/${article.author._id}`} className="font-bold text-slate-900 hover:text-primary-600 transition-colors">
                                            {article.author.name}
                                        </Link>
                                        <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${levelColor(article.author.hubLevel)}`}>
                                            {article.author.hubLevel}
                                        </span>
                                        <p className="text-xs text-slate-400 mt-0.5">{authorFollowers} followers · {article.author.contributionPoints} pts</p>
                                    </div>
                                    {user && !isAuthor && (
                                        <button onClick={handleFollow}
                                            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${following ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'}`}>
                                            {following ? 'Following' : 'Follow'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Comments */}
                    <div className="mt-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">Comments ({commentTotal})</h2>

                        {user ? (
                            <form onSubmit={submitComment} className="mb-8">
                                {replyTo && (
                                    <div className="flex items-center gap-2 mb-2 text-sm text-primary-600">
                                        <span>Replying to <strong>{replyTo.authorName}</strong></span>
                                        <button type="button" onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-600">×</button>
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-primary-100 flex items-center justify-center">
                                        {avatarSrc(user) ? (
                                            <img src={avatarSrc(user)} alt={user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs font-bold text-primary-700">{user.name?.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <textarea
                                            value={commentText}
                                            onChange={e => setCommentText(e.target.value)}
                                            placeholder={replyTo ? `Reply to ${replyTo.authorName}...` : 'Share your thoughts...'}
                                            rows={3}
                                            className="input-field w-full resize-none text-[14px]"
                                        />
                                        <div className="flex justify-end mt-2">
                                            <button type="submit" disabled={submittingComment || !commentText.trim()}
                                                className="btn-primary text-sm px-5 py-2 disabled:opacity-50">
                                                {submittingComment ? 'Posting...' : 'Post Comment'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-sm text-slate-500">
                                <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link> to join the discussion
                            </div>
                        )}

                        <div className="space-y-6">
                            {comments.map(c => (
                                <CommentBlock
                                    key={c._id}
                                    comment={c}
                                    articleId={article._id}
                                    user={user}
                                    onReply={(id, name) => { setReplyTo({ id, authorName: name }); }}
                                    onDelete={handleDeleteComment}
                                    onLike={handleCommentLike}
                                />
                            ))}
                        </div>
                    </div>
                </article>

                {/* ── TOC Sidebar ──────────────────────────────────────── */}
                {toc.length > 2 && (
                    <aside className="hidden lg:block w-60 flex-shrink-0">
                        <div className="sticky top-6">
                            <div className="card p-4">
                                <p className="section-title mb-3">Table of Contents</p>
                                <nav className="space-y-1">
                                    {toc.map((h, i) => (
                                        <a
                                            key={i}
                                            href={`#${h.id}`}
                                            className={`block text-[13px] text-slate-500 hover:text-primary-600 transition-colors leading-snug py-0.5 ${h.level === 1 ? 'font-semibold' : h.level === 2 ? 'pl-3' : 'pl-6 text-[12px]'}`}
                                        >
                                            {h.text}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}

function CommentBlock({ comment, articleId, user, onReply, onDelete, onLike, parentId }) {
    const isOwn = user && comment.author?._id === user._id;
    const isAdmin = user && ['admin', 'super_admin', 'moderator'].includes(user.role);
    const av = avatarSrc(comment.author);

    return (
        <div className={`flex gap-3 ${parentId ? 'ml-10 mt-3' : ''}`}>
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-primary-100 flex items-center justify-center">
                {av ? <img src={av} alt={comment.author?.name} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary-700">{comment.author?.name?.charAt(0)}</span>}
            </div>
            <div className="flex-1 min-w-0">
                <div className="bg-slate-50 rounded-2xl rounded-tl-none p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[13px] font-semibold text-slate-800">{comment.author?.name}</span>
                        <span className="text-xs text-slate-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                </div>
                <div className="flex items-center gap-4 mt-2 px-1">
                    <button onClick={() => onLike(articleId, comment._id, parentId)}
                        className={`flex items-center gap-1 text-xs transition-colors ${comment.isLiked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}>
                        <svg className="w-3.5 h-3.5" fill={comment.isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"/></svg>
                        {comment.likeCount || ''}
                    </button>
                    {!parentId && user && (
                        <button onClick={() => onReply(comment._id, comment.author?.name)}
                            className="text-xs text-slate-400 hover:text-primary-600 transition-colors">Reply</button>
                    )}
                    {(isOwn || isAdmin) && (
                        <button onClick={() => onDelete(articleId, comment._id, parentId)}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors ml-auto">Delete</button>
                    )}
                </div>
                {/* Replies */}
                {comment.replies?.map(r => (
                    <CommentBlock key={r._id} comment={r} articleId={articleId} user={user} onReply={onReply} onDelete={onDelete} onLike={onLike} parentId={comment._id} />
                ))}
            </div>
        </div>
    );
}

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
