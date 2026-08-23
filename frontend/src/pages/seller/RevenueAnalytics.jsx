import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function RevenueAnalytics() {
    const [stats, setStats] = useState(null);
    const [courseEarnings, setCourseEarnings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/sellers/me/stats'),
            api.get('/sellers/me/course-earnings'),
        ])
            .then(([statsRes, earningsRes]) => {
                setStats(statsRes.data.data);
                setCourseEarnings(earningsRes.data.data || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const chartData = stats?.monthlyEarnings?.map(m => ({
        name: MONTHS[m._id.month - 1],
        Revenue: parseFloat(m.total.toFixed(2)),
        Orders: m.count
    })) || [];

    const currentMonthName = MONTHS[new Date().getMonth()];
    const thisMonth = chartData.find(c => c.name === currentMonthName)?.Revenue || 0;
    const avgPerStudent = stats?.totalStudents > 0 ? (stats.totalEarnings / stats.totalStudents).toFixed(2) : 0;

    if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Revenue Analytics</h1>
                    <p className="text-slate-500 mt-1">Detailed breakdown of your earnings and performance</p>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {[
                        { label: 'Total Revenue', value: `₹${stats?.totalEarnings?.toFixed(2) || '0.00'}`, icon: '💰', gradient: 'from-indigo-500 to-indigo-600' },
                        { label: 'This Month', value: `₹${thisMonth.toFixed(2)}`, icon: '📅', gradient: 'from-violet-500 to-violet-600' },
                        { label: 'Total Students', value: stats?.totalStudents || 0, icon: '🎓', gradient: 'from-emerald-500 to-emerald-600' },
                        { label: 'Avg per Student', value: `₹${avgPerStudent}`, icon: '📊', gradient: 'from-sky-500 to-sky-600' },
                    ].map(card => (
                        <div key={card.label} className={`bg-gradient-to-br ${card.gradient} rounded-2xl p-6 text-white shadow-lg`}>
                            <div className="text-3xl mb-2">{card.icon}</div>
                            <p className="text-white/70 text-sm">{card.label}</p>
                            <p className="text-2xl sm:text-3xl font-black mt-1">{card.value}</p>
                        </div>
                    ))}
                </div>

                {/* Monthly revenue bar chart */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Monthly Earnings (Last 6 Months)</h2>
                    <p className="text-slate-400 text-sm mb-5">Revenue breakdown by month</p>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={chartData} barCategoryGap="30%" margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip formatter={(v, n) => [n === 'Revenue' ? `₹${v}` : v, n]} />
                                <Legend />
                                <Bar dataKey="Revenue" fill="#6366f1" radius={[6,6,0,0]} name="Revenue ($)" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <span className="text-4xl mb-2">📈</span>
                            <p className="text-sm">No revenue data yet. Make your first sale!</p>
                        </div>
                    )}
                </div>

                {/* Orders trend line chart */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">Order Volume Trend</h2>
                    <p className="text-slate-400 text-sm mb-5">Number of orders per month</p>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <LineChart data={chartData} margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip />
                                <Line type="monotone" dataKey="Orders" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5, fill: '#8b5cf6' }} name="Orders" />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <p className="text-sm">No order data available</p>
                        </div>
                    )}
                </div>

                {/* Per-course actual earnings */}
                {courseEarnings.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-1">Earnings Per Course</h2>
                        <p className="text-slate-400 text-sm mb-4">Actual revenue from completed payments</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[600px]">
                                <thead>
                                    <tr className="text-left text-slate-500 border-b border-slate-100">
                                        {['Course','Enrollments','Revenue'].map(h => <th key={h} className="pb-3 pr-4 font-medium">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {courseEarnings.map(c => (
                                        <tr key={c._id} className="hover:bg-slate-50">
                                            <td className="py-3 pr-4 font-semibold text-slate-800">{c.title}</td>
                                            <td className="py-3 pr-4 text-slate-600">{c.enrollments}</td>
                                            <td className="py-3 pr-4 font-bold text-emerald-600">₹{c.revenue.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Top courses by enrollment (legacy approximation) */}
                {stats?.topCourses?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Top Courses by Enrollment</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[600px]">
                                <thead>
                                    <tr className="text-left text-slate-500 border-b border-slate-100">
                                        {['Rank','Course Title','Students','Price','Revenue'].map(h=><th key={h} className="pb-3 pr-4 font-medium">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {stats.topCourses.map((c, i) => (
                                        <tr key={c._id} className="hover:bg-slate-50">
                                            <td className="py-3 pr-4">
                                                <span className={`w-7 h-7 inline-flex items-center justify-center rounded-full text-xs font-bold text-white ${i===0?'bg-amber-400':i===1?'bg-slate-400':'bg-orange-400'}`}>{i+1}</span>
                                            </td>
                                            <td className="py-3 pr-4 font-semibold text-slate-800">{c.title}</td>
                                            <td className="py-3 pr-4 text-slate-600">{c.students}</td>
                                            <td className="py-3 pr-4 text-slate-600">₹{c.price}</td>
                                            <td className="py-3 pr-4 font-bold text-emerald-600">₹{(c.students * c.price).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

        </>
    );
}

export default RevenueAnalytics;
