import { useState, useEffect } from 'react';
import api from '../../lib/api';
import ExportButtons from '../../components/ExportButtons';

function ConfirmDialog({ message, subText, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <p className="text-slate-800 font-semibold text-center">{message}</p>
                {subText && <p className="text-slate-500 text-sm text-center">{subText}</p>}
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-sm">Cancel</button>
                    <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition text-sm">Revoke</button>
                </div>
            </div>
        </div>
    );
}

function AdminSubscriptions() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [confirm, setConfirm] = useState(null);
    const [revoking, setRevoking] = useState(null);

    const fetchData = () => {
        setLoading(true);
        api.get('/admin/subscriptions').then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const planColors = { Silver: 'bg-slate-100 text-slate-700', Ruby: 'bg-red-100 text-red-700', Platinum: 'bg-yellow-100 text-yellow-700' };
    const planIcons = { Silver: '🥈', Ruby: '💎', Platinum: '👑' };
    const planGrad = { Silver: 'from-slate-400 to-slate-500', Ruby: 'from-rose-500 to-red-600', Platinum: 'from-yellow-400 to-amber-500' };

    const isExpired = (date) => new Date(date) < new Date();

    const handleRevoke = (user) => {
        setConfirm({
            userId: user._id,
            message: `Revoke ${user.name}'s subscription?`,
            subText: `This will immediately cancel their ${user.subscription?.plan} plan. The user will be notified. All their data and progress are preserved.`,
            onConfirm: async () => {
                setConfirm(null);
                setRevoking(user._id);
                try {
                    await api.delete(`/admin/subscriptions/${user._id}`);
                    fetchData();
                } catch (err) {
                    alert(err.response?.data?.message || 'Failed to revoke subscription');
                } finally {
                    setRevoking(null);
                }
            },
        });
    };

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Subscriptions</h1>
                        <p className="text-slate-500">Active subscription plans and member details</p>
                    </div>
                    <ExportButtons
                        data={data?.data || []}
                        filename="Subscriptions_Report"
                        columns={[
                            { header: 'Name', key: 'name' },
                            { header: 'Email', key: 'email' },
                            { header: 'Plan', key: 'subscription', format: (v) => v?.plan || 'None' },
                            { header: 'Valid Until', key: 'subscription', format: (v) => v?.validUntil ? new Date(v.validUntil).toLocaleDateString() : '—' },
                            { header: 'Status', key: 'subscription', format: (v) => new Date(v?.validUntil) < new Date() ? 'Expired' : 'Active' },
                        ]}
                    />
                </div>

                {!loading && data && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {['Silver', 'Ruby', 'Platinum'].map(plan => (
                            <div key={plan} className={`bg-gradient-to-br ${planGrad[plan]} rounded-2xl p-6 text-white shadow-lg`}>
                                <div className="text-3xl mb-2">{planIcons[plan]}</div>
                                <p className="text-white/70 text-sm">{plan} Plan</p>
                                <p className="text-4xl font-black">{data.planCounts?.[plan] || 0}</p>
                                <p className="text-white/60 text-xs mt-1">active subscribers</p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        {['User', 'Email', 'Plan', 'Valid Until', 'Status', 'Action'].map(h => (
                                            <th key={h} className="px-5 py-4 text-slate-500 font-medium">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {!data?.data?.length ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-slate-400">No active subscriptions</td></tr>
                                    ) : data.data.map(u => {
                                        const expired = isExpired(u.subscription?.validUntil);
                                        return (
                                            <tr key={u._id} className="hover:bg-slate-50">
                                                <td className="px-5 py-4 font-semibold text-slate-800">{u.name}</td>
                                                <td className="px-5 py-4 text-slate-500">{u.email}</td>
                                                <td className="px-5 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${planColors[u.subscription?.plan]}`}>
                                                        {planIcons[u.subscription?.plan]} {u.subscription?.plan}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-slate-600">
                                                    {u.subscription?.validUntil ? new Date(u.subscription.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${expired ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {expired ? 'Expired' : 'Active'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {!expired ? (
                                                        <button
                                                            onClick={() => handleRevoke(u)}
                                                            disabled={revoking === u._id}
                                                            className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50 transition"
                                                        >
                                                            {revoking === u._id ? 'Revoking…' : 'Revoke'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {confirm && (
                <ConfirmDialog
                    message={confirm.message}
                    subText={confirm.subText}
                    onConfirm={confirm.onConfirm}
                    onCancel={() => setConfirm(null)}
                />
            )}

        </>
    );
}
export default AdminSubscriptions;
