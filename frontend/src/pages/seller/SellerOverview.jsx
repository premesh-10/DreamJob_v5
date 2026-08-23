import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function StatCard({ iconPath, label, value, sub, color = 'indigo', className = '' }) {
    const colors = { indigo: 'from-indigo-500 to-indigo-600', violet: 'from-violet-500 to-violet-600', emerald: 'from-emerald-500 to-emerald-600', sky: 'from-sky-500 to-sky-600', amber: 'from-amber-500 to-amber-600' };
    return (
        <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-5 text-white shadow-lg ${className}`}>
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                </svg>
            </div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-black mt-1 truncate">{value}</p>
            {sub && <p className="text-white/60 text-xs mt-1">{sub}</p>}
        </div>
    );
}

function SellerOverview() {
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [p, s, o] = await Promise.all([
                    api.get('/sellers/me'),
                    api.get('/sellers/me/stats'),
                    api.get('/interviews/bookings/seller')
                ]);
                setProfile(p.data.data);
                setStats(s.data.data);
                setOrders(o.data.data?.slice(0, 5) || []);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    const chartData = stats?.monthlyEarnings?.map(m => ({
        name: MONTHS[(m._id.month - 1)],
        Revenue: m.total,
        Orders: m.count
    })) || [];

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-8">
                <div>
                    <h1 className="page-title">Seller Overview</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Welcome back — here's your performance summary.</p>
                </div>

                {/* Status warning */}
                {profile?.status !== 'approved' && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <div>
                            <p className="font-semibold text-amber-800 text-sm">Application {profile?.status}</p>
                            <p className="text-amber-700 text-sm">Your seller application is under review. You'll get full access once approved by admin.</p>
                        </div>
                    </div>
                )}

                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <StatCard iconPath="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" label="Total Earnings" value={`₹${stats?.totalEarnings?.toFixed(2) || '0.00'}`} color="indigo" />
                    <StatCard iconPath="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" label="Available Balance" value={`₹${stats?.presentBalance?.toFixed(2) || '0.00'}`} color="emerald" />
                    <StatCard iconPath="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" label="Total Students" value={stats?.totalStudents || 0} color="violet" />
                    <StatCard iconPath="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" label="My Courses" value={profile?.totalCourses || 0} color="amber" />
                    <StatCard iconPath="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" label="Total Orders" value={orders.length || 0} sub="All time" color="sky" className="col-span-2 sm:col-span-1" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Monthly Revenue Chart */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Monthly Revenue</h2>
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={v => [`₹${v}`, 'Revenue']} />
                                    <Bar dataKey="Revenue" fill="#6366f1" radius={[6,6,0,0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                <svg className="w-10 h-10 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                                </svg>
                                <p className="text-sm">No revenue data yet. Start selling!</p>
                            </div>
                        )}
                    </div>

                    {/* Top Courses */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Top Courses</h2>
                        {stats?.topCourses?.length > 0 ? (
                            <div className="space-y-3">
                                {stats.topCourses.map((c, i) => (
                                    <div key={c._id} className="flex items-center gap-3">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : 'bg-orange-400'}`}>{i+1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{c.title}</p>
                                            <p className="text-xs text-slate-500">{c.students} students · ₹{c.price}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-slate-400 text-sm text-center py-8">No courses yet</p>}
                    </div>
                </div>

                {/* Recent Orders */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Orders</h2>
                    {orders.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm hidden sm:table">
                                <thead><tr className="text-left text-slate-500 border-b border-slate-100">{['Student','Type','Item','Amount','Date'].map(h=><th key={h} className="pb-3 pr-4 font-medium">{h}</th>)}</tr></thead>
                                <tbody className="divide-y divide-slate-50">
                                    {orders.map(o => (
                                        <tr key={o._id} className="hover:bg-slate-50">
                                            <td className="py-3 pr-4 font-medium text-slate-800">{o.user?.name}</td>
                                            <td className="py-3 pr-4"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${o.type==='course'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{o.type}</span></td>
                                            <td className="py-3 pr-4 text-slate-600">{o.course?.title || o.interview?.domain || '—'}</td>
                                            <td className="py-3 pr-4 font-semibold text-emerald-600">{o.paymentStatus==='free'?'Free':`₹${o.amountPaid?.toFixed(2)}`}</td>
                                            <td className="py-3 text-slate-400 text-xs">{new Date(o.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* Mobile card list */}
                            <div className="sm:hidden space-y-3">
                                {orders.map(o => (
                                    <div key={o._id} className="p-4 border border-slate-100 rounded-xl">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-medium text-slate-800 truncate">{o.user?.name}</p>
                                                <p className="text-xs text-slate-500 mt-0.5 truncate">{o.course?.title || o.interview?.domain || '—'}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="font-semibold text-emerald-600">{o.paymentStatus==='free'?'Free':`₹${o.amountPaid?.toFixed(2)}`}</p>
                                                <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-bold ${o.type==='course'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{o.type}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">{new Date(o.createdAt).toLocaleDateString()}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : <p className="text-slate-400 text-sm text-center py-8">No orders yet</p>}
                </div>
            </div>

        </>
    );
}

export default SellerOverview;
