import { useState, useEffect } from 'react';
import api from '../../lib/api';

function SellerStudents() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        api.get('/interviews/bookings/seller')
            .then(r => setOrders(r.data.data?.filter(o => o.type === 'course') || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // Group by unique student
    const students = Object.values(
        orders.reduce((acc, o) => {
            const id = o.user?._id || o.user;
            if (!id) return acc;
            if (!acc[id]) acc[id] = { id, name: o.user?.name, email: o.user?.email, courses: [], totalPaid: 0, since: o.createdAt };
            acc[id].courses.push(o.course?.title || 'Unknown Course');
            acc[id].totalPaid += o.amountPaid || 0;
            return acc;
        }, {})
    );

    const filtered = students.filter(s =>
        !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">My Students</h1>
                        <p className="text-slate-500 mt-1">{students.length} students enrolled in your courses</p>
                    </div>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student..."
                        className="px-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-56" />
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                        <span className="text-5xl">🎓</span>
                        <p className="mt-3 text-slate-500 font-medium">{search ? 'No students found' : 'No students yet'}</p>
                        <p className="text-slate-400 text-sm mt-1">Students who purchase your courses will appear here</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map(s => (
                            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition">
                                <div className="flex items-start gap-4">
                                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center font-bold text-white flex-shrink-0">
                                        {s.name?.charAt(0)?.toUpperCase() || 'S'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-900">{s.name || 'Unknown'}</p>
                                        <p className="text-slate-500 text-sm truncate">{s.email}</p>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {s.courses.map((c, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{c}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-bold text-emerald-600">₹{s.totalPaid.toFixed(2)}</p>
                                        <p className="text-xs text-slate-400 mt-1">{new Date(s.since).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </>
    );
}

export default SellerStudents;
