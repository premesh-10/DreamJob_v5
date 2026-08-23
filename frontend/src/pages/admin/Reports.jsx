import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import ExportButtons from '../../components/ExportButtons';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function AdminReports() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/admin/reports').then(r => setData(r.data.data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    const revenueChart = data?.monthlyRevenue?.map(m => ({
        name: `${MONTHS[m._id.month - 1]} ${m._id.year}`,
        Revenue: parseFloat(m.revenue.toFixed(2)),
        Transactions: m.count
    })) || [];

    const usersChart = data?.monthlyUsers?.map(m => ({
        name: `${MONTHS[m._id.month - 1]} ${m._id.year}`,
        Users: m.count
    })) || [];



    return (
        <>
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
                        <p className="text-slate-500">Platform analytics and business insights</p>
                    </div>
                    <ExportButtons
                        data={data?.topCourses || []}
                        filename="Platform_Reports"
                        columns={[
                            { header: 'Title', key: 'title' },
                            { header: 'Category', key: 'category' },
                            { header: 'Students', key: 'students' },
                            { header: 'Price', key: 'price', format: (v) => v > 0 ? `₹${v}` : 'Free' },
                        ]}
                    />
                </div>

                {loading ? <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div> : (
                    <>
                        {/* Summary cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {[
                                { label: 'Total Revenue', value: `₹${data?.summary?.totalRevenue?.toFixed(2) || '0.00'}`, icon: '💰', color: 'from-emerald-500 to-emerald-600' },
                                { label: 'New Users This Month', value: data?.summary?.newUsersThisMonth || 0, icon: '👤', color: 'from-blue-500 to-blue-600' },
                                { label: 'New Bookings This Month', value: data?.summary?.newBookingsThisMonth || 0, icon: '📦', color: 'from-violet-500 to-violet-600' },
                            ].map(c => (
                                <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-6 text-white shadow-lg`}>
                                    <div className="text-3xl mb-2">{c.icon}</div>
                                    <p className="text-white/70 text-sm">{c.label}</p>
                                    <p className="text-4xl font-black mt-1">{c.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Monthly Revenue Chart */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 mb-5">Monthly Revenue (Last 12 Months)</h2>
                            {revenueChart.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={revenueChart}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip formatter={(v, n) => [n==='Revenue'?`₹${v}`:v, n]} />
                                        <Legend />
                                        <Bar dataKey="Revenue" fill="#3b82f6" radius={[5,5,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <p className="text-slate-400 text-center py-12">No revenue data available yet</p>}
                        </div>

                        {/* Monthly Users Chart */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 mb-5">New User Registrations (Last 12 Months)</h2>
                            {usersChart.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={usersChart}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="Users" fill="#8b5cf6" radius={[5,5,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <p className="text-slate-400 text-center py-10">No user data available yet</p>}
                        </div>

                        {/* Top Courses Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 mb-4">Top 10 Courses by Enrollment</h2>
                            {data?.topCourses?.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className="text-left text-slate-500 border-b border-slate-100">{['Rank','Title','Category','Students','Price'].map(h=><th key={h} className="pb-3 pr-4 font-medium">{h}</th>)}</tr></thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {data.topCourses.map((c, i) => (
                                                <tr key={c._id} className="hover:bg-slate-50">
                                                    <td className="py-3 pr-4"><span className={`w-7 h-7 inline-flex items-center justify-center rounded-full text-xs font-bold text-white ${i===0?'bg-amber-400':i===1?'bg-slate-400':i===2?'bg-orange-400':'bg-slate-200 !text-slate-600'}`}>{i+1}</span></td>
                                                    <td className="py-3 pr-4 font-semibold text-slate-800">{c.title}</td>
                                                    <td className="py-3 pr-4 text-slate-500">{c.category}</td>
                                                    <td className="py-3 pr-4 font-medium text-slate-700">{c.students}</td>
                                                    <td className="py-3 pr-4 font-bold text-emerald-600">{c.price > 0 ? `₹${c.price}` : 'Free'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <p className="text-slate-400 text-sm text-center py-8">No published courses yet</p>}
                        </div>
                    </>
                )}
            </div>

        </>
    );
}
export default AdminReports;
