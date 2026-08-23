import { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import SellerSidebar from './SellerSidebar';

function SellerLayout() {
    const { user } = useSelector(state => state.auth);
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/seller/login');
        } else if (user.role !== 'seller' && user.role !== 'admin' && user.role !== 'super_admin') {
            navigate('/seller/login');
        }
    }, [user, navigate]);

    if (!user) return null;

    return (
        <div className="flex h-screen bg-surface font-sans overflow-hidden">

            {/* ── Mobile backdrop ── */}
            <div
                onClick={() => setSidebarOpen(false)}
                className={`fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
                    sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            />

            {/* ── Sidebar ── */}
            <div className={`
                fixed inset-y-0 left-0 z-30 w-64
                transform transition-transform duration-300 ease-out
                lg:relative lg:translate-x-0 lg:flex lg:flex-col
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <SellerSidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* ── Main column ── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* Top bar — mobile only */}
                <header className="lg:hidden h-14 flex-shrink-0 bg-white border-b border-slate-100 flex items-center gap-3 px-4 z-10">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 -ml-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        aria-label="Open navigation"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>

                    {/* Mobile logo */}
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-md flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>
                            </svg>
                        </div>
                        <div>
                            <span className="font-bold text-slate-900 text-sm">DreamJob</span>
                            <span className="text-indigo-500 text-xs ml-1 font-medium">Seller</span>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-4 sm:p-6 lg:p-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default SellerLayout;
