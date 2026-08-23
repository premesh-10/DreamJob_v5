import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function WebinarAnalytics() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/admin/webinars/analytics')
            .then(r => setData(r.data.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
    }

    const categoryChart = (data?.categoryBreakdown || []).map(c => ({ name: c.category, Webinars: c.count, Registrations: c.registrations }));

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Webinar Analytics</h1>
                        <p className="text-slate-500 mt-1">Platform-wide webinar performance</p>
                    </div>
                    <Link to="/admin/webinars" className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm">← Back to Webinar Management</Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                    {[
                        { label: 'Total Webinars', value: data?.totalWebinars || 0, icon: '🎙️', gradient: 'from-indigo-500 to-indigo-600' },
                        { label: 'Registrations', value: data?.totalRegistrations || 0, icon: '👥', gradient: 'from-violet-500 to-violet-600' },
                        { label: 'Attended', value: data?.totalAttended || 0, icon: '✅', gradient: 'from-emerald-500 to-emerald-600' },
                        { label: 'Total Revenue', value: `₹${(data?.totalRevenue || 0).toFixed(2)}`, icon: '💰', gradient: 'from-amber-500 to-amber-600' },
                        { label: 'Avg Rating', value: data?.averageRating ? `⭐ ${data.averageRating}` : '—', icon: '📝', gradient: 'from-sky-500 to-sky-600' },
                    ].map(card => (
                        <div key={card.label} className={`bg-gradient-to-br ${card.gradient} rounded-2xl p-6 text-white shadow-lg`}>
                            <div className="text-3xl mb-2">{card.icon}</div>
                            <p className="text-white/70 text-sm">{card.label}</p>
                            <p className="text-3xl font-black mt-1">{card.value}</p>
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Webinars by Category</h2>
                    <p className="text-slate-400 text-sm mb-5">Count and registrations per category</p>
                    {categoryChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={categoryChart} barCategoryGap="30%">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip />
                                <Bar dataKey="Webinars" fill="#6366f1" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="Registrations" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <span className="text-4xl mb-2">📊</span>
                            <p className="text-sm">No category data yet</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Top Webinars by Registrations</h2>
                        {data?.topWebinars?.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-slate-500 border-b border-slate-100">
                                            {['Webinar', 'Seller', 'Registered', 'Attended'].map(h => <th key={h} className="pb-3 pr-4 font-medium">{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {data.topWebinars.map(w => (
                                            <tr key={w._id} className="hover:bg-slate-50">
                                                <td className="py-3 pr-4 font-semibold text-slate-800 truncate max-w-[160px]">{w.name}</td>
                                                <td className="py-3 pr-4 text-slate-600">{w.seller?.name || '—'}</td>
                                                <td className="py-3 pr-4 text-slate-600">{w.registrationCount || 0}</td>
                                                <td className="py-3 pr-4 text-slate-600">{w.attendedCount || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="text-slate-400 text-sm py-6 text-center">No webinars yet</p>}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Most Active Attendees</h2>
                        {data?.mostActiveAttendees?.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-slate-500 border-b border-slate-100">
                                            {['Name', 'Email', 'Webinars Attended'].map(h => <th key={h} className="pb-3 pr-4 font-medium">{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {data.mostActiveAttendees.map(u => (
                                            <tr key={u.userId} className="hover:bg-slate-50">
                                                <td className="py-3 pr-4 font-semibold text-slate-800">{u.name}</td>
                                                <td className="py-3 pr-4 text-slate-500">{u.email}</td>
                                                <td className="py-3 pr-4 text-slate-600">{u.attendedCount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="text-slate-400 text-sm py-6 text-center">No attendance data yet</p>}
                    </div>
                </div>

                {data?.featuredPerformance?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Featured vs. Non-Featured Performance</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {data.featuredPerformance.map(f => (
                                <div key={String(f.featured)} className="border border-slate-200 rounded-xl p-4">
                                    <p className="text-sm font-semibold text-slate-700">{f.featured ? '⭐ Featured' : 'Not Featured'} ({f.count})</p>
                                    <p className="text-xs text-slate-500 mt-1">Avg registrations: <span className="font-bold text-slate-800">{f.avgRegistrations}</span></p>
                                    <p className="text-xs text-slate-500">Avg attended: <span className="font-bold text-slate-800">{f.avgAttended}</span></p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

        </>
    );
}

export default WebinarAnalytics;
