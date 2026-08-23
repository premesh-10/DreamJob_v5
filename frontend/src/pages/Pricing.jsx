import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { load } from '@cashfreepayments/cashfree-js';
import api from '../lib/api';
import { setUser } from '../features/auth/authSlice';
import { hasActiveSubscription } from '../lib/subscription';

// ── Confirm dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ message, subText, onConfirm, onCancel, danger }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <p className="text-slate-800 font-semibold text-center text-base">{message}</p>
                {subText && <p className="text-slate-500 text-sm text-center">{subText}</p>}
                <div className="flex gap-3 pt-1">
                    <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition text-sm">
                        Keep Subscription
                    </button>
                    <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 font-semibold rounded-xl transition text-sm text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        Yes, Cancel It
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Days remaining badge ────────────────────────────────────────────────────────
function DaysRemaining({ validUntil }) {
    if (!validUntil) return null;
    const days = Math.max(0, Math.ceil((new Date(validUntil) - new Date()) / (1000 * 60 * 60 * 24)));
    const color = days <= 3 ? 'bg-red-100 text-red-700' : days <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
    return (
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>
            {days === 0 ? 'Expires today' : days === 1 ? '1 day left' : `${days} days left`}
        </span>
    );
}

function Pricing() {
    const [loading, setLoading] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [cashfree, setCashfree] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const { user } = useSelector(state => state.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const pendingOrderRef = useRef(null);

    const isSubscribed = hasActiveSubscription(user);
    const currentPlan = user?.subscription?.plan;
    const validUntil = user?.subscription?.validUntil;

    // Prices in INR (must match backend PLAN_PRICES_INR)
    const plans = [
        {
            name: 'Silver',
            price: 999,
            discount: '10%',
            features: [
                '10% off all courses',
                '10% off Mock Interview bookings',
                'Community Forum Access',
                'Standard Support',
            ],
            color: 'bg-slate-400',
            textColor: 'text-slate-600',
            border: 'border-slate-200',
        },
        {
            name: 'Ruby',
            price: 1999,
            discount: '20%',
            features: [
                '20% off all courses',
                '20% off Mock Interview bookings',
                'Resume Review',
                'Priority Support',
            ],
            color: 'bg-rose-500',
            textColor: 'text-rose-600',
            border: 'border-rose-200',
            popular: true,
        },
        {
            name: 'Platinum',
            price: 2999,
            discount: '30%',
            features: [
                '30% off all courses',
                '30% off Mock Interview bookings',
                '1-on-1 Mentorship',
                '24/7 Dedicated Support',
            ],
            color: 'bg-indigo-500',
            textColor: 'text-indigo-600',
            border: 'border-indigo-200',
        },
    ];

    useEffect(() => {
        const init = async () => {
            try {
                const cf = await load({
                    mode: import.meta.env.VITE_CASHFREE_ENVIRONMENT === 'PRODUCTION' ? 'production' : 'sandbox',
                });
                setCashfree(cf);
            } catch (err) {
                console.error('Failed to load Cashfree JS SDK:', err);
            }
        };
        init();
    }, []);

    const handleSubscribe = async (planName) => {
        if (!user) { navigate('/login'); return; }
        if (!cashfree) {
            alert('Payment gateway is still loading. Please wait a moment and try again.');
            return;
        }
        if (isSubscribed) {
            // Should not happen (button is disabled), but guard against it
            alert(`You already have an active ${currentPlan} subscription. It must expire before you can purchase a new plan.`);
            return;
        }

        setLoading(planName);
        try {
            const { data } = await api.post('/payments/create-checkout-session', {
                type: 'subscription',
                plan: planName,
            });

            pendingOrderRef.current = {
                orderId: data.orderId,
                type: 'subscription',
                plan: planName,
                amount: data.orderAmount,
            };

            cashfree.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: '_self' });
        } catch (error) {
            // 409 with existingOrderId = pending payment, redirect to status page
            const existingOrderId = error.response?.data?.existingOrderId;
            if (existingOrderId) {
                navigate(`/payment-status?order_id=${existingOrderId}&type=subscription&plan=${planName}`);
                return;
            }
            // 409 with SUBSCRIPTION_ALREADY_ACTIVE = double-sub guard triggered
            const code = error.response?.data?.code;
            if (code === 'SUBSCRIPTION_ALREADY_ACTIVE') {
                // Sync Redux with the fresh data the server returned
                const freshSub = error.response?.data?.data;
                if (freshSub) dispatch(setUser({ subscription: freshSub }));
                alert(`You already have an active ${freshSub?.plan || ''} subscription. Only one active subscription is allowed at a time.`);
                setLoading(null);
                return;
            }
            alert('Failed to initiate checkout: ' + (error.response?.data?.message || error.message));
            setLoading(null);
        }
    };

    const handleCancelSubscription = () => {
        setConfirm({
            message: 'Cancel your subscription?',
            subText: `Your ${currentPlan} subscription will end immediately. You will lose all subscription discounts. Your learning progress, bookings, and data are always preserved.`,
            onConfirm: async () => {
                setConfirm(null);
                setCancelling(true);
                try {
                    await api.post('/payments/subscription/cancel');
                    // Update Redux so the UI reflects immediately
                    dispatch(setUser({ subscription: { plan: 'None', validUntil: null } }));
                } catch (err) {
                    alert(err.response?.data?.message || 'Failed to cancel subscription. Please try again.');
                } finally {
                    setCancelling(false);
                }
            },
        });
    };

    const planGrad = { Silver: 'from-slate-400 to-slate-500', Ruby: 'from-rose-500 to-red-600', Platinum: 'from-indigo-500 to-violet-600' };
    const planRing = { Silver: 'ring-slate-300', Ruby: 'ring-rose-400', Platinum: 'ring-primary-400' };

    return (
        <>
            <div className="max-w-5xl mx-auto space-y-10 py-4">

                {/* ── Page header ────────────────────────────────────────────── */}
                <div className="text-center">
                    <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-3.5 py-1.5 mb-4">
                        <svg className="w-3.5 h-3.5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-xs font-semibold text-primary-700">Premium Plans</span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
                        Invest in your career
                    </h1>
                    <p className="text-slate-500 max-w-xl mx-auto text-base leading-relaxed">
                        Get exclusive discounts on courses and mock interviews. Cancel anytime — your progress is always safe.
                    </p>
                </div>

                {/* ── Active subscription banner ──────────────────────────────── */}
                {isSubscribed && (
                    <div className={`rounded-2xl border p-5 bg-gradient-to-r ${
                        currentPlan === 'Silver' ? 'from-slate-50 to-slate-100 border-slate-200' :
                        currentPlan === 'Ruby' ? 'from-rose-50 to-red-50 border-rose-200' :
                        'from-primary-50 to-violet-50 border-primary-200'
                    }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${planGrad[currentPlan] || 'from-indigo-500 to-violet-600'} flex items-center justify-center flex-shrink-0`}>
                                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd"/>
                                    </svg>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-slate-900">{currentPlan} Plan — Active</p>
                                        <DaysRemaining validUntil={validUntil} />
                                    </div>
                                    <p className="text-slate-500 text-sm mt-0.5">
                                        Expires {new Date(validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {currentPlan === 'Silver' ? '10%' : currentPlan === 'Ruby' ? '20%' : '30%'} off all purchases
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleCancelSubscription}
                                disabled={cancelling}
                                className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 sm:text-right"
                            >
                                {cancelling ? 'Cancelling…' : 'Cancel subscription'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Expired subscription notice ─────────────────────────────── */}
                {!isSubscribed && currentPlan && currentPlan !== 'None' && validUntil && new Date(validUntil) < new Date() && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <div>
                            <p className="font-semibold text-amber-800 text-sm">Your {currentPlan} plan expired</p>
                            <p className="text-sm text-amber-700 mt-0.5">
                                Expired {new Date(validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Subscribe again to restore your discounts — all your progress is intact.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Plan cards ─────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map(plan => {
                        const isCurrentActivePlan = isSubscribed && currentPlan === plan.name;
                        const blocked = isSubscribed && !isCurrentActivePlan;

                        return (
                            <div
                                key={plan.name}
                                className={`relative bg-white rounded-2xl border-2 flex flex-col transition-all duration-200
                                    ${plan.popular && !isSubscribed ? 'border-primary-400 shadow-glow md:-translate-y-2' : 'border-slate-100 hover:border-slate-200 shadow-soft hover:shadow-card'}
                                    ${isCurrentActivePlan ? `border-primary-400 ring-2 ${planRing[plan.name]} ring-offset-2` : ''}
                                    ${blocked ? 'opacity-55' : ''}
                                `}
                            >
                                {plan.popular && !isSubscribed && (
                                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary-600 to-violet-600 text-white text-xs font-bold px-4 py-1 rounded-full tracking-wide">
                                        Most Popular
                                    </div>
                                )}
                                {isCurrentActivePlan && (
                                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1.5 tracking-wide">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                        Active Plan
                                    </div>
                                )}

                                {/* Card header with gradient accent */}
                                <div className={`h-1.5 rounded-t-[14px] bg-gradient-to-r ${planGrad[plan.name]}`} />

                                <div className="p-7 flex flex-col flex-1">
                                    <div className="mb-6">
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${planGrad[plan.name]} flex items-center justify-center mb-3`}>
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                                        <div className="flex items-baseline gap-1 mt-2">
                                            <span className="text-4xl font-extrabold text-slate-900">₹{plan.price}</span>
                                            <span className="text-slate-400 text-sm font-medium">/month</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">{plan.discount} off courses & interviews</p>
                                    </div>

                                    <ul className="space-y-3 mb-7 flex-1">
                                        {plan.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-center gap-3 text-sm text-slate-600">
                                                <svg className="w-4 h-4 flex-shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                </svg>
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>

                                    {isCurrentActivePlan ? (
                                        <div className="w-full py-3 rounded-xl font-semibold text-center bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm flex items-center justify-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                            Your Active Plan
                                        </div>
                                    ) : isSubscribed ? (
                                        <div className="w-full py-3 rounded-xl text-center bg-slate-50 text-slate-400 border border-slate-200 text-sm cursor-not-allowed font-medium">
                                            Unavailable While Subscribed
                                        </div>
                                    ) : (
                                        <button
                                            id={`subscribe-${plan.name.toLowerCase()}-btn`}
                                            onClick={() => handleSubscribe(plan.name)}
                                            disabled={loading === plan.name || !cashfree}
                                            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 ${
                                                plan.popular
                                                    ? 'bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white shadow-primary hover:shadow-glow-violet'
                                                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-soft'
                                            }`}
                                        >
                                            {loading === plan.name ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Processing…
                                                </span>
                                            ) : 'Subscribe Now'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Info strip ──────────────────────────────────────────────── */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 flex gap-4 items-start">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                        <p className="font-semibold text-slate-800">Your data & progress are always safe</p>
                        <p className="text-slate-500 leading-relaxed">Subscriptions provide discounts — they never control your learning data. All completed lessons, practice test results, certificates, and progress are permanently preserved regardless of subscription status.</p>
                        <p className="text-slate-400 text-xs pt-1">One active subscription at a time · Plans valid for 30 days from purchase</p>
                    </div>
                </div>
            </div>

            {confirm && (
                <ConfirmDialog
                    message={confirm.message}
                    subText={confirm.subText}
                    onConfirm={confirm.onConfirm}
                    onCancel={() => setConfirm(null)}
                    danger
                />
            )}

        </>
    );
}

export default Pricing;
