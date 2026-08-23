import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../lib/api';

const FILE_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';
const levelColor = (level) => ({
    Explorer: 'bg-slate-100 text-slate-700', Trailblazer: 'bg-emerald-100 text-emerald-700',
    Achiever: 'bg-blue-100 text-blue-700', Expert: 'bg-violet-100 text-violet-700',
    Master: 'bg-amber-100 text-amber-700', Legend: 'bg-rose-100 text-rose-700', Guru: 'bg-indigo-100 text-indigo-700',
}[level] || 'bg-slate-100 text-slate-700');

function logoUrl(logo) {
    if (!logo) return null;
    return logo.startsWith('http') ? logo : `${FILE_BASE}${logo}`;
}

function CompanyCard({ company }) {
    return (
        <Link to={`/interview-hub/companies/${company.slug}`} className="flex-shrink-0 snap-start w-40 bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition text-center">
            <div className="w-14 h-14 mx-auto rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden mb-3">
                {company.logo ? <img src={logoUrl(company.logo)} alt={company.name} className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-slate-500">{company.name?.charAt(0)}</span>}
            </div>
            <p className="font-semibold text-sm text-slate-800 truncate">{company.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{company.stats?.totalExperiences || 0} experiences</p>
        </Link>
    );
}

function ExperienceCard({ exp }) {
    const resultColor = { Selected: 'bg-emerald-100 text-emerald-700', Rejected: 'bg-red-100 text-red-700', Pending: 'bg-amber-100 text-amber-700' }[exp.result];
    return (
        <Link to={`/interview-hub/experiences/${exp._id}`} className="block bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-card hover:border-slate-200 transition-all duration-200">
            <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-slate-900 truncate">{exp.company?.name || exp.companyNameRaw}</span>
                    <span className="text-slate-400 text-sm shrink-0">• {exp.jobRole}</span>
                </div>
                <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${resultColor}`}>{exp.result}</span>
            </div>
            <p className="text-xs text-slate-400 mb-2">{exp.experienceLevel} • {exp.interviewMode} • Difficulty {exp.overallDifficulty}/5</p>
            <div className="flex items-center justify-between text-xs text-slate-500">
                <span>by {exp.user?.name || 'Anonymous'}</span>
                <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-rose-400" fill="currentColor" viewBox="0 0 24 24"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
                        {exp.likesCount}
                    </span>
                    <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
                        {exp.commentsCount}
                    </span>
                </span>
            </div>
        </Link>
    );
}

function InterviewHub() {
    const { user } = useSelector(s => s.auth);
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [trending, setTrending] = useState([]);
    const [recent, setRecent] = useState([]);
    const [topQuestions, setTopQuestions] = useState([]);
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/companies/trending'),
            api.get('/experiences', { params: { sort: 'recent', limit: 6 } }),
            api.get('/experiences/top-questions', { params: { limit: 8 } }),
            api.get('/experiences/leaderboard', { params: { limit: 5 } }),
        ]).then(([t, r, q, l]) => {
            setTrending(t.data.data || []);
            setRecent(r.data.data || []);
            setTopQuestions(q.data.data || []);
            setLeaders(l.data.data || []);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const onSearch = (e) => {
        e.preventDefault();
        navigate(`/interview-hub/companies?search=${encodeURIComponent(search)}`);
    };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-10">
                {/* Hero */}
                <div className="relative overflow-hidden bg-gradient-hero rounded-2xl px-6 py-10 sm:py-12 text-white text-center">
                    <div className="absolute -top-10 -right-10 w-52 h-52 bg-white/[0.05] rounded-full pointer-events-none" />
                    <div className="absolute bottom-0 -left-8 w-40 h-40 bg-violet-600/30 rounded-full pointer-events-none" />
                    <div className="relative">
                        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 mb-4">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs text-white/80 font-medium">Real experiences from real candidates</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Interview Experience Hub</h1>
                        <p className="text-white/70 max-w-2xl mx-auto mb-6 text-sm sm:text-base">Browse company-wise interview insights, prepare smarter, and share your own story to help others.</p>
                        <form onSubmit={onSearch} className="max-w-lg mx-auto flex gap-2">
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies (e.g. Google, Amazon...)"
                                className="flex-1 px-4 py-3 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-primary-400 text-sm" />
                            <button type="submit" className="px-5 py-3 bg-white/15 border border-white/30 rounded-xl font-semibold text-sm hover:bg-white/25 transition backdrop-blur-sm">Search</button>
                        </form>
                        <div className="flex gap-3 justify-center mt-5 flex-wrap">
                            <Link to="/interview-hub/submit" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white text-slate-900 rounded-xl font-semibold text-sm hover:bg-slate-100 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                                Share Your Experience
                            </Link>
                            <Link to="/interview-hub/companies" className="px-4 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl font-semibold text-sm hover:bg-white/20 transition">Browse Companies</Link>
                            <Link to="/interview-hub/leaderboard" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/10 border border-white/20 text-white rounded-xl font-semibold text-sm hover:bg-white/20 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>
                                Leaderboard
                            </Link>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                    <>
                        {/* Trending companies */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    Trending Companies
                                </h2>
                                <Link to="/interview-hub/companies" className="text-sm text-primary-600 font-medium hover:underline">View All</Link>
                            </div>
                            {trending.length === 0 ? (
                                <p className="text-sm text-slate-400">No trending companies yet — be the first to share an experience!</p>
                            ) : (
                                <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                                    {trending.map(t => <CompanyCard key={t.company._id} company={t.company} />)}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* Recent experiences */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" /></svg>
                                        Recent Experiences
                                    </h2>
                                    <Link to="/interview-hub/companies" className="text-sm text-primary-600 font-medium hover:underline">Browse All</Link>
                                </div>
                                {recent.length === 0 ? (
                                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400">No experiences shared yet.</div>
                                ) : recent.map(exp => <ExperienceCard key={exp._id} exp={exp} />)}
                            </div>

                            {/* Sidebar: leaderboard + top questions */}
                            <div className="space-y-6">
                                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>
                                        Top Contributors
                                    </h3>
                                        <Link to="/interview-hub/leaderboard" className="text-xs text-primary-600 font-medium hover:underline">All →</Link>
                                    </div>
                                    <div className="space-y-2">
                                        {leaders.map((u, i) => (
                                            <div key={u._id} className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-slate-400 w-5">{i + 1}</span>
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">{u.name?.charAt(0)?.toUpperCase()}</div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${levelColor(u.level)}`}>{u.level}</span>
                                                </div>
                                                <span className="text-xs font-bold text-slate-500">{u.points}pt</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
                                        Frequently Asked
                                    </h3>
                                    <div className="space-y-2">
                                        {topQuestions.map((q, i) => (
                                            <div key={i} className="text-sm text-slate-600 p-2 bg-slate-50 rounded-lg flex justify-between gap-2">
                                                <span className="line-clamp-2">{q.question}</span>
                                                <span className="text-xs text-slate-400 flex-shrink-0">×{q.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {user && (
                                    <Link to="/interview-hub/my-profile" className="block bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl p-5 hover:from-indigo-700 hover:to-violet-700 transition shadow-glow">
                                        <p className="font-bold flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            My Hub Profile
                                        </p>
                                        <p className="text-sm text-indigo-100 mt-1">View your points, badges & redeem rewards →</p>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

        </>
    );
}

export default InterviewHub;
