import { useState, useEffect } from 'react';
import api from '../../lib/api';

const STAGES = [
    { key: 'initiated', label: 'Withdraw Initiated', icon: '🚀', desc: 'Your request has been submitted successfully.' },
    { key: 'approval_in_progress', label: 'Approval in Progress', icon: '🔍', desc: 'Our finance team is reviewing your request.' },
    { key: 'completed', label: 'Withdraw Success', icon: '✅', desc: 'Amount has been credited to your bank account.' },
];

function WithdrawalStageTracker({ withdrawal }) {
    const isRejected = withdrawal.status === 'rejected';
    const currentIdx = STAGES.findIndex(s => s.key === withdrawal.status);
    const effectiveIdx = isRejected ? 0 : currentIdx;

    if (withdrawal.type === 'admin_adjustment') {
        const isDeduct = withdrawal.adminNote?.toLowerCase().includes('deducted');
        return (
            <div className={`border rounded-2xl p-5 ${isDeduct ? 'border-rose-200 bg-rose-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div>
                        <p className={`font-bold text-lg ${isDeduct ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {isDeduct ? '-' : '+'}₹{withdrawal.amount?.toFixed(2)}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">Adjusted on {new Date(withdrawal.processedAt || withdrawal.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${isDeduct ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isDeduct ? '📉 Admin Deduction' : '📈 Admin Addition'}
                    </span>
                </div>
                {withdrawal.adminNote && (
                    <p className="text-sm text-slate-700 mt-2"><strong>Note:</strong> {withdrawal.adminNote}</p>
                )}
            </div>
        );
    }

    return (
        <div className={`border rounded-2xl p-5 ${isRejected ? 'border-rose-200 bg-rose-50' : 'border-indigo-100 bg-indigo-50/40'}`}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div>
                    <div className="flex items-end gap-2">
                        <p className={`font-bold text-lg ${withdrawal.status === 'completed' && withdrawal.approvedAmount !== null && withdrawal.approvedAmount !== withdrawal.amount ? 'text-slate-400 line-through text-sm mb-0.5' : 'text-slate-900'}`}>
                            ₹{withdrawal.amount?.toFixed(2)}
                        </p>
                        {withdrawal.status === 'completed' && withdrawal.approvedAmount !== null && withdrawal.approvedAmount !== withdrawal.amount && (
                            <p className="font-black text-emerald-600 text-xl">₹{withdrawal.approvedAmount?.toFixed(2)}</p>
                        )}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">Requested {new Date(withdrawal.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                    isRejected ? 'bg-rose-100 text-rose-700' :
                    withdrawal.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    withdrawal.status === 'approval_in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                }`}>
                    {isRejected ? '❌ Rejected' :
                     withdrawal.status === 'completed' ? '✅ Completed' :
                     withdrawal.status === 'approval_in_progress' ? '🔍 Under Review' : '🚀 Initiated'}
                </span>
            </div>

            {isRejected ? (
                <div className="p-3 bg-rose-100 rounded-xl text-sm text-rose-700">
                    <p className="font-semibold mb-1">❌ Request Rejected</p>
                    {withdrawal.adminNote && <p className="text-rose-600">Note: {withdrawal.adminNote}</p>}
                    <p className="text-rose-500 text-xs mt-1">Your earnings have been refunded to your balance.</p>
                </div>
            ) : (
                <div className="flex items-center gap-0 overflow-hidden">
                    {STAGES.map((stage, idx) => {
                        const isDone = effectiveIdx >= idx;
                        const isActive = effectiveIdx === idx && !isRejected;
                        return (
                            <div key={stage.key} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center">
                                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-lg font-bold border-2 transition-all ${
                                        isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' :
                                        isDone ? 'bg-emerald-500 border-emerald-500 text-white' :
                                        'bg-white border-slate-200 text-slate-300'
                                    }`}>
                                        {isDone && !isActive ? '✓' : stage.icon}
                                    </div>
                                    <p className={`text-[10px] sm:text-xs text-center mt-1.5 font-semibold max-w-[60px] sm:max-w-[80px] leading-tight ${
                                        isActive ? 'text-indigo-700' : isDone ? 'text-emerald-700' : 'text-slate-400'
                                    }`}>{stage.label}</p>
                                </div>
                                {idx < STAGES.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-1 mb-5 ${effectiveIdx > idx ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {withdrawal.status === 'completed' && withdrawal.processedAt && (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
                    <p className="text-xs text-emerald-600 font-medium">
                        ✅ Credited on {new Date(withdrawal.processedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    {withdrawal.approvedAmount !== null && withdrawal.approvedAmount !== withdrawal.amount && (
                        <p className={`text-xs font-medium ${withdrawal.refundedToSeller !== false ? 'text-amber-600' : 'text-slate-500'}`}>
                            {withdrawal.refundedToSeller !== false 
                                ? <>ℹ️ Admin approved a partial amount of <strong>₹{withdrawal.approvedAmount?.toFixed(2)}</strong>. The remaining <strong>₹{(withdrawal.amount - withdrawal.approvedAmount).toFixed(2)}</strong> has been refunded to your earnings balance.</>
                                : <>ℹ️ Admin approved a partial amount of <strong>₹{withdrawal.approvedAmount?.toFixed(2)}</strong>. The remaining <strong>₹{(withdrawal.amount - withdrawal.approvedAmount).toFixed(2)}</strong> was deducted as a platform/admin fee.</>
                            }
                        </p>
                    )}
                </div>
            )}
            {withdrawal.adminNote && !isRejected && (
                <p className="text-xs text-slate-500 mt-2 italic">Admin note: {withdrawal.adminNote}</p>
            )}
        </div>
    );
}

function SellerWallet() {
    const [seller, setSeller] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [amount, setAmount] = useState('');
    const [bankDetails, setBankDetails] = useState({ accountName: '', accountNumber: '', bankName: '', ifsc: '' });
    const [withdrawing, setWithdrawing] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        try { const { data } = await api.get('/sellers/me'); setSeller(data.data); }
        catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleBank = e => setBankDetails(p => ({ ...p, [e.target.name]: e.target.value }));

    const hasPendingWithdrawal = seller?.withdrawals?.some(w => ['initiated', 'approval_in_progress'].includes(w.status));

    const requestWithdrawal = async e => {
        e.preventDefault(); setWithdrawing(true); setMsg(''); setError('');
        const parsed = parseFloat(amount);
        if (!parsed || parsed < 10) { setError('Minimum withdrawal amount is ₹10'); setWithdrawing(false); return; }
        if (parsed > (seller?.earnings || 0)) { setError('Amount exceeds available earnings'); setWithdrawing(false); return; }
        try {
            await api.post('/sellers/me/withdraw', { amount: parsed, bankDetails });
            setMsg(`Withdrawal of ₹${parsed.toFixed(2)} initiated! Admin will review shortly.`);
            setShowModal(false); setAmount(''); setBankDetails({ accountName: '', accountNumber: '', bankName: '', ifsc: '' }); load();
        } catch (err) { setError(err?.response?.data?.message || 'Failed to request withdrawal'); }
        finally { setWithdrawing(false); }
    };

    if (loading) return (
            <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>

    );

    const pendingWithdrawals = seller?.withdrawals?.filter(w => ['initiated', 'approval_in_progress'].includes(w.status)) || [];
    const completedWithdrawals = seller?.withdrawals?.filter(w => ['completed', 'rejected'].includes(w.status)) || [];

    return (
        <>
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Wallet & Earnings</h1>
                    <p className="text-slate-500 mt-1">Your earnings balance and withdrawal history</p>
                </div>

                {msg && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center gap-2">
                        <span className="text-lg">✅</span> {msg}
                    </div>
                )}

                {/* Balance card */}
                <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 text-center sm:text-left">
                        <p className="text-indigo-200 font-medium text-sm mb-1">Available Earnings Balance</p>
                        <p className="text-6xl font-black mb-4">₹{seller?.earnings?.toFixed(2) || '0.00'}</p>
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mt-4">
                            <button
                                onClick={() => setShowModal(true)}
                                disabled={hasPendingWithdrawal || (seller?.earnings || 0) < 10}
                                className="px-6 py-3 bg-white text-indigo-700 font-bold rounded-2xl hover:bg-indigo-50 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {hasPendingWithdrawal ? '⏳ Request Pending' : 'Request Withdrawal'}
                            </button>
                            <div className="text-indigo-200 text-sm">
                                <p>👥 {seller?.totalStudents || 0} total students</p>
                            </div>
                        </div>
                        {hasPendingWithdrawal && (
                            <p className="text-indigo-300 text-xs mt-3">You have an active withdrawal request in progress.</p>
                        )}
                        {(seller?.earnings || 0) < 10 && !hasPendingWithdrawal && (
                            <p className="text-indigo-300 text-xs mt-3">Minimum ₹10 required to withdraw.</p>
                        )}
                    </div>
                </div>

                {/* Info note */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3">
                    <span className="text-blue-500 text-lg">ℹ️</span>
                    <div className="text-blue-700 text-sm">
                        <p className="font-semibold mb-1">Withdrawal Policy</p>
                        <ul className="space-y-0.5 text-blue-600">
                            <li>• Minimum withdrawal: <strong>₹10</strong></li>
                            <li>• Processing time: <strong>3–5 business days</strong></li>
                            <li>• Only one active request at a time</li>
                            <li>• Earnings are held until request is processed</li>
                        </ul>
                    </div>
                </div>

                {/* Active / in-progress withdrawals */}
                {pendingWithdrawals.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-slate-900">Active Requests</h2>
                        {pendingWithdrawals.map((w, i) => (
                            <WithdrawalStageTracker key={i} withdrawal={w} />
                        ))}
                    </div>
                )}

                {/* Past withdrawals */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Withdrawal History</h2>
                    {completedWithdrawals.length > 0 ? (
                        <div className="space-y-4">
                            {completedWithdrawals.reverse().map((w, i) => (
                                <WithdrawalStageTracker key={i} withdrawal={w} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-400">
                            <span className="text-4xl">💸</span>
                            <p className="mt-2 text-sm">No completed withdrawals yet.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Withdrawal Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-bold text-slate-900">Request Withdrawal</h3>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">✕</button>
                        </div>

                        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

                        <form onSubmit={requestWithdrawal} className="space-y-4">
                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Amount (USD)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required min="10" max={seller?.earnings || 0} step="0.01"
                                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-semibold"
                                        placeholder="Min $10" />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Available: <strong>₹{seller?.earnings?.toFixed(2)}</strong> · Minimum: <strong>₹10</strong></p>
                            </div>

                            {/* Bank Details */}
                            <div className="pt-2 border-t border-slate-100">
                                <p className="text-sm font-bold text-slate-700 mb-3">🏦 Bank Details</p>
                                <div className="space-y-3">
                                    {[
                                        { name: 'accountName', label: 'Account Holder Name', placeholder: 'John Doe' },
                                        { name: 'bankName', label: 'Bank Name', placeholder: 'e.g. HDFC Bank' },
                                        { name: 'accountNumber', label: 'Account Number', placeholder: '0000 0000 0000' },
                                        { name: 'ifsc', label: 'IFSC / Routing Code', placeholder: 'e.g. HDFC0001234' },
                                    ].map(f => (
                                        <div key={f.name}>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                                            <input type="text" name={f.name} value={bankDetails[f.name]} onChange={handleBank}
                                                placeholder={f.placeholder}
                                                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-semibold text-slate-700 hover:bg-slate-200 transition">Cancel</button>
                                <button type="submit" disabled={withdrawing}
                                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold disabled:opacity-60 hover:from-indigo-700 hover:to-violet-700 transition">
                                    {withdrawing ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </>
    );
}

export default SellerWallet;
