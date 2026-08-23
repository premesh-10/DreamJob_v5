import { useState, useEffect } from 'react';
import api from '../../lib/api';

const roleColors = {
    user: 'bg-slate-100 text-slate-600',
    seller: 'bg-indigo-100 text-indigo-700',
    admin: 'bg-rose-100 text-rose-700',
    super_admin: 'bg-purple-100 text-purple-700',
    moderator: 'bg-yellow-100 text-yellow-700',
    finance_admin: 'bg-emerald-100 text-emerald-700',
    support_admin: 'bg-sky-100 text-sky-700'
};

function AdminSecurity() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        api.get('/admin/security').then(r => setData(r.data.data)).catch(console.error).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const toggleBlock = async (id) => {
        try { await api.patch(`/admin/users/${id}/block`); load(); }
        catch { alert('Failed to update user status'); }
    };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Security</h1>
                    <p className="text-slate-500">Manage blocked users, admin accounts, and recent activity</p>
                </div>

                {!loading && data && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-6 text-white shadow-lg">
                            <div className="text-3xl mb-2">🚫</div>
                            <p className="text-white/70 text-sm">Blocked Users</p>
                            <p className="text-4xl font-black">{data.summary?.totalBlocked || 0}</p>
                        </div>
                        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                            <div className="text-3xl mb-2">🛡️</div>
                            <p className="text-white/70 text-sm">Admin Accounts</p>
                            <p className="text-4xl font-black">{data.summary?.totalAdmins || 0}</p>
                        </div>
                    </div>
                )}

                {/* Blocked Users */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900">🚫 Blocked Users</h2>
                    </div>
                    {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : (
                        data?.blockedUsers?.length === 0 ? (
                            <div className="p-10 text-center text-slate-400">
                                <span className="text-4xl">✅</span>
                                <p className="mt-2 text-sm">No blocked users — platform is clean!</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>{['Name','Email','Role','Action'].map(h=><th key={h} className="px-5 py-3 text-slate-500 font-medium">{h}</th>)}</tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {data.blockedUsers.map(u => (
                                            <tr key={u._id} className="hover:bg-slate-50">
                                                <td className="px-5 py-3 font-medium text-slate-800">{u.name}</td>
                                                <td className="px-5 py-3 text-slate-500">{u.email}</td>
                                                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${roleColors[u.role] || 'bg-gray-100'}`}>{u.role}</span></td>
                                                <td className="px-5 py-3">
                                                    <button onClick={() => toggleBlock(u._id)} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-200 transition">Unblock</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>

                {/* Admin Accounts */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900">🛡️ Admin Accounts</h2>
                    </div>
                    {loading ? <div className="p-6 text-center text-slate-400">Loading...</div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>{['Name','Email','Role','Joined'].map(h=><th key={h} className="px-5 py-3 text-slate-500 font-medium">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {data?.adminUsers?.map(u => (
                                        <tr key={u._id} className="hover:bg-slate-50">
                                            <td className="px-5 py-3 font-medium text-slate-800">{u.name}</td>
                                            <td className="px-5 py-3 text-slate-500">{u.email}</td>
                                            <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${roleColors[u.role] || 'bg-gray-100'}`}>{u.role}</span></td>
                                            <td className="px-5 py-3 text-slate-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Recent Registrations */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900">🕐 Recent Registrations</h2>
                        <p className="text-slate-400 text-sm">Last 20 user sign-ups</p>
                    </div>
                    {loading ? <div className="p-6 text-center text-slate-400">Loading...</div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>{['Name','Email','Role','Joined'].map(h=><th key={h} className="px-5 py-3 text-slate-500 font-medium">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {data?.recentRegistrations?.map(u => (
                                        <tr key={u._id} className="hover:bg-slate-50">
                                            <td className="px-5 py-3 font-medium text-slate-800">{u.name}</td>
                                            <td className="px-5 py-3 text-slate-500">{u.email}</td>
                                            <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${roleColors[u.role] || 'bg-gray-100 text-gray-600'}`}>{u.role}</span></td>
                                            <td className="px-5 py-3 text-slate-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
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
export default AdminSecurity;
