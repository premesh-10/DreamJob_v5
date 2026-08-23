import OrderSequence from '../models/OrderSequence.js';

/**
 * One-letter type codes embedded in Order IDs.
 * Add new product types here — no other change needed.
 *
 * Format: PRX{CODE}ID{YYYYMMDD}{7-digit-seq}
 *   e.g.  PRXCID202607010000001  — first ever course purchase on 2026-07-01
 *         PRXMID202607010000001  — first ever mock interview booking
 */
export const ORDER_TYPE_CODES = {
    course:       'C',
    interview:    'M',   // M for Mock Interview
    subscription: 'S',
    webinar:      'W',
    practiceTest: 'P',
    bundle:       'B',
};

/**
 * generateOrderId — atomically mints a globally-unique sequential Order ID.
 *
 * The sequence is global per product type (not per day). The YYYYMMDD in the
 * ID is informational — it records the date of the transaction, not a
 * per-day counter reset. This guarantees no two orders of the same type
 * ever share an ID regardless of volume.
 *
 * @param {string} type  — one of the keys in ORDER_TYPE_CODES
 * @returns {Promise<string>}
 */
export async function generateOrderId(type) {
    const code = ORDER_TYPE_CODES[type] || 'X';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const result = await OrderSequence.findOneAndUpdate(
        { key: `order_${type}` },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
    );

    return `PRX${code}ID${date}${String(result.seq).padStart(7, '0')}`;
}

/**
 * generateInvoiceNumber — atomically mints a monthly-sequential invoice number.
 *
 * Format: INV-{YYYYMM}-{7-digit-seq}
 *   e.g.  INV-202607-0000001
 *
 * Counter resets each calendar month (separate key per month).
 *
 * @returns {Promise<string>}
 */
export async function generateInvoiceNumber() {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const result = await OrderSequence.findOneAndUpdate(
        { key: `invoice_${ym}` },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
    );

    return `INV-${ym}-${String(result.seq).padStart(7, '0')}`;
}
