import { useState, useEffect } from 'react';
import api from '../../lib/api';
import ExportButtons from '../../components/ExportButtons';

const STAGE_INFO = {
    initiated: { label: 'Initiated', color: 'bg-amber-100 text-amber-700', icon: '🚀' },
    approval_in_progress: { label: 'Under Review', color: 'bg-blue-100 text-blue-700', icon: '🔍' },
    completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
    rejected: { label: 'Rejected', color: 'bg-rose-100 text-rose-700', icon: '❌' },
};

function WithdrawalSteps({ status }) {
    const steps = ['initiated', 'approval_in_progress', 'completed'];
    const currentIdx = steps.indexOf(status);
    return (
        <div className="flex items-center gap-1 mt-1">
            {steps.map((s, idx) => (
                <div key={s} className="flex items-center">
                    <div className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                        currentIdx > idx ? 'bg-emerald-500 text-white' :
                        currentIdx === idx ? 'bg-indigo-600 text-white' :
                        'bg-slate-200 text-slate-400'
                    }`}>{currentIdx > idx ? '✓' : idx + 1}</div>
                    {idx < steps.length - 1 && <div className={`w-5 h-0.5 ${currentIdx > idx ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                </div>
            ))}
        </div>
    );
}

function AdminWallet() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('withdrawals');

        // Withdrawal state
    const [withdrawals, setWithdrawals] = useState([]);
    const [wLoading, setWLoading] = useState(true);
    const [wFilter, setWFilter] = useState('all');
    const [actionModal, setActionModal] = useState(null); // { withdrawal, sellerId }
    const [actionStatus, setActionStatus] = useState('');
    const [adminNote, setAdminNote] = useState('');
    const [approvedAmount, setApprovedAmount] = useState('');
    const [refundRemaining, setRefundRemaining] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [toast, setToast] = useState('');

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

    useEffect(() => {
        api.get('/admin/wallet').then(r => setData(r.data.data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    const fetchWithdrawals = () => {
        setWLoading(true);
        api.get('/sellers/withdrawals').then(r => setWithdrawals(r.data.data || [])).catch(console.error).finally(() => setWLoading(false));
    };

    useEffect(() => { fetchWithdrawals(); }, []);

    const openAction = (w) => {
        setActionModal(w);
        setActionStatus(w.status);
        setAdminNote(w.adminNote || '');
        setApprovedAmount(w.amount); // default to requested amount
        setRefundRemaining(true);
    };

    const handleProcess = async () => {
        if (!actionModal) return;
        setProcessing(true);
        
        const payload = {
            status: actionStatus,
            adminNote
        };
        
        if (actionStatus === 'completed') {
             payload.approvedAmount = approvedAmount;
             payload.refundRemaining = refundRemaining;
        }

        try {
            await api.put(`/sellers/${actionModal.sellerId}/withdrawals/${actionModal._id}`, payload);
            showToast(`✅ Withdrawal status updated to "${actionStatus}"`);
            setActionModal(null);
            fetchWithdrawals();
        } catch (err) {
            showToast('❌ ' + (err.response?.data?.message || 'Failed to update'));
        } finally {
            setProcessing(false);
        }
    };

    const filtered = (data?.users || []).filter(u => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
    const roleColors = { user: 'bg-slate-100 text-slate-600', seller: 'bg-indigo-100 text-indigo-700', admin: 'bg-rose-100 text-rose-700', super_admin: 'bg-purple-100 text-purple-700' };

    const filteredWithdrawals = wFilter === 'all' ? withdrawals : withdrawals.filter(w => w.status === wFilter);
    const pendingCount = withdrawals.filter(w => ['initiated', 'approval_in_progress'].includes(w.status)).length;

    return (
        <>
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-xl text-sm font-medium">
                    {toast}
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Platform Financial Ledger</h1>
                        <p className="text-slate-500">Platform income, payouts, and withdrawal management</p>
                    </div>
                    {/* Tab switcher */}
                    <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                        <button onClick={() => setTab('withdrawals')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all relative ${tab === 'withdrawals' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                            💸 Withdrawals
                            {pendingCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{pendingCount}</span>}
                        </button>
                        <button onClick={() => setTab('transactions')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'transactions' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                            📋 Transactions
                        </button>
                    </div>
                </div>

                {/* Summary cards */}
                {!loading && data && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                            {[
                                { label: 'Total Income', value: `₹${(data.summary?.totalIncome || 0).toFixed(2)}`, icon: '💰', color: 'from-emerald-500 to-emerald-600' },
                                { label: 'Platform Net Balance', value: `₹${(data.summary?.platformNetBalance || 0).toFixed(2)}`, icon: '🏦', color: 'from-blue-500 to-blue-600' },
                                { label: 'Pending Seller Payouts', value: `₹${(data.summary?.totalPendingPayouts || 0).toFixed(2)}`, icon: '⏳', color: 'from-amber-500 to-amber-600' },
                                { label: 'Total Paid Orders', value: data.summary?.totalOrders || 0, icon: '✅', color: 'from-violet-500 to-violet-600' },
                            ].map(c => (
                                <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-6 text-white shadow-lg`}>
                                    <div className="text-3xl mb-2">{c.icon}</div>
                                    <p className="text-white/70 text-sm">{c.label}</p>
                                    <p className="text-2xl font-black mt-1">{c.value}</p>
                                </div>
                            ))}
                        </div>
                        {/* Income breakdown */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Subscriptions', data: data.incomeBreakdown?.subscription, icon: '👑' },
                                { label: 'Courses', data: data.incomeBreakdown?.course, icon: '🎓' },
                                { label: 'Interviews', data: data.incomeBreakdown?.interview, icon: '🎤' },
                                { label: 'Webinars', data: data.incomeBreakdown?.webinar, icon: '📡' },
                            ].map(({ label, data: d, icon }) => (
                                <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                    <div className="text-2xl mb-1">{icon}</div>
                                    <p className="text-slate-500 text-xs font-medium">{label}</p>
                                    <p className="text-slate-900 text-lg font-bold">₹{((d?.total) || 0).toFixed(2)}</p>
                                    <p className="text-slate-400 text-xs">{d?.count || 0} orders</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── WITHDRAWAL REQUESTS TAB ── */}
                {tab === 'withdrawals' && (
                    <div className="space-y-4">
                        {/* Filter bar */}
                        <div className="flex flex-wrap gap-2 items-center">
                            {['all', 'initiated', 'approval_in_progress', 'completed', 'rejected'].map(f => {
                                const info = STAGE_INFO[f];
                                const count = f === 'all' ? withdrawals.length : withdrawals.filter(w => w.status === f).length;
                                return (
                                    <button key={f} onClick={() => setWFilter(f)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${wFilter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                                        {info ? `${info.icon} ${info.label}` : 'All'} ({count})
                                    </button>
                                );
                            })}
                            <div className="ml-auto">
                                <ExportButtons
                                    data={filteredWithdrawals}
                                    filename="Withdrawals_Report"
                                    columns={[
                                        { header: 'Seller Name', key: 'sellerName' },
                                        { header: 'Seller Email', key: 'sellerEmail' },
                                        { header: 'Requested Amount', key: 'amount', format: (v) => `₹${(v||0).toFixed(2)}` },
                                        { header: 'Approved Amount', key: 'approvedAmount', format: (v) => v !== null && v !== undefined ? `₹${v.toFixed(2)}` : '—' },
                                        { header: 'Status', key: 'status' },
                                        { header: 'Bank Name', key: 'bankDetails', format: (v) => v?.bankName || '' },
                                        { header: 'Account Number', key: 'bankDetails', format: (v) => v?.accountNumber || '' },
                                        { header: 'IFSC', key: 'bankDetails', format: (v) => v?.ifsc || '' },
                                        { header: 'Requested On', key: 'requestedAt', format: (v) => new Date(v).toLocaleDateString() },
                                        { header: 'Processed On', key: 'processedAt', format: (v) => v ? new Date(v).toLocaleDateString() : '—' },
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            {wLoading ? (
                                <div className="p-10 text-center text-slate-400">
                                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    Loading withdrawal requests...
                                </div>
                            ) : filteredWithdrawals.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <span className="text-5xl block mb-3">💸</span>
                                    <p className="font-semibold text-slate-600">No withdrawal requests found</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>{['Seller', 'Requested', 'Approved', 'Status & Stage', 'Bank Details', 'Requested', 'Admin Note', 'Actions'].map(h => (
                                                <th key={h} className="px-5 py-4 text-slate-500 font-medium whitespace-nowrap">{h}</th>
                                            ))}</tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredWithdrawals.map(w => {
                                                const si = STAGE_INFO[w.status] || STAGE_INFO.initiated;
                                                return (
                                                    <tr key={w._id} className="hover:bg-slate-50 transition align-top">
                                                        <td className="px-5 py-4">
                                                            <p className="font-semibold text-slate-800">{w.sellerName}</p>
                                                            <p className="text-xs text-slate-400">{w.sellerEmail}</p>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <p className="font-black text-slate-900 text-base">₹{w.amount?.toFixed(2)}</p>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            {w.approvedAmount !== null && w.approvedAmount !== undefined ? (
                                                                <p className="font-black text-emerald-600 text-base">₹{w.approvedAmount?.toFixed(2)}</p>
                                                            ) : (
                                                                <span className="text-slate-300 italic">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${si.color}`}>{si.icon} {si.label}</span>
                                                            {!['completed', 'rejected'].includes(w.status) && <WithdrawalSteps status={w.status} />}
                                                        </td>
                                                        <td className="px-5 py-4 text-xs text-slate-600">
                                                            {w.bankDetails?.bankName ? (
                                                                <div className="space-y-0.5">
                                                                    <p><span className="text-slate-400">Bank:</span> {w.bankDetails.bankName}</p>
                                                                    <p><span className="text-slate-400">Acc:</span> {w.bankDetails.accountNumber}</p>
                                                                    <p><span className="text-slate-400">IFSC:</span> {w.bankDetails.ifsc}</p>
                                                                </div>
                                                            ) : <span className="text-slate-300 italic">Not provided</span>}
                                                        </td>
                                                        <td className="px-5 py-4 text-slate-400 text-xs whitespace-nowrap">
                                                            {new Date(w.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </td>
                                                        <td className="px-5 py-4 text-xs text-slate-500 max-w-[120px]">
                                                            {w.adminNote || <span className="text-slate-300 italic">—</span>}
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            {['completed', 'rejected'].includes(w.status) ? (
                                                                <span className="text-xs text-slate-400 italic">Processed</span>
                                                            ) : (
                                                                <button onClick={() => openAction(w)}
                                                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition">
                                                                    Update Status
                                                                </button>
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
                )}

                {/* ── TRANSACTIONS TAB ── */}
                {tab === 'transactions' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-900">Recent Platform Transactions</h2>
                            <p className="text-slate-400 text-sm">Last 50 transactions across all users</p>
                        </div>
                        {loading ? <div className="p-10 text-center text-slate-400">Loading...</div> : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>{['User', 'Type', 'Amount', 'Description', 'Date'].map(h => <th key={h} className="px-5 py-4 text-slate-500 font-medium">{h}</th>)}</tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(data?.recentTransactions || []).length === 0 ? (
                                            <tr><td colSpan={5} className="text-center py-10 text-slate-400">No transactions found</td></tr>
                                        ) : (data?.recentTransactions || []).map(t => (
                                            <tr key={t._id} className="hover:bg-slate-50">
                                                <td className="px-5 py-4">
                                                    <p className="font-semibold text-slate-800">{t.user?.name || '—'}</p>
                                                    <p className="text-xs text-slate-400">{t.user?.email}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${t.type === 'credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {t.type === 'credit' ? '↑ Credit' : '↓ Debit'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 font-bold text-slate-800">₹{t.amount?.toFixed(2)}</td>
                                                <td className="px-5 py-4 text-slate-500 max-w-xs truncate">{t.description}</td>
                                                <td className="px-5 py-4 text-slate-400 text-xs">{new Date(t.createdAt).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Action Modal */}
            {actionModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-bold text-slate-900">Update Withdrawal Status</h3>
                            <button onClick={() => setActionModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl mb-5 text-sm space-y-1">
                            <p><span className="text-slate-500">Seller:</span> <strong>{actionModal.sellerName}</strong></p>
                            <p><span className="text-slate-500">Requested Amount:</span> <strong className="text-slate-900">₹{actionModal.amount?.toFixed(2)}</strong></p>
                            {actionModal.bankDetails?.bankName && (
                                <>
                                    <p><span className="text-slate-500">Bank:</span> {actionModal.bankDetails.bankName}</p>
                                    <p><span className="text-slate-500">Account:</span> {actionModal.bankDetails.accountNumber}</p>
                                    <p><span className="text-slate-500">IFSC:</span> {actionModal.bankDetails.ifsc}</p>
                                </>
                            )}
                        </div>

                        {/* Stage selector */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">New Status</label>
                            <div className="space-y-2">
                                {[
                                    { value: 'approval_in_progress', label: '🔍 Move to Approval in Progress', desc: 'Finance team is reviewing' },
                                    { value: 'completed', label: '✅ Mark as Completed', desc: 'Amount credited to seller bank' },
                                    { value: 'rejected', label: '❌ Reject Request', desc: 'Earnings will be refunded to seller' },
                                ].map(opt => (
                                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${actionStatus === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'}`}>
                                        <input type="radio" name="wstatus" value={opt.value} checked={actionStatus === opt.value} onChange={e => setActionStatus(e.target.value)} className="accent-indigo-600" />
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                                            <p className="text-xs text-slate-500">{opt.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                        
                        {/* Approved Amount (only visible if completed) */}
                        {actionStatus === 'completed' && (
                            <div className="mb-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                <label className="block text-sm font-semibold text-emerald-800 mb-1.5">Amount to Approve / Payout (₹)</label>
                                <input type="number" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)}
                                    min="0" max={actionModal.amount} step="0.01"
                                    className="w-full px-3 py-2.5 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-emerald-700" />
                                
                                {actionModal.amount - (parseFloat(approvedAmount) || 0) > 0 && (
                                    <div className="mt-4 pt-4 border-t border-emerald-200/60">
                                        <p className="text-sm font-semibold text-emerald-800 mb-2">Remaining <strong>₹{(actionModal.amount - (parseFloat(approvedAmount) || 0)).toFixed(2)}</strong> Action:</p>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={refundRemaining} onChange={() => setRefundRemaining(true)} className="accent-emerald-600 w-4 h-4" />
                                                <span className="text-sm text-emerald-900">Refund back to seller's earnings balance</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" checked={!refundRemaining} onChange={() => setRefundRemaining(false)} className="accent-emerald-600 w-4 h-4" />
                                                <span className="text-sm text-emerald-900">Transfer to platform/admin wallet as fee</span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mb-5">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Admin Note (optional)</label>
                            <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                                placeholder="e.g. Transaction reference ID, reason for rejection..."
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none" />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setActionModal(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold text-slate-700 hover:bg-slate-200 transition">Cancel</button>
                            <button onClick={handleProcess} disabled={processing || (actionStatus === 'completed' && (!approvedAmount || parseFloat(approvedAmount) < 0 || parseFloat(approvedAmount) > actionModal.amount))}
                                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold disabled:opacity-60 hover:from-indigo-700 hover:to-violet-700 transition">
                                {processing ? 'Updating...' : 'Update Status'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
}

export default AdminWallet;