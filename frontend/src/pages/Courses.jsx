import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
const getFileUrl = (path) => path ? (path.startsWith('http') ? path : `${API_BASE}${path}`) : '';
const PAGE_SIZE = 12;

function Courses() {
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const [courses, setCourses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [wishlist, setWishlist] = useState(new Set());
    const [wishlistLoading, setWishlistLoading] = useState(new Set());

    useEffect(() => {
        api.get('/courses/categories')
            .then(({ data }) => setCategories(data.data || []))
            .catch(error => console.error('Failed to fetch categories', error));
    }, []);

    useEffect(() => {
        if (!user) { setWishlist(new Set()); return; }
        api.get('/courses/wishlist').then(r => {
            setWishlist(new Set((r.data.data || []).map(c => c._id)));
        }).catch(() => {});
    }, [user]);

    const toggleWishlist = async (e, courseId) => {
        e.preventDefault();
        if (!user) { navigate('/login'); return; }
        if (wishlistLoading.has(courseId)) return;
        const isWishlisted = wishlist.has(courseId);
        setWishlist(prev => { const n = new Set(prev); isWishlisted ? n.delete(courseId) : n.add(courseId); return n; });
        setWishlistLoading(prev => new Set([...prev, courseId]));
        try {
            if (isWishlisted) await api.delete(`/courses/${courseId}/wishlist`);
            else await api.post(`/courses/${courseId}/wishlist`);
        } catch {
            setWishlist(prev => { const n = new Set(prev); isWishlisted ? n.add(courseId) : n.delete(courseId); return n; });
        } finally {
            setWishlistLoading(prev => { const n = new Set(prev); n.delete(courseId); return n; });
        }
    };

    useEffect(() => {
        let active = true;
        setLoading(true);
        const params = { page, limit: PAGE_SIZE };
        if (search.trim()) params.search = search.trim();
        if (category) params.category = category;

        api.get('/courses', { params })
            .then(({ data }) => {
                if (!active) return;
                setCourses(data.data || []);
                setPages(data.pages || 1);
                setTotal(data.total || 0);
            })
            .catch(error => console.error('Failed to fetch courses', error))
            .finally(() => { if (active) setLoading(false); });

        return () => { active = false; };
    }, [page, search, category]);

    const handleSearch = () => {
        setPage(1);
        setSearch(searchInput);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSearch();
    };

    const handleClear = () => {
        setSearchInput('');
        setSearch('');
        setPage(1);
    };

    const handleCategoryChange = (e) => {
        setCategory(e.target.value);
        setPage(1);
    };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6 animate-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Course Catalog</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Explore our wide range of professional courses</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <input
                            type="text"
                            placeholder="Search courses…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="input-field py-2 text-sm w-full"
                        />
                        <div className="flex gap-2 flex-wrap">
                            <select
                                value={category}
                                onChange={handleCategoryChange}
                                className="input-field py-2 text-sm flex-1 sm:flex-none"
                            >
                                <option value="">All Categories</option>
                                {categories.map(c => (
                                    <option key={c._id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                            <button onClick={handleSearch} className="btn-primary py-2 text-sm">Search</button>
                            {(searchInput || search) && (
                                <button onClick={handleClear} className="btn-secondary py-2 text-sm">Clear</button>
                            )}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                        <span className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
                        Loading courses…
                    </div>
                ) : courses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-white rounded-xl border border-slate-200">
                        <svg className="w-10 h-10 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        {search ? (
                            <>
                                <p className="font-medium text-sm">No courses found for "{search}"</p>
                                <button onClick={handleClear} className="mt-3 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">Show all courses</button>
                            </>
                        ) : (
                            <p className="text-sm">No published courses available yet.</p>
                        )}
                    </div>
                ) : (
                    <>
                        {search && (
                            <p className="text-slate-500 text-sm">{total} result{total !== 1 ? 's' : ''} for "{search}"</p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {courses.map(course => (
                                <Link key={course._id} to={`/courses/${course.slug || course._id}`} className="group card overflow-hidden hover:shadow-card-hover transition-shadow duration-200 flex flex-col relative">
                                    <div className="aspect-video bg-slate-100 overflow-hidden">
                                        {(course.thumbnailPath || course.thumbnail) ? (
                                            <img
                                                src={getFileUrl(course.thumbnailPath || course.thumbnail)}
                                                alt={course.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
                                                <svg className="w-12 h-12 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                            </div>
                                        )}
                                        {/* Wishlist button */}
                                        <button
                                            onClick={(e) => toggleWishlist(e, course._id)}
                                            className={`absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center shadow transition text-base ${wishlist.has(course._id) ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-400 hover:text-red-400'}`}
                                            title={wishlist.has(course._id) ? 'Remove from wishlist' : 'Save to wishlist'}
                                        >
                                            {wishlist.has(course._id) ? '♥' : '♡'}
                                        </button>
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-xs font-bold text-primary-600 uppercase tracking-wide">{course.category}</div>
                                            {course.chapters?.some(ch => ch.isFree) && (
                                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">Free Preview</span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-900 mb-1.5 line-clamp-2">{course.title}</h3>
                                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                                            <span className="text-amber-400 text-sm">★</span>
                                            <span className="text-slate-700 font-semibold text-sm">{(course.rating || 0).toFixed(1)}</span>
                                            <span className="text-slate-400 text-xs ml-1">({course.totalReviews || 0})</span>
                                            {course.enrollmentCount > 0 && (
                                                <>
                                                    <span className="text-slate-300 text-xs mx-0.5">•</span>
                                                    <span className="text-slate-400 text-xs">{course.enrollmentCount.toLocaleString()} students</span>
                                                </>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">{course.description}</p>
                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                                            <div className="text-sm font-medium text-slate-700">By {course.seller?.name || 'Unknown'}</div>
                                            <div className="font-bold text-lg text-slate-900">
                                                {course.price > 0 ? `₹${course.price}` : 'Free'}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        {pages > 1 && (
                            <div className="flex items-center justify-center gap-3 pt-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-sm py-2 disabled:opacity-40 disabled:cursor-not-allowed">
                                    ← Previous
                                </button>
                                <span className="text-sm text-slate-500">Page {page} of {pages}</span>
                                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} className="btn-secondary text-sm py-2 disabled:opacity-40 disabled:cursor-not-allowed">
                                    Next →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

        </>
    );
}

export default Courses;
