import { useState, useEffect } from 'react';
import api from '../../lib/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000';

const STATUS_CONFIG = {
    pending:    { label: 'Pending',    cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    verified:   { label: 'Verified',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    rejected:   { label: 'Rejected',   cls: 'bg-red-100 text-red-700 border-red-200' },
    unverified: { label: 'Unverified', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function AdminVerifications() {
    const [status, setStatus] = useState('pending');
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchSellers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/verifications', { params: { status } });
            setSellers(data.data || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    useEffect(() => { fetchSellers(); }, [status]);

    const decide = async (sellerId, decision) => {
        const rejectionReason = decision === 'rejected' ? (window.prompt('Reason for rejection (shown to the interviewer):') || '') : undefined;
        if (decision === 'rejected' && rejectionReason === '') return;
        try {
            await api.patch(`/admin/verifications/${sellerId}`, { decision, rejectionReason });
            fetchSellers();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to process verification');
        }
    };

    return (
        <>
            <div className="max-w-5xl mx-auto space-y-6">
                <AdminPageHeader
                    icon="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                    iconBg="from-emerald-500 to-teal-600"
                    title="Interviewer Verifications"
                    subtitle="Approve or reject identity-verification requests — approval makes the interviewer's profile publicly bookable"
                />

                {/* Filter tabs */}
                <div className="flex gap-2 flex-wrap">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button key={key} onClick={() => setStatus(key)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize border transition-all duration-150 ${
                                status === key
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                    : `${cfg.cls} hover:shadow-sm`
                            }`}>
                            {cfg.label}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="p-16 flex flex-col items-center gap-3 text-slate-400">
                            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Loading...</span>
                        </div>
                    ) : sellers.length === 0 ? (
                        <div className="p-16 text-center text-slate-400">
                            <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            No {STATUS_CONFIG[status]?.label?.toLowerCase()} requests.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {sellers.map(s => (
                                <div key={s._id} className="p-5 flex items-start justify-between gap-4 flex-wrap hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-violet-100 flex items-center justify-center text-primary-700 font-bold flex-shrink-0">
                                            {s.user?.name?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800">{s.user?.name}</p>
                                            <p className="text-xs text-slate-400">{s.user?.email} &bull; {s.user?.mobile}</p>
                                            {s.verification?.idDocumentPath && (
                                                <a href={`${API_BASE}${s.verification.idDocumentPath}`} target="_blank" rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 mt-1.5 font-medium">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                    </svg>
                                                    View submitted document
                                                </a>
                                            )}
                                            {s.verification?.submittedAt && (
                                                <p className="text-xs text-slate-400 mt-1">Submitted {new Date(s.verification.submittedAt).toLocaleString()}</p>
                                            )}
                                            {s.verification?.status === 'rejected' && s.verification?.rejectionReason && (
                                                <p className="text-xs text-red-500 mt-1 font-medium">Rejection: {s.verification.rejectionReason}</p>
                                            )}
                                            {s.verification?.status === 'verified' && s.verification?.verifiedBy && (
                                                <p className="text-xs text-emerald-600 mt-1 font-medium">Verified by {s.verification.verifiedBy.name}</p>
                                            )}
                                        </div>
                                    </div>
                                    {status === 'pending' && (
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button onClick={() => decide(s._id, 'rejected')}
                                                className="px-3.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition">
                                                Reject
                                            </button>
                                            <button onClick={() => decide(s._id, 'verified')}
                                                className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-sm transition">
                                                Approve
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </>
    );
}

export default AdminVerifications;
