import User from '../models/User.js';

/**
 * hasActiveSubscription — true only while a paid plan is both set AND unexpired.
 * `subscription.plan` is never reset to 'None' when a plan lapses, so checking
 * the plan field alone treats every past subscriber as permanently subscribed.
 */
export function hasActiveSubscription(user) {
    if (!user?.subscription?.plan || user.subscription.plan === 'None') return false;
    const { validUntil } = user.subscription;
    return !validUntil || new Date(validUntil) > new Date();
}

// Subscription grants a price discount only (not free access).
const PLAN_DISCOUNT_PERCENT = {
    Silver: 10,
    Ruby: 20,
    Platinum: 30,
};

export function getSubscriptionDiscountPercent(user) {
    if (!hasActiveSubscription(user)) return 0;
    return PLAN_DISCOUNT_PERCENT[user.subscription.plan] || 0;
}

export function applySubscriptionDiscount(price, user) {
    const pct = getSubscriptionDiscountPercent(user);
    if (!pct) return price;
    return Math.round(price * (1 - pct / 100) * 100) / 100;
}

/**
 * revokeSubscription — immediately terminates a user's active subscription.
 * Sets plan back to 'None' and clears validUntil. Used on refund, cancellation,
 * and admin revocation. Never deletes user data or progress.
 */
export async function revokeSubscription(userId) {
    return User.findByIdAndUpdate(
        userId,
        { $set: { 'subscription.plan': 'None', 'subscription.validUntil': null } },
        { new: true }
    );
}
