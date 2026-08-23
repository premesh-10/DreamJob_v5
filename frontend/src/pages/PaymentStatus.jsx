import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUser } from '../features/auth/authSlice';
import api from '../lib/api';

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 10;     // ~30s of polling while Cashfree is still processing
const MAX_ERROR_RETRIES = 4;      // ~12s of retrying after a network/server hiccup

/**
 * PaymentStatus page
 * Cashfree redirects the user here (or we navigate programmatically) after checkout.
 * URL params: ?order_id=...&type=subscription|course|interview|webinar&plan=...&itemId=...&amount=...
 *
 * Status states:
 *  - verifying : initial check in progress
 *  - pending   : Cashfree is still processing the payment (UPI/netbanking can be async) — auto-polls
 *  - success   : payment confirmed and fulfilled
 *  - cancelled : the user didn't complete the payment (order still ACTIVE / terminated)
 *  - failed    : payment genuinely failed or the order expired
 *  - error     : we couldn't confirm status due to a network/server issue — NOT a verdict on
 *                the payment itself, so we never suggest retrying payment here (that risks a
 *                real double-payment if the original attempt actually succeeded)
 */
function PaymentStatus() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [status, setStatus] = useState('verifying');
    const [message, setMessage] = useState('');
    const [orderDetails, setOrderDetails] = useState(null);

    const pollAttempts = useRef(0);
    const errorRetries = useRef(0);
    const timerRef = useRef(null);

    const orderId = searchParams.get('order_id');
    const type = searchParams.get('type');
    const plan = searchParams.get('plan');
    const itemId = searchParams.get('itemId');
    const amount = searchParams.get('amount');

    useEffect(() => {
        if (!orderId) {
            setStatus('error');
            setMessage('No order information found in the link. If you completed a payment, check your Purchase History.');
            return;
        }

        verify();
        return () => clearTimeout(timerRef.current);
    }, [orderId]);

    const scheduleRetry = (delay = POLL_INTERVAL_MS) => {
        timerRef.current = setTimeout(verify, delay);
    };

    const verify = async () => {
        try {
            const { data } = await api.get(`/payments/verify/${orderId}`);
            errorRetries.current = 0;

            if (data.isPaid) {
                try {
                    const profileRes = await api.get('/auth/me');
                    if (profileRes.data?.data) dispatch(setUser(profileRes.data.data));
                } catch (_) { /* Non-critical */ }

                setStatus('success');
                setOrderDetails(data);
                setMessage(getSuccessMessage(type, plan, amount));
                return;
            }

            // Not yet paid. Cashfree's order-level status has no "processing" state
            // (only ACTIVE/PAID/EXPIRED/TERMINATED/TERMINATION_REQUESTED) — the backend
            // also looks at the latest individual payment attempt (paymentStatus) to
            // tell "still processing" apart from "never attempted / backed out".
            const { orderStatus, paymentStatus } = data;

            // Terminal order-level states win regardless of payment attempt status.
            if (orderStatus === 'EXPIRED') {
                setStatus('failed');
                setMessage('This payment link expired before it was completed. You can safely try again.');
                return;
            }
            if (orderStatus === 'TERMINATED' || orderStatus === 'TERMINATION_REQUESTED') {
                setStatus('cancelled');
                setMessage('This payment was cancelled and was not charged. You can try again whenever you\'re ready.');
                return;
            }

            if (paymentStatus === 'PENDING') {
                if (pollAttempts.current < MAX_POLL_ATTEMPTS) {
                    pollAttempts.current += 1;
                    setStatus('pending');
                    setMessage('Your payment is still processing. This page will update automatically — please don\'t pay again.');
                    scheduleRetry();
                } else {
                    setStatus('pending');
                    setMessage('Your payment is taking longer than usual to confirm. Please check your Purchase History shortly — do not attempt to pay again.');
                }
                return;
            }

            if (paymentStatus === 'FAILED' || paymentStatus === 'VOID') {
                setStatus('failed');
                setMessage('Your payment attempt did not go through. You were not charged. You can try again.');
                return;
            }

            // USER_DROPPED, CANCELLED, NOT_ATTEMPTED (or no attempt at all) — the user
            // backed out before finishing. Not charged, no need for alarming language.
            setStatus('cancelled');
            setMessage('Payment was not completed. You were not charged. You can try again whenever you\'re ready.');

        } catch (error) {
            const httpStatus = error.response?.status;

            // Non-transient — order genuinely doesn't exist or isn't this user's. Retrying won't help.
            if (httpStatus === 404 || httpStatus === 403) {
                setStatus('error');
                setMessage(error.response?.data?.message || 'We could not locate this order.');
                return;
            }

            // Transient (network blip, our server momentarily failing fulfilment) — retry
            // a few times before giving up. Never declare "Payment Failed" for our own error.
            if (errorRetries.current < MAX_ERROR_RETRIES) {
                errorRetries.current += 1;
                setStatus('verifying');
                scheduleRetry();
                return;
            }

            setStatus('error');
            setMessage('We couldn\'t confirm your payment status right now. If money was deducted, it will reflect in your Purchase History shortly — please don\'t pay again. You can tap "Check Again" or contact support with your Order ID.');
        }
    };

    const manualRecheck = () => {
        pollAttempts.current = 0;
        errorRetries.current = 0;
        setStatus('verifying');
        verify();
    };

    // Map payment type to a human-readable success message
    const getSuccessMessage = (t, p, amt) => {
        switch (t) {
            case 'subscription': return `Your ${p} subscription plan is now active!`;
            case 'course':       return `You're enrolled! Happy learning.`;
            case 'interview':    return `Your interview slot is booked! Check your bookings for the meeting link.`;
            case 'webinar':      return `You're registered for the webinar! Check your bookings for the meeting link.`;
            default:             return `Payment of ₹${amt} was successful!`;
        }
    };

    // Map payment type to success CTA destination
    const getSuccessPath = (t, id) => {
        switch (t) {
            case 'subscription': return '/pricing';
            case 'course':       return id ? `/courses/${id}` : '/courses';
            case 'interview':    return '/history';
            case 'webinar':      return '/webinars';
            default:             return '/';
        }
    };

    const getSuccessLabel = (t) => {
        switch (t) {
            case 'subscription': return 'View My Plan';
            case 'course':       return 'Go to Course';
            case 'interview':    return 'View My Bookings';
            case 'webinar':      return 'My Webinars';
            default:             return 'Go to Dashboard';
        }
    };

    const titleByStatus = {
        verifying: 'Verifying Payment…',
        pending: 'Processing Payment…',
        success: 'Payment Successful!',
        cancelled: 'Payment Cancelled',
        failed: 'Payment Failed',
        error: 'Couldn\'t Confirm Payment',
    };

    const getIcon = () => {
        if (status === 'verifying' || status === 'pending') return (
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
        if (status === 'success') return (
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
            </div>
        );
        if (status === 'cancelled' || status === 'error') return (
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v3.75m0 3.75h.008M10.34 3.94l-8.486 14.7A1.5 1.5 0 003.2 21h17.6a1.5 1.5 0 001.347-2.36l-8.487-14.7a1.5 1.5 0 00-2.32 0z" />
                </svg>
            </div>
        );
        return (
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
        );
    };

    return (
        <>
            <div className="max-w-md mx-auto mt-16">
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-10 text-center">
                    {getIcon()}

                    <h1 className="text-2xl font-bold text-slate-900 mb-3">{titleByStatus[status]}</h1>

                    <p className="text-slate-500 mb-2 leading-relaxed">{message}</p>

                    {orderId && (
                        <p className="text-xs text-slate-400 font-mono mt-2">Order ID: {orderId}</p>
                    )}

                    {orderDetails && (
                        <div className="mt-4 bg-slate-50 rounded-xl p-4 text-left text-sm space-y-1">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Order ID</span>
                                <span className="font-mono text-slate-700 text-xs">{orderDetails.orderId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Amount</span>
                                <span className="font-semibold text-slate-800">₹{orderDetails.orderAmount}</span>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 space-y-3">
                        {status === 'success' && (
                            <button
                                onClick={() => navigate(getSuccessPath(type, itemId))}
                                className="w-full py-3 px-4 text-white font-semibold rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 shadow-primary hover:shadow-glow-violet transition-all duration-200"
                            >
                                {getSuccessLabel(type)}
                            </button>
                        )}
                        {(status === 'failed' || status === 'cancelled') && (
                            <button
                                onClick={() => navigate(-1)}
                                className="w-full py-3 px-4 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 transition"
                            >
                                Try Again
                            </button>
                        )}
                        {(status === 'error' || status === 'pending') && (
                            <button
                                onClick={manualRecheck}
                                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
                            >
                                Check Again
                            </button>
                        )}
                        {status === 'error' && (
                            <button
                                onClick={() => navigate('/history')}
                                className="w-full py-3 px-4 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition"
                            >
                                View Purchase History
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/')}
                            className="w-full py-3 px-4 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition"
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>

        </>
    );
}

export default PaymentStatus;
