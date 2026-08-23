import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '../features/auth/authSlice';
import api from '../lib/api';

/* ── Tiny icon helper ─────────────────────────────────────────────────── */
const Ic = ({ d, className = 'w-5 h-5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
);

function getGreeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Dashboard() {
    const navigate  = useNavigate();
    const dispatch  = useDispatch();
    const { user }  = useSelector(state => state.auth);

    const [upcomingInterviews, setUpcomingInterviews] = useState([]);
    const [enrolledCourses,    setEnrolledCourses]    = useState([]);
    const [loadingInterviews,  setLoadingInterviews]  = useState(true);
    const [upcomingTracker,    setUpcomingTracker]    = useState([]);
    const [joinSettings,       setJoinSettings]       = useState({ interviewJoinWindowMinutesBefore: 15, interviewJoinWindowMinutesAfterEnd: 0 });

    useEffect(() => {
        if (!user) { navigate('/login'); return; }

        api.get('/auth/me').then(r => { if (r.data?.data) dispatch(setUser(r.data.data)); }).catch(() => {});

        api.get('/interviews/bookings/me')
            .then(r => {
                const future = (r.data.data || [])
                    .filter(b => b.type === 'interview' && b.status !== 'cancelled' && b.status !== 'completed')
                    .slice(0, 5);
                setUpcomingInterviews(future);
            })
            .catch(() => {})
            .finally(() => setLoadingInterviews(false));

        api.get('/courses/enrolled').then(r => setEnrolledCourses(r.data.data || [])).catch(() => {});
        api.get('/job-applications/upcoming').then(r => setUpcomingTracker((r.data.data || []).slice(0, 5))).catch(() => {});
        api.get('/settings/public').then(r => r.data?.data && setJoinSettings(r.data.data)).catch(() => {});
    }, [user, navigate]);

    if (!user) return null;

    const daysLeft = (() => {
        if (!user?.subscription?.validUntil || user.subscription.plan === 'None') return null;
        return Math.ceil((new Date(user.subscription.validUntil) - new Date()) / 864e5);
    })();

    return (
            <div className="max-w-6xl mx-auto space-y-6">

                {/* ── Hero banner ───────────────────────────────────────── */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-7 text-white">
                    {/* Decorative circles */}
                    <div className="pointer-events-none absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/[0.07]" />
                    <div className="pointer-events-none absolute bottom-0 right-24 w-36 h-36 rounded-full bg-white/[0.05] translate-y-1/2" />
                    <div className="pointer-events-none absolute top-4 right-48 w-20 h-20 rounded-full bg-violet-400/20" />

                    <div className="relative z-10">
                        <p className="text-indigo-200 text-sm font-medium mb-0.5">{getGreeting()}</p>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 tracking-tight">
                            {user?.name?.split(' ')[0]} 👋
                        </h1>
                        <p className="text-indigo-200 text-sm mb-6 max-w-sm">
                            Continue your journey — your dream job is closer than you think.
                        </p>

                        {/* Quick stats inline */}
                        <div className="flex flex-wrap gap-4 mb-6">
                            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3.5 py-2 border border-white/10">
                                <Ic d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" className="w-4 h-4 text-violet-300" />
                                <div>
                                    <p className="text-[10px] text-indigo-300 font-medium uppercase tracking-wide">Plan</p>
                                    <p className="text-sm font-bold text-white leading-tight">{user?.subscription?.plan || 'Free'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3.5 py-2 border border-white/10">
                                <Ic d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" className="w-4 h-4 text-violet-300" />
                                <div>
                                    <p className="text-[10px] text-indigo-300 font-medium uppercase tracking-wide">Courses</p>
                                    <p className="text-sm font-bold text-white leading-tight">{enrolledCourses.length} enrolled</p>
                                </div>
                            </div>
                            {daysLeft !== null && (
                                <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2 border ${daysLeft <= 0 ? 'bg-red-500/20 border-red-400/30' : daysLeft <= 7 ? 'bg-amber-500/20 border-amber-400/30' : 'bg-white/10 border-white/10'}`}>
                                    <Ic d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" className="w-4 h-4 text-violet-300" />
                                    <div>
                                        <p className="text-[10px] text-indigo-300 font-medium uppercase tracking-wide">Expires</p>
                                        <p className="text-sm font-bold text-white leading-tight">{daysLeft <= 0 ? 'Expired' : `${daysLeft}d left`}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                            <Link to="/courses" className="inline-flex items-center gap-1.5 bg-white text-indigo-700 font-semibold px-4 py-2 rounded-xl text-sm hover:bg-indigo-50 transition-colors shadow-sm">
                                Browse Courses
                            </Link>
                            <Link to="/interviews" className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
                                Book Interview
                            </Link>
                        </div>
                    </div>
                </div>

                {/* ── Interview Tracker ─────────────────────────────────── */}
                <div className="card p-6">
                    <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                <Ic d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" className="w-4 h-4 text-blue-600" />
                            </div>
                            <h2 className="section-title">Interview Tracker</h2>
                        </div>
                        <Link to="/interview-tracker" className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
                            Open Tracker →
                        </Link>
                    </div>

                    {upcomingTracker.length === 0 ? (
                        <EmptySlate icon="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" label="No upcoming interviews or follow-ups" cta={{ to: '/interview-tracker', label: 'Open Interview Tracker' }} />
                    ) : (
                        <div className="space-y-2">
                            {upcomingTracker.map((item, idx) => (
                                <Link key={idx} to={`/interview-tracker/${item.applicationId}`}
                                    className="flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-primary-50 rounded-xl border border-transparent hover:border-primary-100 transition-all group">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 group-hover:text-primary-700 transition-colors">
                                            {item.companyName} — {item.label}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {item.jobTitle} · {item.type === 'follow-up' ? 'Recruiter follow-up' : 'Interview stage'}
                                        </p>
                                    </div>
                                    <span className="text-xs text-slate-400 font-medium flex-shrink-0 ml-4">
                                        {new Date(item.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── 2-col grid ────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Upcoming mock interviews */}
                    <div className="lg:col-span-2 card p-6">
                        <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                                    <Ic d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" className="w-4 h-4 text-violet-600" />
                                </div>
                                <h2 className="section-title">Mock Interviews</h2>
                            </div>
                            <Link to="/history" className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">View all</Link>
                        </div>

                        {loadingInterviews ? (
                            <div className="flex items-center justify-center py-10">
                                <span className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : upcomingInterviews.length === 0 ? (
                            <EmptySlate icon="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" label="No upcoming interviews" cta={{ onClick: () => navigate('/interviews'), label: 'Book an Interview' }} />
                        ) : (
                            <div className="space-y-2">
                                {upcomingInterviews.map(b => (
                                    <InterviewRow key={b._id} booking={b} joinSettings={joinSettings} navigate={navigate} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Enrolled courses */}
                    <div className="card p-6">
                        <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                    <Ic d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" className="w-4 h-4 text-emerald-600" />
                                </div>
                                <h2 className="section-title">My Courses</h2>
                            </div>
                            <Link to="/courses" className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">Browse</Link>
                        </div>

                        {enrolledCourses.length === 0 ? (
                            <EmptySlate icon="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" label="No courses yet" cta={{ onClick: () => navigate('/courses'), label: 'Browse Catalog' }} />
                        ) : (
                            <div className="space-y-1">
                                {enrolledCourses.slice(0, 5).map(course => (
                                    <Link key={course._id} to={`/courses/${course._id}`}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                                            {course.title?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-primary-700 transition-colors">{course.title}</p>
                                            <p className="text-xs text-slate-400 truncate mt-0.5">{course.category}</p>
                                        </div>
                                    </Link>
                                ))}
                                {enrolledCourses.length > 5 && (
                                    <Link to="/history" className="block text-xs text-center text-slate-400 hover:text-primary-600 pt-2 pb-1 transition-colors">
                                        +{enrolledCourses.length - 5} more courses
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Quick links strip ─────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Practice Tests',   path: '/practice-tests',  icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z', color: 'bg-amber-50 text-amber-600' },
                        { label: 'Live Webinars',    path: '/webinars',         icon: 'M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z', color: 'bg-rose-50 text-rose-500' },
                        { label: 'Interview Hub',    path: '/interview-hub',    icon: 'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418', color: 'bg-sky-50 text-sky-600' },
                        { label: 'Subscriptions',    path: '/pricing',          icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z', color: 'bg-purple-50 text-purple-600' },
                    ].map(q => (
                        <Link key={q.label} to={q.path}
                            className="card flex items-center gap-3 p-4 hover:shadow-card-hover hover:-translate-y-px transition-all duration-200 group">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${q.color}`}>
                                <Ic d={q.icon} className="w-4.5 h-4.5 w-5 h-5" />
                            </div>
                            <span className="min-w-0 text-sm font-semibold text-slate-700 group-hover:text-primary-700 transition-colors leading-tight text-center sm:text-left">{q.label}</span>
                        </Link>
                    ))}
                </div>
            </div>

    );
}

/* ── Empty state ─────────────────────────────────────────────────────── */
function EmptySlate({ icon, label, cta }) {
    const navigate = useNavigate();
    return (
        <div className="flex flex-col items-center justify-center py-10 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-center">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-soft flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-2">{label}</p>
            {cta && (
                cta.to
                    ? <Link to={cta.to} className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">{cta.label} →</Link>
                    : <button onClick={cta.onClick} className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">{cta.label} →</button>
            )}
        </div>
    );
}

/* ── Interview row card ──────────────────────────────────────────────── */
function InterviewRow({ booking, joinSettings, navigate }) {
    const STATUS = {
        confirmed:   'bg-emerald-100 text-emerald-700',
        'in-progress':'bg-amber-100 text-amber-700',
        completed:   'bg-blue-100 text-blue-700',
    };
    const now = new Date();
    let joinBtn = null;
    if (booking.session && !['cancelled', 'no_show'].includes(booking.session.completionStatus)) {
        const start = new Date(booking.session.scheduledStart);
        const end   = new Date(booking.session.scheduledEnd);
        const winStart = new Date(start - joinSettings.interviewJoinWindowMinutesBefore * 60000);
        const winEnd   = new Date(+end + (joinSettings.interviewJoinWindowMinutesAfterEnd || 0) * 60000);
        joinBtn = now >= winStart && now <= winEnd
            ? <button onClick={() => navigate(`/interview-room/${booking.session._id}`)} className="text-xs bg-gradient-to-r from-primary-600 to-violet-600 text-white px-3 py-1.5 rounded-lg font-semibold shadow-sm hover:shadow-primary transition-all">Join →</button>
            : <span className="text-xs bg-slate-100 text-slate-400 px-3 py-1.5 rounded-lg font-semibold cursor-not-allowed">Locked</span>;
    }
    return (
        <>
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-primary-50/40 border border-transparent hover:border-primary-100 transition-all">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {booking.interview?.interviewer?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{booking.interview?.domain || 'Mock Interview'}</p>
                <p className="text-xs text-slate-400 mt-0.5">with {booking.interview?.interviewer?.name || 'Interviewer'}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${STATUS[booking.status] || 'bg-slate-100 text-slate-500'}`}>
                    {booking.status === 'in-progress' ? 'Live' : booking.status}
                </span>
                {joinBtn}
            </div>
        </div>
        </>
    );
}

export default Dashboard;
