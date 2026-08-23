import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { createEvent } from 'ics';
import OrderDetails from './OrderDetails';

function downloadIcs(booking) {
    const session = booking.session;
    const start = new Date(session.scheduledStart);
    const end = new Date(session.scheduledEnd);
    const { error, value } = createEvent({
        title: `Mock Interview — ${booking.interview?.domain || ''}`,
        description: 'Join from your DreamJob Purchase History page once the room opens.',
        start: [start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()],
        startInputType: 'utc', startOutputType: 'utc',
        end: [end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes()],
        endInputType: 'utc', endOutputType: 'utc',
    });
    if (error) { console.error(error); return; }
    const blob = new Blob([value], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'interview.ics'; a.click();
    URL.revokeObjectURL(url);
}

function Countdown({ target }) {
    const [label, setLabel] = useState('');
    useEffect(() => {
        const tick = () => {
            const diff = new Date(target) - new Date();
            if (diff <= 0) { setLabel('Starting now'); return; }
            const days = Math.floor(diff / 86400000);
            const hours = Math.floor((diff % 86400000) / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            setLabel(days > 0 ? `in ${days}d ${hours}h` : hours > 0 ? `in ${hours}h ${mins}m` : `in ${mins}m`);
        };
        tick();
        const i = setInterval(tick, 30000);
        return () => clearInterval(i);
    }, [target]);
    return <span className="text-xs text-slate-400">{label}</span>;
}

function RescheduleModal({ booking, onClose, onDone }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const openSlots = (booking.interview?.slots || []).filter(s => !s.isBooked);

    const submit = async (slotId) => {
        setSaving(true); setError('');
        try {
            await api.patch(`/interview-sessions/${booking.session._id}/reschedule`, { newSlotId: slotId, reason: 'Requested by user' });
            onDone();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reschedule');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900">Reschedule Interview</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
                {openSlots.length === 0 ? (
                    <p className="text-slate-500 text-sm py-6 text-center">The interviewer has no other open slots right now. Please check back later.</p>
                ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {openSlots.map(slot => (
                            <button key={slot._id} disabled={saving} onClick={() => submit(slot._id)}
                                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition disabled:opacity-60">
                                <p className="font-semibold text-slate-800 text-sm">{new Date(slot.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                                <p className="text-xs text-slate-500">{new Date(slot.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – {new Date(slot.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CancelModal({ booking, joinSettings, onClose, onDone }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const hoursUntilStart = (new Date(booking.session.scheduledStart) - new Date()) / 3600000;
    const fullRefund = hoursUntilStart >= (joinSettings.cancellationFullRefundHoursBefore ?? 24);
    const refundPct = fullRefund ? 100 : (joinSettings.cancellationPartialRefundPercent ?? 50);
    const refundAmount = booking.amountPaid > 0 ? (booking.amountPaid * refundPct / 100) : 0;

    const submit = async () => {
        setSaving(true); setError('');
        try {
            await api.patch(`/interview-sessions/${booking.session._id}/cancel`, { reason: 'Cancelled by user' });
            onDone();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900">Cancel Interview</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
                <p className="text-sm text-slate-600 mb-4">Are you sure you want to cancel this interview?</p>
                {booking.amountPaid > 0 && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                        {refundAmount > 0
                            ? <>You'll receive a <strong>{refundPct}% refund</strong> (₹{refundAmount.toFixed(2)} of ₹{booking.amountPaid.toFixed(2)}).</>
                            : <>No refund will be issued for this cancellation.</>}
                    </div>
                )}
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 rounded-xl font-semibold text-slate-700">Keep Booking</button>
                    <button onClick={submit} disabled={saving} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold disabled:opacity-60">{saving ? 'Cancelling...' : 'Cancel Interview'}</button>
                </div>
            </div>
        </div>
    );
}

function ReportIssueModal({ booking, onClose, onDone }) {
    const [category, setCategory] = useState('quality');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        if (!description.trim()) { setError('Please describe the issue'); return; }
        setSaving(true); setError('');
        try {
            await api.post('/disputes', { sessionId: booking.session._id, category, description, requestedResolution: 'refund' });
            onDone();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit dispute');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900">Report an Issue</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                            <option value="quality">Interview quality</option>
                            <option value="conduct">Conduct</option>
                            <option value="technical_issue">Technical issue</option>
                            <option value="no_show">No-show</option>
                            <option value="billing">Billing</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">What happened?</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Describe the issue in detail..." />
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 rounded-xl font-semibold text-slate-700">Cancel</button>
                    <button onClick={submit} disabled={saving} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold disabled:opacity-60">{saving ? 'Submitting...' : 'Submit Report'}</button>
                </div>
            </div>
        </div>
    );
}

function Bookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [joinSettings, setJoinSettings] = useState({ interviewJoinWindowMinutesBefore: 15, interviewJoinWindowMinutesAfterEnd: 0 });
    const [rescheduleTarget, setRescheduleTarget] = useState(null);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [reportTarget, setReportTarget] = useState(null);
    const [orderDetailsId, setOrderDetailsId] = useState(null);
    const { user } = useSelector(state => state.auth);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        fetchBookings();
        api.get('/settings/public').then(r => r.data?.data && setJoinSettings(r.data.data)).catch(() => {});
    }, [user]);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            // Fetch interview+course bookings and subscription payment orders separately
            const [bookingsRes, ordersRes] = await Promise.all([
                api.get('/interviews/bookings/me'),
                api.get('/payments/orders').catch(() => ({ data: { data: [] } })),
            ]);

            let allItems = bookingsRes.data?.data || [];

            // Merge subscription-type PaymentOrders as display items
            const subOrders = (ordersRes.data?.data || [])
                .filter(o => o.type === 'subscription' && o.orderStatus === 'PAID');
            const subItems = subOrders.map(o => ({
                _id: o._id,
                type: 'subscription',
                status: 'completed',
                paymentStatus: 'paid',
                amountPaid: o.amount,
                createdAt: o.createdAt,
                subscriptionPlan: `${o.plan} Subscription`,
                orderId: o.orderId || null,
                cfPaymentId: o.cfPaymentId || null,
            }));

            allItems = [...allItems, ...subItems];
            allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setBookings(allItems);
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const filtered = activeTab === 'all' ? bookings
        : bookings.filter(b => b.type === activeTab);

    const tabs = [
        { id: 'all', label: 'All Orders', count: bookings.length },
        { id: 'course', label: 'Courses', count: bookings.filter(b => b.type === 'course').length },
        { id: 'interview', label: 'Interviews', count: bookings.filter(b => b.type === 'interview').length },
        { id: 'subscription', label: 'Subscriptions', count: bookings.filter(b => b.type === 'subscription').length },
    ];

    const getStatusColor = (status) => {
        const map = { confirmed: 'bg-green-100 text-green-700', 'in-progress': 'bg-orange-100 text-orange-700', completed: 'bg-blue-100 text-blue-700', pending: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700' };
        return map[status] || 'bg-gray-100 text-gray-700';
    };

    const getPaymentColor = (status) => {
        const map = { paid: 'bg-emerald-100 text-emerald-700', free: 'bg-slate-100 text-slate-600', pending: 'bg-yellow-100 text-yellow-700', refunded: 'bg-red-100 text-red-700' };
        return map[status] || 'bg-gray-100 text-gray-700';
    };

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="page-title">Purchase History</h1>
                    <p className="text-slate-500 mt-1">All your course purchases and interview bookings</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 overflow-x-auto border-b border-slate-200 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            {tab.label}
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                        <svg className="w-14 h-14 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        <p className="text-slate-500 font-medium">No {activeTab === 'all' ? 'orders' : activeTab + 's'} yet</p>
                        <div className="flex gap-3 justify-center mt-4">
                            <button onClick={() => navigate('/courses')} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Browse Courses</button>
                            <button onClick={() => navigate('/interviews')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">Book Interview</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map(booking => (
                            <div
                                key={booking._id}
                                onClick={() => booking.orderId && setOrderDetailsId(booking.orderId)}
                                className={`bg-white rounded-2xl border border-slate-200 p-6 transition-all ${booking.orderId ? 'hover:shadow-lg hover:border-indigo-200 cursor-pointer' : 'hover:shadow-md'}`}
                            >
                                <div className="flex items-start justify-between flex-wrap gap-4">
                                    <div className="flex items-start gap-4 min-w-0">
                                        {/* Type icon */}
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${booking.type === 'course' ? 'bg-blue-100' : booking.type === 'interview' ? 'bg-purple-100' : 'bg-emerald-100'}`}>
                                            {booking.type === 'course' ? (
                                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                            ) : booking.type === 'interview' ? (
                                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            ) : (
                                                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${booking.type === 'course' ? 'bg-blue-100 text-blue-700' : booking.type === 'interview' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {booking.type}
                                                </span>
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${getStatusColor(booking.status)}`}>
                                                    {booking.status === 'in-progress' ? 'In Progress' : booking.status}
                                                </span>
                                            </div>

                                            {/* Course booking */}
                                            {booking.type === 'course' && booking.course && (
                                                <>
                                                    <h3 className="font-semibold text-slate-900 text-lg">{booking.course.title}</h3>
                                                    <p className="text-slate-500 text-sm">{booking.course.category} • {booking.course.level}</p>
                                                    <button onClick={e => { e.stopPropagation(); navigate(`/courses/${booking.course._id}`); }} className="mt-2 text-primary-600 text-sm font-medium hover:underline">Go to Course →</button>
                                                </>
                                            )}

                                            {/* Interview booking */}
                                            {booking.type === 'interview' && booking.interview && (
                                                <>
                                                    <h3 className="font-semibold text-slate-900 text-lg">Mock Interview — {booking.interview.domain}</h3>
                                                    <p className="text-slate-500 text-sm">with {booking.seller?.name || 'Expert Interviewer'}</p>
                                                    {booking.session && ['not_started', 'in_progress'].includes(booking.session.completionStatus) && (
                                                        <div className="mt-2">
                                                            {(() => {
                                                                const now = new Date();
                                                                const start = new Date(booking.session.scheduledStart);
                                                                const end = new Date(booking.session.scheduledEnd);
                                                                const windowStart = new Date(start.getTime() - joinSettings.interviewJoinWindowMinutesBefore * 60000);
                                                                const windowEnd = new Date(end.getTime() + (joinSettings.interviewJoinWindowMinutesAfterEnd || 0) * 60000);
                                                                const isJoinEnabled = now >= windowStart && now <= windowEnd;

                                                                if (isJoinEnabled) {
                                                                    return (
                                                                        <button onClick={e => { e.stopPropagation(); navigate(`/interview-room/${booking.session._id}`); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                                            Join Interview
                                                                        </button>
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <button disabled title={`Join opens ${joinSettings.interviewJoinWindowMinutesBefore} minutes before the interview`} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-300 text-slate-500 text-sm rounded-lg cursor-not-allowed font-medium">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                                            Locked
                                                                        </button>
                                                                    );
                                                                }
                                            })()}
                                                            <Countdown target={booking.session.scheduledStart} />
                                                        </div>
                                                    )}
                                                    {booking.session?.completionStatus === 'awaiting_feedback' && (
                                                        <div className="mt-2">
                                                            <button onClick={e => { e.stopPropagation(); navigate(`/interview-room/${booking.session._id}/feedback`); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 font-medium">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg> Leave Feedback
                                                            </button>
                                                        </div>
                                                    )}
                                                    {booking.session?.completionStatus === 'disputed' && (
                                                        <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Dispute under review</span>
                                                    )}
                                                    {booking.session?.completionStatus === 'completed' && (
                                                        <div className="mt-2 flex items-center gap-3">
                                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ Completed</span>
                                                            <button onClick={e => { e.stopPropagation(); setReportTarget(booking); }} className="text-xs text-slate-400 hover:text-red-600 hover:underline">Report an issue</button>
                                                        </div>
                                                    )}
                                                    {booking.session?.completionStatus === 'no_show' && (
                                                        <div className="mt-2 flex items-center gap-3">
                                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                                                No-show{booking.session.attendance?.noShow ? ` (${booking.session.attendance.noShow})` : ''}
                                                            </span>
                                                            <button onClick={e => { e.stopPropagation(); setReportTarget(booking); }} className="text-xs text-slate-400 hover:text-red-600 hover:underline">Report an issue</button>
                                                        </div>
                                                    )}
                                                    {booking.session && ['not_started', 'in_progress'].includes(booking.session.completionStatus) && new Date() < new Date(booking.session.scheduledStart) && (
                                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                                            <button onClick={e => { e.stopPropagation(); downloadIcs(booking); }} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>Add to Calendar</button>
                                                            <button onClick={e => { e.stopPropagation(); setRescheduleTarget(booking); }} className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium">Reschedule</button>
                                                            <button onClick={e => { e.stopPropagation(); setCancelTarget(booking); }} className="px-3 py-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 font-medium">Cancel</button>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Subscription purchase */}
                                            {booking.type === 'subscription' && (
                                                <>
                                                    <h3 className="font-semibold text-slate-900 text-lg">{booking.subscriptionPlan}</h3>
                                                    <p className="text-slate-500 text-sm">Premium Account Plan</p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-right flex-shrink min-w-0 space-y-1.5">
                                        <p className="text-2xl font-bold text-slate-900">
                                            {booking.paymentStatus === 'free' ? <span className="text-emerald-600">FREE</span> : `₹${booking.amountPaid?.toFixed(2)}`}
                                        </p>
                                        <div className="flex justify-end">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getPaymentColor(booking.paymentStatus)}`}>{booking.paymentStatus}</span>
                                        </div>
                                        <p className="text-xs text-slate-400">{new Date(booking.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>

                                        {/* Order ID badge */}
                                        {booking.orderId && (
                                            <div className="text-right">
                                                <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                                    {booking.orderId}
                                                </span>
                                            </div>
                                        )}

                                        {/* Transaction ID (Cashfree cfPaymentId) */}
                                        {booking.cfPaymentId && (
                                            <p className="text-xs font-mono text-slate-400" title="Transaction ID">
                                                TXN: {booking.cfPaymentId}
                                            </p>
                                        )}

                                        {/* Hint for cards without orderId yet */}
                                        {!booking.orderId && (
                                            <p className="text-xs text-slate-300 mt-1">No order ID</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {rescheduleTarget && (
                <RescheduleModal booking={rescheduleTarget} onClose={() => setRescheduleTarget(null)}
                    onDone={() => { setRescheduleTarget(null); fetchBookings(); }} />
            )}
            {cancelTarget && (
                <CancelModal booking={cancelTarget} joinSettings={joinSettings} onClose={() => setCancelTarget(null)}
                    onDone={() => { setCancelTarget(null); fetchBookings(); }} />
            )}
            {reportTarget && (
                <ReportIssueModal booking={reportTarget} onClose={() => setReportTarget(null)}
                    onDone={() => { setReportTarget(null); fetchBookings(); }} />
            )}
            {orderDetailsId && (
                <OrderDetails orderId={orderDetailsId} onClose={() => setOrderDetailsId(null)} />
            )}

        </>
    );
}

export default Bookings;
