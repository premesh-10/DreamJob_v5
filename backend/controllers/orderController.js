/**
 * orderController.js — Order Details & Invoice
 * ─────────────────────────────────────────────────────────────────────────────
 * Endpoints:
 *   GET /api/v1/payments/orders/:orderId  — full order details (role-gated)
 *   GET /api/v1/payments/invoice/:orderId — branded HTML invoice (print-to-PDF)
 *
 * Visibility rules:
 *   PRXCID (course)      — purchasing user, course seller, admin
 *   PRXMID (interview)   — candidate, interviewer/seller, admin
 *   PRXSID (subscription)— purchasing user, admin  (NEVER sellers)
 *   PRXWID (webinar)     — purchasing user, webinar seller, admin
 */

import PaymentOrder from '../models/PaymentOrder.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Interview from '../models/Interview.js';
import Webinar from '../models/Webinar.js';

const ADMIN_ROLES = ['admin', 'super_admin'];

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper — load the PaymentOrder and verify the caller has permission
// to view it. Returns { order, accessRole } or throws.
// ─────────────────────────────────────────────────────────────────────────────
async function loadOrderWithAccess(orderId, caller) {
    const order = await PaymentOrder.findOne({ orderId })
        .populate('user', 'name email mobile')
        .populate('transaction');

    if (!order) return { order: null, accessRole: null };

    const isOwner = order.user._id.toString() === caller._id.toString();
    const isAdmin = ADMIN_ROLES.includes(caller.role);

    if (isOwner) return { order, accessRole: 'owner' };
    if (isAdmin) return { order, accessRole: 'admin' };

    // Seller access: course seller, interview interviewer, webinar seller.
    // Subscriptions (PRXSID) — sellers must NEVER see these.
    if (order.type !== 'subscription' && order.itemId) {
        if (order.type === 'course') {
            const course = await Course.findById(order.itemId).select('seller');
            if (course && course.seller.toString() === caller._id.toString()) {
                return { order, accessRole: 'seller' };
            }
        } else if (order.type === 'interview') {
            const interview = await Interview.findById(order.itemId).select('interviewer');
            if (interview && interview.interviewer.toString() === caller._id.toString()) {
                return { order, accessRole: 'seller' };
            }
        } else if (order.type === 'webinar') {
            const webinar = await Webinar.findById(order.itemId).select('seller');
            if (webinar && webinar.seller.toString() === caller._id.toString()) {
                return { order, accessRole: 'seller' };
            }
        }
    }

    return { order: null, accessRole: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get full order details by DreamJob Order ID
// @route   GET /api/v1/payments/orders/:orderId
// @access  Private (owner | relevant seller | admin)
// ─────────────────────────────────────────────────────────────────────────────
export const getOrderDetails = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { order, accessRole } = await loadOrderWithAccess(orderId, req.user);

        if (!order) {
            return res.status(404).json({ message: 'Order not found or you do not have permission to view it' });
        }

        // Enrich with item-specific details
        let itemDetails = null;
        let sellerDetails = null;
        let bookingDetails = null;

        if (order.itemId) {
            if (order.type === 'course') {
                const course = await Course.findById(order.itemId)
                    .select('title category level thumbnail seller')
                    .populate('seller', 'name email');
                if (course) {
                    itemDetails = { title: course.title, category: course.category, level: course.level, thumbnail: course.thumbnail };
                    sellerDetails = course.seller ? { name: course.seller.name, email: course.seller.email } : null;
                }
                const booking = await Booking.findOne({ orderId: order.orderId, type: 'course' })
                    || await Booking.findOne({ user: order.user._id, course: order.itemId, type: 'course' }).sort({ createdAt: -1 });
                if (booking) bookingDetails = { status: booking.status, paymentStatus: booking.paymentStatus, createdAt: booking.createdAt };

            } else if (order.type === 'interview') {
                const interview = await Interview.findById(order.itemId)
                    .select('domain price meetingMode interviewer')
                    .populate('interviewer', 'name email');
                if (interview) {
                    itemDetails = { domain: interview.domain, meetingMode: interview.meetingMode, price: interview.price };
                    sellerDetails = interview.interviewer ? { name: interview.interviewer.name, email: interview.interviewer.email } : null;
                }
                const booking = await Booking.findOne({ orderId: order.orderId, type: 'interview' })
                    || await Booking.findOne({ user: order.user._id, interview: order.itemId, type: 'interview' }).sort({ createdAt: -1 });
                if (booking) {
                    bookingDetails = {
                        status: booking.status,
                        paymentStatus: booking.paymentStatus,
                        createdAt: booking.createdAt,
                    };
                }

            } else if (order.type === 'webinar') {
                const webinar = await Webinar.findById(order.itemId)
                    .select('name date seller')
                    .populate('seller', 'name email');
                if (webinar) {
                    itemDetails = { name: webinar.name, date: webinar.date };
                    sellerDetails = webinar.seller ? { name: webinar.seller.name, email: webinar.seller.email } : null;
                }
            }
        }

        // Subscription plan label
        if (order.type === 'subscription') {
            itemDetails = { plan: order.plan, description: `${order.plan} Plan — 30-day access` };
        }

        res.status(200).json({
            success: true,
            data: {
                orderId: order.orderId,
                invoiceNumber: order.invoiceNumber,
                cashfreeOrderId: order.cashfreeOrderId,
                cfPaymentId: order.cfPaymentId,
                type: order.type,
                plan: order.plan,
                amount: order.amount,
                orderStatus: order.orderStatus,
                couponCode: order.couponCode || null,
                refunds: order.refunds || [],
                createdAt: order.createdAt,
                processedAt: order.processedAt,
                processedBy: order.processedBy,
                buyer: {
                    name: order.user.name,
                    email: order.user.email,
                },
                itemDetails,
                sellerDetails,
                bookingDetails,
                accessRole,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Download a styled HTML invoice for printing / browser-save-as-PDF
// @route   GET /api/v1/payments/invoice/:orderId
// @access  Private (owner | relevant seller | admin)
// ─────────────────────────────────────────────────────────────────────────────
export const downloadInvoice = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { order, accessRole } = await loadOrderWithAccess(orderId, req.user);

        if (!order) {
            return res.status(404).json({ message: 'Order not found or you do not have permission to download this invoice' });
        }

        // Hydrate item label
        let itemLabel = 'Purchase';
        let itemDescription = '';
        let sellerName = '';

        if (order.type === 'subscription') {
            itemLabel = `${order.plan} Subscription`;
            itemDescription = '30-day platform access';
        } else if (order.itemId) {
            if (order.type === 'course') {
                const course = await Course.findById(order.itemId).select('title category').populate('seller', 'name');
                if (course) {
                    itemLabel = course.title;
                    itemDescription = `Course — ${course.category || ''}`;
                    sellerName = course.seller?.name || '';
                }
            } else if (order.type === 'interview') {
                const interview = await Interview.findById(order.itemId).select('domain meetingMode').populate('interviewer', 'name');
                if (interview) {
                    itemLabel = `Mock Interview — ${interview.domain}`;
                    itemDescription = interview.meetingMode || 'LiveKit Video Call';
                    sellerName = interview.interviewer?.name || '';
                }
            } else if (order.type === 'webinar') {
                const webinar = await Webinar.findById(order.itemId).select('name').populate('seller', 'name');
                if (webinar) {
                    itemLabel = webinar.name;
                    itemDescription = 'Live Webinar';
                    sellerName = webinar.seller?.name || '';
                }
            }
        }

        const purchaseDate = new Date(order.processedAt || order.createdAt);
        const formattedDate = purchaseDate.toLocaleDateString('en-IN', {
            day: '2-digit', month: 'long', year: 'numeric',
        });
        const formattedTime = purchaseDate.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: true,
        });

        const totalRefunded = (order.refunds || [])
            .filter(r => ['SUCCESS', 'PENDING'].includes(r.status))
            .reduce((s, r) => s + r.amount, 0);
        const netAmount = order.amount - totalRefunded;

        const refundRowsHtml = (order.refunds || []).length > 0
            ? `<tr><td colspan="2" style="padding:4px 0;border-top:1px solid #e2e8f0;font-size:13px;color:#ef4444;">
                Refunded (${order.refunds.filter(r=>['SUCCESS','PENDING'].includes(r.status)).length} item${order.refunds.length > 1 ? 's' : ''})
               </td><td style="text-align:right;color:#ef4444;font-size:13px;">
                -₹${totalRefunded.toFixed(2)}
               </td></tr>`
            : '';

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Invoice ${order.invoiceNumber || order.orderId}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; }
  .page { max-width: 760px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
  .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #fff; padding: 36px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
  .brand span { opacity: .7; font-weight: 400; }
  .invoice-label { text-align: right; }
  .invoice-label h2 { font-size: 22px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .invoice-label p { font-size: 13px; opacity: .85; margin-top: 4px; }
  .body { padding: 36px 40px; }
  .meta-row { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 32px; }
  .meta-box { flex: 1; }
  .meta-box h4 { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .meta-box p { font-size: 14px; color: #334155; line-height: 1.6; }
  .meta-box .highlight { font-size: 15px; font-weight: 700; color: #4f46e5; font-family: monospace; }
  .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .items-table th { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; padding: 10px 0; border-bottom: 2px solid #e2e8f0; text-align: left; }
  .items-table th:last-child { text-align: right; }
  .items-table td { padding: 14px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; vertical-align: top; }
  .items-table td:last-child { text-align: right; font-weight: 600; }
  .item-name { font-weight: 600; color: #1e293b; font-size: 15px; }
  .item-desc { font-size: 12px; color: #94a3b8; margin-top: 3px; }
  .totals { width: 280px; margin-left: auto; }
  .totals table { width: 100%; }
  .totals td { padding: 5px 0; font-size: 14px; color: #64748b; }
  .totals td:last-child { text-align: right; }
  .totals .total-row td { font-size: 16px; font-weight: 700; color: #1e293b; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 4px; }
  .payment-section { background: #f8fafc; border-radius: 10px; padding: 20px 24px; margin-top: 28px; }
  .payment-section h4 { font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
  .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; }
  .pfield label { font-size: 11px; color: #94a3b8; display: block; margin-bottom: 3px; }
  .pfield span { font-size: 13px; color: #334155; font-weight: 500; font-family: monospace; word-break: break-all; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .status-paid { background: #d1fae5; color: #065f46; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .status-refunded { background: #fee2e2; color: #991b1b; }
  .coupon-badge { display: inline-flex; align-items: center; gap: 6px; background: #ede9fe; color: #5b21b6; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
  .footer p { font-size: 12px; color: #94a3b8; }
  .footer .note { font-size: 11px; color: #cbd5e1; }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; margin: 0; border-radius: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand">Dream<span>Job</span></div>
      <p style="font-size:13px;opacity:.75;margin-top:6px;">Your Career, Our Mission</p>
    </div>
    <div class="invoice-label">
      <h2>Invoice</h2>
      <p>${order.invoiceNumber || '—'}</p>
      <p style="margin-top:8px;font-size:12px;">${formattedDate} · ${formattedTime}</p>
    </div>
  </div>

  <!-- Body -->
  <div class="body">
    <!-- Meta: Bill To + Order Info -->
    <div class="meta-row">
      <div class="meta-box">
        <h4>Bill To</h4>
        <p style="font-weight:600;font-size:15px;">${order.user.name}</p>
        <p>${order.user.email}</p>
      </div>
      <div class="meta-box">
        <h4>Order ID</h4>
        <p class="highlight">${order.orderId || '—'}</p>
      </div>
      ${sellerName ? `<div class="meta-box">
        <h4>Provided By</h4>
        <p style="font-weight:600;">${sellerName}</p>
        <p style="font-size:12px;color:#94a3b8;">DreamJob Verified Seller</p>
      </div>` : ''}
    </div>

    <div class="divider"></div>

    <!-- Line items -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:60%">Description</th>
          <th style="width:20%;text-align:center">Type</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <p class="item-name">${itemLabel}</p>
            ${itemDescription ? `<p class="item-desc">${itemDescription}</p>` : ''}
          </td>
          <td style="text-align:center">
            <span style="background:#ede9fe;color:#5b21b6;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;text-transform:capitalize;">${order.type}</span>
          </td>
          <td>₹${order.amount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <table>
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td>₹${order.amount.toFixed(2)}</td>
          </tr>
          ${order.couponCode ? `<tr>
            <td>Coupon (${order.couponCode})</td>
            <td style="color:#059669;">Applied</td>
          </tr>` : ''}
          <tr>
            <td>Tax (GST)</td>
            <td>₹0.00</td>
          </tr>
          ${refundRowsHtml}
          <tr class="total-row">
            <td>Total Paid</td>
            <td>₹${netAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Payment details -->
    <div class="payment-section">
      <h4>Payment Details</h4>
      <div class="payment-grid">
        <div class="pfield">
          <label>Payment Status</label>
          <span>
            <span class="status-badge ${order.orderStatus === 'PAID' ? 'status-paid' : 'status-pending'}">
              ${order.orderStatus}
            </span>
          </span>
        </div>
        <div class="pfield">
          <label>Payment Method</label>
          <span>Online Payment (Cashfree)</span>
        </div>
        ${order.cfPaymentId ? `<div class="pfield">
          <label>Transaction ID</label>
          <span>${order.cfPaymentId}</span>
        </div>` : ''}
        <div class="pfield">
          <label>Order Reference</label>
          <span>${order.cashfreeOrderId}</span>
        </div>
        <div class="pfield">
          <label>Payment Date</label>
          <span>${formattedDate}</span>
        </div>
        ${order.couponCode ? `<div class="pfield">
          <label>Coupon Applied</label>
          <span class="coupon-badge">🏷 ${order.couponCode}</span>
        </div>` : ''}
      </div>
    </div>

    ${(order.refunds || []).length > 0 ? `
    <div class="payment-section" style="margin-top:16px;">
      <h4>Refund History</h4>
      ${order.refunds.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;">
        <div>
          <span style="font-weight:600;">₹${r.amount.toFixed(2)}</span>
          ${r.note ? `<span style="color:#94a3b8;margin-left:8px;">${r.note}</span>` : ''}
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <span style="color:#94a3b8;font-size:12px;">${new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
          <span class="status-badge ${r.status === 'SUCCESS' ? 'status-paid' : r.status === 'FAILED' ? 'status-refunded' : 'status-pending'}">${r.status}</span>
        </div>
      </div>`).join('')}
    </div>` : ''}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>
      <p>Thank you for choosing DreamJob!</p>
      <p class="note">This is a computer-generated invoice and does not require a signature.</p>
    </div>
    <button class="no-print" onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
      🖨 Print / Save PDF
    </button>
  </div>
</div>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="DreamJob_Invoice_${order.orderId || orderId}.html"`);
        res.status(200).send(html);

    } catch (error) {
        next(error);
    }
};
