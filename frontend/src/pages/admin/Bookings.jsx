import { useState, useEffect } from 'react';
import api from '../../lib/api';
import ExportButtons from '../../components/ExportButtons';

function AdminBookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        api.get('/admin/bookings').then(r => setBookings(r.data.data || [])).catch(console.error).finally(() => setLoading(false));
    }, []);

    const filtered = bookings
        .filter(b => tab === 'all' || b.type === tab)
        .filter(b => !search || b.user?.name?.toLowerCase().includes(search.toLowerCase()) || b.user?.email?.toLowerCase().includes(search.toLowerCase()));

    const tabs = [
        { id: 'all', label: 'All', count: bookings.length },
        { id: 'course', label: 'Courses', count: bookings.filter(b=>b.type==='course').length },
        { id: 'interview', label: 'Interviews', count: bookings.filter(b=>b.type==='interview').length },
    ];
    const typeColors = { course: 'bg-blue-100 text-blue-700', interview: 'bg-purple-100 text-purple-700' };
    const payColors = { paid: 'bg-emerald-100 text-emerald-700', free: 'bg-slate-100 text-slate-600', pending: 'bg-yellow-100 text-yellow-700', refunded: 'bg-red-100 text-red-700' };
    const statusColors = { confirmed: 'bg-green-100 text-green-700', completed: 'bg-blue-100 text-blue-700', pending: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700' };
    const sessionStatusColors = {
        not_started: 'bg-slate-100 text-slate-600', in_progress: 'bg-indigo-100 text-indigo-700',
        awaiting_feedback: 'bg-amber-100 text-amber-700', completed: 'bg-emerald-100 text-emerald-700',
        disputed: 'bg-orange-100 text-orange-700', no_show: 'bg-red-100 text-red-700', cancelled: 'bg-slate-100 text-slate-500',
    };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Bookings</h1>
                        <p className="text-slate-500">All course purchases and interview bookings on the platform</p>
                    </div>
                    <div className="flex gap-2">
                        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by user..."
                            className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm" />
                        <ExportButtons
                            data={filtered}
                            filename="Bookings_Report"
                            columns={[
                                { header: 'Type', key: 'type' },
                                { header: 'User', key: 'user', format: (v) => v?.name || '' },
                                { header: 'Email', key: 'user', format: (v) => v?.email || '' },
                                { header: 'Item', key: 'course', format: (v, row) => row.course?.title || row.interview?.domain || '—' },
                                { header: 'Seller', key: 'seller', format: (v) => v?.name || '—' },
                                { header: 'Amount', key: 'amountPaid', format: (v, row) => row.paymentStatus === 'free' ? 'Free' : `₹${(v||0).toFixed(2)}` },
                                { header: 'Payment Status', key: 'paymentStatus' },
                                { header: 'Booking Status', key: 'status' },
                                { header: 'Date', key: 'createdAt', format: (v) => new Date(v).toLocaleDateString() },
                            ]}
                        />
                    </div>
                </div>

                <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.id?'bg-white shadow text-slate-900':'text-slate-500 hover:text-slate-700'}`}>
                            {t.label} ({t.count})
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>{['Type','User','Item','Seller','Amount','Payment','Status','Session','Date'].map(h=><th key={h} className="px-5 py-4 text-slate-500 font-medium">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center py-12 text-slate-400">No bookings found</td></tr>
                                    ) : filtered.map(b => (
                                        <tr key={b._id} className="hover:bg-slate-50 transition">
                                            <td className="px-5 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeColors[b.type]}`}>{b.type}</span></td>
                                            <td className="px-5 py-4"><p className="font-medium text-slate-800">{b.user?.name}</p><p className="text-xs text-slate-400">{b.user?.email}</p></td>
                                            <td className="px-5 py-4 text-slate-600 max-w-xs truncate">{b.course?.title || b.interview?.domain || '—'}</td>
                                            <td className="px-5 py-4 text-slate-600">{b.seller?.name || '—'}</td>
                                            <td className="px-5 py-4 font-bold text-slate-900">{b.paymentStatus==='free'?'Free':`₹${b.amountPaid?.toFixed(2)}`}</td>
                                            <td className="px-5 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${payColors[b.paymentStatus]}`}>{b.paymentStatus}</span></td>
                                            <td className="px-5 py-4"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[b.status]}`}>{b.status}</span></td>
                                            <td className="px-5 py-4">
                                                {b.session ? (
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${sessionStatusColors[b.session.completionStatus] || 'bg-slate-100 text-slate-600'}`}>
                                                        {b.session.completionStatus.replace('_', ' ')}
                                                    </span>
                                                ) : <span className="text-slate-300 text-xs">—</span>}
                                            </td>
                                            <td className="px-5 py-4 text-slate-400 text-xs">{new Date(b.createdAt).toLocaleDateString()}</td>
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
export default AdminBookings;
