import { useState, useEffect } from 'react';
import api from '../../lib/api';
import OrderDetails from '../OrderDetails';

function SellerOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');
    const [search, setSearch] = useState('');
    const [orderDetailsId, setOrderDetailsId] = useState(null);

    useEffect(() => {
        api.get('/interviews/bookings/seller')
            .then(r => setOrders(r.data.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filtered = orders
        .filter(o => tab === 'all' || o.type === tab)
        .filter(o => !search
            || o.user?.name?.toLowerCase().includes(search.toLowerCase())
            || o.user?.email?.toLowerCase().includes(search.toLowerCase())
            || (o.orderId && o.orderId.toLowerCase().includes(search.toLowerCase()))
        );

    const tabs = [
        { id: 'all', label: 'All Orders', count: orders.length },
        { id: 'course', label: 'Course Sales', count: orders.filter(o => o.type === 'course').length },
        { id: 'interview', label: 'Interview Bookings', count: orders.filter(o => o.type === 'interview').length },
    ];

    const typeColors = { course: 'bg-blue-100 text-blue-700', interview: 'bg-purple-100 text-purple-700' };
    const payColors = { paid: 'bg-emerald-100 text-emerald-700', free: 'bg-slate-100 text-slate-600', pending: 'bg-yellow-100 text-yellow-700', refunded: 'bg-red-100 text-red-700' };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Orders</h1>
                    <p className="text-slate-500 mt-1">All course purchases and interview bookings for your content</p>
                </div>

                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                        <div className="flex flex-nowrap gap-1 bg-slate-100 rounded-xl p-1">
                            {tabs.map(t => (
                                <button key={t.id} onClick={() => setTab(t.id)}
                                    className={`whitespace-nowrap flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                                    {t.label} ({t.count})
                                </button>
                            ))}
                        </div>
                    </div>
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by student name or Order ID..."
                        className="px-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-72" />
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                        <span className="text-5xl">📦</span>
                        <p className="mt-3 text-slate-500 font-medium">No orders yet</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        {/* Mobile card view */}
                        <div className="sm:hidden divide-y divide-slate-100">
                            {filtered.map(o => (
                                <div key={o._id} className="p-4 space-y-2 active:bg-slate-50" onClick={() => o.orderId && setOrderDetailsId(o.orderId)}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-900 text-sm truncate">{o.course?.title || o.interview?.domain || o.type}</p>
                                            <p className="text-xs text-slate-400">{o.user?.name}</p>
                                        </div>
                                        <span className="font-bold text-slate-900 text-sm flex-shrink-0">
                                            {o.paymentStatus === 'free' ? 'Free' : `₹${o.amountPaid?.toFixed(2)}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${typeColors[o.type]}`}>{o.type}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${payColors[o.paymentStatus]}`}>{o.paymentStatus}</span>
                                        <span className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    </div>
                                    {o.orderId && (
                                        <button
                                            onClick={e => { e.stopPropagation(); setOrderDetailsId(o.orderId); }}
                                            className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-1.5 rounded-lg"
                                        >
                                            {o.orderId}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        {['Order ID', 'Type', 'Student', 'Item', 'Amount', 'Payment', 'Date'].map(h => (
                                            <th key={h} className="px-5 py-4 text-left text-slate-500 font-medium">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map(o => (
                                        <tr
                                            key={o._id}
                                            onClick={() => o.orderId && setOrderDetailsId(o.orderId)}
                                            className={`transition ${o.orderId ? 'hover:bg-indigo-50 cursor-pointer' : 'hover:bg-slate-50'}`}
                                        >
                                            <td className="px-5 py-4">
                                                {o.orderId ? (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setOrderDetailsId(o.orderId); }}
                                                        className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline bg-indigo-50 hover:bg-indigo-100 px-2 py-2 rounded-lg transition whitespace-nowrap"
                                                        title="View order details"
                                                    >
                                                        {o.orderId}
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-300 font-mono">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${typeColors[o.type]}`}>{o.type}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="font-semibold text-slate-800">{o.user?.name}</p>
                                                <p className="text-slate-400 text-xs">{o.user?.email}</p>
                                            </td>
                                            <td className="px-5 py-4 text-slate-700">{o.course?.title || o.interview?.domain || '—'}</td>
                                            <td className="px-5 py-4 font-bold text-slate-900">
                                                {o.paymentStatus === 'free' ? 'Free' : `₹${o.amountPaid?.toFixed(2)}`}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${payColors[o.paymentStatus]}`}>{o.paymentStatus}</span>
                                            </td>
                                            <td className="px-5 py-4 text-slate-400 text-xs">
                                                {new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>{/* end hidden sm:block */}
                        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                            Showing {filtered.length} of {orders.length} orders
                        </div>
                    </div>
                )}
            </div>

            {orderDetailsId && (
                <OrderDetails orderId={orderDetailsId} onClose={() => setOrderDetailsId(null)} />
            )}

        </>
    );
}

export default SellerOrders;
