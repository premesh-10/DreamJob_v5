export const ADMIN_ROLES = ['admin', 'super_admin', 'moderator', 'finance_admin', 'support_admin'];

/**
 * Resolves the caller's relationship to an InterviewSession — this is the
 * access-control chokepoint shared by every interview-session/recording/
 * lifecycle endpoint so "visible only to interviewer, candidate, or admin"
 * is enforced consistently in exactly one place.
 */
export function getCallerRole(session, user) {
    if (ADMIN_ROLES.includes(user.role)) return 'admin';
    const candidateId = session.candidate?._id ? session.candidate._id.toString() : session.candidate?.toString();
    const interviewerId = session.interviewer?._id ? session.interviewer._id.toString() : session.interviewer?.toString();
    if (candidateId === user._id.toString()) return 'candidate';
    if (interviewerId === user._id.toString()) return 'interviewer';
    return null;
}
