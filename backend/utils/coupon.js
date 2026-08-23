import Coupon from '../models/Coupon.js';

/**
 * validateCouponForOrder — the single source of truth for coupon validation.
 * Throws a descriptive Error (never mutates anything) so callers can decide
 * how to surface it (400 response, reject checkout, etc). Re-run this at
 * every spend point — never trust a discount amount echoed back by the client.
 */
export async function validateCouponForOrder(code, orderAmount, applicableTo) {
    const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
    if (!coupon) throw new Error('Invalid coupon code');
    if (!coupon.isActive) throw new Error('This coupon is no longer active');
    if (new Date(coupon.expiresAt) < new Date()) throw new Error('This coupon has expired');
    if (coupon.usedCount >= coupon.maxUses) throw new Error('This coupon has reached its usage limit');
    if (orderAmount < coupon.minOrderAmount) throw new Error(`Minimum order amount is ₹${coupon.minOrderAmount}`);
    if (coupon.applicableTo !== 'all' && coupon.applicableTo !== applicableTo) {
        throw new Error(`This coupon is only valid for ${coupon.applicableTo}`);
    }

    let discount = coupon.discountType === 'percent'
        ? (orderAmount * coupon.discountValue) / 100
        : coupon.discountValue;
    discount = Math.min(discount, orderAmount);
    discount = Math.round(discount * 100) / 100;

    return {
        coupon,
        discount,
        finalAmount: Math.round((orderAmount - discount) * 100) / 100,
    };
}

/**
 * redeemCoupon — increments usedCount, guarded by maxUses to stay race-safe
 * under concurrent redemptions. Call this only once a payment is genuinely
 * confirmed (fulfillment time), never at checkout-creation time, since not
 * every checkout session is ever completed. Best-effort: a redemption-count
 * miss never blocks or reverses an already-successful payment.
 */
export async function redeemCoupon(code) {
    if (!code) return;
    await Coupon.findOneAndUpdate(
        { code: String(code).toUpperCase().trim(), $expr: { $lt: ['$usedCount', '$maxUses'] } },
        { $inc: { usedCount: 1 } }
    );
}
