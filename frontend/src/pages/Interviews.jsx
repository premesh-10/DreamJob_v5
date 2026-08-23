import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { load } from '@cashfreepayments/cashfree-js';
import { setUser } from '../features/auth/authSlice';
import { getSubscriptionDiscountPercent, applySubscriptionDiscount } from '../lib/subscription';
import RecommendedPracticeTests from '../components/practicetests/RecommendedPracticeTests';

// ── Star Rating Component ──────────────────────────────────────────────────────
function StarRating({ value, onChange, readonly = false }) {
    const [hover, setHover] = useState(0);
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <button
                    key={star}
                    type="button"
                    disabled={readonly}
                    onClick={() => !readonly && onChange && onChange(star)}
                    onMouseEnter={() => !readonly && setHover(star)}
                    onMouseLeave={() => !readonly && setHover(0)}
                    className={`text-2xl transition-transform ${!readonly ? 'hover:scale-125 cursor-pointer' : 'cursor-default'} ${star <= (hover || value) ? 'text-amber-400' : 'text-slate-200'}`}
                >
                    ★
                </button>
            ))}
        </div>
    );
}

// ── Coupon Input ───────────────────────────────────────────────────────────────
function CouponInput({ price, onDiscount }) {
    const [code, setCode] = useState('');
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const apply = async () => {
        if (!code.trim()) return;
        setChecking(true); setError(''); setResult(null);
        try {
            const { data } = await api.post('/coupons/validate', {
                code: code.trim(),
                orderAmount: price,
                applicableTo: 'interviews'
            });
            setResult(data.data);
            onDiscount(data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid coupon');
            onDiscount(null);
        } finally { setChecking(false); }
    };

    const remove = () => { setCode(''); setResult(null); setError(''); onDiscount(null); };

    return (
        <div className="mt-3">
            {result ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-emerald-700 font-bold text-sm">🎉 {result.code} applied!</p>
                        <p className="text-emerald-600 text-xs">Saved ₹{result.discount}</p>
                    </div>
                    <button onClick={remove} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <input
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && apply()}
                        placeholder="COUPON CODE"
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-slate-400 outline-none uppercase"
                    />
                    <button onClick={apply} disabled={checking}
                        className="px-3 py-2 bg-slate-700 text-white text-xs font-semibold rounded-lg disabled:opacity-60 hover:bg-slate-800 transition">
                        {checking ? '...' : 'Apply'}
                    </button>
                </div>
            )}
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
    );
}

// ── Rate Interviewer Modal ─────────────────────────────────────────────────────
function RateModal({ interview, onClose, onRated }) {
    const [rating, setRating] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        if (rating === 0) { setError('Please select a rating'); return; }
        setSubmitting(true); setError('');
        try {
            await api.post(`/interviews/${interview._id}/rate`, { rating });
            onRated();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to submit rating');
        } finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900">Rate this Interviewer</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">✕</button>
                </div>
                <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                        {interview.interviewer?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                        <p className="font-semibold text-slate-800">{interview.interviewer?.name}</p>
                        <p className="text-sm text-primary-600">{interview.domain}</p>
                    </div>
                </div>
                <div className="flex justify-center mb-3">
                    <StarRating value={rating} onChange={setRating} />
                </div>
                <p className="text-center text-sm text-slate-500 mb-4">
                    {rating === 0 ? 'Select a rating' : ['', 'Terrible 😞', 'Poor 😕', 'Okay 😐', 'Good 😊', 'Excellent 🤩'][rating]}
                </p>
                {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm">Cancel</button>
                    <button onClick={submit} disabled={submitting}
                        className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                        {submitting ? 'Submitting...' : 'Submit Rating'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Book Slot Modal ────────────────────────────────────────────────────────────
function BookModal({ interview, onClose, onBooked, user }) {
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [couponData, setCouponData] = useState(null);
    const [booking, setBooking] = useState(false);
    const [error, setError] = useState('');
    const [cashfree, setCashfree] = useState(null);
    const [acceptGuidelines, setAcceptGuidelines] = useState(false);
    const pendingOrderRef = useRef(null);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const availableSlots = interview.slots?.filter(s => !s.isBooked && new Date(s.startTime) > new Date()) || [];
    const discountPercent = getSubscriptionDiscountPercent(user);
    const subDiscountedPrice = applySubscriptionDiscount(interview.price, user);
    const finalPrice = couponData ? couponData.finalAmount : subDiscountedPrice;
    const needsGuidelinesAcceptance = !user?.acceptedInterviewGuidelinesAt;

    useEffect(() => {
        load({ mode: import.meta.env.VITE_CASHFREE_ENVIRONMENT === 'PRODUCTION' ? 'production' : 'sandbox' })
            .then(cf => setCashfree(cf)).catch(err => console.error('[Cashfree] SDK load failed:', err));
    }, []);

    const handleBook = async () => {
        if (!selectedSlot) { setError('Please select a time slot'); return; }
        if (needsGuidelinesAcceptance && !acceptGuidelines) { setError('Please agree to the Interview Conduct Guidelines to continue'); return; }
        setBooking(true); setError('');
        try {
            if (interview.price > 0) {
                // Paid booking (subscriber discount + coupon are both re-validated and
                // applied server-side) — open Cashfree
                let cf = cashfree;
                if (!cf) {
                    cf = await load({ mode: import.meta.env.VITE_CASHFREE_ENVIRONMENT === 'PRODUCTION' ? 'production' : 'sandbox' });
                    setCashfree(cf);
                }
                const { data } = await api.post('/payments/create-checkout-session', {
                    type: 'interview',
                    itemId: interview._id,
                    itemMeta: { slotId: selectedSlot._id, acceptGuidelines },
                    couponCode: couponData?.code || null,
                });
                cf.checkout({
                    paymentSessionId: data.paymentSessionId,
                    redirectTarget: '_self',
                });
            } else {
                // Free booking — direct API
                await api.post(`/interviews/${interview._id}/book`, {
                    slotId: selectedSlot._id,
                    acceptGuidelines,
                });
                if (needsGuidelinesAcceptance && acceptGuidelines) {
                    dispatch(setUser({ acceptedInterviewGuidelinesAt: new Date().toISOString() }));
                }
                onBooked();
                onClose();
            }
        } catch (err) {
            const existingOrderId = err.response?.data?.existingOrderId;
            if (existingOrderId) {
                navigate(`/payment-status?order_id=${existingOrderId}&type=interview&itemId=${interview._id}`);
                return;
            }
            setError(err.response?.data?.message || 'Failed to book slot');
            setBooking(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Book Interview Session</h3>
                        <p className="text-sm text-slate-500">{interview.interviewer?.name} · {interview.domain}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">✕</button>
                </div>

                {/* Price display */}
                <div className="mb-4 p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Session Price</span>
                    <div className="text-right">
                        {finalPrice < interview.price ? (
                            <div>
                                <span className="text-sm text-slate-400 line-through mr-2">₹{interview.price}</span>
                                <span className="text-lg font-bold text-emerald-600">₹{finalPrice}</span>
                                {discountPercent > 0 && <p className="text-xs text-emerald-600 font-medium">{discountPercent}% subscriber discount{couponData ? ' + ' : ''}{couponData ? `${couponData.code} coupon` : ''} applied</p>}
                                {discountPercent === 0 && couponData && <p className="text-xs text-emerald-600 font-medium">{couponData.code} coupon applied</p>}
                            </div>
                        ) : (
                            <span className="text-lg font-bold text-slate-900">₹{interview.price}</span>
                        )}
                    </div>
                </div>

                {/* Coupon input */}
                {interview.price > 0 && (
                    <CouponInput price={subDiscountedPrice} onDiscount={setCouponData} />
                )}

                {/* Slot selection */}
                <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Select a Time Slot</p>
                    {availableSlots.length === 0 ? (
                        <p className="text-sm text-slate-400 italic p-3 bg-slate-50 rounded-lg">No available slots right now.</p>
                    ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {availableSlots.map(slot => (
                                <button
                                    key={slot._id}
                                    onClick={() => setSelectedSlot(slot)}
                                    className={`w-full text-left p-3 rounded-xl border-2 text-sm transition ${selectedSlot?._id === slot._id ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}
                                >
                                    📅 {new Date(slot.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                    <span className="text-xs ml-2 text-slate-400">→ {new Date(slot.endTime).toLocaleTimeString([], { timeStyle: 'short' })}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {needsGuidelinesAcceptance && (
                    <label className="flex items-start gap-2 mt-4 text-sm text-slate-600">
                        <input type="checkbox" checked={acceptGuidelines} onChange={e => setAcceptGuidelines(e.target.checked)} className="mt-0.5 rounded" />
                        <span>By booking, you agree to the <a href="/interview-guidelines" target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">Interview Conduct Guidelines</a></span>
                    </label>
                )}

                {error && <p className="text-red-500 text-xs mt-3">{error}</p>}

                <div className="flex gap-3 mt-5">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm">Cancel</button>
                    <button onClick={handleBook} disabled={booking || availableSlots.length === 0 || (needsGuidelinesAcceptance && !acceptGuidelines)}
                        className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-slate-800 transition">
                        {booking ? 'Booking...' : `Book for ₹${finalPrice}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
function Interviews() {
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [search, setSearch] = useState('');
    const [bookModal, setBookModal] = useState(null);
    const [rateModal, setRateModal] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [myBookings, setMyBookings] = useState([]);
    const [expandedPracticeTests, setExpandedPracticeTests] = useState(new Set());

    const togglePracticeTests = (interviewId) => setExpandedPracticeTests(prev => {
        const next = new Set(prev);
        next.has(interviewId) ? next.delete(interviewId) : next.add(interviewId);
        return next;
    });

    const { user } = useSelector(state => state.auth);
    const navigate = useNavigate();

    const categories = [
        'All', 'Python Developer', 'Data Analyst', 'DevOps',
        'Automation Testing', 'ETL Developer', 'Manual Testing', 'RPA Developer'
    ];

    const fetchInterviews = async () => {
        try {
            let url = '/interviews';
            if (selectedCategory && selectedCategory !== 'All') {
                url += `?domain=${encodeURIComponent(selectedCategory)}`;
            }
            const { data } = await api.get(url);
            setInterviews(data.data);
        } catch (error) {
            console.error('Failed to fetch interviews', error);
        } finally { setLoading(false); }
    };

    const fetchMyBookings = async () => {
        if (!user) return;
        try {
            const { data } = await api.get('/interviews/bookings/me');
            setMyBookings(data.data?.filter(b => b.type === 'interview') || []);
        } catch {}
    };

    useEffect(() => { fetchInterviews(); }, [selectedCategory]);
    useEffect(() => { fetchMyBookings(); }, [user]);

    const handleBookClick = (interview) => {
        if (!user) { navigate('/login'); return; }
        setBookModal(interview);
    };

    const handleBooked = () => {
        setSuccessMsg('Slot booked! Check your Purchase History for the meeting link.');
        setTimeout(() => setSuccessMsg(''), 5000);
        fetchInterviews();
        fetchMyBookings();
    };

    // Check if user has booked an interview (to show Rate button)
    const hasBooked = (interviewId) => myBookings.some(b => b.interview?._id === interviewId || b.interview === interviewId);

    return (
        <>
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="relative overflow-hidden bg-gradient-hero rounded-2xl p-5 sm:p-8 text-white">
                    <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/[0.05] rounded-full" />
                    <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-violet-600/20 rounded-full" />
                    <div className="relative text-center">
                        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 mb-4">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs text-white/80 font-medium">Industry expert interviewers</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Mock Interviews</h1>
                        <p className="text-indigo-200 text-base max-w-xl mx-auto">Practice with industry experts and get real-time feedback to land your dream job.</p>
                    </div>
                </div>

                {successMsg && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-medium text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Slot booked! Check your Purchase History for the meeting link.
                    </div>
                )}

                {/* Search */}
                <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by interviewer name, domain, meeting mode…"
                        className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent shadow-sm"
                    />
                    {search && (
                        <button onClick={() => setSearch('')}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-center">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`flex-shrink-0 px-5 py-2.5 rounded-full font-medium transition-all ${selectedCategory === cat || (cat === 'All' && !selectedCategory) ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Interviewers List */}
                {(() => {
                    const q = search.trim().toLowerCase();
                    const filtered = q
                        ? interviews.filter(i =>
                            i.interviewer?.name?.toLowerCase().includes(q) ||
                            i.domain?.toLowerCase().includes(q) ||
                            i.meetingMode?.toLowerCase().includes(q))
                        : interviews;
                    return loading ? (
                    <div className="text-center py-20">
                        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                            </svg>
                        </div>
                        <p className="text-slate-700 font-bold">No interviewers found</p>
                        <p className="text-slate-400 text-sm mt-1">{q ? 'Try a different search term' : 'No interviewers in this category yet'}</p>
                        {q && <button onClick={() => setSearch('')} className="mt-3 text-indigo-600 text-sm font-semibold hover:underline">Clear search</button>}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map(interview => {
                            const booked = hasBooked(interview._id);
                            const availableSlots = interview.slots?.filter(s => !s.isBooked && new Date(s.startTime) > new Date()) || [];

                            return (
                                <div key={interview._id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-lg transition flex flex-col">
                                    {/* Interviewer header */}
                                    <div className="flex items-start space-x-4 mb-5">
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xl font-bold text-white shrink-0">
                                            {interview.interviewer?.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-slate-900">{interview.interviewer?.name}</h3>
                                            <p className="text-primary-600 font-medium text-sm">{interview.domain}</p>
                                            <p className="text-slate-400 text-xs mt-0.5">{interview.meetingMode}</p>
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="flex items-center justify-between mb-5 pb-5 border-b border-slate-100">
                                        <div className="text-center">
                                            <p className="text-xs text-slate-400 mb-0.5">Price</p>
                                            <p className="font-bold text-primary-600 text-sm">₹{interview.price}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-slate-400 mb-0.5">Available</p>
                                            <p className="font-bold text-slate-900 text-sm">{availableSlots.length} slots</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs text-slate-400 mb-0.5">Rating</p>
                                            <div className="flex items-center gap-1">
                                                <span className="text-amber-400 text-sm">★</span>
                                                <span className="font-bold text-slate-900 text-sm">{interview.ratings?.toFixed(1) || '—'}</span>
                                                {interview.totalReviews > 0 && <span className="text-slate-400 text-xs">({interview.totalReviews})</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Next available slot preview */}
                                    {availableSlots.length > 0 && (
                                        <div className="mb-4 p-3 bg-slate-50 rounded-xl">
                                            <p className="text-xs text-slate-400 mb-1">Next available</p>
                                            <p className="text-sm font-medium text-slate-700">
                                                📅 {new Date(availableSlots[0].startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                            </p>
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="mt-auto flex gap-2">
                                        <button
                                            onClick={() => handleBookClick(interview)}
                                            disabled={availableSlots.length === 0}
                                            className="flex-1 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            {availableSlots.length === 0 ? 'No Slots' : 'Book Session'}
                                        </button>
                                        {booked && (
                                            <button
                                                onClick={() => setRateModal(interview)}
                                                className="px-3 py-2.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-sm font-semibold hover:bg-amber-100 transition"
                                                title="Rate this interviewer"
                                            >
                                                ⭐
                                            </button>
                                        )}
                                    </div>

                                    <button onClick={() => togglePracticeTests(interview._id)}
                                        className="mt-3 py-2 w-full text-xs font-semibold text-violet-600 hover:text-violet-700 text-left">
                                        {expandedPracticeTests.has(interview._id) ? '▾ Hide practice tests' : '▸ Practice tests for this domain'}
                                    </button>
                                    {expandedPracticeTests.has(interview._id) && (
                                        <div className="mt-2">
                                            <RecommendedPracticeTests domain={interview.domain} title="" limit={3}
                                                emptyHint={`No practice tests tagged "${interview.domain}" yet.`} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
                })()}
            </div>

            {bookModal && (
                <BookModal
                    interview={bookModal}
                    user={user}
                    onClose={() => setBookModal(null)}
                    onBooked={handleBooked}
                />
            )}

            {rateModal && (
                <RateModal
                    interview={rateModal}
                    onClose={() => setRateModal(null)}
                    onRated={() => {
                        setSuccessMsg('⭐ Rating submitted! Thank you for your feedback.');
                        setTimeout(() => setSuccessMsg(''), 4000);
                        fetchInterviews();
                    }}
                />
            )}

        </>
    );
}

export default Interviews;
