import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import api from '../lib/api';
import Sidebar from './Sidebar';
import { logout } from '../features/auth/authSlice';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const { user } = useSelector(state => state.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSignOut = async () => {
        setDropdownOpen(false);
        await dispatch(logout());
        navigate('/login');
    };

    useEffect(() => {
        if (!user) return;
        api.get('/notifications/unread').then(r => setHasUnread(r.data.hasUnread)).catch(() => {});
    }, [user, location.pathname]);

    const avatarSrc = user?.profilePic
        ? (user.profilePic.startsWith('http') ? user.profilePic : `${API_BASE}${user.profilePic}`)
        : null;

    return (
        <div className="flex h-screen bg-surface font-sans overflow-hidden">

            {/* ── Mobile backdrop ──────────────────────────────────────── */}
            <div
                onClick={() => setSidebarOpen(false)}
                className={`fixed inset-0 z-20 bg-black/30 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
                    sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            />

            {/* ── Sidebar ──────────────────────────────────────────────── */}
            <div className={`
                fixed inset-y-0 left-0 z-30 w-64
                transform transition-transform duration-300 ease-out
                lg:relative lg:translate-x-0 lg:flex lg:flex-col
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* ── Main column ──────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* Top bar */}
                <header className="h-14 flex-shrink-0 bg-white border-b border-slate-100 flex items-center gap-3 px-4 lg:px-6 z-10">
                    {/* Mobile hamburger */}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden p-2 -ml-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        aria-label="Open navigation"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>

                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-2 mr-auto">
                        <div className="w-6 h-6 bg-gradient-to-br from-primary-600 to-violet-600 rounded-md flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                            </svg>
                        </div>
                        <span className="font-bold text-slate-900 text-[15px]">DreamJob</span>
                    </div>

                    {/* Desktop: push right */}
                    <div className="hidden lg:block flex-1" />

                    {/* Right actions */}
                    <div className="flex items-center gap-1">
                        {/* Notifications */}
                        <Link
                            to="/notifications"
                            className="relative p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            title="Notifications"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                            </svg>
                            {hasUnread && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                            )}
                        </Link>

                        {/* User avatar + dropdown */}
                        <div className="relative ml-1" ref={dropdownRef}>
                            <button
                                onClick={() => setDropdownOpen(o => !o)}
                                className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0 overflow-hidden ring-2 ring-transparent hover:ring-primary-300 transition-all"
                                aria-label="Account menu"
                            >
                                {avatarSrc ? (
                                    <img src={avatarSrc} alt={user?.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span>{user?.name?.charAt(0).toUpperCase()}</span>
                                )}
                            </button>

                            {dropdownOpen && (
                                <div className="absolute right-0 top-10 w-52 bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 py-1.5 z-50 animate-in">
                                    {/* User info header */}
                                    <div className="px-4 py-2.5 border-b border-slate-100">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                                    </div>

                                    <div className="py-1">
                                        <Link
                                            to="/profile"
                                            onClick={() => setDropdownOpen(false)}
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                            </svg>
                                            Profile
                                        </Link>

                                        <button
                                            onClick={handleSignOut}
                                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                                            </svg>
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-4 sm:p-6 lg:p-8 animate-in">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default Layout;
