import AuditLog from '../models/AuditLog.js';

// Lightweight audit trail — called only at high-stakes mutation points
// (cancellation, refund, dispute resolution, recording access by a
// non-owner, verification decisions, admin overrides), not on every read.
export async function logAudit({ actor = null, action, targetType = '', targetId = null, metadata = {}, req = null }) {
    try {
        await AuditLog.create({
            actor: actor || req?.user?._id || null,
            action,
            targetType,
            targetId,
            metadata,
            ip: req?.ip || req?.headers?.['x-forwarded-for'] || '',
        });
    } catch (err) {
        console.error('Failed to write audit log:', err.message);
    }
}
