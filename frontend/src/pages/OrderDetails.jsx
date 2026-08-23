import { useState, useEffect } from 'react';
import api from '../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount) {
    if (amount == null) return '—';
    return `₹${Number(amount).toFixed(2)}`;
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

const TYPE_LABELS = {
    course: 'Course Purchase',
    interview: 'Mock Interview Booking',
    subscription: 'Subscription',
    webinar: 'Webinar Registration',
};

const TYPE_COLORS = {
    course: { bg: 'bg-blue-100', text: 'text-blue-700' },
    interview: { bg: 'bg-purple-100', text: 'text-purple-700' },
    subscription: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    webinar: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

const STATUS_COLORS = {
    PAID: 'bg-green-100 text-green-700',
    ACTIVE: 'bg-yellow-100 text-yellow-700',
    FAILED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-red-100 text-red-700',
    EXPIRED: 'bg-slate-100 text-slate-500',
    PENDING: 'bg-yellow-100 text-yellow-700',
};

const REFUND_STATUS_COLORS = {
    SUCCESS: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    FAILED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-slate-100 text-slate-500',
    ONHOLD: 'bg-orange-100 text-orange-700',
};

function Field({ label, value, mono }) {
    return (
        <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-sm text-slate-800 break-all ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</p>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * OrderDetails modal.
 *
 * Props:
 *   orderId  — the PRX...ID... string (required)
 *   onClose  — called when user dismisses the modal
 */
function OrderDetails({ orderId, onClose }) {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [invoiceLoading, setInvoiceLoading] = useState(false);

    useEffect(() => {
        if (!orderId) return;
        setLoading(true);
        setError('');
        api.get(`/payments/orders/${orderId}`)
            .then(r => setOrder(r.data.data))
            .catch(err => setError(err.response?.data?.message || 'Failed to load order details'))
            .finally(() => setLoading(false));
    }, [orderId]);

    const openInvoice = async () => {
        setInvoiceLoading(true);
        try {
            const response = await api.get(`/payments/invoice/${orderId}`, { responseType: 'text' });
            const blob = new Blob([response.data], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const win = window.open(url, '_blank');
            if (win) {
                win.addEventListener('load', () => URL.revokeObjectURL(url));
            }
        } catch {
            alert('Failed to generate invoice. Please try again.');
        } finally {
            setInvoiceLoading(false);
        }
    };

    const totalRefunded = order
        ? (order.refunds || [])
            .filter(r => ['SUCCESS', 'PENDING'].includes(r.status))
            .reduce((s, r) => s + r.amount, 0)
        : 0;

    const typeColor = order ? (TYPE_COLORS[order.type] || { bg: 'bg-slate-100', text: 'text-slate-700' }) : null;

    return (
        <>
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Order Details</h2>
                            {order?.orderId && <p className="text-xs font-mono text-indigo-600">{order.orderId}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700">✕</button>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                    {loading && (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}

                    {error && !loading && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
                    )}

                    {order && !loading && (
                        <>
                            {/* Summary strip */}
                            <div className="flex items-center justify-between flex-wrap gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${typeColor.bg} ${typeColor.text}`}>
                                        {TYPE_LABELS[order.type] || order.type}
                                    </span>
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[order.orderStatus] || 'bg-slate-100 text-slate-600'}`}>
                                        {order.orderStatus}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-slate-900">{fmt(order.amount)}</p>
                                    {totalRefunded > 0 && (
                                        <p className="text-xs text-red-500 font-medium">−{fmt(totalRefunded)} refunded</p>
                                    )}
                                </div>
                            </div>

                            {/* Order identifiers */}
                            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Order Identifiers</p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                    <Field label="Order ID" value={order.orderId} mono />
                                    <Field label="Invoice Number" value={order.invoiceNumber} mono />
                                    {order.cfPaymentId && <Field label="Transaction ID" value={order.cfPaymentId} mono />}
                                    <Field label="Gateway Reference" value={order.cashfreeOrderId} mono />
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Timeline</p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                    <Field label="Purchase Date" value={fmtDate(order.createdAt)} />
                                    <Field label="Payment Confirmed" value={fmtDate(order.processedAt)} />
                                    <Field label="Processed By" value={order.processedBy || '—'} />
                                    <Field label="Payment Method" value="Online Payment (Cashfree)" />
                                </div>
                            </div>

                            {/* Billing */}
                            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Billing Information</p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                    <Field label="Name" value={order.buyer?.name} />
                                    <Field label="Email" value={order.buyer?.email} />
                                </div>
                            </div>

                            {/* Item details */}
                            {order.itemDetails && (
                                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Purchase Details</p>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                        {order.type === 'subscription' && (
                                            <>
                                                <Field label="Plan" value={order.itemDetails.plan} />
                                                <Field label="Duration" value="30 days" />
                                            </>
                                        )}
                                        {order.type === 'course' && (
                                            <>
                                                <Field label="Course Title" value={order.itemDetails.title} />
                                                <Field label="Category" value={order.itemDetails.category} />
                                                <Field label="Level" value={order.itemDetails.level} />
                                            </>
                                        )}
                                        {order.type === 'interview' && (
                                            <>
                                                <Field label="Domain" value={order.itemDetails.domain} />
                                                <Field label="Format" value={order.itemDetails.meetingMode} />
                                            </>
                                        )}
                                        {order.type === 'webinar' && (
                                            <>
                                                <Field label="Webinar" value={order.itemDetails.name} />
                                                {order.itemDetails.date && <Field label="Date" value={fmtDate(order.itemDetails.date)} />}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Seller details (not shown for subscriptions) */}
                            {order.sellerDetails && order.type !== 'subscription' && (
                                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Seller / Instructor</p>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                        <Field label="Name" value={order.sellerDetails.name} />
                                        <Field label="Email" value={order.sellerDetails.email} />
                                    </div>
                                </div>
                            )}

                            {/* Payment breakdown */}
                            <div className="border border-slate-200 rounded-xl p-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Payment Summary</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Subtotal</span>
                                        <span className="font-medium text-slate-800">{fmt(order.amount)}</span>
                                    </div>
                                    {order.couponCode && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-1.5">
                                                Coupon
                                                <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">{order.couponCode}</span>
                                            </span>
                                            <span className="text-green-600 font-medium">Applied</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Tax (GST)</span>
                                        <span className="font-medium text-slate-800">₹0.00</span>
                                    </div>
                                    {totalRefunded > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-red-500">Refunded</span>
                                            <span className="font-medium text-red-500">−{fmt(totalRefunded)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2 mt-1">
                                        <span>Total Paid</span>
                                        <span>{fmt(order.amount - totalRefunded)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Refund history */}
                            {(order.refunds || []).length > 0 && (
                                <div className="border border-red-100 bg-red-50 rounded-xl p-4">
                                    <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-3">Refund History</p>
                                    <div className="space-y-2">
                                        {order.refunds.map((r, i) => (
                                            <div key={i} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-red-100">
                                                <div>
                                                    <span className="font-semibold text-slate-800">{fmt(r.amount)}</span>
                                                    {r.note && <span className="text-slate-400 text-xs ml-2">{r.note}</span>}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-400">{fmtDate(r.createdAt)}</span>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${REFUND_STATUS_COLORS[r.status] || 'bg-slate-100 text-slate-600'}`}>
                                                        {r.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer actions */}
                {order && !loading && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 flex-shrink-0 gap-3">
                        <button
                            onClick={openInvoice}
                            disabled={invoiceLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition"
                        >
                            {invoiceLoading ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            )}
                            {invoiceLoading ? 'Loading…' : 'Download Invoice'}
                        </button>
                        <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition">
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
        </>
    );
}

export default OrderDetails;
