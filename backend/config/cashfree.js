import { Cashfree, CFEnvironment } from 'cashfree-pg';

if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
    console.error('[Payment] ❌ CASHFREE_APP_ID or CASHFREE_SECRET_KEY is missing from .env!');
}

export const cfEnv = process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION'
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;

// Single shared Cashfree SDK instance — used by checkout, webhook, verify, and refund flows.
export const cashfree = new Cashfree(
    cfEnv,
    process.env.CASHFREE_APP_ID || 'dummy_id',
    process.env.CASHFREE_SECRET_KEY || 'dummy_secret'
);

console.log(`[Payment] Cashfree SDK initialized in ${process.env.CASHFREE_ENVIRONMENT || 'SANDBOX'} mode`);
