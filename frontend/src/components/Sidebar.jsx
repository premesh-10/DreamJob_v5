import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout, reset } from '../features/auth/authSlice';
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

/* ── Inline SVG icon ──────────────────────────────────────────────────── */
const Ic = ({ d, className = 'w-[18px] h-[18px] flex-shrink-0' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
);

const P = {
    home:       'm2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
    user:       'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
    book:       'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25',
    test:       'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
    video:      'm15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z',
    radio:      'M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z',
    chart:      'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
    globe:      'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418',
    id:         'M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z',
    sparkles:   'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z',
    bag:        'M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z',
    doc:        'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
    scale:      'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97Z',
    bell:       'M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0',
    chat:       'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z',
    cog:        'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    signout:    'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9',
    newspaper:  'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z',
    bookmark:   'M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z',
    pencil:     'M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125',
};

/* ── Nav section wrapper ───────────────────────────────────────────────── */
function NavGroup({ label, children }) {
    return (
        <div className="mb-1">
            {label && <p className="px-3 py-1.5 section-label">{label}</p>}
            {children}
        </div>
    );
}

/* ── Single nav link ───────────────────────────────────────────────────── */
function NavItem({ name, path, icon, badge, onClick, exclude }) {
    const location = useLocation();
    const active = path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(path) && (!exclude || !exclude.some(e => location.pathname.startsWith(e)));

    return (
        <Link
            to={path}
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${
                active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
        >
            {/* Left accent bar */}
            {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-600 rounded-r-full" />
            )}
            <Ic d={P[icon]} className={`w-[17px] h-[17px] flex-shrink-0 transition-colors ${active ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            <span className="flex-1 truncate">{name}</span>
            {badge && (
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            )}
        </Link>
    );
}

/* ── Sidebar ──────────────────────────────────────────────────────────── */
const ADMIN_ROLES  = ['admin', 'super_admin', 'moderator', 'finance_admin', 'support_admin'];
const SELLER_ROLES = ['seller', 'admin', 'super_admin'];

function Sidebar({ onClose }) {
    const dispatch  = useDispatch();
    const navigate  = useNavigate();
    const { user }  = useSelector(state => state.auth);

    const onLogout = async () => {
        dispatch(reset());
        await dispatch(logout());
        navigate('/login');
    };

    const avatarSrc = user?.profilePic
        ? (user.profilePic.startsWith('http') ? user.profilePic : `${API_BASE}${user.profilePic}`)
        : null;

    return (
        <aside className="h-full w-64 bg-white border-r border-slate-100 flex flex-col select-none">

            {/* Logo ─────────────────────────────────────────────────── */}
            <div className="h-14 flex items-center justify-between px-5 border-b border-slate-100">
                <Link to="/" onClick={onClose} className="flex items-center gap-2.5 group">
                    <div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm">
                        <svg className="w-[15px] h-[15px] text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                        </svg>
                    </div>
                    <span className="font-bold text-[16px] text-slate-900 tracking-tight group-hover:text-primary-600 transition-colors">
                        DreamJob
                    </span>
                </Link>
                {/* Mobile close */}
                <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Nav ──────────────────────────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-2 space-y-4">
                <NavGroup>
                    <NavItem name="Dashboard"      path="/"                        icon="home" onClick={onClose} />
                    <NavItem name="Profile"         path="/profile"                 icon="user" onClick={onClose} />
                    <NavItem name="Hub Profile"     path="/interview-hub/my-profile" icon="id"   onClick={onClose} />
                </NavGroup>

                <NavGroup label="Learn & Prepare">
                    <NavItem name="Course Catalog"   path="/courses"         icon="book"  onClick={onClose} />
                    <NavItem name="Practice Tests"   path="/practice-tests"  icon="test"  onClick={onClose} />
                    <NavItem name="Mock Interviews"  path="/interviews"      icon="video" onClick={onClose} />
                    <NavItem name="Live Webinars"    path="/webinars"        icon="radio" onClick={onClose} />
                </NavGroup>

                <NavGroup label="Knowledge Hub">
                    <NavItem name="Explore Articles" path="/knowledge"              icon="newspaper" onClick={onClose} exclude={['/knowledge/my-articles', '/knowledge/bookmarks', '/knowledge/write', '/knowledge/edit']} />
                    <NavItem name="Write Article"    path="/knowledge/write"        icon="pencil"    onClick={onClose} />
                    <NavItem name="My Articles"      path="/knowledge/my-articles"  icon="doc"       onClick={onClose} />
                    <NavItem name="Bookmarks"        path="/knowledge/bookmarks"    icon="bookmark"  onClick={onClose} />
                </NavGroup>

                <NavGroup label="Career">
                    <NavItem name="Interview Tracker" path="/interview-tracker" icon="chart" onClick={onClose} />
                    <NavItem name="Interview Hub"     path="/interview-hub"    icon="globe" onClick={onClose} exclude={['/interview-hub/my-profile']} />
                </NavGroup>

                <NavGroup label="Account">
                    <NavItem name="Subscriptions"    path="/pricing"       icon="sparkles" onClick={onClose} />
                    <NavItem name="Purchase History" path="/history"       icon="bag"      onClick={onClose} />
                    <NavItem name="Notifications"    path="/notifications" icon="bell"     onClick={onClose} />
                    <NavItem name="My Reports"       path="/reports"       icon="doc"      onClick={onClose} />
                    <NavItem name="My Disputes"      path="/disputes"      icon="scale"    onClick={onClose} />
                    <NavItem name="Give Feedback"    path="/feedback"      icon="chat"     onClick={onClose} />
                </NavGroup>

                {ADMIN_ROLES.includes(user?.role) && (
                    <NavGroup label="Admin">
                        <NavItem name="Admin Console" path="/admin" icon="cog" onClick={onClose} />
                    </NavGroup>
                )}
            </nav>

            {/* Seller CTA ────────────────────────────────────────────── */}
            <div className="px-3 pb-2">
                {SELLER_ROLES.includes(user?.role) ? (
                    <Link
                        to="/seller"
                        onClick={onClose}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all shadow-primary"
                    >
                        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                        </svg>
                        <span className="flex-1">Seller Hub</span>
                        <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                    </Link>
                ) : (
                    <Link
                        to="/seller/register"
                        onClick={onClose}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 transition-all border border-primary-100"
                    >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        <span>Become a Seller</span>
                    </Link>
                )}
            </div>

            {/* User footer ─────────────────────────────────────────── */}
            <div className="p-3 border-t border-slate-100">
                <div className="flex items-center gap-3 px-2 py-2 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0 overflow-hidden ring-2 ring-primary-100">
                        {avatarSrc
                            ? <img src={avatarSrc} alt={user?.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                            : <span>{user?.name?.charAt(0).toUpperCase()}</span>
                        }
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{user?.name}</p>
                        <p className="text-[11px] text-slate-400 capitalize leading-tight mt-0.5">{user?.role}</p>
                    </div>
                    <button
                        onClick={onLogout}
                        title="Sign out"
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                        <Ic d={P.signout} className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
