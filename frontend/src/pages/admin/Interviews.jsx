import { useState, useEffect } from 'react';
import api from '../../lib/api';
import ExportButtons from '../../components/ExportButtons';

function AdminInterviews() {
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        api.get('/admin/interviews')
            .then(r => setInterviews(r.data.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = interviews.filter(iv =>
        !search ||
        iv.domain?.toLowerCase().includes(search.toLowerCase()) ||
        iv.interviewer?.name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Mock Interviews</h1>
                        <p className="text-slate-500">All seller interview profiles on the platform</p>
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by domain or interviewer..."
                            className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72 shadow-sm"
                        />
                        <ExportButtons
                            data={filtered}
                            filename="Interviews_Report"
                            columns={[
                                { header: 'Interviewer', key: 'interviewer', format: (v) => v?.name || 'Unknown' },
                                { header: 'Email', key: 'interviewer', format: (v) => v?.email || '' },
                                { header: 'Domain', key: 'domain' },
                                { header: 'Price', key: 'price', format: (v) => `₹${v||0}` },
                                { header: 'Meeting Mode', key: 'meetingMode' },
                                { header: 'Total Bookings', key: 'totalBookings' },
                                { header: 'Available Slots', key: 'availableSlots' },
                                { header: 'Rating', key: 'ratings', format: (v) => (v||0).toFixed(1) },
                            ]}
                        />
                    </div>
                </div>

                {/* Summary cards */}
                {!loading && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        {[
                            { label: 'Total Interviewers', value: interviews.length, icon: '🎙️', color: 'from-blue-500 to-blue-600' },
                            { label: 'Total Bookings', value: interviews.reduce((s, i) => s + (i.totalBookings || 0), 0), icon: '📦', color: 'from-violet-500 to-violet-600' },
                            { label: 'Total Available Slots', value: interviews.reduce((s, i) => s + (i.availableSlots || 0), 0), icon: '🗓️', color: 'from-emerald-500 to-emerald-600' },
                        ].map(c => (
                            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white shadow-lg`}>
                                <div className="text-2xl mb-2">{c.icon}</div>
                                <p className="text-white/70 text-sm">{c.label}</p>
                                <p className="text-3xl font-black">{c.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-slate-400">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            Loading interviews...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        {['Interviewer', 'Verification', 'Domain', 'Price', 'Meeting Mode', 'Bookings', 'Slots', 'Rating'].map(h => (
                                            <th key={h} className="px-5 py-4 text-slate-500 font-medium">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-slate-400">
                                                <span className="text-4xl block mb-2">🎙️</span>
                                                No interview profiles found
                                            </td>
                                        </tr>
                                    ) : filtered.map(iv => (
                                        <tr key={iv._id} className="hover:bg-slate-50 transition">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                                        {iv.interviewer?.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{iv.interviewer?.name}</p>
                                                        <p className="text-xs text-slate-400">{iv.interviewer?.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                                                    iv.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                                                    iv.verificationStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                    iv.verificationStatus === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                                                }`}>{iv.verificationStatus}</span>
                                                {iv.disputeCount > 0 && (
                                                    <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">{iv.disputeCount} dispute{iv.disputeCount > 1 ? 's' : ''}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">{iv.domain}</span>
                                            </td>
                                            <td className="px-5 py-4 font-bold text-slate-900">${iv.price}</td>
                                            <td className="px-5 py-4 text-slate-600">{iv.meetingMode}</td>
                                            <td className="px-5 py-4">
                                                <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">{iv.totalBookings}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="text-xs">
                                                    <span className="text-emerald-600 font-semibold">{iv.availableSlots} free</span>
                                                    <span className="text-slate-400"> / {iv.totalSlots} total</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-amber-400">★</span>
                                                    <span className="font-semibold text-slate-800">{iv.ratings?.toFixed(1) || '—'}</span>
                                                    {iv.totalReviews > 0 && (
                                                        <span className="text-slate-400 text-xs">({iv.totalReviews})</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}

export default AdminInterviews;
