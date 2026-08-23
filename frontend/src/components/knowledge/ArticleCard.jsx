import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

const CATEGORY_COLORS = {
    Technology: 'bg-blue-100 text-blue-700',
    Programming: 'bg-violet-100 text-violet-700',
    JavaScript: 'bg-yellow-100 text-yellow-800',
    Python: 'bg-green-100 text-green-700',
    Java: 'bg-orange-100 text-orange-700',
    'System Design': 'bg-indigo-100 text-indigo-700',
    DSA: 'bg-teal-100 text-teal-700',
    'Interview Preparation': 'bg-rose-100 text-rose-700',
    'Career Guidance': 'bg-emerald-100 text-emerald-700',
    'Web Development': 'bg-cyan-100 text-cyan-700',
    AI: 'bg-purple-100 text-purple-700',
    'Machine Learning': 'bg-fuchsia-100 text-fuchsia-700',
    DevOps: 'bg-amber-100 text-amber-700',
    Cloud: 'bg-sky-100 text-sky-700',
};

const defaultColor = 'bg-slate-100 text-slate-600';

function categoryColor(cat) {
    return CATEGORY_COLORS[cat] || defaultColor;
}

function avatarSrc(user) {
    if (!user?.profilePic) return null;
    return user.profilePic.startsWith('http') ? user.profilePic : `${API_BASE}${user.profilePic}`;
}

export default function ArticleCard({ article, className = '' }) {
    const cover = article.coverImage
        ? (article.coverImage.startsWith('http') ? article.coverImage : `${API_BASE}${article.coverImage}`)
        : null;

    return (
        <article className={`card-interactive flex flex-col overflow-hidden group ${className}`}>
            {/* Cover */}
            {cover && (
                <Link to={`/knowledge/article/${article.slug}`} className="block overflow-hidden flex-shrink-0 h-44">
                    <img
                        src={cover}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                    />
                </Link>
            )}

            {/* Body */}
            <div className="flex flex-col flex-1 p-5">
                {/* Category + reading time */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {article.category && (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${categoryColor(article.category)}`}>
                            {article.category}
                        </span>
                    )}
                    {article.isFeatured && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                            Featured
                        </span>
                    )}
                    {article.isEditorsPick && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            Editor's Pick
                        </span>
                    )}
                    <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        {article.readingTimeMinutes} min read
                    </span>
                </div>

                {/* Title */}
                <Link to={`/knowledge/article/${article.slug}`}>
                    <h3 className="font-bold text-slate-900 text-[15px] leading-snug mb-2 group-hover:text-primary-600 transition-colors line-clamp-2">
                        {article.title}
                    </h3>
                </Link>

                {/* Excerpt */}
                <p className="text-slate-500 text-[13px] leading-relaxed mb-4 line-clamp-2 flex-1">
                    {article.excerpt}
                </p>

                {/* Tags */}
                {article.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {article.tags.slice(0, 3).map(tag => (
                            <Link key={tag} to={`/knowledge?tag=${tag}`}
                                className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-primary-50 hover:text-primary-600 text-slate-500 rounded-full transition-colors">
                                #{tag}
                            </Link>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                    {/* Author */}
                    <Link to={`/knowledge/author/${article.author?._id}`} className="flex items-center gap-2 group/author min-w-0">
                        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-primary-100 flex items-center justify-center">
                            {avatarSrc(article.author) ? (
                                <img src={avatarSrc(article.author)} alt={article.author?.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[11px] font-bold text-primary-700">{article.author?.name?.charAt(0)}</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 group-hover/author:text-primary-600 transition-colors truncate">{article.author?.name}</p>
                        </div>
                    </Link>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-slate-400 text-xs flex-shrink-0">
                        <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                            {formatCount(article.viewCount)}
                        </span>
                        <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill={article.isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                            </svg>
                            {formatCount(article.likeCount)}
                        </span>
                    </div>
                </div>
            </div>
        </article>
    );
}

function formatCount(n) {
    if (!n) return '0';
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}
